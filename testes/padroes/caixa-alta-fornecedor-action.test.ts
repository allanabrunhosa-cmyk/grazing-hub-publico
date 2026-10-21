import { beforeEach, expect, it, vi } from "vitest";

const simulados = vi.hoisted(() => ({ criar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn() }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const tx = { fornecedor: { create: simulados.criar } };
  return { prisma: { ...tx, $transaction: async (executar: (banco: typeof tx) => unknown) => executar(tx) } };
});

import { saveFornecedorAction } from "@/app/(protegido)/fornecedores/actions";

beforeEach(() => simulados.criar.mockReset().mockResolvedValue({ id: "fornecedor", nome: "MERCADO SÃO JOSÉ" }));

it("normaliza nome e razão social no servidor antes de criar o fornecedor", async () => {
  const formulario = new FormData();
  formulario.set("nome", "  Mercado São José  ");
  formulario.set("razaoSocial", " Comércio de alimentos ltda ");
  formulario.set("ativo", "on");

  expect(await saveFornecedorAction({ error: null }, formulario)).toMatchObject({
    error: null,
    fornecedor: { nome: "MERCADO SÃO JOSÉ" },
  });
  expect(simulados.criar).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({
      nome: "MERCADO SÃO JOSÉ",
      razaoSocial: "COMÉRCIO DE ALIMENTOS LTDA",
    }),
  }));
});
