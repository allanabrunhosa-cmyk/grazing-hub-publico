// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const navegacao = vi.hoisted(() => ({ atualizar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: navegacao.atualizar }) }));
vi.mock("@/lib/notas-fiscais/api-cliente", () => ({ importarXmlPelaApi: vi.fn() }));
vi.mock("@/app/(protegido)/notas-fiscais/conciliar-fornecedor-actions", () => ({ prepararConciliacaoFornecedorAction: vi.fn(), conciliarFornecedorNotaAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { importarXmlPelaApi } from "@/lib/notas-fiscais/api-cliente";
import { toast } from "sonner";
import { ImportarXmlDialog } from "@/app/(protegido)/notas-fiscais/importar-xml-dialog";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

it("exige arquivo e confirmação explícita para importar", async () => {
  vi.mocked(importarXmlPelaApi).mockResolvedValue({ mensagem: "Nota importada" } as never);
  const usuario = userEvent.setup();
  render(<ImportarXmlDialog />);
  await usuario.click(screen.getByRole("button", { name: "Importar XML" }));
  expect((screen.getByRole("button", { name: "Importar arquivo" }) as HTMLButtonElement).disabled).toBe(true);
  const arquivo = new File(["<nfeProc/>"], "nota.xml", { type: "text/xml" });
  await usuario.upload(screen.getByLabelText("Arquivo XML (até 800 KB)"), arquivo);
  expect(importarXmlPelaApi).not.toHaveBeenCalled();
  await usuario.click(screen.getByRole("button", { name: "Importar arquivo" }));
  expect(vi.mocked(importarXmlPelaApi).mock.calls[0][0].get("arquivo")).toBe(arquivo);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(navegacao.atualizar).toHaveBeenCalledTimes(1);
});

it("mantém o painel aberto quando o XML é rejeitado", async () => {
  vi.mocked(importarXmlPelaApi).mockResolvedValue({ erro: "Destinatário incorreto" });
  const usuario = userEvent.setup();
  render(<ImportarXmlDialog />);
  await usuario.click(screen.getByRole("button", { name: "Importar XML" }));
  await usuario.upload(screen.getByLabelText("Arquivo XML (até 800 KB)"), new File(["<xml/>"], "nota.xml", { type: "text/xml" }));
  await usuario.click(screen.getByRole("button", { name: "Importar arquivo" }));
  expect(screen.getByRole("dialog")).toBeDefined();
});

it("mantém o painel aberto quando a conexão com a API falha", async () => {
  vi.mocked(importarXmlPelaApi).mockRejectedValue(new Error("Failed to fetch"));
  const usuario = userEvent.setup();
  render(<ImportarXmlDialog />);
  await usuario.click(screen.getByRole("button", { name: "Importar XML" }));
  await usuario.upload(screen.getByLabelText("Arquivo XML (até 800 KB)"), new File(["<xml/>"], "nota.xml", { type: "text/xml" }));
  await usuario.click(screen.getByRole("button", { name: "Importar arquivo" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
    "Não foi possível importar o XML.",
    expect.objectContaining({ description: expect.stringContaining("conexão") }),
  ));
  expect(screen.getByRole("dialog")).toBeDefined();
});
