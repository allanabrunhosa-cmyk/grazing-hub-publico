// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
import { ImportarMunicipalDialog } from "@/app/(protegido)/financeiro/manifesto-nfs/importar-municipal-dialog";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("envia a consulta explícita, aceita data antiga e mantém os campos após erro", async () => {
  const fechar = vi.fn(), fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ erro: "Código de verificação divergente" }) });
  vi.stubGlobal("fetch", fetch);
  render(<ImportarMunicipalDialog aberto aoFechar={fechar} />);
  const botao = screen.getByRole("button", { name: "Consultar e importar" });
  expect((botao as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("CNPJ do prestador *"), { target: { value: "12345678000190" } });
  fireEvent.change(screen.getByLabelText("Número da NFS-e *"), { target: { value: "42" } });
  fireEvent.change(screen.getByLabelText("Data de emissão *"), { target: { value: "2026-09-01" } });
  fireEvent.change(screen.getByLabelText("Código de verificação *"), { target: { value: "abcd1234" } });
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(botao);
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Código de verificação divergente"));
  expect(fechar).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Número da NFS-e *") as HTMLInputElement).value).toBe("42");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ municipioCodigo: "3550308", numero: "42", codigoVerificacao: "ABCD1234", dataEmissao: "2026-09-01" });
  fetch.mockResolvedValue({ ok: true, json: async () => ({ mensagem: "Importada" }) });
  fireEvent.click(botao);
  await waitFor(() => expect(fechar).toHaveBeenCalledWith(true));
});
