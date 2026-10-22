import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prepararMigrationHubIsolada, limparIntegracaoHubIsolada } from "../login/migrations-hub-isoladas";
import type { SessaoAtual } from "@/lib/session";
import type { ClassificacaoFiscal, RegraFiscal, SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, hoje: "2026-10-21" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("@/lib/tributacao/validacao", async original => ({ ...await original<typeof import("@/lib/tributacao/validacao")>(), hojeFiscal: () => sim.hoje }));
import { analisarImpactoFiscal, ativarVersaoFiscal, hashFiscal, salvarVersaoFiscal } from "@/lib/tributacao/servico";
import { hashTecnico } from "@/lib/tributacao/fotografia-tecnica";

// Massa exclusivamente sintética. Guarda estrita de host e database antes de escrever.
const esquema = `teste_fci_fornecedor_${randomUUID().replaceAll("-", "")}`;
const controle = "ABCDEF12-3456-7890-ABCD-1234567890AB";
let banco: Client | undefined, criado = false, perfilAdminId: string, perfilOperadorId: string;
let sessao: SessaoAtual, operador: SessaoAtual, produtoId: string, insumoId: string, notaId: string, itemId: string, chave: string, fonteXml: string;
let rede: ReturnType<typeof vi.spyOn>;
function xml() {
  return `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}"><ide><mod>55</mod><tpAmb>1</tpAmb><dhEmi>2026-10-10T10:00:00-03:00</dhEmi></ide><det nItem="1"><prod><cProd>PRODUTO-FICTICIO</cProd><NCM>16010000</NCM><nFCI>${controle}</nFCI></prod><imposto><ICMS><ICMS00><orig>5</orig><CST>00</CST></ICMS00></ICMS></imposto></det></infNFe></NFe><protNFe><infProt><chNFe>${chave}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>`;
}
function entrada(comAnalise = true): SalvarVersaoFiscalEntrada {
  const c: ClassificacaoFiscal = {
    produtoId, grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL", ncm: "16010000", origem: "5", cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Mercadoria e ausência de GTIN exclusivamente sintéticas"], pendencias: [],
    // O cliente tenta fornecer uma fotografia e uma prova válidas na forma, porém falsas.
    fotografiaTecnica: { algoritmo: "grazing.classificacao-fiscal.v1", principalHash: "d".repeat(64), materiais: { algoritmo: "grazing.material-fiscal.v1", insumos: [{ insumoId: "insumo-adulterado-ficticio", hash: "e".repeat(64), transitiva: false }] } },
    fci: { situacao: "EXIGIDA", numero: controle, periodoApuracao: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null, apuracaoCompleta: false, justificativa: "Repasse de FCI exclusivamente sintética da mesma mercadoria, sem CI própria", fontes: ["https://www.gov.br/fonte-exclusivamente-sintetica"], evidencias: ["Entrada conciliada exclusivamente sintética"], repasseFornecedor: { insumoId, registro: { algoritmo: "grazing.fci-fornecedor.v1", natureza: "REVENDA", ncm: "00000000", origem: "8", materiaisHash: "f".repeat(64), documentos: [{ itemId: "item-adulterado-ficticio", numeroItem: 99, xmlHash: "a".repeat(64), dataEmissao: "2020-01-01" }] } } },
    ...(comAnalise ? { ncmAplicabilidade: "APLICAVEL" as const, analiseNcm: { fundamento: "DOCUMENTAL" as const, confianca: "ALTA" as const, descricaoNcm: "Descrição exclusivamente sintética", dataAnalise: sim.hoje, justificativa: "Identidade da mercadoria exclusivamente sintética, sem alteração do NCM da fonte", fontes: ["Ficha exclusivamente sintética"], pendenciasNcm: [] } } : {}),
  };
  return { tipo: "CLASSIFICACAO", chave: produtoId, versaoBase: 0, vigenciaInicio: sim.hoje, dados: c, justificativa: "Repasse sintético de controle do fornecedor, com selo reconstruído pelo servidor", fontes: ["Fonte exclusivamente sintética de teste"], chaveOperacao: randomUUID() };
}
function entradaRegra(): SalvarVersaoFiscalEntrada {
  const tributo = (cst: string) => ({ cst, aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE" as const, justificativa: "Orientação administrativa exclusivamente sintética" });
  const dados: RegraFiscal = { estabelecimento: "singleton", regime: "SIMPLES_NACIONAL", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: "GF05", produtoId: `INSUMO:${insumoId}`, natureza: "FRACIONADO", ncm: "16010000", cfop: "5102", csosn: "102", icms: tributo("00"), pis: tributo("99"), cofins: tributo("99"), ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "MERCADORIA_SINTETICA", reforma: null, seletivo: "NAO_APLICAVEL" };
  return { tipo: "REGRA", chave: `regra-${insumoId}`, versaoBase: 0, vigenciaInicio: sim.hoje, dados, justificativa: "Regra exclusivamente sintética para referência interna individual", fontes: ["Orientação responsável exclusivamente sintética"], chaveOperacao: randomUUID() };
}
async function salvarAtivar(e: SalvarVersaoFiscalEntrada) {
  const salvo = await salvarVersaoFiscal(e, sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
  await ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao);
  return salvo;
}
async function protegidos() {
  return {
    insumo: await sim.prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } }),
    componentes: await sim.prisma.componenteProdutoVenda.findMany({ where: { produtoId } }),
    fonte: await sim.prisma.notaFiscalRecebida.findUniqueOrThrow({ where: { id: notaId }, include: { itens: true, manifestacoes: true } }),
    produto: await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId }, select: { nome: true, preco: true, unidade: true, ativo: true } }),
    documentos: await sim.prisma.documentoFiscalSaida.count(), eventosSaida: await sim.prisma.eventoFiscalSaida.count(),
    pedidos: await sim.prisma.pedidoVenda.count(), estoque: await sim.prisma.movimentacaoEstoque.count(), financeiro: await sim.prisma.lancamentoFinanceiro.count(),
  };
}
async function conferirRecusaAtivacao(id: string, impacto: string) {
  const antes = await protegidos(), produto = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId } });
  await expect(ativarVersaoFiscal(id, impacto, randomUUID(), sessao)).rejects.toThrow(/FCI do fornecedor|prova FCI do fornecedor/);
  expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id } })).status).toBe("RASCUNHO");
  expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: id, tipo: "ATIVACAO" } })).toBe(0);
  expect(await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId } })).toEqual(produto);
  expect(await protegidos()).toEqual(antes);
}

describe.skipIf(process.env.ESTRUTURA_FISCAL_BANCO_TESTE !== "1")("FCI de fornecedor: gravação, selo, ativação e auditoria em SQL isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/teste_estrutura_fiscal") throw new Error("Somente PostgreSQL local teste_estrutura_fiscal é permitido.");
    banco = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 }); await banco.connect();
    if (!["127.0.0.1", "::1"].includes((await banco.query("SELECT host(inet_server_addr()) AS host")).rows[0].host)) throw new Error("Servidor não local.");
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true; await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(await prepararMigrationHubIsolada(banco, esquema, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    perfilAdminId = (await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } })).id;
    perfilOperadorId = (await sim.prisma.perfilAcesso.create({ data: { nome: "Operador exclusivamente sintético", permissoes: { "vendas.fiscal": ["visualizar", "editar"] } } })).id;
  }, 120000);
  beforeEach(async () => {
    rede = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Rede proibida nesta integração sintética"));
    const autor = await sim.prisma.usuario.create({ data: { nome: "Administrador sintético", email: `${randomUUID()}@example.invalid`, senhaHash: "sintetico", perfilAcessoId: perfilAdminId } });
    const leitor = await sim.prisma.usuario.create({ data: { nome: "Operador sintético", email: `${randomUUID()}@example.invalid`, senhaHash: "sintetico", perfilAcessoId: perfilOperadorId } });
    sessao = { userId: autor.id, nome: autor.nome, email: autor.email, versao: 0, admin: true, permissoes: {}, excecoes: {}, perfilNome: "Administrador sintético" };
    operador = { ...sessao, userId: leitor.id, nome: leitor.nome, email: leitor.email, admin: true, perfilNome: "Operador sintético" };
    insumoId = (await sim.prisma.insumo.create({ data: { nome: "Insumo direto exclusivamente sintético", unidade: "KG" } })).id;
    produtoId = (await sim.prisma.produtoVenda.create({ data: { nome: "Porção exclusivamente sintética", unidade: "UN", preco: "12.34", grupoFiscalId: "fiscal-grupo-gf05", fiscal: { ncm: "16010000", preservar: "legado-sintetico" } } })).id;
    await sim.prisma.componenteProdutoVenda.create({ data: { produtoId, insumoId, quantidade: "0.100", unidade: "KG" } });
    chave = randomUUID().replaceAll("-", "").split("").map(c => String(parseInt(c, 16) % 10)).join("").padEnd(44, "0"); fonteXml = xml();
    notaId = (await sim.prisma.notaFiscalRecebida.create({ data: { chaveAcesso: chave, nsu: "000000000000001", tipo: "PROC_NFE", xml: fonteXml } })).id;
    itemId = (await sim.prisma.notaFiscalItem.create({ data: { notaFiscalId: notaId, numeroItem: 1, codigoProdutoFornecedor: "PRODUTO-FICTICIO", descricaoProduto: "Mercadoria exclusivamente sintética", ncm: "16010000", cfop: "5102", unidadeComercial: "KG", quantidadeComercial: "1", valorTotalItem: "10", status: "CONCILIADO", destino: "ESTOQUE", insumoId } })).id;
  });
  afterEach(() => { expect(rede).not.toHaveBeenCalled(); rede.mockRestore(); });
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (!banco) return;
    if (criado && /^teste_fci_fornecedor_[a-f0-9]{32}$/.test(esquema)) { await limparIntegracaoHubIsolada(banco, esquema); await banco.query(`DROP SCHEMA "${esquema}" CASCADE`); }
    await banco.end();
  });

  it.each([true, false])("reconstrói fotografia e selo no servidor, com análise NCM=%s, e ativa com auditoria/idempotência", async comAnalise => {
    const e = entrada(comAnalise), original = structuredClone(e), antes = await protegidos();
    const salvo = await salvarVersaoFiscal(e, sessao);
    expect(await salvarVersaoFiscal(e, sessao)).toEqual(salvo);
    const rascunho = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } }), c = rascunho.dados as unknown as ClassificacaoFiscal;
    expect(rascunho.status).toBe("RASCUNHO"); expect(rascunho.hash).toBe(hashFiscal(c));
    expect(c.fotografiaTecnica!.materiais.insumos.map(i => i.insumoId)).toEqual([insumoId]); expect(c.fotografiaTecnica!.principalHash).not.toBe("d".repeat(64));
    expect(c.fci).toMatchObject({ situacao: "EXIGIDA", numero: controle, apuracaoCompleta: false, periodoApuracao: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null });
    expect(c.fci!.repasseFornecedor).toEqual({ insumoId, registro: { algoritmo: "grazing.fci-fornecedor.v1", natureza: "FRACIONADO", ncm: "16010000", origem: "5", materiaisHash: hashTecnico(c.fotografiaTecnica!.materiais), documentos: [{ itemId, numeroItem: 1, xmlHash: createHash("sha256").update(fonteXml).digest("hex"), dataEmissao: "2026-10-10" }] } });
    const impacto = await analisarImpactoFiscal(salvo.id, sessao), operacao = randomUUID();
    await ativarVersaoFiscal(salvo.id, impacto.hash, operacao, sessao); await ativarVersaoFiscal(salvo.id, impacto.hash, operacao, sessao);
    const ativa = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } });
    expect(ativa).toEqual({ ...rascunho, status: "ATIVO" });
    const eventos = await sim.prisma.eventoEstruturaFiscal.findMany({ where: { versaoId: salvo.id }, orderBy: { createdAt: "asc" } });
    expect(eventos.map(v => v.tipo)).toEqual(["RASCUNHO", "IMPACTO", "ATIVACAO"]); expect(eventos.every(v => v.usuarioId === sessao.userId)).toBe(true);
    expect(eventos[2].dados).toMatchObject({ hashImpacto: impacto.hash, hashConteudo: ativa.hash });
    expect(await protegidos()).toEqual(antes); expect(e).toEqual(original);
    expect((await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId } })).fiscal).toMatchObject({ ncm: "16010000", preservar: "legado-sintetico" });
  });

  it("recusa na ativação um XML alterado após o rascunho, mesmo mantendo os dados fiscais", async () => {
    const salvo = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    await sim.prisma.notaFiscalRecebida.update({ where: { id: notaId }, data: { xml: `${fonteXml}\n` } });
    await conferirRecusaAtivacao(salvo.id, impacto.hash);
  });

  it("o banco recusa adulteração do selo na versão fiscal imutável", async () => {
    const salvo = await salvarVersaoFiscal(entrada(), sessao);
    const v = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } }), c = structuredClone(v.dados) as unknown as ClassificacaoFiscal;
    c.fci!.repasseFornecedor!.registro!.materiaisHash = "f".repeat(64);
    await expect(sim.prisma.versaoEstruturaFiscal.update({ where: { id: salvo.id }, data: { dados: JSON.parse(JSON.stringify(c)) } })).rejects.toThrow("Conteúdo fiscal imutável");
    expect(await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } })).toEqual(v);
  });

  it("recusa na ativação se uma nova fonte conciliada modificar a prova selada", async () => {
    const salvo = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    const chaveAnterior = chave; chave = "2".repeat(44); const outraFonte = xml(); chave = chaveAnterior;
    const outraNota = await sim.prisma.notaFiscalRecebida.create({ data: { chaveAcesso: "2".repeat(44), nsu: "000000000000002", tipo: "PROC_NFE", xml: outraFonte } });
    await sim.prisma.notaFiscalItem.create({ data: { notaFiscalId: outraNota.id, numeroItem: 1, codigoProdutoFornecedor: "PRODUTO-FICTICIO", descricaoProduto: "Mesma mercadoria exclusivamente sintética", ncm: "16010000", cfop: "5102", unidadeComercial: "KG", quantidadeComercial: "1", valorTotalItem: "10", status: "CONCILIADO", destino: "ESTOQUE", insumoId } });
    await conferirRecusaAtivacao(salvo.id, impacto.hash);
  });

  it("reconfere a conciliação da fonte antes de ativar", async () => {
    const salvo = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    await sim.prisma.notaFiscalItem.update({ where: { id: itemId }, data: { status: "PENDENTE" } });
    await conferirRecusaAtivacao(salvo.id, impacto.hash);
  });

  it("recusa manifestação real do enum de desconhecimento sem deixar rascunho ou auditoria parcial", async () => {
    await sim.prisma.manifestacaoNFe.create({ data: { notaFiscalId: notaId, tipo: "DESCONHECIMENTO_DA_OPERACAO", sucesso: true } });
    const antes = await protegidos(), versoes = await sim.prisma.versaoEstruturaFiscal.count(), eventos = await sim.prisma.eventoEstruturaFiscal.count();
    await expect(salvarVersaoFiscal(entrada(), sessao)).rejects.toThrow(/manifestação incompatível/);
    expect(await sim.prisma.versaoEstruturaFiscal.count()).toBe(versoes); expect(await sim.prisma.eventoEstruturaFiscal.count()).toBe(eventos); expect(await protegidos()).toEqual(antes);
  });

  it("preserva autorização central contra flag admin forjada e sessão revogada", async () => {
    const e = entrada(), antes = await protegidos();
    await expect(salvarVersaoFiscal(e, operador)).rejects.toThrow("acesso");
    expect(await sim.prisma.versaoEstruturaFiscal.count({ where: { chave: produtoId } })).toBe(0);
    const salvo = await salvarVersaoFiscal(e, sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    await expect(analisarImpactoFiscal(salvo.id, operador)).rejects.toThrow("acesso"); await expect(ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), operador)).rejects.toThrow("acesso");
    await sim.prisma.usuario.update({ where: { id: sessao.userId }, data: { sessaoVersao: 1 } });
    await expect(ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("sessão");
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } })).status).toBe("RASCUNHO"); expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: salvo.id, tipo: "ATIVACAO" } })).toBe(0); expect(await protegidos()).toEqual(antes);
  });

  it("ativa regra de referência interna e limita o impacto ao kit que contém essa identidade", async () => {
    const e = entrada(), interna = e.dados as ClassificacaoFiscal;
    interna.produtoId = null; interna.referenciaInternaInsumoId = insumoId; interna.unidade = "KG"; e.chave = `INSUMO:${insumoId}`;
    const referencia = await salvarAtivar(e), antes = await protegidos();
    const kit = await sim.prisma.produtoVenda.create({ data: { nome: "Kit dependente exclusivamente sintético", unidade: "UN", preco: "20" } });
    const outro = await sim.prisma.produtoVenda.create({ data: { nome: "Kit independente exclusivamente sintético", unidade: "UN", preco: "30" } });
    for (const p of [kit, outro]) {
      const dados: ClassificacaoFiscal = { produtoId: p.id, grupo: "GF06", natureza: "REVENDA", tratamento: "KIT_COMPOSTO", ncm: null, origem: null, cest: null, unidade: "UN", gtin: "SEM GTIN", estado: "CONFIRMADO", evidencias: ["Decomposição exclusivamente sintética"], pendencias: [], componentesKit: [p.id === kit.id ? { referenciaInternaInsumoId: insumoId, descricao: "Mercadoria interna sintética", unidade: "KG", quantidade: "0.1", pesoRateio: "1" } : { produtoId, quantidade: "1", pesoRateio: "1" }] };
      await salvarAtivar({ tipo: "CLASSIFICACAO", chave: p.id, versaoBase: 0, vigenciaInicio: sim.hoje, dados, justificativa: "Política de kit exclusivamente sintética para testar alcance", fontes: ["Ficha sintética"], chaveOperacao: randomUUID() });
    }
    const regra = entradaRegra(), salvo = await salvarVersaoFiscal(regra, sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    expect(impacto.produtos.map(p => p.id)).toEqual([kit.id]); expect(impacto.produtosAfetados).toBe(1);
    await ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao);
    const persistida = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } });
    expect(persistida.status).toBe("ATIVO"); expect(persistida.dados).toEqual(regra.dados);
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: referencia.id } })).status).toBe("ATIVO");
    expect((await sim.prisma.eventoEstruturaFiscal.findMany({ where: { versaoId: salvo.id }, orderBy: { createdAt: "asc" } })).map(e => e.tipo)).toEqual(["RASCUNHO", "IMPACTO", "ATIVACAO"]);
    expect(await protegidos()).toEqual(antes);
  });

  it.each(["inativo", "excluido", "inexistente"])("recusa salvar regra com insumo %s sem auditoria parcial", async estado => {
    const e = entradaRegra();
    if (estado === "inexistente") (e.dados as RegraFiscal).produtoId = "INSUMO:referencia-inexistente-ficticia";
    else await sim.prisma.insumo.update({ where: { id: insumoId }, data: estado === "inativo" ? { ativo: false } : { excluidoEm: new Date() } });
    const antes = await protegidos(), versoes = await sim.prisma.versaoEstruturaFiscal.count(), eventos = await sim.prisma.eventoEstruturaFiscal.count();
    await expect(salvarVersaoFiscal(e, sessao)).rejects.toThrow(/Referência interna da regra inexistente, inativa ou excluída/);
    expect(await sim.prisma.versaoEstruturaFiscal.count()).toBe(versoes); expect(await sim.prisma.eventoEstruturaFiscal.count()).toBe(eventos); expect(await protegidos()).toEqual(antes);
  });

  it.each(["inativo", "excluido"])("reconfere o insumo %s antes de ativar a regra", async estado => {
    const salvo = await salvarVersaoFiscal(entradaRegra(), sessao), impacto = await analisarImpactoFiscal(salvo.id, sessao);
    await sim.prisma.insumo.update({ where: { id: insumoId }, data: estado === "inativo" ? { ativo: false } : { excluidoEm: new Date() } });
    const antes = await protegidos(), eventos = await sim.prisma.eventoEstruturaFiscal.count();
    await expect(ativarVersaoFiscal(salvo.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow(/Referência interna da regra inexistente, inativa ou excluída/);
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: salvo.id } })).status).toBe("RASCUNHO");
    expect(await sim.prisma.eventoEstruturaFiscal.count()).toBe(eventos); expect(await protegidos()).toEqual(antes);
  });
});
