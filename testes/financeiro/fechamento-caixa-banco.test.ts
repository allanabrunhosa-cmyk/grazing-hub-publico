import { limparIntegracaoHubIsolada, prepararMigrationHubIsolada } from "../login/migrations-hub-isoladas";
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
vi.mock("@/lib/session", () => ({ getSession: async () => ({ userId: "teste-fechamento", nome: "Administradora fictícia" }) }));
import { baixarLancamento, estornarBaixaLancamento } from "@/lib/financeiro/baixarLancamento";
import { consultarFechamentoCaixa, fecharMesCaixa, reabrirMesCaixa } from "@/lib/financeiro/fechamento-caixa";
import type { SessaoAtual } from "@/lib/session";

const esquema = "teste_fechamento_" + randomUUID().replaceAll("-", "");
const admin = { userId: "teste-fechamento", nome: "Administradora fictícia", admin: true } as SessaoAtual;
const comum = { ...admin, admin: false } as SessaoAtual;
const hoje = "2026-11-24";
let banco: Client | undefined;
let criado = false;

describe.skipIf(process.env.FECHAMENTO_BANCO_TESTE !== "1")("fechamento do mês do fluxo de caixa no PostgreSQL isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) throw new Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: endereco.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await banco.query(await prepararMigrationHubIsolada(banco, esquema, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    estado.banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: endereco.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await estado.banco.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    await estado.banco.usuario.create({ data: { id: "teste-fechamento", nome: "Administradora fictícia", email: "fechamento@example.invalid", senhaHash: "sem-login" } });
    await estado.banco.categoriaFinanceira.create({ data: { id: "consumo", nome: "Consumo de teste", grupo: "DESPESAS_OPERACIONAIS" } });
    await estado.banco.contaBancaria.create({ data: { id: "conta", nome: "Conta fictícia", saldoInicial: 0 } });
  }, 60_000);
  afterAll(async () => {
    await estado.banco?.$disconnect();
    if (banco) {
      await limparIntegracaoHubIsolada(banco, esquema);
      if (criado && /^teste_fechamento_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
      await banco.end();
    }
  });

  const titulo = (id: string) => estado.banco.lancamentoFinanceiro.create({ data: { id, tipo: "DESPESA", descricao: `Despesa fictícia ${id}`, valor: 100, categoriaId: "consumo", dataCompetencia: new Date("2026-09-10T12:00:00"), dataVencimento: new Date("2026-09-10T12:00:00") } });
  const fechar = (mes: string, sessao = admin) => estado.banco.$transaction(tx => fecharMesCaixa(tx, mes, sessao, hoje));
  const reabrir = (motivo: string, sessao = admin) => estado.banco.$transaction(tx => reabrirMesCaixa(tx, motivo, sessao));
  const baixar = (id: string, dia: string) => baixarLancamento({ lancamentoId: id, contaBancariaId: "conta", dataPagamento: new Date(`${dia}T12:00:00`) });

  it("só administrador fecha, e apenas mês encerrado e posterior ao último fechamento", async () => {
    await expect(fechar("2026-09", comum)).rejects.toThrow("Somente administradores");
    await expect(fechar("2026-11")).rejects.toThrow("já terminou");
    await expect(fechar("2026-13")).rejects.toThrow("mês válido");
    expect(await fechar("2026-09")).toEqual({ fechadoAte: "2026-09-30", mes: "2026-09" });
    await expect(fechar("2026-09")).rejects.toThrow("já está fechado até 30/09/2026");
    await expect(fechar("2026-08")).rejects.toThrow("já está fechado até 30/09/2026");
  });

  it("bloqueia baixa e estorno com data no período fechado e libera o período aberto", async () => {
    await titulo("a"); await titulo("b");
    await expect(baixar("a", "2026-09-30")).rejects.toThrow("fechado até 30/09/2026");
    await expect(baixar("a", "2026-08-01")).rejects.toThrow("fechado até 30/09/2026");
    expect((await estado.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: "a" } })).status).toBe("PENDENTE");
    expect(await estado.banco.movimentacaoBancaria.count()).toBe(0);
    await baixar("a", "2026-10-01");
    await baixar("b", "2026-10-20");
    expect(await estado.banco.movimentacaoBancaria.count()).toBe(2);
    await fechar("2026-10");
    await expect(estornarBaixaLancamento({ lancamentoId: "a" })).rejects.toThrow("fechado até 31/10/2026");
    expect((await estado.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: "a" } })).status).toBe("BAIXADO");
  });

  it("reabre o último mês com motivo, recua o bloqueio e conserva o histórico", async () => {
    await expect(reabrir("ok")).rejects.toThrow("motivo");
    await expect(reabrir("Corrigir baixa lançada no mês errado", comum)).rejects.toThrow("Somente administradores");
    expect(await reabrir("Corrigir baixa lançada no mês errado")).toEqual({ fechadoAte: "2026-09-30", mes: "2026-10" });
    await estornarBaixaLancamento({ lancamentoId: "a" });
    expect((await estado.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: "a" } })).status).toBe("PENDENTE");
    const consulta = await consultarFechamentoCaixa(estado.banco);
    expect(consulta.fechadoAte).toBe("2026-09-30");
    expect(consulta.historico.map(h => [h.mes, h.reabertoPorNome, h.motivoReabertura])).toEqual(expect.arrayContaining([
      ["2026-10", "Administradora fictícia", "Corrigir baixa lançada no mês errado"], ["2026-09", null, null],
    ]));
    // O mês reaberto pode ser fechado de novo; o registro anterior permanece.
    await fechar("2026-10");
    expect(await estado.banco.fechamentoCaixa.count({ where: { mes: "2026-10" } })).toBe(2);
    expect(await estado.banco.atividadeUsuario.count({ where: { entidade: "FechamentoCaixa" } })).toBe(4);
  });
});
