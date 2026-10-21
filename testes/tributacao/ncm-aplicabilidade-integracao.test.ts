import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";
import type { ClassificacaoFiscal, ComportamentoFiscal, SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, hoje: "2026-10-12", criarConexaoCli: null as null | (() => PrismaClient) }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; }, get bancoPrincipal() { if (!sim.criarConexaoCli) throw new Error("CLI somente com conexão fictícia explicitamente preparada."); return sim.criarConexaoCli(); } }));
vi.mock("@/lib/tributacao/validacao", async importar => ({ ...await importar<typeof import("@/lib/tributacao/validacao")>(), hojeFiscal: () => sim.hoje }));
import { analisarImpactoFiscal, ativarVersaoFiscal, consultarPainelFiscal, converterTabelaNcmOficial, salvarVersaoFiscal } from "@/lib/tributacao/servico";
import { salvarFiscalProduto, salvarGrupoFiscal, salvarProduto } from "@/lib/vendas/persistencia";
import { itensParaTributacao } from "@/lib/tributacao/pedidos";
import { calcularPedido, obterPedido } from "@/lib/vendas/pedidos";
import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";
import { aplicarLoteClassificacaoFiscal, preverLoteClassificacaoFiscal, type LoteClassificacaoFiscal } from "@/lib/tributacao/lote-classificacao";
import type { TabelaFiscal } from "@/lib/tributacao/tipos";
import { fotografarClassificacaoNormal, fotografarReceitaFiscal, hashReceitaDocumentada } from "@/lib/tributacao/fotografia-tecnica";
import { conferirPoliticaKit } from "@/lib/tributacao/fotografia-kit";
import { fotografarMateriais } from "@/lib/tributacao/receita-material";
import { resolverNcmConfiguracao } from "@/lib/tributacao/ncm-configuracao";
import { executarCliClassificacao } from "../../scripts/estrutura-fiscal-classificacao-catalogo";

const schema = `teste_aplicabilidade_fiscal_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, criado = false, sessao: SessaoAtual, produtoId: string, perfilId: string;
const legado = { ncm: "19059090", cfop: "5102", cest: "1234567", ean: "SEM GTIN", observacoes: "Nota anterior fictícia" };
function classificacao(id: string | null = produtoId, extra: Partial<ClassificacaoFiscal> = {}): ClassificacaoFiscal {
  return { produtoId: id, grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL", ncm: "08061000", origem: "0", cest: null, unidade: "UN", estado: "PENDENTE", evidencias: ["Documento exclusivamente fictício"], pendencias: ["ICMS da operação ainda não configurado"], ncmAplicabilidade: "APLICAVEL", analiseNcm: { fundamento: "DOCUMENTAL", confianca: "ALTA", descricaoNcm: "Uvas frescas — descrição sintética", dataAnalise: sim.hoje, justificativa: "Identidade da mercadoria exclusivamente sintética comprovada no documento de teste", fontes: ["documento-ficticio"], pendenciasNcm: [] }, ...extra };
}
function entrada(c = classificacao(), vigencia = sim.hoje): SalvarVersaoFiscalEntrada {
  return { tipo: "CLASSIFICACAO", chave: c.produtoId ?? `INSUMO:${c.referenciaInternaInsumoId}`, versaoBase: 0, vigenciaInicio: vigencia, dados: c, justificativa: "Análise exclusivamente sintética", fontes: ["documento-ficticio"], chaveOperacao: randomUUID() };
}
async function ativar(d = entrada()) {
  const v = await salvarVersaoFiscal(d, sessao), impacto = await analisarImpactoFiscal(v.id, sessao), chave = randomUUID();
  await ativarVersaoFiscal(v.id, impacto.hash, chave, sessao);
  return { ...v, impacto, chave };
}
async function fiscalTexto(id = produtoId) { return (await banco!.query(`SELECT fiscal::text AS fiscal,versao,"grupoFiscalId","fiscalRevisado" FROM "ProdutoVenda" WHERE id=$1`, [id])).rows[0]; }
async function integrarOpcao(opcaoId: string) { await ativar({ ...entrada(), tipo: "COMPLEMENTO", chave: opcaoId, dados: { opcaoId, produtoId: null, comportamento: "INTEGRADO", justificativa: "Integração de escolha documentada exclusivamente fictícia" } }); }
async function pedidoNovo(id: string, escolhas: Record<string, number> = {}, quantidade = "1") {
  const cliente = await sim.prisma.clienteVenda.create({ data: { nome: "Cliente exclusivamente fictício", tipo: "PF" } }), canal = await sim.prisma.canalVenda.create({ data: { nome: `Canal sintético ${randomUUID()}` } });
  const entrada = validarEntradaPedido({ clienteId: cliente.id, canalId: canal.id, atendimento: "RETIRADA", prazo: "IMEDIATO", desconto: "0", frete: "0", itens: [{ produtoId: id, quantidade, escolhas, precoManual: null }] });
  const calculado = await sim.prisma.$transaction(tx => calcularPedido(tx, entrada));
  const { itens, ...dados } = calculado;
  return sim.prisma.pedidoVenda.create({ data: { ...dados, chaveCriacao: randomUUID(), hashCriacao: "ficticio", criadoPorId: sessao.userId, itens: { create: itens.map(i => ({ ...i, versaoPedido: 1 })) } }, include: { itens: true } });
}
async function opcaoUso(comportamento: ComportamentoFiscal["comportamento"] | null, preco = "0") {
  await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { classificacao: "OPCAO", classificacoes: ["OPCAO"] } });
  const principal = await sim.prisma.produtoVenda.create({ data: { nome: "Principal exclusivamente fictício" } });
  const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Escolhas fictícias ${randomUUID()}`, produtos: { create: { produtoId: principal.id } }, opcoes: { create: { nome: "Escolha fictícia", produtoId, preco } } }, include: { opcoes: true } });
  const opcao = grupo.opcoes[0];
  if (comportamento) await ativar({ ...entrada(), tipo: "COMPLEMENTO", chave: opcao.id, dados: { opcaoId: opcao.id, comportamento, produtoId: comportamento === "MERCADORIA" ? produtoId : null, justificativa: "Vínculo exclusivamente sintético ao produto principal" } });
  return { principal, grupo, opcao };
}
function configuracao(): ClassificacaoFiscal {
  const c = classificacao(); return { ...c, ncm: null, tratamento: "OPCAO_CONFIGURACAO", estado: "CONFIRMADO", pendencias: [], ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: { ...c.analiseNcm!, descricaoNcm: null, justificativa: "Escolha exclusivamente integrada ao principal, sem mercadoria independente" } };
}
const tabelaFicticia: TabelaFiscal = { tabela: "NCM", completa: true, referencia: "Tabela integral exclusivamente fictícia", linhas: ["08061000", "19059090", "19053100"].map(codigo => ({ codigo, descricao: "Descrição de fixture" })) };
async function lote(c = classificacao()): Promise<LoteClassificacaoFiscal> {
  const anterior = await sim.prisma.versaoEstruturaFiscal.findFirst({ where: { tipo: "TABELA", chave: "NCM" }, orderBy: { versao: "desc" } });
  const r = entrada(c);
  return { loteId: `lote-${randomUUID()}`, vigenciaInicio: sim.hoje, registros: [r, { ...r, tipo: "TABELA", chave: "NCM", versaoBase: anterior?.versao ?? 0, dados: tabelaFicticia, fontes: ["https://portalunico.siscomex.gov.br/classif/api/publico/nomenclatura/download/json", "Valores exclusivamente sintéticos; nenhuma consulta externa neste teste"] }] };
}

describe.skipIf(process.env.ESTRUTURA_FISCAL_BANCO_TESTE !== "1")("Aplicabilidade NCM nos serviços e cadastros, PostgreSQL fictício isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/teste_estrutura_fiscal") throw new Error("Somente PostgreSQL local teste_estrutura_fiscal.");
    banco = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 }); await banco.connect();
    if (!["127.0.0.1", "::1"].includes((await banco.query("SELECT host(inet_server_addr()) AS host")).rows[0].host)) throw new Error("Servidor fictício não local.");
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    perfilId = (await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } })).id;
    await sim.prisma.grupoFiscalVenda.create({ data: { id: "aux-kit-ficticio", codigo: "KIT_COMPOSTO", nome: "Kit auxiliar fictício" } });
  }, 120000);
  beforeEach(async () => {
    const u = await sim.prisma.usuario.create({ data: { nome: "Administrador fictício", email: `${randomUUID()}@example.invalid`, senhaHash: "sem-login", perfilAcessoId: perfilId } });
    sessao = { userId: u.id, nome: u.nome, email: u.email, versao: 0, admin: true, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    produtoId = (await sim.prisma.produtoVenda.create({ data: { nome: "Produto exclusivamente fictício", fiscal: legado, fiscalRevisado: true, grupoFiscalId: "fiscal-grupo-gf05", versao: 3 } })).id;
  });
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (criado && /^teste_aplicabilidade_fiscal_[a-f0-9]{32}$/.test(schema)) await banco!.query(`DROP SCHEMA "${schema}" CASCADE`);
    await banco?.end();
  });

  it("NCM concluído com pendência operacional sincroniza na ativação e preserva JSONB, tributos e documentos", async () => {
    await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=fiscal || '{"inteiroAntigo":9007199254740993,"decimalAntigo":1.1234567890123456789}'::jsonb WHERE id=$1`, [produtoId]);
    const pedido = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "ficticio", criadoPorId: sessao.userId } });
    const doc = await sim.prisma.documentoFiscalSaida.create({ data: { pedidoId: pedido.id, versaoPedido: 1, payload: { historico: "intacto" }, hashPayload: "ficticio", criadoPorId: sessao.userId, criadoPorNome: sessao.nome } });
    const documentoAntes = await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: doc.id } });
    const v = await ativar(); const p = await fiscalTexto();
    expect(JSON.parse(p.fiscal)).toMatchObject({ cfop: legado.cfop, cest: legado.cest, ean: legado.ean, ncm: "08061000", ncmAplicabilidade: "APLICAVEL", ncmConfianca: "ALTA", ncmClassificacaoVersaoId: v.id });
    expect(JSON.parse(p.fiscal).observacoes.startsWith(`${legado.observacoes}\n\n`)).toBe(true);
    expect(p.fiscal).toContain("9007199254740993"); expect(p.fiscal).toContain("1.1234567890123456789"); expect(p.versao).toBe(4); expect(p.fiscalRevisado).toBe(true);
    const fotos = (await banco!.query(`SELECT antes#>>'{fiscal,inteiroAntigo}' AS antes,depois#>>'{fiscal,inteiroAntigo}' AS depois FROM "HistoricoCadastroVenda" WHERE entidade='FISCAL' AND "registroId"=$1`, [produtoId])).rows;
    expect(fotos).toEqual([{ antes: "9007199254740993", depois: "9007199254740993" }]);
    expect(await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: doc.id } })).toEqual(documentoAntes);
    expect(await sim.prisma.atividadeUsuario.count({ where: { autorId: sessao.userId, fonteTabela: "HistoricoCadastroVenda", recurso: "vendas.fiscal" } })).toBe(1);
    await ativarVersaoFiscal(v.id, v.impacto.hash, v.chave, sessao); expect((await fiscalTexto()).versao).toBe(4);
  });
  it("revisões de pendências não repetem a mesma análise nem esgotam observações; cada versão mantém auditoria", async () => {
    const c = classificacao(); const primeira = await ativar(entrada(c));
    const nota = JSON.parse((await fiscalTexto()).fiscal).observacoes as string;
    const observacoes = `${"Nota manual preservada. ".repeat(76)}\n\n${nota}`;
    expect(observacoes.length).toBeLessThanOrEqual(2000);
    expect(observacoes.length + c.analiseNcm!.justificativa.length + 50).toBeGreaterThan(2000);
    await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=jsonb_set(fiscal,'{observacoes}',to_jsonb($2::text)) WHERE id=$1`, [produtoId, observacoes]);
    const historica = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: primeira.id } });
    for (let versaoBase = 1; versaoBase <= 3; versaoBase++) {
      const nova = await ativar({ ...entrada({ ...c, pendencias: [] }), versaoBase });
      const atual = await fiscalTexto();
      expect(JSON.parse(atual.fiscal)).toMatchObject({ observacoes, ncm: "08061000", ncmClassificacaoVersaoId: nova.id });
      expect(atual.versao).toBe(4 + versaoBase);
      expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: nova.id, tipo: "ATIVACAO" } })).toBe(1);
    }
    expect(await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: primeira.id } })).toEqual(historica);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { entidade: "FISCAL", registroId: produtoId } })).toBe(4);
  });
  it("justificativa diferente acrescenta nova nota e preserva integralmente as anteriores", async () => {
    const c = classificacao(); await ativar(entrada(c)); const antes = JSON.parse((await fiscalTexto()).fiscal).observacoes;
    const nova = await ativar({ ...entrada({ ...c, analiseNcm: { ...c.analiseNcm!, justificativa: "Nova evidência exclusivamente fictícia altera a fundamentação da classificação." } }), versaoBase: 1 });
    expect(JSON.parse((await fiscalTexto()).fiscal).observacoes).toBe(`${antes}\n\n[Análise NCM ${nova.id}] Nova evidência exclusivamente fictícia altera a fundamentação da classificação.`);
  });
  it("nota nova que excede o limite continua recusada sem truncar notas ou ativar parcialmente", async () => {
    const c = classificacao(); await ativar(entrada(c));
    const nota = JSON.parse((await fiscalTexto()).fiscal).observacoes as string;
    const observacoes = `${"Nota manual preservada. ".repeat(76)}\n\n${nota}`;
    await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=jsonb_set(fiscal,'{observacoes}',to_jsonb($2::text)) WHERE id=$1`, [produtoId, observacoes]);
    const antes = await fiscalTexto();
    const v = await salvarVersaoFiscal({ ...entrada({ ...c, analiseNcm: { ...c.analiseNcm!, justificativa: "Nova fundamentação fictícia. ".repeat(20) } }), versaoBase: 1 }, sessao);
    const impacto = await analisarImpactoFiscal(v.id, sessao);
    await expect(ativarVersaoFiscal(v.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("2000 caracteres");
    expect(await fiscalTexto()).toEqual(antes);
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("RASCUNHO");
    expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: v.id, tipo: "ATIVACAO" } })).toBe(0);
  });
  it("ativação futura não muda o cadastro atual nem cria fotografia de alteração", async () => {
    const antes = await fiscalTexto(); await ativar(entrada(classificacao(), "2027-01-01"));
    expect(await fiscalTexto()).toEqual(antes); expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: produtoId, entidade: "FISCAL" } })).toBe(0);
  });
  it("confiança baixa não substitui NCM anterior nem declara conclusão", async () => {
    const c = classificacao(); await ativar(entrada({ ...c, analiseNcm: { ...c.analiseNcm!, confianca: "BAIXA", pendenciasNcm: ["Característica essencial não comprovada"] } }));
    expect(JSON.parse((await fiscalTexto()).fiscal)).toMatchObject({ ncm: legado.ncm, ncmConfianca: "BAIXA" });
  });
  it.each(["INCLUIDO", "INTEGRADO"] as const)("N/A em escolha %s preserva o código antigo somente como identidade", async comportamento => {
    await opcaoUso(comportamento, comportamento === "INTEGRADO" ? "5" : "0"); const v = await ativar(entrada(configuracao()));
    const p = JSON.parse((await fiscalTexto()).fiscal); expect(p.ncm).toBe(legado.ncm); expect(p.ncmAplicabilidade).toBe("NAO_APLICAVEL"); expect(p.observacoes).toContain("exclusivamente como identidade");
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).dados).toMatchObject({ ncm: null, ncmAplicabilidade: "NAO_APLICAVEL" });
  });
  it.each([["MERCADORIA", "5"], ["INCLUIDO", "5"], [null, "0"]] as const)("N/A recusa uso %s/%s sem alterar cadastro ou ativar versão", async (comportamento, preco) => {
    await opcaoUso(comportamento, preco); const antes = await fiscalTexto(), v = await salvarVersaoFiscal(entrada(configuracao()), sessao), impacto = await analisarImpactoFiscal(v.id, sessao);
    await expect(ativarVersaoFiscal(v.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("comportamento incluído ou integrado");
    expect(await fiscalTexto()).toEqual(antes); expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("RASCUNHO");
  });
  it("N/A recusa papel principal e configuração sem qualquer uso ativo", async () => {
    const d = entrada(configuracao()); await expect(ativar(d)).rejects.toThrow("ausência de venda como produto principal");
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { classificacao: "OPCAO", classificacoes: ["OPCAO"] } });
    await expect(ativar({ ...d, versaoBase: 1, chaveOperacao: randomUUID() })).rejects.toThrow("vínculo ativo integrado");
  });
  it("kit N/A sem grupo único usa auxiliar sem substituir NCM antigo de identidade", async () => {
    const filho = await sim.prisma.produtoVenda.create({ data: { nome: "Mercadoria fictícia do kit" } }), c = classificacao();
    await ativar(entrada({ ...c, grupo: null, ncm: null, tratamento: "KIT_COMPOSTO", estado: "CONFIRMADO", pendencias: [], ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: { ...c.analiseNcm!, descricaoNcm: null }, componentesKit: [{ produtoId: filho.id, quantidade: "1", pesoRateio: "1" }] }));
    const p = await fiscalTexto(); expect(p.grupoFiscalId).toBe("aux-kit-ficticio"); expect(JSON.parse(p.fiscal)).toMatchObject({ ncm: legado.ncm, ncmAplicabilidade: "NAO_APLICAVEL" });
  });
  it("mudança JSONB invisível em Number invalida o impacto mesmo sem mudar a versão comercial", async () => {
    await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=fiscal || '{"legado":9007199254740993}'::jsonb WHERE id=$1`, [produtoId]);
    const v = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(v.id, sessao);
    await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=jsonb_set(fiscal,'{legado}','9007199254740992'::jsonb) WHERE id=$1`, [produtoId]);
    await expect(ativarVersaoFiscal(v.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("Execute novamente");
  });
  it("cenários por configuração validam vínculos reais e expõem evidências no DTO sem NCM único legado", async () => {
    const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Sabores fictícios ${randomUUID()}`, produtos: { create: { produtoId } }, opcoes: { create: [{ nome: "Sabor A fictício" }, { nome: "Sabor B fictício" }] } }, include: { opcoes: true } });
    for (const o of grupo.opcoes) await ativar({ ...entrada(), tipo: "COMPLEMENTO", chave: o.id, dados: { opcaoId: o.id, comportamento: "INCLUIDO", produtoId: null, justificativa: "Sabor integrado exclusivamente sintético" } });
    const c = classificacao(), cenarios = grupo.opcoes.map((o, n) => ({ id: `cenario-${n}`, nome: o.nome, opcaoIds: [o.id], ncm: n ? "19053100" : "08061000", analiseNcm: { ...c.analiseNcm!, descricaoNcm: "Descrição exclusivamente sintética" } }));
    const dados: ClassificacaoFiscal = { ...c, ncm: null, estado: "CONFIRMADO", pendencias: [], analiseNcm: { ...c.analiseNcm!, descricaoNcm: null }, configuracaoNcm: { grupoIds: [grupo.id], padraoSemEscolhasAutorizado: false, cenarios } };
    await expect(salvarVersaoFiscal(entrada({ ...dados, configuracaoNcm: { ...dados.configuracaoNcm!, grupoIds: ["grupo-alheio-ficticio"] } }), sessao)).rejects.toThrow("não pertence ao produto principal");
    await expect(salvarVersaoFiscal(entrada({ ...dados, configuracaoNcm: { ...dados.configuracaoNcm!, cenarios: [{ ...cenarios[0], opcaoIds: ["opcao-alheia-ficticia"] }] } }), sessao)).rejects.toThrow("não pertence aos grupos");
    const v = await ativar(entrada(dados));
    expect(JSON.parse((await fiscalTexto()).fiscal)).toMatchObject({ ncm: legado.ncm, ncmModo: "POR_CONFIGURACAO", ncmClassificacaoVersaoId: v.id });
    const dto = (await consultarPainelFiscal(sessao)).produtos.find(p => p.id === produtoId)!;
    expect(dto).toMatchObject({ ncm: null, ncmAplicabilidade: "APLICAVEL", analiseNcm: dados.analiseNcm, configuracaoNcm: dados.configuracaoNcm });
    const pedido = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "ficticio", criadoPorId: sessao.userId, itens: { create: { produtoId, versaoPedido: 1, ordem: 0, quantidade: "1", unidadeSnapshot: "UN", produtoSnapshot: { nome: "Principal fictício" }, escolhasSnapshot: [{ opcaoId: grupo.opcoes[0].id, grupoId: grupo.id, produtoId: null, opcaoNome: "Sabor A fictício", quantidade: 1, preco: "0" }], estadoComposicao: "CONHECIDA", precoOriginal: "10", precoAplicado: "10", acrescimos: "0", totalLinha: "10" } } }, include: { itens: true } });
    expect(itensParaTributacao(pedido)[0].escolhas[0]).toMatchObject({ opcaoId: grupo.opcoes[0].id, grupoId: grupo.id });
  });
  it("equivalência com NCM invariável preenche vínculo real preservando JSONB exato, tributos e auditoria", async () => {
    await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=fiscal||'{"legadoInteiro":9007199254740993}'::jsonb WHERE id=$1`, [produtoId]);
    const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Equivalência ${randomUUID()}`, tipo: "COMPOSICAO", produtos: { create: { produtoId } }, opcoes: { create: { nome: "Escolha sintética equivalente", preco: "0" } } }, include: { opcoes: true } });
    await integrarOpcao(grupo.opcoes[0].id); const c = classificacao();
    c.configuracaoNcm = { grupoIds: [], padraoSemEscolhasAutorizado: true, cenarios: [], gruposEquivalentes: [{ grupoId: grupo.id, opcaoIds: [grupo.opcoes[0].id], quantidadeMinima: "0", quantidadeMaxima: "2", analiseNcm: c.analiseNcm! }] };
    const v = await ativar(entrada(c)), fiscal = await fiscalTexto();
    expect(JSON.parse(fiscal.fiscal)).toMatchObject({ ncm: "08061000", cfop: legado.cfop, cest: legado.cest, ncmModo: "POR_CONFIGURACAO", ncmClassificacaoVersaoId: v.id }); expect(fiscal.fiscal).toContain("9007199254740993"); expect(JSON.parse(fiscal.fiscal).observacoes).toContain("invariável");
    const fotos = (await banco!.query(`SELECT antes#>>'{fiscal,ncm}' AS antes,depois#>>'{fiscal,ncm}' AS depois,depois#>>'{fiscal,legadoInteiro}' AS inteiro FROM "HistoricoCadastroVenda" WHERE entidade='FISCAL' AND "registroId"=$1`, [produtoId])).rows;
    expect(fotos).toEqual([{ antes: legado.ncm, depois: "08061000", inteiro: "9007199254740993" }]);
  });
  it("edições comerciais não removem/forjam metadata nem arredondam JSONB desconhecido", async () => {
    await ativar(); await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=fiscal || '{"legado":9007199254740993}'::jsonb WHERE id=$1`, [produtoId]);
    const anterior = JSON.parse((await fiscalTexto()).fiscal);
    await salvarFiscalProduto(produtoId, 4, { ncm: "08061000", cfop: "5101", ncmAplicabilidade: "NAO_APLICAVEL", ncmClassificacaoVersaoId: "forjado" }, false, sessao, "fiscal-grupo-gf05");
    let p = await fiscalTexto(); expect(JSON.parse(p.fiscal)).toMatchObject({ ncmAplicabilidade: anterior.ncmAplicabilidade, ncmClassificacaoVersaoId: anterior.ncmClassificacaoVersaoId }); expect(p.fiscal).toContain("9007199254740993");
    await salvarProduto({ id: produtoId, versao: 5, nome: "Produto alterado fictício", especificacao: null, descricao: null, tipo: "PADRAO", codigo: null, unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: null, ativo: true, categorias: [], grupos: [], componentes: [], preco: "12.34" }, sessao, { fiscal: { ncm: "08061000", cfop: "5102", ncmConfianca: "FORJADA" }, revisado: false, grupoFiscalId: "fiscal-grupo-gf05" });
    p = await fiscalTexto(); expect(JSON.parse(p.fiscal)).toMatchObject({ ncmConfianca: "ALTA", ncmClassificacaoVersaoId: anterior.ncmClassificacaoVersaoId }); expect(p.fiscal).toContain("9007199254740993");
    expect((await banco!.query(`SELECT bool_and(depois#>>'{fiscal,legado}'='9007199254740993') AS exato FROM "HistoricoCadastroVenda" WHERE "registroId"=$1 AND depois#>>'{fiscal,legado}' IS NOT NULL`, [produtoId])).rows[0].exato).toBe(true);
  });
  it("manutenção do grupo com propagação preserva precisão JSONB e parâmetros individuais nos cadastros e fotos", async () => {
    await ativar(); const grupo = await sim.prisma.grupoFiscalVenda.create({ data: { nome: `Grupo de propagação fictício ${randomUUID()}`, fiscal: { cfop: "5101" } } });
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { grupoFiscalId: grupo.id } });
    await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=fiscal||'{"inteiroLegado":9007199254740993,"decimalLegado":1.1234567890123456789}'::jsonb WHERE id=$1`, [produtoId]);
    await banco!.query(`UPDATE "GrupoFiscalVenda" SET fiscal=fiscal||'{"inteiroLegadoGrupo":9007199254740993}'::jsonb WHERE id=$1`, [grupo.id]);
    const antes = await fiscalTexto(); await salvarGrupoFiscal({ id: grupo.id, versao: 1, nome: grupo.nome, ativo: true, atualizarVinculados: true, fiscal: { cfop: "5101", pis: "99", ncm: "16010000", ncmAplicabilidade: "forjado" } }, sessao);
    const p = await fiscalTexto(); expect(p.fiscal).toContain("9007199254740993"); expect(p.fiscal).toContain("1.1234567890123456789"); expect(JSON.parse(p.fiscal)).toMatchObject({ ncm: "08061000", cfop: "5102", pis: "99", ncmAplicabilidade: "APLICAVEL" });
    expect(p.versao).toBe(antes.versao + 1); expect(p.fiscalRevisado).toBe(false);
    const textos = (await banco!.query(`SELECT antes::text AS antes,depois::text AS depois FROM "HistoricoCadastroVenda" WHERE entidade='FISCAL' AND "registroId"=$1 ORDER BY "createdAt" DESC LIMIT 1`, [produtoId])).rows[0]; expect(textos.antes).toContain("9007199254740993"); expect(textos.depois).toContain("9007199254740993");
    const g = (await banco!.query(`SELECT fiscal::text AS fiscal FROM "GrupoFiscalVenda" WHERE id=$1`, [grupo.id])).rows[0]; expect(g.fiscal).toContain("9007199254740993");
    const foto = (await banco!.query(`SELECT antes::text AS antes,depois::text AS depois FROM "HistoricoCadastroVenda" WHERE entidade='GRUPO_FISCAL' AND "registroId"=$1`, [grupo.id])).rows[0]; expect(foto.antes).toContain("9007199254740993"); expect(foto.depois).toContain("9007199254740993");
  });
  it("falha na auditoria do cadastro reverte status, NCM, versão e evento de ativação", async () => {
    const v = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(v.id, sessao), antes = await fiscalTexto();
    await banco!.query(`CREATE FUNCTION falhar_auditoria_fiscal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entidade='FISCAL' THEN RAISE EXCEPTION 'Falha exclusivamente fictícia'; END IF; RETURN NEW; END $$`);
    await banco!.query(`CREATE TRIGGER falhar_auditoria_fiscal BEFORE INSERT ON "HistoricoCadastroVenda" FOR EACH ROW EXECUTE FUNCTION falhar_auditoria_fiscal()`);
    try {
      await expect(ativarVersaoFiscal(v.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("Falha exclusivamente fictícia");
      expect(await fiscalTexto()).toEqual(antes); expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("RASCUNHO");
      expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: v.id, tipo: "ATIVACAO" } })).toBe(0);
    } finally { await banco!.query('DROP TRIGGER falhar_auditoria_fiscal ON "HistoricoCadastroVenda"'); await banco!.query("DROP FUNCTION falhar_auditoria_fiscal()"); }
  });
  it("lote usa serviços atomicamente, prévia reverte tudo e reexecução não duplica alterações", async () => {
    const d = await lote(), antes = await fiscalTexto(), versoes = await sim.prisma.versaoEstruturaFiscal.count(), historicos = await sim.prisma.historicoCadastroVenda.count(), eventos = await sim.prisma.eventoEstruturaFiscal.count();
    const p = await preverLoteClassificacaoFiscal(d, tabelaFicticia, sessao); expect(p.aplicado).toBe(false);
    expect(await fiscalTexto()).toEqual(antes); expect(await sim.prisma.versaoEstruturaFiscal.count()).toBe(versoes); expect(await sim.prisma.historicoCadastroVenda.count()).toBe(historicos); expect(await sim.prisma.eventoEstruturaFiscal.count()).toBe(eventos);
    const a = await aplicarLoteClassificacaoFiscal(d, tabelaFicticia, sessao, p.plano.hashPlano); expect(a.aplicado).toBe(true); expect(a.versoes).toHaveLength(2);
    const depois = await fiscalTexto(), n = await sim.prisma.eventoEstruturaFiscal.count();
    const replay = await aplicarLoteClassificacaoFiscal(d, tabelaFicticia, sessao, p.plano.hashPlano); expect(replay.aplicadoAnteriormente).toBe(true); expect(replay.aplicado).toBe(false); expect(await fiscalTexto()).toEqual(depois); expect(await sim.prisma.eventoEstruturaFiscal.count()).toBe(n);
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { fiscalRevisado: false } });
    await expect(aplicarLoteClassificacaoFiscal(d, tabelaFicticia, sessao, p.plano.hashPlano)).rejects.toThrow("estado atual divergente");
  });
  it("mercadoria configurada sela equivalência física de opção sem produto auxiliar e rejeita mudança de receita", async () => {
    const ins = await sim.prisma.insumo.create({ data: { nome: "Ingrediente fictício das porções", unidade: "KG" } });
    const alias = await sim.prisma.produtoVenda.create({ data: { nome: "Alias exclusivamente fictício", ativo: false } });
    const apresentacao = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Apresentação fictícia ${randomUUID()}`, tipo: "COMPOSICAO", produtos: { create: { produtoId } }, opcoes: { create: { nome: "Porção documentada fictícia", produtoId: alias.id, composicao: [{ insumoId: ins.id, unidade: "KG", quantidade: "0.12" }] } } }, include: { opcoes: true } });
    const origem = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Origem fictícia ${randomUUID()}`, tipo: "COMPLEMENTAR", opcoes: { create: { nome: "Mercadoria adicional fictícia", preco: "15", produtoId: null, composicao: [{ insumoId: ins.id, unidade: "KG", quantidade: "0.12" }] } } }, include: { opcoes: true } });
    const d = { ...entrada(), tipo: "COMPLEMENTO" as const, chave: origem.opcoes[0].id, dados: { opcaoId: origem.opcoes[0].id, comportamento: "MERCADORIA", produtoId, justificativa: "Igualdade física exclusivamente fictícia de uma porção separada", escolhas: [{ opcaoId: apresentacao.opcoes[0].id, grupoId: apresentacao.id, quantidade: "1" }], fotografiaOpcaoOrigem: "forjada" } };
    const v = await salvarVersaoFiscal(d, sessao); const dados = (await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).dados as { fotografiaOpcaoOrigem: string; receitaFotografada: unknown };
    expect(dados.fotografiaOpcaoOrigem).toMatch(/^[a-f0-9]{64}$/); expect(dados.fotografiaOpcaoOrigem).not.toBe("forjada"); expect(dados.receitaFotografada).toBeTruthy();
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: origem.opcoes[0].id }, data: { composicao: [{ insumoId: ins.id, unidade: "KG", quantidade: "0.13" }] } });
    const impacto = await analisarImpactoFiscal(v.id, sessao); await expect(ativarVersaoFiscal(v.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow("não presumir equivalência");
    expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("RASCUNHO"); expect((await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: alias.id } })).ativo).toBe(false);
  });
  it("normal preparada sela receita transitiva real e conserva snapshot; renomear/custo não invalidam, troca de ingrediente invalida", async () => {
    const queijo = await sim.prisma.insumo.create({ data: { nome: "Ingrediente Q fictício", unidade: "KG", custoMedio: "12.90" } });
    const carne = await sim.prisma.insumo.create({ data: { nome: "Ingrediente C fictício", unidade: "KG" } });
    const preparacao = await sim.prisma.insumo.create({ data: { nome: "Preparação intermediária fictícia", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: "1", rendimentoUnidade: "KG", componentes: { create: { componenteId: queijo.id, quantidade: "1" } } } });
    await sim.prisma.componenteProdutoVenda.create({ data: { produtoId, insumoId: preparacao.id, unidade: "KG", quantidade: "0.1" } });
    const v = await ativar(entrada(classificacao(produtoId, { natureza: "PREPARADO", estado: "CONFIRMADO", pendencias: [] })));
    const c = (await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).dados as unknown as ClassificacaoFiscal;
    const materiais = await sim.prisma.$transaction(tx => fotografarMateriais(tx, [preparacao.id]));
    const pedido = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "ficticio", criadoPorId: sessao.userId, itens: { create: { produtoId, versaoPedido: 1, ordem: 0, quantidade: "1", unidadeSnapshot: "UN", produtoSnapshot: { nome: "Preparação final fictícia", materiaisFiscais: materiais, modoPreparo: null }, escolhasSnapshot: [], composicaoSnapshot: [{ insumoId: preparacao.id, unidade: "KG", quantidade: "0.1", origem: "PRODUTO" }], estadoComposicao: "CONHECIDA", precoOriginal: "10", precoAplicado: "10", acrescimos: "0", totalLinha: "10" } } }, include: { itens: true } });
    const fotoAntes = structuredClone(pedido.itens[0].produtoSnapshot), item = itensParaTributacao(pedido)[0];
    const resolverAtual = async () => { const f = await sim.prisma.$transaction(tx => fotografarClassificacaoNormal(tx, c)); return resolverNcmConfiguracao(c, [], v.id, item.receitaFotografada, { algoritmo: "grazing.receita-fiscal.v1", principalHash: f.principalHash, opcaoHashes: [], materiais: { principal: f.materiais, opcoes: [] } }); };
    expect((await resolverAtual()).pendencias).toEqual([]);
    await sim.prisma.insumo.update({ where: { id: queijo.id }, data: { nome: "Nome futuro fictício", custoMedio: "45" } }); expect((await resolverAtual()).pendencias).toEqual([]);
    await sim.prisma.composicaoInsumo.deleteMany({ where: { produtoId: preparacao.id } }); await sim.prisma.composicaoInsumo.create({ data: { produtoId: preparacao.id, componenteId: carne.id, quantidade: "1" } });
    expect((await resolverAtual()).pendencias.join()).toContain("Receita material/transitiva");
    expect((await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: pedido.itens[0].id } })).produtoSnapshot).toEqual(fotoAntes); expect(c.ncm).toBe("08061000");
  });
  it("lote prospectivo sela KIT com referência interna futura na mesma vigência e preserva o cadastro atual", async () => {
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Preparação futura exclusivamente fictícia", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: "1", rendimentoUnidade: "KG" } });
    const interna = classificacao(null, { produtoId: null, referenciaInternaInsumoId: insumo.id, estado: "CONFIRMADO", pendencias: [], natureza: "PREPARADO", conversaoUnidade: { unidadeEstoque: "KG", quantidadeEstoquePorUnidadeFiscal: "0.022", justificativa: "Conversão exclusivamente fictícia", fontes: ["Documento sintético"] } });
    const base = classificacao(), kit: ClassificacaoFiscal = { ...base, grupo: null, ncm: null, tratamento: "KIT_COMPOSTO", estado: "CONFIRMADO", pendencias: [], ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: { ...base.analiseNcm!, descricaoNcm: null }, componentesKit: [{ referenciaInternaInsumoId: insumo.id, descricao: "Componente futuro sintético", unidade: "UN", quantidade: "2", pesoRateio: "1" }] };
    const d = await lote(kit); d.vigenciaInicio = "2027-01-01"; d.registros.push(entrada(interna)); const antes = await fiscalTexto();
    const p = await preverLoteClassificacaoFiscal(d, tabelaFicticia, sessao); const a = await aplicarLoteClassificacaoFiscal(d, tabelaFicticia, sessao, p.plano.hashPlano);
    expect(a.versoes).toHaveLength(3); expect(await fiscalTexto()).toEqual(antes);
    const versaoKit = await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: a.versoes.find(v => v.chave === produtoId)!.id } });
    expect(versaoKit.vigenciaInicio.toISOString().slice(0,10)).toBe("2027-01-01"); expect((versaoKit.dados as unknown as ClassificacaoFiscal).componentesKit![0].receitaFotografada?.materiais?.principal.insumos[0].insumoId).toBe(insumo.id);
  });
  it("projeção de extra simples usa composição fechada por unidade, contagem e multiplicador, sem foto atual retrospectiva", async () => {
    const ins = await sim.prisma.insumo.create({ data: { nome: "Ingrediente extra fictício", unidade: "KG" } });
    const extra = await sim.prisma.produtoVenda.create({ data: { nome: "Mercadoria extra fictícia", unidade: "KG", modoPreparo: "Processo exclusivamente fictício", componentes: { create: { insumoId: ins.id, unidade: "KG", quantidade: "1" } } } });
    const v = await salvarVersaoFiscal(entrada(classificacao(extra.id, { unidade: "KG" })), sessao), c = (await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).dados as unknown as ClassificacaoFiscal;
    const materiais = await sim.prisma.$transaction(tx => fotografarMateriais(tx, [ins.id]));
    const pedido = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "ficticio", criadoPorId: sessao.userId, itens: { create: { produtoId, versaoPedido: 1, ordem: 0, quantidade: "3", unidadeSnapshot: "UN", produtoSnapshot: { nome: "Principal fictício", materiaisFiscais: materiais }, escolhasSnapshot: [{ opcaoId: "extra-ficticio", grupoId: "extras-ficticios", produtoId: extra.id, opcaoNome: extra.nome, quantidade: 2, multiplicador: "0.25", preco: "3", unidadeProduto: "KG", modoPreparoProduto: extra.modoPreparo }], composicaoSnapshot: [{ insumoId: ins.id, unidade: "KG", quantidade: "0.5", origem: "extra-ficticio" }], estadoComposicao: "CONHECIDA", precoOriginal: "10", precoAplicado: "10", acrescimos: "6", totalLinha: "48" } } }, include: { itens: true } });
    const e = itensParaTributacao(pedido)[0].escolhas[0]; expect(e).toMatchObject({ quantidade: "0.500000", quantidadeEscolhida: "2.000000", valor: "18.00", receitaFotografada: { principalHash: c.fotografiaTecnica!.principalHash, materiais: { principal: c.fotografiaTecnica!.materiais } } });
    await sim.prisma.componenteProdutoVenda.update({ where: { id: (await sim.prisma.componenteProdutoVenda.findFirstOrThrow({ where: { produtoId: extra.id } })).id }, data: { quantidade: "2" } });
    expect(itensParaTributacao(pedido)[0].escolhas[0].receitaFotografada).toEqual(e.receitaFotografada);
  });
  it("escolha inteira tem prova fiscal própria sem converter a pendência de estoque; ramo baixo e legado permanecem localizados", async () => {
    const ins = await sim.prisma.insumo.create({ data: { nome: "Preparação inteira fictícia", unidade: "KG" } });
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { preco: "0" } });
    const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Sabores inteiros ${randomUUID()}`, tipo: "COMPOSICAO", minimo: 1, maximo: 1, repetir: false, produtos: { create: { produtoId } }, opcoes: { create: ["Palmito fictício", "Frango sem prova fictício"].map(nome => ({ nome, preco: "12.50", composicao: [{ insumoId: ins.id, unidade: "KG", quantidade: "0.1" }] })) } }, include: { opcoes: true } });
    const [a,b] = grupo.opcoes, analise = classificacao().analiseNcm!;
    for (const o of grupo.opcoes) await integrarOpcao(o.id);
    const c = classificacao(produtoId, { ncm: null, estado: "CONFIRMADO", pendencias: [], baseSemIngredientesComprovada: true, configuracaoNcm: { grupoIds: [grupo.id], padraoSemEscolhasAutorizado: false, cenarios: [{ id: "palmito-ficticio", nome: "Palmito comprovado fictício", opcaoIds: [a.id], ncm: "19059090", analiseNcm: { ...analise, descricaoNcm: "Preparação exclusivamente sintética" } }, { id: "frango-ficticio", nome: "Frango sem prova fictício", opcaoIds: [b.id], ncm: null, analiseNcm: { ...analise, confianca: "BAIXA", descricaoNcm: null, pendenciasNcm: ["Percentual exclusivamente sintético não comprovado"] } }] } });
    const v = await ativar(entrada(c)), dados = (await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).dados as unknown as ClassificacaoFiscal;
    const pa = await pedidoNovo(produtoId, { [a.id]: 1 }), pb = await pedidoNovo(produtoId, { [b.id]: 1 });
    expect(pa.itens[0].estadoComposicao).toBe("PENDENTE"); expect(pa.total.toFixed(2)).toBe("12.50");
    const resolver = async (pedido: typeof pa) => { const item = itensParaTributacao(pedido)[0], atual = await sim.prisma.$transaction(tx => fotografarReceitaFiscal(tx, dados, false, item.escolhas.map(e => e.opcaoId))); return resolverNcmConfiguracao(dados, item.escolhas, v.id, item.receitaFotografada, atual); };
    expect((await resolver(pa)).pendencias).toEqual([]); expect((await resolver(pb)).pendencias.join()).toContain("Percentual");
    const fotoAntiga = structuredClone(pa.itens[0].produtoSnapshot);
    const legado = { ...pa, itens: [{ ...pa.itens[0], produtoSnapshot: { nome: "Pedido antigo sintético" } }] };
    expect((await resolver(legado)).pendencias.join()).toContain("não comprovada");
    // O ramo não escolhido pode perder sua receita transitiva sem retirar a prova do ramo escolhido.
    const quebrada = await sim.prisma.insumo.create({ data: { nome: "Preparação cíclica fictícia", unidade: "KG", tipo: "PRODUTO_INTERMEDIARIO" } });
    await sim.prisma.composicaoInsumo.create({ data: { produtoId: quebrada.id, componenteId: quebrada.id, quantidade: "1" } });
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: b.id }, data: { composicao: [{ insumoId: quebrada.id, unidade: "KG", quantidade: "0.1" }] } });
    expect((await resolver(pa)).pendencias).toEqual([]);
    expect((await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: pa.itens[0].id } })).produtoSnapshot).toEqual(fotoAntiga);
    const semFlag = { ...dados, baseSemIngredientesComprovada: false }; expect(resolverNcmConfiguracao(semFlag, itensParaTributacao(pa)[0].escolhas, v.id, itensParaTributacao(pa)[0].receitaFotografada, dados.configuracaoNcm!.fotografiaTecnica).pendencias.join()).toContain("ausência de base documentada");
  });
  it("suco em unidades separadas conserva contagem escolhida, preço e fotografia apesar da base PADRAO vazia", async () => {
    const ins = await sim.prisma.insumo.create({ data: { nome: "Frasco exclusivamente fictício", unidade: "UN" } });
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { preco: "0" } });
    const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Frascos ${randomUUID()}`, tipo: "COMPOSICAO", minimo: 1, maximo: 99, repetir: true, produtos: { create: { produtoId } }, opcoes: { create: ["Sabor A fictício", "Sabor B fictício"].map(nome => ({ nome, preco: "12.50", composicao: [{ insumoId: ins.id, unidade: "UN", quantidade: "1" }] })) } }, include: { opcoes: true } });
    for (const o of grupo.opcoes) await integrarOpcao(o.id);
    const a = classificacao().analiseNcm!, c = classificacao(produtoId, { ncm: null, estado: "CONFIRMADO", pendencias: [], baseSemIngredientesComprovada: true, configuracaoNcm: { modoFiscal: "UNIDADES_SEPARADAS", grupoIds: [grupo.id], padraoSemEscolhasAutorizado: false, cenarios: grupo.opcoes.map((o,n) => ({ id: `sabor-${n}`, nome: o.nome, opcaoIds: [o.id], ncm: n ? "19053100" : "08061000", analiseNcm: a })) } });
    const v = await ativar(entrada(c)), dados = (await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).dados as unknown as ClassificacaoFiscal;
    const p = await pedidoNovo(produtoId, { [grupo.opcoes[0].id]: 2, [grupo.opcoes[1].id]: 3 }, "2"), i = itensParaTributacao(p)[0];
    expect(p.itens[0].estadoComposicao).toBe("PENDENTE"); expect(i.total).toBe("125.00"); expect(i.escolhas.map(e => [e.quantidadeEscolhida,e.valor])).toEqual([["2.000000","50.00"],["3.000000","75.00"]]);
    const atual = await sim.prisma.$transaction(tx => fotografarReceitaFiscal(tx, dados, false, grupo.opcoes.map(o => o.id)));
    for (const e of i.escolhas) expect(resolverNcmConfiguracao(dados, [{ ...e, quantidadeEscolhida: "1" }], v.id, i.receitaFotografada, atual).pendencias).toEqual([]);
  });
  it("KIT novo sela conteúdo e rateio; alteração prospectiva não muda fotografia do pedido antigo e DTO comercial oculta fórmulas", async () => {
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { preco: "100" } });
    const mercadoria = await sim.prisma.produtoVenda.create({ data: { nome: "Mercadoria de kit sintética", preco: "30" } });
    await ativar(entrada(classificacao(mercadoria.id, { estado: "CONFIRMADO", pendencias: [] })));
    const kit = classificacao(produtoId, { grupo: null, tratamento: "KIT_COMPOSTO", ncm: null, ncmAplicabilidade: "NAO_APLICAVEL", analiseNcm: { ...classificacao().analiseNcm!, descricaoNcm: null }, estado: "CONFIRMADO", pendencias: [], componentesKit: [{ produtoId: mercadoria.id, quantidade: "2", pesoRateio: "1" }] });
    const v = await ativar(entrada(kit)), c = (await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).dados as unknown as ClassificacaoFiscal;
    const p = await pedidoNovo(produtoId), i = itensParaTributacao(p)[0];
    expect(conferirPoliticaKit(c, i.fotografiaKitFiscal)).toBe(true); expect(i.fotografiaKitFiscal!.componentes[0].quantidade).toBe("2");
    const futuro = structuredClone(c); futuro.componentesKit![0].quantidade = "3"; expect(conferirPoliticaKit(futuro, i.fotografiaKitFiscal)).toBe(false);
    const anterior = structuredClone(p.itens[0].produtoSnapshot); expect(itensParaTributacao(p)[0].fotografiaKitFiscal).toEqual(i.fotografiaKitFiscal); expect((await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: p.itens[0].id } })).produtoSnapshot).toEqual(anterior);
    const dto = await obterPedido(p.id); expect(JSON.stringify(dto)).not.toContain("fotografiaKitFiscal"); expect(JSON.stringify(dto)).not.toContain("receitaFiscalDocumentadaSnapshot");
    const legado = { ...p, itens: [{ ...p.itens[0], produtoSnapshot: { nome: "Kit antigo sem prova" } }] }; expect(conferirPoliticaKit(c, itensParaTributacao(legado)[0].fotografiaKitFiscal)).toBe(false);
  });
  it("CMV fiscal documentada fotografa base ausente do estoque e porção por uma escolha, sem alterar consumo ou preços", async () => {
    const pao = await sim.prisma.insumo.create({ data: { nome: "Pão da ficha fictícia", unidade: "UN" } }), queijo = await sim.prisma.insumo.create({ data: { nome: "Recheio da ficha fictícia", unidade: "KG" } });
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { preco: "10" } });
    const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Porções ${randomUUID()}`, tipo: "COMPOSICAO", minimo: 1, maximo: 2, repetir: true, produtos: { create: { produtoId } }, opcoes: { create: { nome: "Recheio documentado fictício", preco: "0", composicao: [{ insumoId: queijo.id, unidade: "KG", quantidade: "0.1" }] } } }, include: { opcoes: true } });
    const opcao = grupo.opcoes[0], analise = classificacao().analiseNcm!;
    await integrarOpcao(opcao.id);
    const c = classificacao(produtoId, { natureza: "PREPARADO", estado: "CONFIRMADO", pendencias: [], receitaFiscalDocumentada: { componentesFixos: [{ insumoId: pao.id, unidade: "KG", quantidade: "0.056666667" }], opcoes: [{ opcaoId: opcao.id, componentes: [{ insumoId: queijo.id, unidade: "KG", quantidade: "0.012" }] }], justificativa: "Ficha sintética comprova massa final e porção comestível distinta do estoque", fontes: ["ficha-ficticia"] }, configuracaoNcm: { grupoIds: [], padraoSemEscolhasAutorizado: true, cenarios: [], gruposEquivalentes: [{ grupoId: grupo.id, opcaoIds: [opcao.id], quantidadeMinima: "1", quantidadeMaxima: "2", analiseNcm: analise }] } });
    const v = await ativar(entrada(c)), dados = (await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).dados as unknown as ClassificacaoFiscal;
    const antes = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId }, include: { componentes: true } });
    const p = await pedidoNovo(produtoId, { [opcao.id]: 2 }, "3"), i = itensParaTributacao(p)[0], atual = await sim.prisma.$transaction(tx => fotografarReceitaFiscal(tx, dados, false, [opcao.id]));
    expect(p.total.toFixed(2)).toBe("30.00"); expect(p.itens[0].estadoComposicao).toBe("PENDENTE"); expect(p.itens[0].composicaoSnapshot).toEqual([expect.objectContaining({ insumoId: queijo.id, quantidade: "0.2" })]);
    expect(i.receitaFotografada!.documentacaoHash).toBe(hashReceitaDocumentada(c.receitaFiscalDocumentada!)); expect(resolverNcmConfiguracao(dados, i.escolhas, v.id, i.receitaFotografada, atual).pendencias).toEqual([]);
    expect(await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId }, include: { componentes: true } })).toEqual(antes);
    const legado = { ...p, itens: [{ ...p.itens[0], produtoSnapshot: { nome: "Preparação histórica sem ficha própria" } }] }; expect(resolverNcmConfiguracao(dados, i.escolhas, v.id, itensParaTributacao(legado)[0].receitaFotografada, atual).pendencias.join()).toContain("não reconstruir");
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: opcao.id }, data: { composicao: [{ insumoId: queijo.id, unidade: "KG", quantidade: "0.2" }] } });
    const mudada = await sim.prisma.$transaction(tx => fotografarReceitaFiscal(tx, dados, false, [opcao.id])); expect(resolverNcmConfiguracao(dados, i.escolhas, v.id, i.receitaFotografada, mudada).pendencias.join()).toContain("diverge da receita analisada");
    expect((await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: p.itens[0].id } })).produtoSnapshot).toEqual(p.itens[0].produtoSnapshot);
  });
  it("CLI composto usa serviços reais: dry-run integral, aplicação atômica e replay sem alterar documentos ou estoque", async () => {
    const ins = await sim.prisma.insumo.create({ data: { nome: "Ingrediente da CLI fictícia", unidade: "KG" } });
    const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Escolha CLI ${randomUUID()}`, tipo: "COMPOSICAO", minimo: 1, maximo: 1, repetir: false, produtos: { create: { produtoId } }, opcoes: { create: { nome: "Porção CLI fictícia", composicao: [{ insumoId: ins.id, unidade: "KG", quantidade: "0.1" }] } } }, include: { opcoes: true } });
    const opcao = grupo.opcoes[0], kitId = (await sim.prisma.produtoVenda.create({ data: { nome: "Kit da CLI fictícia", preco: "40" } })).id;
    const c = classificacao(produtoId, { natureza: "PREPARADO", estado: "CONFIRMADO", pendencias: [], receitaFiscalDocumentada: { componentesFixos: [{ insumoId: ins.id, unidade: "KG", quantidade: "0.056666667" }], opcoes: [{ opcaoId: opcao.id, componentes: [{ insumoId: ins.id, unidade: "KG", quantidade: "0.012" }] }], justificativa: "Receita final sintética usada exclusivamente para a CLI local", fontes: ["ficha-ficticia"] }, configuracaoNcm: { grupoIds: [], padraoSemEscolhasAutorizado: true, cenarios: [], gruposEquivalentes: [{ grupoId: grupo.id, opcaoIds: [opcao.id], quantidadeMinima: "1", quantidadeMaxima: "1", analiseNcm: classificacao().analiseNcm! }] } });
    const d = await lote(c), base = entrada();
    d.registros.push({ ...base, tipo: "COMPLEMENTO", chave: opcao.id, dados: { opcaoId: opcao.id, produtoId: null, comportamento: "INTEGRADO", justificativa: "Porção integrada sintética da CLI" } }, { ...base, chave: `INSUMO:${ins.id}`, dados: classificacao(null, { referenciaInternaInsumoId: ins.id, estado: "CONFIRMADO", pendencias: [], conversaoUnidade: { unidadeEstoque: "KG", quantidadeEstoquePorUnidadeFiscal: "0.06", justificativa: "Conversão física exclusivamente fictícia", fontes: ["ficha-ficticia"] } }) }, { ...base, chave: kitId, dados: classificacao(kitId, { grupo: null, tratamento: "KIT_COMPOSTO", ncm: null, ncmAplicabilidade: "NAO_APLICAVEL", estado: "CONFIRMADO", pendencias: [], analiseNcm: { ...classificacao().analiseNcm!, descricaoNcm: null }, componentesKit: [{ produtoId, quantidade: "1", pesoRateio: "2", escolhas: [{ opcaoId: opcao.id, grupoId: grupo.id, quantidade: "1" }] }, { referenciaInternaInsumoId: ins.id, descricao: "Porção interna final fictícia", unidade: "UN", quantidade: "2", pesoRateio: "1" }] }) });
    const raiz = path.resolve(".tmp/fiscal"), diretorio = path.join(raiz, `teste-cli-classificacao-${randomUUID().replaceAll("-", "")}`);
    if (!diretorio.startsWith(raiz + path.sep) || !/^teste-cli-classificacao-[a-f0-9]{32}$/.test(path.basename(diretorio))) throw new Error("Artefatos fictícios fora da área privada.");
    const autorizacaoAnterior = process.env.CLASSIFICACAO_FISCAL_APLICACAO_AUTORIZADA, codigoAnterior = process.exitCode;
    const oficial = { Data_Ultima_Atualizacao_NCM: "12/10/2026", Nomenclaturas: tabelaFicticia.linhas.map(l => ({ Codigo: `${l.codigo.slice(0,4)}.${l.codigo.slice(4,6)}.${l.codigo.slice(6)}`, Descricao: l.descricao, Data_Inicio: "01/01/2020", Data_Fim: "31/12/9999" })) };
    d.registros.find(r => r.tipo === "TABELA")!.dados = converterTabelaNcmOficial(oficial, sim.hoje);
    const contar = async () => ({ versoes: await sim.prisma.versaoEstruturaFiscal.count(), eventos: await sim.prisma.eventoEstruturaFiscal.count(), movimentos: await sim.prisma.movimentacaoEstoque.count(), documentos: await sim.prisma.documentoFiscalSaida.count() });
    const antes = await contar(), insumoAntes = await sim.prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } }), fiscalAntes = await fiscalTexto();
    const saida = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await mkdir(diretorio, { recursive: true, mode: 0o700 });
      await writeFile(path.join(diretorio, "entrada.json"), JSON.stringify(d)); await writeFile(path.join(diretorio, "ncm.json"), JSON.stringify(oficial)); await writeFile(path.join(diretorio, "backup.json"), JSON.stringify({ verificado: true, autorizacaoImplantacao: true, hashDump: "a".repeat(64), criadoEm: new Date().toISOString() }));
      const url = new URL(process.env.DATABASE_URL!); sim.criarConexaoCli = () => new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
      const args = [`--entrada=${path.join(diretorio,"entrada.json")}`, `--tabela-ncm=${path.join(diretorio,"ncm.json")}`, `--usuario-id=${sessao.userId}`, `--saida=${path.join(diretorio,"recibos")}`];
      await executarCliClassificacao(args); const previa = JSON.parse(String(saida.mock.calls.at(-1)![0]));
      expect(previa).toMatchObject({ modo: "DRY_RUN", classificacoes: 3, referenciasInternas: 1, complementos: 1, tabelas: 1, aplicado: false, documentosTransmitidos: 0 }); expect(await contar()).toEqual(antes); expect(await fiscalTexto()).toEqual(fiscalAntes);
      process.env.CLASSIFICACAO_FISCAL_APLICACAO_AUTORIZADA = "SIM";
      const aplicacao = [...args, "--apply", `--hash-plano=${previa.hashPlano}`, `--backup-comprovante=${path.join(diretorio,"backup.json")}`];
      await executarCliClassificacao(aplicacao); const recibo = JSON.parse(String(saida.mock.calls.at(-1)![0]));
      expect(recibo).toMatchObject({ aplicado: true, aplicadoAnteriormente: false, reciboGravado: true, documentosTransmitidos: 0 }); expect(JSON.parse((await fiscalTexto()).fiscal).ncm).toBe("08061000");
      const aplicado = await contar(); expect(aplicado.versoes).toBe(antes.versoes + 5); expect(aplicado.movimentos).toBe(antes.movimentos); expect(aplicado.documentos).toBe(antes.documentos);
      await executarCliClassificacao(aplicacao); expect(JSON.parse(String(saida.mock.calls.at(-1)![0]))).toMatchObject({ aplicado: false, aplicadoAnteriormente: true, documentosTransmitidos: 0 }); expect(await contar()).toEqual(aplicado); expect(await sim.prisma.insumo.findUniqueOrThrow({ where: { id: ins.id } })).toEqual(insumoAntes);
    } finally {
      saida.mockRestore(); sim.criarConexaoCli = null; if (autorizacaoAnterior === undefined) delete process.env.CLASSIFICACAO_FISCAL_APLICACAO_AUTORIZADA; else process.env.CLASSIFICACAO_FISCAL_APLICACAO_AUTORIZADA = autorizacaoAnterior; process.exitCode = codigoAnterior;
      // O alvo absoluto verificado acima pertence exclusivamente a esta fixture.
      await rm(diretorio, { recursive: true, force: true });
    }
  });
  it("lote confere hash exato JSONB e tabela oficial, sem usar campo legado arredondado", async () => {
    const d = await lote(); await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=fiscal||'{"legado":9007199254740993}'::jsonb WHERE id=$1`, [produtoId]);
    const p = await preverLoteClassificacaoFiscal(d, tabelaFicticia, sessao);
    await banco!.query(`UPDATE "ProdutoVenda" SET fiscal=jsonb_set(fiscal,'{legado}','9007199254740992'::jsonb) WHERE id=$1`, [produtoId]);
    await expect(aplicarLoteClassificacaoFiscal(d, tabelaFicticia, sessao, p.plano.hashPlano)).rejects.toThrow("refazer a prévia");
    const naoOficial = await lote({ ...classificacao(), ncm: "99999999" }); await expect(preverLoteClassificacaoFiscal(naoOficial, tabelaFicticia, sessao)).rejects.toThrow("não pertence à tabela");
  });
  it("lote não usa flag de sessão para contornar administrador real, inatividade ou autoria do recibo", async () => {
    const d = await lote(), u = await sim.prisma.usuario.create({ data: { nome: "Operador fictício", email: `${randomUUID()}@example.invalid`, senhaHash: "sem-login" } });
    await expect(preverLoteClassificacaoFiscal(d, tabelaFicticia, { ...sessao, userId: u.id, admin: true })).rejects.toThrow("Seu acesso");
    const p = await preverLoteClassificacaoFiscal(d, tabelaFicticia, sessao); await aplicarLoteClassificacaoFiscal(d, tabelaFicticia, sessao, p.plano.hashPlano);
    await sim.prisma.usuario.update({ where: { id: u.id }, data: { perfilAcessoId: perfilId } });
    await expect(aplicarLoteClassificacaoFiscal(d, tabelaFicticia, { ...sessao, userId: u.id }, p.plano.hashPlano)).rejects.toThrow("autoria");
    const outro = await sim.prisma.produtoVenda.create({ data: { nome: "Produto inativo fictício", ativo: false } });
    await expect(preverLoteClassificacaoFiscal(await lote(classificacao(outro.id)), tabelaFicticia, sessao)).rejects.toThrow("inexistente ou inativo");
  });
  it("lote preserva NCM confirmado; N/A de configuração mantém código exclusivamente como identidade", async () => {
    await ativar(entrada(classificacao(produtoId, { ncm: "19059090", estado: "CONFIRMADO", pendencias: [] })));
    const d = await lote(classificacao()); d.registros.find(r => r.tipo === "CLASSIFICACAO")!.versaoBase = 1;
    await expect(preverLoteClassificacaoFiscal(d, tabelaFicticia, sessao)).rejects.toThrow("não substitui NCM anteriormente confirmado");
    await opcaoUso("INCLUIDO"); const na = await lote(configuracao()); na.registros.find(r => r.tipo === "CLASSIFICACAO")!.versaoBase = 1;
    const p = await preverLoteClassificacaoFiscal(na, tabelaFicticia, sessao); await aplicarLoteClassificacaoFiscal(na, tabelaFicticia, sessao, p.plano.hashPlano);
    expect(JSON.parse((await fiscalTexto()).fiscal)).toMatchObject({ ncm: "19059090", ncmAplicabilidade: "NAO_APLICAVEL" });
  });
  it("falha no último cadastro do lote reverte primeiras versões, legados e auditorias", async () => {
    const outro = await sim.prisma.produtoVenda.create({ data: { nome: "Último produto fictício" } });
    const d = await lote(); d.registros.push(entrada(classificacao(outro.id)));
    const antes = await fiscalTexto(), n = await sim.prisma.versaoEstruturaFiscal.count();
    await banco!.query(`CREATE FUNCTION falhar_lote_fiscal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entidade='FISCAL' AND NEW."registroId"='${outro.id}' THEN RAISE EXCEPTION 'Falha final exclusivamente fictícia'; END IF; RETURN NEW; END $$`);
    await banco!.query(`CREATE TRIGGER falhar_lote_fiscal BEFORE INSERT ON "HistoricoCadastroVenda" FOR EACH ROW EXECUTE FUNCTION falhar_lote_fiscal()`);
    try { await expect(preverLoteClassificacaoFiscal(d, tabelaFicticia, sessao)).rejects.toThrow("Falha final exclusivamente fictícia"); expect(await fiscalTexto()).toEqual(antes); expect(await sim.prisma.versaoEstruturaFiscal.count()).toBe(n); }
    finally { await banco!.query('DROP TRIGGER falhar_lote_fiscal ON "HistoricoCadastroVenda"'); await banco!.query("DROP FUNCTION falhar_lote_fiscal()"); }
  });
});
