// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BiVendas } from "@/components/vendas/bi/bi-vendas";
import type { FiltrosBi, ResultadoBi } from "@/lib/vendas/bi-types";
import { criarBiFicticio } from "../visual/bi-vendas-dados";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/components/vendas/bi/bi-mapa", () => ({ MapaCalorEntregas: () => null }));

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/vendas/bi?aba=clientes");
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function iniciar(entrada: Partial<FiltrosBi> = {}, estado = "normal") {
  const consultar = vi.fn(async (filtros: FiltrosBi) => criarBiFicticio(filtros, estado));
  const dados = criarBiFicticio({ aba: "clientes", ...entrada }, estado);
  render(<BiVendas dados={dados} consultar={consultar} />);
  return consultar;
}

async function selecionar(nome: string, consulta = nome) {
  const campo = screen.getByRole("combobox", { name: "Cliente comprador" });
  await userEvent.click(campo);
  fireEvent.change(campo, { target: { value: consulta } });
  await userEvent.click(await screen.findByRole("option", { name: nome }));
}

describe("busca de cliente no Dashboard", () => {
  it("busca nome sem distinguir acentos, caixa ou espaços e consulta somente ao selecionar o ID", async () => {
    const consultar = iniciar({ pagina: 3, canal: "site" });
    await userEvent.click(screen.getByRole("combobox", { name: "Cliente comprador" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Cliente comprador" }), { target: { value: "  COMPRADOR SINTETICO 4  " } });
    expect(await screen.findByRole("option", { name: "Comprador sintético 4" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Comprador sintético 5" })).toBeNull();
    expect(consultar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("option", { name: "Comprador sintético 4" }));
    await waitFor(() => expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ cliente: "cliente-3", pagina: 1, canal: "site", de: "2026-01-01", ate: "2026-09-30" })));
    await waitFor(() => expect(new URLSearchParams(location.search).get("cliente")).toBe("cliente-3"));
    expect(screen.getByRole("link", { name: "Exportar" }).getAttribute("href")).toContain("cliente=cliente-3");
    expect(screen.getByRole("combobox", { name: "Cliente comprador" }).getAttribute("value")).toBe("Comprador sintético 4");
    expect(screen.queryByRole("cell", { name: "Comprador sintético 5" })).toBeNull();
  });

  it("mantém cliente na ordenação e no tipo, e limpa a seleção com o botão X", async () => {
    const consultar = iniciar({ cliente: "cliente-3" });
    await userEvent.click(screen.getByRole("button", { name: /^Pedidos/ }));
    await waitFor(() => expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ cliente: "cliente-3", ordemClientes: "compras", pagina: 1 })));
    await userEvent.click(screen.getByRole("button", { name: /Pessoa jurídica/ }));
    await waitFor(() => expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ cliente: "cliente-3", tipoCliente: "PJ" })));
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtro de cliente" }));
    await waitFor(() => expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ cliente: "", tipoCliente: "PJ", pagina: 1 })));
    await waitFor(() => expect(new URLSearchParams(location.search).has("cliente")).toBe(false));
    expect(screen.queryByRole("button", { name: "Limpar filtro de cliente" })).toBeNull();
  });

  it("o cliente nos filtros adicionais só entra na consulta após Aplicar filtros", async () => {
    const consultar = iniciar({ aba: "produtos" });
    await userEvent.click(screen.getByRole("button", { name: "Mais filtros" }));
    await selecionar("Comprador sintético 4");
    expect(consultar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ cliente: "cliente-3", aba: "produtos" })));
    await waitFor(() => expect(new URLSearchParams(location.search).get("cliente")).toBe("cliente-3"));
  });

  it("preserva o cliente ao paginar e usa o filtro canônico retornado pelo servidor", async () => {
    const dados = criarBiFicticio({ aba: "clientes", cliente: "cliente-3", pagina: 2 });
    dados.clientes = { ...dados.clientes, total: 70, paginas: 3 };
    const consultar = vi.fn(async (filtros: FiltrosBi) => {
      const resposta = criarBiFicticio({ ...filtros, cliente: "cliente-4" });
      resposta.clientes = { ...resposta.clientes, total: 70, paginas: 3 };
      return resposta;
    });
    render(<BiVendas dados={dados} consultar={consultar} />);
    await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(consultar).toHaveBeenCalledWith(expect.objectContaining({ cliente: "cliente-3", pagina: 3 }));
    await waitFor(() => expect(new URLSearchParams(location.search).get("cliente")).toBe("cliente-4"));
    expect(new URLSearchParams(location.search).get("pagina")).toBe("3");
    expect(screen.getByRole("combobox", { name: "Cliente comprador" }).getAttribute("value")).toBe("Comprador sintético 5");
    expect(screen.getByRole("link", { name: "Exportar" }).getAttribute("href")).toContain("cliente=cliente-4");
  });

  it("esconde a busca e as opções quando a sessão não permite consultar contatos", async () => {
    iniciar({}, "restrito");
    expect(screen.queryByRole("combobox", { name: "Cliente comprador" })).toBeNull();
    expect(screen.queryByText("Comprador sintético 4")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Mais filtros" }));
    expect(screen.queryByRole("combobox", { name: "Cliente comprador" })).toBeNull();
    expect(screen.queryByText("Cliente comprador", { exact: true })).toBeNull();
  });

  it("conserva seleção e exportação confirmadas quando a nova consulta falha", async () => {
    const consultar = vi.fn(async (): Promise<ResultadoBi | { erro: string }> => ({ erro: "Consulta sintética indisponível" }));
    render(<BiVendas dados={criarBiFicticio({ aba: "clientes", cliente: "cliente-3" })} consultar={consultar} />);
    await selecionar("Comprador sintético 5");
    await screen.findByRole("alert");
    expect(screen.getByRole("combobox", { name: "Cliente comprador" }).getAttribute("value")).toBe("Comprador sintético 4");
    expect(screen.getByRole("link", { name: "Exportar" }).getAttribute("href")).toContain("cliente=cliente-3");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(consultar).toHaveBeenLastCalledWith(expect.objectContaining({ cliente: "cliente-4" }));
  });

  it("ignora resposta antiga após outra seleção de cliente", async () => {
    const pendentes: { filtros: FiltrosBi; resolver: (valor: ResultadoBi) => void }[] = [];
    const consultar = vi.fn((filtros: FiltrosBi) => new Promise<ResultadoBi>(resolver => pendentes.push({ filtros, resolver })));
    render(<BiVendas dados={criarBiFicticio({ aba: "clientes" })} consultar={consultar} />);
    await selecionar("Comprador sintético 4");
    await selecionar("Comprador sintético 5");
    expect(pendentes).toHaveLength(2);
    await act(async () => pendentes[1].resolver(criarBiFicticio(pendentes[1].filtros)));
    await act(async () => pendentes[0].resolver(criarBiFicticio(pendentes[0].filtros)));
    expect(screen.getByRole("combobox", { name: "Cliente comprador" }).getAttribute("value")).toBe("Comprador sintético 5");
    expect(new URLSearchParams(location.search).get("cliente")).toBe("cliente-4");
    expect(screen.getByRole("link", { name: "Exportar" }).getAttribute("href")).toContain("cliente=cliente-4");
  });
});

describe("total original da fonte histórica no Dashboard", () => {
  function dadosComOrigem(entrada: Partial<FiltrosBi> = {}) {
    const dados = criarBiFicticio({ aba: "clientes", cliente: "cliente-3", ...entrada });
    dados.indicadores.vendas = 100;
    dados.clientes.linhas = dados.clientes.linhas.map(cliente => ({ ...cliente, valor: 100 }));
    dados.cobertura = { ...dados.cobertura, totalOriginalHistorico: 80, pedidosTotalOriginalHistorico: 2, ajustesFrete: -20 };
    return dados;
  }

  it("separa total original e ajuste histórico do valor gasto apurado nas vendas", () => {
    render(<BiVendas dados={dadosComOrigem()} />);
    expect(screen.getByText(/2 pedidos históricos · Total original na fonte: R\$\s*80,00 · Ajustes históricos de frete: -R\$\s*20,00 \(separados das vendas\)/)).toBeTruthy();
    expect(screen.getByRole("cell", { name: /^R\$\s*100,00$/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Exportar" }).getAttribute("href")).toContain("cliente=cliente-3");
  });

  it("mostra Não apurado quando falta o total original, sem substituir por zero ou pelas vendas", () => {
    const dados = dadosComOrigem();
    dados.cobertura.totalOriginalHistorico = null;
    render(<BiVendas dados={dados} />);
    expect(screen.getByText(/2 pedidos históricos · Total original na fonte: Não apurado · Ajustes históricos de frete: -R\$\s*20,00 \(separados das vendas\)/)).toBeTruthy();
    expect(screen.queryByText(/Total original na fonte: R\$\s*0,00/)).toBeNull();
  });

  it.each([
    ["sem cliente", { cliente: "" }],
    ["com categoria", { categoria: "grazing" }],
    ["com produto", { produto: "produto-0" }],
  ] as const)("não apresenta a nota %s", (_nome, filtro) => {
    render(<BiVendas dados={dadosComOrigem(filtro)} />);
    expect(screen.queryByText(/Total original na fonte:/)).toBeNull();
  });

  it("não expõe a nota quando a sessão não permite consultar contatos", () => {
    const dados = dadosComOrigem();
    dados.permissoes.contatos = false;
    render(<BiVendas dados={dados} />);
    expect(screen.queryByText(/Total original na fonte:/)).toBeNull();
    expect(screen.queryByText(/Ajustes históricos de frete:/)).toBeNull();
  });

  it("a fixture padrão conserva ausência de total original comprovado", () => {
    const dados = criarBiFicticio();
    expect(dados.cobertura.totalOriginalHistorico).toBeNull();
    expect(dados.cobertura.pedidosTotalOriginalHistorico).toBe(0);
  });
});
