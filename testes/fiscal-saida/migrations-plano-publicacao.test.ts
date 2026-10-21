import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { checksumHistoricoCorresponde, resumoPlanoMigrationsFiscais, sqlSemTransacaoExterna, VERSAO_EXECUTOR_MIGRATIONS_FISCAIS } from "../../scripts/lib/plano-migrations-fiscais.mjs";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
describe("Plano aprovado e SQL preservado para publicação fiscal", () => {
  it("mantém apenas a compatibilidade Prisma de finais LF/CRLF, sem afrouxar conteúdo", () => {
    const lf = "CREATE TABLE exemplo(id TEXT);\n", crlf = lf.replaceAll("\n", "\r\n");
    expect(checksumHistoricoCorresponde(lf, sha(crlf))).toBe(true); expect(checksumHistoricoCorresponde(crlf, sha(lf))).toBe(true);
    expect(checksumHistoricoCorresponde(lf, sha(lf.replace("TEXT", "INT")))).toBe(false); expect(checksumHistoricoCorresponde(lf, sha(lf.trim()))).toBe(false);
  });
  it("retira delimitadores externos e conserva aspas, comentários e corpos SQL", () => {
    const corpo = "DO $codigo$\nBEGIN\n  PERFORM 'BEGIN;';\n  PERFORM $texto$\nCOMMIT;\n$texto$;\nEND $codigo$;";
    const sql = `BEGIN;\r\n${corpo}\nINSERT INTO exemplo VALUES ('COMMIT;', E'BEGIN;\\nCOMMIT;'); -- COMMIT;\nCOMMIT;`;
    const r = sqlSemTransacaoExterna(sql); expect(r).toContain(corpo); expect(r).toContain("VALUES ('COMMIT;', E'BEGIN;\\nCOMMIT;')"); expect(r.trim().startsWith("BEGIN;")).toBe(false); expect(r.trim().endsWith("\nCOMMIT;")).toBe(false);
    expect(sqlSemTransacaoExterna("BEGIN WORK;SELECT 1;COMMIT TRANSACTION;")).toBe("SELECT 1;");
  });
  it("não duplica instrução final sem ponto e vírgula", () => { expect(sqlSemTransacaoExterna("SELECT 1")).toBe("SELECT 1"); });
  it("preserva identificador com dólar e string padrão com barra invertida", () => {
    expect(sqlSemTransacaoExterna("BEGIN; SELECT valor$tag$, '\\'; COMMIT; SELECT fim$tag$;")).toBe(" SELECT valor$tag$, '\\'; SELECT fim$tag$;");
  });
  it.each(["ROLLBACK;", "COMMIT AND CHAIN;", "BEGIN ISOLATION LEVEL SERIALIZABLE;", "PREPARE TRANSACTION 'fora';", "SET standard_conforming_strings=off;", "SAVEPOINT fora;"])("bloqueia controle externo não revisado: %s", sql => { expect(() => sqlSemTransacaoExterna(sql)).toThrow("transação"); });
  it.each(["SELECT 'incompleto;", "DO $codigo$ BEGIN", "/* não concluído"])("bloqueia texto SQL incompleto sem exibir conteúdo: %s", sql => { expect(() => sqlSemTransacaoExterna(sql)).toThrow(); });
  it("relatório publica somente hashes e nomes, sem SQL, esquema ou conexão", () => {
    const p = { hash: "a".repeat(64), destinoHash: "b".repeat(64), versaoExecutor: VERSAO_EXECUTOR_MIGRATIONS_FISCAIS, exigeCompatibilidade: true, esquema: "privado", raizMigrations: "diretorio-privado", pendentes: [{ nome: "20261011100000_exemplo", checksum: "c".repeat(64), original: "SQL interno suprimido" }] };
    const r = resumoPlanoMigrationsFiscais(p); expect(r).not.toHaveProperty("esquema"); expect(JSON.stringify(r)).not.toMatch(/SQL interno|diretorio-privado|privado/);
  });
  it("parser aceita a sintaxe das migrations reais sem executar nem editar arquivos", async () => {
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory());
    for (const p of pastas) { const sql = await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8"); expect(() => sqlSemTransacaoExterna(sql)).not.toThrow(); }
  });
});
