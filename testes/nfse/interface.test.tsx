// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ManifestoNfsView } from "@/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view";

const base = { identificador: "teste", chaveAcesso: null, origem: "NACIONAL", numero: "42", serie: null, codigoVerificacao: null, prestadorCnpj: null, prestadorDados: null, tomadorNome: "Tomador teste", tomadorCnpj: null, tomadorDados: null, fornecedorNome: null, valorServico: 100, valorLiquido: 100, valorIss: 0, dataEmissao: "2026-09-15T12:00:00Z", dataCompetencia: null, municipioNome: null, uf: null, lancada: false, temXml: true };
const notas = [
  { ...base, id: "pendente", prestadorNome: "Prestador Pendente", status: "PENDENTE" },
  { ...base, id: "lancada", prestadorNome: "Prestador Lançado", status: "LANCADA", lancada: true },
  { ...base, id: "ignorada", prestadorNome: "Prestador Ignorado", status: "IGNORADA" },
];
function tela(podeEditar = true) { render(<ManifestoNfsView notas={notas} categorias={[]} cartoes={[]} podeImportar podeLancar={podeEditar} podeEditar={podeEditar} />); }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("filtros e ações da interface", () => {
  it("abre em pendentes, combina datas e mantém o total geral", () => {
    tela();
    expect(screen.getByRole("button", { name: "Pendentes (1)" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Prestador Ignorado")).toBeNull();
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-16" } });
    fireEvent.blur(screen.getByLabelText("De"));
    expect(screen.queryByText("Prestador Pendente")).toBeNull();
    expect(screen.getByRole("button", { name: "Pendentes (0)" })).toBeTruthy();
    expect(screen.getByText("Total de notas pendentes")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-09-15" } });
    fireEvent.blur(screen.getByLabelText("De"));
    fireEvent.change(screen.getByLabelText("até"), { target: { value: "2026-09-15" } });
    fireEvent.blur(screen.getByLabelText("até"));
    expect(screen.getByRole("columnheader", { name: "Valor" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Emissão" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Manifestação" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Ações" })).toBeTruthy();
    expect(screen.queryByRole("columnheader", { name: "Documento" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Todas \(\d[\d.]*\)$/ }));
    expect(screen.getAllByRole("button", { name: "Ver nota" })).toHaveLength(3);
    fireEvent.change(screen.getByLabelText("Buscar notas"), { target: { value: "lançado" } });
    expect(screen.getAllByRole("button", { name: "Ver nota" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Ignorar nota" })).toBeNull();
  });
  it("mantém aceite e recusa dentro dos detalhes e exige confirmação", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetch);
    tela();
    expect(screen.queryByRole("button", { name: "Ignorar nota" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recusar" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar recusa" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/nfse/situacao", expect.objectContaining({ body: JSON.stringify({ nfseId: "pendente", decisao: "RECUSAR" }) })));
    await waitFor(() => expect(screen.getAllByRole("dialog")).toHaveLength(1));
  });
  it("perfil de consulta exporta mas não altera a situação", () => {
    tela(false);
    expect(screen.getByRole("button", { name: "Exportar XML" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ignorar nota" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Recusar" })).toBeNull();
  });
});

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-18T15:00:00Z")); });
afterEach(() => vi.useRealTimers());

it("conta também aceitas e recusadas, ignora a situação atual e aplica a busca", () => {
  tela();
  for (const nome of ["Todas (3)", "Pendentes (1)", "Aceitas (1)", "Recusadas (1)"]) expect(screen.getByRole("button", { name: nome })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Buscar notas"), { target: { value: "lançado" } });
  for (const nome of ["Todas (1)", "Pendentes (0)", "Aceitas (1)", "Recusadas (0)"]) expect(screen.getByRole("button", { name: nome })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Aceitas (1)" }));
  expect(screen.getByText("Prestador Lançado")).toBeTruthy();
});
