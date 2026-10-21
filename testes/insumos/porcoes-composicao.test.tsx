// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComposicaoPicker } from "@/app/(protegido)/insumos/composicao-picker";
import { CampoNumeroPorcoes } from "@/components/campo-numero-porcoes";
import { ComposicaoProduto } from "@/app/(protegido)/vendas/produtos/composicao-produto";
import type { ComponenteRow, InsumoOption } from "@/app/(protegido)/insumos/types";
import { selecionarPorcao, type PorcaoInsumoOption } from "@/lib/insumos/porcoes";
import type { ProdutoEntrada } from "@/lib/vendas/dominio";

const { listar, salvar } = vi.hoisted(() => ({ listar: vi.fn(), salvar: vi.fn() }));
vi.mock("@/lib/insumos/consulta-porcoes-cliente", () => ({ consultarPorcoesNoCliente: listar, salvarPorcaoAction: salvar }));
vi.mock("@/components/cadastro-rapido-insumo-dialog", () => ({ CadastroRapidoInsumoDialog: () => null }));
const candidatos: InsumoOption[] = [{ id: "queijo", nome: "Queijo teste", tipo: "INSUMO", unidade: "KG", custoMedio: 20 }];
const porcao: PorcaoInsumoOption = { id: "fatia", insumoId: "queijo", nome: "8 fatias", quantidadeMedida: "8", unidadeMedida: "fatias", quantidade: "0.1", unidade: "KG", versao: 1 };
const item: ComponenteRow = { componenteId: "queijo", nome: "Queijo teste", tipo: "INSUMO", unidade: "KG", quantidade: 0.3, observacaoPorcao: "Montagem histórica" };
const comercial = { id: "queijo", nome: "Queijo teste", tipo: "INSUMO" as const, especificacao: null, unidade: "KG" as const, ativo: true, custo: 20, categoriaNome: null };
beforeEach(() => {
  listar.mockReset().mockResolvedValue({ porcoes: [porcao], podeCadastrar: true }); salvar.mockReset();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function Exemplo({ iniciais = [], produto = false }: { iniciais?: ComponenteRow[]; produto?: boolean }) {
  const [itens, mudar] = useState(iniciais);
  return <form><ComposicaoPicker candidatos={candidatos} itens={itens} onChange={mudar} ordenar={produto} configurarFicha={produto} /></form>;
}
async function escolher(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole("combobox", { name: "Ingrediente" }));
  await usuario.click(await screen.findByRole("option", { name: /Queijo teste/ }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Quantidade de porções" })).toHaveProperty("disabled", false));
}
it.each([["1", 0.1, "8 fatias"], ["0,5", 0.05, "4 fatias"], ["2", 0.2, "16 fatias"], ["1,25", 0.125, "10 fatias"]])("digita %s porções sem escolher descrição e converte medida, consumo e custo", async (qtd, quantidade, medida) => {
  const usuario = userEvent.setup(); const { container } = render(<Exemplo />);
  await escolher(usuario);
  await usuario.type(screen.getByRole("textbox", { name: "Quantidade de porções" }), qtd);
  const descricao = screen.getByRole("textbox", { name: "Descrição da porção do ingrediente" });
  expect(descricao).toHaveProperty("readOnly", true);
  expect(descricao).toHaveProperty("value", medida);
  expect(screen.queryByRole("combobox", { name: /Descrição/ })).toBeNull();
  expect(screen.getByRole("textbox", { name: "Quantidade do ingrediente" })).toHaveProperty("value", String(quantidade).replace(".", ","));
  await usuario.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
  expect(JSON.parse(String(new FormData(container.querySelector("form")!).get("componentes")))).toMatchObject({ quantidade, observacaoPorcao: medida, porcao: { quantidadeInsumo: "0.1", quantidadeMedida: "8", numeroPorcoes: qtd } });
  expect(screen.getAllByText((quantidade * 20).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, " ")).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /Salvar.*porção/i })).toBeNull(); expect(salvar).not.toHaveBeenCalled();
});
it.each([false, true])("digita o multiplicador em linha legada de preparação/produto (%s) sem selecionar medida", async produto => {
  const usuario = userEvent.setup(); const { container } = render(<Exemplo iniciais={[item]} produto={produto} />);
  const numero = screen.getByRole("textbox", { name: "Quantidade de porções de Queijo teste" });
  await waitFor(() => expect(numero).toHaveProperty("disabled", false));
  await usuario.type(numero, "2");
  expect(screen.getByRole("textbox", { name: "Descrição da porção de Queijo teste" })).toHaveProperty("value", "16 fatias");
  expect(screen.getByRole("textbox", { name: "Quantidade de Queijo teste" })).toHaveProperty("value", "0,2");
  expect(JSON.parse(String(new FormData(container.querySelector("form")!).get("componentes")))).toMatchObject({ quantidade: 0.2, observacaoPorcao: "16 fatias" });
  if (produto) expect(screen.getByRole("button", { name: /Exibir Queijo/ }).getAttribute("aria-pressed")).toBe("true");
});
it("preserva base histórica ao mudar o multiplicador mesmo após editar/excluir catálogo", async () => {
  listar.mockResolvedValue({ porcoes: [{ ...porcao, quantidade: "0.2", quantidadeMedida: "10", nome: "10 fatias" }], podeCadastrar: false });
  render(<Exemplo iniciais={[{ ...item, quantidade: 0.05, observacaoPorcao: "4 fatias", porcao: { ...selecionarPorcao(porcao), numeroPorcoes: "0.5" } }]} />);
  expect(screen.getByRole("textbox", { name: "Descrição da porção de Queijo teste" })).toHaveProperty("value", "4 fatias");
  fireEvent.change(screen.getByRole("textbox", { name: "Quantidade de porções de Queijo teste" }), { target: { value: "2" } });
  expect(screen.getByRole("textbox", { name: "Descrição da porção de Queijo teste" })).toHaveProperty("value", "16 fatias");
  expect(screen.getByRole("textbox", { name: "Quantidade de Queijo teste" })).toHaveProperty("value", "0,2");
});
it("carregar a medida não infere nem regrava uma referência histórica", async () => {
  const { container } = render(<Exemplo iniciais={[item]} />);
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Quantidade de porções de Queijo teste" })).toHaveProperty("disabled", false));
  expect(JSON.parse(String(new FormData(container.querySelector("form")!).get("componentes")))).toEqual({ componenteId: "queijo", quantidade: 0.3, observacaoPorcao: "Montagem histórica" });
  expect(screen.getByRole("textbox", { name: "Quantidade de porções de Queijo teste" })).toHaveProperty("value", "");
});
it("limpar Porção volta à quantidade direta sem perder o consumo convertido", async () => {
  const usuario = userEvent.setup(); render(<Exemplo iniciais={[{ ...item, quantidade: 0.2, porcao: { ...selecionarPorcao(porcao), numeroPorcoes: "2" } }]} />);
  await usuario.clear(screen.getByRole("textbox", { name: "Quantidade de porções de Queijo teste" }));
  expect(screen.getByRole("textbox", { name: "Quantidade de Queijo teste" })).toHaveProperty("value", "0,2");
  expect(screen.getByRole("textbox", { name: "Descrição da porção de Queijo teste" })).toHaveProperty("value", "");
});
it("impede multiplicação que exigiria arredondar o estoque", async () => {
  listar.mockResolvedValue({ porcoes: [{ ...porcao, quantidade: "0.000000001" }], podeCadastrar: true });
  const usuario = userEvent.setup(); render(<Exemplo />); await escolher(usuario);
  fireEvent.change(screen.getByRole("textbox", { name: "Quantidade de porções" }), { target: { value: "0,5" } });
  expect(screen.getByRole("alert").textContent).toContain("9 casas decimais");
  expect(screen.getByRole("button", { name: "Adicionar ingrediente" })).toHaveProperty("disabled", true);
});
it("produto preserva precisão legada e transporta a nova referência", async () => {
  const mudar = vi.fn(); const usuario = userEvent.setup();
  const props = { insumos: [comercial], mudar, podeCadastrarInsumo: false };
  const componentes: ProdutoEntrada["componentes"] = [{ insumoId: "queijo", unidade: "KG", quantidade: "123456789.123456789", observacaoPorcao: "Antiga" }];
  const { rerender } = render(<ComposicaoProduto {...props} componentes={componentes} />);
  await usuario.click(screen.getByRole("button", { name: /Exibir Queijo/ }));
  expect(mudar.mock.calls.at(-1)?.[0][0].quantidade).toBe("123456789.123456789");
  rerender(<ComposicaoProduto {...props} componentes={[{ insumoId: "queijo", unidade: "KG", quantidade: "0.05", porcao: { ...selecionarPorcao(porcao), numeroPorcoes: "0.5" } }]} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Quantidade de porções de Queijo teste" }), { target: { value: "2" } });
  expect(mudar.mock.calls.at(-1)?.[0][0]).toMatchObject({ quantidade: "0.2", porcao: { numeroPorcoes: "2" }, observacaoPorcao: "16 fatias" });
});
it("falha de consulta permite nova tentativa sem alterar a ficha", async () => {
  listar.mockResolvedValueOnce({ erro: "Consulta indisponível." }); const usuario = userEvent.setup(); render(<Exemplo iniciais={[item]} />);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Consulta indisponível."));
  await usuario.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull()); expect(listar).toHaveBeenCalledTimes(2);
});
it("descarta consulta atrasada depois de mudar ingrediente", async () => {
  let responder!: (r: unknown) => void; listar.mockImplementationOnce(() => new Promise(r => { responder = r; }));
  const mudar = vi.fn();
  const props = { unidade: "KG" as const, onChange: mudar, ariaLabel: "Porção" };
  const { rerender } = render(<CampoNumeroPorcoes {...props} insumoId="queijo" />);
  listar.mockResolvedValue({ porcoes: [{ ...porcao, insumoId: "molho", nome: "1 colher", quantidadeMedida: "1", unidadeMedida: "colher" }], podeCadastrar: false });
  rerender(<CampoNumeroPorcoes {...props} insumoId="molho" />);
  await act(async () => { responder({ porcoes: [porcao], podeCadastrar: true }); });
  const numero = screen.getByRole("textbox", { name: "Porção" });
  await waitFor(() => expect(numero).toHaveProperty("disabled", false));
  fireEvent.change(numero, { target: { value: "1" } });
  expect(mudar).toHaveBeenLastCalledWith(expect.objectContaining({ quantidadeMedida: "1", unidadeMedida: "colher" }));
});
it("permite quantidade direta no rascunho e remove a porção ao editar Qtd.", async () => {
  const usuario = userEvent.setup(); const { container } = render(<Exemplo />);
  await escolher(usuario);
  await usuario.type(screen.getByRole("textbox", { name: "Quantidade de porções" }), "1");
  const qtd = screen.getByRole("textbox", { name: "Quantidade do ingrediente" });
  await usuario.clear(qtd); await usuario.type(qtd, "0,123");
  expect(screen.getByRole("textbox", { name: "Descrição da porção do ingrediente" })).toHaveProperty("value", "");
  expect(screen.getByRole("textbox", { name: "Quantidade de porções" })).toHaveProperty("value", "");
  await usuario.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
  expect(JSON.parse(String(new FormData(container.querySelector("form")!).get("componentes")))).toEqual({ componenteId: "queijo", quantidade: 0.123, observacaoPorcao: null });
});
it.each([false, true])("Qtd. direta limpa o snapshot e mantém unidade fixa em preparação/produto (%s)", async produto => {
  const usuario = userEvent.setup(); const { container } = render(<Exemplo produto={produto} iniciais={[{ ...item, quantidade: 0.2, porcao: { ...selecionarPorcao(porcao), numeroPorcoes: "2" } }]} />);
  const qtd = screen.getByRole("textbox", { name: "Quantidade de Queijo teste" });
  expect(qtd.parentElement?.textContent).toBe("kg");
  await usuario.clear(qtd); await usuario.type(qtd, "0,15");
  expect(screen.getByRole("textbox", { name: "Quantidade de porções de Queijo teste" })).toHaveProperty("value", "");
  expect(screen.getByRole("textbox", { name: "Descrição da porção de Queijo teste" })).toHaveProperty("value", "");
  expect(JSON.parse(String(new FormData(container.querySelector("form")!).get("componentes")))).toEqual({ componenteId: "queijo", quantidade: 0.15, observacaoPorcao: null });
  expect(screen.getAllByText("R$ 3,00").length).toBeGreaterThan(0);
  expect(screen.queryByText("Insumo")).toBeNull();
});
it("nome do ingrediente nunca inclui a unidade, inclusive enquanto focado", async () => {
  const usuario = userEvent.setup(); render(<Exemplo />); await escolher(usuario);
  const nome = screen.getByRole("combobox", { name: "Ingrediente" });
  expect(nome).toHaveProperty("value", "Queijo teste");
  await usuario.click(nome);
  expect(nome).toHaveProperty("value", "Queijo teste");
  await usuario.keyboard("{Escape}"); await usuario.tab();
  expect(nome).toHaveProperty("value", "Queijo teste");
});
it("ausência de medida permite Qtd. direta sem inventar conversão", async () => {
  listar.mockResolvedValue({ porcoes: [], podeCadastrar: true });
  const usuario = userEvent.setup(); render(<Exemplo />);
  await usuario.click(screen.getByRole("combobox", { name: "Ingrediente" }));
  await usuario.click(await screen.findByRole("option", { name: /Queijo teste/ }));
  await usuario.type(screen.getByRole("textbox", { name: "Quantidade do ingrediente" }), "0,2");
  expect(screen.getByRole("textbox", { name: "Quantidade de porções" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Adicionar ingrediente" })).toHaveProperty("disabled", false);
});

it("FM é um botão compacto com estado acessível e alterna somente a ficha", async () => {
  const mudar = vi.fn();
  const componentes: ProdutoEntrada["componentes"] = [{ insumoId: "queijo", unidade: "KG", quantidade: "0.123456789", exibirFicha: true }];
  const props = { insumos: [comercial], mudar, podeCadastrarInsumo: false };
  const { rerender } = render(<ComposicaoProduto {...props} componentes={componentes} />);
  const fm = screen.getByRole("button", { name: /Exibir Queijo/ });
  expect(fm.textContent).toBe("FM"); expect(fm.title).toContain("Ficha de montagem"); expect(fm.getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(fm);
  expect(mudar).toHaveBeenLastCalledWith([expect.objectContaining({ quantidade: "0.123456789", exibirFicha: false })]);
  rerender(<ComposicaoProduto {...props} componentes={[{ ...componentes[0], exibirFicha: false }]} />);
  expect(fm.getAttribute("aria-pressed")).toBe("false"); fireEvent.click(fm);
  expect(mudar).toHaveBeenLastCalledWith([expect.objectContaining({ quantidade: "0.123456789", exibirFicha: true })]);
});
it("completa o zero em Porção e Qtd. e limita a digitação manual a três casas", async () => {
  const usuario = userEvent.setup(); const { container } = render(<Exemplo produto />); await escolher(usuario);
  const numero = screen.getByRole("textbox", { name: "Quantidade de porções" });
  await usuario.type(numero, ",5"); expect(numero).toHaveProperty("value", "0,5");
  expect(screen.getByRole("textbox", { name: "Descrição da porção do ingrediente" })).toHaveProperty("value", "4 fatias");
  const qtd = screen.getByRole("textbox", { name: "Quantidade do ingrediente" });
  await usuario.clear(qtd); await usuario.type(qtd, ",125"); expect(qtd).toHaveProperty("value", "0,125");
  await usuario.type(qtd, "4a"); expect(qtd).toHaveProperty("value", "0,125");
  await usuario.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
  expect(JSON.parse(String(new FormData(container.querySelector("form")!).get("componentes")))).toMatchObject({ quantidade: 0.125 });
  const linha = screen.getByRole("textbox", { name: "Quantidade de Queijo teste" });
  fireEvent.change(linha, { target: { value: ",5" } }); expect(linha).toHaveProperty("value", "0,5");
  expect(screen.getAllByText("R$ 10,00").length).toBeGreaterThan(0);
  expect(screen.getByLabelText("Custo de Queijo teste").querySelector("input")).toBeNull();
});
it("não arredonda consumo derivado que precise de mais de três casas", () => {
  render(<Exemplo iniciais={[{ ...item, quantidade: 0.0005, porcao: { ...selecionarPorcao({ ...porcao, quantidade: "0.001" }), numeroPorcoes: "0.5" } }]} />);
  expect(screen.getByRole("textbox", { name: "Quantidade de Queijo teste" })).toHaveProperty("value", "0,0005");
});

it("ficha com snapshot calcula porções sem depender de rede ou catálogo", async () => {
  listar.mockRejectedValue(new Error("Server Action da versão anterior"));
  render(<Exemplo iniciais={[{ ...item, quantidade: 0.1, porcao: selecionarPorcao(porcao) }]} />);
  expect(listar).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole("textbox", { name: "Quantidade de porções de Queijo teste" }), { target: { value: "0,5" } });
  expect(screen.getByRole("textbox", { name: "Descrição da porção de Queijo teste" })).toHaveProperty("value", "4 fatias");
  expect(screen.getByRole("textbox", { name: "Quantidade de Queijo teste" })).toHaveProperty("value", "0,05");
  expect(screen.queryByRole("alert")).toBeNull();
});
it("falha de rede mantém aviso acessível compacto e Qtd. direta operante", async () => {
  listar.mockRejectedValueOnce(new TypeError("offline"));
  const usuario = userEvent.setup();
  render(<Exemplo iniciais={[item]} />);
  const aviso = await screen.findByRole("alert");
  expect(aviso.className).toBe("sr-only");
  expect(screen.getByRole("button", { name: "Tentar novamente" }).title).toContain("Não foi possível carregar");
  const qtd = screen.getByRole("textbox", { name: "Quantidade de Queijo teste" });
  expect(qtd).toHaveProperty("disabled", false);
  await usuario.clear(qtd); await usuario.type(qtd, ",5");
  expect(qtd).toHaveProperty("value", "0,5");
  await usuario.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(qtd).toHaveProperty("value", "0,5");
  expect(salvar).not.toHaveBeenCalled();
});
