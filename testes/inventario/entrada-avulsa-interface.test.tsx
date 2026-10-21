// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EntradaAvulsaForm } from "@/app/(protegido)/inventario/entrada-avulsa/entrada-avulsa-form";
vi.mock("server-only", () => ({}));

vi.mock("@/app/(protegido)/inventario/entrada-avulsa/actions", () => ({
  registrarEntradaAvulsaAction: vi.fn(async () => ({ ok: true, movimentacaoId: "movimento", entradaAvulsaCompraId: "compra" })),
}));

afterEach(cleanup);

it("apresenta a compra sem nota com fornecedor, vários itens e custos adicionais", async () => {
  const usuario = userEvent.setup();
  render(<EntradaAvulsaForm
    insumos={[
      { id: "queijo", nome: "Queijo", especificacao: "Maturado por 12 meses", unidade: "KG", custoMedio: 10 },
      { id: "presunto", nome: "Presunto", unidade: "KG", custoMedio: 12 },
    ]}
    locais={[{ id: "cozinha", nome: "Cozinha" }]}
    fornecedores={[{ id: "fornecedor", nome: "FORNECEDOR TESTE" }]}
    contasBancarias={[{ id: "itau", nome: "ITAÚ" }]}
    insumoIdPreselecionado={null}
  />);

  expect(screen.getByRole("heading", { name: "Entrada de insumo" })).toBeDefined();
  expect(screen.queryByLabelText("Histórico de entradas avulsas")).toBeNull();
  expect(screen.getByRole("button", { name: "Completa" })).toBeDefined();
  expect(screen.getByRole("button", { name: "Registrar" })).toBeDefined();
  expect(screen.getByLabelText("Fornecedor da compra")).toBeDefined();
  expect(screen.getByText("Composição do custo")).toBeDefined();
  expect(screen.getByText("Será criada uma única despesa para o fornecedor com o total completo da compra.")).toBeDefined();
  expect(screen.getByText("Valor *")).toBeDefined();
  expect(screen.queryByText("Unidade de entrada")).toBeNull();
  expect(screen.getByText("Qtd *")).toBeDefined();
  const adicionar = screen.getByRole("button", { name: "Adicionar item" });
  const primeiraLinha = document.querySelector("[data-item-entrada]")!;
  expect(primeiraLinha.nextElementSibling?.contains(adicionar)).toBe(true);
  expect(adicionar.closest(".sticky")).toBeNull();
  expect(screen.queryByText("Produtos (R$) *")).toBeNull();
  expect(screen.getByText("Fornecedor e entrada")).toBeDefined();
  expect(screen.getByRole("checkbox", { name: "Já está pago" })).toBeDefined();

  await usuario.click(screen.getByPlaceholderText("Buscar insumo..."));
  await usuario.click(await screen.findByRole("option", { name: "Queijo" }));
  await usuario.tab();
  expect(screen.getByPlaceholderText("Buscar insumo...")).toHaveProperty("value", "Queijo");
  expect(screen.queryByText("Maturado por 12 meses")).toBeNull();
  const campoQuantidade = screen.getByLabelText("Quantidade do item 1") as HTMLInputElement;
  expect(within(campoQuantidade.parentElement!).getByText("kg")).toBeDefined();
  expect(screen.getByLabelText("Fator de conversão do item 1")).toBeDefined();
  expect(screen.getByLabelText("Forma de pagamento da compra")).toBeDefined();

  await usuario.click(screen.getByRole("button", { name: "Adicionar item" }));
  expect(screen.getAllByPlaceholderText("Buscar insumo...")).toHaveLength(2);
  expect(screen.getAllByPlaceholderText("Buscar insumo...")[0]).toBe(document.activeElement);
  expect(screen.getAllByPlaceholderText("Buscar insumo...")[1]).toHaveProperty("value", "Queijo");
  expect(screen.getByLabelText("Quantidade do item 2")).toBe(campoQuantidade);
  const linhas = document.querySelectorAll("[data-item-entrada]");
  expect(linhas[0].nextElementSibling?.contains(screen.getByRole("button", { name: "Adicionar item" }))).toBe(true);
  expect(linhas[1].previousElementSibling?.contains(screen.getByRole("button", { name: "Adicionar item" }))).toBe(true);
  await usuario.type(campoQuantidade, "2,5");
  await usuario.click(screen.getByRole("button", { name: "Adicionar item" }));
  expect(screen.getAllByPlaceholderText("Buscar insumo...")[0]).toBe(document.activeElement);
  expect(screen.getByLabelText("Quantidade do item 3")).toHaveProperty("value", "2,5");

  await usuario.click(screen.getByRole("button", { name: "Adicionar custo" }));
  expect(screen.getByLabelText("Descrição do custo adicional 1")).toBeDefined();
  expect(screen.getByLabelText("Valor do custo adicional 1")).toBeDefined();

  const campoFrete = screen.getByLabelText("Frete da compra") as HTMLInputElement;
  expect(within(campoFrete.parentElement!).getByText("R$")).toBeDefined();
  await usuario.type(campoFrete, "1000");
  expect(campoFrete.value).toBe("10,00");

  await usuario.click(screen.getByRole("button", { name: "Simples" }));
  expect(screen.getByText("Itens recebidos")).toBeDefined();
  expect(screen.getAllByPlaceholderText("Buscar insumo...")).toHaveLength(3);
});
