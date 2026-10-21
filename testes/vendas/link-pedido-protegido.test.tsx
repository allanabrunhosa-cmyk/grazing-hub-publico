// @vitest-environment jsdom
import React from "react";
import type { MouseEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, createEvent, fireEvent, render, screen } from "@testing-library/react";

const sim = vi.hoisted(() => ({ guard: vi.fn() }));
vi.mock("next/link", () => ({ default: (props: React.ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/app/(protegido)/vendas/pedidos/modal-pedido", () => ({ navegarComPedidoAberto: sim.guard }));
import { LinkPedidoProtegido } from "@/app/(protegido)/vendas/pedidos/link-pedido-protegido";

// Hash sintético mantém a semântica nativa do link sem navegação externa no jsdom.
const destino = "#configuracao-ficticia";
function clicar(opcoes: MouseEventInit = {}) {
  const link = screen.getByRole("link", { name: "Configuração fictícia" });
  const evento = createEvent.click(link, { bubbles: true, cancelable: true, button: 0, ...opcoes });
  fireEvent(link, evento);
  return evento;
}
beforeEach(() => { sim.guard.mockReset().mockReturnValue(false); });
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Atalho protegido do painel de pedido", () => {
  it("delega o clique comum à proteção e impede a saída imediata", () => {
    sim.guard.mockReturnValue(true);
    render(<LinkPedidoProtegido href={destino}>Configuração fictícia</LinkPedidoProtegido>);
    expect(screen.getByRole("link").getAttribute("href")).toBe(destino);
    expect(clicar().defaultPrevented).toBe(true);
    expect(sim.guard).toHaveBeenCalledExactlyOnceWith(destino);
  });

  it("permite a navegação comum quando não existe painel protegendo a saída", () => {
    render(<LinkPedidoProtegido href={destino}>Configuração fictícia</LinkPedidoProtegido>);
    expect(clicar().defaultPrevented).toBe(false);
    expect(sim.guard).toHaveBeenCalledExactlyOnceWith(destino);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Meta", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["botão do meio", { button: 1 }],
  ] as const)("preserva o clique nativo com %s sem acionar o painel", (_nome, opcoes) => {
    sim.guard.mockReturnValue(true);
    render(<LinkPedidoProtegido href={destino}>Configuração fictícia</LinkPedidoProtegido>);
    expect(clicar(opcoes).defaultPrevented).toBe(false);
    expect(sim.guard).not.toHaveBeenCalled();
  });

  it("preserva preventDefault do consumidor sem acionar uma segunda decisão", () => {
    sim.guard.mockReturnValue(true);
    const aoClicar = vi.fn((evento: MouseEvent<HTMLAnchorElement>) => evento.preventDefault());
    render(<LinkPedidoProtegido href={destino} onClick={aoClicar}>Configuração fictícia</LinkPedidoProtegido>);
    expect(clicar().defaultPrevented).toBe(true);
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(sim.guard).not.toHaveBeenCalled();
  });

  it("executa o callback do consumidor e depois consulta a proteção quando ele não bloqueia", () => {
    sim.guard.mockReturnValue(true);
    const aoClicar = vi.fn();
    render(<LinkPedidoProtegido href={destino} onClick={aoClicar}>Configuração fictícia</LinkPedidoProtegido>);
    expect(clicar().defaultPrevented).toBe(true);
    expect(aoClicar).toHaveBeenCalledTimes(1);
    expect(sim.guard).toHaveBeenCalledExactlyOnceWith(destino);
    expect(aoClicar.mock.invocationCallOrder[0]).toBeLessThan(sim.guard.mock.invocationCallOrder[0]);
  });
});
