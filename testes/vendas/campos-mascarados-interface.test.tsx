// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentidadeCobrancaForm, type CobrancaForm } from "@/app/(protegido)/vendas/pedidos/identidade-cobranca-form";
import { CamposEnderecoPedido, enderecoPedidoVazio, type EnderecoPedidoForm } from "@/app/(protegido)/vendas/pedidos/endereco-pedido-form";
import { formatarMascaraDigitos } from "@/components/use-mascara-digitos";

vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCepPedidoAction: vi.fn() }));
const consultar = vi.fn(), alterar = vi.fn();
function Identidade({ tipo = "PF", documento = "", telefone, geral = false, somenteLeitura = false }: { tipo?: "PF" | "PJ"; documento?: string; telefone?: string; geral?: boolean; somenteLeitura?: boolean }) {
  const [valor, setValor] = useState<CobrancaForm>({ ...enderecoPedidoVazio(), tipo, documento, telefone });
  return <><IdentidadeCobrancaForm valor={valor} alterar={novo => { setValor(novo); alterar(novo); }} consultarCnpj={consultar} aoConsultar={() => {}} informacoesGerais={geral} somenteLeitura={somenteLeitura} /><output aria-label="Documento salvo">{valor.documento}</output></>;
}
function Endereco({ inicial = enderecoPedidoVazio(), somenteLeitura = false }: { inicial?: EnderecoPedidoForm; somenteLeitura?: boolean }) {
  const [valor, setValor] = useState(inicial);
  return <><CamposEnderecoPedido valor={valor} alterar={novo => { setValor(novo); alterar(novo); }} consultarCep={consultar} somenteLeitura={somenteLeitura} /><output aria-label="CEP salvo">{valor.cep}</output></>;
}
const documento = (nome = "CPF") => screen.getByLabelText(nome) as HTMLInputElement;
beforeEach(() => { alterar.mockReset(); consultar.mockReset().mockResolvedValue({ erro: "Consulta sintética indisponível" }); });
afterEach(cleanup);

describe("máscaras progressivas com valor cadastral em dígitos", () => {
  it("formata CPF, CNPJ e CEP por tipo sem esconder dígitos excedentes legados", () => {
    expect(formatarMascaraDigitos("1234", "CPF")).toBe("123.4");
    expect(formatarMascaraDigitos("123", "CNPJ")).toBe("12.3");
    expect(formatarMascaraDigitos("11222333000181", "CNPJ")).toBe("11.222.333/0001-81");
    expect(formatarMascaraDigitos("01001000", "CEP")).toBe("01001-000");
    expect(formatarMascaraDigitos("123456789012", "CPF")).toBe("123.456.789-012");
  });
  it("digita CPF com máscara progressiva e mantém somente dígitos no estado", async () => {
    render(<Identidade />);
    const usuario = userEvent.setup(), campo = documento();
    await usuario.type(campo, "1234");
    expect(campo.value).toBe("123.4");
    await usuario.type(campo, "5678909");
    expect(campo.value).toBe("123.456.789-09");
    expect(screen.getByLabelText("Documento salvo").textContent).toBe("12345678909");
    expect(campo.checkValidity()).toBe(true);
    expect(consultar).not.toHaveBeenCalled();
  });
  it("digita CNPJ com a máscara própria desde o terceiro dígito e consulta apenas o documento completo", async () => {
    render(<Identidade tipo="PJ" geral />);
    const usuario = userEvent.setup(), campo = documento("CNPJ");
    await usuario.type(campo, "112");
    expect(campo.value).toBe("11.2");
    expect(consultar).not.toHaveBeenCalled();
    await usuario.type(campo, "22333000181");
    await waitFor(() => expect(consultar).toHaveBeenCalledWith("11222333000181"));
    expect(campo.value).toBe("11.222.333/0001-81");
    expect(campo.maxLength).toBe(18);
    expect(campo.checkValidity()).toBe(true);
    expect(screen.getByLabelText("Documento salvo").textContent).toBe("11222333000181");
  });
  it("cola CNPJ formatado com espaços externos sem truncar antes de retirar a máscara", async () => {
    render(<Identidade tipo="PJ" />);
    const usuario = userEvent.setup(), campo = documento("CNPJ");
    await usuario.click(campo); await usuario.paste("  11.222.333/0001-81  ");
    expect(campo.value).toBe("11.222.333/0001-81");
    expect(campo.selectionStart).toBe(18);
    expect(consultar).toHaveBeenCalledTimes(1);
    expect(consultar).toHaveBeenCalledWith("11222333000181");
  });
  it("cola CPF formatado e troca só os dígitos selecionados no meio sem mover o cursor para o fim", async () => {
    render(<Identidade />);
    const usuario = userEvent.setup(), campo = documento();
    await usuario.click(campo); await usuario.paste("123.456.789-09");
    campo.setSelectionRange(4, 7);
    await usuario.paste("987");
    expect(campo.value).toBe("123.987.789-09");
    expect(campo.selectionStart).toBe(7); expect(campo.selectionEnd).toBe(7);
    expect(alterar.mock.lastCall?.[0].documento).toBe("12398778909");
  });
  it("rejeita letras e excesso de dígitos sem aproveitar parte da colagem nem perder a seleção", async () => {
    render(<Identidade documento="12345678909" />);
    const usuario = userEvent.setup(), campo = documento();
    await usuario.click(campo); campo.setSelectionRange(0, campo.value.length);
    await usuario.paste("CPF 987.654.321-00");
    expect(campo.value).toBe("123.456.789-09");
    expect(campo.selectionStart).toBe(0); expect(campo.selectionEnd).toBe(14);
    await usuario.paste("123456789012");
    expect(campo.value).toBe("123.456.789-09");
    await usuario.keyboard("abc");
    expect(campo.value).toBe("123.456.789-09");
    expect(alterar).not.toHaveBeenCalled();
  });
  it.each([ ["Backspace", 4, "124.567.890", "124567890", 2], ["Delete", 3, "123.567.890", "123567890", 3] ] as const)("%s sobre separador remove o dígito correspondente e conserva a posição lógica", async (tecla, posicao, visual, salvo, cursor) => {
    render(<Identidade documento="1234567890" />);
    const usuario = userEvent.setup(), campo = documento();
    await usuario.click(campo); campo.setSelectionRange(posicao, posicao);
    await usuario.keyboard(`{${tecla}}`);
    expect(campo.value).toBe(visual); expect(campo.selectionStart).toBe(cursor);
    expect(alterar.mock.lastCall?.[0].documento).toBe(salvo);
  });
  it("cola CEP com máscara e consulta o serviço somente com oito dígitos", async () => {
    consultar.mockResolvedValue({ endereco: { logradouro: "Rua Sintética", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
    render(<Endereco />);
    const usuario = userEvent.setup(), campo = documento("CEP");
    await usuario.click(campo); await usuario.paste(" 01.001-000 ");
    expect(campo.value).toBe("01001-000");
    expect(screen.getByLabelText("CEP salvo").textContent).toBe("01001000");
    fireEvent.blur(campo);
    await waitFor(() => expect(consultar).toHaveBeenCalledWith("01001000"));
    expect(documento("Logradouro").value).toBe("Rua Sintética");
    expect(alterar.mock.lastCall?.[0].cep).toBe("01001000");
  });
  it("não altera o endereço ao apenas redigitar a pontuação do CEP", async () => {
    const inicial = { ...enderecoPedidoVazio(), cep: "01001000", logradouro: "Rua preservada", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
    render(<Endereco inicial={inicial} />);
    const usuario = userEvent.setup(), campo = documento("CEP");
    await usuario.click(campo); campo.setSelectionRange(5, 6);
    await usuario.paste("-");
    expect(campo.value).toBe("01001-000");
    expect(documento("Logradouro").value).toBe("Rua preservada");
    expect(alterar).not.toHaveBeenCalled();
  });
  it("permite substituir parte do CEP e apagar seu separador sem saltar para o fim", async () => {
    render(<Endereco inicial={{ ...enderecoPedidoVazio(), cep: "01001000" }} />);
    const usuario = userEvent.setup(), campo = documento("CEP");
    await usuario.click(campo); campo.setSelectionRange(6, 9);
    await usuario.paste("234");
    expect(campo.value).toBe("01001-234"); expect(campo.selectionStart).toBe(9);
    expect(alterar.mock.lastCall?.[0].cep).toBe("01001234");
    campo.setSelectionRange(6, 6); await usuario.keyboard("{Backspace}");
    expect(campo.value).toBe("01002-34"); expect(campo.selectionStart).toBe(4);
    expect(alterar.mock.lastCall?.[0].cep).toBe("0100234");
  });
  it("preserva a posição em exclusão móvel que informa inputType sem evento de teclado", async () => {
    render(<Identidade documento="1234567890" />);
    const campo = documento();
    await userEvent.click(campo);
    fireEvent.input(campo, { target: { value: "123456.789-0", selectionStart: 3, selectionEnd: 3 }, inputType: "deleteContentBackward" });
    expect(campo.value).toBe("124.567.890"); expect(campo.selectionStart).toBe(2);
    expect(alterar.mock.lastCall?.[0].documento).toBe("124567890");
  });
  it("preserva edição e consulta estrangeiras sem aplicar máscara numérica brasileira", async () => {
    render(<Endereco inicial={{ ...enderecoPedidoVazio(), pais: "Portugal" }} />);
    await userEvent.type(documento("Código postal"), "AB12-345");
    expect(documento("Código postal").value).toBe("AB12-345");
    expect(alterar.mock.lastCall?.[0].cep).toBe("AB12-345");
    fireEvent.blur(documento("Código postal"));
    expect(consultar).not.toHaveBeenCalled();
  });
  it("máscaras somente leitura permitem copiar e recusam colagem sem emitir alteração", async () => {
    render(<Identidade tipo="PJ" documento="11222333000181" telefone="+5511999991111" somenteLeitura />);
    const campo = documento("CNPJ");
    expect(campo.value).toBe("11.222.333/0001-81"); expect(campo.readOnly).toBe(true);
    fireEvent.paste(campo, { clipboardData: { getData: () => "11444777000161" } });
    expect(campo.value).toBe("11.222.333/0001-81");
    expect(documento("Telefone da cobrança").readOnly).toBe(true);
    expect(alterar).not.toHaveBeenCalled(); expect(consultar).not.toHaveBeenCalled();
  });
  it("telefone da cobrança é opcional, independente e normalizado, e não se repete nas informações gerais", async () => {
    const { unmount } = render(<Identidade />);
    const campo = documento("Telefone da cobrança");
    expect(campo.value).toBe(""); expect(campo.required).toBe(false);
    await userEvent.type(campo, "11999991111");
    expect(campo.value).toBe("+55 (11) 99999-1111");
    expect(alterar.mock.lastCall?.[0].telefone).toBe("+5511999991111");
    unmount(); render(<Identidade geral telefone="+5511999991111" />);
    expect(screen.queryByLabelText("Telefone da cobrança")).toBeNull();
  });
});
