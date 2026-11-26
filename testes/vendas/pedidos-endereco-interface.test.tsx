// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CamposEnderecoPedido, enderecoPedidoVazio, type EnderecoPedidoForm } from "@/app/(protegido)/vendas/pedidos/endereco-pedido-form";
import userEvent from "@testing-library/user-event";

const consultar = vi.fn(async (cep: string): Promise<{ endereco: Partial<EnderecoPedidoForm> }> => ({ endereco: { cep, logradouro: "Rua Fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" } }));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: vi.fn(), buscarCepPedidoAction: (cep: string) => consultar(cep) }));
afterEach(() => { cleanup(); consultar.mockClear(); });

function Formulario() {
  const [endereco, setEndereco] = useState(enderecoPedidoVazio);
  return <><CamposEnderecoPedido valor={endereco} alterar={setEndereco} obrigatorio /><output aria-label="IBGE preservado no rascunho">{endereco.codigoMunicipio ?? "Ausente"}</output></>;
}

it("formata CEP e completa endereço fictício sem substituir número manual", async () => {
  render(<Formulario />);
  fireEvent.change(screen.getByRole("textbox", { name: "CEP *" }), { target: { value: "01001000" } });
  expect((screen.getByRole("textbox", { name: "CEP *" }) as HTMLInputElement).value).toBe("01001-000");
  fireEvent.change(screen.getByRole("textbox", { name: "Número *" }), { target: { value: "10" } });
  fireEvent.blur(screen.getByRole("textbox", { name: "CEP *" }));
  await waitFor(() => expect((screen.getByRole("textbox", { name: "Logradouro *" }) as HTMLInputElement).value).toBe("Rua Fictícia"));
  expect((screen.getByRole("textbox", { name: "Número *" }) as HTMLInputElement).value).toBe("10");
  expect(consultar).toHaveBeenCalledWith("01001000");
  expect(screen.getByLabelText("IBGE preservado no rascunho").textContent).toBe("3550308");
});

it("trocar CEP elimina o IBGE anterior e abrir um endereço antigo não consulta API", async () => {
  const alterar = vi.fn(); render(<CamposEnderecoPedido obrigatorio valor={{ ...enderecoPedidoVazio(), cep: "01001000", uf: "SP", codigoMunicipio: "3550308" }} alterar={alterar} />);
  expect(consultar).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("CEP *"), { target: { value: "02002000" } });
  expect(alterar).toHaveBeenCalledWith(expect.objectContaining({ codigoMunicipio: undefined, cidade: "", uf: "" }));
});

it("protege os quatro campos brasileiros e mantém número e complemento editáveis", () => {
  render(<Formulario />);
  for (const nome of ["Logradouro *", "Bairro *", "Cidade *", "Estado / UF *"]) {
    const campo = screen.getByLabelText(nome) as HTMLInputElement;
    expect(campo.readOnly).toBe(true);
    fireEvent.change(campo, { target: { value: "Alteração indevida" } });
    expect(campo.value).toBe("");
  }
  for (const nome of ["Número *", "Complemento (opcional)"]) expect((screen.getByLabelText(nome) as HTMLInputElement).readOnly).toBe(false);
});

it("complemento é opcional mesmo quando o endereço é obrigatório", () => {
  render(<Formulario />);
  expect((screen.getByLabelText("Complemento (opcional)") as HTMLInputElement).required).toBe(false);
  expect((screen.getByLabelText("Número *") as HTMLInputElement).required).toBe(true);
});

it("mantém endereço estrangeiro manual e obrigatório sem consultar CEP brasileiro", async () => {
  const usuario = userEvent.setup(); render(<Formulario />);
  await usuario.click(screen.getByRole("combobox", { name: "País" }));
  await usuario.clear(screen.getByRole("combobox", { name: "País" }));
  await usuario.type(screen.getByRole("combobox", { name: "País" }), "Portugal");
  await usuario.click(await screen.findByRole("option", { name: "Portugal" }));
  for (const nome of ["Código postal *", "Logradouro *", "Bairro *", "Cidade *", "Estado / região *"]) {
    const campo = screen.getByLabelText(nome) as HTMLInputElement;
    expect(campo.readOnly).toBe(false); expect(campo.required).toBe(true);
    fireEvent.change(campo, { target: { value: "Endereço fictício" } });
    expect(campo.value).toBe("Endereço fictício");
  }
  fireEvent.blur(screen.getByLabelText("Código postal *")); expect(consultar).not.toHaveBeenCalled();
});

it("ignora consulta antiga depois de trocar CEP e preserva número digitado durante a nova consulta", async () => {
  let concluir!: (r: { endereco: { cep: string; logradouro: string; bairro: string; cidade: string; uf: string } }) => void;
  consultar.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  render(<Formulario />);
  const cep = screen.getByLabelText("CEP *");
  fireEvent.change(cep, { target: { value: "01001000" } }); fireEvent.blur(cep);
  fireEvent.change(cep, { target: { value: "02002000" } });
  concluir({ endereco: { cep: "01001-000", logradouro: "Rua antiga", bairro: "Antigo", cidade: "São Paulo", uf: "SP" } });
  await waitFor(() => expect(screen.queryByText("Consultando CEP…")).toBeNull());
  expect((screen.getByLabelText("Logradouro *") as HTMLInputElement).value).toBe("");
  consultar.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; }));
  fireEvent.blur(cep); fireEvent.change(screen.getByLabelText("Número *"), { target: { value: "42" } });
  concluir({ endereco: { cep: "02002-000", logradouro: "Rua nova", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
  await waitFor(() => expect((screen.getByLabelText("Logradouro *") as HTMLInputElement).value).toBe("Rua nova"));
  expect((screen.getByLabelText("Número *") as HTMLInputElement).value).toBe("42");
});

it("consulta com falha mantém o endereço protegido e permite tentar novamente", async () => {
  consultar.mockRejectedValueOnce(new Error("Falha sintética")); render(<Formulario />);
  const cep = screen.getByLabelText("CEP *"); fireEvent.change(cep, { target: { value: "01001000" } }); fireEvent.blur(cep);
  await screen.findByText("Consulta do CEP indisponível. Tente novamente.");
  expect((screen.getByLabelText("Logradouro *") as HTMLInputElement).readOnly).toBe(true);
  fireEvent.blur(cep); await screen.findByText("Endereço preenchido pelo CEP. Informe número e complemento.");
});

it("CEP único de cidade libera somente logradouro e bairro, sem apagar o que foi digitado", async () => {
  consultar.mockResolvedValue({ endereco: { logradouro: "", bairro: "", cidade: "Cidade Fictícia", uf: "MG", codigoMunicipio: "3100000" } });
  render(<Formulario />);
  const cep = screen.getByLabelText("CEP *"), campo = (nome: string) => screen.getByLabelText(nome) as HTMLInputElement;
  fireEvent.change(cep, { target: { value: "30000000" } }); fireEvent.blur(cep);
  await screen.findByText("Este CEP não informa logradouro nem bairro. Preencha esses campos, o número e o complemento.");
  expect(campo("Logradouro *").readOnly).toBe(false); expect(campo("Bairro *").readOnly).toBe(false);
  expect(campo("Cidade *").readOnly).toBe(true); expect(campo("Estado / UF *").readOnly).toBe(true);
  expect(campo("Cidade *").value).toBe("Cidade Fictícia"); expect(campo("Estado / UF *").value).toBe("MG");
  fireEvent.change(campo("Logradouro *"), { target: { value: "Rua Digitada" } }); fireEvent.change(campo("Bairro *"), { target: { value: "Centro" } });
  fireEvent.blur(cep);
  await waitFor(() => expect(consultar).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.queryByText("Consultando CEP…")).toBeNull());
  expect(campo("Logradouro *").value).toBe("Rua Digitada"); expect(campo("Bairro *").value).toBe("Centro");
  expect(campo("Logradouro *").readOnly).toBe(false);
  consultar.mockResolvedValue({ endereco: { logradouro: "Rua Fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" } });
  fireEvent.change(cep, { target: { value: "01001000" } });
  expect(campo("Logradouro *").value).toBe(""); expect(campo("Logradouro *").readOnly).toBe(true);
  fireEvent.blur(cep);
  await waitFor(() => expect(campo("Logradouro *").value).toBe("Rua Fictícia"));
  expect(campo("Logradouro *").readOnly).toBe(true); expect(campo("Bairro *").readOnly).toBe(true);
});

it("endereço salvo com CEP único de cidade abre com o campo vazio liberado, sem consultar a API", () => {
  function Salvo() { const [e, setE] = useState<EnderecoPedidoForm>({ ...enderecoPedidoVazio(), cep: "30000000", numero: "50", bairro: "Centro", cidade: "Cidade Fictícia", uf: "MG" }); return <CamposEnderecoPedido obrigatorio valor={e} alterar={setE} />; }
  render(<Salvo />);
  const logradouro = screen.getByLabelText("Logradouro *") as HTMLInputElement;
  expect(logradouro.readOnly).toBe(false); expect((screen.getByLabelText("Bairro *") as HTMLInputElement).readOnly).toBe(true);
  fireEvent.change(logradouro, { target: { value: "R" } }); fireEvent.change(logradouro, { target: { value: "Rua Digitada" } });
  expect(logradouro.value).toBe("Rua Digitada"); expect(logradouro.readOnly).toBe(false);
  expect(consultar).not.toHaveBeenCalled();
});
