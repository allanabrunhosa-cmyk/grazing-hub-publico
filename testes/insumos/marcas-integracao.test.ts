vi.mock("server-only", () => ({}));
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { prisma } from "@/lib/prisma";
import { saveInsumoAction, importInsumosAction } from "@/app/(protegido)/insumos/actions";

const estado = vi.hoisted(() => ({ autenticado: true }));
vi.mock("@/lib/session", () => ({ getSession: async () => estado.autenticado ? { userId: "teste-marcas", admin: true } : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
let insumoId = "";
const nome = `Marcas homologadas teste ${Date.now()}`;
function formulario(marcas?: unknown) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries({ nome, tipo: "INSUMO", unidade: "KG", ativo: "on" })) dados.set(chave, valor);
  if (insumoId) dados.set("id", insumoId);
  if (marcas !== undefined) dados.set("marcasHomologadas", JSON.stringify(marcas));
  return dados;
}

describe.skipIf(process.env.MARCAS_BANCO_TESTE !== "1")("Marcas no PostgreSQL local", () => {
  beforeAll(() => {
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Teste permitido somente no banco local.");
  });
  afterAll(async () => {
    if (insumoId) await prisma.insumo.delete({ where: { id: insumoId } });
    await prisma.$disconnect();
  });
  it("migra marca antiga sem fragmentar nomes ou inventar marcas vazias", async () => {
    const banco = new Client({ connectionString: process.env.DATABASE_URL });
    await banco.connect();
    try {
      await banco.query("BEGIN");
      // A tabela temporária oculta a tabela pública só nesta conexão; nenhuma linha real é alterada.
      await banco.query('CREATE TEMP TABLE "Insumo" (id INTEGER, marca TEXT) ON COMMIT DROP');
      await banco.query('INSERT INTO "Insumo" VALUES (1,$1),(2,NULL),(3,$2)', [" Marca A, Marca B ", " "]);
      await banco.query(await readFile("prisma/migrations/20260911050000_marcas_homologadas/migration.sql", "utf8"));
      const { rows } = await banco.query('SELECT "marcasHomologadas" FROM "Insumo" ORDER BY id');
      expect(rows.map((linha) => linha.marcasHomologadas)).toEqual([["Marca A, Marca B"], [], []]);
    } finally { await banco.query("ROLLBACK"); await banco.end(); }
  });
  it("salva várias marcas e rejeita alterações inválidas sem gravação parcial", async () => {
    const resultado = await saveInsumoAction({ error: null }, formulario(["União", "Da Barra", "UNIÃO"]));
    expect(resultado.error).toBeNull();
    insumoId = resultado.insumoId!;
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } })).marcasHomologadas).toEqual(["União", "Da Barra"]);
    const invalido = formulario([""]); invalido.set("nome", "Nome indevido");
    expect((await saveInsumoAction({ error: null }, invalido)).error).toBeTruthy();
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } })).nome).toBe(nome);
  });
  it("preserva marcas quando um formulário legado não informa esse campo", async () => {
    expect((await saveInsumoAction({ error: null }, formulario())).error).toBeNull();
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } })).marcasHomologadas).toEqual(["União", "Da Barra"]);
  });
  it("CSV antigo preserva tags e CSV novo aceita a lista completa", async () => {
    expect((await importInsumosAction([{ nome, unidade: "KG", marca: "Caravelas" }])).atualizados).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } })).marcasHomologadas).toEqual(["União", "Da Barra", "Caravelas"]);
    expect((await importInsumosAction([{ nome, unidade: "KG", marcasHomologadas: '["Marca A, B","Marca C"]' }])).atualizados).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } })).marcasHomologadas).toEqual(["Marca A, B", "Marca C"]);
  });
  it("exige sessão e permite excluir todas as tags sem retorno da marca antiga", async () => {
    estado.autenticado = false;
    expect((await saveInsumoAction({ error: null }, formulario([]))).error).toContain("sessão");
    expect((await importInsumosAction([{ nome, unidade: "KG", marcasHomologadas: "[]" }])).erros[0].mensagem).toContain("sessão");
    estado.autenticado = true;
    expect((await saveInsumoAction({ error: null }, formulario([]))).error).toBeNull();
    const salvo = await prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } });
    expect(salvo.marcasHomologadas).toEqual([]);
    expect(salvo.marca).toBeNull();
  });
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn(async () => ({ userId: "teste-marcas", admin: true })) }));
