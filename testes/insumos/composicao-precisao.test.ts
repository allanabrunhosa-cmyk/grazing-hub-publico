vi.mock("server-only", () => ({}));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: vi.fn() }));
import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const sim = vi.hoisted(() => ({ criar: vi.fn(), transacao: vi.fn(), buscar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue({ userId: "pessoa-ficticia", admin: true }) }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn().mockResolvedValue({ userId: "pessoa-ficticia", admin: true }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: sim.transacao, insumo: { findUnique: sim.buscar } } }));

import { saveInsumoAction } from "@/app/(protegido)/insumos/actions";

beforeEach(() => {
  vi.clearAllMocks();
  sim.criar.mockResolvedValue({ id: "preparacao-ficticia" });
  sim.buscar.mockResolvedValue({ id: "preparacao-ficticia", nome: "Preparação fictícia", unidade: "KG", custoMedio: 0, categoriaId: null, fornecedorPrincipalId: null, fornecedoresHomologados: [] });
  sim.transacao.mockImplementation(async (executar) => executar({ $executeRaw: vi.fn(), insumo: { create: sim.criar, count: vi.fn().mockResolvedValue(1) } }));
});

function formulario(quantidade: number) {
  const form = new FormData();
  for (const [chave, valor] of Object.entries({ nome: "Preparação fictícia", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", ativo: "on", rendimentoQuantidade: "1", rendimentoUnidade: "KG" })) form.set(chave, valor);
  form.append("componentes", JSON.stringify({ componenteId: "ingrediente-ficticio", quantidade, observacaoPorcao: "Porção de teste" }));
  return form;
}

it.each([0.0000000001, 0.1234567891, 1_000_000_000])("rejeita quantidade %s que não cabe na precisão da composição, antes de gravar", async (quantidade) => {
  expect(await saveInsumoAction({ error: null }, formulario(quantidade))).toEqual({ error: expect.stringContaining("9 casas decimais") });
  expect(sim.transacao).not.toHaveBeenCalled();
});

it.each([0.000000001, 0.123456789, 100])("encaminha quantidade %s e snapshot da porção sem arredondar", async (quantidade) => {
  expect(await saveInsumoAction({ error: null }, formulario(quantidade))).toMatchObject({ error: null });
  expect(sim.criar).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ componentes: { create: [{ componenteId: "ingrediente-ficticio", quantidade, observacaoPorcao: "Porção de teste", porcao: Prisma.DbNull }] } }) }));
});

it.each([",5", "0,5", ".5", "0.5"])("salva rendimento e limites de estoque %s como meio, sem truncar na vírgula", async entrada => {
 const dados=formulario(1); for(const campo of ["rendimentoQuantidade", "estoqueMinimo", "estoqueMaximo"]) dados.set(campo,entrada);
 expect(await saveInsumoAction({error:null},dados)).toMatchObject({error:null});
 expect(sim.criar).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({rendimentoQuantidade:0.5,estoqueMinimo:0.5,estoqueMaximo:0.5})}));
});
it.each(["0,1234", "1kg", "-0,5", "1e3", "1000000000"])("rejeita limite de estoque inválido %s antes de gravar", async entrada => {
 const dados=formulario(1);dados.set("estoqueMinimo",entrada);
 expect((await saveInsumoAction({error:null},dados)).error).toContain("Estoque mínimo"); expect(sim.transacao).not.toHaveBeenCalled();
});
