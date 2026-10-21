import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { grupoDreLabels } from "@/lib/labels";

const sql = readFileSync(new URL("../../prisma/migrations/20260914213000_reorganizar_despesas_pessoal/migration.sql", import.meta.url), "utf8");
const esquema = "teste_plano_pessoal_" + randomUUID().replaceAll("-", "");
let banco: Client;
let criado = false;

describe("nome do grupo de despesas com pessoal", () => {
  it("apresenta o grupo 05 com o novo nome", () => {
    expect(grupoDreLabels.FOLHA_PAGAMENTO).toBe("Despesas com pessoal");
  });
});

describe.skipIf(process.env.PLANO_PESSOAL_BANCO_TESTE !== "1")("reorganização das despesas com pessoal no PostgreSQL local isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) throw new Error("Permitido apenas no banco local.");
    banco = new Client({ connectionString: endereco.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`);
    criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    await banco.query(`
      CREATE TYPE "GrupoDre" AS ENUM ('FOLHA_PAGAMENTO', 'DESPESAS_OPERACIONAIS');
      CREATE TABLE "CategoriaFinanceira" (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        grupo "GrupoDre" NOT NULL,
        "paiId" TEXT REFERENCES "CategoriaFinanceira"(id) ON DELETE RESTRICT,
        ativo BOOLEAN NOT NULL DEFAULT true,
        "excluidoEm" TIMESTAMP(3)
      );
      CREATE UNIQUE INDEX "CategoriaFinanceira_nome_grupo_paiId_ativa_key"
        ON "CategoriaFinanceira"(nome, grupo, "paiId") WHERE "paiId" IS NOT NULL AND "excluidoEm" IS NULL;
      CREATE UNIQUE INDEX "CategoriaFinanceira_raiz_nome_grupo_ativa_key"
        ON "CategoriaFinanceira"(nome, grupo) WHERE "paiId" IS NULL AND "excluidoEm" IS NULL;
      CREATE TABLE "LancamentoFinanceiro" (
        id TEXT PRIMARY KEY,
        "categoriaId" TEXT NOT NULL REFERENCES "CategoriaFinanceira"(id)
      );
      CREATE TABLE "NotaFiscalItem" (
        id TEXT PRIMARY KEY,
        "categoriaFinanceiraId" TEXT REFERENCES "CategoriaFinanceira"(id)
      );

      INSERT INTO "CategoriaFinanceira" (id, nome, grupo, "paiId") VALUES
        ('salarios-canonico', 'Salários', 'FOLHA_PAGAMENTO', NULL),
        ('prolabore-canonico', 'Pró-labore', 'FOLHA_PAGAMENTO', NULL),
        ('encargos-agregado', 'Encargos (INSS/FGTS)', 'FOLHA_PAGAMENTO', NULL),
        ('vales-agregado', 'Vale Transporte/Alimentação', 'FOLHA_PAGAMENTO', NULL),
        ('takeat-conta-3', 'Despesas com pessoal', 'DESPESAS_OPERACIONAIS', NULL),
        ('operacional', 'Contabilidade', 'DESPESAS_OPERACIONAIS', NULL),
        ('takeat-conta-3-1', '13º Salário', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-2', 'Adiantamento', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-3', 'Alimentação funcionário (AF)', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-4', 'Comissão', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-5', 'FGTS', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-6', 'Freelancers', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-7', 'Férias', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-8', 'Horas Extras', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-9', 'Outras despesas com pessoal', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-10', 'Plano de Saúde', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-11', 'Previdência Social (INSS)', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-12', 'Pró Labore', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-13', 'Rescisão Contratual', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-14', 'Salários', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-15', 'Seguro de vida', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-16', 'Vale Alimentação', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3'),
        ('takeat-conta-3-17', 'Vale Transporte', 'DESPESAS_OPERACIONAIS', 'takeat-conta-3');

      INSERT INTO "LancamentoFinanceiro" (id, "categoriaId") VALUES
        ('salario-antigo', 'salarios-canonico'),
        ('salario-na-arvore', 'takeat-conta-3-14'),
        ('prolabore-antigo', 'prolabore-canonico'),
        ('prolabore-na-arvore', 'takeat-conta-3-12'),
        ('seguro-na-arvore', 'takeat-conta-3-15'),
        ('operacional-antigo', 'operacional');
      INSERT INTO "NotaFiscalItem" (id, "categoriaFinanceiraId")
        VALUES ('nota-salario-na-arvore', 'takeat-conta-3-14');
    `);
    await banco.query(sql);
  });

  afterAll(async () => {
    if (banco) {
      if (criado && /^teste_plano_pessoal_[a-f0-9]+$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
      await banco.end();
    }
  });

  it("move toda a árvore para o grupo 05 e remove os cadastros redundantes", async () => {
    const categorias = (await banco.query(`
      SELECT id, nome FROM "CategoriaFinanceira"
      WHERE grupo = 'FOLHA_PAGAMENTO' AND "paiId" IS NULL AND "excluidoEm" IS NULL
      ORDER BY nome
    `)).rows;
    expect(new Set(categorias.map((categoria) => categoria.nome))).toEqual(new Set([
      "13º Salário", "Adiantamento", "Alimentação funcionário (AF)", "Comissão", "FGTS",
      "Freelancers", "Férias", "Horas Extras", "Outras despesas com pessoal", "Plano de Saúde",
      "Previdência Social (INSS)", "Pró-labore", "Rescisão Contratual", "Salários", "Seguro de vida",
      "Vale Alimentação", "Vale Transporte",
    ]));
    expect(categorias).toHaveLength(17);

    const excluidas = (await banco.query(`
      SELECT id FROM "CategoriaFinanceira"
      WHERE id IN ('takeat-conta-3', 'takeat-conta-3-12', 'takeat-conta-3-14', 'encargos-agregado', 'vales-agregado')
        AND ativo = false AND "excluidoEm" IS NOT NULL
      ORDER BY id
    `)).rows;
    expect(excluidas).toHaveLength(5);
  });

  it("preserva lançamentos nas mesmas categorias e reúne somente as duplicatas", async () => {
    const lancamentos = (await banco.query(`SELECT id, "categoriaId" FROM "LancamentoFinanceiro" ORDER BY id`)).rows;
    expect(lancamentos).toEqual([
      { id: "operacional-antigo", categoriaId: "operacional" },
      { id: "prolabore-antigo", categoriaId: "prolabore-canonico" },
      { id: "prolabore-na-arvore", categoriaId: "prolabore-canonico" },
      { id: "salario-antigo", categoriaId: "salarios-canonico" },
      { id: "salario-na-arvore", categoriaId: "salarios-canonico" },
      { id: "seguro-na-arvore", categoriaId: "takeat-conta-3-15" },
    ]);
    expect((await banco.query(`SELECT "categoriaFinanceiraId" FROM "NotaFiscalItem" WHERE id = 'nota-salario-na-arvore'`)).rows[0])
      .toEqual({ categoriaFinanceiraId: "salarios-canonico" });
    expect((await banco.query(`SELECT grupo, "paiId" FROM "CategoriaFinanceira" WHERE id = 'takeat-conta-3-15'`)).rows[0])
      .toEqual({ grupo: "FOLHA_PAGAMENTO", paiId: null });
  });
});
