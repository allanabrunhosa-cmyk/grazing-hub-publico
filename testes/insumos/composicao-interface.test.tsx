// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComposicaoPicker } from "@/app/(protegido)/insumos/composicao-picker";
import { ComposicaoProduto } from "@/app/(protegido)/vendas/produtos/composicao-produto";
import type { ProdutoEntrada } from "@/lib/vendas/dominio";
import { InsumoForm } from "@/app/(protegido)/insumos/insumo-form";
import { insumoStatus } from "../cadastros/dados";
import type { ComponenteRow, InsumoOption } from "@/app/(protegido)/insumos/types";

const candidatos: InsumoOption[] = [
  { id: "acucar", nome: "Açúcar", especificacao: "Cristal branco", tipo: "INSUMO", unidade: "KG" },
  { id: "molho", nome: "Molho preparado", tipo: "PRODUTO_INTERMEDIARIO", unidade: "L" },
];

vi.mock("@/app/(protegido)/insumos/actions", () => ({
  saveInsumoAction: vi.fn(),
  createCategoriaAction: vi.fn(),
  createCentroCustoAction: vi.fn(),
}));
vi.mock("@/lib/insumos/consulta-porcoes-cliente", () => ({
  consultarPorcoesNoCliente: vi.fn(async () => ({ porcoes: [], podeCadastrar: false })),
  salvarPorcaoAction: vi.fn(),
}));
vi.mock("@/app/(protegido)/fornecedores/actions", () => ({
  saveFornecedorAction: vi.fn(),
  salvarBeneficiarioAction: vi.fn(),
  createCanalPedidoAction: vi.fn(),
  createFormaPagamentoAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function ExemploComposicao() {
  const [itens, setItens] = useState<ComponenteRow[]>([]);
  return (
    <form>
      <ComposicaoPicker candidatos={candidatos} itens={itens} onChange={setItens} />
    </form>
  );
}

it("conserva a especificação da composição de preparações em Suprimentos", () => {
  render(<InsumoForm insumo={{ ...insumoStatus, tipo: "PRODUTO_INTERMEDIARIO", componentes: [
    { componenteId: "acucar", nome: "Açúcar", especificacao: "Cristal branco", tipo: "INSUMO", unidade: "KG", quantidade: 0.1, observacaoPorcao: "1 colher" },
  ] }} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={candidatos} renderFooter={() => null} />);
  expect(within(screen.getByRole("list", { name: "Ingredientes da receita" })).getByText("Cristal branco")).toBeTruthy();
});

it("Vendas omite especificações em ingredientes salvos, adicionados e no cadastro rápido", async () => {
  const usuario = userEvent.setup();
  function ProdutoTeste() {
    const [componentes, mudar] = useState<ProdutoEntrada["componentes"]>([
      { insumoId: "damasco", quantidade: "0.08", unidade: "KG", observacaoPorcao: "8 un", exibirFicha: true },
    ]);
    return <ComposicaoProduto componentes={componentes} mudar={mudar} podeCadastrarInsumo insumos={[
      { id: "damasco", nome: "Damasco turco seco", especificacao: "12.5kg cada caixa", tipo: "INSUMO", unidade: "KG", categoriaNome: "Frutas", custo: 69, ativo: true },
      { id: "acucar", nome: "Açúcar", especificacao: "Cristal branco", tipo: "INSUMO", unidade: "KG", categoriaNome: "Secos", custo: 10, ativo: true },
    ]} />;
  }
  render(<ProdutoTeste />);
  expect(screen.getByText("Damasco turco seco")).toBeTruthy();
  expect(screen.queryByText("12.5kg cada caixa")).toBeNull();
  expect(screen.getByRole("textbox", { name: "Descrição da porção de Damasco turco seco" })).toHaveProperty("value", "8 un");
  expect(screen.getByLabelText("Custo de Damasco turco seco").textContent).toContain("5,52");
  await usuario.click(screen.getByRole("combobox", { name: "Ingrediente" }));
  await usuario.click(screen.getByRole("option", { name: /Açúcar.*kg/i }));
  await usuario.type(screen.getByRole("textbox", { name: "Quantidade do ingrediente" }), "0,1");
  await usuario.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
  expect(within(screen.getByRole("list", { name: "Ingredientes da receita" })).getByText("Açúcar")).toBeTruthy();
  expect(screen.queryByText("Cristal branco")).toBeNull();
  await usuario.click(screen.getByRole("button", { name: "Cadastrar novo insumo" }));
  expect(screen.getByRole("dialog", { name: "Novo insumo" })).toBeTruthy();
  expect(screen.queryByLabelText("Especificação")).toBeNull();
});

it("reúne insumos e preparações na mesma busca e informa a unidade", async () => {
  const usuario = userEvent.setup();
  const { container } = render(<ExemploComposicao />);

  const busca = screen.getByRole("combobox", { name: "Ingrediente" });
  await usuario.click(busca);
  const opcaoInsumo = screen.getByRole("option", { name: /Açúcar.*kg/i });
  const opcaoPreparacao = screen.getByRole("option", { name: /Molho preparado.*L/i });
  expect(opcaoInsumo).toBeTruthy();
  expect(opcaoPreparacao).toBeTruthy();

  await usuario.click(opcaoPreparacao);
  expect(screen.getByText("L")).toBeTruthy();
  await usuario.type(screen.getByRole("textbox", { name: "Quantidade do ingrediente" }), "2,5");
  await usuario.tab();
  await usuario.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));

  const lista = screen.getByRole("list", { name: "Ingredientes da receita" });
  expect(within(lista).getByText("Molho preparado")).toBeTruthy();
  expect((within(lista).getByRole("textbox", { name: "Quantidade de Molho preparado" }) as HTMLInputElement).value).toBe("2,5");
  expect((within(lista).getByRole("textbox", { name: "Descrição da porção de Molho preparado" }) as HTMLInputElement).value).toBe("");
  const componentes = new FormData(container.querySelector("form")!).getAll("componentes");
  expect(componentes.map(String).map((componente) => JSON.parse(componente))).toEqual([
    { componenteId: "molho", quantidade: 2.5, observacaoPorcao: null },
  ]);
});

it("organiza a preparação em uma coluna com composição após a identificação e estoque por último", async () => {
  const usuario = userEvent.setup();
  const { container } = render(
    <InsumoForm
      categorias={[]}
      centrosCusto={[]}
      fornecedores={[]}
      todosInsumos={candidatos}
      podeConfigurarEtiqueta
      renderFooter={() => null}
    />,
  );

  await usuario.click(screen.getByRole("button", { name: /Preparação.*Base para receitas/i }));
  expect(screen.getByLabelText("Especificação")).toBeTruthy();
  const titulos = [...container.querySelectorAll("form > div > section > p:first-child")].map((elemento) => elemento.textContent);
  expect(titulos).toEqual([
    "Identificação",
    "Composição da receita",
    "Modo de preparo",
    "Estoque e custo",
    "Etiqueta",
  ]);
  expect(screen.queryByText("Marcas homologadas")).toBeNull();
  expect(screen.queryByText("Fornecedores homologados")).toBeNull();
  expect(screen.queryByLabelText("Cód. / EAN")).toBeNull();
  expect(screen.getByText("Foto da preparação")).toBeTruthy();
  expect(screen.getByText("Formato vertical 4:5 para aparecer corretamente na ficha técnica.")).toBeTruthy();
  expect(screen.getByText("4:5 vertical").closest("div[class*='aspect-[4/5]']")).toBeTruthy();
  expect(screen.getByText("Habilitar este item no módulo de etiquetas")).toBeTruthy();
  expect(screen.getAllByRole("combobox", { name: "Ingrediente" })).toHaveLength(1);
  expect(container.querySelector("form > div")?.className).toContain("space-y-5");
  expect(container.querySelector("form > div")?.className).not.toContain("grid-cols");
});

it("mostra custo médio por unidade na preparação e mantém o campo editável apenas no insumo", async () => {
  const usuario = userEvent.setup();
  const { container } = render(
    <InsumoForm categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[{ ...candidatos[0], custoUnitario: 10 }]} renderFooter={() => null} />,
  );
  expect(screen.getByLabelText("Custo médio (un)")).toBeTruthy();
  await usuario.click(screen.getByRole("button", { name: /Preparação.*Base para receitas/i }));
  expect(screen.queryByLabelText(/Custo médio/)).toBeNull();
  await usuario.click(screen.getByRole("combobox", { name: "Unidade Escopo" }));
  await usuario.click(await screen.findByRole("option", { name: /Quilograma/ }));
  const busca = screen.getByRole("combobox", { name: "Ingrediente" });
  await usuario.click(busca);
  await usuario.click(await screen.findByRole("option", { name: /Açúcar.*kg/i }));
  await usuario.type(screen.getByRole("textbox", { name: "Quantidade do ingrediente" }), "2");
  await usuario.click(screen.getByRole("button", { name: "Adicionar ingrediente" }));
  const rendimento = container.querySelector('input[name="rendimentoQuantidade"]') as HTMLInputElement;
  await usuario.type(rendimento, "4");
  expect(screen.getByText("Custo médio (kg)")).toBeTruthy();
  expect(screen.getByText(/5,00\/kg/)).toBeTruthy();
  expect(new FormData(container.querySelector("form")!).has("custoMedio")).toBe(false);
});

it("exibe custo da porção multiplicando custo unitário pela quantidade", () => {
  render(<ComposicaoPicker
    candidatos={[
      { ...candidatos[0], custoMedio: 12.5, custoUnitario: 99 },
      { ...candidatos[1], custoMedio: 100, custoUnitario: 6 },
    ]}
    itens={[
      { componenteId: "acucar", nome: "Açúcar", tipo: "INSUMO", unidade: "KG", quantidade: 2, observacaoPorcao: null },
      { componenteId: "molho", nome: "Molho preparado", tipo: "PRODUTO_INTERMEDIARIO", unidade: "L", quantidade: 1, observacaoPorcao: null },
    ]}
    onChange={() => {}}
  />);
  const lista = screen.getByRole("list", { name: "Ingredientes da receita" });
  expect(within(lista).getByText(/25,00/)).toBeTruthy();
  expect(within(lista).getByText(/6,00/)).toBeTruthy();
  expect(within(lista).queryByText(/99,00|100,00/)).toBeNull();
  expect(within(lista).queryByRole("textbox", { name: /Custo médio/ })).toBeNull();
});

it("limita a receita a 15 ingredientes", () => {
  const itens: ComponenteRow[] = Array.from({ length: 15 }, (_, indice) => ({
    componenteId: `ingrediente-${indice + 1}`,
    nome: `Ingrediente ${indice + 1}`,
    tipo: "INSUMO",
    unidade: "KG",
    quantidade: 1,
    observacaoPorcao: null,
  }));
  render(<ComposicaoPicker candidatos={candidatos} itens={itens} onChange={() => {}} />);
  expect(screen.getByText("Ingredientes: 15/15")).toBeTruthy();
  expect((screen.getByRole("combobox", { name: "Ingrediente" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Adicionar ingrediente" }) as HTMLButtonElement).disabled).toBe(true);
});

it("mantém os passos do modo de preparo numerados e reordenáveis", async () => {
  const usuario = userEvent.setup();
  const { container } = render(
    <InsumoForm categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={candidatos} podeConfigurarEtiqueta renderFooter={() => null} />,
  );
  await usuario.click(screen.getByRole("button", { name: /Preparação.*Base para receitas/i }));
  await usuario.click(screen.getByRole("button", { name: "Adicionar passo" }));
  await usuario.click(screen.getByRole("textbox", { name: "Passo 1" }));
  await usuario.paste("Misture os ingredientes");
  await usuario.click(screen.getByRole("button", { name: "Adicionar passo" }));
  expect(screen.getByRole("textbox", { name: "Passo 2" })).toHaveProperty("value", "Misture os ingredientes");
  await usuario.click(screen.getByRole("textbox", { name: "Passo 1" }));
  await usuario.paste("Leve para gelar");
  expect(new FormData(container.querySelector("form")!).get("modoPreparo")).toBe('["Leve para gelar","Misture os ingredientes"]');
  expect(screen.queryByRole("button", { name: "Mover passo 2 para cima" })).toBeNull();
  screen.getByRole("button", { name: "Arrastar Passo 2" }).focus();
  await usuario.keyboard(" {ArrowUp}{Enter}");
  expect((screen.getByRole("textbox", { name: "Passo 1" }) as HTMLTextAreaElement).value).toBe("Misture os ingredientes");
  for (let indice = 3; indice <= 10; indice += 1) await usuario.click(screen.getByRole("button", { name: "Adicionar passo" }));
  expect(screen.getAllByRole("textbox", { name: /Passo \d+/ })).toHaveLength(10);
  expect((screen.getByRole("button", { name: "Adicionar passo" }) as HTMLButtonElement).disabled).toBe(true);
});

it("mantém composição e modo de preparo para quem não configura etiquetas", async () => {
  const usuario = userEvent.setup();
  render(<InsumoForm categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={candidatos} renderFooter={() => null} />);
  await usuario.click(screen.getByRole("button", { name: /Preparação.*Base para receitas/i }));
  expect(screen.getByRole("combobox", { name: "Ingrediente" })).toBeTruthy();
  expect(screen.getByText("Modo de preparo")).toBeTruthy();
  expect(screen.queryByText("Habilitar este item no módulo de etiquetas")).toBeNull();
});

it("permite ao administrador configurar etiqueta também no cadastro de insumo", async () => {
  const usuario = userEvent.setup();
  const { container } = render(
    <InsumoForm categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={candidatos} podeConfigurarEtiqueta renderFooter={() => null} />,
  );

  expect(screen.getByText("Habilitar este item no módulo de etiquetas")).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: "É perecível" })).toBeNull();
  expect(screen.queryByLabelText("Validade padrão (dias após o recebimento)")).toBeNull();
  await usuario.click(screen.getByRole("checkbox", { name: /Habilitar este item/i }));
  expect(screen.getByLabelText(/Ambiente \(após aberto\)/)).toBeTruthy();
  expect(screen.getByLabelText(/Refrigerado \(após aberto\)/)).toBeTruthy();
  expect(screen.getByLabelText(/Congelado \(após aberto\)/)).toBeTruthy();
  expect(screen.getAllByText("(após aberto)")).toHaveLength(3);
  expect(screen.getAllByText("dias")).toHaveLength(3);
  expect(screen.queryByText("Validade padrão")).toBeNull();
  expect(new FormData(container.querySelector("form")!).get("etiquetaHabilitada")).toBe("on");
});

it.each(["INSUMO", "PRODUTO_INTERMEDIARIO"] as const)("seleciona categoria financeira detalhada no cadastro %s", async tipo => {
  render(<InsumoForm insumo={{ ...insumoStatus, tipo }} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]}
    categoriasFinanceiras={[{ id: "charcutaria", nome: "Insumos › Carnes › Charcutaria", grupo: "CMV" }, { id: "alimentacao", nome: "Benefícios › Alimentação funcionário", grupo: "DESPESAS_OPERACIONAIS" }]}
    renderFooter={() => null} />);
  const usuario = userEvent.setup();
  await usuario.click(screen.getByRole("combobox", { name: "Categoria financeira" }));
  expect(await screen.findByText("CMV — Custo da Mercadoria")).toBeTruthy();
  await usuario.click(screen.getByRole("option", { name: "Insumos › Carnes › Charcutaria" }));
  expect((document.querySelector('input[name="categoriaFinanceiraId"]') as HTMLInputElement).value).toBe("charcutaria");
});
