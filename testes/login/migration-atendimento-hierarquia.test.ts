import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { CAPACIDADES_ATENDIMENTO, NOVAS_CAPACIDADES_ATENDIMENTO } from "@/lib/permissoes/atendimento";
import { provarAtendimentoHierarquia } from "./prova-atendimento-hierarquia-banco";

const arquivo = "prisma/migrations/20261021120000_atendimento_permissoes_hierarquia/migration.sql";
it("mantém o mapa da migration alinhado ao contrato e não revoga sessões humanas", async () => {
  const sql = await readFile(arquivo, "utf8");
  const conferencia = await readFile("scripts/atendimento-permissoes-hierarquia-conferencia.sql", "utf8");
  for (const [capacidade, regra] of Object.entries(NOVAS_CAPACIDADES_ATENDIMENTO)) {
    const origens = regra.origens.map(o => `'${o}'`).join(",");
    expect(sql).toContain(`('${capacidade}','${regra.recurso}','${regra.acao}',ARRAY[${origens}]`);
    expect(conferencia).toContain(`('${capacidade}','${regra.recurso}','${regra.acao}',ARRAY[${origens}]`);
  }
  for (const [capacidade, regra] of Object.entries(CAPACIDADES_ATENDIMENTO).filter(([capacidade]) => !Object.hasOwn(NOVAS_CAPACIDADES_ATENDIMENTO, capacidade))) {
    const linha = `('${capacidade}','${regra.recurso}','${regra.acao}','${regra.origemLegada}')`;
    expect(sql).toContain(linha);
    expect(conferencia).toContain(linha);
  }
  expect(sql).not.toMatch(/SET\s+"sessaoVersao"/i);
  expect(sql).toContain("pg_get_viewdef");
  expect(sql).toContain("ATENDIMENTO_HIERARQUIA_DECISAO_FORWARD_CONFLITANTE");
});

it.skipIf(process.env.LOGIN_BANCO_TESTE !== "1")("materializa a hierarquia em PostgreSQL localhost isolado com equivalência, vetos, rollback e reexecução", async () => {
  const prova = await provarAtendimentoHierarquia({ url: process.env.DATABASE_URL!, sql: await readFile(arquivo, "utf8"), conferencia: await readFile("scripts/atendimento-permissoes-hierarquia-conferencia.sql", "utf8") });
  expect(prova).toMatchObject({ cenarios: 6, capacidades: 57, dadosReais: 0, sessoesPreservadas: true });
  expect(prova.comparacoes).toBeGreaterThan(4000);
}, 60_000);
