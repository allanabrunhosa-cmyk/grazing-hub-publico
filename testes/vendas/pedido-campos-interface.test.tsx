// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelecaoCanalVenda } from "@/components/canais-venda";
import { PagamentoPedidoForm } from "@/app/(protegido)/vendas/pedidos/pagamento-pedido-form";
import { PrecoItemPedido } from "@/app/(protegido)/vendas/pedidos/preco-item-pedido";
afterEach(cleanup);
const formas = [{ id: "boleto", nome: "Boleto cadastrado", tipo: "BOLETO", permiteParcelamento: true, maximoParcelas: 2 }, { id: "credito", nome: "Crédito cadastrado", tipo: "CARTAO_CREDITO", permiteParcelamento: true, maximoParcelas: 6 }];
describe("campos comerciais compactos", () => {
  it("canais selecionam pelo ID e usam as cores registradas, abreviando somente GF", () => {
    const alterar = vi.fn();
    const canais = [{ id: "site", nome: "SITE" }, { id: "ifood", nome: "iFood" }, { id: "gf", nome: "Giuliana Flores" }];
    const { rerender } = render(<SelecaoCanalVenda canais={canais} valor="site" alterar={alterar} />);
    expect(screen.getByRole("button", { name: "SITE" }).style.backgroundColor).toBe("var(--ds-canal-site)");
    fireEvent.click(screen.getByRole("button", { name: "GF" })); expect(alterar).toHaveBeenCalledWith("gf");
    rerender(<SelecaoCanalVenda canais={canais} valor="gf" alterar={alterar} />);
    expect(screen.getByRole("button", { name: "GF" }).style.backgroundColor).toBe("var(--ds-canal-gf)");
    expect(screen.getByRole("button", { name: "iFood" }).getAttribute("aria-pressed")).toBe("false");
  });
  it("preço fica somente leitura e a tag habilita a exceção autorizada, sem salvar por blur", () => {
    const alterar = vi.fn();
    const { rerender } = render(<PrecoItemPedido indice={1} base="100.00" manual={null} editar alterar={alterar} />);
    expect((screen.getByRole("textbox", { name: "Preço 1" }) as HTMLInputElement).readOnly).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Desconto do produto 1" })); expect(alterar).toHaveBeenCalledWith("100.00");
    rerender(<PrecoItemPedido indice={1} base="100.00" manual="80.00" editar alterar={alterar} />);
    expect((screen.getByRole("textbox", { name: "Preço 1" }) as HTMLInputElement).readOnly).toBe(false);
    expect(screen.getByLabelText("Preço original 1")).toBeTruthy();
    alterar.mockClear(); fireEvent.blur(screen.getByRole("textbox", { name: "Preço 1" })); expect(alterar).not.toHaveBeenCalled();
    rerender(<PrecoItemPedido indice={1} base="100.00" manual="80.00" editar={false} alterar={alterar} />);
    expect((screen.getByRole("button", { name: "Desconto do produto 1" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("formas vêm do cadastro, boleto tem vencimentos individuais e cartão permite até 4x", async () => {
    const alterar = vi.fn(), usuario = userEvent.setup();
    const { rerender } = render(<PagamentoPedidoForm formas={formas} valor={null} tipoHistorico={null} alterar={alterar} />);
    await usuario.click(screen.getByRole("combobox", { name: "Forma de pagamento" }));
    await usuario.click(await screen.findByRole("option", { name: "Boleto cadastrado" }));
    expect(alterar).toHaveBeenCalledWith({ formaId: "boleto", parcelas: 1, vencimentos: [""] }, "BOLETO");
    const valor = { formaId: "boleto", parcelas: 2, vencimentos: ["2026-11-03", "2026-12-09"] };
    rerender(<PagamentoPedidoForm formas={formas} valor={valor} tipoHistorico="BOLETO" alterar={alterar} />);
    expect((screen.getByLabelText("Venc. parcela 1") as HTMLInputElement).value).toBe("2026-11-03");
    fireEvent.change(screen.getByLabelText("Venc. parcela 2"), { target: { value: "2026-12-10" } });
    expect(alterar).toHaveBeenLastCalledWith({ ...valor, vencimentos: ["2026-11-03", "2026-12-10"] }, "BOLETO");
    rerender(<PagamentoPedidoForm formas={formas} valor={{ formaId: "credito", parcelas: 1, vencimentos: [] }} tipoHistorico="CARTAO_CREDITO" alterar={alterar} />);
    await usuario.click(screen.getByRole("combobox", { name: "Parcelas" }));
    expect(await screen.findByRole("option", { name: "4x" })).toBeTruthy(); expect(screen.queryByRole("option", { name: "5x" })).toBeNull();
  });
});
