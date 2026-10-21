// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { CadastroClientePedido } from "@/app/(protegido)/vendas/pedidos/cadastro-cliente-form";
import { CamposClienteVenda, novoClienteVenda } from "@/app/(protegido)/vendas/clientes/campos-cliente";
import { novoClientePedido } from "@/app/(protegido)/vendas/pedidos/novo-cliente-pedido";
import { useIdentidadeCliente } from "@/app/(protegido)/vendas/pedidos/use-identidade-cliente";
import type { ClienteEntrada } from "@/lib/vendas/dominio";
import type { ConflitosIdentidadeCliente, ConsultarIdentidadeCliente } from "@/lib/vendas/cliente-identidade-consulta";

const sim = vi.hoisted(() => ({ pedido: vi.fn(), cliente: vi.fn(), cnpj: vi.fn(), cep: vi.fn() }));
vi.mock("@/app/(protegido)/vendas/pedidos/cadastro-cliente-actions", () => ({ buscarCnpjPedidoAction: sim.cnpj, buscarCepPedidoAction: sim.cep }));
vi.mock("@/app/(protegido)/vendas/clientes/cadastro-actions", () => ({ buscarCnpjClienteAction: sim.cnpj, buscarCepClienteAction: sim.cep }));
vi.mock("@/lib/vendas/cliente-identidade-http", () => ({ consultarIdentidadeClientePedido: sim.pedido, consultarIdentidadeClienteCadastro: sim.cliente }));
const livre = { email: false, documento: false };
const inicial = (): ClienteEntrada => ({ ...novoClientePedido(), tipoEscolhido: true });
function Formulario({ cliente = inicial(), contexto = "pedido", somenteLeitura = false, emailSomenteLeitura = false, consultarIdentidade }: { cliente?: ClienteEntrada; contexto?: "pedido" | "cliente"; somenteLeitura?: boolean; emailSomenteLeitura?: boolean; consultarIdentidade?: ConsultarIdentidadeCliente }) {
  const [valor, alterar] = useState(cliente);
  return contexto === "cliente" ? <CamposClienteVenda cliente={valor} onChange={alterar} somenteLeitura={somenteLeitura} /> : <CadastroClientePedido valor={valor} alterar={alterar} somenteLeitura={somenteLeitura} emailSomenteLeitura={emailSomenteLeitura} consultarIdentidade={consultarIdentidade} />;
}
const gerais = () => within(screen.getByRole("heading", { name: "Informações gerais" }).closest("section")!);
const email = () => gerais().getByRole("textbox", { name: "E-mail" }) as HTMLInputElement;
beforeEach(() => {
  vi.useFakeTimers();
  sim.pedido.mockReset().mockResolvedValue(livre);
  sim.cliente.mockReset().mockResolvedValue(livre);
  sim.cnpj.mockReset().mockResolvedValue({ erro: "Consulta sintética indisponível" });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const esperarConsulta = () => act(async () => { await vi.advanceTimersByTimeAsync(350); });

describe("aviso de identidade no preenchimento", () => {
  it.each(["pedido", "cliente"] as const)("mostra duplicidade de e-mail antes de salvar no contexto %s", async contexto => {
    const consultar = contexto === "pedido" ? sim.pedido : sim.cliente;
    consultar.mockResolvedValue({ email: true, documento: false });
    render(<Formulario contexto={contexto} cliente={contexto === "cliente" ? novoClienteVenda() : novoClientePedido()} />);
    fireEvent.change(email(), { target: { value: "  Pessoa@Example.Invalid " } });
    await act(async () => { await vi.advanceTimersByTimeAsync(349); });
    expect(consultar).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(consultar).toHaveBeenCalledExactlyOnceWith({ clienteId: "", email: "pessoa@example.invalid", documento: null, tipo: "PF" }, expect.any(AbortSignal));
    expect(screen.getByRole("alert").textContent).toContain("Já existe um cliente com este e-mail");
    expect(email().getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(email().getAttribute("aria-describedby")!)?.textContent).toContain("cadastro existente");
    expect(email().validity.customError).toBe(true);
    expect(email().value).toContain("Pessoa@Example.Invalid");
    expect(contexto === "pedido" ? sim.cliente : sim.pedido).not.toHaveBeenCalled();
  });
  it("consulta no blur sem esperar o intervalo e não repete a mesma consulta", async () => {
    sim.pedido.mockResolvedValue({ email: true, documento: false });
    render(<Formulario />);
    fireEvent.change(email(), { target: { value: "pessoa@example.invalid" } });
    await act(async () => { fireEvent.blur(email()); });
    expect(screen.getByRole("alert").textContent).toContain("e-mail");
    await esperarConsulta();
    fireEvent.blur(email());
    expect(sim.pedido).toHaveBeenCalledTimes(1);
  });
  it.each([["PF", "123.456.789-09", "12345678909", "CPF"], ["PJ", "11.222.333/0001-81", "11222333000181", "CNPJ *"]] as const)("consulta documento completo e mantém a máscara %s", async (tipo, formatado, digitos, rotulo) => {
    sim.pedido.mockResolvedValue({ email: false, documento: true });
    render(<Formulario cliente={{ ...inicial(), tipo }} />);
    const documento = gerais().getByRole("textbox", { name: rotulo }) as HTMLInputElement;
    fireEvent.change(documento, { target: { value: formatado } });
    await esperarConsulta();
    expect(sim.pedido).toHaveBeenCalledExactlyOnceWith({ clienteId: "", email: null, documento: digitos, tipo }, expect.any(AbortSignal));
    expect(documento.value).toBe(formatado);
    expect(documento.validity.customError).toBe(true);
    expect(documento.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toContain(tipo === "PF" ? "CPF" : "CNPJ");
  });
  it("não consulta identificadores incompletos e cancela a espera quando o campo é apagado", async () => {
    render(<Formulario />);
    fireEvent.change(email(), { target: { value: "pessoa@" } });
    fireEvent.change(gerais().getByRole("textbox", { name: "CPF" }), { target: { value: "1234567890" } });
    await esperarConsulta();
    expect(sim.pedido).not.toHaveBeenCalled();
    fireEvent.change(email(), { target: { value: "pessoa@example.invalid" } });
    fireEvent.change(email(), { target: { value: "" } });
    await esperarConsulta();
    expect(sim.pedido).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("retira o erro anterior ao editar e conserva os outros dados preenchidos", async () => {
    sim.pedido.mockResolvedValueOnce({ email: true, documento: false });
    render(<Formulario cliente={{ ...inicial(), nome: "Pessoa Fictícia", telefone: "+5511999991234" }} />);
    fireEvent.change(email(), { target: { value: "pessoa@example.invalid" } });
    await esperarConsulta();
    expect(email().validity.customError).toBe(true);
    fireEvent.change(email(), { target: { value: "outra@example.invalid" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(email().validity.customError).toBe(false);
    await esperarConsulta();
    expect(gerais().getByRole("textbox", { name: "Nome Completo *" })).toHaveProperty("value", "Pessoa Fictícia");
    expect(gerais().getByRole("textbox", { name: "Telefone *" })).toHaveProperty("value", "+55 (11) 99999-1234");
  });
  it("informa falha sem apresentar cadastro livre ou remover o preenchimento", async () => {
    sim.pedido.mockRejectedValue(new Error("Falha sintética"));
    render(<Formulario cliente={{ ...inicial(), email: "pessoa@example.invalid" }} />);
    await esperarConsulta();
    expect(screen.getByRole("status").textContent).toContain("Não foi possível verificar o cadastro");
    expect(email().value).toBe("pessoa@example.invalid");
    expect(email().validity.customError).toBe(false);
    expect(email().getAttribute("aria-invalid")).toBeNull();
  });
  it("pula campos somente leitura e mantém e-mail do cliente selecionado protegido", async () => {
    const { unmount } = render(<Formulario cliente={{ ...inicial(), email: "pessoa@example.invalid", documento: "12345678909" }} somenteLeitura />);
    await esperarConsulta();
    expect(sim.pedido).not.toHaveBeenCalled();
    unmount();
    render(<Formulario cliente={{ ...inicial(), id: "cliente-ficticio", email: "pessoa@example.invalid", documento: "12345678909" }} emailSomenteLeitura />);
    await esperarConsulta();
    expect(sim.pedido).toHaveBeenCalledExactlyOnceWith({ clienteId: "cliente-ficticio", email: null, documento: "12345678909", tipo: "PF" }, expect.any(AbortSignal));
    expect(email().readOnly).toBe(true);
  });
  it("consulta o documento legado formatado sem tratar pontuação como outra identidade", async () => {
    render(<Formulario cliente={{ ...inicial(), id: "legado-ficticio", documento: "123.456.789-09" }} />);
    await esperarConsulta();
    expect(sim.pedido).toHaveBeenCalledExactlyOnceWith({ clienteId: "legado-ficticio", email: null, documento: "12345678909", tipo: "PF" }, expect.any(AbortSignal));
  });
  it("avisa CNPJ duplicado mesmo enquanto a consulta externa de razão social e endereço continua pendente", async () => {
    const http = await vi.importActual<typeof import("@/lib/vendas/cliente-identidade-http")>("@/lib/vendas/cliente-identidade-http");
    const buscar = vi.fn().mockResolvedValue(Response.json({ email: false, documento: true }));
    vi.stubGlobal("fetch", buscar);
    sim.cnpj.mockImplementation(() => new Promise(() => {}));
    render(<Formulario cliente={{ ...inicial(), tipo: "PJ" }} consultarIdentidade={http.consultarIdentidadeClientePedido} />);
    const documento = gerais().getByRole("textbox", { name: "CNPJ *" }) as HTMLInputElement;
    fireEvent.change(documento, { target: { value: "11222333000181" } });
    expect(sim.cnpj).toHaveBeenCalledExactlyOnceWith("11222333000181");
    expect(documento.readOnly).toBe(true);
    await esperarConsulta();
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(JSON.parse(buscar.mock.calls[0][1].body)).toMatchObject({ contexto: "PEDIDOS", documento: "11222333000181" });
    expect(screen.getByRole("alert").textContent).toContain("Já existe um cliente com este CNPJ");
    expect(documento.readOnly).toBe(true);
    expect(documento.value).toBe("11.222.333/0001-81");
  });
});

describe("respostas fora de ordem", () => {
  it("ignora resposta de identificação anterior após editar, trocar cliente ou desmontar", async () => {
    const pendentes: ((valor: ConflitosIdentidadeCliente) => void)[] = [];
    const consultar = vi.fn().mockImplementation(() => new Promise<ConflitosIdentidadeCliente>(resolve => { pendentes.push(resolve); }));
    const { result, rerender, unmount } = renderHook(({ cliente }) => useIdentidadeCliente(cliente, consultar), { initialProps: { cliente: { ...inicial(), email: "primeiro@example.invalid" } } });
    await esperarConsulta();
    const primeiroSinal = consultar.mock.calls[0][1] as AbortSignal;
    rerender({ cliente: { ...inicial(), email: "segundo@example.invalid" } });
    expect(primeiroSinal.aborted).toBe(true);
    await esperarConsulta();
    await act(async () => { pendentes[1](livre); pendentes[0]({ email: true, documento: true }); });
    expect(result.current.email.mensagem).toBe("");
    rerender({ cliente: { ...inicial(), id: "selecionado", email: "segundo@example.invalid" } });
    await esperarConsulta();
    expect(consultar.mock.lastCall?.[0]).toHaveProperty("clienteId", "selecionado");
    unmount();
    await act(async () => { pendentes[2]({ email: true, documento: true }); });
  });
});
