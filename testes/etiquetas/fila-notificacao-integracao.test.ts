import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { AvisosFila } from "@/lib/etiquetas/pontos-espera";

describe.skipIf(process.env.ETIQUETAS_BANCO_TESTE !== "1")("aviso da fila no PostgreSQL local", () => {
  let banco: Client;
  let avisos: AvisosFila;
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Teste somente no banco local.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    avisos = new AvisosFila(url.toString());
  });
  afterAll(async () => { await avisos?.encerrar(); await banco?.end(); });
  it("NOTIFY só acorda após commit e evita a espera periódica de cinco segundos", async () => {
    const ponto = "teste-" + randomUUID();
    const inscricao = await avisos.assinar(ponto, new AbortController().signal);
    expect(inscricao).not.toBeNull();
    let acordou = false;
    const inicio = performance.now();
    const esperando = inscricao!.aguardar(4000).then(() => { acordou = true; });
    await banco.query("BEGIN");
    await banco.query("SELECT pg_notify('grazing_etiquetas_fila', $1)", [ponto]);
    expect(acordou).toBe(false);
    await banco.query("COMMIT");
    await esperando;
    const ms = performance.now() - inicio;
    expect(ms).toBeLessThan(2000);
    console.info(`Fila local: sinal após commit em ${ms.toFixed(1)} ms; sem impressão física.`);
    inscricao!.fechar();
  });
});
