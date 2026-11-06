// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { ManifestoNfsView } from "@/app/(protegido)/financeiro/manifesto-nfs/manifesto-nfs-view";

const base = { identificador: "teste", chaveAcesso: null, origem: "NACIONAL", numero: "42", serie: null, codigoVerificacao: null, prestadorCnpj: null, prestadorDados: null, tomadorNome: "Tomador teste", tomadorCnpj: null, tomadorDados: null, fornecedorNome: null, valorServico: 100, valorLiquido: 100, valorIss: 0, dataEmissao: "2026-09-15T12:00:00Z", dataCompetencia: null, dataVencimento: null, destinoFinanceiro: null, municipioNome: null, uf: null, lancada: false, temXml: true };
const notas = [
  { ...base, id: "pendente", prestadorNome: "Prestador Pendente", status: "PENDENTE" },
  { ...base, id: "lancada", prestadorNome: "Prestador Lançado", status: "LANCADA", lancada: true },
  { ...base, id: "ignorada", prestadorNome: "Prestador Ignorado", status: "IGNORADA" },
];
function tela(podeEditar = true) { render(<ManifestoNfsView notas={notas} categorias={[]} cartoes={[]} podeImportar podeLancar={podeEditar} podeEditar={podeEditar} />); }
async function selecionarDestino(rotulo: "Gerar despesa" | "Somente registro fiscal") {
  const usuario = userEvent.setup();
  screen.getByRole("combobox", { name: "Destino financeiro" }).focus();
  await usuario.keyboard("{ArrowDown}");
  await usuario.click(await screen.findByRole("option", { name: rotulo, exact: true }));
}
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

describe("vencimento no aceite de NFS-e", () => {
  it("envia somente a data escolhida ao confirmar o aceite", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetch);
    tela();
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await selecionarDestino("Gerar despesa");
    const campo = screen.getByLabelText("Vencimento do pagamento (opcional)") as HTMLInputElement;
    expect(campo.value).toBe("");
    expect(campo.min).toBe("2000-01-01");
    expect(campo.max).toBe("2200-12-31");
    fireEvent.change(campo, { target: { value: "2026-10-20" } });
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/nfse/situacao", expect.objectContaining({ body: JSON.stringify({ nfseId: "pendente", decisao: "ACEITAR", destinoFinanceiro: "FINANCEIRO", dataVencimento: "2026-10-20" }) })));
    expect(fetch).not.toHaveBeenCalledWith("/api/nfse/lancar", expect.anything());
  });

  it("exige escolha de destino e permite gerar despesa sem vencimento implícito", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetch);
    tela();
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    const confirmar = screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    expect(screen.queryByLabelText("Vencimento do pagamento (opcional)")).toBeNull();
    fireEvent.click(confirmar);
    expect(fetch).not.toHaveBeenCalled();
    await selecionarDestino("Gerar despesa");
    fireEvent.click(confirmar);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/nfse/situacao", expect.objectContaining({ body: JSON.stringify({ nfseId: "pendente", decisao: "ACEITAR", destinoFinanceiro: "FINANCEIRO" }) })));
  });

  it("mantém o campo e bloqueia o aceite quando o ano está fora do domínio", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    tela();
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await selecionarDestino("Gerar despesa");
    const campo = screen.getByLabelText("Vencimento do pagamento (opcional)") as HTMLInputElement;
    fireEvent.change(campo, { target: { value: "2201-01-01" } });
    expect(campo.value).toBe("2201-01-01");
    expect(screen.getByRole("alert").textContent).toContain("data válida");
    expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mostra a data civil aceita e a sugere no lançamento sem impedir a edição", () => {
    render(<ManifestoNfsView notas={[{ ...notas[0], status: "ACEITA", dataVencimento: "2026-10-20" }]} categorias={[]} cartoes={[]} podeImportar podeLancar podeEditar />);
    fireEvent.click(screen.getByRole("button", { name: "Aceitas (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    expect(screen.getByText("20/10/2026")).toBeTruthy();
    const campo = screen.getByLabelText("Primeiro vencimento") as HTMLInputElement;
    expect(campo.value).toBe("2026-10-20");
    fireEvent.change(campo, { target: { value: "2026-10-25" } });
    expect(campo.value).toBe("2026-10-25");
  });
});

it("aplica o vencimento ao lançamento na mesma abertura após o aceite", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetch);
  const propriedades = { categorias: [], cartoes: [], podeImportar: true, podeLancar: true, podeEditar: true };
  const { rerender } = render(<ManifestoNfsView {...propriedades} notas={[notas[0]]} />);
  fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
  fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
  await selecionarDestino("Gerar despesa");
  fireEvent.change(screen.getByLabelText("Vencimento do pagamento (opcional)"), { target: { value: "2026-10-20" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aceite" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar aceite" })).toBeNull());
  rerender(<ManifestoNfsView {...propriedades} notas={[{ ...notas[0], status: "ACEITA", destinoFinanceiro: "FINANCEIRO", dataVencimento: "2026-10-20" }]} />);
  expect((screen.getByLabelText("Primeiro vencimento") as HTMLInputElement).value).toBe("2026-10-20");
});

it("preserva o vencimento preenchido quando o aceite falha", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ erro: "A situação mudou." }) });
  vi.stubGlobal("fetch", fetch);
  tela();
  fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
  fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
  await selecionarDestino("Gerar despesa");
  fireEvent.change(screen.getByLabelText("Vencimento do pagamento (opcional)"), { target: { value: "2026-10-20" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar aceite" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Confirmar aceite" }) as HTMLButtonElement).disabled).toBe(false));
  expect((screen.getByLabelText("Vencimento do pagamento (opcional)") as HTMLInputElement).value).toBe("2026-10-20");
});

describe("destino financeiro da NFS-e", () => {
  const propriedades = { categorias: [], cartoes: [], podeImportar: true, podeLancar: true, podeEditar: true };

  it("registra somente fiscal sem vencimento ou formulário financeiro", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetch);
    const { rerender } = render(<ManifestoNfsView {...propriedades} notas={[notas[0]]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await selecionarDestino("Gerar despesa");
    fireEvent.change(screen.getByLabelText("Vencimento do pagamento (opcional)"), { target: { value: "2026-10-20" } });
    await selecionarDestino("Somente registro fiscal");
    expect(screen.queryByLabelText("Vencimento do pagamento (opcional)")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Aceitar NFS-e?" })).toBeNull());
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/nfse/situacao", expect.objectContaining({ body: JSON.stringify({ nfseId: "pendente", decisao: "ACEITAR", destinoFinanceiro: "SOMENTE_FISCAL" }) }));
    rerender(<ManifestoNfsView {...propriedades} notas={[{ ...notas[0], status: "ACEITA", destinoFinanceiro: "SOMENTE_FISCAL" }]} />);
    const painel = screen.getByRole("dialog", { name: "Ver nota" });
    const detalhes = within(painel);
    expect(detalhes.getByText("Somente registro fiscal", { exact: true })).toBeTruthy();
    expect(detalhes.queryByLabelText("Primeiro vencimento")).toBeNull();
    expect(detalhes.queryByRole("button", { name: "Lançar despesa" })).toBeNull();
    const rodape = painel.querySelector<HTMLElement>('[data-slot="dialog-footer"]')!;
    fireEvent.click(within(rodape).getByRole("button", { name: "Fechar", exact: true }));
    expect(screen.getByRole("button", { name: "Pendentes (0)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aceitas (1)" }));
    expect(within(screen.getByRole("table")).getByText("Somente registro fiscal", { exact: true })).toBeTruthy();
  });

  it("altera o destino nos dois sentidos, respeita o valor legado e conserva o vencimento", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetch);
    const aceitaLegada = { ...notas[0], status: "ACEITA", dataVencimento: "2026-10-20" };
    const somenteFiscal = { ...aceitaLegada, destinoFinanceiro: "SOMENTE_FISCAL" as const };
    const { rerender } = render(<ManifestoNfsView {...propriedades} notas={[aceitaLegada]} />);
    fireEvent.click(screen.getByRole("button", { name: "Aceitas (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    expect((screen.getByLabelText("Primeiro vencimento") as HTMLInputElement).value).toBe("2026-10-20");
    fireEvent.click(screen.getByRole("button", { name: "Alterar destino financeiro" }));
    expect((screen.getByRole("button", { name: "Confirmar alteração" }) as HTMLButtonElement).disabled).toBe(true);
    await selecionarDestino("Somente registro fiscal");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar alteração" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Alterar destino financeiro?" })).toBeNull());
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/nfse/situacao", expect.objectContaining({ body: JSON.stringify({ nfseId: "pendente", decisao: "ALTERAR_DESTINO_FINANCEIRO", destinoFinanceiro: "SOMENTE_FISCAL", destinoFinanceiroAnterior: null }) }));
    rerender(<ManifestoNfsView {...propriedades} notas={[somenteFiscal]} />);
    expect(screen.queryByLabelText("Primeiro vencimento")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Alterar destino financeiro" }));
    await selecionarDestino("Gerar despesa");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar alteração" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Alterar destino financeiro?" })).toBeNull());
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/nfse/situacao", expect.objectContaining({ body: JSON.stringify({ nfseId: "pendente", decisao: "ALTERAR_DESTINO_FINANCEIRO", destinoFinanceiro: "FINANCEIRO", destinoFinanceiroAnterior: "SOMENTE_FISCAL" }) }));
    rerender(<ManifestoNfsView {...propriedades} notas={[{ ...aceitaLegada, destinoFinanceiro: "FINANCEIRO" }]} />);
    expect((screen.getByLabelText("Primeiro vencimento") as HTMLInputElement).value).toBe("2026-10-20");
  });

  it("permite escolher o destino sem permissão de lançar e não abre o financeiro", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetch);
    const { rerender } = render(<ManifestoNfsView {...propriedades} podeLancar={false} notas={[notas[0]]} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));
    await selecionarDestino("Gerar despesa");
    fireEvent.click(screen.getByRole("button", { name: "Confirmar aceite" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Aceitar NFS-e?" })).toBeNull());
    expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/nfse/situacao", expect.objectContaining({ body: JSON.stringify({ nfseId: "pendente", decisao: "ACEITAR", destinoFinanceiro: "FINANCEIRO" }) }));
    rerender(<ManifestoNfsView {...propriedades} podeLancar={false} notas={[{ ...notas[0], status: "ACEITA", destinoFinanceiro: "FINANCEIRO" }]} />);
    expect(screen.getByRole("button", { name: "Alterar destino financeiro" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Lançar despesa" })).toBeNull();
    expect(screen.queryByLabelText("Primeiro vencimento")).toBeNull();
  });

  it.each([["LANCADA", true], ["ACEITA", true], ["CANCELADA", false], ["CANCELADA", true]])("não permite lançar nem alterar destino no estado %s com vínculo %s", (status, lancada) => {
    render(<ManifestoNfsView {...propriedades} notas={[{ ...notas[0], status, lancada, destinoFinanceiro: "FINANCEIRO" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Todas (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Ver nota" }));
    expect(screen.queryByRole("button", { name: "Alterar destino financeiro" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lançar despesa" })).toBeNull();
    expect(screen.queryByLabelText("Primeiro vencimento")).toBeNull();
  });
});
