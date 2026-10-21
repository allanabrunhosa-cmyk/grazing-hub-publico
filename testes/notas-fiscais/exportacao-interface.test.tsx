// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotasFiscaisTable } from "@/app/(protegido)/notas-fiscais/notas-fiscais-table";
import { notaTeste, opcoesTeste } from "./dados";

const simulacao = vi.hoisted(() => ({ exportar: vi.fn(), sucesso: vi.fn(), aviso: vi.fn(), erro: vi.fn() }));
vi.mock("@/app/(protegido)/notas-fiscais/actions", () => ({ exportarXmlPorDataAction: simulacao.exportar }));
vi.mock("@/app/(protegido)/notas-fiscais/nota-fiscal-dialog", () => ({ NotaFiscalDialog: () => null }));
vi.mock("sonner", () => ({ toast: { success: simulacao.sucesso, warning: simulacao.aviso, error: simulacao.erro } }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:teste"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  simulacao.exportar.mockResolvedValue({ nomeArquivo: "notas.zip", conteudoBase64: "UEs=", quantidade: 1, semXml: 1 });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("abre o Manifesto sem datas e mostra todas as pendentes, inclusive antigas e sem emissão", async () => {
  const notaAceita = {
    ...notaTeste,
    id: "nota-aceita",
    fornecedorNome: "Fornecedor já aceito",
    ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" as const,
  };
  const notaAntiga = { ...notaTeste, id: "nota-antiga", fornecedorNome: "Fornecedor antigo", dataEmissao: "2025-01-15T12:00:00Z" };
  const notaSemData = { ...notaTeste, id: "nota-sem-data", fornecedorNome: "Fornecedor sem emissão", dataEmissao: null };
  render(<NotasFiscaisTable notas={[notaTeste, notaAntiga, notaSemData, notaAceita]} {...opcoesTeste} />);

  expect((screen.getByLabelText("De") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("até") as HTMLInputElement).value).toBe("");
  expect(screen.getByText("Fornecedor de teste")).toBeTruthy();
  expect(screen.getByText("Fornecedor antigo")).toBeTruthy();
  expect(screen.getByText("Fornecedor sem emissão")).toBeTruthy();
  expect(screen.queryByText("Fornecedor já aceito")).toBeNull();

  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-01" } });
  fireEvent.blur(screen.getByLabelText("De"));
  fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-09-18" } });
  fireEvent.blur(screen.getByLabelText("até"));
  expect(screen.getByText("Fornecedor de teste")).toBeTruthy();
  expect(screen.queryByText("Fornecedor antigo")).toBeNull();
  expect(screen.queryByText("Fornecedor sem emissão")).toBeNull();

  await userEvent.click(screen.getByRole("button", { name: "Limpar datas" }));
  expect(screen.getByText("Fornecedor antigo")).toBeTruthy();
  expect(screen.getByText("Fornecedor sem emissão")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: /^Todas \(\d[\d.]*\)$/ }));
  expect(screen.getByText("Fornecedor já aceito")).toBeTruthy();
});

it("permite baixar sem datas, cria o download e avisa sobre XMLs pendentes", async () => {
  render(<NotasFiscaisTable notas={[notaTeste]} {...opcoesTeste} />);
  await userEvent.click(screen.getByRole("button", { name: "Exportar XML" }));
  expect(simulacao.exportar).toHaveBeenCalledWith("", "");
  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce());
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(simulacao.sucesso).toHaveBeenCalledWith("1 nota(s) exportada(s) em XML.");
  expect(simulacao.aviso).toHaveBeenCalledWith(expect.stringContaining("1 nota(s) ficaram fora"), expect.any(Object));
});

it("envia as datas preenchidas e trata um erro retornado sem baixar arquivo", async () => {
  simulacao.exportar.mockResolvedValue({ erro: "Nenhuma nota emitida nesse período." });
  render(<NotasFiscaisTable notas={[notaTeste]} {...opcoesTeste} />);
  fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-01" } });
  fireEvent.blur(screen.getByLabelText("De"));
  fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-09-11" } });
  fireEvent.blur(screen.getByLabelText("até"));
  await userEvent.click(screen.getByRole("button", { name: "Exportar XML" }));
  expect(simulacao.exportar).toHaveBeenCalledWith("2026-09-01", "2026-09-11");
  expect(simulacao.erro).toHaveBeenCalledWith("Nenhuma nota emitida nesse período.");
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

it("trata falha de comunicação e libera o botão para tentar novamente", async () => {
  simulacao.exportar.mockRejectedValue(Error("Falha de rede"));
  render(<NotasFiscaisTable notas={[notaTeste]} {...opcoesTeste} />);
  await userEvent.click(screen.getByRole("button", { name: "Exportar XML" }));
  expect(simulacao.erro).toHaveBeenCalledWith("Não foi possível baixar os XMLs. Tente novamente.");
  await waitFor(() => expect((screen.getByRole("button", { name: "Exportar XML" }) as HTMLButtonElement).disabled).toBe(false));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-18T15:00:00Z")); });
afterEach(() => vi.useRealTimers());

it("todas as situações contam o conjunto da busca e período e se atualizam com as notas", () => {
  const aceitas = { ...notaTeste, id: "aceita", ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" as const };
  const recusadas = { ...notaTeste, id: "recusada", ultimaManifestacao: "DESCONHECIMENTO_DA_OPERACAO" as const };
  const { rerender } = render(<NotasFiscaisTable notas={[notaTeste, aceitas, recusadas]} {...opcoesTeste} />);
  for (const nome of ["Todas (3)", "Pendentes (1)", "Aceitas (1)", "Recusadas (1)"]) expect(screen.getByRole("button", { name: nome })).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "inexistente" } });
  for (const nome of ["Todas (0)", "Pendentes (0)", "Aceitas (0)", "Recusadas (0)"]) expect(screen.getByRole("button", { name: nome })).toBeTruthy();
  expect(screen.getByLabelText("1 notas pendentes no total")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Aceitas (0)" }));
  expect(screen.getByRole("button", { name: "Aceitas (0)" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  rerender(<NotasFiscaisTable notas={[aceitas]} {...opcoesTeste} />);
  expect(screen.getByRole("button", { name: "Todas (1)" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Pendentes (0)" })).toBeTruthy();
});
