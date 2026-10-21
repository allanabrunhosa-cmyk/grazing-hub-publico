// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const sim = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), mudar: vi.fn(), configurarEstoque: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: sim.push, replace: sim.replace, refresh: sim.refresh }), usePathname: () => "/vendas/pedidos" }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/app/(protegido)/vendas/pedidos/gestor-actions", () => ({ mudarStatusGestorPedidoAction: sim.mudar, salvarMovimentacaoEstoqueGestorPedidosAction: sim.configurarEstoque }));
vi.mock("@/app/(protegido)/vendas/pedidos/resumo-pedido", () => ({ ResumoPedido: () => <p>Resumo comercial de teste</p> }));
import { GestorPedidos } from "@/app/(protegido)/vendas/pedidos/gestor-client";
import { criarGestorFixture } from "../visual/gestor-fixtures";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Acompanhamento iFood no Gestor", () => {
  it.each(["quadros", "calendario", "lista"])("preserva consulta e identificação Takeat em %s sem oferecer produção local", async modo => {
    const props = criarGestorFixture();
    props.filtros.modo = modo;
    props.resultado.pedidos = [{ ...props.resultado.pedidos[0], acompanhamentoIfood: true, origem: "IFOOD", operacional: "PENDENTE" }];
    render(<GestorPedidos {...props} />);
    const usuario = userEvent.setup();
    expect(screen.getAllByText("Acompanhamento — Takeat").length).toBeGreaterThan(0);
    if (modo === "calendario") await usuario.click(screen.getByRole("button", { name: "Expandir pedido #101" }));
    if (modo === "lista") expect(screen.queryByRole("button", { name: "Expandir ações do pedido #101" })).toBeNull();

    expect(screen.getByRole("link", { name: "#101" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver pedido #101" })).toBeNull();
    expect(screen.queryByRole("button", { name: /(?:Iniciar preparo|Avançar pedido|Retornar pedido|Imprimir produção).*#101/ })).toBeNull();
    expect(screen.queryByText("Aguardando início do preparo")).toBeNull();
    await usuario.click(screen.getByRole("button", { name: "Mais ações do pedido #101" }));
    expect(await screen.findByRole("menuitem", { name: "Resumo do pedido" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Impressão de produção" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Cancelar pedido" })).toBeNull();
    await usuario.keyboard("{Escape}");
    await usuario.click(screen.getByRole("link", { name: "#101" }));
    await waitFor(() => expect(sim.push).toHaveBeenCalledTimes(1));
    const destino = new URL(sim.push.mock.calls[0][0], "https://pedidos.example.test");
    expect(destino.pathname).toBe("/vendas/pedidos/pedido-ficticio-1");
    expect(sim.mudar).not.toHaveBeenCalled();
    expect(sim.configurarEstoque).not.toHaveBeenCalled();
  });
});
