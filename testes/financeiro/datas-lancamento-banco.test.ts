import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PrismaClient } from "@/generated/prisma/client";
vi.mock("server-only", () => ({}));
const estado = vi.hoisted(() => ({ banco: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return estado.banco; } }));
vi.mock("@/lib/session", () => ({ getSession: async () => ({ userId: "teste-datas" }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn() }));
import { criarLancamentoAction, excluirLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";
const esquema = "teste_datas_" + randomUUID().replaceAll("-", "");
let banco: Client | undefined;
let criado = false;
describe.skipIf(process.env.DATAS_LANCAMENTO_BANCO_TESTE !== "1")("datas e cancelamento avulso no PostgreSQL isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) throw new Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: endereco.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    estado.banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: endereco.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await estado.banco.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    await estado.banco.usuario.create({ data: { id: "teste-datas", nome: "Teste", email: "custos@example.invalid", senhaHash: "sem-login" } });
    const perfil = await estado.banco.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    await estado.banco.usuario.update({ where: { id: "teste-datas" }, data: { perfilAcessoId: perfil.id } });
    await estado.banco.localEstoque.create({ data: { id: "local", nome: "Local de teste" } });
    await estado.banco.categoriaFinanceira.create({ data: { id: "consumo", nome: "Consumo de teste", grupo: "DESPESAS_OPERACIONAIS" } });
  }, 60_000);
  afterAll(async () => {
    await estado.banco?.$disconnect();
    if (banco) {
      await banco.query("ROLLBACK");
      if (criado && /^teste_datas_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
      await banco.end();
    }
  });
  it("impede que um ano incompleto crie título ou movimentação", async () => {
    const f = new FormData();
    for (const [campo, valor] of Object.entries({ tipo: "DESPESA", descricao: "Contabilidade fictícia", valor: "3400", categoriaId: "consumo", dataCompetencia: "2026-09-30", dataVencimento: "0206-10-10" })) f.set(campo, valor);
    expect(await criarLancamentoAction(null, f)).toHaveProperty("erro");
    expect(await estado.banco.lancamentoFinanceiro.count()).toBe(0);
    expect(await estado.banco.movimentacaoBancaria.count()).toBe(0);
  });
  it("cancela o título legado uma vez, registra as datas e conserva banco/estoque", async () => {
    const titulo = await estado.banco.lancamentoFinanceiro.create({ data: { tipo: "DESPESA", descricao: "Legado fictício", valor: 3400, categoriaId: "consumo", dataCompetencia: new Date("2026-09-30T12:00:00Z"), dataVencimento: new Date("0206-10-10T12:00:00Z") } });
    expect(await excluirLancamentoAction(titulo.id)).toEqual({ ok: true, quantidade: 1 });
    expect((await estado.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } })).status).toBe("CANCELADO");
    const auditoria = await estado.banco.historicoAcesso.findFirstOrThrow({ where: { entidadeId: titulo.id } });
    expect(auditoria.autorId).toBe("teste-datas");
    expect(auditoria.antes).toMatchObject({ valor: "3400", dataVencimento: "0206-10-10T12:00:00.000Z" });
    expect(await excluirLancamentoAction(titulo.id)).toHaveProperty("erro");
    expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: titulo.id } })).toBe(1);
    expect(await estado.banco.movimentacaoBancaria.count()).toBe(0);
    expect(await estado.banco.movimentacaoEstoque.count()).toBe(0);
  });
  it("reverte o cancelamento inteiro quando o banco recusa a auditoria", async () => {
    const titulo = await estado.banco.lancamentoFinanceiro.create({ data: { tipo: "DESPESA", descricao: "Rollback fictício", valor: 20, categoriaId: "consumo", dataCompetencia: new Date("2026-09-30T12:00:00Z"), dataVencimento: new Date("2026-10-10T12:00:00Z") } });
    await banco!.query('ALTER TABLE "HistoricoAcesso" ADD CONSTRAINT impedir_auditoria_teste CHECK ("acao" <> \'CANCELAMENTO\') NOT VALID');
    try {
      expect(await excluirLancamentoAction(titulo.id)).toHaveProperty("erro");
      expect((await estado.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } })).status).toBe("PENDENTE");
      expect(await estado.banco.historicoAcesso.count({ where: { entidadeId: titulo.id } })).toBe(0);
    } finally {
      await banco!.query('ALTER TABLE "HistoricoAcesso" DROP CONSTRAINT impedir_auditoria_teste');
    }
  });
});
