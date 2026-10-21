// @vitest-environment jsdom
import * as React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeletorFiscal } from "@/components/fiscal/seletor-fiscal";
import { CamposClassificacaoFiscal } from "@/components/fiscal/campos-classificacao";
const fetchLocal = vi.fn(async (input: string) => {
  const p = new URL(input, "http://localhost").searchParams;
  const codigo = p.get("tabela") === "ncm" ? "19059090" : "49";
  return Response.json({ tabela: p.get("tabela"), versao: "Tabela fictícia da suíte", fonte: "https://www.nfe.fazenda.gov.br", sha256Origem: "a".repeat(64), obtidoEm: "2026-10-14", opcoes: [{ codigo, descricao: "Mercadoria fictícia de padaria", vigente: true }], selecionado: p.get("selecionado") ? { codigo: p.get("selecionado"), descricao: "Descrição do código salvo", vigente: true } : null, total: 1, limite: 50 });
});
beforeEach(() => { vi.stubGlobal("React", React); vi.stubGlobal("fetch", fetchLocal); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("pesquisa texto e seleciona pelo teclado sem salvar ao perder foco", async () => {
  const user = userEvent.setup(), mudar = vi.fn();
  render(<SeletorFiscal nome="NCM fictício" valor="" mudar={mudar} contexto={{ tabela: "ncm", crt: 1, dia: "2026-10-14" }} />);
  await waitFor(() => expect(fetchLocal).toHaveBeenCalled());
  const campo = screen.getByRole("combobox", { name: "NCM fictício" });
  await user.type(campo, "padaria");
  await screen.findByRole("option", { name: /19059090.*Mercadoria fictícia/ });
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  await waitFor(() => expect(mudar).toHaveBeenCalledWith("19059090"));
  expect(fetchLocal.mock.calls.every(([url]) => url.startsWith("/api/fiscal/tabelas?") && !/brasilnfe\.com/i.test(url))).toBe(true);
});
it("explicita falha e conserva o código existente sem transformá-lo em outro", async () => {
  fetchLocal.mockRejectedValueOnce(new Error("Falha sintética")); const mudar = vi.fn();
  render(<SeletorFiscal nome="NCM salvo" valor="99999999" mudar={mudar} contexto={{ tabela: "ncm" }} />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "A tabela não carregou. O valor salvo foi preservado.");
  expect(screen.getByRole("combobox", { name: "NCM salvo" })).toHaveProperty("value", expect.stringContaining("99999999"));
  expect(mudar).not.toHaveBeenCalled();
});
it("regime normal e Simples usam o mesmo NCM e controles ICMS distintos", async () => {
  const { rerender } = render(<CamposClassificacaoFiscal fiscal={{}} mudar={vi.fn()} crt={1} />);
  expect(screen.getByRole("combobox", { name: "CSOSN" })).toBeTruthy();
  const antes = screen.getByRole("combobox", { name: "NCM" });
  rerender(<CamposClassificacaoFiscal fiscal={{}} mudar={vi.fn()} crt={3} />);
  expect(screen.queryByRole("combobox", { name: "CSOSN" })).toBeNull();
  expect(screen.getByRole("combobox", { name: "CST ICMS" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "NCM" })).toBe(antes);
  expect(screen.queryByRole("combobox", { name: "CEST" })).toBeNull();
});
it("SEM GTIN exige escolha explícita da unidade final", async () => {
  const user = userEvent.setup(), mudar = vi.fn();
  render(<CamposClassificacaoFiscal fiscal={{}} mudar={mudar} crt={1} />);
  expect(mudar).not.toHaveBeenCalled();
  await user.click(screen.getByRole("combobox", { name: "GTIN da unidade final" }));
  await user.click(await screen.findByRole("option", { name: "Não possui · SEM GTIN confirmado" }));
  expect(mudar).toHaveBeenCalledWith({ ean: "SEM GTIN" });
  expect(screen.queryByRole("button", { name: /Emitir|Transmitir|Aprovar/ })).toBeNull();
});
it("mantém os códigos e suas descrições no campo sem notas auxiliares no formulário", async () => {
  const mudar = vi.fn();
  render(<CamposClassificacaoFiscal fiscal={{ ncm: "19059090", origem: "0", cfop: "5101", csosn: "102", pis: "49", cofins: "49", unidadeTributavel: "UN", ean: "SEM GTIN" }} mudar={mudar} crt={1} />);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "NCM" })).toHaveProperty("value", "19059090 · Descrição do código salvo"));
  expect(screen.queryByText(/Tabela fictícia da suíte|Confirme o código da unidade vendida|Opções de ICMS conforme CRT/)).toBeNull();
  expect(screen.getByRole("combobox", { name: "NCM" }).getAttribute("aria-describedby")).toBeNull();
  expect(mudar).not.toHaveBeenCalled();
});
it("o modo sem descrições mantém erros de consulta e o código salvo", async () => {
  fetchLocal.mockRejectedValueOnce(new Error("Falha sintética"));
  render(<SeletorFiscal mostrarDescricao={false} nome="NCM salvo" valor="99999999" mudar={vi.fn()} contexto={{ tabela: "ncm" }} />);
  const alerta = await screen.findByRole("alert");
  expect(alerta.textContent).toBe("A tabela não carregou. O valor salvo foi preservado.");
  const campo = screen.getByRole("combobox", { name: "NCM salvo" });
  expect(campo.getAttribute("aria-describedby")).toBe(alerta.id);
  expect(campo).toHaveProperty("value", expect.stringContaining("99999999"));
});
it("o modo sem descrições mantém o aviso de código fora de vigência", async () => {
  fetchLocal.mockImplementationOnce(async () => Response.json({ opcoes: [], selecionado: { codigo: "99999999", descricao: "Código antigo", vigente: false }, total: 0, limite: 50, versao: "Tabela fictícia da suíte" }));
  render(<SeletorFiscal mostrarDescricao={false} nome="NCM antigo" valor="99999999" mudar={vi.fn()} contexto={{ tabela: "ncm" }} />);
  expect(await screen.findByRole("status")).toHaveProperty("textContent", "Código salvo fora da vigência ou do contexto; revise antes de aprovar.");
  expect(screen.getByRole("combobox", { name: "NCM antigo" }).getAttribute("aria-invalid")).toBe("true");
  expect(screen.queryByText(/Tabela fictícia da suíte/)).toBeNull();
});
