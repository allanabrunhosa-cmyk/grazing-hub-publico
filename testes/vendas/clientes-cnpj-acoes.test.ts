import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ autorizar: vi.fn(), consultar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.autorizar }));
vi.mock("@/lib/vendas/cnpj", () => ({ consultarCnpjVenda: sim.consultar }));
vi.mock("@/lib/vendas/persistencia", () => ({ salvarCliente: vi.fn(), mensagemErroCadastro: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { buscarCnpjClienteAction } from "@/app/(protegido)/vendas/clientes/cadastro-actions";
import { buscarCnpjPedidoAction } from "@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions";
beforeEach(() => { vi.resetAllMocks(); });
it.each([[buscarCnpjClienteAction, "vendas.clientes"], [buscarCnpjPedidoAction, "vendas.pedidos"]] as const)("autoriza o módulo antes de consultar CNPJ (%s)", async (acao, permissao) => {
  sim.autorizar.mockRejectedValueOnce(new Error("Sem acesso"));
  await expect(acao("11222333000181")).rejects.toThrow("Sem acesso");
  expect(sim.consultar).not.toHaveBeenCalled();
  expect(sim.autorizar).toHaveBeenCalledWith(permissao);
  sim.consultar.mockResolvedValue({ erro: "Resposta fictícia" });
  expect(await acao("11222333000181")).toEqual({ erro: "Resposta fictícia" });
  expect(sim.consultar).toHaveBeenCalledWith("11222333000181");
});
