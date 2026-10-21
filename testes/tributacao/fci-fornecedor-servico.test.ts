import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import type { ClassificacaoFiscal, DecisaoFciFiscal } from "@/lib/tributacao/tipos";

vi.mock("server-only", () => ({}));
import { conferirRepasseFciFornecedor } from "@/lib/tributacao/fci-fornecedor";
import { hashTecnico } from "@/lib/tributacao/fotografia-tecnica";

// Todos os identificadores, controles, documentos e materiais são fictícios.
// A massa não abre banco, importa notas nem consulta qualquer serviço externo.
const controle = "ABCDEF12-3456-7890-ABCD-1234567890AB";
const controleDiferente = "ABCDEF12-3456-7890-ABCD-1234567890AC";
const chave = "1".repeat(44);
const data = "2026-10-21";
const insumoId = "insumo-direto-exclusivamente-ficticio";
type XmlOpcoes = Partial<{ numero: string; ncm: string; origem: string; codigo: string; numeroItem: number; emissao: string; modelo: string; ambiente: string; cstat: string; chaveProtocolo: string; identificador: string; duplicarItem: boolean; duplicarIcms: boolean }>;
function xml(o: XmlOpcoes = {}) {
  const p = { numero: controle, ncm: "16010000", origem: "5", codigo: "PRODUTO-FICTICIO", numeroItem: 1, emissao: "2026-10-10T10:00:00-03:00", modelo: "55", ambiente: "1", cstat: "100", chaveProtocolo: chave, identificador: `NFe${chave}`, ...o };
  const det = `<det nItem="${p.numeroItem}"><prod><cProd>${p.codigo}</cProd><NCM>${p.ncm}</NCM>${p.numero ? `<nFCI>${p.numero}</nFCI>` : ""}</prod><imposto><ICMS><ICMS00><orig>${p.origem}</orig><CST>00</CST></ICMS00>${p.duplicarIcms ? "<ICMS20><orig>5</orig><CST>20</CST></ICMS20>" : ""}</ICMS></imposto></det>`;
  return `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="${p.identificador}"><ide><mod>${p.modelo}</mod><tpAmb>${p.ambiente}</tpAmb><dhEmi>${p.emissao}</dhEmi></ide>${det}${p.duplicarItem ? det : ""}</infNFe></NFe><protNFe><infProt><chNFe>${p.chaveProtocolo}</chNFe><cStat>${p.cstat}</cStat></infProt></protNFe></nfeProc>`;
}
function classificacao(): ClassificacaoFiscal {
  return {
    produtoId: "mercadoria-exclusivamente-ficticia", grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL", ncm: "16010000", origem: "5", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Identidade exclusivamente sintética"], pendencias: [],
    fotografiaTecnica: { algoritmo: "grazing.classificacao-fiscal.v1", principalHash: "a".repeat(64), materiais: { algoritmo: "grazing.material-fiscal.v1", insumos: [{ insumoId, hash: "b".repeat(64), transitiva: false }] } },
    fci: { situacao: "EXIGIDA", numero: controle, periodoApuracao: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null, apuracaoCompleta: false, justificativa: "Repasse do controle fictício documentado pelo fornecedor, sem CI própria", fontes: ["https://www.gov.br/fonte-exclusivamente-sintetica"], evidencias: ["Entrada sintética conciliada"], repasseFornecedor: { insumoId } },
  };
}
function item(opcoes: XmlOpcoes = {}) {
  return { id: "item-conciliado-ficticio", insumoId, numeroItem: 1, codigoProdutoFornecedor: "PRODUTO-FICTICIO", ncm: "16010000", notaFiscal: { chaveAcesso: chave, xml: xml(opcoes) as string | null, manifestacoes: [] as { tipo: string }[] } };
}
type Item = ReturnType<typeof item>;
function banco(itens: Item[] = [item()]) {
  const findMany = vi.fn(async () => itens);
  const escrever = vi.fn(() => { throw new Error("Efeito de escrita proibido nesta conferência"); });
  const cliente = {
    notaFiscalItem: { findMany, create: escrever, update: escrever, updateMany: escrever, delete: escrever },
    notaFiscalRecebida: { update: escrever, create: escrever }, insumo: { update: escrever }, movimentacaoEstoque: { create: escrever },
    versaoEstruturaFiscal: { create: escrever, update: escrever }, eventoEstruturaFiscal: { create: escrever },
    $executeRaw: escrever, $executeRawUnsafe: escrever, $transaction: escrever,
  } as unknown as Prisma.TransactionClient;
  return { cliente, findMany, escrever };
}

describe("Repasse da FCI do fornecedor por leitura de entradas sintéticas", () => {
  let chamadaExterna: ReturnType<typeof vi.fn>;
  beforeEach(() => { chamadaExterna = vi.fn(() => { throw new Error("Consulta externa proibida"); }); vi.stubGlobal("fetch", chamadaExterna); });
  afterEach(() => { expect(chamadaExterna).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

  it.each(["FRACIONADO", "REVENDA"] as const)("reconstrói a prova de %s sem apuração de CI ou alteração da origem", async natureza => {
    const c = classificacao(); c.natureza = natureza;
    const primeiro = item(), segundo = item({ emissao: "2026-10-15T11:30:00-03:00" }); segundo.id = "outro-item-ficticio";
    const entradas = [primeiro, segundo], antes = structuredClone({ c, entradas }), tx = banco(entradas);
    const r = await conferirRepasseFciFornecedor(tx.cliente, c, data);
    expect(r).toEqual({ insumoId, registro: { algoritmo: "grazing.fci-fornecedor.v1", natureza, ncm: "16010000", origem: "5", materiaisHash: hashTecnico(c.fotografiaTecnica!.materiais), documentos: entradas.map(i => ({ itemId: i.id, numeroItem: i.numeroItem, xmlHash: createHash("sha256").update(i.notaFiscal.xml!).digest("hex"), dataEmissao: i.id === primeiro.id ? "2026-10-10" : "2026-10-15" })) } });
    expect({ c, entradas }).toEqual(antes); expect(tx.escrever).not.toHaveBeenCalled(); expect(tx.findMany).toHaveBeenCalledTimes(1);
    expect(tx.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { insumoId, status: "CONCILIADO", destino: "ESTOQUE", notaFiscal: { tipo: "PROC_NFE" } }, take: 101 }));
  });

  it("ignora o registro fornecido pelo cliente e reconstrói hashes e documentos no servidor", async () => {
    const c = classificacao();
    c.fci!.repasseFornecedor!.registro = { algoritmo: "grazing.fci-fornecedor.v1", natureza: "REVENDA", ncm: "00000000", origem: "8", materiaisHash: "c".repeat(64), documentos: [{ itemId: "item-adulterado-ficticio", numeroItem: 99, xmlHash: "d".repeat(64), dataEmissao: "2020-01-01" }] };
    const r = await conferirRepasseFciFornecedor(banco().cliente, c, data);
    expect(r.registro).toMatchObject({ natureza: "FRACIONADO", ncm: "16010000", origem: "5", materiaisHash: hashTecnico(c.fotografiaTecnica!.materiais) });
    expect(r.registro!.documentos[0]).toMatchObject({ itemId: "item-conciliado-ficticio", numeroItem: 1, dataEmissao: "2026-10-10" });
    expect(r.registro!.documentos[0].xmlHash).not.toBe("d".repeat(64));
  });

  it("aceita a emissão oficial no mesmo dia da vigência e normaliza apenas a caixa do controle", async () => {
    const r = await conferirRepasseFciFornecedor(banco([item({ emissao: `${data}T23:59:59-03:00`, numero: controle.toLowerCase() })]).cliente, classificacao(), data);
    expect(r.registro!.documentos[0].dataEmissao).toBe(data);
  });

  it.each(["3", "8"])("preserva também a origem recebida %s sem inferir faixa ou valores de CI", async origem => {
    const c = classificacao(); c.origem = origem;
    const r = await conferirRepasseFciFornecedor(banco([item({ origem })]).cliente, c, data);
    expect(r.registro!.origem).toBe(origem); expect(c.fci!.apuracaoCompleta).toBe(false); expect(c.fci!.conteudoImportacao).toBeNull();
  });

  it.each([
    ["sem decisão", (c: ClassificacaoFiscal) => { delete c.fci; }],
    ["sem pedido explícito de repasse", (c: ClassificacaoFiscal) => { delete c.fci!.repasseFornecedor; }],
    ["sem número de controle", (c: ClassificacaoFiscal) => { c.fci!.numero = null; }],
    ["decisão pendente", (c: ClassificacaoFiscal) => { c.fci!.situacao = "PENDENTE"; }],
    ["preparação própria", (c: ClassificacaoFiscal) => { c.natureza = "PREPARADO"; }],
    ["serviço", (c: ClassificacaoFiscal) => { c.natureza = "SERVICO"; }],
    ["cabeçalho de kit", (c: ClassificacaoFiscal) => { c.tratamento = "KIT_COMPOSTO"; }],
    ["opção de configuração", (c: ClassificacaoFiscal) => { c.tratamento = "OPCAO_CONFIGURACAO"; }],
    ["configuração por escolhas", (c: ClassificacaoFiscal) => { c.configuracaoNcm = {} as NonNullable<ClassificacaoFiscal["configuracaoNcm"]>; }],
    ["sem NCM", (c: ClassificacaoFiscal) => { c.ncm = null; }],
    ["origem nacional sem CI", (c: ClassificacaoFiscal) => { c.origem = "0"; }],
    ["sem fotografia", (c: ClassificacaoFiscal) => { delete c.fotografiaTecnica; }],
    ["sem materiais", (c: ClassificacaoFiscal) => { c.fotografiaTecnica!.materiais.insumos = []; }],
    ["receita com dois materiais", (c: ClassificacaoFiscal) => { c.fotografiaTecnica!.materiais.insumos.push({ insumoId: "segundo-insumo-ficticio", hash: "e".repeat(64), transitiva: false }); }],
    ["preparação transitiva", (c: ClassificacaoFiscal) => { c.fotografiaTecnica!.materiais.insumos[0].transitiva = true; }],
    ["insumo diferente do material", (c: ClassificacaoFiscal) => { c.fci!.repasseFornecedor!.insumoId = "outro-insumo-ficticio"; }],
  ] as const)("recusa %s antes de consultar entradas", async (_nome, alterar) => {
    const c = classificacao(), tx = banco(); alterar(c);
    await expect(conferirRepasseFciFornecedor(tx.cliente, c, data)).rejects.toThrow("FCI do fornecedor");
    expect(tx.findMany).not.toHaveBeenCalled(); expect(tx.escrever).not.toHaveBeenCalled();
  });

  it.each([
    { apuracaoCompleta: true }, { periodoApuracao: "2026-09" }, { conteudoImportacao: "20" }, { valorParcelaImportada: "2" }, { valorSaidaReferencia: "10" },
  ] satisfies Partial<DecisaoFciFiscal>[])("recusa memória de CI própria misturada ao repasse: %j", async alteracoes => {
    const c = classificacao(); Object.assign(c.fci!, alteracoes);
    await expect(conferirRepasseFciFornecedor(banco().cliente, c, data)).rejects.toThrow("FCI do fornecedor");
  });

  it.each([0, 101])("recusa quantidade de entradas fora do alcance seguro: %s", async quantidade => {
    const tx = banco(Array.from({ length: quantidade }, () => item()));
    await expect(conferirRepasseFciFornecedor(tx.cliente, classificacao(), data)).rejects.toThrow(/ausentes|limite/);
    expect(tx.escrever).not.toHaveBeenCalled();
  });

  it.each([
    ["homologação", { ambiente: "2" }], ["NFC-e recebida", { modelo: "65" }], ["protocolo não autorizado", { cstat: "101" }],
    ["chave divergente no protocolo", { chaveProtocolo: "2".repeat(44) }], ["identidade divergente no infNFe", { identificador: `NFe${"2".repeat(44)}` }],
    ["item ausente no XML", { numeroItem: 2 }], ["item duplicado no XML", { duplicarItem: true }], ["grupos ICMS duplicados", { duplicarIcms: true }],
    ["código diferente do cache", { codigo: "OUTRO-CODIGO-FICTICIO" }], ["NCM diferente da mercadoria", { ncm: "16024900" }], ["origem diferente da mercadoria", { origem: "3" }],
    ["FCI ausente", { numero: "" }], ["FCI inválida", { numero: "controle-invalido" }], ["FCI com todos os dígitos zero", { numero: "00000000-0000-0000-0000-000000000000" }], ["controle diferente do aprovado", { numero: controleDiferente }],
    ["data oficial ausente", { emissao: "" }], ["data civil impossível", { emissao: "2026-02-30T10:00:00-03:00" }],
  ] satisfies [string, XmlOpcoes][])("recusa XML com %s", async (_nome, opcoes) => {
    const tx = banco([item(opcoes)]);
    await expect(conferirRepasseFciFornecedor(tx.cliente, classificacao(), data)).rejects.toThrow("FCI do fornecedor");
    expect(tx.escrever).not.toHaveBeenCalled();
  });

  it("recusa controles distintos nas entradas do mesmo insumo, sem escolher o primeiro", async () => {
    const outro = item({ numero: controleDiferente }); outro.id = "outro-item-ficticio";
    await expect(conferirRepasseFciFornecedor(banco([item(), outro]).cliente, classificacao(), data)).rejects.toThrow(/divergente/);
  });

  it("informa a divergência sem reproduzir chave, XML ou controle do fornecedor no erro", async () => {
    const tx = banco([item({ numero: controleDiferente })]);
    const erro = await conferirRepasseFciFornecedor(tx.cliente, classificacao(), data).catch(e => e as Error);
    expect(erro).toBeInstanceOf(Error);
    const mensagem = (erro as Error).message;
    expect(mensagem).toContain("controle FCI");
    for (const proibido of [chave, controle, controleDiferente, "<nfeProc", "PRODUTO-FICTICIO"]) expect(mensagem).not.toContain(proibido);
  });

  it("não usa fonte posterior nem datas cadastrais no lugar da emissão oficial", async () => {
    const futuro = item({ emissao: "2026-10-22T00:00:00-03:00" });
    await expect(conferirRepasseFciFornecedor(banco([futuro]).cliente, classificacao(), data)).rejects.toThrow(/anterior à vigência/);
    const semData = item({ emissao: "" });
    Object.assign(semData.notaFiscal, { dataEmissao: new Date("2026-10-01"), createdAt: new Date("2026-10-01"), updatedAt: new Date("2026-10-01") });
    await expect(conferirRepasseFciFornecedor(banco([semData]).cliente, classificacao(), data)).rejects.toThrow(/data oficial/);
  });

  it("exclui fonte posterior do registro sem mascarar as provas anteriores", async () => {
    const futuro = item({ emissao: "2026-10-22T00:00:00-03:00", numero: controleDiferente }); futuro.id = "item-futuro-ficticio";
    const r = await conferirRepasseFciFornecedor(banco([item(), futuro]).cliente, classificacao(), data);
    expect(r.registro!.documentos.map(i => i.itemId)).toEqual(["item-conciliado-ficticio"]);
  });

  it.each(["OPERACAO_NAO_REALIZADA", "DESCONHECIMENTO_DA_OPERACAO"])("recusa manifestação incompatível: %s", async tipo => {
    const i = item(); i.notaFiscal.manifestacoes = [{ tipo }];
    await expect(conferirRepasseFciFornecedor(banco([i]).cliente, classificacao(), data)).rejects.toThrow(/manifestação incompatível/);
  });

  it("confere novamente o vínculo do insumo e o NCM do cache", async () => {
    const outro = item(); outro.insumoId = "insumo-nao-vinculado-ficticio";
    await expect(conferirRepasseFciFornecedor(banco([outro]).cliente, classificacao(), data)).rejects.toThrow(/entrada vinculada/);
    const cacheDivergente = item(); cacheDivergente.ncm = "16024900";
    await expect(conferirRepasseFciFornecedor(banco([cacheDivergente]).cliente, classificacao(), data)).rejects.toThrow(/divergem/);
  });

  it.each([null, "<nfeProc>", "<!DOCTYPE nfeProc><nfeProc/>", '<!ENTITY segredo SYSTEM "https://example.invalid/nao-consultar"><nfeProc/>', "x".repeat(15_000_001)])("recusa fonte ausente, ilegível ou não segura %#", async fonte => {
    const i = item(); i.notaFiscal.xml = fonte;
    await expect(conferirRepasseFciFornecedor(banco([i]).cliente, classificacao(), data)).rejects.toThrow(/XML completo e legível/);
  });
});
