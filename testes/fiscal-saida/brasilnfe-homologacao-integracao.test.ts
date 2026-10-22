import { prepararMigrationHubIsolada, limparIntegracaoHubIsolada } from "../login/migrations-hub-isoladas";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { jsPDF } from "jspdf";
import type { SessaoAtual } from "@/lib/session";
import type { AdaptadorFiscalSaida } from "@/lib/fiscal-saida/contrato";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { rascunhoRegraSintetica } from "./brasilnfe-regras-tributarias-fixtures";
import { chaveFicticia, notaFicticia } from "./brasilnfe-fixtures";
import { hashRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { registrarAdaptadorHomologacaoControlada } from "@/lib/fiscal-saida/brasilnfe/capacidade-homologacao";
import { aplicarRetornoFiscalSaida } from "@/lib/fiscal-saida/servico";
import { interpretarConsultaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/consulta";
import { interpretarRecuperacaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/resposta-fiscal";

const s = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, cliente: null as unknown as import("@/lib/fiscal-saida/brasilnfe/cliente").ClienteBrasilNfe, configVersao: 1, emitenteHash: "a".repeat(64), guardiaoReal: false, antesTransporte: null as (() => Promise<void>) | null, simulacaoLiberada: true, montagemSemCliente: false, pre: null as unknown as import("@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio").PreRequisitosBrasilNfe, transporte: vi.fn<typeof fetch>(), capacidades: new WeakSet<AdaptadorFiscalSaida>() }));
vi.mock("server-only", () => ({}));
// Somente os ciclos desta suíte usam uma liberação simulada. Runtime ignora env/dados.
vi.mock("@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao", async original => {
  const real = await original<typeof import("@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao")>();
  return { ...real, transmissaoBrasilNfeLiberada: () => s.simulacaoLiberada,
    exigirTransmissaoBrasilNfeLiberada: () => { if (!s.simulacaoLiberada) throw new real.ErroTransmissaoFiscalBloqueadaBrasilNfe(); },
    executarTransporteManualBrasilNfe: async <T>(acao: () => Promise<T>): Promise<T> => {
      if (!s.simulacaoLiberada) throw new real.ErroTransmissaoFiscalBloqueadaBrasilNfe();
      if (!s.guardiaoReal) return acao(); // Somente os pilotos legados anteriores.
      const intercalar = s.antesTransporte; s.antesTransporte = null;
      if (intercalar) await intercalar();
      return real.executarTransporteManualBrasilNfe(acao);
    },
    liberacaoTransmissaoBrasilNfe: () => ({ liberada: s.simulacaoLiberada, motivo: s.simulacaoLiberada ? null : real.MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE }) };
});
vi.mock("@/lib/prisma", () => ({ get prisma() { return s.prisma; } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/configuracao", async original => ({ ...await original<object>(), obterClienteHomologacaoBrasilNfe: async () => { if (s.montagemSemCliente) throw new Error("A prévia local não deve carregar cliente ou credenciais."); return { cliente: s.cliente, versao: s.configVersao, emitenteHash: s.emitenteHash, emitenteCnpj: "00000000000000" }; } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/pre-requisitos", async original => {
  const real = await original<typeof import("@/lib/fiscal-saida/brasilnfe/pre-requisitos")>();
  return { ...real, obterPreRequisitosBrasilNfe: async () => structuredClone(s.pre),
    obterPreRequisitosEmissaoBrasilNfe: async (sessao: SessaoAtual) => s.montagemSemCliente ? real.obterPreRequisitosEmissaoBrasilNfe(sessao) : structuredClone(s.pre) };
});
// O catálogo administrativo tem suíte HTTP/SQL própria. Aqui a conferência usa
// somente o catálogo sintético vinculado à mesma configuração e ambientes.
vi.mock("@/lib/fiscal-saida/brasilnfe/numeracao", () => {
  const catalogo = () => ({ versaoConfiguracao: s.configVersao, emitente: { cnpj: "00000000000000", nome: "Emitente exclusivamente sintético" },
    consulta: { situacao: "CONCLUIDA", consultadoEm: new Date().toISOString(), httpStatus: 200, falha: null, avisosPresentes: false },
    linhas: ([1, 2] as const).flatMap(ambiente => ([55, 65] as const).map(modelo => ({ modelo, ambiente, serie: modelo === 55 ? "6" : "7", proximoNumero: "124", padrao: true, ultimaAutorizadaLocal: null, divergencia: null }))), pendencias: [] });
  return { obterNumeracaoFiscalBrasilNfe: async () => catalogo(), consultarNumeracaoFiscalBrasilNfe: async () => catalogo() };
});
// Somente esta suíte usa outra base. O guard real contra produção tem teste
// separado; este schema é descartável, obrigatório e exclusivamente sintético.
vi.mock("@/lib/fiscal-saida/brasilnfe/capacidade-homologacao", () => ({ exigirBaseHomologacaoControlada: () => {}, registrarAdaptadorHomologacaoControlada: (a: AdaptadorFiscalSaida) => { s.capacidades.add(a); return a; }, conferirCapacidadeHomologacao: (a: AdaptadorFiscalSaida) => { if (!s.capacidades.has(a) || a.ambiente !== "HOMOLOGACAO") throw new Error("Capacidade inválida."); } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/proposta-piloto", async () => ({ dadosDocumentaisPilotoBrasilNfe: { cnpj: "00000000000000", ie: "000000000000", codMunicipio: "3550308" }, propostasPilotoBrasilNfe: (modelo: 55 | 65, produtoId: string, formaId: string) => ["EMPRESA", "OPERACAO", "PRODUTO"].map(alvo => {
  const p = rascunhoRegraSintetica(alvo as "EMPRESA" | "OPERACAO" | "PRODUTO", modelo);
  if (alvo === "PRODUTO") p.produtoId = produtoId;
  if (p.conteudo.tipo === "OPERACAO") { p.conteudo.pagamentos.mapeamentos[0] = { formaId, FormaPagamento: "17", IndicadorPagamento: 0 }; if (modelo === 65) p.conteudo.destinatario = { identificar: false }; }
  if (p.conteudo.tipo === "ITEM") { p.fundamentacaoFiscal.fontes.push({ ...p.fundamentacaoFiscal.fontes[0], id: "processo", tipo: "DECLARACAO_RESPONSAVEL" }); p.fundamentacaoFiscal.confianca.find(c => c.campo === "ORIGEM")!.estado = "PENDENTE"; }
  return p;
}) }));
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { prepararCenariosPilotoBrasilNfe, lerPreparacaoPilotosBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/piloto-local";
import { aprovarRevisaoPilotoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/revisao-piloto";
import { transmitirUmaHomologacaoBrasilNfe, consultarHomologacaoBrasilNfe, baixarDocumentosHomologacaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/homologacao";
import { obterAdaptadorFiscalSaida } from "@/lib/fiscal-saida/provedor";
import { prepararEmissaoPedidoBrasilNfe, emitirNotaPedidoBrasilNfe, consultarEmissaoPedidoBrasilNfe, configurarHabilitacaoEmissaoBrasilNfe, obterHabilitacaoEmissaoBrasilNfe, obterAdaptadorOperacionalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";
import { preRequisitosBrasilNfeVazios } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
import { hashFiscal } from "@/lib/tributacao/servico";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import type { TipoVersaoFiscal } from "@/lib/tributacao/tipos";
const schema = `teste_homologacao_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, criado = false, sessao: SessaoAtual;
const resposta = (v: unknown) => new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } });
function empresaWire() {
  const m = massaPayloadLocal(), e = m.cadastro.enderecoEstruturado;
  return { CNPJ: m.cadastro.cnpj, IE: m.parametros.emitente.ie, CRT: 1, Endereco: { Cep: e.cep, Uf: e.uf, Numero: e.numero, CodMunicipio: e.codMunicipio, Logradouro: e.logradouro, Bairro: e.bairro, Municipio: e.cidade }, Configuracao: { NFCe: { CSCHomologacao: "csc-exclusivo-ficticio", IdCSCHomologacao: "000001" } } };
}
async function efeitos() { return { estoque: await s.prisma.movimentacaoEstoque.count(), financeiro: await s.prisma.lancamentoFinanceiro.count(), recebidas: await s.prisma.notaFiscalRecebida.count() }; }
async function comando(modelo: 55 | 65) {
  const p = (await lerPreparacaoPilotosBrasilNfe(sessao)).find(p => p.modelo === modelo)!;
  return { documentoId: p.documentoId, modelo, ambiente: 2, hashSnapshot: p.hashSnapshot, hashPayloadFiscal: p.hashPayloadFiscal, total: p.total, autorizarUmaTransmissao: true };
}
async function pedidoManualSintetico(produtoId: string, produtoSnapshot: Prisma.JsonValue) {
  return s.prisma.pedidoVenda.create({ data: { chaveCriacao: `pedido-manual-sintetico-${randomUUID()}`, hashCriacao: "a".repeat(64), status: "CONFIRMADO", criadoPorId: sessao.userId, confirmadoEm: new Date(), origem: "INTERNO", atendimento: "RETIRADA", subtotal: "10", total: "10", compradorSnapshot: { nome: "Consumidor exclusivamente fictício", documento: "11144477735" }, cobrancaSnapshot: { ...massaPayloadLocal().cadastro.enderecoEstruturado, codigoMunicipio: "3550308" }, formaPagamentoInformada: "PIX", pagamentoInformadoSnapshot: { tipo: "PIX" }, itens: { create: { produtoId, versaoPedido: 1, ordem: 0, quantidade: "1", unidadeSnapshot: "UN", produtoSnapshot: produtoSnapshot as Prisma.InputJsonValue, escolhasSnapshot: [], estadoComposicao: "SINTETICO", precoOriginal: "10", precoAplicado: "10", acrescimos: "0", totalLinha: "10" } } } });
}
async function habilitarManualSintetico(habilitada: boolean) {
  const anterior = await s.prisma.eventoConfiguracaoBrasilNfe.findFirst({ where: { configuracaoId: "singleton", tipo: "EMISSAO_MANUAL_HABILITACAO", dados: { path: ["ambiente"], equals: "HOMOLOGACAO" } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } });
  const revisao = (anterior?.dados as { revisao?: number } | null)?.revisao ?? 0;
  return configurarHabilitacaoEmissaoBrasilNfe({ ambiente: "HOMOLOGACAO", revisao, habilitada, modelos: [55], documentosHomologados: [], confirmarAtivacao: true }, sessao);
}
describe.skipIf(process.env.BRASILNFE_BANCO_TESTE !== "1")("Homologação controlada em schema sintético, transporte somente simulado", () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-12T15:00:00.000Z"));
    const url = new URL(process.env.DATABASE_URL!); if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/teste_/.test(url.pathname)) throw new Error("Banco exclusivamente sintético obrigatório.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect(); await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(await prepararMigrationHubIsolada(banco, schema, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    s.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await s.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const u = await s.prisma.usuario.create({ data: { nome: "Responsável exclusivamente fictício", email: "homologacao@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    sessao = { userId: u.id, nome: u.nome, email: u.email, admin: true, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "Fictício" };
    await s.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: massaPayloadLocal().cadastro, update: massaPayloadLocal().cadastro });
    await s.prisma.formaPagamentoVenda.create({ data: { id: "forma-ficticia-pix", nome: "Pagamento fictício sem efeitos", tipo: "PIX" } });
    s.pre = preRequisitosBrasilNfeVazios(1); s.pre.empresaCorrespondente = true;
    s.pre.evidenciaPainel = { origem: "PAINEL_BRASIL_NFE", observadoEm: "2026-10-12T15:00:00.000Z", registradoEm: "2026-10-12T15:00:00.000Z", servicoNfeNfceAtivo: true, homologacaoInformadaPeloUsuario: true, certificadoValidade: "2026-11-07", csc: { homologacao: { codigo: false, identificador: false }, producao: { codigo: false, identificador: false } } };
    s.cliente = new ClienteBrasilNfe({ token: "token-exclusivo-fixture", userToken: "user-exclusivo-fixture" }, { fetch: s.transporte });
  }, 120000);
  afterAll(async () => { await s.prisma?.$disconnect(); if (banco) { if (criado && /^teste_homologacao_[a-f0-9]{32}$/.test(schema)) { await limparIntegracaoHubIsolada(banco, schema); await banco.query(`DROP SCHEMA "${schema}" CASCADE`); } await banco.end(); } vi.useRealTimers(); });
  it("preparo idempotente conserva snapshots e seis propostas, sem chamada externa ou efeitos alheios", async () => {
    const p = await prepararCenariosPilotoBrasilNfe(sessao), novamente = await prepararCenariosPilotoBrasilNfe(sessao);
    expect(p).toHaveLength(2); expect(p.map(v => v.documentoId)).toEqual(novamente.map(v => v.documentoId));
    expect(p.every(v => v.montagemConcluida && !v.aprovacaoInterna && v.total === "10.00" && !v.transmissaoPermitida)).toBe(true);
    expect(await s.prisma.pedidoVenda.count()).toBe(2); expect(await s.prisma.regraFiscalBrasilNfe.count()).toBe(6);
    expect(await efeitos()).toEqual({ estoque: 0, financeiro: 0, recebidas: 0 }); expect(s.transporte).not.toHaveBeenCalled(); expect(obterAdaptadorFiscalSaida()).toBeNull();
  });
  it("perfil comum fiscal prepara55/65 sem configuração, Token, PERFIL aprovado ou acesso administrativo", async () => {
    const permissoes = { "vendas.pedidos": ["visualizar"], "vendas.pedidos.revisar": ["visualizar", "editar"], "vendas.fiscal": ["visualizar", "editar"], "financeiro.fiscal.painel": ["visualizar"] };
    const perfil = await s.prisma.perfilAcesso.create({ data: { nome: "Operação fiscal sintética sem administração", permissoes } });
    const usuario = await s.prisma.usuario.create({ data: { nome: "Operador somente sintético", email: "operador-fiscal@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const operador: SessaoAtual = { ...sessao, userId: usuario.id, nome: usuario.nome, email: usuario.email, admin: false, permissoes: permissoes as SessaoAtual["permissoes"] };
    const preRequisitosReais = await vi.importActual<typeof import("@/lib/fiscal-saida/brasilnfe/pre-requisitos")>("@/lib/fiscal-saida/brasilnfe/pre-requisitos");
    await expect(preRequisitosReais.obterPreRequisitosBrasilNfe(operador)).rejects.toThrow("administrar");
    const produto = await s.prisma.produtoVenda.findFirstOrThrow(); // Cadastro único criado pelo próprio cenário sintético.
    const pedido = await s.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "somente-sintetico", criadoPorId: sessao.userId, status: "CONFIRMADO", confirmadoEm: new Date(), modoFinanceiro: "HUB", subtotal: "10", total: "10", atendimento: "RETIRADA", compradorSnapshot: { nome: "Consumidor somente sintético" }, formaPagamentoInformada: "PIX", pagamentoInformadoSnapshot: { tipo: "PIX" }, itens: { create: { produtoId: produto.id, versaoPedido: 1, ordem: 0, quantidade: "1", unidadeSnapshot: "UN", produtoSnapshot: { nome: "Produto fictício" }, escolhasSnapshot: [], estadoComposicao: "SINTETICO", precoOriginal: "10", precoAplicado: "10", acrescimos: "0", totalLinha: "10" } } } });
    s.simulacaoLiberada = false; s.montagemSemCliente = true;
    let configuracaoCriada = false;
    try {
      expect(await s.prisma.versaoEstruturaFiscal.count({ where: { tipo: "PERFIL", status: "ATIVO" } })).toBe(0);
      const documentosAntes = await s.prisma.documentoFiscalSaida.count(), eventosAntes = await s.prisma.eventoFiscalSaida.count();
      const ausente = await prepararEmissaoPedidoBrasilNfe(pedido.id, 1, 55, "HOMOLOGACAO", operador);
      expect(ausente).toMatchObject({ podeEmitir: false, total: "10.00", liberacaoTransmissao: { liberada: false } }); expect(ausente.itens).toHaveLength(1);
      expect(ausente.documento).toMatchObject({ ambiente: "HOMOLOGACAO", modeloDocumento: 55, tentativas: 0 });
      expect(ausente.pendencias.some(p => p.campo === "tributacao")).toBe(true); expect(ausente.pendencias.some(p => p.campo === "configuracao")).toBe(true);
      await s.prisma.configuracaoBrasilNfe.create({ data: { id: "singleton", lojaId: "singleton", versao: 1 } }); configuracaoCriada = true;
      const semToken = await prepararEmissaoPedidoBrasilNfe(pedido.id, 1, 55, "HOMOLOGACAO", operador);
      expect(semToken.documento?.id).toBe(ausente.documento?.id); expect(semToken.podeEmitir).toBe(false); expect(semToken.pendencias.some(p => p.campo === "token")).toBe(true);
      const nfce = await prepararEmissaoPedidoBrasilNfe(pedido.id, 1, 65, "HOMOLOGACAO", operador);
      expect(nfce).toMatchObject({ modelo: 65, total: "10.00", podeEmitir: false, liberacaoTransmissao: { liberada: false } }); expect(nfce.itens).toHaveLength(1);
      expect(nfce.documento).toMatchObject({ ambiente: "HOMOLOGACAO", modeloDocumento: 65, tentativas: 0 }); expect(nfce.documento?.id).not.toBe(ausente.documento?.id);
      expect(await s.prisma.documentoFiscalSaida.count()).toBe(documentosAntes + 2); expect(await s.prisma.eventoFiscalSaida.count()).toBe(eventosAntes + 2);
      expect(await s.prisma.documentoFiscalSaida.count({ where: { pedidoId: pedido.id, OR: [{ acao: { not: null } }, { tentativas: { gt: 0 } }, { leaseToken: { not: null } }] } })).toBe(0);
      expect(await s.prisma.eventoFiscalSaida.count({ where: { documento: { pedidoId: pedido.id }, tipo: { not: "PREPARADO" } } })).toBe(0);
      const leitura = await preRequisitosReais.obterPreRequisitosEmissaoBrasilNfe(operador);
      expect(Object.keys(leitura).sort()).toEqual(["certificado", "csc", "empresaCorrespondente", "evidenciaPainel"]);
      await expect(preRequisitosReais.obterPreRequisitosEmissaoBrasilNfe({ ...operador, versao: 99 })).rejects.toThrow("sessão");
      await s.prisma.perfilAcesso.update({ where: { id: perfil.id }, data: { permissoes: { "vendas.pedidos": ["visualizar"], "vendas.pedidos.revisar": ["editar"] } } });
      const quantidadeDocumentos = await s.prisma.documentoFiscalSaida.count();
      await expect(prepararEmissaoPedidoBrasilNfe(pedido.id, 1, 55, "HOMOLOGACAO", operador)).rejects.toThrow("acesso");
      await expect(preRequisitosReais.obterPreRequisitosEmissaoBrasilNfe(operador)).rejects.toThrow("acesso");
      expect(await s.prisma.documentoFiscalSaida.count()).toBe(quantidadeDocumentos);
      expect(s.transporte).not.toHaveBeenCalled(); expect(await efeitos()).toEqual({ estoque: 0, financeiro: 0, recebidas: 0 });
    } finally { if (configuracaoCriada) await s.prisma.configuracaoBrasilNfe.delete({ where: { id: "singleton" } }); s.simulacaoLiberada = true; s.montagemSemCliente = false; }
  });
  it("não aprova em nome do usuário; rejeita confirmação ausente, sessão revogada e hashes alterados", async () => {
    const p = await lerPreparacaoPilotosBrasilNfe(sessao), versoes = p.flatMap(v => v.versoes);
    for (const entrada of [{ versoes, origemNacionalConferida: false, aplicacaoConferida: true }, { versoes: [], origemNacionalConferida: true, aplicacaoConferida: true }]) await expect(aprovarRevisaoPilotoBrasilNfe(entrada, sessao)).rejects.toThrow();
    await expect(aprovarRevisaoPilotoBrasilNfe({ versoes, origemNacionalConferida: true, aplicacaoConferida: true }, { ...sessao, versao: 99 })).rejects.toThrow();
    await expect(transmitirUmaHomologacaoBrasilNfe(await comando(55), sessao)).rejects.toThrow("aprovadas");
    expect(await s.prisma.versaoRegraFiscalBrasilNfe.count({ where: { estado: "APROVADA" } })).toBe(0); expect(s.transporte).not.toHaveBeenCalled();
  });
  it("revisão consolidada mantém propostas e registra provas reais do usuário sintético, sem emitir", async () => {
    const antes = await s.prisma.documentoFiscalSaida.findMany({ select: { id: true, hashPayload: true, payload: true }, orderBy: { id: "asc" } }), p = await lerPreparacaoPilotosBrasilNfe(sessao);
    const aprovado = await aprovarRevisaoPilotoBrasilNfe({ versoes: p.flatMap(v => v.versoes), origemNacionalConferida: true, aplicacaoConferida: true }, sessao);
    expect(aprovado.aprovadas).toBe(6); expect(await s.prisma.planoFiscalBrasilNfe.count()).toBe(2);
    expect(await s.prisma.versaoRegraFiscalBrasilNfe.count({ where: { estado: "APROVADA" } })).toBe(6); expect(await s.prisma.versaoRegraFiscalBrasilNfe.count({ where: { estado: "PROPOSTA" } })).toBe(8);
    const provas = await s.prisma.versaoRegraFiscalBrasilNfe.findMany({ where: { estado: "APROVADA" } });
    expect(provas.every(v => v.aprovacaoHash === hashRegraFiscalBrasilNfe(v.aprovacaoInterna) && v.responsavelId === sessao.userId)).toBe(true);
    expect(await s.prisma.documentoFiscalSaida.findMany({ select: { id: true, hashPayload: true, payload: true }, orderBy: { id: "asc" } })).toEqual(antes); expect(s.transporte).not.toHaveBeenCalled();
  });
  it("uma transmissão55 autorizada, sob concorrência, consulta processada status1 e arquivos corretos", async () => {
    s.transporte.mockResolvedValueOnce(resposta(empresaWire())).mockResolvedValueOnce(resposta({ ReturnNF: { Numero: "123", Serie: "1", ChaveNF: chaveFicticia(), NumeroProtocolo: "90071992547409930001", CodTipoAmbiente: 2, CodStatusRespostaSefaz: 100, Ok: true }, Error: "", Avisos: [] }));
    const c = await comando(55), r = await Promise.allSettled([transmitirUmaHomologacaoBrasilNfe(c, sessao), transmitirUmaHomologacaoBrasilNfe(c, sessao)]);
    expect(r.filter(v => v.status === "fulfilled")).toHaveLength(1); expect(s.transporte).toHaveBeenCalledTimes(2);
    const d = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: c.documentoId } }); expect(d.status).toBe("AUTORIZADO"); expect(d.acao).toBeNull(); expect(d.protocolo).toBe("90071992547409930001");
    s.transporte.mockResolvedValueOnce(resposta({ status: 1, Encontrada: true, Nota: { ...notaFicticia(), IdentificadorInterno: d.id }, Historico: [], erros: [], avisos: [] }));
    expect((await consultarHomologacaoBrasilNfe(d.id, sessao)).status).toBe("AUTORIZADO");
    const xml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chaveFicticia()}"><ide><mod>55</mod><tpAmb>2</tpAmb><serie>1</serie><nNF>123</nNF></ide><emit><CNPJ>00000000000000</CNPJ></emit><det nItem="1"><prod><cProd>produto-ficticio</cProd></prod><imposto><ICMS><ICMSSN102><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto></det><total><ICMSTot><vNF>10.00</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><tpAmb>2</tpAmb><chNFe>${chaveFicticia()}</chNFe><nProt>90071992547409930001</nProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;
    const pdf = new jsPDF(); pdf.text("Arquivo exclusivamente sintetico", 10, 10);
    s.transporte.mockResolvedValueOnce(resposta(Buffer.from(xml).toString("base64"))).mockResolvedValueOnce(resposta(Buffer.from(pdf.output("arraybuffer")).toString("base64")));
    const arquivos = await baixarDocumentosHomologacaoBrasilNfe(d.id, sessao); expect(arquivos.arquivos.xml).toBe(true); expect(arquivos.arquivos.pdf).toBe(true);
    await expect(transmitirUmaHomologacaoBrasilNfe(c, sessao)).rejects.toThrow(); expect(obterAdaptadorFiscalSaida()).toBeNull();
  }, 15000); // Ciclo SQL completo e geração de arquivos; o HTTP continua apenas simulado.
  it("65 bloqueia semCSC; timeout fica manual, consulta status1 BR0008 não permite reenvio", async () => {
    const c = await comando(65), antes = s.transporte.mock.calls.length;
    await expect(transmitirUmaHomologacaoBrasilNfe(c, sessao)).rejects.toThrow("CSC"); expect(s.transporte).toHaveBeenCalledTimes(antes);
    s.pre.csc.homologacao = { codigo: true, identificador: true }; s.transporte.mockResolvedValueOnce(resposta(empresaWire())).mockRejectedValueOnce(new Error("Falha exclusivamente simulada"));
    const r = await transmitirUmaHomologacaoBrasilNfe(c, sessao); expect(r.status).toBe("PENDENTE_CONFERENCIA");
    expect(r.falhaTecnica).toMatchObject({ operacao: "ENVIAR", metadados: { categoria: "TRANSPORTE", httpStatus: null } });
    const d = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: c.documentoId } }); expect(d.acao).toBeNull(); expect(d.proximaTentativa).toBeNull();
    const enviosAntesConsulta = s.transporte.mock.calls.filter(([url]) => String(url).endsWith("/EnviarNotaFiscal")).length;
    const consultasAntes = s.transporte.mock.calls.length;
    s.transporte.mockResolvedValueOnce(resposta({ Encontrada: false, Nota: null, Historico: [], erros: [{ codigo: "BR0008", descricao: "token-exclusivo-fixture", correcao: "user-exclusivo-fixture" }], avisos: [], status: 1 }));
    expect(await consultarHomologacaoBrasilNfe(d.id, sessao)).toMatchObject({ status: "PENDENTE_CONFERENCIA", tentativas: 1, reenvioAutomatico: false, producaoBloqueada: true });
    expect(s.transporte.mock.calls.length).toBe(consultasAntes + 1);
    expect(String(s.transporte.mock.calls.at(-1)![0])).toBe("https://api.brasilnfe.com.br/services/fiscal/ConsultarNotaFiscal");
    const depois = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } });
    expect(depois).toMatchObject({ status: "PENDENTE_CONFERENCIA", tentativas: 1, acao: null, proximaTentativa: null });
    await expect(transmitirUmaHomologacaoBrasilNfe(c, sessao)).rejects.toThrow();
    expect(s.transporte.mock.calls.length).toBe(consultasAntes + 1);
    expect(s.transporte.mock.calls.filter(([url]) => String(url).endsWith("/EnviarNotaFiscal"))).toHaveLength(enviosAntesConsulta);
    expect(await efeitos()).toEqual({ estoque: 0, financeiro: 0, recebidas: 0 });
    const eventos = await s.prisma.eventoFiscalSaida.findMany({ select: { dados: true } });
    expect(JSON.stringify(eventos)).not.toMatch(/token-exclusivo-fixture|user-exclusivo-fixture|Error|cause/);
  });
  it("falhas de recuperação conservam metadados seguros, uma tentativa e bloqueios, sem habilitar reenvio", async () => {
    const c = await comando(65);
    for (const [wire, categoria, httpStatus] of [
      [new Response("token-exclusivo-fixture user-exclusivo-fixture", { status: 403 }), "HTTP", 403],
      [resposta({ Encontrada: "incompativel", erros: [], avisos: [], status: 0, Historico: [] }), "CONTRATO", 200],
    ] as const) {
      vi.setSystemTime(new Date(Date.now() + 1000));
      s.transporte.mockResolvedValueOnce(wire);
      const r = await consultarHomologacaoBrasilNfe(c.documentoId, sessao);
      expect(r).toMatchObject({ status: "PENDENTE_CONFERENCIA", tentativas: 1, producaoBloqueada: true, reenvioAutomatico: false, falhaTecnica: { operacao: "CONSULTAR", metadados: { categoria, httpStatus } } });
    }
    const chamadas = s.transporte.mock.calls.length;
    await expect(transmitirUmaHomologacaoBrasilNfe(c, sessao)).rejects.toThrow();
    expect(s.transporte).toHaveBeenCalledTimes(chamadas);
    expect(await efeitos()).toEqual({ estoque: 0, financeiro: 0, recebidas: 0 });
    expect(JSON.stringify(await s.prisma.eventoFiscalSaida.findMany({ select: { dados: true } }))).not.toMatch(/token-exclusivo-fixture|user-exclusivo-fixture|Error|cause/);
  });
  it("reconcilia rejeição181 já validada pela fila, sem nova rede, sem apagar identidade e sem reenvio", async () => {
    const c = await comando(65), antes = s.transporte.mock.calls.length;
    const i = { documentoId: c.documentoId, chaveIdempotencia: c.documentoId, ambiente: "HOMOLOGACAO" as const, referencia: null, modeloDocumento: 65 as const, emitenteCnpj: "00000000000000" };
    const evidencia = interpretarConsultaBrasilNfe({ Encontrada: true, Nota: { ...notaFicticia(65), IdentificadorInterno: c.documentoId, Status: 3, Emitida: false, CodStatusResposta: 181, NumeroProtocolo: null }, Historico: [], erros: [], avisos: [], status: 1 }, i);
    const retorno = interpretarRecuperacaoFiscalBrasilNfe(evidencia, i);
    const semRede = vi.fn(async () => { throw new Error("Nenhuma operação externa pode ocorrer nesta reconciliação sintética."); });
    const adapter = registrarAdaptadorHomologacaoControlada({ id: "BRASIL_NFE", ambiente: "HOMOLOGACAO", enviar: semRede, consultar: semRede, cancelar: semRede, obterDocumentos: semRede, autenticarRetorno: async () => null });
    const d = await aplicarRetornoFiscalSaida(adapter, retorno);
    expect(d).toMatchObject({ status: "REJEITADO", tentativas: 1, chaveFiscal: chaveFicticia(65), numero: "123", serie: "1", protocolo: null, acao: null, proximaTentativa: null, leaseToken: null });
    const eventos = await s.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO" } });
    expect((await aplicarRetornoFiscalSaida(adapter, retorno)).status).toBe("REJEITADO");
    expect(await s.prisma.eventoFiscalSaida.count({ where: { documentoId: d.id, tipo: "RETORNO" } })).toBe(eventos);
    await expect(transmitirUmaHomologacaoBrasilNfe(c, sessao)).rejects.toThrow();
    expect(semRede).not.toHaveBeenCalled(); expect(s.transporte).toHaveBeenCalledTimes(antes); expect(obterAdaptadorFiscalSaida()).toBeNull();
    expect(await efeitos()).toEqual({ estoque: 0, financeiro: 0, recebidas: 0 });
  });
  it("registro manual é versionado, central e não habilita produção65 com piloto incerto", async () => {
    await s.prisma.configuracaoBrasilNfe.create({ data: { id: "singleton", lojaId: "singleton", versao: 1 } });
    const entrada = { ambiente: "HOMOLOGACAO", revisao: 0, habilitada: true, modelos: [55, 65], documentosHomologados: [], confirmarAtivacao: true };
    await expect(configurarHabilitacaoEmissaoBrasilNfe(entrada, { ...sessao, versao: 99 })).rejects.toThrow();
    const h = await configurarHabilitacaoEmissaoBrasilNfe(entrada, sessao); expect(h.revisao).toBe(1);
    expect((await obterHabilitacaoEmissaoBrasilNfe(sessao)).producao).toBeNull();
    const piloto = (await comando(65)).documentoId;
    await expect(configurarHabilitacaoEmissaoBrasilNfe({ ...entrada, ambiente: "PRODUCAO", modelos: [65], documentosHomologados: [piloto] }, sessao)).rejects.toThrow("CSC");
    s.pre.csc.producao = { codigo: true, identificador: true };
    await expect(configurarHabilitacaoEmissaoBrasilNfe({ ...entrada, ambiente: "PRODUCAO", modelos: [65], documentosHomologados: [piloto] }, sessao)).rejects.toThrow("homologação");
    s.pre.csc.producao = { codigo: false, identificador: false };
    expect(obterAdaptadorFiscalSaida()).toBeNull(); expect(await efeitos()).toEqual({ estoque: 0, financeiro: 0, recebidas: 0 });
  });
  it("consulta divergente conservada no histórico não comprova homologação para habilitar produção", async () => {
    const d = await s.prisma.documentoFiscalSaida.findFirstOrThrow({ where: { modeloDocumento: 55, status: "AUTORIZADO" } });
    const prova = await s.prisma.eventoFiscalSaida.findFirstOrThrow({ where: { documentoId: d.id, tipo: "HOMOLOGACAO_CONSULTA_CONFIRMADA" } }), antes = s.transporte.mock.calls.length;
    expect((await obterHabilitacaoEmissaoBrasilNfe(sessao)).documentosHomologados.some(p => p.id === d.id)).toBe(true);
    await s.prisma.eventoFiscalSaida.update({ where: { id: prova.id }, data: { dados: { ambiente: 2, chave: chaveFicticia(55, "000000987"), protocolo: d.protocolo } } });
    try {
      expect((await obterHabilitacaoEmissaoBrasilNfe(sessao)).documentosHomologados.some(p => p.id === d.id)).toBe(false);
      await expect(configurarHabilitacaoEmissaoBrasilNfe({ ambiente: "PRODUCAO", revisao: 0, habilitada: true, modelos: [55], documentosHomologados: [d.id], confirmarAtivacao: true }, sessao)).rejects.toThrow("homologação");
      expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).protocolo).toBe(d.protocolo);
      expect((await obterHabilitacaoEmissaoBrasilNfe(sessao)).producao).toBeNull(); expect(s.transporte).toHaveBeenCalledTimes(antes);
    } finally { await s.prisma.eventoFiscalSaida.update({ where: { id: prova.id }, data: { dados: prova.dados as Prisma.InputJsonValue } }); }
  });
  it("pedido geral prepara localmente, confirma uma única nota sob concorrência e não duplica após consulta", async () => {
    const p = await s.prisma.pedidoVenda.findUniqueOrThrow({ where: { chaveCriacao: "brasilnfe-piloto-55-2026-v1" }, include: { itens: true } }), item = p.itens[0];
    const sem = { cst: "40", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE", justificativa: "Parâmetro exclusivamente sintético" };
    const dados: { tipo: TipoVersaoFiscal; chave: string; dados: unknown }[] = [
      { tipo: "PERFIL", chave: "singleton", dados: { estabelecimento: "singleton", cnpj: "00000000000000", uf: "SP", codigoMunicipio: "3550308", inscricaoEstadual: "000000000000", regime: "SIMPLES_NACIONAL", crt: 1, confirmado: true, evidenciaEnquadramento: "Prova exclusivamente sintética", modelos: ["55", "65"], emissor: "BRASIL_NFE", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null } },
      { tipo: "CLASSIFICACAO", chave: item.produtoId!, dados: { produtoId: item.produtoId, grupo: "GF01", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: "0", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Produto exclusivamente fictício sem GTIN"], pendencias: [] } },
      { tipo: "REGRA", chave: "v2-sintetica", dados: { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, produtoId: null, natureza: null, ncm: null, cfop: "5101", csosn: "102", icms: sem, pis: { ...sem, cst: "49" }, cofins: { ...sem, cst: "49" }, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "FIXTURE_SINTETICA", reforma: null, seletivo: "NAO_APLICAVEL" } },
    ];
    for (const [tabela, codigo] of [["NCM", "19059090"], ["CFOP", "5101"], ["CSOSN", "102"], ["CST_ICMS", "40"], ["CST_PIS_COFINS", "49"]]) dados.push({ tipo: "TABELA", chave: tabela, dados: { tabela, referencia: "Tabela exclusivamente fictícia", completa: false, linhas: [{ codigo, descricao: "Descrição exclusivamente fictícia" }] } });
    for (const registro of dados) {
      const conteudo = validarDadosFiscais(registro.tipo, registro.dados), hash = hashFiscal(conteudo);
      const v = await s.prisma.versaoEstruturaFiscal.create({ data: { tipo: registro.tipo, chave: registro.chave, dados: JSON.parse(JSON.stringify(conteudo)) as Prisma.InputJsonValue, versao: 1, vigenciaInicio: new Date("2026-01-01T00:00:00Z"), status: "ATIVO", hash, justificativa: "Fixture exclusivamente sintética", fontes: ["https://www.gov.br/receitafederal/pt-br"], criadoPorId: sessao.userId, criadoPorNome: sessao.nome, chaveOperacao: randomUUID(), hashOperacao: "hash-sintetico" } });
      await s.prisma.eventoEstruturaFiscal.create({ data: { versaoId: v.id, tipo: "ATIVACAO", chaveOperacao: randomUUID(), usuarioId: sessao.userId, usuarioNome: sessao.nome, dados: { hashConteudo: hash } } });
    }
    const loja = await s.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } });
    s.emitenteHash = createHash("sha256").update(JSON.stringify(loja)).digest("hex");
    s.guardiaoReal = true; await habilitarManualSintetico(true);
    const novo = await pedidoManualSintetico(item.produtoId!, item.produtoSnapshot!);
    const antes = s.transporte.mock.calls.length;
    const previa = await prepararEmissaoPedidoBrasilNfe(novo.id, 1, 55, "HOMOLOGACAO", sessao, { indicadorPresenca: 1 });
    expect(previa.pendencias).toEqual([]); expect(previa.podeEmitir).toBe(true); expect(s.transporte).toHaveBeenCalledTimes(antes);
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: previa.documento!.id } })).payload).toMatchObject({ versao: 2 });
    const cmd = { documentoId: previa.documento!.id, modelo: 55, ambiente: "HOMOLOGACAO", hashSnapshot: previa.documento!.hashSnapshot, hashPayloadFiscal: previa.documento!.hashPayloadFiscal, total: previa.total, autorizarUmaTransmissao: true, conferenciaSemDocumentoExterno: true };
    const autorizacoesAntes = await s.prisma.eventoFiscalSaida.count({ where: { documentoId: cmd.documentoId, tipo: "EMISSAO_MANUAL_AUTORIZADA" } });
    s.simulacaoLiberada = false;
    try {
      const revisao = await prepararEmissaoPedidoBrasilNfe(novo.id, 1, 55, "HOMOLOGACAO", sessao, { indicadorPresenca: 1 });
      expect(revisao.pendencias).toEqual([]); expect(revisao.podeEmitir).toBe(true);
      expect(revisao.documento?.id).toBe(cmd.documentoId);
      expect(revisao.itens[0].fiscal).toMatchObject({ ncm: "19059090", cfop: "5101", origem: "0", icms: "102", pis: "49", cofins: "49" });
      expect((await obterHabilitacaoEmissaoBrasilNfe(sessao)).liberacaoTransmissao.liberada).toBe(false);
      const semAutorizacaoAtual = await obterAdaptadorOperacionalBrasilNfe(sessao, cmd.documentoId);
      expect(semAutorizacaoAtual).not.toBeNull();
      await expect(semAutorizacaoAtual!.enviar({ documentoId: cmd.documentoId, chaveIdempotencia: cmd.documentoId, ambiente: "HOMOLOGACAO", modeloDocumento: 55, emitenteCnpj: "00000000000000", referencia: null, ultimaSequencia: -1 }, {})).rejects.toThrow("Emissão ainda não liberada");
      await expect(transmitirUmaHomologacaoBrasilNfe(await comando(55), sessao)).rejects.toThrow("Emissão ainda não liberada");
      await expect(configurarHabilitacaoEmissaoBrasilNfe({ ambiente: "HOMOLOGACAO", habilitada: true }, sessao)).rejects.toThrow("Confira o ambiente");
      expect(await s.prisma.eventoFiscalSaida.count({ where: { documentoId: cmd.documentoId, tipo: "EMISSAO_MANUAL_AUTORIZADA" } })).toBe(autorizacoesAntes);
      expect(s.transporte).toHaveBeenCalledTimes(antes); expect(await efeitos()).toEqual({ estoque: 0, financeiro: 0, recebidas: 0 });
    } finally { s.simulacaoLiberada = true; }
    const chave = chaveFicticia(55, "000000124").slice(0, 22) + "006" + chaveFicticia(55, "000000124").slice(25);
    s.transporte.mockResolvedValueOnce(resposta(empresaWire())).mockImplementationOnce(async () => {
      const travas = await banco!.query<{ fiscalLivre: boolean; configuracaoLivre: boolean }>("SELECT pg_try_advisory_xact_lock(hashtext('fiscal-saida')) AS \"fiscalLivre\", pg_try_advisory_xact_lock(hashtext('brasilnfe-config')) AS \"configuracaoLivre\"");
      expect(travas.rows).toEqual([{ fiscalLivre: false, configuracaoLivre: false }]);
      const intencao = await banco!.query<{ total: number }>('SELECT COUNT(*)::int AS total FROM "EventoFiscalSaida" WHERE chave=$1', [`emissao-manual-consumida:${cmd.documentoId}`]);
      expect(intencao.rows).toEqual([{ total: 1 }]);
      return resposta({ ReturnNF: { Numero: "124", Serie: "6", ChaveNF: chave, NumeroProtocolo: "90071992547409930001", CodTipoAmbiente: 2, CodStatusRespostaSefaz: 100, Ok: true }, Error: "", Avisos: [] });
    });
    const r = await Promise.allSettled([emitirNotaPedidoBrasilNfe(cmd, sessao), emitirNotaPedidoBrasilNfe(cmd, sessao)]);
    expect(r.map(v => v.status === "fulfilled" ? "SUCESSO_SINTETICO" : String(v.reason))).toContain("SUCESSO_SINTETICO");
    expect(await s.prisma.eventoFiscalSaida.findMany({ where: { documentoId: cmd.documentoId, tipo: { contains: "FALHA_TECNICA" } }, select: { tipo: true, dados: true } })).toEqual([]);
    expect(r.filter(v => v.status === "fulfilled")).toHaveLength(1); expect(s.transporte).toHaveBeenCalledTimes(antes + 2);
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: cmd.documentoId } })).status).toBe("AUTORIZADO");
    s.transporte.mockResolvedValueOnce(resposta({ status: 1, Encontrada: true, Nota: { ...notaFicticia(), Numero: "124", Serie: "6", Chave: chave, IdentificadorInterno: cmd.documentoId }, Historico: [], erros: [], avisos: [] }));
    expect((await consultarEmissaoPedidoBrasilNfe(cmd.documentoId, sessao)).status).toBe("AUTORIZADO");
    await expect(emitirNotaPedidoBrasilNfe(cmd, sessao)).rejects.toThrow();
    expect(await s.prisma.eventoFiscalSaida.count({ where: { documentoId: cmd.documentoId, tipo: "EMISSAO_MANUAL_EXECUCAO_INICIADA" } })).toBe(1);
    expect(await s.prisma.eventoFiscalSaida.count({ where: { documentoId: cmd.documentoId, tipo: "EMISSAO_MANUAL_CONSULTA_CONFIRMADA" } })).toBe(1);
    expect(await efeitos()).toEqual({ estoque: 0, financeiro: 0, recebidas: 0 });
  });
  it.each(["HABILITACAO", "CONFIGURACAO", "USUARIO"] as const)("guardião SQL real impede POST após alteração de%s entre preparação e transporte", async alteracao => {
    const item = await s.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedido: { chaveCriacao: "brasilnfe-piloto-55-2026-v1" } } });
    const novo = await pedidoManualSintetico(item.produtoId!, item.produtoSnapshot!);
    const previa = await prepararEmissaoPedidoBrasilNfe(novo.id, 1, 55, "HOMOLOGACAO", sessao, { indicadorPresenca: 1 });
    expect(previa.pendencias).toEqual([]); expect(previa.podeEmitir).toBe(true);
    const cmd = { documentoId: previa.documento!.id, modelo: 55, ambiente: "HOMOLOGACAO", hashSnapshot: previa.documento!.hashSnapshot, hashPayloadFiscal: previa.documento!.hashPayloadFiscal, total: previa.total, autorizarUmaTransmissao: true, conferenciaSemDocumentoExterno: true };
    const antes = s.transporte.mock.calls.length, efeitosAntes = await efeitos(); let intercalada = false;
    s.transporte.mockResolvedValueOnce(resposta(empresaWire()));
    s.antesTransporte = async () => {
      intercalada = true;
      expect(await s.prisma.eventoFiscalSaida.findUnique({ where: { chave: `emissao-manual-consumida:${cmd.documentoId}` } })).not.toBeNull();
      if (alteracao === "HABILITACAO") await habilitarManualSintetico(false);
      if (alteracao === "CONFIGURACAO") await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { versao: 2 } });
      if (alteracao === "USUARIO") await s.prisma.usuario.update({ where: { id: sessao.userId }, data: { ativo: false } });
    };
    try {
      await Promise.allSettled([emitirNotaPedidoBrasilNfe(cmd, sessao)]);
      expect(intercalada).toBe(true);
      const chamadas = s.transporte.mock.calls.slice(antes).map(c => String(c[0]));
      expect(chamadas).toEqual(["https://api.brasilnfe.com.br/services/empresa/BuscarEmpresa"]);
      const d = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: cmd.documentoId } });
      expect(d).toMatchObject({ status: "PENDENTE_CONFERENCIA", tentativas: 1, acao: null, proximaTentativa: null });
      expect(await efeitos()).toEqual(efeitosAntes);
    } finally {
      s.antesTransporte = null;
      if (alteracao === "CONFIGURACAO") await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { versao: 1 } });
      if (alteracao === "USUARIO") await s.prisma.usuario.update({ where: { id: sessao.userId }, data: { ativo: true } });
      if (alteracao === "HABILITACAO") await habilitarManualSintetico(true);
    }
  });
  it("configuração alterada impede consulta externa, conservando autorização e registrando conferência", async () => {
    const d = await s.prisma.documentoFiscalSaida.findFirstOrThrow({ where: { status: "AUTORIZADO", eventos: { some: { tipo: "EMISSAO_MANUAL_AUTORIZADA" } } } }), antes = s.transporte.mock.calls.length;
    s.configVersao = 2;
    expect(await consultarEmissaoPedidoBrasilNfe(d.id, sessao)).toMatchObject({ status: "AUTORIZADO", ultimoErro: expect.stringContaining("Consulta não confirmada") });
    expect(s.transporte).toHaveBeenCalledTimes(antes);
    expect((await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } })).status).toBe("AUTORIZADO");
    s.configVersao = 1;
    expect(JSON.stringify(await s.prisma.eventoFiscalSaida.findMany({ select: { dados: true } }))).not.toMatch(/token-exclusivo-fixture|user-exclusivo-fixture|Error|cause/);
  });
  it("decisão explícita libera só65/produção com CSC recente, sem homologação fictícia, rede ou efeito comercial", async () => {
    const antes = s.transporte.mock.calls.length, efeitosAntes = await efeitos();
    const preAnterior = structuredClone(s.pre), configuracao = await s.prisma.configuracaoBrasilNfe.findUniqueOrThrow({ where: { id: "singleton" } });
    const entrada = { ambiente: "PRODUCAO", revisao: 0, habilitada: true, modelos: [65], documentosHomologados: [], confirmarAtivacao: true,
      decisaoProducao65: { versao: 1, tipo: "DECISAO_ADMINISTRATIVA_SEM_HOMOLOGACAO_LOCAL", motivo: "CSC_HOMOLOGACAO_INDISPONIVEL_RESPONSAVEL", confirmarResponsabilidade: true, modoRegistro: "AUTOMACAO_ASSISTIDA" } };
    const anteriores = await s.prisma.eventoConfiguracaoBrasilNfe.findMany({ where: { tipo: "EMISSAO_MANUAL_HABILITACAO" }, select: { id: true } });
    try {
      s.pre.csc.producao = { codigo: true, identificador: true }; s.pre.verificadoEm = new Date().toISOString(); s.pre.empresaVerificadaEm = s.pre.verificadoEm;
      await expect(configurarHabilitacaoEmissaoBrasilNfe(entrada, { ...sessao, versao: 99 })).rejects.toThrow();
      await expect(configurarHabilitacaoEmissaoBrasilNfe({ ...entrada, ambiente: "HOMOLOGACAO" }, sessao)).rejects.toThrow("exclusiva");
      await expect(configurarHabilitacaoEmissaoBrasilNfe({ ...entrada, modelos: [55] }, sessao)).rejects.toThrow("exclusiva");
      await expect(configurarHabilitacaoEmissaoBrasilNfe(entrada, sessao)).rejects.toThrow("30 minutos");
      const falha = { ...s.pre, empresaVerificadaEm: new Date(Date.now() - 31 * 60_000).toISOString(), empresaFalha: { categoria: "TRANSPORTE", httpStatus: null, etapaContrato: null, statusFornecedor: null, codigoFornecedor: null } };
      await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { preRequisitos: falha as unknown as Prisma.InputJsonValue, preRequisitosEmitenteHash: s.emitenteHash } });
      await expect(configurarHabilitacaoEmissaoBrasilNfe(entrada, sessao)).rejects.toThrow("30 minutos");
      await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { preRequisitos: s.pre as unknown as Prisma.InputJsonValue, preRequisitosEmitenteHash: s.emitenteHash } });
      const h = await configurarHabilitacaoEmissaoBrasilNfe(entrada, sessao);
      expect(h).toMatchObject({ ambiente: "PRODUCAO", modelos: [65], decisaoProducao65: { modelo: 65, ambiente: "PRODUCAO", origem: "INSTRUCAO_RESPONSAVEL", responsavel: { usuarioId: sessao.userId }, executor: { identificacao: "Codex" } } });
      const controle = await obterHabilitacaoEmissaoBrasilNfe(sessao);
      expect(controle.documentosHomologados.some(d => d.modelo === 65)).toBe(false);
      expect(controle.correspondentes.producao).toBe(true);
      await expect(configurarHabilitacaoEmissaoBrasilNfe(entrada, sessao)).rejects.toThrow("mudou");
      const evento = await s.prisma.eventoConfiguracaoBrasilNfe.findUniqueOrThrow({ where: { id: h.id } });
      const dados = evento.dados as Record<string, Prisma.JsonValue>;
      await s.prisma.eventoConfiguracaoBrasilNfe.update({ where: { id: h.id }, data: { dados: { ...dados, decisaoProducao65: { ...(dados.decisaoProducao65 as object), hashConteudo: "0".repeat(64) } } } });
      expect((await obterHabilitacaoEmissaoBrasilNfe(sessao)).producao).toBeNull();
      expect(s.transporte).toHaveBeenCalledTimes(antes); expect(obterAdaptadorFiscalSaida()).toBeNull(); expect(await efeitos()).toEqual(efeitosAntes);
      expect(JSON.stringify(evento.dados)).not.toMatch(/token-exclusivo-fixture|user-exclusivo-fixture|csc-exclusivo-ficticio/);
    } finally {
      s.pre = preAnterior;
      await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { preRequisitos: configuracao.preRequisitos as Prisma.InputJsonValue, preRequisitosEmitenteHash: configuracao.preRequisitosEmitenteHash } });
      await s.prisma.eventoConfiguracaoBrasilNfe.deleteMany({ where: { tipo: "EMISSAO_MANUAL_HABILITACAO", id: { notIn: anteriores.map(e => e.id) } } });
    }
  });
});
