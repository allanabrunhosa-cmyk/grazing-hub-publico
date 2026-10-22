import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { prepararMigrationHubIsolada, limparIntegracaoHubIsolada } from "../login/migrations-hub-isoladas";
import type { SessaoAtual } from "@/lib/session";
import type { AdaptadorFiscalSaida, RespostaFiscalSaida } from "@/lib/fiscal-saida/contrato";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, adapter: null as AdaptadorFiscalSaida | null, dataFiscal: "2026-10-11" }));
vi.mock("server-only", () => ({}));
// Todos os provedores e retornos desta suíte são sintéticos. Não libera o runtime.
vi.mock("@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao", () => ({ exigirTransmissaoBrasilNfeLiberada: () => {}, transmissaoBrasilNfeLiberada: () => true }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("@/lib/fiscal-saida/provedor", () => ({ obterAdaptadorFiscalSaida: () => sim.adapter }));
vi.mock("@/lib/tributacao/validacao", async importar => ({ ...await importar<typeof import("@/lib/tributacao/validacao")>(), hojeFiscal: () => sim.dataFiscal }));
import { prepararFiscalSaida as prepararFiscalSaidaReal, solicitarAcaoFiscalSaida, processarFiscalSaida, aplicarRetornoFiscalSaida, obterArquivosFiscalSaida, baixarArquivoFiscalSaida } from "@/lib/fiscal-saida/servico";
import { POST } from "@/app/api/fiscal-saida/retorno/route";
import { prepararDocumentoBrasilNfeLocal } from "@/lib/fiscal-saida/brasilnfe/preparacao-local";
import { prepararPayloadLocalBrasilNfe, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { interpretarConsultaBrasilNfe, prepararConsultaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/consulta";
import { validarArquivosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/arquivos";
import { massaPayloadLocal } from "../fiscal-saida/brasilnfe-payload-local-fixtures";
import { chaveFicticia, notaFicticia } from "../fiscal-saida/brasilnfe-fixtures";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import type { ClassificacaoFiscal, PerfilFiscal, RegraFiscal, TabelaFiscal, TipoVersaoFiscal } from "@/lib/tributacao/tipos";
import { hashFiscal } from "@/lib/tributacao/servico";
import { validarSnapshotBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe";
import { registrarCapacidadeEmissaoManualBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/capacidade-operacional";
const esquema = `teste_fiscal_saida_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined; let criado = false; let sessao: SessaoAtual; let produtoId: string;
// Fato declarado apenas nesta massa sintética. Retirada não presume presença no HUB.
function prepararFiscalSaida(pedidoId: string, versao: number, autor: SessaoAtual, modelo: "55" | "65" = "65", opcoes: NonNullable<Parameters<typeof prepararFiscalSaidaReal>[4]> = {}) {
  return prepararFiscalSaidaReal(pedidoId, versao, autor, modelo, { indicadorPresenca: 1, ...opcoes });
}
function adaptador(): AdaptadorFiscalSaida {
  return { id: "SIMULADOR_EXCLUSIVO_TESTES", ambiente: "HOMOLOGACAO", enviar: vi.fn(), consultar: vi.fn(), cancelar: vi.fn(), obterDocumentos: vi.fn(), autenticarRetorno: vi.fn() };
}
// Apenas o identificador exercita a política do provedor; todas as funções são mocks.
function brasilNfeInteiramenteMockado(): AdaptadorFiscalSaida { return { ...adaptador(), id: "BRASIL_NFE" }; }
function retorno(id: string, status: RespostaFiscalSaida["status"] = "AUTORIZADO", sequencia = 1): RespostaFiscalSaida {
  return { documentoId: id, eventoId: `${id}-${sequencia}`, sequencia, status, referencia: `ref-${id}`, numero: "123", serie: "TESTE", protocolo: status === "CANCELADO" ? "protocolo-ficticio-1" : `protocolo-ficticio-${sequencia}`, ...(status === "CANCELADO" ? { protocoloEvento: `protocolo-evento-ficticio-${sequencia}` } : {}), chave: "0".repeat(44) };
}
async function pedido(produtoFiscalId = produtoId) {
  const p = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "sintetico", criadoPorId: sessao.userId, status: "CONFIRMADO", modoFinanceiro: "HUB", versaoFinanceiro: 1, confirmadoEm: new Date("2026-09-30T23:59:59-03:00"), total: 300, subtotal: 300, atendimento: "RETIRADA", formaPagamentoInformada: "PIX", pagamentoInformadoSnapshot: { tipo: "PIX" }, compradorSnapshot: { nome: "Comprador fictício" }, cobrancaSnapshot: { nome: "Cobrança fictícia", pais: "Brasil", uf: "SP" }, itens: { create: { produtoId: produtoFiscalId, versaoPedido: 1, ordem: 0, quantidade: 1, unidadeSnapshot: "UN", produtoSnapshot: { id: produtoFiscalId, nome: "Produto fiscal sintético" }, escolhasSnapshot: [], estadoComposicao: "SEM_MOVIMENTO", precoOriginal: 300, precoAplicado: 300, acrescimos: 0, totalLinha: 300 } } } });
  return prepararFiscalSaida(p.id, p.versao, sessao);
}
async function vencerConsulta(id: string) { await sim.prisma.documentoFiscalSaida.update({ where: { id }, data: { proximaTentativa: new Date("2020-01-01") } }); }
async function destinatarioFicticioCompleto(pedidoId: string) {
  await sim.prisma.pedidoVenda.update({ where: { id: pedidoId }, data: { compradorSnapshot: { tipo: "PF", nome: "Consumidor exclusivamente sintético", documento: "11144477735", indicadorIe: 9 },
    cobrancaSnapshot: { pais: "BRASIL", uf: "SP", cidade: "São Paulo", codigoMunicipio: "3550308", cep: "01001000", logradouro: "Logradouro exclusivamente sintético", numero: "1", bairro: "Centro" } } });
}
function emissorManualFicticio(documentoId: string, ambiente: "HOMOLOGACAO" | "PRODUCAO") {
  return registrarCapacidadeEmissaoManualBrasilNfe({ ...brasilNfeInteiramenteMockado(), ambiente }, documentoId);
}
async function pedidoComPayloadLocal() {
  const m = massaPayloadLocal(), item = m.documento.payload.itens[0];
  await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...m.cadastro }, update: m.cadastro });
  const produto = await sim.prisma.produtoVenda.create({ data: { nome: item.produto.nome, fiscal: item.fiscal.produto, fiscalRevisado: true } });
  const p = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "sintetico-m2", criadoPorId: sessao.userId, status: "CONFIRMADO", modoFinanceiro: "HUB", versaoFinanceiro: 1, confirmadoEm: new Date("2026-10-01T12:00:00Z"), ...m.documento.payload.valores, compradorSnapshot: m.documento.payload.comprador, pagamentoInformadoSnapshot: m.documento.payload.pagamento } });
  const linha = await sim.prisma.itemPedidoVenda.create({ data: { pedidoId: p.id, produtoId: produto.id, versaoPedido: 1, ordem: 0, quantidade: item.quantidade, unidadeSnapshot: item.unidade, produtoSnapshot: item.produto, escolhasSnapshot: [], estadoComposicao: "CONHECIDA", precoOriginal: item.preco, precoAplicado: item.preco, acrescimos: item.acrescimos, desconto: item.desconto, totalLinha: item.total } });
  const fotografia = { ...m.documento.payload, pedido: { id: p.id, revisao: 1 }, itens: [{ ...item, id: linha.id, produtoId: produto.id, fiscal: { ...item.fiscal, versaoCadastro: 1 } }] };
  const d = await sim.prisma.documentoFiscalSaida.create({ data: { pedidoId: p.id, versaoPedido: 1, versaoPayload: 1, payload: fotografia, hashPayload: hashFiscal(fotografia), criadoPorId: sessao.userId, criadoPorNome: sessao.nome } });
  await sim.prisma.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `preparado:${d.id}`, tipo: "PREPARADO", dados: {} } });
  m.parametros.vinculo = { documentoId: d.id, hashPayload: d.hashPayload, revisaoPedido: d.versaoPedido };
  Object.assign(m.parametros.itens[0], { itemId: linha.id, produtoId: produto.id });
  return { ...m, documento: d };
}
async function efeitosAlheios() {
  return { financeiro: await sim.prisma.lancamentoFinanceiro.count(), estoque: await sim.prisma.movimentacaoEstoque.count(), recebidas: await sim.prisma.notaFiscalRecebida.count() };
}
async function produtoClassificadoFicticio() {
  const p = await sim.prisma.produtoVenda.create({ data: { nome: "Mercadoria específica fictícia", unidade: "UN" } });
  const original = await sim.prisma.versaoEstruturaFiscal.findFirstOrThrow({ where: { tipo: "CLASSIFICACAO", chave: produtoId } });
  const dados = validarDadosFiscais("CLASSIFICACAO", { ...original.dados as ClassificacaoFiscal, produtoId: p.id });
  await sim.prisma.versaoEstruturaFiscal.create({ data: { tipo: "CLASSIFICACAO", chave: p.id, versao: 1, vigenciaInicio: original.vigenciaInicio, dados: JSON.parse(JSON.stringify(dados)) as Prisma.InputJsonValue, status: "ATIVO", hash: "classificacao-especifica-ficticia", justificativa: "Fixture individual exclusivamente fictícia", fontes: original.fontes as Prisma.InputJsonValue, criadoPorId: sessao.userId, criadoPorNome: sessao.nome, chaveOperacao: randomUUID(), hashOperacao: "classificacao-especifica-ficticia" } });
  return p.id;
}
async function acrescentarRegraVigenteFicticia(produtoFiscalId: string) {
  const original = await sim.prisma.versaoEstruturaFiscal.findFirstOrThrow({ where: { tipo: "REGRA", chave: "regra-sintetica" }, orderBy: { versao: "desc" } });
  const dados = validarDadosFiscais("REGRA", { ...original.dados as RegraFiscal, produtoId: produtoFiscalId, segregacaoReceita: "NOVA_REGRA_ESPECIFICA_FICTICIA" });
  return sim.prisma.versaoEstruturaFiscal.create({ data: { tipo: "REGRA", chave: `especifica-${produtoFiscalId}`, versao: 1, vigenciaInicio: new Date(`${sim.dataFiscal}T00:00:00Z`), dados: JSON.parse(JSON.stringify(dados)) as Prisma.InputJsonValue, status: "ATIVO", hash: "nova-regra-especifica-ficticia", justificativa: "Nova regra específica na mesma data, somente fixture de regressão", fontes: original.fontes as Prisma.InputJsonValue, criadoPorId: sessao.userId, criadoPorNome: sessao.nome, chaveOperacao: randomUUID(), hashOperacao: "nova-regra-especifica-ficticia" } });
}
describe.skipIf(process.env.PEDIDOS_BANCO_TESTE !== "1")("Saída fiscal durável com provedor exclusivo de teste", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!); if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/teste_/.test(url.pathname)) throw new Error("Somente banco local exclusivo de testes");
    banco = new Client({ connectionString: url.toString() }); await banco.connect(); await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true; await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(await prepararMigrationHubIsolada(banco, esquema, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Autor fictício fiscal", email: "fiscal-saida@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    sessao = { userId: u.id, nome: u.nome, versao: 0, admin: true, email: u.email, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Produto fiscal sintético", codigo: "FISCAL-SINTETICO", fiscal: {}, unidade: "UN" } }); produtoId = produto.id;
    const perfilFiscal: PerfilFiscal = { estabelecimento: "singleton", cnpj: "12345678000195", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "123456789012", regime: "SIMPLES_NACIONAL", crt: 1, confirmado: true, evidenciaEnquadramento: "Comprovação exclusivamente sintética", modelos: ["55", "65"], emissor: "TAKEAT", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null };
    const classificacao: ClassificacaoFiscal = { produtoId, grupo: "GF01", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: "0", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Formulação sintética de teste; declaração fictícia explícita de produto sem GTIN"], pendencias: [] };
    const semDestaque = { cst: "40", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Cálculo sintético sem destaque" };
    const regra: RegraFiscal = { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, produtoId: null, natureza: null, ncm: null, cfop: "5101", csosn: "102", icms: semDestaque, pis: { ...semDestaque, cst: "49" }, cofins: { ...semDestaque, cst: "49" }, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "PREPARADO_SINTETICO", reforma: null, seletivo: "NAO_APLICAVEL" };
    const dados: { tipo: TipoVersaoFiscal; chave: string; dados: unknown }[] = [{ tipo: "PERFIL", chave: "singleton", dados: perfilFiscal }, { tipo: "CLASSIFICACAO", chave: produtoId, dados: classificacao }, { tipo: "REGRA", chave: "regra-sintetica", dados: regra }];
    for (const [tabela, codigo] of [["NCM", "19059090"], ["CFOP", "5101"], ["CSOSN", "102"], ["CST_ICMS", "40"], ["CST_PIS_COFINS", "49"]] as const) dados.push({ tipo: "TABELA", chave: tabela, dados: { tabela, referencia: "Tabela exclusivamente sintética, não homologação externa", completa: false, linhas: [{ codigo, descricao: "Descrição fiscal sintética" }] } satisfies TabelaFiscal });
    for (const registro of dados) await sim.prisma.versaoEstruturaFiscal.create({ data: { tipo: registro.tipo, chave: registro.chave, dados: JSON.parse(JSON.stringify(validarDadosFiscais(registro.tipo, registro.dados))) as Prisma.InputJsonValue, versao: 1, vigenciaInicio: new Date("2026-01-01T00:00:00Z"), status: "ATIVO", hash: "hash-sintetico", justificativa: "Fixture fiscal validada sintética", fontes: ["https://www.gov.br/receitafederal/pt-br"], criadoPorId: sessao.userId, criadoPorNome: sessao.nome, chaveOperacao: randomUUID(), hashOperacao: "hash-sintetico" } });
  }, 90000);
  beforeEach(() => { sim.adapter = null; sim.dataFiscal = "2026-10-11"; vi.clearAllMocks(); });
  afterAll(async () => { await sim.prisma?.$disconnect(); if (!banco) return; if (criado && /^teste_fiscal_saida_[a-f0-9]{32}$/.test(esquema)) { await limparIntegracaoHubIsolada(banco, esquema); await banco.query(`DROP SCHEMA "${esquema}" CASCADE`); } await banco.end(); });
  it("sem emissor prepara uma vez, guarda revisão e não cria fila/efeito financeiro ou físico", async () => {
    const d = await pedido();
    const [a, b] = await Promise.all([prepararFiscalSaida(d.pedidoId, 1, sessao), prepararFiscalSaida(d.pedidoId, 1, sessao)]);
    expect(a.id).toBe(b.id); expect(d).toMatchObject({ status: "SEM_EMISSOR", acao: null, ambiente: "HOMOLOGACAO", modeloDocumento: 65 });
    expect(d.payload).toMatchObject({ versao: 2, pedido: { revisao: 1 }, tributacao: { apto: true, pendencias: [], documento: { ModeloDocumento: 65, ValorTotal: "300.00" } }, valores: { total: "300" }, comprador: { nome: "Comprador fictício" } });
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow("Emissor não configurado");
    expect(await processarFiscalSaida()).toMatchObject({ processado: false });
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    expect((await POST(new Request("http://localhost/api/fiscal-saida/retorno", { method: "POST", body: "{}" }))).status).toBe(503);
    await expect(prepararFiscalSaida(d.pedidoId, 1, { ...sessao, versao: 99 })).rejects.toThrow("sessão");
  });
  it("preparação separa modelo e ambiente, mantendo revisão global e o mesmo pedido comercial", async () => {
    const d = await pedido(), efeitos = await efeitosAlheios(), original = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } });
    const [h55, p65] = await Promise.all([prepararFiscalSaida(d.pedidoId, 1, sessao, "55", { ambiente: "HOMOLOGACAO" }), prepararFiscalSaida(d.pedidoId, 1, sessao, "65", { ambiente: "PRODUCAO" })]);
    expect(new Set([d.id, h55.id, p65.id]).size).toBe(3);
    expect([d.revisaoFiscal, h55.revisaoFiscal, p65.revisaoFiscal].sort()).toEqual([1, 2, 3]);
    expect(h55).toMatchObject({ ambiente: "HOMOLOGACAO", modeloDocumento: 55, pedidoId: d.pedidoId });
    expect(p65).toMatchObject({ ambiente: "PRODUCAO", modeloDocumento: 65, pedidoId: d.pedidoId });
    expect(h55.payload).toMatchObject({ tributacao: { documento: { ModeloDocumento: 55, TipoAmbiente: 2 } } });
    expect(p65.payload).toMatchObject({ tributacao: { documento: { ModeloDocumento: 65, TipoAmbiente: 1 } } });
    expect((await prepararFiscalSaida(d.pedidoId, 1, sessao, "55", { ambiente: "HOMOLOGACAO" })).id).toBe(h55.id);
    expect((await prepararFiscalSaida(d.pedidoId, 1, sessao, "65", { ambiente: "PRODUCAO" })).id).toBe(p65.id);
    expect((await prepararFiscalSaida(d.pedidoId, 1, sessao)).id).toBe(d.id);
    expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } })).toEqual(original);
    expect(await efeitosAlheios()).toEqual(efeitos);
  });
  it.each(["AUTORIZADO", "PENDENTE_CONFERENCIA"])("homologação %s não bloqueia a preparação e solicitação produtiva independente", async status => {
    const h = await pedido(); await destinatarioFicticioCompleto(h.pedidoId);
    await sim.prisma.documentoFiscalSaida.update({ where: { id: h.id }, data: { ambiente: "HOMOLOGACAO", provedor: "BRASIL_NFE", status, referenciaProvedor: `referencia-hom-${h.id}`, protocolo: status === "AUTORIZADO" ? "135260000000001" : null } });
    const efeitos = await efeitosAlheios(), p = await prepararFiscalSaida(h.pedidoId, 1, sessao, "55", { ambiente: "PRODUCAO" });
    sim.adapter = emissorManualFicticio(p.id, "PRODUCAO");
    await solicitarAcaoFiscalSaida(p.id, "ENVIAR", "Solicitação exclusivamente sintética", sessao);
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ ambiente: "PRODUCAO", modeloDocumento: 55, acao: "ENVIAR" });
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ ambiente: "HOMOLOGACAO", status, referenciaProvedor: `referencia-hom-${h.id}` });
    expect(await efeitosAlheios()).toEqual(efeitos); expect(sim.adapter.enviar).not.toHaveBeenCalled();
    await sim.prisma.documentoFiscalSaida.update({ where: { id: p.id }, data: { acao: null, proximaTentativa: null } });
  });
  it("homologações55 e65 têm contextos próprios sem conceder envio de outro documento", async () => {
    const h65 = await pedido(); await destinatarioFicticioCompleto(h65.pedidoId);
    await sim.prisma.documentoFiscalSaida.update({ where: { id: h65.id }, data: { provedor: "BRASIL_NFE", status: "AUTORIZADO", referenciaProvedor: `hom65-${h65.id}`, protocolo: "135260000000001" } });
    const h55 = await prepararFiscalSaida(h65.pedidoId, 1, sessao, "55", { ambiente: "HOMOLOGACAO" });
    sim.adapter = emissorManualFicticio(h55.id, "HOMOLOGACAO");
    await solicitarAcaoFiscalSaida(h55.id, "ENVIAR", "Solicitação exclusivamente sintética", sessao);
    expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: h55.id } })).acao).toBe("ENVIAR");
    expect(sim.adapter.enviar).not.toHaveBeenCalled();
    await sim.prisma.documentoFiscalSaida.update({ where: { id: h55.id }, data: { acao: null, proximaTentativa: null } });
  });
  it("produção55 impede outra emissão produtiva65 da mesma venda", async () => {
    const h = await pedido(); await destinatarioFicticioCompleto(h.pedidoId);
    const p55 = await prepararFiscalSaida(h.pedidoId, 1, sessao, "55", { ambiente: "PRODUCAO" });
    await sim.prisma.documentoFiscalSaida.update({ where: { id: p55.id }, data: { provedor: "BRASIL_NFE", status: "AUTORIZADO", referenciaProvedor: `prod55-${p55.id}`, protocolo: "135260000000001" } });
    const p65 = await prepararFiscalSaida(h.pedidoId, 1, sessao, "65", { ambiente: "PRODUCAO" }); sim.adapter = emissorManualFicticio(p65.id, "PRODUCAO");
    await expect(solicitarAcaoFiscalSaida(p65.id, "ENVIAR", "Solicitação exclusivamente sintética", sessao)).rejects.toThrow("outro documento autorizado");
    expect(sim.adapter.enviar).not.toHaveBeenCalled();
    expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: p65.id } })).acao).toBeNull();
  });
  it.each([{ ambiente: "NAO_CONFIGURADO", modeloDocumento: 65 }, { ambiente: "HOMOLOGACAO", modeloDocumento: null }])("contexto anterior incompleto permanece conservador: %j", async contexto => {
    const anterior = await pedido(); await destinatarioFicticioCompleto(anterior.pedidoId);
    await sim.prisma.documentoFiscalSaida.update({ where: { id: anterior.id }, data: { ...contexto, provedor: "BRASIL_NFE", status: "AUTORIZADO", referenciaProvedor: `desconhecida-${anterior.id}`, protocolo: "135260000000001" } });
    const h55 = await prepararFiscalSaida(anterior.pedidoId, 1, sessao, "55", { ambiente: "HOMOLOGACAO" }); sim.adapter = emissorManualFicticio(h55.id, "HOMOLOGACAO");
    await expect(solicitarAcaoFiscalSaida(h55.id, "ENVIAR", "Solicitação exclusivamente sintética", sessao)).rejects.toThrow("outro documento autorizado");
    expect(sim.adapter.enviar).not.toHaveBeenCalled();
  });
  it("adaptador não relabela preparação de homologação como produção", async () => {
    const h = await pedido(); sim.adapter = emissorManualFicticio(h.id, "PRODUCAO");
    await expect(solicitarAcaoFiscalSaida(h.id, "ENVIAR", "Solicitação exclusivamente sintética", sessao)).rejects.toThrow("outro emissor/ambiente");
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: h.id } })).toMatchObject({ ambiente: "HOMOLOGACAO", provedor: null, acao: null });
    expect(sim.adapter.enviar).not.toHaveBeenCalled();
  });
  it("timeout incerto consulta antes de reenviar; concorrência e callbacks não duplicam autorização", async () => {
    const d = await pedido(); const a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockRejectedValue(new Error("Timeout externo fictício"));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao);
    await Promise.all([processarFiscalSaida(), processarFiscalSaida()]); expect(a.enviar).toHaveBeenCalledTimes(1);
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "INCERTO", acao: "CONSULTAR" });
    vi.mocked(a.consultar).mockResolvedValue(retorno(d.id)); await vencerConsulta(d.id); await processarFiscalSaida();
    await aplicarRetornoFiscalSaida(a, retorno(d.id)); await aplicarRetornoFiscalSaida(a, retorno(d.id));
    await aplicarRetornoFiscalSaida(a, retorno(d.id, "REJEITADO", 0));
    const salvo = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(salvo).toMatchObject({ status: "AUTORIZADO", acao: null, protocolo: "protocolo-ficticio-1" }); expect(a.enviar).toHaveBeenCalledTimes(1); expect(a.consultar).toHaveBeenCalledTimes(1);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO" } })).toBe(1);
    await expect(aplicarRetornoFiscalSaida(a, { ...retorno(d.id), numero: "999" })).rejects.toThrow("divergente");
  });
  it("retoma lease Brasil NFe abandonado pela consulta; não encontrado mantém conferência e bloqueia reenvio", async () => {
    const d = await pedido(); const a = sim.adapter = brasilNfeInteiramenteMockado();
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao);
    await sim.prisma.documentoFiscalSaida.update({ where: { id: d.id }, data: { leaseToken: "execucao-interrompida", leaseAte: new Date("2020-01-01") } });
    vi.mocked(a.consultar).mockResolvedValue({ documentoId: d.id, eventoId: `${d.id}-ausente`, sequencia: 1, status: "NAO_ENCONTRADO" }); await processarFiscalSaida();
    expect(a.enviar).not.toHaveBeenCalled(); expect(a.consultar).toHaveBeenCalledTimes(1);
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "PENDENTE_CONFERENCIA", acao: null, protocolo: null });
    await processarFiscalSaida(); expect(a.enviar).not.toHaveBeenCalled();
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow("não pode ser enviada");
    expect(a.enviar).not.toHaveBeenCalled();
  });
  it("contrato idempotente legado retoma lease pela consulta e exige novo envio explícito após ausência confirmada", async () => {
    const d = await pedido(); const a = sim.adapter = adaptador();
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao);
    await sim.prisma.documentoFiscalSaida.update({ where: { id: d.id }, data: { leaseToken: "lease-ficticio-idempotente", leaseAte: new Date("2020-01-01") } });
    vi.mocked(a.consultar).mockResolvedValue({ documentoId: d.id, eventoId: `${d.id}-ausencia-confirmada`, sequencia: 1, status: "NAO_ENCONTRADO" });
    await processarFiscalSaida(); expect(a.enviar).not.toHaveBeenCalled(); expect(a.consultar).toHaveBeenCalledTimes(1);
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ status: "PREPARADO", acao: null });
    await processarFiscalSaida(); expect(a.enviar).not.toHaveBeenCalled();
    vi.mocked(a.enviar).mockResolvedValue(retorno(d.id, "AUTORIZADO", 2));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    expect(a.enviar).toHaveBeenCalledTimes(1);
  });
  it("consulta não encontrado após timeout de envio exige conferência e mantém a fotografia original", async () => {
    const a = sim.adapter = brasilNfeInteiramenteMockado(); const d = await pedido(); const fotografia = structuredClone(d.payload);
    vi.mocked(a.enviar).mockRejectedValue(new Error("Timeout fictício antes do resultado"));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    vi.mocked(a.consultar).mockResolvedValue({ documentoId: d.id, eventoId: `${d.id}-ausencia-incerta`, sequencia: 1, status: "NAO_ENCONTRADO" });
    await vencerConsulta(d.id); await processarFiscalSaida();
    const salvo = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(salvo).toMatchObject({ status: "PENDENTE_CONFERENCIA", acao: null, protocolo: null, hashPayload: d.hashPayload });
    expect(salvo.payload).toEqual(fotografia);
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow("não pode ser enviada");
    await processarFiscalSaida(); expect(a.enviar).toHaveBeenCalledTimes(1); expect(a.consultar).toHaveBeenCalledTimes(1);
  });
  it("rejeição não vira sucesso; revisão não apaga solicitação nem permite reenvio de fotografia antiga", async () => {
    const d = await pedido(); const a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockResolvedValue({ ...retorno(d.id, "REJEITADO"), erro: "Cadastro fiscal incompleto fictício" });
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "REJEITADO", acao: null });
    await sim.prisma.pedidoVenda.update({ where: { id: d.pedidoId }, data: { versao: 2, total: 350 } }); const novo = await prepararFiscalSaida(d.pedidoId, 2, sessao);
    expect(novo.id).not.toBe(d.id); expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).payload).toEqual(d.payload);
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow("não pode ser enviada");
  });
  it("repreparar rejeição certa cria revisão fiscal nova e não libera segunda emissão enquanto resultado posterior está pendente", async () => {
    const a = sim.adapter = brasilNfeInteiramenteMockado(); const d = await pedido(); const fotografia = structuredClone(d.payload);
    vi.mocked(a.enviar).mockResolvedValue({ ...retorno(d.id, "REJEITADO"), erro: "IE fictícia corrigida no emissor após rejeição certa" });
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    const rejeitado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(rejeitado.status).toBe("REJEITADO");
    const nova = await prepararFiscalSaida(d.pedidoId, 1, sessao);
    expect(nova.id).not.toBe(d.id); expect(nova.revisaoFiscal).toBe(2);
    expect(nova).toMatchObject({ versaoPedido: 1, status: "PREPARADO", acao: null, hashPayload: d.hashPayload });
    expect(nova.payload).toEqual(fotografia);
    expect((await prepararFiscalSaida(d.pedidoId, 1, sessao)).id).toBe(nova.id);
    const original = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(original).toMatchObject({ status: "REJEITADO", hashPayload: rejeitado.hashPayload, ultimaSequencia: rejeitado.ultimaSequencia });
    expect(original.payload).toEqual(fotografia);
    vi.mocked(a.enviar).mockRejectedValue(new Error("Timeout fictício da nova tentativa"));
    await solicitarAcaoFiscalSaida(nova.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    vi.mocked(a.consultar).mockResolvedValue({ documentoId: nova.id, eventoId: `${nova.id}-resultado-pendente`, sequencia: 1, status: "NAO_ENCONTRADO" });
    await vencerConsulta(nova.id); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: nova.id } })).toMatchObject({ status: "PENDENTE_CONFERENCIA", acao: null, hashPayload: nova.hashPayload });
    expect((await prepararFiscalSaida(d.pedidoId, 1, sessao)).id).toBe(nova.id);
    await sim.prisma.pedidoVenda.update({ where: { id: d.pedidoId }, data: { observacoes: "Observação fictícia não libera uma operação fiscal pendente" } });
    const terceira = await prepararFiscalSaida(d.pedidoId, 1, sessao);
    expect(terceira.id).not.toBe(nova.id); expect(terceira.revisaoFiscal).toBe(3);
    await expect(solicitarAcaoFiscalSaida(terceira.id, "ENVIAR", "", sessao)).rejects.toThrow("outro documento autorizado, denegado ou pendente");
    expect(a.enviar).toHaveBeenCalledTimes(2);
    expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: nova.id } })).payload).toEqual(fotografia);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } })).versao).toBe(1);
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("alteração entre solicitação e processamento impede envio; documento autorizado impede segunda emissão do pedido", async () => {
    const d = await pedido(); const a = sim.adapter = adaptador(); await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao);
    await sim.prisma.pedidoVenda.update({ where: { id: d.pedidoId }, data: { versao: 2 } }); await processarFiscalSaida(); expect(a.enviar).not.toHaveBeenCalled();
    const atual = await prepararFiscalSaida(d.pedidoId, 2, sessao); vi.mocked(a.enviar).mockResolvedValue(retorno(atual.id)); await solicitarAcaoFiscalSaida(atual.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    await sim.prisma.pedidoVenda.update({ where: { id: d.pedidoId }, data: { versao: 3 } }); const novo = await prepararFiscalSaida(d.pedidoId, 3, sessao);
    await expect(solicitarAcaoFiscalSaida(novo.id, "ENVIAR", "", sessao)).rejects.toThrow("outro documento autorizado");
    expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: atual.id } })).status).toBe("AUTORIZADO");
  });
  it("cancelamento fiscal preserva autorização, arquivos protegidos e pedido comercial", async () => {
    const d = await pedido(); const a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    vi.mocked(a.obterDocumentos).mockResolvedValue({ xml: "<documento>FICTICIO</documento>", pdf: Buffer.from("%PDF-1.4 FICTICIO") });
    await obterArquivosFiscalSaida(d.id, sessao); expect(await baixarArquivoFiscalSaida(d.id, "xml", sessao)).toContain("FICTICIO");
    await expect(baixarArquivoFiscalSaida(d.id, "xml", { ...sessao, versao: 99 })).rejects.toThrow("sessão");
    vi.mocked(a.cancelar).mockResolvedValue(retorno(d.id, "CANCELADO", 2)); await solicitarAcaoFiscalSaida(d.id, "CANCELAR", "Cancelamento fiscal fictício justificado", sessao); await processarFiscalSaida();
    await aplicarRetornoFiscalSaida(a, retorno(d.id, "AUTORIZADO", 3));
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "CANCELADO", numero: "123", protocolo: "protocolo-ficticio-1", protocoloCancelamento: "protocolo-evento-ficticio-2", xml: "<documento>FICTICIO</documento>" });
    expect(await sim.prisma.pedidoVenda.findUnique({ where: { id: d.pedidoId } })).toMatchObject({ status: "CONFIRMADO" });
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO" } })).toBe(2);
  });
  it("timeout de cancelamento e consulta não encontrado preservam autorização e protocolo originais", async () => {
    const a = sim.adapter = adaptador(); const d = await pedido(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    const autorizado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    vi.mocked(a.cancelar).mockRejectedValue(new Error("Timeout fictício do evento de cancelamento"));
    await solicitarAcaoFiscalSaida(d.id, "CANCELAR", "Justificativa fictícia do cancelamento", sessao); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ status: "AUTORIZADO", cancelamentoPendente: true, acao: null, protocolo: autorizado.protocolo, referenciaProvedor: autorizado.referenciaProvedor, protocoloCancelamento: null });
    vi.mocked(a.consultar).mockResolvedValue({ documentoId: d.id, eventoId: `${d.id}-consulta-divergente`, sequencia: 2, status: "NAO_ENCONTRADO" });
    await solicitarAcaoFiscalSaida(d.id, "CONSULTAR", "Conferência manual do resultado incerto", sessao); await processarFiscalSaida();
    const preservado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(preservado).toMatchObject({ status: "AUTORIZADO", cancelamentoPendente: true, acao: null, numero: autorizado.numero, protocolo: autorizado.protocolo, referenciaProvedor: autorizado.referenciaProvedor, protocoloCancelamento: null, hashPayload: autorizado.hashPayload });
    expect(preservado.payload).toEqual(autorizado.payload);
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow("não pode ser enviada");
    expect(a.enviar).toHaveBeenCalledTimes(1); expect(a.cancelar).toHaveBeenCalledTimes(1); expect(a.consultar).toHaveBeenCalledTimes(1);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO_IGNORADO" } })).toBe(1);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } })).status).toBe("CONFIRMADO");
  });
  it("resultado cancelado sem protocolo do evento é rejeitado sem alterar o documento autorizado", async () => {
    const a = sim.adapter = adaptador(); const d = await pedido(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    const autorizado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    await expect(aplicarRetornoFiscalSaida(a, { ...retorno(d.id, "CANCELADO", 2), protocoloEvento: undefined })).rejects.toThrow("protocolo de evento coerente");
    const preservado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(preservado).toMatchObject({ status: "AUTORIZADO", protocolo: autorizado.protocolo, protocoloCancelamento: null, hashPayload: autorizado.hashPayload });
    expect(preservado.payload).toEqual(autorizado.payload);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO" } })).toBe(1);
  });
  it("retorno de cancelamento com protocolo de autorização divergente não sobrescreve o protocolo original", async () => {
    const a = sim.adapter = adaptador(); const d = await pedido(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    const autorizado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    const eventosOriginais = await sim.prisma.eventoFiscalSaida.findMany({ where: { documentoId: d.id, tipo: "RETORNO" }, orderBy: { id: "asc" } });
    await aplicarRetornoFiscalSaida(a, { ...retorno(d.id, "CANCELADO", 2), protocolo: "protocolo-ficticio-P2-divergente", protocoloEvento: "evento-cancelamento-ficticio-P2" });
    const preservado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(preservado).toMatchObject({ status: "AUTORIZADO", protocolo: "protocolo-ficticio-1", protocoloCancelamento: null, numero: autorizado.numero, serie: autorizado.serie, referenciaProvedor: autorizado.referenciaProvedor, chaveFiscal: autorizado.chaveFiscal, ultimaSequencia: autorizado.ultimaSequencia, hashPayload: autorizado.hashPayload });
    expect(preservado.payload).toEqual(autorizado.payload);
    expect(await sim.prisma.eventoFiscalSaida.findMany({ where: { documentoId: d.id, tipo: "RETORNO" }, orderBy: { id: "asc" } })).toEqual(eventosOriginais);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO_IGNORADO" } })).toBe(1);
  });
  it("reautorização divergente em cada campo de identidade mantém documento confirmado e eventos originais", async () => {
    const a = sim.adapter = adaptador(); const d = await pedido(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    const autorizado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    const eventosOriginais = await sim.prisma.eventoFiscalSaida.findMany({ where: { documentoId: d.id, tipo: "RETORNO" }, orderBy: { id: "asc" } });
    for (const [campo, valor] of [["referencia", "referencia-ficticia-divergente"], ["chave", "1".repeat(44)], ["numero", "999"], ["serie", "999"], ["protocolo", "protocolo-ficticio-divergente"]] as const) {
      await aplicarRetornoFiscalSaida(a, { ...retorno(d.id, "AUTORIZADO", 2), protocolo: autorizado.protocolo!, eventoId: `${d.id}-reautorizacao-${campo}`, [campo]: valor });
      const preservado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
      expect(preservado).toMatchObject({ status: "AUTORIZADO", numero: autorizado.numero, serie: autorizado.serie, protocolo: autorizado.protocolo, referenciaProvedor: autorizado.referenciaProvedor, chaveFiscal: autorizado.chaveFiscal, protocoloCancelamento: null, ultimaSequencia: autorizado.ultimaSequencia, hashPayload: autorizado.hashPayload });
      expect(preservado.payload).toEqual(autorizado.payload);
    }
    expect(await sim.prisma.eventoFiscalSaida.findMany({ where: { documentoId: d.id, tipo: "RETORNO" }, orderBy: { id: "asc" } })).toEqual(eventosOriginais);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO_IGNORADO" } })).toBe(5);
  });
  it("consulta após cancelamento com timeout e retorno autorizado regressivo conserva estado e protocolos", async () => {
    const a = sim.adapter = adaptador(); const d = await pedido(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    vi.mocked(a.cancelar).mockResolvedValue(retorno(d.id, "CANCELADO", 2));
    await solicitarAcaoFiscalSaida(d.id, "CANCELAR", "Cancelamento fictício previamente comprovado", sessao); await processarFiscalSaida();
    const cancelado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(cancelado).toMatchObject({ status: "CANCELADO", protocolo: "protocolo-ficticio-1", protocoloCancelamento: "protocolo-evento-ficticio-2", ultimaSequencia: 2 });
    vi.mocked(a.consultar).mockRejectedValue(new Error("Timeout fictício de consulta após cancelamento"));
    await solicitarAcaoFiscalSaida(d.id, "CONSULTAR", "", sessao); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ status: "CANCELADO", acao: null, protocolo: cancelado.protocolo, protocoloCancelamento: cancelado.protocoloCancelamento, ultimaSequencia: 2 });
    vi.mocked(a.consultar).mockResolvedValue(retorno(d.id, "AUTORIZADO", 3));
    await solicitarAcaoFiscalSaida(d.id, "CONSULTAR", "Conferência manual do resultado incerto", sessao); await processarFiscalSaida();
    const preservado = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(preservado).toMatchObject({ status: "CANCELADO", acao: null, numero: cancelado.numero, protocolo: cancelado.protocolo, protocoloCancelamento: cancelado.protocoloCancelamento, referenciaProvedor: cancelado.referenciaProvedor, chaveFiscal: cancelado.chaveFiscal, ultimaSequencia: 2, hashPayload: cancelado.hashPayload });
    expect(preservado.payload).toEqual(cancelado.payload);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO_IGNORADO" } })).toBe(1);
    expect(a.enviar).toHaveBeenCalledTimes(1); expect(a.cancelar).toHaveBeenCalledTimes(1); expect(a.consultar).toHaveBeenCalledTimes(2);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } })).status).toBe("CONFIRMADO");
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("limita retomadas incertas e mantém callback desativado antes da autenticação", async () => {
    const d = await pedido(); const a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockRejectedValue(new Error("Timeout")); vi.mocked(a.consultar).mockRejectedValue(new Error("Timeout"));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida(); await vencerConsulta(d.id); await processarFiscalSaida(); await vencerConsulta(d.id); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "PENDENTE_CONFERENCIA", acao: null, tentativas: 3 });
    await processarFiscalSaida(); expect(a.enviar).toHaveBeenCalledTimes(1); expect(a.consultar).toHaveBeenCalledTimes(2);
    vi.mocked(a.autenticarRetorno).mockResolvedValue(null); expect((await POST(new Request("http://localhost/api/fiscal-saida/retorno", { method: "POST", body: "{}" }))).status).toBe(503);
    vi.mocked(a.autenticarRetorno).mockResolvedValue(retorno(d.id)); expect((await POST(new Request("http://localhost/api/fiscal-saida/retorno", { method: "POST", body: "assinatura-ficticia" }))).status).toBe(503);
    expect(a.autenticarRetorno).not.toHaveBeenCalled();
  });
  it("preparação local usa sessão/permissões reais sem exigir emissor nem alterar outros módulos", async () => {
    const m = await pedidoComPayloadLocal(), antes = await efeitosAlheios();
    const r = await prepararDocumentoBrasilNfeLocal(m.documento.id, 55, m.parametros, sessao);
    expect(r.pendencias).toEqual([]); expect(r.transmissaoPermitida).toBe(false);
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: m.documento.id } })).toMatchObject({ status: "SEM_EMISSOR", acao: null, hashPayload: m.documento.hashPayload });
    await expect(prepararDocumentoBrasilNfeLocal(m.documento.id, 55, m.parametros, { ...sessao, versao: 99 })).rejects.toThrow("sessão");
    const perfil = await sim.prisma.perfilAcesso.create({ data: { nome: "Leitura fiscal fictícia", permissoes: { "vendas.pedidos": ["visualizar"], "vendas.fiscal": ["visualizar"] } } });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Leitor fictício", email: "leitor-m2@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const leitor = { ...sessao, userId: usuario.id, admin: true }; // admin enviado pelo cliente não concede autorização.
    await expect(prepararDocumentoBrasilNfeLocal(m.documento.id, 55, m.parametros, leitor)).rejects.toThrow("não permite preparar");
    await sim.prisma.usuario.update({ where: { id: usuario.id }, data: { permissoesPersonalizadas: { "vendas.fiscal": { editar: true } } } });
    expect((await prepararDocumentoBrasilNfeLocal(m.documento.id, 65, m.parametros, leitor)).montagemConcluida).toBe(true);
    expect(await efeitosAlheios()).toEqual(antes);
  });
  it.each([55, 65] as const)("ciclo %s sintético reutiliza fotografia/fila: montagem, autorização, arquivos e cancelamento", async modelo => {
    const m = await pedidoComPayloadLocal(), d = m.documento, antes = await efeitosAlheios();
    const a = sim.adapter = adaptador(), chave = chaveFicticia(modelo), protocolo = "90071992547409930001";
    vi.mocked(a.enviar).mockImplementation(async (i, fotografia) => {
      expect(i.documentoId).toBe(d.id); expect(i.chaveIdempotencia).toBe(d.id);
      const montado = prepararPayloadLocalBrasilNfe({ ...d, payload: fotografia }, modelo, m.cadastro, m.parametros);
      expect(JSON.parse(serializarPayloadLocalBrasilNfe(montado)).ValorTotal).toBe(24.53);
      return { ...retorno(d.id), chave, serie: "1", protocolo };
    });
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    const xml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}"><ide><mod>${modelo}</mod><tpAmb>2</tpAmb><serie>1</serie><nNF>123</nNF></ide><emit><CNPJ>${m.cadastro.cnpj}</CNPJ></emit></infNFe></NFe><protNFe><infProt><tpAmb>2</tpAmb><chNFe>${chave}</chNFe><nProt>${protocolo}</nProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;
    vi.mocked(a.obterDocumentos).mockImplementation(async i => {
      expect(i.ambiente).toBe("HOMOLOGACAO");
      return validarArquivosBrasilNfe({ Base64Xml: Buffer.from(xml).toString("base64") }, { identidade: { ...i, ambiente: "HOMOLOGACAO", emitenteCnpj: m.cadastro.cnpj, modeloDocumento: modelo }, chave, protocolo });
    });
    await obterArquivosFiscalSaida(d.id, sessao); expect(await baixarArquivoFiscalSaida(d.id, "xml", sessao)).toBe(xml);
    vi.mocked(a.cancelar).mockResolvedValue({ ...retorno(d.id, "CANCELADO", 2), chave, serie: "1", protocolo });
    await solicitarAcaoFiscalSaida(d.id, "CANCELAR", "Cancelamento exclusivamente sintético do ciclo M2", sessao); await processarFiscalSaida();
    const final = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(final).toMatchObject({ status: "CANCELADO", protocolo, hashPayload: d.hashPayload, payload: d.payload, xml });
    expect(a.enviar).toHaveBeenCalledTimes(1); expect(a.cancelar).toHaveBeenCalledTimes(1);
    expect(await efeitosAlheios()).toEqual(antes);
  });
  it.each([55, 65] as const)("ciclo %s sintético: rejeição e timeout não autorizam repetição; recuperação considera histórico", async modelo => {
    const m = await pedidoComPayloadLocal(), d = m.documento, a = sim.adapter = adaptador(), antes = await efeitosAlheios();
    vi.mocked(a.enviar).mockImplementation(async (_i, fotografia) => {
      expect(prepararPayloadLocalBrasilNfe({ ...d, payload: fotografia }, modelo, m.cadastro, m.parametros).montagemConcluida).toBe(true);
      throw new Error("Timeout exclusivamente sintético");
    });
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await Promise.all([processarFiscalSaida(), processarFiscalSaida()]);
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow();
    const identidade = { documentoId: d.id, chaveIdempotencia: d.id, ambiente: "HOMOLOGACAO" as const, referencia: null, emitenteCnpj: m.cadastro.cnpj, modeloDocumento: modelo };
    expect(prepararConsultaBrasilNfe(identidade)).toMatchObject({ IdentificadorInterno: d.id, ModeloDocumento: modelo, TipoAmbiente: 2, RetornarArquivos: false });
    const nota = { ...notaFicticia(modelo), IdentificadorInterno: d.id };
    const evidencias = interpretarConsultaBrasilNfe({ Encontrada: true, Nota: { ...nota, Emitida: false, Status: 3, CodStatusResposta: 999, NumeroProtocolo: null }, Historico: [nota], status: 0, erros: [], avisos: [] }, identidade);
    expect(evidencias.permiteReenvio).toBe(false); expect(evidencias.autorizacoes).toHaveLength(1);
    // A sequência abaixo é contrato do simulador de teste; não é inferida do retorno Brasil NFe.
    vi.mocked(a.consultar).mockResolvedValue({ ...retorno(d.id), chave: evidencias.autorizacoes[0].chave!, serie: "1", protocolo: evidencias.autorizacoes[0].protocolo! });
    await vencerConsulta(d.id); await processarFiscalSaida(); await processarFiscalSaida();
    expect(a.enviar).toHaveBeenCalledTimes(1); expect(a.consultar).toHaveBeenCalledTimes(1);
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "AUTORIZADO", hashPayload: d.hashPayload, protocolo: "90071992547409930001" });
    const rejeitado = await pedidoComPayloadLocal(); vi.mocked(a.enviar).mockResolvedValue({ ...retorno(rejeitado.documento.id, "REJEITADO"), erro: "Rejeição sintética" });
    await solicitarAcaoFiscalSaida(rejeitado.documento.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: rejeitado.documento.id } })).toMatchObject({ status: "REJEITADO", acao: null });
    await processarFiscalSaida(); expect(a.enviar).toHaveBeenCalledTimes(2);
    expect(await efeitosAlheios()).toEqual(antes);
  });
  it("ordenação local durável deduplica, ignora regressão e preserva ambos os protocolos", async () => {
    const d = await pedido(), a = sim.adapter = adaptador();
    const local = (estado: RespostaFiscalSaida["status"], eventoId: string, extra = {}): RespostaFiscalSaida => ({ documentoId: d.id, eventoId, ordenacao: "LOCAL_OBSERVACAO", status: estado, referencia: `ref-${d.id}`, numero: "123", serie: "1", chave: chaveFicticia(), protocolo: "90071992547409930001", ...extra });
    vi.mocked(a.enviar).mockResolvedValue(local("AUTORIZADO", "autorizacao-ficticia"));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    await Promise.all([aplicarRetornoFiscalSaida(a, local("AUTORIZADO", "autorizacao-ficticia")), aplicarRetornoFiscalSaida(a, local("AUTORIZADO", "autorizacao-ficticia"))]);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO" } })).toBe(1);
    vi.mocked(a.cancelar).mockResolvedValue(local("CANCELADO", "cancelamento-ficticio", { protocoloCancelamento: "90071992547409939999" }));
    await solicitarAcaoFiscalSaida(d.id, "CANCELAR", "Justificativa exclusivamente sintética", sessao); await processarFiscalSaida();
    await aplicarRetornoFiscalSaida(a, local("AUTORIZADO", "observacao-tardia-ficticia"));
    const final = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(final).toMatchObject({ status: "CANCELADO", protocolo: "90071992547409930001", protocoloCancelamento: "90071992547409939999", ultimaSequencia: 2, ultimaSequenciaObservada: 3, cancelamentoPendente: false });
  });
  it("lease antigo não cria observação local nem altera comprovação", async () => {
    const d = await pedido(), a = sim.adapter = adaptador(); await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao);
    await sim.prisma.documentoFiscalSaida.update({ where: { id: d.id }, data: { leaseToken: "nova-execucao", leaseAte: new Date(Date.now() + 120000) } });
    await aplicarRetornoFiscalSaida(a, { documentoId: d.id, eventoId: "resposta-antiga", ordenacao: "LOCAL_OBSERVACAO", status: "PENDENTE_CONFERENCIA" }, "lease-antigo");
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ ultimaSequenciaObservada: 0, leaseToken: "nova-execucao" });
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO" } })).toBe(0);
  });
  it("cancelamento com timeout exige conferência manual e não repete evento nem apaga protocolo", async () => {
    const d = await pedido(), a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    vi.mocked(a.cancelar).mockRejectedValue(new Error("Timeout sintético"));
    await solicitarAcaoFiscalSaida(d.id, "CANCELAR", "Cancelamento exclusivamente fictício", sessao); await processarFiscalSaida(); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "AUTORIZADO", cancelamentoPendente: true, acao: null, protocolo: "protocolo-ficticio-1" });
    expect(a.cancelar).toHaveBeenCalledTimes(1); expect(a.consultar).not.toHaveBeenCalled();
    await expect(solicitarAcaoFiscalSaida(d.id, "CANCELAR", "Não repetir cancelamento incerto", sessao)).rejects.toThrow("Somente documento autorizado");
  });
  it("denegação impede novo documento de outra revisão do pedido", async () => {
    const d = await pedido(), a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id, "DENEGADO"));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("DENEGADO");
    await sim.prisma.pedidoVenda.update({ where: { id: d.pedidoId }, data: { versao: 2 } }); const outro = await prepararFiscalSaida(d.pedidoId, 2, sessao);
    await expect(solicitarAcaoFiscalSaida(outro.id, "ENVIAR", "", sessao)).rejects.toThrow("denegado");
  });
  it("protocolo observado do cancelamento incerto é conservado sem ignorar a pendência", async () => {
    const d = await pedido(), a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    vi.mocked(a.cancelar).mockResolvedValue({ documentoId: d.id, eventoId: "cancelamento-xml-pendente", ordenacao: "LOCAL_OBSERVACAO", status: "PENDENTE_CONFERENCIA", protocoloCancelamento: "90071992547409939999", erro: "XML de cancelamento indisponível; conferência manual necessária." });
    await solicitarAcaoFiscalSaida(d.id, "CANCELAR", "Justificativa exclusivamente sintética", sessao); await processarFiscalSaida(); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "AUTORIZADO", protocolo: "protocolo-ficticio-1", protocoloCancelamento: "90071992547409939999", cancelamentoPendente: true, acao: null, leaseToken: null, leaseAte: null });
    expect(await sim.prisma.eventoFiscalSaida.findFirst({ where: { documentoId: d.id, tipo: "RETORNO", dados: { path: ["eventoId"], equals: "cancelamento-xml-pendente" } } })).toBeTruthy();
    expect(a.cancelar).toHaveBeenCalledTimes(1);
  });
  it("consulta atual com resultado contraditório exige conferência e preserva autorização histórica", async () => {
    const d = await pedido(), a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    vi.mocked(a.consultar).mockResolvedValue({ documentoId: d.id, eventoId: "consulta-contraditoria", ordenacao: "LOCAL_OBSERVACAO", status: "PENDENTE_CONFERENCIA", protocolo: "99999", erro: "Múltiplas autorizações: conferência manual necessária." });
    await solicitarAcaoFiscalSaida(d.id, "CONSULTAR", "", sessao); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "PENDENTE_CONFERENCIA", protocolo: "protocolo-ficticio-1", acao: null, leaseToken: null });
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow();
    expect(a.enviar).toHaveBeenCalledTimes(1);
  });
  it("reconsulta da mesma autorização após pendência é observação atual sem duplicar resultado externo", async () => {
    const d = await pedido(), a = sim.adapter = adaptador();
    const autorizado = { ...retorno(d.id), sequencia: undefined, ordenacao: "LOCAL_OBSERVACAO" as const } as RespostaFiscalSaida;
    vi.mocked(a.enviar).mockResolvedValue(autorizado);
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    vi.mocked(a.consultar).mockResolvedValueOnce({ documentoId: d.id, eventoId: "conferencia-atual-ficticia", ordenacao: "LOCAL_OBSERVACAO", status: "PENDENTE_CONFERENCIA" }).mockResolvedValueOnce(autorizado);
    await solicitarAcaoFiscalSaida(d.id, "CONSULTAR", "", sessao); await processarFiscalSaida();
    await solicitarAcaoFiscalSaida(d.id, "CONSULTAR", "", sessao); await processarFiscalSaida();
    expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status: "AUTORIZADO", ultimaSequencia: 3, ultimaSequenciaObservada: 3, leaseToken: null, acao: null });
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO" } })).toBe(2);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO_REOBSERVADO" } })).toBe(1);
    expect(a.enviar).toHaveBeenCalledTimes(1);
  });
  it.each(["CANCELADO", "DENEGADO"] as const)("consulta inconclusiva ou timeout conserva %s e encerra o lease sem repetição", async status => {
    const d = await pedido(), a = sim.adapter = adaptador(); vi.mocked(a.enviar).mockResolvedValue(retorno(d.id, status === "DENEGADO" ? "DENEGADO" : "AUTORIZADO"));
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao); await processarFiscalSaida();
    if (status === "CANCELADO") await aplicarRetornoFiscalSaida(a, { ...retorno(d.id, status, 2), protocolo: "protocolo-ficticio-1" });
    expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).status).toBe(status);
    vi.mocked(a.consultar).mockResolvedValueOnce({ documentoId: d.id, eventoId: `inconclusivo-${status}`, ordenacao: "LOCAL_OBSERVACAO", status: "PENDENTE_CONFERENCIA" }).mockRejectedValueOnce(new Error("Timeout sintético"));
    for (let passo = 0; passo < 2; passo++) {
      await solicitarAcaoFiscalSaida(d.id, "CONSULTAR", "", sessao); await processarFiscalSaida();
      expect(await sim.prisma.documentoFiscalSaida.findUnique({ where: { id: d.id } })).toMatchObject({ status, protocolo: "protocolo-ficticio-1", acao: null, leaseToken: null, leaseAte: null });
    }
    await processarFiscalSaida(); expect(a.consultar).toHaveBeenCalledTimes(2); expect(a.enviar).toHaveBeenCalledTimes(1);
  });
  it("correção de configuração gera nova revisão fiscal sem alterar pedido ou fotografia anterior", async () => {
    const d = await pedido(); const antes = structuredClone(d.payload);
    const original = await sim.prisma.versaoEstruturaFiscal.findFirstOrThrow({ where: { tipo: "REGRA", chave: "regra-sintetica" }, orderBy: { versao: "desc" } });
    const dados = { ...original.dados as RegraFiscal, segregacaoReceita: "PREPARADO_SINTETICO_CORRIGIDO" };
    await sim.prisma.versaoEstruturaFiscal.create({ data: { tipo: original.tipo, chave: original.chave, versao: original.versao + 1, vigenciaInicio: original.vigenciaInicio, dados: JSON.parse(JSON.stringify(validarDadosFiscais("REGRA", dados))) as Prisma.InputJsonValue, status: "ATIVO", hash: "hash-corrigido-sintetico", justificativa: "Correção sintética prospectiva", fontes: original.fontes as Prisma.InputJsonValue, criadoPorId: sessao.userId, criadoPorNome: sessao.nome, chaveOperacao: randomUUID(), hashOperacao: "hash-corrigido-sintetico" } });
    const novo = await prepararFiscalSaida(d.pedidoId, 1, sessao);
    expect(novo.id).not.toBe(d.id); expect(novo.revisaoFiscal).toBe(d.revisaoFiscal + 1);
    expect(novo.versaoPedido).toBe(1); expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } })).versao).toBe(1);
    expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).payload).toEqual(antes);
    expect((await prepararFiscalSaida(d.pedidoId, 1, sessao)).id).toBe(novo.id);
  });
  it.each(["ANTES_SOLICITACAO", "DEPOIS_SOLICITACAO"] as const)("nova regra vigente na mesma data é detectada %s sem trocar o snapshot reservado", async momento => {
    const a = sim.adapter = adaptador(); const outroProduto = await produtoClassificadoFicticio(); const d = await pedido(outroProduto);
    const fotografia = structuredClone(d.payload);
    if (momento === "DEPOIS_SOLICITACAO") await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao);
    const novaRegra = await acrescentarRegraVigenteFicticia(outroProduto);
    expect(novaRegra.vigenciaInicio.toISOString().slice(0, 10)).toBe(sim.dataFiscal);
    if (momento === "ANTES_SOLICITACAO") await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow("cálculo fiscal vigente mudou");
    else {
      await processarFiscalSaida();
      expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).toMatchObject({ status: "PREPARADO", acao: null, hashPayload: d.hashPayload });
      expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "ENVIO_INTERROMPIDO" } })).toBe(1);
    }
    expect(a.enviar).not.toHaveBeenCalled();
    expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).payload).toEqual(fotografia);
    const novaFotografia = await prepararFiscalSaida(d.pedidoId, 1, sessao);
    expect(novaFotografia.id).not.toBe(d.id); expect(novaFotografia.revisaoFiscal).toBe(d.revisaoFiscal + 1);
    expect(novaFotografia.payload).toMatchObject({ tributacao: { previa: { linhas: [{ segregacaoReceita: "NOVA_REGRA_ESPECIFICA_FICTICIA" }] } } });
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } })).versao).toBe(1);
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("ausência de classificação bloqueia apenas saída fiscal, mantendo pedido/financeiro sem efeitos novos", async () => {
    const semClassificacao = await sim.prisma.produtoVenda.create({ data: { nome: "Produto sintético sem classificação", unidade: "UN" } });
    const d = await pedido(semClassificacao.id); const novo = await prepararFiscalSaida(d.pedidoId, 1, sessao); sim.adapter = adaptador();
    await expect(solicitarAcaoFiscalSaida(novo.id, "ENVIAR", "", sessao)).rejects.toThrow("Prévia fiscal pendente");
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } })).status).toBe("CONFIRMADO");
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });
  it("referência fiscal externa anterior bloqueia duplicidade com Takeat", async () => {
    const d = await pedido(); sim.adapter = adaptador();
    await sim.prisma.historicoPedidoVenda.create({ data: { pedidoId: d.pedidoId, tipo: "DOCUMENTO_FISCAL_EXTERNO", chaveOperacao: randomUUID(), hashOperacao: "hash-sintetico", usuarioId: sessao.userId, usuarioNome: sessao.nome, versaoAnterior: 1, versaoNova: 1, depois: { emissor: "Takeat sintético", referencia: "nota-ficticia", evidencia: "evidencia-ficticia" } } });
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow("documento fiscal externo"); expect(sim.adapter.enviar).not.toHaveBeenCalled();
  });
  it("documento externo do Takeat surgido após a solicitação interrompe o envio no claim", async () => {
    const a = sim.adapter = adaptador(); const d = await pedido(); const fotografia = structuredClone(d.payload);
    await solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao);
    const externo = await sim.prisma.historicoPedidoVenda.create({ data: { pedidoId: d.pedidoId, tipo: "DOCUMENTO_FISCAL_EXTERNO", chaveOperacao: randomUUID(), hashOperacao: "externo-ficticio-apos-solicitacao", usuarioId: sessao.userId, usuarioNome: sessao.nome, versaoAnterior: 1, versaoNova: 1, depois: { emissor: "Takeat sintético", referencia: "nota-externa-ficticia", evidencia: "evidencia-externa-ficticia" } } });
    await processarFiscalSaida();
    expect(a.enviar).not.toHaveBeenCalled(); expect(a.consultar).not.toHaveBeenCalled();
    const salvo = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(salvo).toMatchObject({ status: "PREPARADO", acao: null, proximaTentativa: null, hashPayload: d.hashPayload });
    expect(salvo.payload).toEqual(fotografia); expect(salvo.ultimoErro).toMatch(/documento fiscal externo|Takeat/i);
    expect(await sim.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "ENVIO_INTERROMPIDO" } })).toBe(1);
    expect(await sim.prisma.historicoPedidoVenda.findUnique({ where: { id: externo.id } })).not.toBeNull();
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } })).status).toBe("CONFIRMADO");
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    await expect(solicitarAcaoFiscalSaida(d.id, "ENVIAR", "", sessao)).rejects.toThrow("documento fiscal externo");
  });
  it("banco impede retroceder ativação de uma regra fiscal e preserva sua versão histórica", async () => {
    const original = await sim.prisma.versaoEstruturaFiscal.findFirstOrThrow({ where: { tipo: "CLASSIFICACAO", chave: produtoId } });
    await expect(sim.prisma.versaoEstruturaFiscal.update({ where: { id: original.id }, data: { status: "RASCUNHO" } })).rejects.toThrow("Ativação fiscal preservada no histórico");
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: original.id } })).status).toBe("ATIVO");
  });
  it("prévia de frete/outros custos fecha documento Brasil NFe sem duplicar receitas ou valores", async () => {
    const d = await pedido(); await sim.prisma.pedidoVenda.update({ where: { id: d.pedidoId }, data: { frete: "15.00", outrosCustos: "3.77", total: "318.77" } });
    const novo = await prepararFiscalSaida(d.pedidoId, 1, sessao);
    const snapshot = validarSnapshotBrasilNfe(novo.payload, { token: "token-ficticio", userToken: "user-ficticio", cnpj: "12345678000195", ambiente: "HOMOLOGACAO", consultaIdentificadorValidada: true, homologacaoReferencia: "fixture-mock", producaoAutorizada: false });
    expect(snapshot.documento).toMatchObject({ ValorTotal: "318.77", Produtos: [{ ValorTotal: "300.00", ValorFrete: "15.00", ValorOutrasDespesas: "3.77" }], Pagamentos: [{ VlPago: "318.77" }] });
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
  });
});
