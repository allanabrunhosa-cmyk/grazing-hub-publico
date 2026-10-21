// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CamposClienteVenda, novoClienteVenda } from "@/app/(protegido)/vendas/clientes/campos-cliente";
import { ClientesVenda } from "@/app/(protegido)/vendas/clientes/clientes-client";
import type { ClienteEntrada } from "@/lib/vendas/dominio";
import type { ClienteConsulta } from "@/app/(protegido)/vendas/clientes/tipos";

const sim = vi.hoisted(() => ({ cep: vi.fn(), cnpj: vi.fn(), salvar: vi.fn() }));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClienteCadastro: vi.fn().mockResolvedValue({ email: false, documento: false }), consultarIdentidadeClientePedido: vi.fn().mockResolvedValue({ email: false, documento: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/app/(protegido)/vendas/actions", () => ({ salvarClienteVendaAction: sim.salvar, alterarStatusCadastroVendaAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/clientes/credito-actions", () => ({ ajustarCreditoClienteAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/clientes/historico-actions", () => ({ consultarHistoricoPedidosClienteAction: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/clientes/cadastro-actions", () => ({  buscarCnpjClienteAction: sim.cnpj, buscarCepClienteAction: sim.cep }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({  buscarCnpjPedidoAction: sim.cnpj, buscarCepPedidoAction: sim.cep }));

const postal = (numero = "10", complemento = "") => ({ pais: "Brasil", cep: "01001-000", logradouro: "Rua Fictícia", numero, complemento, bairro: "Centro", cidade: "São Paulo", uf: "SP" });
function clienteCompleto(): ClienteEntrada {
  const entrega = { destinatario: { nome: "Destinatária Um", contato: "" }, endereco: postal("30") };
  return { ...novoClienteVenda(), id: "cliente-sintetico", versao: 1, tipoEscolhido: true, nome: "Pessoa Sintética", email: "pessoa@example.invalid", telefone: "+5511900001234", enderecos: [{ ...postal(), nome: "Principal", destinatario: "", tipo: "PF", nomeCompleto: "Pessoa Sintética", documento: "" }], entregaPadrao: entrega };
}
function Formulario({ inicial = clienteCompleto(), alterar = vi.fn() }: { inicial?: ClienteEntrada; alterar?: (cliente: ClienteEntrada) => void }) {
  const [cliente, setCliente] = useState(inicial);
  return <CamposClienteVenda cliente={cliente} onChange={valor => { setCliente(valor); alterar(valor); }} />;
}
const entregaAtual = () => within(screen.getByRole("heading", { name: "Entrega" }).closest("section")!);
async function preencherPostal(modal: HTMLElement, numero: string, complemento = "") {
  const campos = within(modal);
  fireEvent.change(campos.getByLabelText("CEP *"), { target: { value: "01001000" } });
  fireEvent.blur(campos.getByLabelText("CEP *"));
  await waitFor(() => expect(campos.getByLabelText("Logradouro *")).toHaveProperty("value", "Rua Fictícia"));
  fireEvent.change(campos.getByLabelText("Número *"), { target: { value: numero } });
  fireEvent.change(campos.getByLabelText("Complemento (opcional)"), { target: { value: complemento } });
}
beforeEach(() => {
  sim.cep.mockReset().mockResolvedValue({ endereco: { logradouro: "Rua Fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" } });
  sim.cnpj.mockReset().mockResolvedValue({ cadastro: { razaoSocial: "Empresa Alternativa Sintética", endereco: postal() } });
  sim.salvar.mockReset().mockResolvedValue({ ok: true });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("inclusão temporária e endereço postal único", () => {
  it("+ cobrança abre formulário sem inserir item e cancelar conserva o cadastro", async () => {
    const alterar = vi.fn();
    render(<Formulario alterar={alterar} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar endereço de cobrança" }));
    const modal = screen.getByRole("dialog", { name: "Adicionar endereço de cobrança" });
    expect(alterar).not.toHaveBeenCalled();
    fireEvent.change(within(modal).getByLabelText("Nome Completo *"), { target: { value: "Titular temporário" } });
    await userEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Adicionar endereço de cobrança" })));
    expect(alterar).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Principal" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remover cobrança/ })).toBeNull();
  });

  it("Escape fecha a inclusão vazia e devolve o foco ao + sem alterar o cadastro", async () => {
    const alterar = vi.fn();
    render(<Formulario alterar={alterar} />);
    const adicionar = screen.getByRole("button", { name: "Adicionar endereço de entrega" });
    await userEvent.click(adicionar);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(adicionar));
    expect(alterar).not.toHaveBeenCalled();
  });

  it("cobra os campos obrigatórios e adiciona cobrança somente depois de completa", async () => {
    const alterar = vi.fn();
    render(<Formulario alterar={alterar} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar endereço de cobrança" }));
    const modal = screen.getByRole("dialog", { name: "Adicionar endereço de cobrança" });
    await userEvent.click(within(modal).getByRole("button", { name: "Adicionar endereço" }));
    expect(within(modal).getByRole("alert")).toBeTruthy();
    expect(alterar).not.toHaveBeenCalled();
    expect(within(modal).getByLabelText("CPF")).toHaveProperty("required", false);
    fireEvent.change(within(modal).getByLabelText("Nome Completo *"), { target: { value: "Outra Titular" } });
    await preencherPostal(modal, "20", "Sala 2");
    await userEvent.click(within(modal).getByRole("button", { name: "Adicionar endereço" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(alterar.mock.lastCall?.[0].enderecos).toHaveLength(2);
    expect(alterar.mock.lastCall?.[0].enderecos[1]).toMatchObject({ nomeCompleto: "Outra Titular", numero: "20", complemento: "Sala 2" });
    expect(screen.getByRole("combobox", { name: "Endereço de cobrança" })).toHaveProperty("value", expect.stringContaining("Cobrança 2 · Outra Titular"));
  });

  it("recusa o mesmo endereço da Principal mesmo com CNPJ e titular diferentes", async () => {
    const alterar = vi.fn();
    render(<Formulario alterar={alterar} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar endereço de cobrança" }));
    const modal = screen.getByRole("dialog", { name: "Adicionar endereço de cobrança" }), campos = within(modal);
    await userEvent.click(campos.getByRole("combobox", { name: "Tipo da cobrança" }));
    await userEvent.click(await screen.findByRole("option", { name: "Pessoa Jurídica" }));
    fireEvent.change(campos.getByLabelText("CNPJ *"), { target: { value: "11222333000181" } });
    await waitFor(() => expect(campos.getByLabelText("Razão social *")).toHaveProperty("value", "Empresa Alternativa Sintética"));
    await userEvent.click(campos.getByRole("button", { name: "Adicionar endereço" }));
    expect(campos.getByRole("alert").textContent).toContain("já está cadastrado em Principal");
    expect(alterar).not.toHaveBeenCalled();
  });

  it("+ entrega não insere branco e rejeita endereço repetido com outro destinatário", async () => {
    const alterar = vi.fn();
    render(<Formulario alterar={alterar} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar endereço de entrega" }));
    const modal = screen.getByRole("dialog", { name: "Adicionar endereço de entrega" }), campos = within(modal);
    expect(alterar).not.toHaveBeenCalled();
    await userEvent.click(campos.getByRole("button", { name: "Adicionar endereço" }));
    expect(campos.getByRole("alert").textContent).toContain("Nome Completo");
    fireEvent.change(campos.getByLabelText("Nome Completo *"), { target: { value: "Destinatária Diferente" } });
    await preencherPostal(modal, "30");
    await userEvent.click(campos.getByRole("button", { name: "Adicionar endereço" }));
    expect(campos.getByRole("alert").textContent).toContain("já está cadastrado em Entrega 1");
    expect(alterar).not.toHaveBeenCalled();
    fireEvent.change(campos.getByLabelText("Complemento (opcional)"), { target: { value: "Apartamento 2" } });
    await userEvent.click(campos.getByRole("button", { name: "Adicionar endereço" }));
    expect(alterar.mock.lastCall?.[0].entregaPadrao?.enderecos).toHaveLength(2);
    expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ selecionado: 1, destinatario: { nome: "Destinatária Diferente" }, endereco: { numero: "30", complemento: "Apartamento 2" } });
  });

  it("não deixa o CEP incompleto da consulta passar por campos brasileiros somente leitura", async () => {
    const alterar = vi.fn();
    sim.cep.mockResolvedValue({ endereco: { logradouro: "Rua Fictícia", bairro: "", cidade: "São Paulo", uf: "SP" } });
    render(<Formulario alterar={alterar} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar endereço de entrega" }));
    const modal = screen.getByRole("dialog", { name: "Adicionar endereço de entrega" }), campos = within(modal);
    fireEvent.change(campos.getByLabelText("Nome Completo *"), { target: { value: "Destinatária Completa" } });
    await preencherPostal(modal, "40");
    expect(campos.getByLabelText("Bairro *")).toHaveProperty("readOnly", true);
    await userEvent.click(campos.getByRole("button", { name: "Adicionar endereço" }));
    expect(campos.getByRole("alert").textContent).toContain("Bairro");
    expect(alterar).not.toHaveBeenCalled();
  });

  it("confirma remoção de cobrança preenchida e Cancelar mantém o endereço", async () => {
    const alterar = vi.fn(), inicial = clienteCompleto();
    inicial.enderecos.push({ ...inicial.enderecos[0], numero: "20", nomeCompleto: "Outra Titular" });
    render(<Formulario inicial={inicial} alterar={alterar} />);
    await userEvent.click(screen.getByRole("combobox", { name: "Endereço de cobrança" }));
    await userEvent.click(await screen.findByRole("option", { name: /^Cobrança 2/ }));
    await userEvent.click(screen.getByRole("button", { name: "Remover cobrança 2" }));
    const modal = screen.getByRole("dialog", { name: "Remover Cobrança 2?" });
    expect(alterar).not.toHaveBeenCalled();
    await userEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remover cobrança 2" })));
    expect(alterar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Remover cobrança 2" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar remoção de Cobrança 2" }));
    expect(alterar.mock.lastCall?.[0].enderecos).toHaveLength(1);
    expect(screen.getByRole("group", { name: "Principal" })).toBeTruthy();
  });

  it("confirma remoção de entrega preenchida antes de limpar a última opção", async () => {
    const alterar = vi.fn();
    render(<Formulario alterar={alterar} />);
    await userEvent.click(screen.getByRole("button", { name: "Remover entrega 1" }));
    expect(screen.getByRole("dialog", { name: "Remover Entrega 1?" })).toBeTruthy();
    expect(alterar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar remoção de Entrega 1" }));
    expect(alterar.mock.lastCall?.[0].entregaPadrao).toBeNull();
    expect(entregaAtual().getByText(/Nenhum endereço de entrega cadastrado/)).toBeTruthy();
  });

  it("permite limpar e repor nome, número e CEP de uma entrega em edição sem perder foco ou lançar erro", async () => {
    const alterar = vi.fn();
    render(<Formulario alterar={alterar} />);
    const campos = entregaAtual();
    for (const [rotulo, valor] of [["Nome Completo *", "Destinatária Atualizada"], ["Número *", "31"], ["CEP *", "01001000"]]) {
      const campo = campos.getByLabelText(rotulo);
      await userEvent.click(campo);
      await userEvent.clear(campo);
      expect(document.activeElement).toBe(campo);
      expect(campo).toHaveProperty("value", "");
      await userEvent.type(campo, valor);
      expect(document.activeElement).toBe(campo);
    }
    fireEvent.blur(campos.getByLabelText("CEP *"));
    await waitFor(() => expect(campos.getByLabelText("Logradouro *")).toHaveProperty("value", "Rua Fictícia"));
    expect(alterar.mock.lastCall?.[0].entregaPadrao).toMatchObject({ destinatario: { nome: "Destinatária Atualizada" }, endereco: { numero: "31", cep: "01001000" } });
  });

  it("bloqueia salvar cliente com campo postal obrigatório vazio mesmo quando readonly não participa da validade nativa", async () => {
    const cliente = { ...clienteCompleto(), entregaPadrao: null, resumoPedidos: { ultimoPedido: null, quantidadePedidos: 0, valorTotalGasto: "0" } } as ClienteConsulta;
    cliente.enderecos[0].bairro = "";
    render(<ClientesVenda clientes={[cliente]} adicionar editar />);
    await userEvent.click(screen.getByRole("button", { name: "Editar Pessoa Sintética" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(sim.salvar).not.toHaveBeenCalled();
  });
});
