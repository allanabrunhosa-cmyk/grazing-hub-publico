// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ClienteEntrada } from "@/lib/vendas/dominio";
import { LIMITE_ENTREGAS_CLIENTE } from "@/lib/vendas/cliente-entrega";
import { CamposClienteVenda, novoClienteVenda } from "@/app/(protegido)/vendas/clientes/campos-cliente";
import { CamposEnderecoPedido, enderecoPedidoVazio } from "@/app/(protegido)/vendas/pedidos/endereco-pedido-form";

const simulados = vi.hoisted(() => ({ cnpj: vi.fn(), consultar: vi.fn(), consultarPedido: vi.fn() }));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("@/app/(protegido)/vendas/clientes/cadastro-actions", () => ({  buscarCnpjClienteAction: simulados.cnpj, buscarCepClienteAction: simulados.consultar }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: vi.fn(), buscarCepPedidoAction: simulados.consultarPedido }));

beforeEach(() => {
  simulados.cnpj.mockReset();
  simulados.consultar.mockReset();
  simulados.consultarPedido.mockReset();
  simulados.consultar.mockResolvedValue({ endereco: { logradouro: "Rua Fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
});
afterEach(cleanup);

function Formulario({ inicial = { ...novoClienteVenda(), tipoEscolhido: true }, alterar = vi.fn(), consulta = vi.fn(), somenteLeitura = false }: { inicial?: ClienteEntrada; alterar?: (valor: ClienteEntrada) => void; consulta?: (ocupado: boolean) => void; somenteLeitura?: boolean }) {
  const [cliente, setCliente] = useState(inicial);
  return <CamposClienteVenda cliente={cliente} onChange={valor => { setCliente(valor); alterar(valor); }} onConsultandoCepChange={consulta} somenteLeitura={somenteLeitura} />;
}
const texto = (nome: string) => screen.getAllByRole("textbox", { name: nome })[0] as HTMLInputElement;
const informacoesGerais = () => within(screen.getByRole("heading", { name: "Informações gerais" }).closest("section")!);
const cobrancaPrincipal = () => within(screen.getByRole("group", { name: "Principal" }));
async function escolherCobranca(nome: string) {
  await userEvent.click(screen.getByRole("combobox", { name: "Endereço de cobrança" }));
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(`^${nome}( ·|$)`) }));
}
async function adicionarEntrega(nome: string, numero: string) {
  await userEvent.click(screen.getByRole("button", { name: "Adicionar endereço de entrega" }));
  const modal = within(screen.getByRole("dialog", { name: "Adicionar endereço de entrega" }));
  fireEvent.change(modal.getByLabelText("Nome Completo *"), { target: { value: nome } });
  fireEvent.change(modal.getByLabelText("CEP *"), { target: { value: "01001000" } });
  fireEvent.blur(modal.getByLabelText("CEP *"));
  await waitFor(() => expect(modal.getByLabelText("Logradouro *")).toHaveProperty("value", "Rua Fictícia"));
  fireEvent.change(modal.getByLabelText("Número *"), { target: { value: numero } });
  await userEvent.click(modal.getByRole("button", { name: "Adicionar endereço" }));
}

it("inicia cadastro novo pelo e-mail obrigatório antes de escolher o tipo e informar o nome", () => {
  const alterar = vi.fn();
  render(<Formulario inicial={novoClienteVenda()} alterar={alterar} />);
  const email = texto("E-mail");
  expect(email.matches(":disabled")).toBe(false);
  expect(email.required).toBe(true);
  expect(email.validity.valueMissing).toBe(true);
  expect(email.compareDocumentPosition(texto("Nome Completo *")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.change(email, { target: { value: "novo@example.invalid" } });
  expect(email.checkValidity()).toBe(true);
  expect(alterar.mock.lastCall?.[0]).toMatchObject({ email: "novo@example.invalid", tipoEscolhido: false });
  expect(texto("Nome Completo *").matches(":disabled")).toBe(true);
});

it("permite editar legado sem e-mail sem tornar o campo obrigatório nem inventar um endereço", () => {
  const alterar = vi.fn();
  render(<Formulario inicial={{ ...novoClienteVenda(), id: "legado-sem-email", versao: 2, tipoEscolhido: true, nome: "Pessoa Legada", email: null }} alterar={alterar} />);
  const email = texto("E-mail");
  expect(email.required).toBe(false);
  expect(email.readOnly).toBe(false);
  expect(email.checkValidity()).toBe(true);
  fireEvent.change(texto("Nome Completo *"), { target: { value: "Pessoa Legada Atualizada" } });
  expect(alterar.mock.lastCall?.[0]).toMatchObject({ id: "legado-sem-email", nome: "Pessoa Legada Atualizada", email: null });
});

it("exige tipo e vincula Nome Completo e CPF das Informações gerais à Principal fixada", async () => {
  const alterar = vi.fn(), usuario = userEvent.setup();
  render(<Formulario inicial={novoClienteVenda()} alterar={alterar} />);
  expect(texto("Nome Completo *").matches(":disabled")).toBe(true);
  await usuario.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
  await usuario.click(await screen.findByRole("option", { name: "Pessoa Física" }));
  fireEvent.change(texto("Nome Completo *"), { target: { value: "Ana Fictícia" } });
  fireEvent.change(texto("Telefone *"), { target: { value: "11999991234" } });
  expect(alterar.mock.lastCall?.[0]).toMatchObject({ nome: "Ana Fictícia", telefone: "+5511999991234" });
  const geral = informacoesGerais(), principal = cobrancaPrincipal();
  fireEvent.change(geral.getByLabelText("CPF"), { target: { value: "12345678909" } });
  expect(geral.getByLabelText("CPF")).toHaveProperty("readOnly", false);
  expect(geral.queryByLabelText("Sobrenome *")).toBeNull();
  expect(principal.getByLabelText("CPF")).toHaveProperty("value", "123.456.789-09");
  expect(principal.getByLabelText("CPF")).toHaveProperty("readOnly", true);
  expect(principal.getByLabelText("Nome Completo *")).toHaveProperty("value", "Ana Fictícia");
  expect(principal.getByLabelText("Nome Completo *")).toHaveProperty("readOnly", true);
  expect(principal.getByRole("combobox", { name: "Tipo da cobrança" })).toHaveProperty("disabled", true);
  const fixacao = principal.getByRole("button", { name: "Titular da Principal fixado às Informações gerais", pressed: true });
  expect(fixacao).toHaveProperty("disabled", true);
  await usuario.click(fixacao);
  expect(principal.getByLabelText("Nome Completo *")).toHaveProperty("readOnly", true);
  fireEvent.change(principal.getByLabelText("Número *"), { target: { value: "42" } });
  expect(principal.getByLabelText("Número *")).toHaveProperty("value", "42");
  expect(principal.getByLabelText("Número *")).toHaveProperty("readOnly", false);
  expect(screen.getByRole("combobox", { name: "Endereço de cobrança" })).toHaveProperty("value", expect.stringContaining("Principal"));
  expect(screen.queryByRole("button", { name: /Remover cobrança/ })).toBeNull();
});

it("PJ usa Nome Fantasia e repete CNPJ, razão social e inscrições gerais na Principal somente para leitura", async () => {
  const usuario = userEvent.setup(), alterar = vi.fn();
  render(<Formulario alterar={alterar} />);
  await usuario.click(screen.getByRole("combobox", { name: "Tipo de cliente" }));
  await usuario.click(await screen.findByRole("option", { name: "Pessoa Jurídica" }));
  fireEvent.change(texto("Nome Fantasia *"), { target: { value: "Empresa Fictícia" } });
  fireEvent.change(texto("Nome Completo do contato"), { target: { value: "Maria Clara Fictícia" } });
  expect(alterar.mock.lastCall?.[0]).toMatchObject({ nome: "Empresa Fictícia", contato: "Maria Clara Fictícia" });
  const geral = informacoesGerais(), principal = cobrancaPrincipal();
  const cnpj = geral.getByLabelText("CNPJ *");
  expect(cnpj.compareDocumentPosition(geral.getByLabelText("Razão social *")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const [campo, value, visual = value] of [["CNPJ *", "1122233300018", "11.222.333/0001-8"], ["Razão social *", "Razão sintética"], ["Inscrição Estadual", "12345"], ["Inscrição Municipal", "67890"]]) {
    fireEvent.change(geral.getByLabelText(campo), { target: { value } });
    expect(geral.getByLabelText(campo)).toHaveProperty("readOnly", false);
    expect(principal.getByLabelText(campo)).toHaveProperty("value", visual);
    expect(principal.getByLabelText(campo)).toHaveProperty("readOnly", true);
  }
  expect(principal.getByRole("combobox", { name: "Tipo da cobrança" })).toHaveProperty("disabled", true);
  expect(screen.queryByLabelText("I.E.")).toBeNull();
});

it("preserva dados legados e fixa Principal enquanto remove só a cobrança escolhida com confirmação", async () => {
  const alterar = vi.fn(), endereco = novoClienteVenda().enderecos[0];
  const inicial: ClienteEntrada = { ...novoClienteVenda(), tipoEscolhido: true, id: "cliente-ficticio", versao: 2, nome: "Cliente Legado", primeiroNome: null, sobrenome: null, contato: "Contato preservado", observacoes: "Observação preservada", telefone: "+5511999991234", enderecos: [{ ...endereco, nome: "Cobrança", numero: "10" }, { ...endereco, nome: "Empresa", numero: "20" }] };
  render(<Formulario inicial={inicial} alterar={alterar} />);
  expect(texto("Nome Completo *").value).toBe("Cliente Legado");
  fireEvent.change(texto("Telefone *"), { target: { value: "+55 (21) 99999-1234" } });
  expect(alterar.mock.lastCall?.[0]).toMatchObject({ nome: "Cliente Legado", primeiroNome: null, sobrenome: null, contato: "Contato preservado", enderecos: inicial.enderecos });
  await escolherCobranca("Cobrança 2");
  fireEvent.click(screen.getByRole("button", { name: "Remover cobrança 2" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar remoção de Cobrança 2" }));
  expect(alterar.mock.lastCall?.[0].enderecos.map((e: { nome: string }) => e.nome)).toEqual(["Principal"]);
  expect(screen.queryByRole("button", { name: /Remover cobrança/ })).toBeNull();
});

it("consulta CEP pela autorização de Clientes, protege os quatro campos brasileiros e mantém alterações feitas durante a resposta", async () => {
  let responder!: (valor: { endereco: { logradouro: string; bairro: string; cidade: string; uf: string } }) => void;
  simulados.consultar.mockReturnValue(new Promise(resolve => { responder = resolve; }));
  const alterar = vi.fn(), consulta = vi.fn();
  render(<Formulario alterar={alterar} consulta={consulta} />);
  fireEvent.change(texto("CEP *"), { target: { value: "01001000" } });
  fireEvent.blur(texto("CEP *"));
  expect(consulta).toHaveBeenLastCalledWith(true);
  fireEvent.change(texto("Número *"), { target: { value: "123" } });
  fireEvent.change(texto("Complemento (opcional)"), { target: { value: "Sala 2" } });
  fireEvent.change(texto("E-mail"), { target: { value: "consulta@example.invalid" } });
  responder({ endereco: { logradouro: "Rua Fictícia", bairro: "", cidade: "São Paulo", uf: "SP" } });
  await waitFor(() => expect(texto("Logradouro *").value).toBe("Rua Fictícia"));
  expect(texto("CEP *").value).toBe("01001-000");
  expect(texto("Logradouro *").readOnly).toBe(true);
  expect(texto("Cidade *").readOnly).toBe(true);
  expect(texto("Estado / UF *").readOnly).toBe(true);
  expect(texto("Bairro *").readOnly).toBe(true);
  expect(texto("Número *").value).toBe("123");
  expect(texto("Complemento (opcional)").value).toBe("Sala 2");
  expect(texto("Complemento (opcional)").readOnly).toBe(false);
  expect(alterar.mock.lastCall?.[0].email).toBe("consulta@example.invalid");
  expect(simulados.consultar).toHaveBeenCalledWith("01001000");
  expect(simulados.consultarPedido).not.toHaveBeenCalled();
  expect(consulta).toHaveBeenLastCalledWith(false);
  fireEvent.change(texto("CEP *"), { target: { value: "02002000" } });
  for (const nome of ["Logradouro *", "Bairro *", "Cidade *", "Estado / UF *"]) {
    expect(texto(nome).value).toBe("");
    expect(texto(nome).readOnly).toBe(true);
  }
});

it("descarta resultado de CEP anterior, mantém campos brasileiros protegidos em falha e permite entrada manual estrangeira", async () => {
  let responder!: (valor: { endereco: { cidade: string; uf: string } }) => void;
  simulados.consultar.mockReturnValueOnce(new Promise(resolve => { responder = resolve; }));
  render(<Formulario />);
  fireEvent.change(texto("CEP *"), { target: { value: "01001000" } });
  fireEvent.blur(texto("CEP *"));
  fireEvent.change(texto("CEP *"), { target: { value: "02002000" } });
  responder({ endereco: { cidade: "Resposta antiga", uf: "SP" } });
  await waitFor(() => expect(texto("Cidade *").value).toBe(""));
  simulados.consultar.mockRejectedValueOnce(new Error("Falha simulada"));
  fireEvent.blur(texto("CEP *"));
  await screen.findByText("Consulta do CEP indisponível. Tente novamente.");
  expect(texto("Cidade *").readOnly).toBe(true);
  fireEvent.blur(texto("CEP *"));
  await screen.findByText("Endereço preenchido pelo CEP. Informe número e complemento.");
  cleanup();
  const estrangeiro = { ...novoClienteVenda(), tipoEscolhido: true };
  estrangeiro.enderecos[0] = { ...estrangeiro.enderecos[0], pais: "Portugal", cep: "1234-567" };
  render(<Formulario inicial={estrangeiro} />);
  simulados.consultar.mockClear();
  fireEvent.blur(texto("Código postal *"));
  expect(simulados.consultar).not.toHaveBeenCalled();
  expect(texto("Estado / região *").maxLength).toBe(120);
  expect(texto("Cidade *").readOnly).toBe(false);
});

it("bloqueia troca e remoção da aba enquanto consulta CEP e preserva cada endereço", async () => {
  let responder!: (valor: { endereco: { cidade: string } }) => void;
  simulados.consultar.mockReturnValue(new Promise(resolve => { responder = resolve; }));
  const inicial = { ...novoClienteVenda(), tipoEscolhido: true }, consulta = vi.fn();
  inicial.enderecos.push({ ...inicial.enderecos[0], nome: "Empresa", numero: "20" });
  render(<Formulario inicial={inicial} consulta={consulta} />);
  const primeiro = cobrancaPrincipal();
  fireEvent.change(primeiro.getByRole("textbox", { name: "CEP *" }), { target: { value: "01001000" } });
  fireEvent.blur(primeiro.getByRole("textbox", { name: "CEP *" }));
  expect(screen.getByRole("combobox", { name: "Endereço de cobrança" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("group", { name: "Principal" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Remover cobrança/ })).toBeNull();
  responder({ endereco: { cidade: "Cidade A" } });
  await waitFor(() => expect(consulta).toHaveBeenLastCalledWith(false));
  await escolherCobranca("Cobrança 2");
  expect((within(screen.getByRole("group", { name: "Cobrança 2" })).getByRole("textbox", { name: "Número *" }) as HTMLInputElement).value).toBe("20");
  await escolherCobranca("Principal");
  expect(cobrancaPrincipal().getByRole("textbox", { name: "Cidade *" })).toHaveProperty("value", "Cidade A");
});

it("trocar endereço externamente no Pedido conserva a proteção brasileira sem reaproveitar consulta anterior", async () => {
  function Pedido() {
    const [endereco, setEndereco] = useState(enderecoPedidoVazio);
    return <><button type="button" onClick={() => setEndereco({ ...enderecoPedidoVazio(), cep: "02002000", cidade: "Outra cidade" })}>Selecionar outro cliente</button><CamposEnderecoPedido valor={endereco} alterar={setEndereco} consultarCep={simulados.consultar} obrigatorio /></>;
  }
  render(<Pedido />);
  fireEvent.change(texto("CEP *"), { target: { value: "01001000" } });
  fireEvent.blur(texto("CEP *"));
  await waitFor(() => expect(texto("Cidade *").value).toBe("São Paulo"));
  fireEvent.click(screen.getByRole("button", { name: "Selecionar outro cliente" }));
  expect(texto("Cidade *").value).toBe("Outra cidade");
  expect(texto("Cidade *").readOnly).toBe(true);
});


it("copia endereço, nome e telefone próprios da cobrança selecionada e conserva o telefone geral da Principal", async () => {
  const inicial = { ...novoClienteVenda(), tipoEscolhido: true, nome: "Compradora Fictícia", telefone: "+5511988880000", entregaPadrao: entregaFicticia("Destinatária", "20") };
  inicial.enderecos = [{ ...inicial.enderecos[0], numero: "10" }, { ...inicial.enderecos[0], numero: "99", tipo: "PF", nomeCompleto: "Titular Terceira", telefone: "+5511999991111" }];
  render(<Formulario inicial={inicial} />);
  expect(cobrancaPrincipal().getByLabelText("Telefone da cobrança")).toHaveProperty("value", "+55 (11) 98888-0000");
  expect(cobrancaPrincipal().getByLabelText("Telefone da cobrança")).toHaveProperty("readOnly", true);
  await escolherCobranca("Cobrança 2");
  const segunda = within(screen.getByRole("group", { name: "Cobrança 2" }));
  fireEvent.change(segunda.getByLabelText("Número *"), { target: { value: "99" } });
  fireEvent.change(segunda.getByLabelText("Nome Completo *"), { target: { value: "Titular Terceira" } });
  expect(segunda.getByLabelText("Telefone da cobrança")).toHaveProperty("readOnly", false);
  fireEvent.click(screen.getByRole("button", { name: "Copiar endereço de cobrança" }));
  const entrega = within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
  expect(entrega.getByLabelText("Número *")).toHaveProperty("value", "99");
  expect(entrega.getByLabelText("Nome Completo *")).toHaveProperty("value", "Titular Terceira");
  expect(entrega.getByLabelText("Telefone")).toHaveProperty("value", "+55 (11) 99999-1111");
  await escolherCobranca("Principal");
  expect(texto("Número *").value).toBe("10");
  await escolherCobranca("Cobrança 2");
  expect(within(screen.getByRole("group", { name: "Cobrança 2" })).getByLabelText("Nome Completo *")).toHaveProperty("value", "Titular Terceira");
});

it("alterar nome, documento e tipo geral atualiza só o titular da Principal", async () => {
  const usuario = userEvent.setup();
  const inicial = { ...novoClienteVenda(), tipoEscolhido: true, nome: "Compradora Fictícia", documento: "12345678909" };
  inicial.enderecos.push({ ...inicial.enderecos[0], tipo: "PF", nomeCompleto: "Titular Terceira", documento: "98765432100", numero: "20" });
  render(<Formulario inicial={inicial} />);
  await escolherCobranca("Cobrança 2");
  let segunda = within(screen.getByRole("group", { name: "Cobrança 2" }));
  fireEvent.change(segunda.getByLabelText("Nome Completo *"), { target: { value: "Titular Terceira" } });
  fireEvent.change(segunda.getByLabelText("CPF"), { target: { value: "98765432100" } });
  expect(segunda.getByRole("combobox", { name: "Tipo da cobrança" })).toHaveProperty("disabled", false);
  expect(segunda.queryByRole("button", { name: /fixado às Informações gerais/ })).toBeNull();
  const geral = informacoesGerais();
  fireEvent.change(geral.getByLabelText("Nome Completo *"), { target: { value: "Compradora Atualizada" } });
  fireEvent.change(geral.getByLabelText("CPF"), { target: { value: "11122233344" } });
  await escolherCobranca("Principal");
  expect(cobrancaPrincipal().getByLabelText("Nome Completo *")).toHaveProperty("value", "Compradora Atualizada");
  expect(cobrancaPrincipal().getByLabelText("CPF")).toHaveProperty("value", "111.222.333-44");
  await usuario.click(geral.getByRole("combobox", { name: "Tipo de cliente" }));
  await usuario.click(await screen.findByRole("option", { name: "Pessoa Jurídica" }));
  expect(cobrancaPrincipal().getByRole("combobox", { name: "Tipo da cobrança" }).textContent).toContain("Pessoa Jurídica");
  expect(cobrancaPrincipal().getByLabelText("CNPJ *")).toHaveProperty("value", "");
  expect(cobrancaPrincipal().getByRole("combobox", { name: "Tipo da cobrança" })).toHaveProperty("disabled", true);
  await escolherCobranca("Cobrança 2");
  segunda = within(screen.getByRole("group", { name: "Cobrança 2" }));
  expect(segunda.getByRole("combobox", { name: "Tipo da cobrança" }).textContent).toContain("Pessoa Física");
  expect(segunda.getByLabelText("Nome Completo *")).toHaveProperty("value", "Titular Terceira");
  expect(segunda.getByLabelText("CPF")).toHaveProperty("value", "987.654.321-00");
  expect(segunda.getByLabelText("CPF")).toHaveProperty("readOnly", false);
});

it("recupera documento legado guardado só no JSON da Principal e conserva ao editar outro campo", () => {
  const alterar = vi.fn(), inicial = { ...novoClienteVenda(), tipoEscolhido: true, nome: "Titular Legada", documento: null };
  inicial.enderecos[0] = { ...inicial.enderecos[0], tipo: "PF", nomeCompleto: "Nome antigo", documento: "12345678909" };
  render(<Formulario inicial={inicial} alterar={alterar} />);
  expect(informacoesGerais().getByLabelText("CPF")).toHaveProperty("value", "123.456.789-09");
  expect(cobrancaPrincipal().getByLabelText("CPF")).toHaveProperty("value", "123.456.789-09");
  expect(cobrancaPrincipal().getByLabelText("Nome Completo *")).toHaveProperty("value", "Titular Legada");
  fireEvent.change(informacoesGerais().getByLabelText("E-mail"), { target: { value: "legado@example.invalid" } });
  expect(cobrancaPrincipal().getByLabelText("CPF")).toHaveProperty("value", "123.456.789-09");
  expect(alterar.mock.lastCall?.[0].enderecos[0].documento).toBe("12345678909");
});

it("CNPJ geral preenche a Principal, preserva edição manual durante consulta e bloqueia salvar/trocar abas", async () => {
  let responder!: (valor: unknown) => void;
  simulados.cnpj.mockImplementation(() => new Promise(resolve => { responder = resolve; }));
  const consulta = vi.fn(), usuario = userEvent.setup();
  render(<Formulario inicial={{ ...novoClienteVenda(), tipoEscolhido: true, tipo: "PJ", nome: "Fantasia" }} consulta={consulta} />);
  const geral = informacoesGerais();
  fireEvent.change(geral.getByLabelText("CNPJ *"), { target: { value: "11222333000181" } });
  expect(simulados.cnpj).toHaveBeenCalledTimes(1);
  expect(consulta).toHaveBeenLastCalledWith(true);
  expect(screen.getByRole("button", { name: "Adicionar endereço de cobrança" }).matches(":disabled")).toBe(true);
  fireEvent.change(texto("Número *"), { target: { value: "123" } });
  responder({ cadastro: { razaoSocial: "Razão sintética", endereco: { pais: "Brasil", cep: "01001000", logradouro: "Rua sintética", numero: "42", complemento: "Sala 2", bairro: "Centro", cidade: "São Paulo", uf: "SP", codigoMunicipio: "3550308" } } });
  await waitFor(() => expect(consulta).toHaveBeenLastCalledWith(false));
  expect(texto("Razão social *").value).toBe("Razão sintética");
  expect(texto("Número *").value).toBe("123");
  expect(texto("Complemento (opcional)").value).toBe("Sala 2");
  expect(texto("Logradouro *").value).toBe("Rua sintética");
  expect(cobrancaPrincipal().getByLabelText("CNPJ *")).toHaveProperty("value", "11.222.333/0001-81");
  expect(cobrancaPrincipal().getByLabelText("Razão social *")).toHaveProperty("value", "Razão sintética");
  expect(cobrancaPrincipal().getByLabelText("CNPJ *")).toHaveProperty("readOnly", true);
  fireEvent.blur(geral.getByLabelText("CNPJ *"));
  expect(simulados.cnpj).toHaveBeenCalledTimes(1);
  await usuario.click(geral.getByRole("combobox", { name: "Tipo de cliente" }));
  await usuario.click(await screen.findByRole("option", { name: "Pessoa Física" }));
  expect(texto("CPF").value).toBe("");
  expect(screen.queryByLabelText("Razão social *")).toBeNull();
});


const secaoEntrega = () => within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
const entregaFicticia = (nome: string, numero: string) => ({ destinatario: { nome, contato: "" }, endereco: { ...enderecoPedidoVazio(), cep: "01001-000", logradouro: "Rua Fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP", numero } });
async function escolherEntrega(nome: RegExp, busca: string) {
  const campo = screen.getByRole("combobox", { name: "Endereço de entrega" });
  await userEvent.click(campo);
  fireEvent.change(campo, { target: { value: busca } });
  await userEvent.click(await screen.findByRole("option", { name: nome }));
}

it("mantém a entrega legada e edita somente o novo endereço escolhido", async () => {
  const alterar = vi.fn(), legado = entregaFicticia("Destinatária Legada", "10");
  render(<Formulario inicial={{ ...novoClienteVenda(), tipoEscolhido: true, entregaPadrao: legado }} alterar={alterar} />);
  expect(alterar).not.toHaveBeenCalled();
  expect(secaoEntrega().getByLabelText("Nome Completo *")).toHaveProperty("value", "Destinatária Legada");
  await adicionarEntrega("Segunda Destinatária", "20");
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ selecionado: 1, destinatario: { nome: "Segunda Destinatária" }, endereco: { numero: "20" }, enderecos: [legado, { destinatario: { nome: "Segunda Destinatária" }, endereco: { numero: "20" } }] });
  await escolherEntrega(/^Entrega 1 · Destinatária Legada/, "legada");
  expect(secaoEntrega().getByLabelText("Número *")).toHaveProperty("value", "10");
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ selecionado: 0, destinatario: { nome: "Destinatária Legada" }, enderecos: [legado, { endereco: { numero: "20" } }] });
});

it("copia nome, telefone e endereço da cobrança somente para a entrega selecionada, preservando as demais entregas", async () => {
  const alterar = vi.fn(), primeira = entregaFicticia("Destinatária Um", "10"), segunda = entregaFicticia("Destinatária Dois", "20");
  const base = novoClienteVenda();
  const destinatarioCobranca = { nome: "Titular Cobrança Dois", contato: "+5511999992222" };
  render(<Formulario inicial={{ ...base, tipoEscolhido: true, enderecos: [{ ...base.enderecos[0], numero: "11" }, { ...base.enderecos[0], numero: "99", tipo: "PF", nomeCompleto: destinatarioCobranca.nome, telefone: destinatarioCobranca.contato }], entregaPadrao: { ...segunda, enderecos: [primeira, segunda], selecionado: 1 } }} alterar={alterar} />);
  await escolherCobranca("Cobrança 2");
  await userEvent.click(screen.getByRole("button", { name: "Copiar endereço de cobrança" }));
  expect(secaoEntrega().getByLabelText("Número *")).toHaveProperty("value", "99");
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ selecionado: 1, destinatario: destinatarioCobranca, enderecos: [primeira, { destinatario: destinatarioCobranca, endereco: { numero: "99" } }] });
  await escolherEntrega(/^Entrega 1 · Destinatária Um/, "Destinataria Um");
  expect(secaoEntrega().getByLabelText("Número *")).toHaveProperty("value", "10");
});

it("remove só a entrega escolhida e permite limpar a última entrega real", async () => {
  const alterar = vi.fn(), primeira = entregaFicticia("Destinatária Um", "10"), segunda = entregaFicticia("Destinatária Dois", "20");
  render(<Formulario inicial={{ ...novoClienteVenda(), tipoEscolhido: true, entregaPadrao: { ...segunda, enderecos: [primeira, segunda], selecionado: 1 } }} alterar={alterar} />);
  await userEvent.click(screen.getByRole("button", { name: "Remover entrega 2" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar remoção de Entrega 2" }));
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ ...primeira, enderecos: [primeira], selecionado: 0 });
  await userEvent.click(screen.getByRole("button", { name: "Remover entrega 1" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar remoção de Entrega 1" }));
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toBeNull();
  expect(secaoEntrega().getByText(/Nenhum endereço de entrega cadastrado/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Remover entrega 1" })).toHaveProperty("disabled", true);
  await adicionarEntrega("Nova Destinatária", "30");
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ selecionado: 0, enderecos: [{ destinatario: { nome: "Nova Destinatária" } }] });
  expect(alterar.mock.lastCall?.[0].entregaPadrao?.enderecos).toHaveLength(1);
});

it("busca o último de 250 endereços pelo destinatário ou dados postais e bloqueia inclusão além do limite", async () => {
  const alterar = vi.fn();
  const enderecos = Array.from({ length: LIMITE_ENTREGAS_CLIENTE }, (_, indice) => ({ ...entregaFicticia(`Destinatária Sintética ${indice + 1}`, String(indice + 1)), endereco: { ...enderecoPedidoVazio(), logradouro: `Rua Sintética ${indice + 1}`, numero: String(indice + 1) } }));
  render(<Formulario inicial={{ ...novoClienteVenda(), tipoEscolhido: true, entregaPadrao: { ...enderecos[0], enderecos, selecionado: 0 } }} alterar={alterar} />);
  expect(screen.getByRole("button", { name: "Adicionar endereço de entrega" })).toHaveProperty("disabled", true);
  await escolherEntrega(/^Entrega 250 · Destinatária Sintética 250/, "  RUA SINTETICA 250  ");
  expect(secaoEntrega().getByLabelText("Número *")).toHaveProperty("value", "250");
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ selecionado: 249, endereco: { numero: "250" } });
  expect(alterar.mock.lastCall?.[0].entregaPadrao?.enderecos).toHaveLength(250);
});

it("permite consultar as entregas em leitura sem alterar o cadastro", async () => {
  const alterar = vi.fn(), primeira = entregaFicticia("Destinatária Um", "10"), segunda = entregaFicticia("Destinatária Dois", "20");
  render(<Formulario somenteLeitura inicial={{ ...novoClienteVenda(), tipoEscolhido: true, entregaPadrao: { ...primeira, enderecos: [primeira, segunda], selecionado: 0 } }} alterar={alterar} />);
  await escolherEntrega(/^Entrega 2 · Destinatária Dois/, "Destinatária Dois");
  expect(secaoEntrega().getByLabelText("Número")).toHaveProperty("value", "20");
  expect(secaoEntrega().getByLabelText("Número")).toHaveProperty("readOnly", true);
  expect(screen.getByRole("button", { name: "Adicionar endereço de entrega" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Remover entrega 2" })).toHaveProperty("disabled", true);
  expect(alterar).not.toHaveBeenCalled();
});

it("bloqueia troca e remoção da entrega durante o CEP e aplica a resposta só à opção consultada", async () => {
  let responder!: (valor: { endereco: { logradouro: string; bairro: string; cidade: string; uf: string } }) => void;
  simulados.consultar.mockReturnValue(new Promise(resolve => { responder = resolve; }));
  const alterar = vi.fn(), primeira = entregaFicticia("Destinatária Um", "10"), segunda = entregaFicticia("Destinatária Dois", "20");
  render(<Formulario inicial={{ ...novoClienteVenda(), tipoEscolhido: true, entregaPadrao: { ...segunda, enderecos: [primeira, segunda], selecionado: 1 } }} alterar={alterar} />);
  fireEvent.change(secaoEntrega().getByLabelText("CEP *"), { target: { value: "01001000" } });
  fireEvent.blur(secaoEntrega().getByLabelText("CEP *"));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Endereço de entrega" })).toHaveProperty("disabled", true));
  expect(screen.getByRole("button", { name: "Adicionar endereço de entrega" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("button", { name: "Remover entrega 2" })).toHaveProperty("disabled", true);
  fireEvent.change(secaoEntrega().getByLabelText("Número *"), { target: { value: "23" } });
  fireEvent.change(secaoEntrega().getByLabelText("Nome Completo *"), { target: { value: "Destinatária Atualizada" } });
  responder({ endereco: { logradouro: "Rua Fictícia CEP", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
  await waitFor(() => expect(secaoEntrega().getByLabelText("Logradouro *")).toHaveProperty("value", "Rua Fictícia CEP"));
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ selecionado: 1, destinatario: { nome: "Destinatária Atualizada" }, endereco: { numero: "23" }, enderecos: [primeira, { destinatario: { nome: "Destinatária Atualizada" }, endereco: { numero: "23", logradouro: "Rua Fictícia CEP" } }] });
  expect(screen.getByRole("combobox", { name: "Endereço de entrega" })).toHaveProperty("disabled", false);
});

it("exibe o endereço original parcial em leitura e o preserva ao editar destinatário, CEP ou outra entrega", async () => {
  const alterar = vi.fn();
  const original = "Rua sintética sem número\nReferência parcial preservada";
  const parcial = { destinatario: { nome: "Destinatária Parcial", contato: "" }, endereco: enderecoPedidoVazio(), textoOriginal: original };
  render(<Formulario inicial={{ ...novoClienteVenda(), tipoEscolhido: true, entregaPadrao: parcial }} alterar={alterar} />);
  expect(secaoEntrega().getByText("Endereço original")).toBeTruthy();
  expect(secaoEntrega().getByText(original, { normalizer: texto => texto })).toBeTruthy();
  expect(secaoEntrega().queryByRole("textbox", { name: "Endereço original" })).toBeNull();
  expect(secaoEntrega().getByLabelText("CEP *")).toHaveProperty("value", "");
  expect(secaoEntrega().getByLabelText("Número *")).toHaveProperty("value", "");
  fireEvent.change(secaoEntrega().getByLabelText("Nome Completo *"), { target: { value: "Destinatária Atualizada" } });
  fireEvent.change(secaoEntrega().getByLabelText("CEP *"), { target: { value: "01001000" } });
  fireEvent.blur(secaoEntrega().getByLabelText("CEP *"));
  await waitFor(() => expect(secaoEntrega().getByLabelText("Logradouro *")).toHaveProperty("value", "Rua Fictícia"));
  expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ textoOriginal: original, destinatario: { nome: "Destinatária Atualizada" }, endereco: { numero: "", cep: "01001000" }, enderecos: [{ textoOriginal: original }] });
  await adicionarEntrega("Outra Destinatária", "20");
  expect(secaoEntrega().queryByText("Endereço original")).toBeNull();
  expect(alterar.mock.lastCall?.[0].entregaPadrao?.enderecos?.[0].textoOriginal).toBe(original);
  await escolherEntrega(/^Entrega 1 · Destinatária Atualizada/, " REFERENCIA PARCIAL PRESERVADA ");
  expect(secaoEntrega().getByText(original, { normalizer: texto => texto })).toBeTruthy();
});

it("avisa titular PJ legado pendente e exige CNPJ e razão social para resolver a identidade", async () => {
  const alterar = vi.fn(), base = novoClienteVenda();
  simulados.cnpj.mockResolvedValue({ erro: "Consulta sintética indisponível" });
  render(<Formulario inicial={{ ...base, tipoEscolhido: true, nome: "Compradora Sintética", enderecos: [...base.enderecos, { ...base.enderecos[0], tipo: "PJ", documento: "", razaoSocial: "", titularPendente: true }] }} alterar={alterar} />);
  expect(cobrancaPrincipal().queryByText("Titular pendente. Confirme o CNPJ antes de faturar.")).toBeNull();
  await escolherCobranca("Cobrança 2");
  const adicional = within(screen.getByRole("group", { name: "Cobrança 2" }));
  expect(adicional.getByText("Titular pendente. Confirme o CNPJ antes de faturar.")).toBeTruthy();
  expect(adicional.getByLabelText("CNPJ *")).toHaveProperty("required", true);
  expect(adicional.getByLabelText("Razão social *")).toHaveProperty("required", true);
  fireEvent.change(adicional.getByLabelText("CNPJ *"), { target: { value: "11222333000181" } });
  await screen.findByText("Consulta sintética indisponível");
  expect(adicional.getByText("Titular pendente. Confirme o CNPJ antes de faturar.")).toBeTruthy();
  fireEvent.change(adicional.getByLabelText("Razão social *"), { target: { value: "Empresa Sintética Confirmada" } });
  expect(adicional.queryByText("Titular pendente. Confirme o CNPJ antes de faturar.")).toBeNull();
  expect(adicional.getByLabelText("CNPJ *")).toHaveProperty("required", true);
  expect(alterar.mock.lastCall?.[0].enderecos[1].titularPendente).not.toBe(true);
  expect(informacoesGerais().getByLabelText("CPF")).toHaveProperty("value", "");
});
