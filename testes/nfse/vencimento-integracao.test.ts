import { prepararDependenciaAtendimento } from "../vendas/dependencia-atendimento";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PrismaClient } from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));
const estado = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return estado.prisma; } }));
import { decidirNfse } from "@/lib/nfse/situacao";
import { lancarNfse } from "@/lib/nfse/servico";

const esquema = "teste_nfse_vencimento_" + randomUUID().replaceAll("-", "");
const notaLegadaId = "nfse-legada-sintetica";
const competencia = new Date("2026-09-01T12:00:00.000Z");
const emissao = new Date("2026-09-15T12:00:00.000Z");
let banco: Client | undefined;
let criado = false;

async function criarNota(dados: { dataCompetencia?: Date | null; dataEmissao?: Date | null } = {}) {
  return estado.prisma.notaFiscalServico.create({ data: {
    identificador: "NFSE-FICTICIA-" + randomUUID(), origem: "NACIONAL", numero: "42",
    prestadorNome: "Prestador sintético", valorServico: "100.00", valorLiquido: "100.00",
    dataCompetencia: competencia, dataEmissao: emissao, ...dados,
  } });
}

function lancamentoTeste(nfseId: string) {
  return {
    nfseId, categoriaId: "despesa-nfse-teste", descricao: "Serviço sintético",
    dataVencimento: "2026-12-02", autorId: "autor-nfse-teste", autorNome: "Operador sintético",
  };
}

describe.skipIf(process.env.NFSE_VENCIMENTO_BANCO_TESTE !== "1")("vencimento NFS-e no PostgreSQL sintético", () => {
  beforeAll(async () => {
    // Sem dotenv: a conexão sintética deve ser fornecida explicitamente pelo runner.
    const endereco = new URL(process.env.DATABASE_URL ?? "http://invalido");
    if (!["postgres:", "postgresql:"].includes(endereco.protocol)
      || !["127.0.0.1", "localhost"].includes(endereco.hostname)
      || !/^\/(?:teste_[a-z0-9_]+|[a-z0-9_]+_teste)$/.test(endereco.pathname)) {
      throw new Error("NFS-e exige PostgreSQL local e banco sintético identificado como teste.");
    }
    banco = new Client({ connectionString: endereco.toString(), connectionTimeoutMillis: 10_000 });
    await banco.connect();
    const identidade = await banco.query("SELECT current_database() AS banco, inet_server_port() AS porta");
    expect(identidade.rows[0]).toEqual({ banco: endereco.pathname.slice(1), porta: Number(endereco.port || 5432) });
    await banco.query(`CREATE SCHEMA "${esquema}"`);
    criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    let legadoPreparado = false;
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      if (pasta.name === "20261104120000_manifestacao_datas_tratamento") {
        await banco.query(`INSERT INTO "NotaFiscalServico" ("id", "identificador", "origem", "status", "dataCompetencia", "dataEmissao", "createdAt", "updatedAt") VALUES ($1, $2, 'NACIONAL', 'ACEITA', $3, $4, NOW(), NOW())`, [notaLegadaId, "NFSE-LEGADA-FICTICIA", competencia.toISOString(), emissao.toISOString()]);
        legadoPreparado = true;
      }
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await prepararDependenciaAtendimento(banco, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8"))));
    }
    expect(legadoPreparado).toBe(true);
    estado.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: endereco.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await estado.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    await estado.prisma.usuario.create({ data: { id: "autor-nfse-teste", nome: "Operador sintético", email: "nfse-vencimento@example.invalid", senhaHash: "sem-login" } });
    await estado.prisma.categoriaFinanceira.create({ data: { id: "despesa-nfse-teste", nome: "Serviços sintéticos", grupo: "DESPESAS_OPERACIONAIS" } });
    await banco.query(`CREATE FUNCTION "${esquema}"."falhar_evento_nfse_teste"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."criadoPorNome" = 'Falha sintética da auditoria' THEN RAISE EXCEPTION 'Falha sintética da auditoria'; END IF; RETURN NEW; END $$`);
    await banco.query(`CREATE TRIGGER "falhar_evento_nfse_teste" BEFORE INSERT ON "EventoNfse" FOR EACH ROW EXECUTE FUNCTION "${esquema}"."falhar_evento_nfse_teste"()`);
  }, 120_000);

  afterAll(async () => {
    await estado.prisma?.$disconnect();
    if (banco) {
      try {
        await banco.query("ROLLBACK");
        if (criado && /^teste_nfse_vencimento_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
      } finally { await banco.end(); }
    }
  });

  it("adiciona DATE nullable sem preencher vencimento ou alterar datas de uma nota anterior", async () => {
    const coluna = await banco!.query("SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name='NotaFiscalServico' AND column_name='dataVencimento'", [esquema]);
    expect(coluna.rows).toEqual([{ data_type: "date", is_nullable: "YES" }]);
    const legado = await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: notaLegadaId } });
    expect(legado).toMatchObject({ status: "ACEITA", destinoFinanceiro: null, dataVencimento: null, dataCompetencia: competencia, dataEmissao: emissao });
    expect(await estado.prisma.notaFiscalServicoLancamento.count({ where: { notaFiscalServicoId: notaLegadaId } })).toBe(0);
  });

  it("persiste o dia civil inclusive em ano bissexto, sem financeiro ou mudança da competência", async () => {
    const nota = await criarNota();
    const lancamentosAntes = await estado.prisma.lancamentoFinanceiro.count();
    const movimentosAntes = await estado.prisma.movimentacaoBancaria.count();
    expect(await decidirNfse({ nfseId: nota.id, decisao: "ACEITAR", autorNome: "Operador sintético", dataVencimento: "2028-02-29" })).toEqual({ ok: true });
    const salva = await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: nota.id } });
    expect(salva).toMatchObject({ status: "ACEITA", dataVencimento: new Date("2028-02-29T00:00:00.000Z"), dataCompetencia: competencia, dataEmissao: emissao });
    for (const fuso of ["UTC", "America/Sao_Paulo"]) {
      await banco!.query("SELECT set_config('TimeZone', $1, false)", [fuso]);
      const dia = await banco!.query('SELECT "dataVencimento"::text AS dia FROM "NotaFiscalServico" WHERE id=$1', [nota.id]);
      expect(dia.rows).toEqual([{ dia: "2028-02-29" }]);
    }
    expect(await estado.prisma.notaFiscalServicoLancamento.count({ where: { notaFiscalServicoId: nota.id } })).toBe(0);
    expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(lancamentosAntes);
    expect(await estado.prisma.movimentacaoBancaria.count()).toBe(movimentosAntes);
    expect(await estado.prisma.eventoNfse.count({ where: { notaFiscalId: nota.id, tipo: "ACEITE_NO_HUB", criadoPorNome: "Operador sintético" } })).toBe(1);
  });

  it("conserva o aceite sem data e aceita vencimento passado válido sem completar com hoje", async () => {
    const semData = await criarNota();
    expect(await decidirNfse({ nfseId: semData.id, decisao: "ACEITAR", autorNome: "Operador sintético" })).toEqual({ ok: true });
    expect((await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: semData.id } })).dataVencimento).toBeNull();
    const passada = await criarNota();
    expect(await decidirNfse({ nfseId: passada.id, decisao: "ACEITAR", autorNome: "Operador sintético", dataVencimento: "2026-09-20" })).toEqual({ ok: true });
    expect((await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: passada.id } })).dataVencimento?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("mantém somente a decisão vencedora sob concorrência e não aceita data de formulário antigo", async () => {
    const nota = await criarNota();
    const datas = ["2026-11-20", "2026-11-25"];
    const respostas = await Promise.all(datas.map(dataVencimento => decidirNfse({ nfseId: nota.id, decisao: "ACEITAR", autorNome: "Operador sintético", dataVencimento })));
    expect(respostas.filter(r => "ok" in r)).toHaveLength(1);
    expect(respostas.filter(r => "erro" in r)).toHaveLength(1);
    const vencedora = datas[respostas.findIndex(r => "ok" in r)];
    expect((await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: nota.id } })).dataVencimento?.toISOString().slice(0, 10)).toBe(vencedora);
    expect(await decidirNfse({ nfseId: nota.id, decisao: "ACEITAR", autorNome: "Outro operador sintético", dataVencimento: "2027-01-10" })).toHaveProperty("erro");
    expect(await estado.prisma.eventoNfse.count({ where: { notaFiscalId: nota.id } })).toBe(1);
    expect(await estado.prisma.notaFiscalServicoLancamento.count({ where: { notaFiscalServicoId: nota.id } })).toBe(0);
  });

  it("reverte situação e vencimento se o registro do evento falhar", async () => {
    const nota = await criarNota();
    await expect(decidirNfse({ nfseId: nota.id, decisao: "ACEITAR", autorNome: "Falha sintética da auditoria", dataVencimento: "2026-11-20" })).rejects.toThrow();
    const salva = await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: nota.id } });
    expect(salva).toMatchObject({ status: "PENDENTE", dataVencimento: null, updatedAt: nota.updatedAt });
    expect(await estado.prisma.eventoNfse.count({ where: { notaFiscalId: nota.id } })).toBe(0);
  });

  it("permite editar o vencimento posterior das parcelas sem reescrever a data aceita nem a competência", async () => {
    const nota = await criarNota();
    expect(await decidirNfse({ nfseId: nota.id, decisao: "ACEITAR", autorNome: "Operador sintético", dataVencimento: "2026-11-20" })).toEqual({ ok: true });
    const entrada = {
      nfseId: nota.id, categoriaId: "despesa-nfse-teste", descricao: "Serviço sintético",
      dataVencimento: "2026-12-02", autorId: "autor-nfse-teste", autorNome: "Operador sintético",
      parcelas: [
        { numero: "001", valor: 33.33, dataVencimento: "2026-12-02", formaPagamento: "BOLETO" as const },
        { numero: "002", valor: 66.67, dataVencimento: "2027-01-02", formaPagamento: "BOLETO" as const },
      ],
    };
    expect(await lancarNfse(entrada)).toEqual({ ok: true });
    expect(await lancarNfse(entrada)).toHaveProperty("erro");
    const salva = await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: nota.id } });
    expect(salva).toMatchObject({ status: "LANCADA", dataVencimento: new Date("2026-11-20T00:00:00.000Z"), dataCompetencia: competencia, dataEmissao: emissao });
    const vinculos = await estado.prisma.notaFiscalServicoLancamento.findMany({ where: { notaFiscalServicoId: nota.id }, include: { lancamentoFinanceiro: true }, orderBy: { lancamentoFinanceiro: { dataVencimento: "asc" } } });
    expect(vinculos).toHaveLength(2);
    expect(vinculos.map(v => v.lancamentoFinanceiro.dataVencimento.toISOString().slice(0, 10))).toEqual(["2026-12-02", "2027-01-02"]);
    expect(vinculos.every(v => v.lancamentoFinanceiro.dataCompetencia.getTime() === competencia.getTime() && v.lancamentoFinanceiro.status === "PENDENTE")).toBe(true);
    expect(vinculos.reduce((soma, v) => soma + Number(v.lancamentoFinanceiro.valor), 0)).toBe(100);
    expect(await estado.prisma.movimentacaoBancaria.count({ where: { lancamentoId: { in: vinculos.map(v => v.lancamentoFinanceiroId) } } })).toBe(0);
  });

  it("conserva a emissão como competência quando não há competência própria", async () => {
    const nota = await criarNota({ dataCompetencia: null });
    expect(await decidirNfse({ nfseId: nota.id, decisao: "ACEITAR", autorNome: "Operador sintético", dataVencimento: "2026-11-20" })).toEqual({ ok: true });
    expect(await lancarNfse({ nfseId: nota.id, categoriaId: "despesa-nfse-teste", descricao: "Serviço sintético sem competência", dataVencimento: "2026-11-20", autorId: "autor-nfse-teste", autorNome: "Operador sintético" })).toEqual({ ok: true });
    const vinculo = await estado.prisma.notaFiscalServicoLancamento.findFirstOrThrow({ where: { notaFiscalServicoId: nota.id }, include: { lancamentoFinanceiro: true } });
    expect(vinculo.lancamentoFinanceiro.dataCompetencia).toEqual(emissao);
    expect(vinculo.lancamentoFinanceiro.dataVencimento.toISOString().slice(0, 10)).toBe("2026-11-20");
  });

  it("registra uma nota só no fiscal e bloqueia lançamento inclusive pela regra do banco", async () => {
    const nota = await criarNota();
    const despesasAntes = await estado.prisma.lancamentoFinanceiro.count();
    const movimentosAntes = await estado.prisma.movimentacaoBancaria.count();
    expect(await decidirNfse({ nfseId: nota.id, decisao: "ACEITAR", autorNome: "Operador sintético", destinoFinanceiro: "SOMENTE_FISCAL" })).toEqual({ ok: true });
    expect(await lancarNfse(lancamentoTeste(nota.id))).toHaveProperty("erro");
    await expect(estado.prisma.notaFiscalServico.update({ where: { id: nota.id }, data: { status: "LANCADA" } })).rejects.toThrow();
    const salva = await estado.prisma.notaFiscalServico.findUniqueOrThrow({
      where: { id: nota.id }, include: { lancamentos: true, eventos: true },
    });
    expect(salva).toMatchObject({ status: "ACEITA", destinoFinanceiro: "SOMENTE_FISCAL", dataVencimento: null, lancamentos: [] });
    expect(salva.eventos.map(evento => evento.tipo).sort()).toEqual(["ACEITE_NO_HUB", "DESTINO_SOMENTE_FISCAL_NO_HUB"]);
    expect(await estado.prisma.lancamentoFinanceiro.count()).toBe(despesasAntes);
    expect(await estado.prisma.movimentacaoBancaria.count()).toBe(movimentosAntes);
  });

  it("corrige uma nota antiga sem apagar seu vencimento e bloqueia alterações depois do lançamento", async () => {
    const nota = await criarNota();
    const base = { nfseId: nota.id, autorNome: "Operador sintético" };
    const alteracao = { ...base, decisao: "ALTERAR_DESTINO_FINANCEIRO" as const };
    expect(await decidirNfse({ ...base, decisao: "ACEITAR", dataVencimento: "2026-11-20" })).toEqual({ ok: true });
    expect(await decidirNfse({ ...alteracao, destinoFinanceiroAnterior: null, destinoFinanceiro: "SOMENTE_FISCAL" })).toEqual({ ok: true });
    expect(await decidirNfse({ ...alteracao, destinoFinanceiroAnterior: null, destinoFinanceiro: "FINANCEIRO" })).toHaveProperty("erro");
    expect(await decidirNfse({ ...alteracao, destinoFinanceiroAnterior: "SOMENTE_FISCAL", destinoFinanceiro: "FINANCEIRO" })).toEqual({ ok: true });
    expect(await lancarNfse(lancamentoTeste(nota.id))).toEqual({ ok: true });
    expect(await decidirNfse({ ...alteracao, destinoFinanceiroAnterior: "FINANCEIRO", destinoFinanceiro: "SOMENTE_FISCAL" })).toHaveProperty("erro");
    const salva = await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: nota.id } });
    expect(salva).toMatchObject({ status: "LANCADA", destinoFinanceiro: "FINANCEIRO", dataVencimento: new Date("2026-11-20T00:00:00.000Z") });
    expect(await estado.prisma.notaFiscalServicoLancamento.count({ where: { notaFiscalServicoId: nota.id } })).toBe(1);
  });

  it("serializa o lançamento e a troca para somente fiscal na mesma nota", async () => {
    const nota = await criarNota();
    const base = { nfseId: nota.id, autorNome: "Operador sintético" };
    expect(await decidirNfse({ ...base, decisao: "ACEITAR", destinoFinanceiro: "FINANCEIRO" })).toEqual({ ok: true });
    const [troca, despesa] = await Promise.all([
      decidirNfse({ ...base, decisao: "ALTERAR_DESTINO_FINANCEIRO", destinoFinanceiroAnterior: "FINANCEIRO", destinoFinanceiro: "SOMENTE_FISCAL" }),
      lancarNfse(lancamentoTeste(nota.id)),
    ]);
    expect(["ok" in troca, "ok" in despesa].filter(Boolean)).toHaveLength(1);
    const salva = await estado.prisma.notaFiscalServico.findUniqueOrThrow({ where: { id: nota.id }, include: { lancamentos: true } });
    if ("ok" in troca) {
      expect(salva).toMatchObject({ status: "ACEITA", destinoFinanceiro: "SOMENTE_FISCAL", lancamentos: [] });
    } else {
      expect(salva).toMatchObject({ status: "LANCADA", destinoFinanceiro: "FINANCEIRO" });
      expect(salva.lancamentos).toHaveLength(1);
    }
  });
});
