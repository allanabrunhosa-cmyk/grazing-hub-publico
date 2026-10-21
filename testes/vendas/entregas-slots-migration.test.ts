import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
const schema = "teste_frete_slots_" + randomUUID().replaceAll("-", "");
let banco: Client;
const anterior = { ativo: true, origemTipo: "LOJA", origem: {}, veiculo: "CARRO", veiculoPadraoId: "c", maximoMetros: 60000, pedidoMinimo: "100", gratisAPartir: "500",
  veiculos: [{ id: "m", nome: "Moto", perfil: "MOTO", ativo: true }, { id: "c", nome: "Carro", perfil: "CARRO", ativo: true }],
  faixas: [{ id: "7", limiteMetros: 7000, preco: "22.00" }, { id: "8", limiteMetros: 8000, preco: "24.00" }, { id: "60", limiteMetros: 60000, preco: "128.00" }] };
describe.skipIf(process.env.ENTREGAS_BANCO_TESTE !== "1")("Transformação aditiva de frete em banco fictício", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.startsWith("/teste_")) throw Error("Somente banco fictício local.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query('CREATE SCHEMA "' + schema + '"');
    await banco.query('SET search_path TO "' + schema + '"');
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const p of pastas.filter(p => p.name !== "20261003120000_entregas_slots_frete")) await banco.query(prepararSqlMigrationFiscal(p.name, await readFile("prisma/migrations/" + p.name + "/migration.sql", "utf8")));
    await banco.query('INSERT INTO "ConfiguracaoLoja" (id, entregas, "versaoEntregas", "updatedAt") VALUES ($1,$2,3,now())', ["singleton", JSON.stringify(anterior)]);
    await banco.query('INSERT INTO "ProdutoVenda" (id,nome,"updatedAt") VALUES ($1,$2,now())', ["p", "Produto fictício anterior"]);
    await banco.query(await readFile("prisma/migrations/20261003120000_entregas_slots_frete/migration.sql", "utf8"));
  }, 90000);
  afterAll(async () => { if (banco) { await banco.query('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE'); await banco.end(); } });
  it("preserva tabela atual como Moto, inicia Carro na primeira faixa e conserva origem/configuração anteriores", async () => {
    const r = (await banco.query('SELECT entregas, "entregasAntesSlots", "versaoEntregas" FROM "ConfiguracaoLoja"')).rows[0];
    expect(r.entregasAntesSlots).toEqual(anterior); expect(r.versaoEntregas).toBe(4);
    expect(r.entregas).toMatchObject({ modelo: "SLOTS", ativo: false, excecoes: [], pedidoMinimo: null, veiculoPadraoId: null });
    expect(r.entregas.faixas.map((f: { precos: unknown }) => f.precos)).toEqual([{ m: "22.00", c: "24.00" }, { m: "24.00", c: "27.00" }, { m: "128.00", c: "183.00" }]);
    expect((await banco.query('SELECT id,"slotsEntrega" FROM "ProdutoVenda"')).rows).toEqual([{ id: "p", slotsEntrega: null }]);
    expect((await banco.query('SELECT count(*)::int AS total FROM "HistoricoCadastroVenda" WHERE entidade=\'ENTREGAS\'')).rows[0].total).toBe(1);
  });
});
