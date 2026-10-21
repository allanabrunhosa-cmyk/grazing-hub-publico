import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { validarCliente, validarRegrasPagamentoCliente } from "@/lib/vendas/dominio";
import { exigirFormaPagamentoCliente, exigirLimiteCreditoCliente, exigirVencimentoBoletoCliente, saldoDevedorCliente } from "@/lib/vendas/pedidos-regras-pagamento";

const sim = vi.hoisted(() => ({ tx: { $queryRaw: vi.fn(), clienteVenda: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() }, formaPagamentoVenda: { count: vi.fn() }, historicoCadastroVenda: { create: vi.fn() } } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { clienteVenda: sim.tx.clienteVenda, $transaction: (operacao: (tx: unknown) => unknown) => operacao(sim.tx) } }));
import { salvarCliente, salvarClienteNaTransacao } from "@/lib/vendas/persistencia";

const principal = { nome: "Principal", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "42", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const entrada = { id: "", versao: 0, nome: "Cliente sintético", tipo: "PF", documento: null, email: null, telefone: null, contato: null, observacoes: null, enderecos: [principal], ativo: true };
const entradaNova = { ...entrada, email: "cliente-pagamento@example.invalid" };
const semLimites = { formasPagamentoIds: null, boletoDiasAposEntrega: null, limiteCreditoAberto: null };
const moeda = (valor: string) => new Prisma.Decimal(valor);
const pedido = { previsaoData: new Date("2026-10-01T00:00:00Z"), confirmadoEm: null, fusoHorario: "America/Sao_Paulo" };
const dia = (valor: string) => new Date(`${valor}T12:00:00`);

describe("Regras comerciais de pagamento por cliente", () => {
  it("distingue omissão legada, ausência de limite, nenhuma forma e crédito zero", () => {
    expect(validarCliente(entrada)).not.toHaveProperty("regrasPagamento");
    expect(validarRegrasPagamentoCliente(semLimites)).toEqual(semLimites);
    expect(validarRegrasPagamentoCliente({ formasPagamentoIds: [], boletoDiasAposEntrega: 0, limiteCreditoAberto: "0" })).toEqual({ formasPagamentoIds: [], boletoDiasAposEntrega: 0, limiteCreditoAberto: "0" });
  });
  it.each([
    [{ ...semLimites, formasPagamentoIds: ["pix", "pix"] }, "repetidos"],
    [{ ...semLimites, formasPagamentoIds: [""] }, "Forma de pagamento"],
    [{ ...semLimites, boletoDiasAposEntrega: -1 }, "inteiro"],
    [{ ...semLimites, boletoDiasAposEntrega: 1.5 }, "inteiro"],
    [{ ...semLimites, boletoDiasAposEntrega: 3651 }, "3650"],
    [{ ...semLimites, limiteCreditoAberto: "1.001" }, "duas casas"],
    [{ ...semLimites, limiteCreditoAberto: "-1" }, "não negativo"],
  ])("rejeita regra inválida %#", (regra, mensagem) => {
    expect(() => validarRegrasPagamentoCliente(regra)).toThrow(mensagem);
  });
  it("aceita centavos sem arredondar e normaliza vírgula", () => {
    expect(validarRegrasPagamentoCliente({ ...semLimites, limiteCreditoAberto: "123,45" }).limiteCreditoAberto).toBe("123.45");
  });
  it("conserva os campos cadastrais e endereços internacionais ao validar regras", () => {
    const cadastro = { ...entrada, primeiroNome: "Cliente", sobrenome: "Fictício", razaoSocial: "Empresa fictícia", inscricaoEstadual: "ISENTO", dataNascimento: "1990-01-01",
      enderecos: [{ nome: "Cobrança", destinatario: "", pais: "Argentina", cep: "C1000", logradouro: "Rua fictícia", numero: "1", complemento: "Sala 2", bairro: "Centro", cidade: "Cidade fictícia", uf: "Buenos Aires" }], regrasPagamento: semLimites };
    expect(validarCliente(cadastro)).toMatchObject({ primeiroNome: cadastro.primeiroNome, sobrenome: cadastro.sobrenome, razaoSocial: cadastro.razaoSocial,
      inscricaoEstadual: cadastro.inscricaoEstadual, dataNascimento: cadastro.dataNascimento, regrasPagamento: semLimites,
      enderecos: [{ pais: "Argentina", cep: "C1000", uf: "BUENOS AIRES" }] });
  });
  it("permite somente as formas escolhidas e preserva null irrestrito", () => {
    expect(() => exigirFormaPagamentoCliente({ formasPagamentoHabilitadas: null }, "pix")).not.toThrow();
    expect(() => exigirFormaPagamentoCliente({ formasPagamentoHabilitadas: ["pix"] }, "pix")).not.toThrow();
    expect(() => exigirFormaPagamentoCliente({ formasPagamentoHabilitadas: ["pix"] }, "boleto")).toThrow("não está habilitada");
    expect(() => exigirFormaPagamentoCliente({ formasPagamentoHabilitadas: [] }, "pix")).toThrow("não está habilitada");
  });
  it("aceita vencimento no último dia permitido e bloqueia o seguinte", () => {
    expect(() => exigirVencimentoBoletoCliente({ boletoDiasAposEntrega: 7 }, pedido, dia("2026-10-08"))).not.toThrow();
    expect(() => exigirVencimentoBoletoCliente({ boletoDiasAposEntrega: 7 }, pedido, dia("2026-10-09"))).toThrow("prazo máximo");
    expect(() => exigirVencimentoBoletoCliente({ boletoDiasAposEntrega: 0 }, pedido, dia("2026-10-02"))).toThrow("prazo máximo");
  });
  it("usa data civil agendada e o dia da confirmação no fuso para imediato", () => {
    const imediato = { ...pedido, previsaoData: null, confirmadoEm: new Date("2026-10-02T01:00:00Z") };
    expect(() => exigirVencimentoBoletoCliente({ boletoDiasAposEntrega: 0 }, imediato, dia("2026-10-01"))).not.toThrow();
    expect(() => exigirVencimentoBoletoCliente({ boletoDiasAposEntrega: 0 }, imediato, dia("2026-10-02"))).toThrow("prazo máximo");
    expect(() => exigirVencimentoBoletoCliente({ boletoDiasAposEntrega: null }, pedido, dia("2030-01-01"))).not.toThrow();
  });
  it("usa a entrega realizada quando já existe", () => {
    expect(() => exigirVencimentoBoletoCliente({ boletoDiasAposEntrega: 0 }, { ...pedido, entregueEm: new Date("2026-10-03T15:00:00Z") }, dia("2026-10-03"))).not.toThrow();
  });
  it("compara exposição total com precisão de centavos e não cobra duas vezes o pedido revisado", () => {
    expect(() => exigirLimiteCreditoCliente(moeda("100.00"), moeda("40.00"), moeda("60.00"))).not.toThrow();
    expect(() => exigirLimiteCreditoCliente(moeda("100.00"), moeda("40.01"), moeda("60.00"))).toThrow("limite total");
    expect(() => exigirLimiteCreditoCliente(moeda("100.00"), moeda("90.00"), moeda("40.00"), moeda("30.00"))).not.toThrow();
    expect(() => exigirLimiteCreditoCliente(moeda("100.00"), moeda("90.00"), moeda("40.01"), moeda("30.00"))).toThrow("limite total");
  });
  it("zero impede nova dívida, redução de dívida anterior permanece permitida", () => {
    expect(() => exigirLimiteCreditoCliente(moeda("0"), moeda("0"), moeda("0.01"))).toThrow("limite total");
    expect(() => exigirLimiteCreditoCliente(moeda("0"), moeda("100"), moeda("50"), moeda("100"))).not.toThrow();
    expect(() => exigirLimiteCreditoCliente(null, moeda("999"), moeda("999"))).not.toThrow();
  });
  it("separa a dívida do cliente da obrigação de repasse do intermediador", () => {
    expect(saldoDevedorCliente(moeda("150"), moeda("100"), moeda("40")).toFixed(2)).toBe("90.00");
    expect(saldoDevedorCliente(moeda("60"), moeda("100"), moeda("40")).toFixed(2)).toBe("0.00");
  });
});

describe("Persistência das regras de pagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sim.tx.$queryRaw.mockResolvedValue([]);
    sim.tx.clienteVenda.findUnique.mockResolvedValue({ ...entrada, id: "cliente", versao: 1, email: null, formasPagamentoHabilitadas: ["pix"], boletoDiasAposEntrega: 3, limiteCreditoAberto: moeda("100") });
    sim.tx.clienteVenda.update.mockResolvedValue({ id: "cliente", versao: 2 });
    sim.tx.clienteVenda.create.mockResolvedValue({ id: "novo", versao: 1 });
    sim.tx.formaPagamentoVenda.count.mockResolvedValue(1);
  });
  it("preserva restrições omitidas por edição legada sem e-mail e mantém auditoria", async () => {
    await salvarCliente({ ...entrada, id: "cliente", versao: 1 }, { userId: "autor", nome: "Autor sintético" });
    const dados = sim.tx.clienteVenda.update.mock.calls[0][0].data;
    expect(dados).not.toHaveProperty("formasPagamentoHabilitadas");
    expect(dados).not.toHaveProperty("boletoDiasAposEntrega");
    expect(dados).not.toHaveProperty("limiteCreditoAberto");
    expect(dados.versao).toEqual({ increment: 1 });
    expect(dados.email).toBeNull();
    expect(sim.tx.historicoCadastroVenda.create).toHaveBeenCalledOnce();
  });
  it("salva regras explícitas e valida identificadores no banco", async () => {
    await salvarCliente({ ...entradaNova, regrasPagamento: { formasPagamentoIds: ["pix"], boletoDiasAposEntrega: 3, limiteCreditoAberto: "100.10" } }, { userId: "autor", nome: "Autor sintético" });
    expect(sim.tx.clienteVenda.create.mock.calls[0][0].data).toMatchObject({ formasPagamentoHabilitadas: ["pix"], boletoDiasAposEntrega: 3, limiteCreditoAberto: "100.10" });
    expect(sim.tx.formaPagamentoVenda.count).toHaveBeenCalledWith({ where: { id: { in: ["pix"] } } });
  });
  it("mantém o contrato transacional do cadastro inline e converte o aniversário", async () => {
    await salvarClienteNaTransacao(sim.tx as unknown as Prisma.TransactionClient, { ...entradaNova, primeiroNome: "Cliente", sobrenome: "Fictício", dataNascimento: "1990-01-01", regrasPagamento: semLimites }, { userId: "autor", nome: "Autor sintético" });
    expect(sim.tx.clienteVenda.create.mock.calls[0][0].data).toMatchObject({ primeiroNome: "Cliente", sobrenome: "Fictício", dataNascimento: new Date("1990-01-01T00:00:00Z"),
      formasPagamentoHabilitadas: Prisma.DbNull, boletoDiasAposEntrega: null, limiteCreditoAberto: null });
    expect(sim.tx.historicoCadastroVenda.create).toHaveBeenCalledOnce();
  });
  it("permite remover restrições explicitamente e distingue nenhuma forma habilitada", async () => {
    await salvarCliente({ ...entrada, id: "cliente", versao: 1, regrasPagamento: semLimites }, { userId: "autor", nome: "Autor sintético" });
    expect(sim.tx.clienteVenda.update.mock.calls[0][0].data).toMatchObject({ formasPagamentoHabilitadas: Prisma.DbNull, boletoDiasAposEntrega: null, limiteCreditoAberto: null });
    await salvarCliente({ ...entradaNova, regrasPagamento: { ...semLimites, formasPagamentoIds: [] } }, { userId: "autor", nome: "Autor sintético" });
    expect(sim.tx.clienteVenda.create.mock.calls[0][0].data.formasPagamentoHabilitadas).toEqual([]);
  });
  it("recusa formas inexistentes e versão desatualizada sem gravar", async () => {
    sim.tx.formaPagamentoVenda.count.mockResolvedValue(0);
    await expect(salvarCliente({ ...entradaNova, regrasPagamento: { ...semLimites, formasPagamentoIds: ["inexistente"] } }, { userId: "autor", nome: "Autor sintético" })).rejects.toThrow("indisponíveis");
    await expect(salvarCliente({ ...entrada, id: "cliente", versao: 0 }, { userId: "autor", nome: "Autor sintético" })).rejects.toThrow("outra tela");
    expect(sim.tx.clienteVenda.create).not.toHaveBeenCalled();
    expect(sim.tx.clienteVenda.update).not.toHaveBeenCalled();
  });
});
