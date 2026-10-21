import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";

describe("Reconciliação restrita de migrations fiscais históricas", () => {
  for (const nome of ["20261011100000_brasilnfe_preparacao_operacional", "20261011220000_estrutura_fiscal_versionada"]) {
    it(`preserva todas as instruções exceto a adição equivalente de ${nome}`, () => {
      const sql = readFileSync(`prisma/migrations/${nome}/migration.sql`, "utf8");
      const transformado = prepararSqlMigrationFiscal(nome, sql);
      expect(transformado).toContain("coluna.atttypid <> 'text'::regtype OR coluna.attnotnull");
      expect(transformado).toContain("RAISE EXCEPTION");
      expect(transformado).not.toMatch(/^\s*(DROP|TRUNCATE|DELETE)\s/gm);
      expect(() => prepararSqlMigrationFiscal(nome, sql.replace('"protocoloCancelamento" TEXT', '"protocoloCancelamento" VARCHAR'))).toThrow("fora da revisão");
      expect(transformado.replace(/DO \$reconciliacao_fiscal\$[\s\S]*?END \$reconciliacao_fiscal\$;/, "").replace(/\s+/g, "").trim()).toBe(sql.replace(nome.includes("preparacao") ? ' ADD COLUMN "protocoloCancelamento" TEXT,' : 'ALTER TABLE "DocumentoFiscalSaida" ADD COLUMN "protocoloCancelamento" TEXT;', "").replace(/\s+/g, "").trim());
    });
  }
  it("não transforma qualquer outra migration", () => {
    expect(prepararSqlMigrationFiscal("outra", "SQL desconhecido")).toBe("SQL desconhecido");
  });
});
