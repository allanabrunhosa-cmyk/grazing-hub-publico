// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const navegacao = vi.hoisted(() => ({ atualizar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: navegacao.atualizar }) }));
vi.mock("@/lib/notas-fiscais/api-cliente", () => ({ importarChavePelaApi: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { importarChavePelaApi } from "@/lib/notas-fiscais/api-cliente";
import { toast } from "sonner";
import { ImportarChaveDialog } from "@/app/(protegido)/notas-fiscais/importar-chave-dialog";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

it("importa pela rota estável, fecha o painel e atualiza a lista", async () => {
  vi.mocked(importarChavePelaApi).mockResolvedValue({ mensagem: "Nota importada" });
  const usuario = userEvent.setup();
  const chave = "35260900608242000162550010004751441031899761";
  render(<ImportarChaveDialog />);

  await usuario.click(screen.getByRole("button", { name: "Importar pela chave" }));
  await usuario.type(screen.getByLabelText("Chave de acesso"), chave);
  await usuario.click(screen.getByRole("button", { name: "Consultar e importar" }));

  await waitFor(() => expect(importarChavePelaApi).toHaveBeenCalledWith(chave));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(toast.success).toHaveBeenCalledWith("Nota importada");
  expect(navegacao.atualizar).toHaveBeenCalledTimes(1);
});

it("mantém o painel aberto quando a SEFAZ devolve erro", async () => {
  vi.mocked(importarChavePelaApi).mockResolvedValue({ erro: "Nota indisponível" });
  const usuario = userEvent.setup();
  render(<ImportarChaveDialog />);

  await usuario.click(screen.getByRole("button", { name: "Importar pela chave" }));
  await usuario.type(screen.getByLabelText("Chave de acesso"), "123");
  await usuario.click(screen.getByRole("button", { name: "Consultar e importar" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nota indisponível"));
  expect(screen.getByRole("dialog")).toBeDefined();
});
