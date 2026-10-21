import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { jsPDF } from "jspdf";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { prepararMigrationHubIsolada, limparIntegracaoHubIsolada } from "../login/migrations-hub-isoladas";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
const s = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, versaoConfiguracao: 1, emitenteHash: "", http: vi.fn<typeof fetch>(), pre: null as unknown as import("@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio").PreRequisitosBrasilNfe }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return s.prisma; } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/configuracao", async original => ({ ...await original<object>(), obterClienteHomologacaoBrasilNfe: async (_sessao: SessaoAtual, ambiente = "HOMOLOGACAO") => ({
  cliente: new ClienteBrasilNfe({ token: "token-exclusivamente-sintetico-revisao", userToken: "user-exclusivamente-sintetico-revisao" }, { fetch: s.http, ambienteNota: ambiente === "PRODUCAO" ? 1 : 2 }), versao: s.versaoConfiguracao, emitenteHash: s.emitenteHash, emitenteCnpj: "00000000000000",
}) }));
vi.mock("@/lib/fiscal-saida/brasilnfe/pre-requisitos", () => ({ obterPreRequisitosBrasilNfe: async () => structuredClone(s.pre), obterPreRequisitosEmissaoBrasilNfe: async () => structuredClone(s.pre) }));
vi.mock("@/lib/fiscal-saida/brasilnfe/numeracao", () => ({ obterNumeracaoFiscalBrasilNfe: async () => ({ versaoConfiguracao: 1, emitente: { cnpj: "00000000000000", nome: "Emitente sintético" }, consulta: { situacao: "CONCLUIDA", consultadoEm: new Date().toISOString(), httpStatus: 200, falha: null, avisosPresentes: false }, linhas: ([1, 2] as const).flatMap(ambiente => ([55, 65] as const).map(modelo => ({ modelo, ambiente, serie: modelo === 55 ? "6" : "7", proximoNumero: "1", padrao: true, ultimaAutorizadaLocal: null, divergencia: null }))), pendencias: [] }) }));
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { preRequisitosBrasilNfeVazios } from "@/lib/fiscal-saida/brasilnfe/pre-requisitos-dominio";
import { prepararEmissaoPedidoBrasilNfe, emitirNotaPedidoBrasilNfe, configurarHabilitacaoEmissaoBrasilNfe, consultarEmissaoPedidoBrasilNfe, obterDocumentosEmissaoPedidoBrasilNfe, type PreviaEmissaoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";
import { cancelarNotaPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cancelamento";
import { consultarResultadoEmissaoPedidoBrasilNfe, emitirNotaPedidoDiretaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/emissao-direta";
import { baixarArquivoFiscalSaida, consultarFiscalSaida } from "@/lib/fiscal-saida/servico";
import { hashFiscal, registrarDeclaracaoGrazing1PelaInstrucao, salvarVersaoFiscal } from "@/lib/tributacao/servico";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import { PRODUTO_DECLARACAO_FCI_GRAZING1 } from "@/lib/tributacao/declaracao-fci";
import { PENDENCIA_ORIGEM_GRAZING1, REFERENCIA_INSTRUCAO_GRAZING1, REGRA_DECLARACAO_FCI_GRAZING1 } from "@/lib/tributacao/declaracao-fci-contrato";
import type { ClassificacaoFiscal, TipoVersaoFiscal, SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";
const schema = `teste_revisao_emissao_${randomUUID().replaceAll("-", "")}`;
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const response = (v: unknown) => new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } });
const chave = (numero = "000000001") => `3526100000000000000055006${numero}1000000010`;
let banco: Client | undefined, criado = false, sessao: SessaoAtual, homologadaId = "";
async function efeitos() { return { estoque: await s.prisma.movimentacaoEstoque.count(), financeiro: await s.prisma.lancamentoFinanceiro.count(), recebidas: await s.prisma.notaFiscalRecebida.count() }; }
async function versaoAtiva(tipo: TipoVersaoFiscal, chave: string, dados: unknown) {
  const conteudo = validarDadosFiscais(tipo, dados), hash = hashFiscal(conteudo);
  const v = await s.prisma.versaoEstruturaFiscal.create({ data: { tipo, chave, versao: 1, vigenciaInicio: new Date("2026-01-01T00:00:00Z"), dados: json(conteudo), hash, status: "ATIVO", justificativa: "Fixture exclusivamente sintética", fontes: ["https://www.gov.br/fonte-exclusivamente-sintetica"], criadoPorId: sessao.userId, criadoPorNome: sessao.nome, chaveOperacao: randomUUID(), hashOperacao: hash } });
  await s.prisma.eventoEstruturaFiscal.create({ data: { versaoId: v.id, tipo: "ATIVACAO", chaveOperacao: randomUUID(), usuarioId: sessao.userId, usuarioNome: sessao.nome, dados: { hashConteudo: hash } } });
}
async function propostas() {
  const sem = { cst: "40", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE", justificativa: "Fixture sintética sem destaque" };
  const entradas: { tipo: "CLASSIFICACAO" | "REGRA"; chave: string; dados: unknown }[] = [
    { tipo: "CLASSIFICACAO", chave: PRODUTO_DECLARACAO_FCI_GRAZING1, dados: { produtoId: PRODUTO_DECLARACAO_FCI_GRAZING1, grupo: "GF01", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: "0", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Declaração de teste exclusivamente sintética"], pendencias: [] } },
    { tipo: "REGRA", chave: "regra-g1-exclusivamente-sintetica", dados: { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: null, produtoId: PRODUTO_DECLARACAO_FCI_GRAZING1, natureza: null, ncm: null, cfop: "5101", csosn: "102", icms: sem, pis: { ...sem, cst: "49" }, cofins: { ...sem, cst: "49" }, ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "EXCLUSIVAMENTE_SINTETICA", reforma: null, seletivo: "NAO_APLICAVEL" } },
  ];
  for (const e of entradas) {
    const anterior = await s.prisma.versaoEstruturaFiscal.findFirst({ where: { tipo: e.tipo, chave: e.chave }, orderBy: { versao: "desc" } });
    await salvarVersaoFiscal({ tipo: e.tipo, chave: e.chave, versaoBase: anterior?.versao ?? 0, vigenciaInicio: "2026-10-15", dados: e.dados, justificativa: "Proposta exclusivamente sintética para testar a orquestração", fontes: ["https://www.gov.br/fonte-exclusivamente-sintetica"], chaveOperacao: randomUUID() } as SalvarVersaoFiscalEntrada, sessao);
  }
}
async function pedido(atendimento: "ENTREGA" | "RETIRADA" = "ENTREGA") {
  return s.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "pedido-exclusivamente-sintetico", criadoPorId: sessao.userId, confirmadoEm: new Date(), status: "CONFIRMADO", origem: "INTERNO", atendimento, subtotal: "10", total: "10", compradorSnapshot: { tipo: "PF", nome: "Comprador exclusivamente sintético", documento: "11144477735" }, cobrancaSnapshot: { ...massaPayloadLocal().cadastro.enderecoEstruturado, pais: "BRASIL" }, enderecoSnapshot: { uf: "SP" }, formaPagamentoInformada: "PIX", pagamentoInformadoSnapshot: { tipo: "PIX" }, itens: { create: { produtoId: PRODUTO_DECLARACAO_FCI_GRAZING1, versaoPedido: 1, ordem: 0, quantidade: "1", unidadeSnapshot: "UN", produtoSnapshot: { nome: "Produto exclusivamente sintético de revisão" }, escolhasSnapshot: [], estadoComposicao: "SINTETICO", precoOriginal: "10", precoAplicado: "10", acrescimos: "0", totalLinha: "10" } } } });
}
function comando(p: PreviaEmissaoPedidoBrasilNfe) {
  return { documentoId: p.documento!.id, modelo: p.modelo, ambiente: p.ambiente, hashSnapshot: p.documento!.hashSnapshot, hashPayloadFiscal: p.documento!.hashPayloadFiscal!, total: p.total, autorizarUmaTransmissao: true, conferenciaSemDocumentoExterno: true, indicadorPresenca: p.contextoOperacao!.indicadorPresenca!, revisaoConsolidada: { hash: p.revisaoConsolidada!.hash, versoes: p.revisaoConsolidada!.versoes.map(v => ({ id: v.id, hash: v.hash })), confirmarAprovacao: true } };
}
function empresa() { const m = massaPayloadLocal(), e = m.cadastro.enderecoEstruturado; return { CNPJ: m.cadastro.cnpj, IE: m.parametros.emitente.ie, CRT: 1, Endereco: { Cep: e.cep, Uf: e.uf, Numero: e.numero, CodMunicipio: e.codMunicipio, Logradouro: e.logradouro, Bairro: e.bairro, Municipio: e.cidade }, Configuracao: { NFCe: { IdCSCHomologacao: "000001", CSCHomologacao: "csc-homologacao-exclusivamente-sintetico", IdCSCProducao: "000002", CSCProducao: "csc-producao-exclusivamente-sintetico" } } }; }
function retorno(ambiente: 1 | 2, numero = "1") { return { ReturnNF: { Numero: numero, Serie: "6", ChaveNF: chave(numero.padStart(9, "0")), NumeroProtocolo: "90071992547409930001", CodTipoAmbiente: ambiente, CodStatusRespostaSefaz: 100, Ok: true }, Error: "", Avisos: [] }; }
function retornoDireto(modelo: 55 | 65, numero: string) {
  const serie = modelo === 55 ? "6" : "7";
  return { ReturnNF: { Numero: numero, Serie: serie, ChaveNF: `35261000000000000000${modelo}${serie.padStart(3, "0")}${numero.padStart(9, "0")}1000000010`, NumeroProtocolo: "90071992547409930001", CodTipoAmbiente: 1, CodStatusRespostaSefaz: 100, Ok: true }, Error: "", Avisos: [] };
}
async function ativacoes() { return s.prisma.eventoEstruturaFiscal.count({ where: { tipo: "ATIVACAO", versao: { tipo: { in: ["CLASSIFICACAO", "REGRA"] } } } }); }
let numeroCancelamento = 20;
async function notaParaCancelar(modelo: 55 | 65 = 55, ambiente: "HOMOLOGACAO" | "PRODUCAO" = "HOMOLOGACAO") {
  const p = await pedido(), numero = String(++numeroCancelamento), serie = modelo === 55 ? "6" : "7";
  const chaveFiscal = `35261000000000000000${modelo}${serie.padStart(3, "0")}${numero.padStart(9, "0")}1000000010`;
  const d = await s.prisma.documentoFiscalSaida.create({ data: { pedidoId: p.id, versaoPedido: 1, criadoPorId: sessao.userId, criadoPorNome: sessao.nome,
    modeloDocumento: modelo, ambiente, status: "AUTORIZADO", provedor: "BRASIL_NFE", numero, serie, chaveFiscal, referenciaProvedor: chaveFiscal, protocolo: "90071992547409930001",
    hashPayload: "a".repeat(64), payload: { versao: 2, emitente: { cnpj: "00000000000000" } }, xml: "<documento>ARQUIVO EXCLUSIVAMENTE SINTETICO</documento>", pdf: Buffer.from("PDF EXCLUSIVAMENTE SINTETICO") } });
  await s.prisma.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `emissao-manual-autorizada:${d.id}`, tipo: "EMISSAO_MANUAL_AUTORIZADA",
    dados: { hashSnapshot: d.hashPayload, versaoConfiguracao: 1, emitenteHash: s.emitenteHash } } });
  return { documentoId: d.id, modelo, ambiente, chaveFiscal, protocolo: d.protocolo!, justificativa: "Cancelamento exclusivamente sintético da suíte.", confirmarCancelamento: true as const };
}
function eventoCancelamento(chaveFiscal: string, ambiente: "HOMOLOGACAO" | "PRODUCAO") {
  const tpAmb = ambiente === "PRODUCAO" ? 1 : 2;
  const xml = `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe"><evento><infEvento><tpAmb>${tpAmb}</tpAmb><CNPJ>00000000000000</CNPJ><chNFe>${chaveFiscal}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento></infEvento></evento><retEvento><infEvento><tpAmb>${tpAmb}</tpAmb><chNFe>${chaveFiscal}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><cStat>135</cStat><nProt>90071992547409930002</nProt></infEvento></retEvento></procEventoNFe>`;
  return { Status: 1, CodStatusRespostaSefaz: 135, NuProtocolo: "90071992547409930002", NumeroSequencial: 1, Error: "", Base64Xml: Buffer.from(xml).toString("base64") };
}

describe.skipIf(process.env.BRASILNFE_BANCO_TESTE !== "1")("Revisão consolidada na emissão manual, banco e HTTP exclusivamente sintéticos", () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-15T15:00:00Z"));
    const url = new URL(process.env.DATABASE_URL!); if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/teste_/.test(url.pathname)) throw new Error("Banco local exclusivamente sintético obrigatório");
    banco = new Client({ connectionString: url.toString() }); await banco.connect(); await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(await prepararMigrationHubIsolada(banco, schema, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    s.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await s.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const u = await s.prisma.usuario.create({ data: { nome: "Autor exclusivamente sintético", email: "revisao-emissao@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    sessao = { userId: u.id, nome: u.nome, email: u.email, admin: true, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    await s.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: massaPayloadLocal().cadastro, update: massaPayloadLocal().cadastro });
    const loja = await s.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" }, select: { id: true, nome: true, cnpj: true, enderecoEstruturado: true } }); s.emitenteHash = createHash("sha256").update(JSON.stringify(loja)).digest("hex");
    await s.prisma.configuracaoBrasilNfe.create({ data: { id: "singleton", lojaId: "singleton", versao: 1 } });
    await s.prisma.produtoVenda.create({ data: { id: PRODUTO_DECLARACAO_FCI_GRAZING1, nome: "Produto exclusivamente sintético de revisão", unidade: "UN", preco: "10" } });
    await versaoAtiva("PERFIL", "singleton", { estabelecimento: "singleton", cnpj: "00000000000000", inscricaoEstadual: "000000000000", uf: "SP", codigoMunicipio: "3550308", regime: "SIMPLES_NACIONAL", crt: 1, confirmado: true, evidenciaEnquadramento: "Evidência exclusivamente sintética", modelos: ["55", "65"], emissor: "BRASIL_NFE", reforma: "DISPENSADO_SIMPLES_2026", beneficioOpcional: null });
    for (const [tabela, codigo] of [["NCM", "19059090"], ["CFOP", "5101"], ["CSOSN", "102"], ["CST_ICMS", "40"], ["CST_PIS_COFINS", "49"]]) await versaoAtiva("TABELA", tabela, { tabela, referencia: "Tabela exclusivamente sintética", completa: false, linhas: [{ codigo, descricao: "Descrição exclusivamente sintética" }] });
    s.pre = preRequisitosBrasilNfeVazios(1); s.pre.empresaCorrespondente = true;
    s.pre.csc = { homologacao: { codigo: true, identificador: true }, producao: { codigo: true, identificador: true } };
    s.pre.evidenciaPainel = { origem: "PAINEL_BRASIL_NFE", observadoEm: new Date().toISOString(), registradoEm: new Date().toISOString(), servicoNfeNfceAtivo: true, homologacaoInformadaPeloUsuario: true, certificadoValidade: "2026-11-07", csc: { homologacao: { codigo: true, identificador: true }, producao: { codigo: true, identificador: true } } };
    await configurarHabilitacaoEmissaoBrasilNfe({ ambiente: "HOMOLOGACAO", revisao: 0, habilitada: true, modelos: [55, 65], documentosHomologados: [], confirmarAtivacao: true }, sessao);
    // Habilitação produtiva também será conferida pelo serviço normal, após a prova de homologação abaixo.
  }, 120000);
  afterAll(async () => { await s.prisma?.$disconnect(); if (banco) { if (criado && /^teste_revisao_emissao_[a-f0-9]{32}$/.test(schema)) { await limparIntegracaoHubIsolada(banco, schema); await banco.query(`DROP SCHEMA "${schema}" CASCADE`); } await banco.end(); } vi.useRealTimers(); });
  afterEach(() => { s.http.mockReset(); });
  it("Emitir direto não ativa rascunhos fiscais quando ainda não existe configuração aprovada", async () => {
    await propostas(); const p = await pedido(), antes = await ativacoes();
    const r = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 55, indicadorPresenca: 2 }, sessao);
    expect(r).toHaveProperty("erro"); expect(r).toHaveProperty("pendencias"); expect(await ativacoes()).toBe(antes);
    expect(await s.prisma.versaoEstruturaFiscal.count({ where: { tipo: { in: ["CLASSIFICACAO", "REGRA"] }, status: "ATIVO" } })).toBe(0);
    expect(s.http).not.toHaveBeenCalled(); expect(await efeitos()).toEqual({ financeiro: 0, estoque: 0, recebidas: 0 });
  });
  it("ato55/2 registra revisão específica sem ativar e obtém prova fiscal somente simulada", async () => {
    await propostas(); const p = await pedido(), previa = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "HOMOLOGACAO", sessao, { indicadorPresenca: 2 }), c = comando(previa), antes = await ativacoes();
    const cadastroExterno = empresa();
    s.http.mockResolvedValueOnce(response({ ...cadastroExterno, Endereco: { ...cadastroExterno.Endereco, Uf: undefined } })).mockResolvedValueOnce(response(retorno(2)));
    expect(await emitirNotaPedidoBrasilNfe(c, sessao)).toMatchObject({ status: "AUTORIZADO" }); homologadaId = c.documentoId;
    expect(await ativacoes()).toBe(antes);
    expect(await s.prisma.eventoFiscalSaida.findUniqueOrThrow({ where: { chave: `emissao-revisao-homologacao:${c.documentoId}` } })).toMatchObject({ dados: { aprovacaoInterna: false, finalidade: "TESTE_HOMOLOGACAO", hashSnapshot: c.hashSnapshot, usuarioId: sessao.userId } });
    expect(await s.prisma.versaoEstruturaFiscal.count({ where: { id: { in: c.revisaoConsolidada.versoes.map(v => v.id) }, status: "RASCUNHO" } })).toBe(2);
    expect(await s.prisma.eventoFiscalSaida.findUniqueOrThrow({ where: { chave: `emissao-manual-consumida:${c.documentoId}` } })).toMatchObject({ dados: { ufConferidaPor: "CORRESPONDENCIA_IBGE_UNIVOCA" } });
    s.http.mockResolvedValueOnce(response({ status: 1, Encontrada: true, Nota: { ModeloDocumento: 55, IdentificadorInterno: c.documentoId, Chave: chave(), Numero: "1", Serie: "6", NumeroProtocolo: "90071992547409930001", CodTipoAmbiente: 2, Status: 1, Emitida: true, CodStatusResposta: 100 }, Historico: [], erros: [], avisos: [] }));
    expect(await consultarEmissaoPedidoBrasilNfe(c.documentoId, sessao)).toMatchObject({ status: "AUTORIZADO" });
    const xml = `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave()}"><ide><mod>55</mod><tpAmb>2</tpAmb><serie>6</serie><nNF>1</nNF></ide><emit><CNPJ>00000000000000</CNPJ></emit><dest><xNome>NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL</xNome></dest><det nItem="1"><prod><cProd>${PRODUTO_DECLARACAO_FCI_GRAZING1}</cProd><NCM>19059090</NCM><CFOP>5101</CFOP><uCom>UN</uCom><uTrib>UN</uTrib><qCom>1</qCom><qTrib>1</qTrib><vUnCom>10</vUnCom><vUnTrib>10</vUnTrib><vProd>10</vProd></prod><imposto><ICMS><ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102></ICMS></imposto></det><total><ICMSTot><vProd>10</vProd><vFrete>0</vFrete><vDesc>0</vDesc><vOutro>0</vOutro><vSeg>0</vSeg><vNF>10</vNF></ICMSTot></total></infNFe></NFe><protNFe><infProt><tpAmb>2</tpAmb><chNFe>${chave()}</chNFe><nProt>90071992547409930001</nProt><cStat>100</cStat></infProt></protNFe></nfeProc>`;
    const pdf = new jsPDF(); pdf.text("Impressao exclusivamente sintetica", 10, 10);
    s.http.mockResolvedValueOnce(response(Buffer.from(xml).toString("base64"))).mockResolvedValueOnce(response(Buffer.from(pdf.output("arraybuffer")).toString("base64")));
    expect(await obterDocumentosEmissaoPedidoBrasilNfe(c.documentoId, sessao)).toMatchObject({ status: "AUTORIZADO", formatoImpressao: "PDF" });
    await configurarHabilitacaoEmissaoBrasilNfe({ ambiente: "PRODUCAO", revisao: 0, habilitada: true, modelos: [55], documentosHomologados: [homologadaId], confirmarAtivacao: true }, sessao);
    expect(await efeitos()).toEqual({ financeiro: 0, estoque: 0, recebidas: 0 });
  }, 15000);
  it.each(["AMBIENTE", "MODELO", "PRESENCA", "HASH_SNAPSHOT", "HASH_PAYLOAD", "HASH_REVISAO"] as const)("comando adulterado em%s não aprova nem transmite, com os ambientes já habilitados", async campo => {
    await propostas(); const p = await pedido(), previa = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "HOMOLOGACAO", sessao, { indicadorPresenca: 2 });
    expect(previa.pendencias).toEqual([]); expect(previa.revisaoConsolidada?.pendente).toBe(true);
    const c = comando(previa), antes = await ativacoes(), httpAntes = s.http.mock.calls.length;
    if (campo === "AMBIENTE") c.ambiente = "PRODUCAO";
    if (campo === "MODELO") c.modelo = 65;
    if (campo === "PRESENCA") c.indicadorPresenca = 1;
    if (campo === "HASH_SNAPSHOT") c.hashSnapshot = "a".repeat(64);
    if (campo === "HASH_PAYLOAD") c.hashPayloadFiscal = "b".repeat(64);
    if (campo === "HASH_REVISAO") c.revisaoConsolidada.hash = "c".repeat(64);
    await expect(emitirNotaPedidoBrasilNfe(c, sessao)).rejects.toThrow();
    expect(await ativacoes()).toBe(antes); expect(s.http).toHaveBeenCalledTimes(httpAntes);
    expect(await s.prisma.eventoFiscalSaida.count({ where: { documentoId: c.documentoId, tipo: { not: "PREPARADO" } } })).toBe(0);
  });
  it.each([
    { caso: "UF explícita divergente", uf: "RJ", codigo: "3550308" },
    { caso: "UF e IBGE ausentes", uf: undefined, codigo: undefined },
    { caso: "IBGE divergente", uf: undefined, codigo: "3304557" },
  ])("endereço externo com$caso não transmite nem ignora divergência", async ({ uf, codigo }) => {
    await propostas(); const p = await pedido(), previa = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "HOMOLOGACAO", sessao, { indicadorPresenca: 2 }), c = comando(previa), httpAntes = s.http.mock.calls.length, antes = await ativacoes();
    const cadastro = empresa(); s.http.mockResolvedValueOnce(response({ ...cadastro, Endereco: { ...cadastro.Endereco, Uf: uf, CodMunicipio: codigo } }));
    expect(await emitirNotaPedidoBrasilNfe(c, sessao)).toMatchObject({ status: "PENDENTE_CONFERENCIA" });
    expect(s.http.mock.calls.slice(httpAntes).map(v => String(v[0]))).toEqual(["https://api.brasilnfe.com.br/services/empresa/BuscarEmpresa"]);
    expect(await s.prisma.eventoFiscalSaida.count({ where: { chave: `emissao-manual-consumida:${c.documentoId}` } })).toBe(0); expect(await ativacoes()).toBe(antes);
  });
  it("ato produtivo sintético aprova pelo serviço auditado, re-prepara e envia somente a nova identidade", async () => {
    await propostas(); const p = await pedido(), previa = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "PRODUCAO", sessao, { indicadorPresenca: 2 }), c = comando(previa), antes = await ativacoes(), httpAntes = s.http.mock.calls.length;
    expect(previa.pendencias).toEqual([]); expect(previa.revisaoConsolidada?.pendente).toBe(true);
    s.http.mockResolvedValueOnce(response(empresa())).mockImplementationOnce(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { IdentificadorInterno: string; TipoAmbiente: number };
      expect(body.IdentificadorInterno).not.toBe(c.documentoId); expect(body.TipoAmbiente).toBe(1);
      const lock = await banco!.query<{ livre: boolean }>("SELECT pg_try_advisory_xact_lock(hashtext('fiscal-saida')) AS livre"); expect(lock.rows[0].livre).toBe(false);
      return response(retorno(1, "2"));
    });
    const r = await emitirNotaPedidoBrasilNfe(c, sessao);
    expect(r).toMatchObject({ status: "AUTORIZADO", ambiente: "PRODUCAO", numero: "2", serie: "6" }); expect(r.id).not.toBe(c.documentoId);
    expect(await ativacoes()).toBe(antes + 2);
    expect(await s.prisma.eventoEstruturaFiscal.count({ where: { tipo: "ATIVACAO", usuarioId: sessao.userId, dados: { path: ["revisaoConsolidada", "hash"], equals: c.revisaoConsolidada.hash } } })).toBe(2);
    const auditoria = await s.prisma.eventoEstruturaFiscal.findMany({ where: { tipo: "ATIVACAO", dados: { path: ["revisaoConsolidada", "hash"], equals: c.revisaoConsolidada.hash } }, select: { dados: true } });
    for (const evento of auditoria) expect(evento.dados).toMatchObject({ revisaoConsolidada: { hash: c.revisaoConsolidada.hash, versoes: c.revisaoConsolidada.versoes, transmissaoAutorizada: false } });
    const foto = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: r.id } });
    expect((foto.payload as { tributacao: { revisaoConsolidada?: unknown } }).tributacao.revisaoConsolidada).toBeUndefined();
    expect(s.http.mock.calls.slice(httpAntes).map(v => String(v[0]))).toEqual(["https://api.brasilnfe.com.br/services/empresa/BuscarEmpresa", "https://api.brasilnfe.com.br/services/fiscal/EnviarNotaFiscal"]);
    await expect(emitirNotaPedidoBrasilNfe(c, sessao)).rejects.toThrow();
    expect(s.http).toHaveBeenCalledTimes(httpAntes + 2); expect(await efeitos()).toEqual({ financeiro: 0, estoque: 0, recebidas: 0 });
  }, 15000);
  it("um clique produtivo do Site emite NF-e55 com Internet sem confirmação do canal", async () => {
    await propostas(); const p = await pedido(), httpAntes = s.http.mock.calls.length, ativacoesAntes = await ativacoes();
    await s.prisma.pedidoVenda.update({ where: { id: p.id }, data: { canalNomeSnapshot: "Site" } });
    const rascunhosAntes = await s.prisma.versaoEstruturaFiscal.findMany({ where: { status: "RASCUNHO" }, orderBy: { id: "asc" } });
    s.http.mockResolvedValueOnce(response(empresa())).mockImplementationOnce(async (_url, init) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ ModeloDocumento: 55, TipoAmbiente: 1, IndicadorPresenca: 2, ConsumidorFinal: true });
      return response(retornoDireto(55, "41"));
    });
    const r = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 55 }, sessao);
    expect(r).toMatchObject({ ok: true, documento: { status: "AUTORIZADO", modeloDocumento: 55, ambiente: "PRODUCAO", numero: "41" }, conferirAntesDeRepetir: true });
    expect(s.http.mock.calls.slice(httpAntes).map(v => String(v[0]))).toEqual(["https://api.brasilnfe.com.br/services/empresa/BuscarEmpresa", "https://api.brasilnfe.com.br/services/fiscal/EnviarNotaFiscal"]);
    expect(await ativacoes()).toBe(ativacoesAntes); expect(await s.prisma.versaoEstruturaFiscal.findMany({ where: { status: "RASCUNHO" }, orderBy: { id: "asc" } })).toEqual(rascunhosAntes);
    expect(await efeitos()).toEqual({ financeiro: 0, estoque: 0, recebidas: 0 });
  }, 15000);
  it("um clique NFC-e65 usa a forma comercial sem exigir recebimento nem confirmação de cartão", async () => {
    const pre = { ...s.pre, verificadoEm: new Date().toISOString(), empresaVerificadaEm: new Date().toISOString() };
    await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { preRequisitos: json(pre), preRequisitosEmitenteHash: s.emitenteHash } });
    await configurarHabilitacaoEmissaoBrasilNfe({ ambiente: "PRODUCAO", revisao: 1, habilitada: true, modelos: [55, 65], documentosHomologados: [homologadaId], confirmarAtivacao: true,
      decisaoProducao65: { versao: 1, tipo: "DECISAO_ADMINISTRATIVA_SEM_HOMOLOGACAO_LOCAL", motivo: "CSC_HOMOLOGACAO_INDISPONIVEL_RESPONSAVEL", confirmarResponsabilidade: true, modoRegistro: "SESSAO_NORMAL" } }, sessao);
    const p = await pedido(), httpAntes = s.http.mock.calls.length;
    await s.prisma.pedidoVenda.update({ where: { id: p.id }, data: { formaPagamentoInformada: "CARTAO_CREDITO", pagamentoInformadoSnapshot: { tipo: "CARTAO_CREDITO" } } });
    let corpoEnviado: Record<string, unknown> | null = null;
    s.http.mockResolvedValueOnce(response(empresa())).mockImplementationOnce(async (_url, init) => {
      corpoEnviado = JSON.parse(String(init?.body));
      return response(retornoDireto(65, "42"));
    });
    const r = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao);
    expect(s.http.mock.calls.slice(httpAntes).map(v => String(v[0]))).toEqual(["https://api.brasilnfe.com.br/services/empresa/BuscarEmpresa", "https://api.brasilnfe.com.br/services/fiscal/EnviarNotaFiscal"]);
    expect(corpoEnviado).toMatchObject({ ModeloDocumento: 65, TipoAmbiente: 1, IndicadorPresenca: 4, ConsumidorFinal: true, Pagamentos: [{ FormaPagamento: "03", VlPago: 10, TipoIntegracao: false }] });
    expect((corpoEnviado as unknown as { Pagamentos: unknown[] }).Pagamentos[0]).not.toHaveProperty("CnpjCredenciadora"); expect((corpoEnviado as unknown as { Pagamentos: unknown[] }).Pagamentos[0]).not.toHaveProperty("NumeroAutorizacao");
    expect(r).toMatchObject({ ok: true, documento: { status: "AUTORIZADO", modeloDocumento: 65, ambiente: "PRODUCAO", numero: "42" } });
    if (!("ok" in r)) throw new Error("Emissão sintética NFC-e não concluída.");
    const foto = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: r.documento.id } });
    expect(foto.payload).toMatchObject({ tributacao: { pagamentoCartaoNaoIntegrado: true, documento: { Pagamentos: [{ TipoIntegracao: false }] } } });
    expect(await efeitos()).toEqual({ financeiro: 0, estoque: 0, recebidas: 0 });
  }, 15000);
  it("cliques diretos concorrentes autorizam um único POST do pedido", async () => {
    const p = await pedido(), httpAntes = s.http.mock.calls.length;
    s.http.mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(response(retornoDireto(65, "43")));
    const resultados = await Promise.allSettled([emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao), emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao)]);
    expect(resultados.filter(r => r.status === "fulfilled" && "ok" in r.value)).toHaveLength(1);
    expect(s.http.mock.calls.slice(httpAntes).filter(v => String(v[0]).endsWith("/EnviarNotaFiscal"))).toHaveLength(1);
    expect(await s.prisma.eventoFiscalSaida.count({ where: { documento: { pedidoId: p.id }, tipo: "EMISSAO_MANUAL_AUTORIZADA" } })).toBe(1);
    expect(await s.prisma.documentoFiscalSaida.count({ where: { pedidoId: p.id, status: "AUTORIZADO" } })).toBe(1);
  }, 15000);
  it("rejeição certa permite outra revisão, sem reescrever nem retransmitir a identidade rejeitada", async () => {
    const p = await pedido(), rejeicao = retornoDireto(65, "44"), httpAntes = s.http.mock.calls.length;
    rejeicao.ReturnNF.Ok = false; rejeicao.ReturnNF.CodStatusRespostaSefaz = 386; rejeicao.ReturnNF.NumeroProtocolo = "";
    s.http.mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(response(rejeicao));
    const r = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao);
    expect(r).toMatchObject({ ok: true, documento: { status: "REJEITADO" }, conferirAntesDeRepetir: false });
    if (!("ok" in r)) throw new Error("Rejeição sintética não registrada.");
    const original = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: r.documento.id } });
    s.http.mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(response(retornoDireto(65, "45")));
    const nova = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao);
    expect(nova).toMatchObject({ ok: true, documento: { status: "AUTORIZADO", numero: "45" } });
    if (!("ok" in nova)) throw new Error("Nova revisão sintética não emitida.");
    expect(nova.documento.id).not.toBe(original.id); expect(await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original);
    expect(s.http.mock.calls.slice(httpAntes).filter(v => String(v[0]).endsWith("/EnviarNotaFiscal")).map(v => JSON.parse(String(v[1]?.body)).IdentificadorInterno)).toEqual([original.id, nova.documento.id]);
  }, 15000);
  it("consulta rejeição XML com chave e permite nova revisão/modelo sem exigir pagamento recebido", async () => {
    const p = await pedido();
    await s.prisma.pedidoVenda.update({ where: { id: p.id }, data: { formaPagamentoInformada: "CARTAO_CREDITO", pagamentoInformadoSnapshot: { tipo: "CARTAO_CREDITO" } } });
    const antesHttp = s.http.mock.calls.length;
    s.http.mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(response({ formato: "resposta exclusivamente sintética fora do contrato" }));
    const tentativa = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao);
    expect(tentativa.documento?.status).toBe("PENDENTE_CONFERENCIA");
    const chaveRejeitada = retornoDireto(65, "54").ReturnNF.ChaveNF;
    s.http.mockResolvedValueOnce(response({ status: 1, Encontrada: true, Historico: [], erros: [], avisos: [], Nota: {
      ModeloDocumento: 65, IdentificadorInterno: tentativa.documento!.id, CodTipoAmbiente: 1,
      Status: 3, Emitida: false, CodStatusResposta: 0, Chave: chaveRejeitada, Numero: "54", Serie: "7", NumeroProtocolo: null,
      DsStatusResposta: "Validação XML: xProd inválido. Pattern constraint failed. SEGREDO-SINTETICO-NAO-PERSISTIR",
    } }));
    s.http.mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(response(retornoDireto(55, "55")));
    const nova = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 55, indicadorPresenca: 2 }, sessao);
    expect(nova).toMatchObject({ ok: true, documento: { status: "AUTORIZADO", modeloDocumento: 55 } });
    const rejeitada = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: tentativa.documento!.id } });
    expect(rejeitada).toMatchObject({ status: "REJEITADO", chaveFiscal: chaveRejeitada, protocolo: null, ultimoErro: expect.stringContaining("xProd") });
    expect(JSON.stringify(rejeitada)).not.toContain("SEGREDO-SINTETICO");
    expect(nova.documento!.id).not.toBe(rejeitada.id);
    expect(s.http.mock.calls.slice(antesHttp).map(v => String(v[0]).split("/").pop())).toEqual(["BuscarEmpresa", "EnviarNotaFiscal", "ConsultarNotaFiscal", "BuscarEmpresa", "EnviarNotaFiscal"]);
    const envios = s.http.mock.calls.slice(antesHttp).filter(v => String(v[0]).endsWith("/EnviarNotaFiscal")).map(v => JSON.parse(String(v[1]?.body)));
    expect(envios).toHaveLength(2); expect(envios[0].Pagamentos).toMatchObject([{ FormaPagamento: "03", TipoIntegracao: false }]);
    expect(envios[1].Pagamentos).toMatchObject([{ FormaPagamento: "03" }]);
    expect(await efeitos()).toEqual({ financeiro: 0, estoque: 0, recebidas: 0 });
  }, 15000);
  it.each([600, 777, 383, 232])("novo clique consulta rejeição %s e permite trocar NF-e por NFC-e sem reenvio incerto", async codigo => {
    const numeroRejeitada = String(codigo + 100), numeroNova = String(codigo + 200);
    const p = await pedido(); await s.prisma.pedidoVenda.update({ where: { id: p.id }, data: { canalNomeSnapshot: "Site" } });
    s.http.mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(response({ contrato: "resposta sintética inválida" }));
    const tentativa = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 55 }, sessao);
    expect(tentativa.documento?.status).toBe("PENDENTE_CONFERENCIA");
    const original = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: tentativa.documento!.id } });
    s.http.mockResolvedValueOnce(response({ status: 1, Encontrada: true, Historico: [], erros: [], avisos: [], Nota: {
      ModeloDocumento: 55, IdentificadorInterno: original.id, CodTipoAmbiente: 1, Status: 3, Emitida: false, CodStatusResposta: codigo,
      Chave: retornoDireto(55, numeroRejeitada).ReturnNF.ChaveNF, Numero: numeroRejeitada, Serie: "6", NumeroProtocolo: null, DsStatusResposta: "SEGREDO-EXTERNO-SINTETICO",
    } })).mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(response(retornoDireto(65, numeroNova)));
    const nova = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao);
    expect(nova).toMatchObject({ ok: true, documento: { status: "AUTORIZADO", modeloDocumento: 65 } });
    const antiga = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: original.id } });
    expect(antiga).toMatchObject({ status: "REJEITADO", protocolo: null, ultimoErro: expect.stringContaining(`SEFAZ ${codigo}`) });
    expect(antiga.payload).toEqual(original.payload); expect(JSON.stringify(antiga)).not.toContain("SEGREDO-EXTERNO");
    expect(nova.documento!.id).not.toBe(original.id); expect(await efeitos()).toEqual({ financeiro: 0, estoque: 0, recebidas: 0 });
  }, 15000);
  it("HTTP403 mostra o motivo seguro e preserva a tentativa incerta sem novo POST", async () => {
    const p = await pedido(), httpAntes = s.http.mock.calls.length;
    s.http.mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(new Response("Token=SEGREDO_SINTETICO_NAO_PUBLICAR", { status: 403 }));
    const r = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao);
    expect(r).toMatchObject({ ok: true, documento: { status: "PENDENTE_CONFERENCIA", ultimoErro: expect.stringContaining("HTTP 403") }, conferirAntesDeRepetir: true });
    if (!("ok" in r)) throw new Error("Tentativa incerta sintética não registrada.");
    expect(r.documento.ultimoErro).not.toContain("SEGREDO_SINTETICO"); expect(r.documento.ultimoErro).toContain("antes de qualquer novo envio");
    expect(await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao)).toMatchObject({ conferirAntesDeRepetir: true, documento: { id: r.documento.id } });
    expect(s.http.mock.calls.slice(httpAntes).filter(v => String(v[0]).endsWith("/EnviarNotaFiscal"))).toHaveLength(1);
    expect(await efeitos()).toEqual({ financeiro: 0, estoque: 0, recebidas: 0 });
  }, 15000);
  it("consulta por pedido recupera rejeição certa e não dispara uma emissão nova", async () => {
    const p = await pedido(), rejeicao = retornoDireto(65, "46"); rejeicao.ReturnNF.Ok = false; rejeicao.ReturnNF.CodStatusRespostaSefaz = 787; rejeicao.ReturnNF.NumeroProtocolo = "";
    s.http.mockResolvedValueOnce(response(empresa())).mockResolvedValueOnce(response(rejeicao));
    const r = await emitirNotaPedidoDiretaBrasilNfe({ pedidoId: p.id, versaoPedido: 1, modelo: 65 }, sessao), httpAntes = s.http.mock.calls.length;
    expect(await consultarResultadoEmissaoPedidoBrasilNfe(p.id, sessao)).toMatchObject({ ok: true, documento: { id: r.documento!.id, status: "REJEITADO" }, conferirAntesDeRepetir: false });
    expect(s.http).toHaveBeenCalledTimes(httpAntes);
  }, 15000);
  it("CSC ausente mantém a presença2 explicitamente escolhida na prévia65", async () => {
    const anterior = structuredClone(s.pre.csc.homologacao), httpAntes = s.http.mock.calls.length;
    s.pre.csc.homologacao = { codigo: false, identificador: false };
    try {
      const p = await pedido(), previa = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 65, "HOMOLOGACAO", sessao, { indicadorPresenca: 2 });
      expect(previa.pendencias.some(p => p.campo === "csc" && /presença/.test(p.mensagem))).toBe(true);
      expect(previa.contextoOperacao).toEqual({ indicadorPresenca: 2, exigeEscolhaPresenca: false, consumidorFinal: true });
      expect(previa.podeEmitir).toBe(false);
      const foto = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: previa.documento!.id } });
      expect(foto.payload).toMatchObject({ tributacao: { documento: { ModeloDocumento: 65, IndicadorPresenca: 2 } } });
      expect(s.http).toHaveBeenCalledTimes(httpAntes);
    } finally { s.pre.csc.homologacao = anterior; }
  });
  it.each([[55, "HOMOLOGACAO"], [55, "PRODUCAO"], [65, "HOMOLOGACAO"], [65, "PRODUCAO"]] as const)("reabrir modelo%s/%s conserva presença, documento e hashes sem efeitos", async (modelo, ambiente) => {
    await propostas(); const p = await pedido("RETIRADA"), primeira = await prepararEmissaoPedidoBrasilNfe(p.id, 1, modelo, ambiente, sessao, { indicadorPresenca: 2 });
    const documento = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: primeira.documento!.id } }), eventosAntes = await s.prisma.eventoFiscalSaida.count({ where: { documento: { pedidoId: p.id } } }), httpAntes = s.http.mock.calls.length, efeitosAntes = await efeitos();
    for (let n = 0; n < 2; n++) {
      const reaberta = await prepararEmissaoPedidoBrasilNfe(p.id, 1, modelo, ambiente, sessao);
      expect(reaberta.contextoOperacao).toEqual({ indicadorPresenca: 2, exigeEscolhaPresenca: false, consumidorFinal: true });
      expect(reaberta.documento).toMatchObject({ id: primeira.documento!.id, hashSnapshot: primeira.documento!.hashSnapshot, hashPayloadFiscal: primeira.documento!.hashPayloadFiscal, tentativas: 0 });
    }
    expect(await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documento.id } })).toEqual(documento);
    expect(await s.prisma.documentoFiscalSaida.count({ where: { pedidoId: p.id } })).toBe(1); expect(await s.prisma.eventoFiscalSaida.count({ where: { documento: { pedidoId: p.id } } })).toBe(eventosAntes);
    expect(await s.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).toEqual(p); expect(s.http).toHaveBeenCalledTimes(httpAntes); expect(await efeitos()).toEqual(efeitosAntes);
  });
  it("escolha nova prevalece e fica preservada sem reescrever a fotografia anterior", async () => {
    await propostas(); const p = await pedido("RETIRADA"), primeira = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "PRODUCAO", sessao, { indicadorPresenca: 2 });
    const documento = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: primeira.documento!.id } }), httpAntes = s.http.mock.calls.length;
    const nova = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "PRODUCAO", sessao, { indicadorPresenca: 3 }), reaberta = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "PRODUCAO", sessao);
    expect(nova.contextoOperacao).toEqual({ indicadorPresenca: 3, exigeEscolhaPresenca: false, consumidorFinal: true }); expect(nova.documento!.id).not.toBe(documento.id); expect(nova.documento!.hashSnapshot).not.toBe(documento.hashPayload);
    expect(reaberta.documento).toMatchObject({ id: nova.documento!.id, hashSnapshot: nova.documento!.hashSnapshot, hashPayloadFiscal: nova.documento!.hashPayloadFiscal });
    expect(await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: documento.id } })).toEqual(documento); expect(await s.prisma.documentoFiscalSaida.count({ where: { pedidoId: p.id } })).toBe(2); expect(s.http).toHaveBeenCalledTimes(httpAntes);
  });
  it("zero ou ausência não criam escolha e55 não recupera o indicador4", async () => {
    await propostas(); const p = await pedido("RETIRADA"), inicial = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "HOMOLOGACAO", sessao), httpAntes = s.http.mock.calls.length;
    const reaberta = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "HOMOLOGACAO", sessao);
    expect(reaberta.contextoOperacao).toEqual({ indicadorPresenca: null, exigeEscolhaPresenca: true, consumidorFinal: true }); expect(reaberta.documento!.id).toBe(inicial.documento!.id); expect(reaberta.podeEmitir).toBe(false);
    const invalida = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "HOMOLOGACAO", sessao, { indicadorPresenca: 4 }), anterior = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: invalida.documento!.id } });
    const corrigivel = await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "HOMOLOGACAO", sessao);
    expect(corrigivel.contextoOperacao).toEqual({ indicadorPresenca: null, exigeEscolhaPresenca: true, consumidorFinal: true }); expect(corrigivel.podeEmitir).toBe(false); expect(await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: anterior.id } })).toEqual(anterior); expect(s.http).toHaveBeenCalledTimes(httpAntes);
  });
  it("presença não passa para outro pedido, modelo ou ambiente", async () => {
    await propostas(); const p = await pedido("RETIRADA"), outro = await pedido("RETIRADA");
    await prepararEmissaoPedidoBrasilNfe(p.id, 1, 55, "HOMOLOGACAO", sessao, { indicadorPresenca: 2 }); const httpAntes = s.http.mock.calls.length;
    for (const [id, modelo, ambiente] of [[p.id, 55, "PRODUCAO"], [p.id, 65, "HOMOLOGACAO"], [outro.id, 55, "HOMOLOGACAO"]] as const) {
      const previa = await prepararEmissaoPedidoBrasilNfe(id, 1, modelo, ambiente, sessao);
      expect(previa.contextoOperacao).toEqual({ indicadorPresenca: null, exigeEscolhaPresenca: true, consumidorFinal: true }); expect(previa.podeEmitir).toBe(false);
    }
    expect(s.http).toHaveBeenCalledTimes(httpAntes);
  });
  it("registrador real sela declaração e clone prospectivo em RASCUNHO canônico, sem ativar ou transmitir", async () => {
    const ultima = await s.prisma.versaoEstruturaFiscal.findFirstOrThrow({ where: { tipo: "CLASSIFICACAO", chave: PRODUTO_DECLARACAO_FCI_GRAZING1 }, orderBy: { versao: "desc" } });
    const dados: ClassificacaoFiscal = { ...ultima.dados as unknown as ClassificacaoFiscal, origem: null, estado: "PENDENTE", pendencias: [PENDENCIA_ORIGEM_GRAZING1], ncmAplicabilidade: "APLICAVEL",
      analiseNcm: { fundamento: "DOCUMENTAL", confianca: "ALTA", descricaoNcm: "Descrição exclusivamente sintética", dataAnalise: "2026-10-15", justificativa: "Análise exclusivamente sintética para provar auditoria e fotografia", fontes: ["https://www.gov.br/fonte-exclusivamente-sintetica"], pendenciasNcm: [] } };
    const rascunho = await salvarVersaoFiscal({ tipo: "CLASSIFICACAO", chave: PRODUTO_DECLARACAO_FCI_GRAZING1, versaoBase: ultima.versao, vigenciaInicio: "2026-10-15", dados, justificativa: "Base exclusivamente sintética para registrar declaração", fontes: ["https://www.gov.br/fonte-exclusivamente-sintetica"], chaveOperacao: randomUUID() }, sessao);
    const base = await s.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: rascunho.id } });
    expect((base.dados as unknown as ClassificacaoFiscal).fotografiaTecnica).toMatchObject({ algoritmo: "grazing.classificacao-fiscal.v1", materiais: { algoritmo: "grazing.material-fiscal.v1", insumos: [] } });
    // Fonte histórica exclusivamente sintética. A correção atual deve criar outra
    // versão pelo serviço; não pode deslocar sua vigência nem reescrever dados.
    const regraModelo = await s.prisma.versaoEstruturaFiscal.findFirstOrThrow({ where: { tipo: "REGRA", chave: "regra-g1-exclusivamente-sintetica", status: "ATIVO" } });
    const historica = await s.prisma.versaoEstruturaFiscal.create({ data: { tipo: "REGRA", chave: REGRA_DECLARACAO_FCI_GRAZING1, versao: 1, vigenciaInicio: new Date("2026-10-14T00:00:00Z"), dados: regraModelo.dados as Prisma.InputJsonValue, hash: regraModelo.hash, status: "RASCUNHO", justificativa: "Fonte histórica exclusivamente sintética", fontes: ["https://www.gov.br/fonte-exclusivamente-sintetica"], criadoPorId: sessao.userId, criadoPorNome: sessao.nome, chaveOperacao: randomUUID(), hashOperacao: randomUUID() } });
    await s.prisma.eventoEstruturaFiscal.create({ data: { versaoId: historica.id, tipo: "RASCUNHO", chaveOperacao: randomUUID(), usuarioId: sessao.userId, usuarioNome: sessao.nome, dados: { hash: historica.hash, vigenciaInicio: "2026-10-14", versaoBase: 0 } } });
    const antes = await ativacoes(), httpAntes = s.http.mock.calls.length, efeitosAntes = await efeitos();
    const registrada = await registrarDeclaracaoGrazing1PelaInstrucao({ baseId: base.id, baseHash: base.hash, referenciaInstrucao: REFERENCIA_INSTRUCAO_GRAZING1 }, sessao);
    expect(registrada.regraProspectivaCriada).toBe(true); expect(registrada.regraId).not.toBe(historica.id); expect(registrada.id).not.toBe(base.id);
    const classificacao = await s.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: registrada.id } }), regra = await s.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: registrada.regraId! } });
    expect(classificacao).toMatchObject({ status: "RASCUNHO", versao: base.versao + 1, dados: { origem: "5", gtin: "SEM GTIN", fci: { situacao: "DISPENSADA_POR_DECLARACAO_RESPONSAVEL", numero: null, periodoApuracao: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null, apuracaoCompleta: false, declaracaoResponsavel: { registro: { versaoId: registrada.id, responsavel: { usuarioId: sessao.userId } } } } } });
    expect(regra).toMatchObject({ status: "RASCUNHO", versao: 2, hash: historica.hash, vigenciaInicio: new Date("2026-10-15T00:00:00Z") });
    const eventos = await s.prisma.eventoEstruturaFiscal.findMany({ where: { versaoId: { in: [classificacao.id, regra.id] } } });
    expect(eventos).toHaveLength(2); expect(eventos.every(e => e.tipo === "RASCUNHO" && e.usuarioId === sessao.userId)).toBe(true);
    expect(eventos.find(e => e.versaoId === classificacao.id)!.dados).toMatchObject({ declaracaoResponsavel: { hashConteudo: classificacao.hash, aprovacaoDemaisParametros: false, declaracao: { registro: { versaoId: classificacao.id } } } });
    expect(eventos.find(e => e.versaoId === regra.id)!.dados).toMatchObject({ propostaProspectiva: { baseId: historica.id, baseHash: historica.hash, vigenciaAnterior: "2026-10-14", vigenciaInicio: "2026-10-15", historicoPreservado: true, aprovacaoInterna: false } });
    expect(await s.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: base.id } })).toEqual(base);
    expect(await s.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: historica.id } })).toEqual(historica);
    expect(await ativacoes()).toBe(antes); expect(s.http).toHaveBeenCalledTimes(httpAntes); expect(await efeitos()).toEqual(efeitosAntes);
  });
  it.each([[55, "HOMOLOGACAO"], [65, "PRODUCAO"]] as const)("cancelamento manual%s/%s usa único POST sob trava e preserva autorização/revisão", async (modelo, ambiente) => {
    const c = await notaParaCancelar(modelo, ambiente), antes = await efeitos(), httpAntes = s.http.mock.calls.length;
    const original = await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: c.documentoId } });
    await s.prisma.pedidoVenda.update({ where: { id: original.pedidoId }, data: { versao: 2 } });
    s.http.mockImplementationOnce(async (_url, init) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({ ChaveNF: c.chaveFiscal, NumeroProtocolo: c.protocolo, Justificativa: c.justificativa, TipoAmbiente: ambiente === "PRODUCAO" ? 1 : 2 });
      const lock = await banco!.query<{ livre: boolean }>("SELECT pg_try_advisory_xact_lock(hashtext('fiscal-saida')) AS livre"); expect(lock.rows[0].livre).toBe(false);
      return response(eventoCancelamento(c.chaveFiscal, ambiente));
    });
    const r = await cancelarNotaPedidoBrasilNfe(c, sessao);
    expect(r).toMatchObject({ status: "CANCELADO", protocolo: c.protocolo, cancelamentoPendente: false, cancelamentoSolicitado: true, protocoloCancelamento: "90071992547409930002" });
    expect(s.http.mock.calls.slice(httpAntes).map(v => String(v[0]))).toEqual(["https://api.brasilnfe.com.br/services/fiscal/CancelarNotaFiscal"]);
    expect(await s.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: c.documentoId } })).toMatchObject({ hashPayload: original.hashPayload, versaoPedido: 1, chaveFiscal: c.chaveFiscal });
    expect(await s.prisma.eventoFiscalSaida.count({ where: { documentoId: c.documentoId, tipo: "CANCELAMENTO_MANUAL_EXECUCAO_INICIADA" } })).toBe(1);
    await expect(cancelarNotaPedidoBrasilNfe(c, sessao)).rejects.toThrow("Somente uma nota autorizada");
    expect(s.http).toHaveBeenCalledTimes(httpAntes + 1); expect(await efeitos()).toEqual(antes);
  });
  it("cliques concorrentes autorizam um único cancelamento", async () => {
    const c = await notaParaCancelar(), httpAntes = s.http.mock.calls.length;
    s.http.mockResolvedValueOnce(response(eventoCancelamento(c.chaveFiscal, c.ambiente)));
    const r = await Promise.allSettled([cancelarNotaPedidoBrasilNfe(c, sessao), cancelarNotaPedidoBrasilNfe(c, sessao)]);
    expect(r.filter(v => v.status === "fulfilled")).toHaveLength(1);
    expect(s.http).toHaveBeenCalledTimes(httpAntes + 1);
    expect(await s.prisma.eventoFiscalSaida.count({ where: { documentoId: c.documentoId, tipo: "CANCELAMENTO_MANUAL_AUTORIZADO" } })).toBe(1);
  });
  it.each(["PRAZO", "TIMEOUT"] as const)("cancelamento%s mantém protocolo e bloqueia repetição após recarregar", async caso => {
    const c = await notaParaCancelar(), httpAntes = s.http.mock.calls.length;
    if (caso === "PRAZO") s.http.mockResolvedValueOnce(response({ Status: 3, CodStatusRespostaSefaz: 501, NuProtocolo: null, NumeroSequencial: null, Error: "Texto externo proibido" }));
    else s.http.mockRejectedValueOnce(new Error("Falha de rede exclusivamente sintética"));
    const r = await cancelarNotaPedidoBrasilNfe(c, sessao);
    expect(r).toMatchObject({ status: "AUTORIZADO", protocolo: c.protocolo, chaveFiscal: c.chaveFiscal, cancelamentoPendente: caso === "TIMEOUT", cancelamentoSolicitado: true });
    expect(r.ultimoErro).toContain(caso === "PRAZO" ? "Prazo de cancelamento" : "Cancelamento não confirmado");
    expect(r.ultimoErro).not.toContain("Texto externo");
    expect((await consultarFiscalSaida(r.pedidoId, sessao)).find(d => d.id === r.id)).toMatchObject({ status: "AUTORIZADO", cancelamentoSolicitado: true, cancelamentoPendente: caso === "TIMEOUT" });
    expect(await baixarArquivoFiscalSaida(r.id, "xml", sessao)).toBe("<documento>ARQUIVO EXCLUSIVAMENTE SINTETICO</documento>");
    expect(Buffer.from((await baixarArquivoFiscalSaida(r.id, "pdf", sessao)) as Uint8Array).toString()).toBe("PDF EXCLUSIVAMENTE SINTETICO");
    await expect(cancelarNotaPedidoBrasilNfe(c, sessao)).rejects.toThrow(); expect(s.http).toHaveBeenCalledTimes(httpAntes + 1);
  });
  it.each(["PROTOCOLO", "AMBIENTE", "PERMISSAO", "CONFIGURACAO"] as const)("cancelamento recusa%s antes de qualquer POST", async caso => {
    const c = await notaParaCancelar(), httpAntes = s.http.mock.calls.length;
    if (caso === "CONFIGURACAO") await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { versao: 2 } });
    try {
      await expect(cancelarNotaPedidoBrasilNfe({ ...c, ...(caso === "PROTOCOLO" ? { protocolo: "999" } : {}), ...(caso === "AMBIENTE" ? { ambiente: "PRODUCAO" } : {}) }, caso === "PERMISSAO" ? { ...sessao, versao: 999 } : sessao)).rejects.toThrow();
      expect(s.http).toHaveBeenCalledTimes(httpAntes);
      expect(await s.prisma.eventoFiscalSaida.count({ where: { documentoId: c.documentoId, tipo: "CANCELAMENTO_MANUAL_AUTORIZADO" } })).toBe(0);
    } finally { if (caso === "CONFIGURACAO") await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { versao: 1 } }); }
  });
  it("diagnóstico ou troca de credencial posterior não invalida a autorização da mesma empresa", async () => {
    const c = await notaParaCancelar(), httpAntes = s.http.mock.calls.length;
    await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { versao: 2 } }); s.versaoConfiguracao = 2;
    try {
      s.http.mockResolvedValueOnce(response(eventoCancelamento(c.chaveFiscal, c.ambiente)));
      expect(await cancelarNotaPedidoBrasilNfe(c, sessao)).toMatchObject({ status: "CANCELADO" });
      expect(s.http).toHaveBeenCalledTimes(httpAntes + 1);
    } finally { s.versaoConfiguracao = 1; await s.prisma.configuracaoBrasilNfe.update({ where: { id: "singleton" }, data: { versao: 1 } }); }
  });
});
