// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AtualizacaoTema } from "@/components/design-system/atualizacao-tema";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("consulta revisão sem cache ao retornar e avisa sem descartar formulário", async () => {
  const fetch = vi.fn(async () => ({ json: async () => ({ revisao: 2 }) })); vi.stubGlobal("fetch", fetch);
  render(<><input aria-label="Trabalho aberto" defaultValue="Não perder" /><AtualizacaoTema revisao={1} /></>);
  fireEvent.focus(window);
  await screen.findByText("Novo padrão visual disponível.");
  expect(fetch).toHaveBeenCalledWith("/api/design/revisao", { cache: "no-store" });
  expect(screen.getByLabelText("Trabalho aberto")).toHaveProperty("value", "Não perder");
  expect(screen.getByRole("button", { name: "Atualizar" })).toBeTruthy();
});
it("falha de rede não interrompe a tela", async () => {
  const fetch = vi.fn(async () => { throw new Error("offline"); }); vi.stubGlobal("fetch", fetch);
  render(<AtualizacaoTema revisao={1} />); fireEvent.focus(window);
  await waitFor(() => expect(fetch).toHaveBeenCalledOnce()); expect(screen.queryByRole("status")).toBeNull();
});
