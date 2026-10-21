import { beforeEach, expect, it, vi } from "vitest";

const estado = vi.hoisted(() => ({ recursos: new Set<string>(), exigir: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (rota: string) => { throw new Error(`REDIRECT:${rota}`); } }));
vi.mock("@/lib/permissoes/servidor", () => ({
  podeAcessar: async (recurso: string) => estado.recursos.has(recurso),
  exigirPermissao: estado.exigir,
}));
import VendasPage from "@/app/(protegido)/vendas/page";

beforeEach(() => {
  estado.recursos.clear();
  estado.exigir.mockReset();
  estado.exigir.mockImplementation(async (recurso: string) => {
    if (!estado.recursos.has(recurso)) throw new Error("REDIRECT:/sem-acesso");
    return { userId: "sintetico" };
  });
});

it("abre o Dashboard por padrão quando a consulta foi concedida", async () => {
  estado.recursos.add("vendas.bi");
  estado.recursos.add("vendas.pedidos");
  await expect(VendasPage()).rejects.toThrow("REDIRECT:/vendas/bi");
  expect(estado.exigir).toHaveBeenCalledWith("vendas.bi");
});

it.each(["vendas.pedidos", "vendas.clientes", "vendas.horarios", "vendas"])("preserva a entrada existente sem Dashboard: %s", async recurso => {
  estado.recursos.add(recurso);
  const pagina = await VendasPage();
  expect(pagina.props.titulo).toBe("Vendas & CRM");
  expect(estado.exigir).toHaveBeenCalledWith(recurso);
});

it("não permite entrada somente pela concessão de exportação, contatos ou custos", async () => {
  for (const recurso of ["vendas.bi.exportar", "vendas.bi.contatos", "vendas.bi.custos"]) estado.recursos.add(recurso);
  await expect(VendasPage()).rejects.toThrow("REDIRECT:/sem-acesso");
});
