import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";

describe.skipIf(process.env.ENTRADA_AVULSA_BANCO_TESTE !== "1")("numeração do legado no banco isolado", () => {
  it("migra origens preenchidas sem mudar movimentos ou números dos cabeçalhos", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Somente PostgreSQL local de teste.");
    const schema = "teste_numero_" + randomUUID().replaceAll("-", "");
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    try {
      await db.query(`CREATE SCHEMA "${schema}"`);
      await db.query(`SET search_path TO "${schema}"`);
      const migration = "20261013020000_numeros_entradas_avulsas";
      for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory() && p.name !== migration).sort((a, b) => a.name.localeCompare(b.name))) {
        await db.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
      }
      await db.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt") VALUES ('u','Teste','numero@example.invalid','sem-login',now());
        INSERT INTO "LocalEstoque" (id,nome,"updatedAt") VALUES ('l','Teste',now());
        INSERT INTO "Insumo" (id,nome,unidade,"updatedAt") VALUES ('i','Teste','KG',now());
        INSERT INTO "Fornecedor" (id,nome,cnpj,"updatedAt") VALUES ('f','Teste','11111111000191',now());
        INSERT INTO "EntradaAvulsaCompra" (id,"fornecedorId","dataEntrada","valorProdutos","valorTotal","outrosCustos","criadoPorId")
          VALUES ('c','f',now(),100,100,'[]','u'), ('adotada','f',now(),100,100,'[]','u');
        INSERT INTO "MovimentacaoEstoque" (id,"insumoId","localId",tipo,quantidade,"criadoPorId",observacao)
          VALUES ('m','i','l','AJUSTE_ENTRADA',3.123456789,'u','Entrada manual fictícia');
        INSERT INTO "EntradaAvulsaRegistro" (id,"compraId",tipo,"dataEntrada","criadoPorId","criadoPorNome",snapshot,"chaveOperacao","hashOperacao")
          VALUES ('r','adotada','COMPRA_SIMPLES',now(),'u','Teste','{}','chave-original-teste','hash-teste');`);
      const antes = (await db.query(`SELECT id,quantidade::text FROM "MovimentacaoEstoque" ORDER BY id`)).rows;
      const numeroOriginal = (await db.query(`SELECT numero FROM "EntradaAvulsaRegistro" WHERE id='r'`)).rows[0].numero;
      await db.query(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
      const numeros = (await db.query(`SELECT origem,numero FROM "NumeroEntradaAvulsaLegada" ORDER BY origem`)).rows;
      expect(numeros).toHaveLength(3);
      expect(new Set(numeros.map(n => n.numero)).size).toBe(3);
      expect(numeros.find(n => n.origem === "compra:adotada").numero).toBe(numeroOriginal);
      expect((await db.query(`SELECT id,quantidade::text FROM "MovimentacaoEstoque" ORDER BY id`)).rows).toEqual(antes);
      expect((await db.query(`SELECT numero FROM "EntradaAvulsaRegistro" WHERE id='r'`)).rows[0].numero).toBe(numeroOriginal);
      const proximos = (await db.query(`INSERT INTO "EntradaAvulsaRegistro" (id,tipo,"dataEntrada","criadoPorId","criadoPorNome",snapshot,"chaveOperacao","hashOperacao") VALUES ('novo','OUTRO_MOTIVO',now(),'u','Teste','{}','nova-chave-teste','hash-teste') RETURNING numero`)).rows;
      expect(numeros.some(n => n.numero === proximos[0].numero)).toBe(false);
    } finally {
      await db.query("ROLLBACK");
      if (!/^teste_numero_[a-f0-9]{32}$/.test(schema)) throw new Error("Schema de teste inválido.");
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.end();
    }
  }, 60_000);
});
