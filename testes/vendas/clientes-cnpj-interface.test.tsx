// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IdentidadeCobrancaForm, type CobrancaForm } from "@/app/(protegido)/vendas/pedidos/identidade-cobranca-form";
import { CamposEnderecoPedido, enderecoPedidoVazio } from "@/app/(protegido)/vendas/pedidos/endereco-pedido-form";
import type { consultarCnpjVenda } from "@/lib/vendas/cnpj";

vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCepPedidoAction: vi.fn() }));
afterEach(cleanup);

const cadastro = { razaoSocial: "Empresa Sintética Ltda", endereco: { pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "42", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" } };
const inicial = (): CobrancaForm => ({ ...enderecoPedidoVazio(), tipo: "PJ", documento: "", razaoSocial: "", numero: "1" });
function Formulario({ consultar, geral = false, valorInicial = inicial(), aoConsultar = vi.fn(), somenteLeitura = false }: { consultar: typeof consultarCnpjVenda; geral?: boolean; valorInicial?: CobrancaForm; aoConsultar?: (ocupado: boolean) => void; somenteLeitura?: boolean }) {
  const [valor, alterar] = useState(valorInicial);
  return <><IdentidadeCobrancaForm obrigatorio informacoesGerais={geral} valor={valor} alterar={alterar} consultarCnpj={consultar} aoConsultar={aoConsultar} somenteLeitura={somenteLeitura} /><CamposEnderecoPedido obrigatorio valor={valor} alterar={alterar} buscarCep={false} /><button type="button" onClick={() => alterar({ ...inicial(), tipo: "PF", documento: "12345678901" })}>Trocar titular</button></>;
}

it.each([true, false])("colagem de CNPJ formatado consulta e preenche razão social/endereço (gerais=%s)", async geral => {
  const consultar = vi.fn<typeof consultarCnpjVenda>().mockResolvedValue({ cadastro });
  const usuario = userEvent.setup();
  render(<Formulario consultar={consultar} geral={geral} />);
  await usuario.click(screen.getByLabelText("CNPJ *"));
  await usuario.paste("11.222.333/0001-81");
  await waitFor(() => expect(consultar).toHaveBeenCalledExactlyOnceWith("11222333000181"));
  await waitFor(() => expect(screen.getByLabelText("Razão social *")).toHaveProperty("value", cadastro.razaoSocial));
  expect(screen.getByLabelText("CNPJ *")).toHaveProperty("value", "11.222.333/0001-81");
  for (const [nome, esperado] of [["CEP *", "01001-000"], ["Logradouro *", "Rua Sintética"], ["Número *", "42"], ["Complemento (opcional)", "Sala 2"], ["Bairro *", "Centro"], ["Cidade *", "São Paulo"], ["Estado / UF *", "SP"]]) {
    expect(screen.getByLabelText(nome)).toHaveProperty("value", esperado);
  }
});

it("colagem substitui a seleção sem truncar o documento nem aceitar letras ou excesso", async () => {
  const consultar = vi.fn<typeof consultarCnpjVenda>().mockResolvedValue({ cadastro });
  const usuario = userEvent.setup();
  render(<Formulario consultar={consultar} valorInicial={{ ...inicial(), documento: "11222999000181" }} />);
  const campo = screen.getByLabelText("CNPJ *") as HTMLInputElement;
  await usuario.click(campo);
  campo.setSelectionRange(7, 10);
  await usuario.paste("333");
  await waitFor(() => expect(consultar).toHaveBeenCalledExactlyOnceWith("11222333000181"));
  await waitFor(() => expect(campo.readOnly).toBe(false));
  campo.setSelectionRange(0, campo.value.length);
  await usuario.paste("CNPJ 11.222.333/0001-81");
  expect(campo.value).toBe("11.222.333/0001-81");
  campo.setSelectionRange(0, campo.value.length);
  await usuario.paste("112223330001819");
  expect(campo.value).toBe("11.222.333/0001-81");
  expect(consultar).toHaveBeenCalledTimes(1);
});

it("descarta o resultado e o aviso pendente quando o titular muda durante a consulta", async () => {
  let responder!: (resposta: Awaited<ReturnType<typeof consultarCnpjVenda>>) => void;
  const consultar = vi.fn<typeof consultarCnpjVenda>().mockImplementation(() => new Promise(resolve => { responder = resolve; }));
  const aoConsultar = vi.fn();
  render(<Formulario consultar={consultar} geral aoConsultar={aoConsultar} />);
  fireEvent.change(screen.getByLabelText("CNPJ *"), { target: { value: "11222333000181" } });
  expect(screen.getByRole("status").textContent).toContain("Consultando CNPJ");
  fireEvent.click(screen.getByRole("button", { name: "Trocar titular" }));
  responder({ cadastro });
  await waitFor(() => expect(aoConsultar).toHaveBeenLastCalledWith(false));
  expect(screen.getByLabelText("CPF")).toHaveProperty("value", "123.456.789-01");
  expect(screen.getByLabelText("Número *")).toHaveProperty("value", "1");
  expect(screen.queryByText(/Consultando CNPJ/)).toBeNull();
  expect(screen.queryByText(/Dados preenchidos pelo CNPJ/)).toBeNull();
});

it("a Principal em somente leitura não consulta ao receber foco ou colagem", async () => {
  const consultar = vi.fn<typeof consultarCnpjVenda>();
  const usuario = userEvent.setup();
  render(<Formulario consultar={consultar} somenteLeitura valorInicial={{ ...inicial(), documento: "11222333000181" }} />);
  const campo = screen.getByLabelText("CNPJ *");
  await usuario.click(campo);
  await usuario.paste("11.222.333/0001-81");
  await usuario.tab();
  expect(consultar).not.toHaveBeenCalled();
  expect(campo).toHaveProperty("value", "11.222.333/0001-81");
});

it("retorno parcial preenche razão social, limpa endereço antigo ausente e orienta completar o cadastro", async () => {
  const aviso = "CNPJ consultado. O endereço está incompleto na fonte. Confira o CEP e complete os dados de cobrança.";
  const consultar = vi.fn<typeof consultarCnpjVenda>().mockResolvedValue({ cadastro: { razaoSocial: cadastro.razaoSocial, endereco: enderecoPedidoVazio() }, aviso });
  render(<Formulario consultar={consultar} geral valorInicial={{ ...inicial(), logradouro: "Rua Anterior", cidade: "Cidade Anterior", uf: "RJ", codigoMunicipio: "3304557" }} />);
  fireEvent.change(screen.getByLabelText("CNPJ *"), { target: { value: "11222333000181" } });
  await waitFor(() => expect(screen.getByLabelText("Razão social *")).toHaveProperty("value", cadastro.razaoSocial));
  expect(screen.getByRole("status").textContent).toBe(aviso);
  expect(screen.getByLabelText("Logradouro *")).toHaveProperty("value", "");
  expect(screen.getByLabelText("Cidade *")).toHaveProperty("value", "");
  expect(screen.getByLabelText("Número *")).toHaveProperty("value", "");
});

it("falha permite nova consulta e não duplica o resultado ao sair do campo", async () => {
  const consultar = vi.fn<typeof consultarCnpjVenda>().mockResolvedValueOnce({ erro: "Consulta do CNPJ indisponível. Tente novamente." }).mockResolvedValueOnce({ cadastro });
  const usuario = userEvent.setup();
  render(<Formulario consultar={consultar} geral />);
  fireEvent.change(screen.getByLabelText("CNPJ *"), { target: { value: "11222333000181" } });
  const repetir = await screen.findByRole("button", { name: "Consultar CNPJ novamente" });
  await usuario.click(repetir);
  await waitFor(() => expect(screen.getByLabelText("Razão social *")).toHaveProperty("value", cadastro.razaoSocial));
  fireEvent.blur(screen.getByLabelText("CNPJ *"));
  expect(consultar).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("button", { name: "Consultar CNPJ novamente" })).toBeNull();
});

it("CPF também aceita colagem formatada sem disparar consulta empresarial", async () => {
  const consultar = vi.fn<typeof consultarCnpjVenda>(), usuario = userEvent.setup();
  render(<Formulario consultar={consultar} geral valorInicial={{ ...inicial(), tipo: "PF" }} />);
  await usuario.click(screen.getByLabelText("CPF"));
  await usuario.paste("123.456.789-01");
  expect(screen.getByLabelText("CPF")).toHaveProperty("value", "123.456.789-01");
  expect(consultar).not.toHaveBeenCalled();
});
