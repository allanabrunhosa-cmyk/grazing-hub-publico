vi.mock("server-only", () => ({}));
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { importInsumosAction, saveInsumoAction } from "@/app/(protegido)/insumos/actions";

vi.mock("@/lib/session", () => ({
  getSession: async () => ({ userId: "teste-especificacao", admin: true }),
}));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn(async () => ({ userId: "teste-especificacao", admin: true })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const nome = `Especificação teste ${Date.now()}`;

function formulario(especificacao: string) {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries({ nome, especificacao, tipo: "INSUMO", unidade: "KG", ativo: "on" })) {
    dados.set(chave, valor);
  }
  return dados;
}

describe.skipIf(process.env.ESPECIFICACAO_BANCO_TESTE !== "1")("Especificação no PostgreSQL local", () => {
  beforeAll(() => {
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) {
      throw new Error("Teste permitido somente no banco local.");
    }
  });

  afterAll(async () => {
    await prisma.insumo.deleteMany({ where: { nome } });
    await prisma.$disconnect();
  });

  it("salva, importa, valida e remove a especificação", async () => {
    const criado = await saveInsumoAction({ error: null }, formulario("Farinha tipo 1 · força W300"));
    expect(criado.error).toBeNull();
    expect(criado.insumo?.especificacao).toBe("Farinha tipo 1 · força W300");

    const importado = await importInsumosAction([{ nome, unidade: "KG", especificacao: "Farinha forte para longa fermentação" }]);
    expect(importado.atualizados).toBe(1);
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: criado.insumoId } })).especificacao).toBe("Farinha forte para longa fermentação");

    const invalido = formulario("x".repeat(301));
    invalido.set("id", criado.insumoId!);
    expect((await saveInsumoAction({ error: null }, invalido)).error).toContain("300 caracteres");
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: criado.insumoId } })).especificacao).toBe("Farinha forte para longa fermentação");

    const limpar = formulario("");
    limpar.set("id", criado.insumoId!);
    expect((await saveInsumoAction({ error: null }, limpar)).error).toBeNull();
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: criado.insumoId } })).especificacao).toBeNull();
  });
});
