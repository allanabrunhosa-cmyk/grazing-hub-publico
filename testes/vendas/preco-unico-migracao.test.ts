import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

const esquema = `teste_preco_unico_${randomUUID().replaceAll("-", "")}`;
let banco: Client;
let criado = false;
describe.skipIf(process.env.VENDAS_BANCO_TESTE !== "1")("migração aditiva do preço único", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: url.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory() && p.name < "20261005120000_preco_unico").sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
  }, 90000);
  afterAll(async () => {
    if (!banco) return;
    if (criado && /^teste_preco_unico_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  });
  it("consolida Site vigente, preserva zero, aplica fallback e mantém vendas/legado com auditoria", async () => {
    for (const [id, complemento] of [["site", null], ["zero", null], ["complemento", "10.25"], ["fallback", null], ["sem", null]] as const) {
      await banco.query('INSERT INTO "ProdutoVenda" (id,nome,"precoComplemento","updatedAt") VALUES ($1,$1,$2,now())', [id, complemento]);
    }
    for (const [produto, canal, preco, promocao] of [["site", "SITE", "100", "80"], ["site", "IFOOD", "130", null], ["zero", "SITE", "0", null], ["zero", "IFOOD", "99", null], ["complemento", "IFOOD", "15", null], ["fallback", "IFOOD", "50", "45"]] as const) {
      await banco.query('INSERT INTO "PrecoProdutoVenda" ("produtoId",canal,preco,"precoPromocional") VALUES ($1,$2,$3,$4)', [produto, canal, preco, promocao]);
    }
    await banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt") VALUES ('autor','Pessoa sintética','preco-unico@example.invalid','hash-sintetico',now())`);
    await banco.query(`INSERT INTO "PedidoVenda" (id,"chaveCriacao","hashCriacao","criadoPorId",total,"updatedAt") VALUES ('pedido','chave-sintetica','hash-sintetico','autor',130,now())`);
    await banco.query(`INSERT INTO "ItemPedidoVenda" (id,"pedidoId","produtoId","versaoPedido",ordem,quantidade,"unidadeSnapshot","produtoSnapshot","escolhasSnapshot","estadoComposicao","precoOriginal","precoAplicado",acrescimos,"totalLinha") VALUES ('item','pedido','site',1,0,1,'UN','{"precoCanal":"130"}','[]','PENDENTE',130,130,0,130)`);
    const legados = (await banco.query('SELECT * FROM "PrecoProdutoVenda" ORDER BY "produtoId",canal')).rows;
    const vendas = (await banco.query('SELECT * FROM "PedidoVenda"')).rows;
    const itens = (await banco.query('SELECT * FROM "ItemPedidoVenda"')).rows;
    await banco.query(await readFile("prisma/migrations/20261005120000_preco_unico/migration.sql", "utf8"));
    expect((await banco.query('SELECT id,preco,versao FROM "ProdutoVenda" ORDER BY id')).rows).toEqual([
      { id: "complemento", preco: "10.25", versao: 2 }, { id: "fallback", preco: "45.00", versao: 2 }, { id: "sem", preco: "0.00", versao: 2 }, { id: "site", preco: "80.00", versao: 2 }, { id: "zero", preco: "0.00", versao: 2 },
    ]);
    expect((await banco.query('SELECT * FROM "PrecoProdutoVenda" ORDER BY "produtoId",canal')).rows).toEqual(legados);
    expect((await banco.query('SELECT * FROM "PedidoVenda"')).rows).toEqual(vendas);
    expect((await banco.query('SELECT * FROM "ItemPedidoVenda"')).rows).toEqual(itens);
    const historicos = (await banco.query('SELECT "registroId",antes,depois FROM "HistoricoCadastroVenda" WHERE entidade=$1 ORDER BY "registroId"', ["PRECO_UNICO_MIGRACAO"])).rows;
    expect(historicos).toHaveLength(5);
    expect(historicos.find(h => h.registroId === "site")).toMatchObject({ antes: { precos: expect.arrayContaining([expect.objectContaining({ canal: "IFOOD", preco: 130 })]) }, depois: { preco: "80.00", fonte: "SITE", versao: 2 } });
    await expect(banco.query('UPDATE "ProdutoVenda" SET preco=-1 WHERE id=$1', ["site"])).rejects.toThrow("ProdutoVenda_preco_nao_negativo");
  });
});
