// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { EntradaAvulsaForm } from "@/app/(protegido)/inventario/entrada-avulsa/entrada-avulsa-form";
import { registrarEntradaAvulsaAction } from "@/app/(protegido)/inventario/entrada-avulsa/actions";
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
  expect(screen.getByText("O total da compra será distribuído entre as parcelas do fornecedor.")).toBeDefined();
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

async function escolherPagamento(rotulo: string, nome = "Forma de pagamento da compra") {
  const seletor = screen.getByRole("combobox", { name: nome });
  seletor.focus();
  fireEvent.keyDown(seletor, { key: "ArrowDown" });
  const opcao = await screen.findByRole("option", { name: rotulo });
  fireEvent.pointerDown(opcao, { pointerType: "mouse" });
  fireEvent.click(opcao);
}

function entradaPreenchida() {
  render(<EntradaAvulsaForm
    insumos={[{ id: "queijo", nome: "Queijo", unidade: "KG", custoMedio: 10 }]}
    locais={[{ id: "cozinha", nome: "Cozinha" }]}
    fornecedores={[{ id: "fornecedor", nome: "FORNECEDOR TESTE" }]}
    contasBancarias={[{ id: "banco", nome: "Banco teste" }]}
    cartoes={[{ id: "cartao", nome: "Visa teste", contaBancariaId: "banco", contaBancariaNome: "Banco teste", diaFechamento: 10, diaVencimento: 20, ativo: true }]}
    insumoIdPreselecionado="queijo"
  />);
  fireEvent.change(screen.getByLabelText("Quantidade do item 1"), { target: { value: "1" } });
  fireEvent.change(screen.getByLabelText("Valor do item 1"), { target: { value: "10001" } });
  fireEvent.change(screen.getByLabelText("Data de entrada *"), { target: { value: "2026-01-31" } });
}

it.each(["Boleto", "Pix"])("registra %s em parcelas mensais com soma exata", async rotulo => {
  entradaPreenchida();
  await escolherPagamento(rotulo);
  fireEvent.change(screen.getByLabelText("Quantidade de parcelas"), { target: { value: "3" } });
  expect(screen.getByLabelText("Valor da parcela 1")).toHaveProperty("value", "33,34");
  expect(screen.getByLabelText("Valor da parcela 3")).toHaveProperty("value", "33,33");
  expect(screen.getByLabelText("Vencimento da parcela 2")).toHaveProperty("value", "2026-02-28");
  expect(screen.getByLabelText("Vencimento da parcela 3")).toHaveProperty("value", "2026-03-31");
  fireEvent.change(screen.getByLabelText("Vencimento da parcela 2"), { target: { value: "2026-03-05" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await waitFor(() => expect(registrarEntradaAvulsaAction).toHaveBeenCalledOnce());
  expect(registrarEntradaAvulsaAction).toHaveBeenCalledWith(expect.objectContaining({
    pagamento: expect.objectContaining({ formaPagamento: rotulo === "Pix" ? "PIX" : "BOLETO", parcelas: [
      { valor: 33.34, dataVencimento: "2026-01-31" },
      { valor: 33.34, dataVencimento: "2026-03-05" },
      { valor: 33.33, dataVencimento: "2026-03-31" },
    ] }),
  }));
  await waitFor(() => expect(screen.getByLabelText("Quantidade de parcelas")).toHaveProperty("value", "1"));
  expect(screen.getByLabelText("Vencimento da parcela 1")).toHaveProperty("value", "2026-01-31");
});

it("parcela no cartão, calcula cada fatura e impede pagamento direto", async () => {
  entradaPreenchida();
  fireEvent.click(screen.getByRole("checkbox", { name: "Já está pago" }));
  await escolherPagamento("Cartão de crédito");
  expect(screen.getByRole("checkbox", { name: "Já está pago" }).getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByRole("checkbox", { name: "Já está pago" }).getAttribute("aria-checked")).toBe("false");
  await escolherPagamento("Visa teste · Banco teste", "Cartão da compra");
  fireEvent.change(screen.getByLabelText("Data da compra"), { target: { value: "2026-09-10" } });
  fireEvent.change(screen.getByLabelText("Quantidade de parcelas"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Parcela inicial do cartão"), { target: { value: "2" } });
  expect(screen.getByLabelText("Vencimento da parcela 1")).toHaveProperty("value", "2026-11-20");
  expect(screen.getByLabelText("Vencimento da parcela 2")).toHaveProperty("value", "2026-12-20");
  expect(screen.getByLabelText("Vencimento da parcela 1")).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await waitFor(() => expect(registrarEntradaAvulsaAction).toHaveBeenCalledOnce());
  expect(registrarEntradaAvulsaAction).toHaveBeenCalledWith(expect.objectContaining({ pago: false, pagamento: expect.objectContaining({ formaPagamento: "CARTAO", cartaoCreditoId: "cartao", parcelaCartao: 2, parcelas: [{ valor: 50.01, dataVencimento: "2026-11-20" }, { valor: 50, dataVencimento: "2026-12-20" }] }) }));
});

it("bloqueia quantidade inválida e total divergente sem enviar a entrada", () => {
  entradaPreenchida();
  fireEvent.change(screen.getByLabelText("Quantidade de parcelas"), { target: { value: "37" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  expect(screen.getByText("Informe de 1 a 36 parcelas.")).toBeDefined();
  expect(registrarEntradaAvulsaAction).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Quantidade de parcelas"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Valor da parcela 1"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  expect(screen.getByText("A soma das parcelas deve ser igual ao total da compra.")).toBeDefined();
  expect(registrarEntradaAvulsaAction).not.toHaveBeenCalled();
});
