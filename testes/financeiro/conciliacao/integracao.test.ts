import { prepararSqlMigrationFiscal } from "../../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PrismaClient } from "@/generated/prisma/client";
const simulacao = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, sessao: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return simulacao.prisma; } }));
vi.mock("@/lib/session", () => ({ getSession: simulacao.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error("REDIRECT:" + url); } }));
vi.mock("server-only", () => ({}));
import { prepararExtratoAction, importarExtratoAction, conciliarExtratoAction, desfazerConciliacaoAction } from "@/app/(protegido)/financeiro/movimentacoes/conciliacao-actions";
import { estornarBaixaLancamentoAction } from "@/app/(protegido)/financeiro/contas/actions";
import { atualizarLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";
import { baixarLancamento, estornarBaixaLancamento } from "@/lib/financeiro/baixarLancamento";
import { calcularDre } from "@/lib/financeiro/calcularDre";
import { calcularPlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { ofxTeste, ofxItauTeste, formularioTeste } from "./dados";
const esquema = "teste_conciliacao_" + randomUUID().replaceAll("-", "");
let banco: Client | undefined;
let esquemaCriado = false;
async function importar(texto = ofxTeste(), nome = "extrato.ofx") {
 const f = formularioTeste(texto, nome); const p = await prepararExtratoAction(f); if ("erro" in p) throw new Error(p.erro);
 f.set("indices", JSON.stringify(p.previa.linhas.filter(l => l.situacao === "NOVA").map(l => l.indice))); f.set("confirmarConta", "sim");
 const r = await importarExtratoAction(f); if ("erro" in r) throw new Error(r.erro); return (await simulacao.prisma.transacaoExtrato.findMany())[0];
}
async function lancamento(valor = 125.55, dados: Record<string, unknown> = {}) { return simulacao.prisma.lancamentoFinanceiro.create({ data: { descricao: "Despesa existente", valor, tipo: "DESPESA", categoriaId: "despesa", dataCompetencia: new Date("2026-08-01T15:00:00Z"), dataVencimento: new Date("2026-09-11T15:00:00Z"), ...dados } }); }
const novo = { descricao: "Despesa conciliada", categoriaId: "despesa", dataCompetencia: "2026-08-01", dataVencimento: "2026-09-10", contraparteNome: "Cliente São João" };
describe.skipIf(process.env.CONCILIACAO_BANCO_TESTE !== "1")("conciliação em PostgreSQL isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) {
      throw new Error("Os testes de conciliação só podem executar no PostgreSQL local.");
    }
    banco = new Client({ connectionString: endereco.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`);
    esquemaCriado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true }))
      .filter(pasta => pasta.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) {
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    simulacao.prisma = new PrismaClient({ adapter: new PrismaPg({
      connectionString: endereco.toString(), options: `-c search_path=${esquema}`,
    }, { schema: esquema }) });
    // As consultas SQL das travas precisam atingir o mesmo schema das consultas Prisma.
    expect(await simulacao.prisma.$queryRaw`SELECT current_schema() AS esquema`)
      .toEqual([{ esquema }]);
  }, 60_000);

  afterAll(async () => {
    await simulacao.prisma?.$disconnect();
    if (!banco) return;
    await banco.query("ROLLBACK");
    if (esquemaCriado) {
      if (!/^teste_conciliacao_[a-f0-9]{32}$/.test(esquema)) throw new Error("Schema de teste inválido.");
      await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    }
    await banco.end();
  });



 beforeEach(async () => {
  vi.clearAllMocks();
  await banco!.query('TRUNCATE "TransacaoExtrato", "ImportacaoExtrato", "Usuario", "ContaBancaria", "LancamentoFinanceiro" CASCADE');
  await simulacao.prisma.usuario.create({ data: { id: "admin", nome: "Administrador atual", email: "admin@example.invalid", senhaHash: "sem-login", perfilAcessoId: "perfil-administrador" } });
  await simulacao.prisma.contaBancaria.create({ data: { id: "banco", nome: "Conta de teste", saldoInicial: 1000 } });
  for (const [id, grupo] of [["despesa", "DESPESAS_OPERACIONAIS"], ["receita", "RECEITA_BRUTA"]] as const) await simulacao.prisma.categoriaFinanceira.upsert({ where: { id }, create: { id, nome: "Categoria teste " + id, grupo }, update: { ativo: true } });
  simulacao.sessao.mockResolvedValue({ userId: "admin", admin: true, versao: 0 });
 });
 it("prévia/importação não criam lançamentos, movimentos ou alteram saldo inicial", async () => {
   await importar();
   expect(await simulacao.prisma.lancamentoFinanceiro.count()).toBe(0);
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(0);
   expect(Number((await simulacao.prisma.contaBancaria.findUniqueOrThrow({ where: { id: "banco" } })).saldoInicial)).toBe(1000);
   expect(await simulacao.prisma.historicoConciliacao.count()).toBe(1);
 });
 it("recusa conciliar um Saldo do dia importado antes da regra", async () => {
   const lote = await simulacao.prisma.importacaoExtrato.create({ data: { contaBancariaId: "banco", nomeArquivo: "antigo.ofx", hashArquivo: "hash-saldo", formato: "OFX", autorId: "admin", autorNome: "Administrador atual" } });
   const saldo = await simulacao.prisma.transacaoExtrato.create({ data: { contaBancariaId: "banco", importacaoId: lote.id, chave: "saldo-antigo", impressao: "impressao-saldo", data: new Date("2026-09-11T00:00:00Z"), descricao: "SALDO TOTAL DISPONÍVEL DIA", valor: 1000 } });
   const l = await lancamento(1000);
   expect(await conciliarExtratoAction({ transacaoId: saldo.id, lancamentos: [{ id: l.id, versao: l.updatedAt.toISOString() }] })).toEqual({ erro: "Saldo do dia é uma informação do extrato e não pode ser conciliado como movimentação." });
   expect(await simulacao.prisma.vinculoExtrato.count()).toBe(0);
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(0);
 });
 it("reimportação não duplica e conta divergente não é aceita", async () => {
   await importar();
   expect(await importarExtratoAction(formularioTeste())).toMatchObject({ importadas: 0 });
   expect(await prepararExtratoAction(formularioTeste(ofxTeste("-10", "outra", "54321")))).toHaveProperty("erro");
   expect(await simulacao.prisma.transacaoExtrato.count()).toBe(1);
 });
 it("OFX de período sobreposto preserva vínculo, histórico e baixa anteriores", async () => {
   const t = await importar(); await conciliarExtratoAction({ transacaoId: t.id, novo });
   const antes = await simulacao.prisma.transacaoExtrato.findUniqueOrThrow({ where: { id: t.id }, include: { vinculos: true, historico: { orderBy: { id: "asc" } } } });
   const trechoNovo = ofxTeste("-20.00", "novo-id").match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/)![0];
   const f = formularioTeste(ofxTeste().replace("</BANKTRANLIST>", trechoNovo + "</BANKTRANLIST>"));
   const previa = await prepararExtratoAction(f); expect(previa).toHaveProperty("previa");
   if ("erro" in previa) return;
   expect(previa.previa.linhas[0]).toMatchObject({ situacao: "EXISTENTE", conciliada: true });
   expect(previa.previa.linhas[1]).toMatchObject({ situacao: "NOVA", conciliada: false });
   f.set("indices", "[0,1]"); expect(await importarExtratoAction(f)).toMatchObject({ importadas: 1 });
   expect(await simulacao.prisma.transacaoExtrato.findUniqueOrThrow({ where: { id: t.id }, include: { vinculos: true, historico: { orderBy: { id: "asc" } } } })).toEqual(antes);
   expect(await simulacao.prisma.transacaoExtrato.count()).toBe(2);
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(1);
 });
 it("novo arquivo CSV com possível duplicada exige escolha explícita e preserva idênticas legítimas", async () => {
   const csv = 'Data;Descrição;Valor\n11/09/2026;PIX;-125,55'; await importar(csv, "banco.csv");
   const f = formularioTeste(csv + '\n', "outro.csv");
   const r = await prepararExtratoAction(f); expect(r).toHaveProperty("previa"); if ("erro" in r) return;
   expect(r.previa.linhas[0].situacao).toBe("POSSIVEL_DUPLICADA");
   expect(await importarExtratoAction(f)).toHaveProperty("erro");
   f.set("confirmarDuplicadas", "sim"); expect(await importarExtratoAction(f)).toMatchObject({ importadas: 1 });
   expect(await simulacao.prisma.transacaoExtrato.count()).toBe(2);
 });
 it("mesmo FITID com valor divergente não sobrescreve a evidência", async () => {
   await importar(); expect(await prepararExtratoAction(formularioTeste(ofxTeste("-1")))).toHaveProperty("erro");
   expect(Number((await simulacao.prisma.transacaoExtrato.findFirstOrThrow()).valor)).toBe(-125.55);
 });
 it("Itaú renumera FITIDs sem duplicar transação legada conciliada nem alterar seu histórico", async () => {
   const original = { id: "20260911001", valor: "-125.55", descricao: "Fornecedor teste" };
   const t = await importar(ofxItauTeste([original]));
   // Reproduz a identidade usada antes da correção, sem migrar evidências antigas.
   await simulacao.prisma.transacaoExtrato.update({ where: { id: t.id }, data: {
     chave: createHash("sha256").update("ID:OFX:" + original.id).digest("hex"),
   } });
   await conciliarExtratoAction({ transacaoId: t.id, novo });
   const antes = await simulacao.prisma.transacaoExtrato.findUniqueOrThrow({ where: { id: t.id }, include: { vinculos: true, historico: true } });
   const f = formularioTeste(ofxItauTeste([
     { id: original.id, valor: "-20.00", descricao: "Outro pagamento" },
     { ...original, id: "20260911004" },
   ]));
   const p = await prepararExtratoAction(f);
   expect(p).toHaveProperty("previa"); if ("erro" in p) return;
   expect(p.previa.linhas.map(l => [l.situacao, l.conciliada])).toEqual([["NOVA", false], ["EXISTENTE", true]]);
   f.set("indices", "[0,1]");
   expect(await importarExtratoAction(f)).toMatchObject({ importadas: 1 });
   expect(await importarExtratoAction(f)).toMatchObject({ importadas: 0 });
   expect(await simulacao.prisma.transacaoExtrato.count()).toBe(2);
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(1);
   expect(await simulacao.prisma.transacaoExtrato.findUniqueOrThrow({ where: { id: t.id }, include: { vinculos: true, historico: true } })).toEqual(antes);
 });
 it("Itaú com descrição alterada permite importar outros dias e exige confirmação da possível duplicada", async () => {
   const original = { id: "20260911002", valor: "0.35", descricao: "REND PAGO APLIC AUT APR" };
   await importar(ofxItauTeste([original]));
   const texto = ofxItauTeste([
     { ...original, descricao: "RENDIMENTOS REND PAGO APLIC AUT MAIS" },
     { id: "20260912001", valor: "-10.00", descricao: "Despesa nova" },
   ]);
   const f = formularioTeste(texto);
   const p = await prepararExtratoAction(f);
   expect(p).toHaveProperty("previa"); if ("erro" in p) return;
   expect(p.previa.linhas[0]).toMatchObject({ situacao: "POSSIVEL_DUPLICADA", observacao: expect.stringContaining("REND PAGO APLIC AUT APR") });
   f.set("indices", "[0]");
   expect(await importarExtratoAction(f)).toHaveProperty("erro");
   f.set("indices", "[1]");
   expect(await importarExtratoAction(f)).toMatchObject({ importadas: 1 });
   expect(await simulacao.prisma.transacaoExtrato.count()).toBe(2);
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(0);
 });
 it("duas importações simultâneas de OFX renumerado do Itaú não duplicam a nova movimentação", async () => {
   const texto = ofxItauTeste([{ id: "20260911001", valor: "-25.00", descricao: "Pagamento novo" }]);
   const resultados = await Promise.all([
     importarExtratoAction(formularioTeste(texto)),
     importarExtratoAction(formularioTeste(texto.replace("20260911001", "20260911004"))),
   ]);
   expect(resultados.every(r => !("erro" in r))).toBe(true);
   expect(resultados.map(r => "importadas" in r ? r.importadas : -1).sort()).toEqual([0, 1]);
   expect(await simulacao.prisma.transacaoExtrato.count()).toBe(1);
 });
 it("baixa pendência na data bancária e preserva a competência para DRE", async () => {
   const t = await importar(); const l = await lancamento();
   expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [{ id: l.id, versao: l.updatedAt.toISOString() }] })).toEqual({ ok: true });
   const salvo = await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: l.id } });
   expect(salvo).toMatchObject({ status: "BAIXADO", contaBancariaId: "banco", dataCompetencia: l.dataCompetencia });
   expect(salvo.dataPagamento!.toISOString()).toBe("2026-09-11T15:00:00.000Z");
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(1);
   expect(await simulacao.prisma.vinculoExtrato.count()).toBe(1);
 });
 it("vincula realizado sem duplicar baixa e rejeita alteração/estorno enquanto conciliado", async () => {
   const t = await importar(); const l = await lancamento();
   await baixarLancamento({ lancamentoId: l.id, contaBancariaId: "banco", dataPagamento: new Date("2026-09-11T15:00:00Z") });
   const salvo = await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: l.id } });
   expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [{ id: l.id, versao: salvo.updatedAt.toISOString() }] })).toEqual({ ok: true });
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(1);
   await expect(estornarBaixaLancamento({ lancamentoId: l.id })).rejects.toThrow(/Desfaça a conciliação/);
   expect(await atualizarLancamentoAction(l.id, new FormData())).toHaveProperty("erro");
 });
 it("compõe uma transação com vários lançamentos e rejeita total diferente sem baixas parciais", async () => {
   const t = await importar(); const a = await lancamento(100); const b = await lancamento(25.55);
   expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [{ id: a.id, versao: a.updatedAt.toISOString() }] })).toHaveProperty("erro");
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(0);
   expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [a, b].map(l => ({ id: l.id, versao: l.updatedAt.toISOString() })) })).toEqual({ ok: true });
   expect(await simulacao.prisma.vinculoExtrato.count()).toBe(2);
 });
 it("compõe receita bruta e despesa de taxa pelo valor líquido do extrato", async () => {
   const t = await importar(ofxTeste("97.00", "recebimento-liquido"));
   const receita = await lancamento(100, { descricao: "Receita bruta", tipo: "RECEITA", categoriaId: "receita" });
   const taxa = await lancamento(3, { descricao: "Taxa do recebimento" });

   expect(await conciliarExtratoAction({
     transacaoId: t.id,
     lancamentos: [receita, taxa].map(l => ({ id: l.id, versao: l.updatedAt.toISOString() })),
   })).toEqual({ ok: true });

   expect(await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: receita.id } })).toMatchObject({ status: "BAIXADO", contaBancariaId: "banco" });
   expect(await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: taxa.id } })).toMatchObject({ status: "BAIXADO", contaBancariaId: "banco" });
   expect(await simulacao.prisma.movimentacaoBancaria.findMany({ orderBy: { tipo: "asc" } })).toMatchObject([
     { lancamentoId: receita.id, tipo: "ENTRADA", valor: expect.anything() },
     { lancamentoId: taxa.id, tipo: "SAIDA", valor: expect.anything() },
   ]);
   expect(await simulacao.prisma.historicoConciliacao.findFirstOrThrow({ where: { transacaoId: t.id, acao: "CONCILIACAO" } })).toMatchObject({
     detalhes: expect.objectContaining({ valorLiquidoConciliado: "97.00" }),
   });
 });
 it("vincula lançamentos mistos já realizados sem exigir o tipo do extrato", async () => {
   const t = await importar(ofxTeste("97.00", "recebimento-realizado"));
   const receita = await lancamento(100, { descricao: "Receita realizada", tipo: "RECEITA", categoriaId: "receita" });
   const taxa = await lancamento(3, { descricao: "Taxa realizada" });
   const data = new Date("2026-09-11T15:00:00Z");
   await baixarLancamento({ lancamentoId: receita.id, contaBancariaId: "banco", dataPagamento: data });
   await baixarLancamento({ lancamentoId: taxa.id, contaBancariaId: "banco", dataPagamento: data });
   const atualizados = await simulacao.prisma.lancamentoFinanceiro.findMany({ where: { id: { in: [receita.id, taxa.id] } } });

   expect(await conciliarExtratoAction({
     transacaoId: t.id,
     lancamentos: atualizados.map(l => ({ id: l.id, versao: l.updatedAt.toISOString() })),
   })).toEqual({ ok: true });
   expect(await simulacao.prisma.vinculoExtrato.count()).toBe(2);
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(2);
 });
 it("duas confirmações concorrentes criam um único lançamento e vínculo", async () => {
   const t = await importar(); const resultados = await Promise.all([conciliarExtratoAction({ transacaoId: t.id, novo }), conciliarExtratoAction({ transacaoId: t.id, novo })]);
   expect(resultados.filter(r => "ok" in r)).toHaveLength(1);
   expect(await simulacao.prisma.lancamentoFinanceiro.count()).toBe(1);
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(1);
 });
 it("cria receita com dados para caixa e DRE sem duplicação e na competência informada", async () => {
   const t = await importar(ofxTeste("125.55"));
   expect(await conciliarExtratoAction({ transacaoId: t.id, novo: { ...novo, categoriaId: "receita" } })).toEqual({ ok: true });
    const l = await simulacao.prisma.lancamentoFinanceiro.findFirstOrThrow();
    expect(l).toMatchObject({ descricao: "DESPESA CONCILIADA", contraparteNome: "CLIENTE SÃO JOÃO" });
   const dados = { ...l, valor: Number(l.valor), categoriaGrupo: "RECEITA_BRUTA" as const, categoriaNome: "Receita", dataCompetencia: l.dataCompetencia.toISOString(), dataVencimento: l.dataVencimento.toISOString(), dataPagamento: l.dataPagamento!.toISOString() };
   const dre = calcularDre([dados], { de: new Date("2026-08-01"), ate: new Date("2026-08-31T23:59:59Z") }, "COMPETENCIA");
   expect(dre.faturamentoBruto).toBe(125.55);
   const caixa = calcularPlanilhaFluxoCaixa(1000, [dados], { de: "2026-09-01", ate: "2026-09-30" });
   expect(caixa.totalReceitasGeral).toBe(125.55); expect(caixa.saldoFinal).toBe(1125.55);
 });
  it("desfaz somente o vínculo com motivo e autoria, preservando a baixa", async () => {
   const t = await importar(); expect(await conciliarExtratoAction({ transacaoId: t.id, novo })).toEqual({ ok: true });
   const antes = await simulacao.prisma.movimentacaoBancaria.findMany();
   expect(await desfazerConciliacaoAction(t.id, "Conciliação incorreta")).toEqual({ ok: true });
   expect(await simulacao.prisma.movimentacaoBancaria.findMany()).toEqual(antes);
   expect((await simulacao.prisma.lancamentoFinanceiro.findFirstOrThrow()).status).toBe("BAIXADO");
   expect(await simulacao.prisma.historicoConciliacao.findFirst({ where: { acao: "DESCONCILIACAO" } })).toMatchObject({ autorId: "admin", autorNome: "Administrador atual", motivo: "Conciliação incorreta" });
   expect(await simulacao.prisma.vinculoExtrato.count()).toBe(0);
    await expect(estornarBaixaLancamento({ lancamentoId: antes[0].lancamentoId! })).resolves.toBeUndefined();
  });
  it("cancelar baixa conciliada desfaz o vínculo, audita e devolve somente o lançamento escolhido a pendente", async () => {
    const t = await importar();
    const a = await lancamento(100, { descricao: "Primeira parte" });
    const b = await lancamento(25.55, { descricao: "Segunda parte" });
    expect(await conciliarExtratoAction({
      transacaoId: t.id,
      lancamentos: [a, b].map((item) => ({ id: item.id, versao: item.updatedAt.toISOString() })),
    })).toEqual({ ok: true });

    expect(await estornarBaixaLancamentoAction(a.id)).toEqual({ ok: true });
    expect(await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({
      status: "PENDENTE",
      dataPagamento: null,
      contaBancariaId: null,
    });
    expect(await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({
      status: "BAIXADO",
      contaBancariaId: "banco",
    });
    expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(1);
    expect(await simulacao.prisma.vinculoExtrato.count()).toBe(0);
    expect(await simulacao.prisma.transacaoExtrato.findUniqueOrThrow({ where: { id: t.id } })).toMatchObject({
      conciliadaEm: null,
      conciliadaPorNome: null,
    });
    expect(await simulacao.prisma.historicoConciliacao.findFirst({
      where: { transacaoId: t.id, acao: "DESCONCILIACAO" },
      orderBy: { createdAt: "desc" },
    })).toMatchObject({
      autorId: "admin",
      autorNome: "Administrador atual",
      motivo: "Baixa cancelada pelo usuário.",
      detalhes: expect.objectContaining({
        baixaCanceladaId: a.id,
        baixasPreservadas: false,
        origem: "CANCELAMENTO_DA_BAIXA",
      }),
    });
  });
  it("não desfaz a conciliação ao cancelar baixa sem a permissão específica", async () => {
    const t = await importar();
    const l = await lancamento();
    expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [{ id: l.id, versao: l.updatedAt.toISOString() }] })).toEqual({ ok: true });
    const perfil = await simulacao.prisma.perfilAcesso.create({
      data: {
        nome: "Financeiro sem desconciliação " + randomUUID(),
        permissoes: {
          "financeiro.baixas": ["visualizar", "editar"],
          "financeiro.estornos": ["visualizar", "editar"],
          "financeiro.movimentacoes": ["visualizar"],
          "financeiro.conciliacao": ["visualizar"],
        },
      },
    });
    await simulacao.prisma.usuario.update({ where: { id: "admin" }, data: { perfilAcessoId: perfil.id } });
    simulacao.sessao.mockResolvedValue({
      userId: "admin",
      nome: "Administrador atual",
      email: "admin@example.invalid",
      admin: false,
      versao: 0,
      perfilNome: perfil.nome,
      permissoes: perfil.permissoes,
      excecoes: {},
    });

    expect(await estornarBaixaLancamentoAction(l.id)).toHaveProperty("erro");
    expect(await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({ status: "BAIXADO" });
    expect(await simulacao.prisma.vinculoExtrato.count()).toBe(1);
    expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(1);
  });
 it("bloqueia categoria de tipo incorreto, competência inválida, versão antiga e conta inativa", async () => {
   const t = await importar(); const l = await lancamento();
   expect(await conciliarExtratoAction({ transacaoId: t.id, novo: { ...novo, categoriaId: "receita" } })).toHaveProperty("erro");
   expect(await conciliarExtratoAction({ transacaoId: t.id, novo: { ...novo, dataCompetencia: "2026-02-30" } })).toHaveProperty("erro");
   expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [{ id: l.id, versao: "antiga" }] })).toHaveProperty("erro");
   await simulacao.prisma.contaBancaria.update({ where: { id: "banco" }, data: { ativo: false } });
   expect(await conciliarExtratoAction({ transacaoId: t.id, novo })).toHaveProperty("erro");
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(0);
 });
 it("revogação de sessão impede escrita mesmo com admin antigo no cookie", async () => {
   const t = await importar();
   await simulacao.prisma.usuario.update({ where: { id: "admin" }, data: { sessaoVersao: 1 } });
   expect(await conciliarExtratoAction({ transacaoId: t.id, novo })).toHaveProperty("erro");
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(0);
 });
 it("perfil pode vincular realizado sem ganhar acesso a criar, baixar ou desfazer", async () => {
   const t = await importar(); const l = await lancamento();
   const perfil = await simulacao.prisma.perfilAcesso.create({ data: { nome: "Conferente " + randomUUID(), permissoes: { "financeiro.movimentacoes": ["visualizar"], "financeiro.conciliacao": ["visualizar", "editar"] } } });
   await simulacao.prisma.usuario.update({ where: { id: "admin" }, data: { perfilAcessoId: perfil.id } });
   expect(await conciliarExtratoAction({ transacaoId: t.id, novo })).toHaveProperty("erro");
   expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [{ id: l.id, versao: l.updatedAt.toISOString() }] })).toHaveProperty("erro");
   expect(await importarExtratoAction(formularioTeste(ofxTeste("-20", "outro")))).toHaveProperty("erro");
   expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(0);
   await baixarLancamento({ lancamentoId: l.id, contaBancariaId: "banco", dataPagamento: new Date("2026-09-11T15:00:00Z") });
   const atualizado = await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: l.id } });
   expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [{ id: l.id, versao: atualizado.updatedAt.toISOString() }] })).toEqual({ ok: true });
   expect(await desfazerConciliacaoAction(t.id, "Tentativa sem permissão")).toHaveProperty("erro");
   expect(await simulacao.prisma.vinculoExtrato.count()).toBe(1);
 });
 it("realizado em data diferente não muda de data nem ganha vínculo", async () => {
   const t = await importar(); const l = await lancamento();
   await baixarLancamento({ lancamentoId: l.id, contaBancariaId: "banco", dataPagamento: new Date("2026-09-10T15:00:00Z") });
   const atualizado = await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: l.id } });
   expect(await conciliarExtratoAction({ transacaoId: t.id, lancamentos: [{ id: l.id, versao: atualizado.updatedAt.toISOString() }] })).toHaveProperty("erro");
   expect(await simulacao.prisma.vinculoExtrato.count()).toBe(0);
   expect((await simulacao.prisma.movimentacaoBancaria.findFirstOrThrow()).data).toEqual(new Date("2026-09-10T15:00:00Z"));
 });
 it("falha no histórico desfaz criação, baixa e vínculo juntos", async () => {
   const t = await importar();
   await banco!.query(`CREATE FUNCTION falhar_auditoria_conciliacao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Falha simulada'; END $$`);
   await banco!.query(`CREATE TRIGGER falha_auditoria BEFORE INSERT ON "HistoricoConciliacao" FOR EACH ROW EXECUTE FUNCTION falhar_auditoria_conciliacao()`);
   try {
     expect(await conciliarExtratoAction({ transacaoId: t.id, novo })).toHaveProperty("erro");
     expect(await simulacao.prisma.lancamentoFinanceiro.count()).toBe(0); expect(await simulacao.prisma.movimentacaoBancaria.count()).toBe(0); expect(await simulacao.prisma.vinculoExtrato.count()).toBe(0);
   } finally { await banco!.query('DROP TRIGGER falha_auditoria ON "HistoricoConciliacao"'); }
 });
});
