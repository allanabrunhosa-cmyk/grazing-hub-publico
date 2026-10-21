import { beforeEach, expect, it, vi } from "vitest";
import { consultarResumoPedidoAction } from "@/app/(protegido)/vendas/pedidos/resumo-pedido-actions";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { dadosResumoSintetico } from "./resumo-pedido.fixture";
const mocks = vi.hoisted(() => ({ exigir: vi.fn(), consultar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: mocks.exigir }));
vi.mock("@/lib/vendas/consultar-resumo-pedido", () => ({ consultarResumoPedido: mocks.consultar }));
beforeEach(() => vi.resetAllMocks());

it("exige consulta de pedidos no servidor antes de retornar dados comerciais", async () => {
  mocks.consultar.mockResolvedValue(dadosResumoSintetico);
  expect(await consultarResumoPedidoAction("pedido-sintetico")).toEqual({ dados: dadosResumoSintetico });
  expect(mocks.exigir).toHaveBeenCalledWith("vendas.pedidos");
  expect(mocks.consultar).toHaveBeenCalledWith("pedido-sintetico");
});
it("sem autorização não consulta cliente, valores nem itens", async () => {
  mocks.exigir.mockRejectedValue(new Error("Sem acesso"));
  await expect(consultarResumoPedidoAction("pedido-sintetico")).rejects.toThrow("Sem acesso");
  expect(mocks.consultar).not.toHaveBeenCalled();
});
it("expõe pendência de domínio e não vaza falha interna", async () => {
  mocks.consultar.mockRejectedValueOnce(new ErroPedidoVenda("Informe os itens do orçamento."));
  expect(await consultarResumoPedidoAction("pedido-sintetico")).toEqual({ erro: "Informe os itens do orçamento." });
  mocks.consultar.mockRejectedValueOnce(new Error("Erro interno de banco sensível"));
  expect(await consultarResumoPedidoAction("pedido-sintetico")).toEqual({ erro: "Não foi possível carregar o resumo. Tente novamente." });
});
