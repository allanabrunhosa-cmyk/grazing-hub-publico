import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import origem from "../../docs/plano-contas-takeat.json";

const sql = readFileSync(new URL("../../prisma/migrations/20260911040000_plano_contas_takeat/migration.sql", import.meta.url), "utf8");
const esquema = "teste_plano_takeat_" + randomUUID().replaceAll("-", "");
let banco: Client;
let criado = false;
describe.skipIf(process.env.PLANO_BANCO_TESTE !== "1")("importação Takeat no PostgreSQL local isolado", () => {
  beforeAll(async () => {
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) throw new Error("Permitido apenas no banco local.");
    banco = new Client({ connectionString: process.env.DATABASE_URL });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`);
    criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    await banco.query(`
      CREATE TYPE "GrupoDre" AS ENUM ('CMV','DESPESAS_OPERACIONAIS','DEDUCOES_RECEITA','FOLHA_PAGAMENTO');
      CREATE TABLE "CategoriaFinanceira" (id TEXT PRIMARY KEY, nome TEXT NOT NULL, grupo "GrupoDre" NOT NULL,
        "centroCustoId" TEXT, ativo BOOLEAN DEFAULT true, "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE UNIQUE INDEX "CategoriaFinanceira_nome_grupo_key" ON "CategoriaFinanceira"(nome, grupo);
      CREATE TABLE lancamento_preservado (id TEXT PRIMARY KEY, categoria TEXT REFERENCES "CategoriaFinanceira"(id), valor NUMERIC);
      INSERT INTO "CategoriaFinanceira"(id,nome,grupo,"centroCustoId",ativo) VALUES
        ('insumo-antigo','Insumos','CMV',null,true),
        ('marketing-antigo','Marketing','DESPESAS_OPERACIONAIS','centro-antigo',false),
        ('aluguel-antigo','Aluguel','DESPESAS_OPERACIONAIS',null,true),
        ('salario-antigo','Salários','FOLHA_PAGAMENTO',null,true);
      INSERT INTO lancamento_preservado VALUES ('nf','insumo-antigo',449.68),('aluguel','aluguel-antigo',800),('salario','salario-antigo',2000);
    `);
    await banco.query(sql);
  });
  afterAll(async () => {
    if (banco) {
      await banco.query("ROLLBACK");
      if (criado && /^teste_plano_takeat_[a-f0-9]+$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
      await banco.end();
    }
  });
  it("copia os 89 nós, nomes, classificações e vínculos da origem", async () => {
    const registros = (await banco.query('SELECT * FROM "CategoriaFinanceira"')).rows;
    const grupos: Record<string, string> = { operacional: "DESPESAS_OPERACIONAIS", insumos: "CMV", "Deduções da receita": "DEDUCOES_RECEITA" };
    let quantidade = 0;
    function conferir(nos: { nome: string; subcategorias?: { nome: string; subcategorias?: unknown[] }[] }[], pai: string | null, grupo: string) {
      for (const no of nos) {
        const encontrados = registros.filter(r => r.nome === no.nome && r.paiId === pai && r.grupo === grupo);
        expect(encontrados).toHaveLength(1);
        quantidade++;
        conferir(no.subcategorias as typeof nos ?? [], encontrados[0].id, grupo);
      }
    }
    for (const raiz of origem.categorias) conferir([raiz], null, grupos[raiz.classificacao]);
    expect(quantidade).toBe(89);
    expect(registros).toHaveLength(90); // 89 da origem + Salários legado em outro grupo.
  });
  it("preserva IDs, valores, classificação anterior, centro de custo e situação", async () => {
    expect((await banco.query("SELECT * FROM lancamento_preservado ORDER BY id")).rows).toEqual([
      { id: "aluguel", categoria: "aluguel-antigo", valor: "800" }, { id: "nf", categoria: "insumo-antigo", valor: "449.68" }, { id: "salario", categoria: "salario-antigo", valor: "2000" },
    ]);
    expect((await banco.query('SELECT * FROM "CategoriaFinanceira" WHERE id=$1', ["marketing-antigo"])).rows[0]).toMatchObject({ nome: "Marketing", centroCustoId: "centro-antigo", ativo: false, paiId: "takeat-conta-6" });
    expect((await banco.query('SELECT * FROM "CategoriaFinanceira" WHERE id=$1', ["salario-antigo"])).rows[0]).toMatchObject({ grupo: "FOLHA_PAGAMENTO", paiId: null });
  });
  it("permite nomes iguais em ramos distintos e bloqueia duplicação de irmãos/raízes", async () => {
    expect((await banco.query('SELECT * FROM "CategoriaFinanceira" WHERE nome=$1', ["Serviços terceiros"])).rows).toHaveLength(2);
    await expect(banco.query('INSERT INTO "CategoriaFinanceira"(id,nome,grupo) VALUES ($1,$2,$3)', ["duplicado", "Insumos", "CMV"])).rejects.toMatchObject({ code: "23505" });
    await expect(banco.query('INSERT INTO "CategoriaFinanceira"(id,nome,grupo,"paiId") SELECT $1,nome,grupo,"paiId" FROM "CategoriaFinanceira" WHERE id=$2', ["duplicado", "takeat-conta-6-4-3"])).rejects.toMatchObject({ code: "23505" });
  });
  it("a importação de dados pode ser repetida sem duplicar ou alterar lançamentos", async () => {
    const antes = (await banco.query('SELECT * FROM "CategoriaFinanceira" ORDER BY id')).rows;
    await banco.query("BEGIN;\n" + sql.slice(sql.indexOf("CREATE TEMP TABLE")));
    expect((await banco.query('SELECT * FROM "CategoriaFinanceira" ORDER BY id')).rows).toEqual(antes);
  });
});

