import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const sim = vi.hoisted(() => ({
  clientes: vi.fn(), formas: vi.fn(), resumos: vi.fn(), creditos: vi.fn(),
  contarPedidos: vi.fn(), pedidos: vi.fn(), exigir: vi.fn(), loja: vi.fn(), destino: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.exigir }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  clienteVenda: { findMany: sim.clientes, findUnique: sim.destino }, formaPagamentoVenda: { findMany: sim.formas },
  pedidoVenda: { groupBy: sim.resumos, count: sim.contarPedidos, findMany: sim.pedidos },
  creditoClienteMovimento: { findMany: sim.creditos },
  configuracaoLoja: { findUnique: sim.loja },
  $queryRaw: sim.pedidos,
} }));

import { consultarClientesVenda, consultarDestinoClienteUnificado, consultarHistoricoPedidosCliente } from "@/lib/vendas/clientes-consulta";
import { consultarHistoricoPedidosClienteAction } from "@/app/(protegido)/vendas/clientes/historico-actions";

const cliente = {
  id: "cliente-teste", versao: 1, nome: "Cliente fictício", tipo: "PF", documento: null,
  primeiroNome: "Cliente", sobrenome: "fictício", razaoSocial: null, inscricaoEstadual: null,
  dataNascimento: new Date("1990-01-02T00:00:00Z"),
  email: null, telefone: null, contato: null, observacoes: null, enderecos: [], ativo: true,
  formasPagamentoHabilitadas: ["pix-teste"], boletoDiasAposEntrega: 15,
  limiteCreditoAberto: new Prisma.Decimal("1234.56"),
};

beforeEach(() => {
  vi.resetAllMocks();
  sim.clientes.mockResolvedValue([cliente]);
  sim.formas.mockResolvedValue([{ id: "pix-teste", nome: "PIX fictício", tipo: "PIX", ativo: false }]);
  sim.resumos.mockResolvedValue([]);
  sim.creditos.mockResolvedValue([]);
  sim.contarPedidos.mockResolvedValue(0);
  sim.pedidos.mockResolvedValue([]);
  sim.exigir.mockResolvedValue({ userId: "usuario-teste" });
  sim.loja.mockResolvedValue({ fusoHorario: "America/Manaus" });
  sim.destino.mockResolvedValue(null);
});

describe("consulta de clientes", () => {
  it("resolve alias somente pela FK e consulta só o identificador, sem contatos ou inferência", async () => {
    sim.destino.mockResolvedValue({ unificadoEmId: "empresa-canonica" });
    expect(await consultarDestinoClienteUnificado("alias-antigo")).toBe("empresa-canonica");
    expect(sim.destino).toHaveBeenCalledWith({ where: { id: "alias-antigo" }, select: { unificadoEmId: true } });
    sim.destino.mockResolvedValue({ unificadoEmId: null });
    expect(await consultarDestinoClienteUnificado("cliente-separado")).toBeNull();
    sim.destino.mockClear(); expect(await consultarDestinoClienteUnificado("<invalido>")).toBeNull(); expect(sim.destino).not.toHaveBeenCalled();
  });
  it("preserva campos de identidade do novo pedido, data civil e país do endereço", async () => {
    const endereco = { nome: "Internacional", destinatario: "Cliente fictício", pais: "Portugal", cep: "1000-001", logradouro: "Rua fictícia", numero: "12", complemento: "", bairro: "Centro", cidade: "Lisboa", uf: "Lisboa" };
    sim.clientes.mockResolvedValue([{ ...cliente, tipo: "PJ", razaoSocial: "Empresa fictícia", inscricaoEstadual: "ISENTO", enderecos: [endereco] }]);
    const resultado = await consultarClientesVenda({ verPedidos: false, verCredito: false });
    expect(sim.clientes).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ primeiroNome: true, sobrenome: true, razaoSocial: true, inscricaoEstadual: true, dataNascimento: true }) }));
    expect(resultado.clientes[0]).toMatchObject({ primeiroNome: "Cliente", sobrenome: "fictício", razaoSocial: "Empresa fictícia", inscricaoEstadual: "ISENTO", dataNascimento: "1990-01-02", enderecos: [endereco] });
  });

  it("conserva os campos opcionais de cadastros legados sem inventar nascimento ou identidade", async () => {
    sim.clientes.mockResolvedValue([{ ...cliente, primeiroNome: null, sobrenome: null, razaoSocial: null, inscricaoEstadual: null, dataNascimento: null }]);
    const resultado = await consultarClientesVenda({ verPedidos: false, verCredito: false });
    expect(resultado.clientes[0]).toMatchObject({ primeiroNome: null, sobrenome: null, razaoSocial: null, inscricaoEstadual: null, dataNascimento: null });
  });

  it("carrega a base completa para busca e paginação local e conserva regras e formas inativas", async () => {
    sim.clientes.mockResolvedValue(Array.from({ length: 70 }, (_, i) => ({ ...cliente, id: `cliente-${i}` })));
    const resultado = await consultarClientesVenda({ verPedidos: true, verCredito: false });
    expect(resultado.clientes).toHaveLength(70);
    const consulta = sim.clientes.mock.calls[0][0];
    expect(consulta).not.toHaveProperty("take");
    expect(consulta).not.toHaveProperty("skip");
    expect(consulta.where).toEqual({ unificadoEmId: null });
    expect(resultado.clientes[0]).toMatchObject({
      regrasPagamento: { formasPagamentoIds: ["pix-teste"], boletoDiasAposEntrega: 15, limiteCreditoAberto: "1234.56" },
      resumoPedidos: { ultimoPedido: null, quantidadePedidos: 0, valorTotalGasto: "0.00" },
    });
    expect(resultado.formasPagamento[0].ativo).toBe(false);
    expect(resultado.fusoHorario).toBe("America/Manaus");
  });

  it("envia só contatos ativos com campos de consulta, sem proveniência ou cadastro mesclado", async () => {
    const contato = { id: "contato-teste", nome: "Pessoa Sintética", primeiroNome: "Pessoa", sobrenome: "Sintética", email: "pessoa@example.invalid", telefone: "+551100001234" };
    sim.clientes.mockResolvedValue([{ ...cliente, tipo: "PJ", contatosEmpresa: [contato] }]);
    const resultado = await consultarClientesVenda({ verPedidos: false, verCredito: false });
    expect(resultado.clientes[0].contatosEmpresa).toEqual([contato]);
    expect(sim.clientes).toHaveBeenCalledWith(expect.objectContaining({ where: { unificadoEmId: null }, select: expect.objectContaining({ contatosEmpresa: { where: { ativo: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, primeiroNome: true, sobrenome: true, email: true, telefone: true } } }) }));
  });

  it("inclui contatos ativos dos cadastros unificados sem mover sua origem", async () => {
    const contato = { id: "contato-alias", nome: "Contato Sintético", primeiroNome: "Contato", sobrenome: "Sintético", email: "contato@example.invalid", telefone: null };
    sim.clientes.mockResolvedValue([{ ...cliente, contatosEmpresa: [], clientesUnificados: [{ contatosEmpresa: [contato] }] }]);
    const resultado = await consultarClientesVenda({ verPedidos: false, verCredito: false });
    expect(resultado.clientes).toHaveLength(1);
    expect(resultado.clientes[0].contatosEmpresa).toEqual([contato]);
    expect(sim.clientes).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({
      clientesUnificados: { select: { email: true, tipo: true, documento: true, enderecos: true, contatosEmpresa: { where: { ativo: true }, orderBy: [{ nome: "asc" }, { id: "asc" }], select: { id: true, nome: true, primeiroNome: true, sobrenome: true, email: true, telefone: true } } } },
    }) }));
  });

  it("encontra a raiz pelos identificadores reservados dos aliases sem usar documentos de terceiros", async () => {
    sim.clientes.mockResolvedValue([{ ...cliente, clientesUnificados: [
      { email: " ANTIGO@EXAMPLE.INVALID ", tipo: "PF", documento: "123.456.789-01", enderecos: [] },
      { email: "antigo@example.invalid", tipo: "PJ", documento: null, enderecos: [{ tipo: "PJ", documento: "11.222.333/0001-81" }, { tipo: "PF", documento: "99999999999" }] },
    ] }]);
    const { clientes } = await consultarClientesVenda({ verPedidos: false, verCredito: false });
    expect(clientes).toHaveLength(1);
    expect(clientes[0].emailsAlternativos).toEqual(["antigo@example.invalid"]);
    expect(clientes[0].documentosAlternativos).toEqual(["12345678901", "11222333000181"]);
    expect(clientes[0].email).toBeNull();
  });

  it("exclui rascunhos e cancelados das métricas comerciais e mantém centavos", async () => {
    sim.resumos.mockImplementation(async ({ where }) => where.status === "CONFIRMADO" && where.dataCompra === null ? [{ clienteId: cliente.id, _count: { _all: 3 }, _sum: { total: new Prisma.Decimal("1000000000.01") }, _max: { confirmadoEm: new Date("2026-10-01T15:30:00Z") } }] : []);
    const { clientes } = await consultarClientesVenda({ verPedidos: true, verCredito: false });
    expect(sim.resumos).toHaveBeenCalledWith(expect.objectContaining({ where: { clienteId: { not: null }, status: "CONFIRMADO", dataCompra: null } }));
    expect(clientes[0].resumoPedidos).toEqual({ ultimoPedido: "2026-10-01T15:30:00.000Z", quantidadePedidos: 3, valorTotalGasto: "1000000000.01" });
  });

  it.each(["2026-09-30T02:30:00Z", "2026-10-02T02:30:00Z"])("soma histórico ativo uma vez e usa a maior data entre criação histórica e confirmação (%s)", async data => {
    sim.resumos.mockImplementation(async ({ where }) => where.status === "CONFIRMADO" && where.dataCompra !== null ? [] : where.status === "CONFIRMADO"
      ? [{ clienteId: cliente.id, _count: { _all: 1 }, _sum: { total: new Prisma.Decimal("0.10") }, _max: { confirmadoEm: new Date("2026-10-01T15:30:00Z") } }]
      : [{ clienteId: cliente.id, _count: { _all: 2 }, _sum: { total: new Prisma.Decimal("0.20") }, _max: { createdAt: new Date(data) } }]);
    const resultado = await consultarClientesVenda({ verPedidos: true, verCredito: false });
    expect(sim.resumos).toHaveBeenCalledTimes(3);
    expect(sim.resumos).toHaveBeenCalledWith({ by: ["clienteId"], where: { clienteId: { not: null }, status: "HISTORICO", OR: [{ origem: "HISTORICO_LEGADO" }, { referenciaOrigem: "grazing-legado-orders" }] }, _count: { _all: true }, _sum: { total: true }, _max: { createdAt: true } });
    expect(resultado.clientes[0].resumoPedidos).toEqual({ quantidadePedidos: 3, valorTotalGasto: "0.30", ultimoPedido: new Date(data) > new Date("2026-10-01T15:30:00Z") ? new Date(data).toISOString() : "2026-10-01T15:30:00.000Z" });
    expect(sim.creditos).not.toHaveBeenCalled();
  });

  it("inclui cliente só com histórico e conserva total zero sem inventar confirmação", async () => {
    sim.resumos.mockImplementation(async ({ where }) => where.status === "HISTORICO"
      ? [{ clienteId: cliente.id, _count: { _all: 1 }, _sum: { total: new Prisma.Decimal("0.00") }, _max: { createdAt: new Date("2026-09-01T02:59:59.999Z") } }] : []);
    const resultado = await consultarClientesVenda({ verPedidos: true, verCredito: false });
    expect(resultado.clientes[0].resumoPedidos).toEqual({ quantidadePedidos: 1, valorTotalGasto: "0.00", ultimoPedido: "2026-09-01T02:59:59.999Z" });
  });

  it.each(["2026-09-30", "2026-10-02"])("soma compras e legado uma vez, sem trocar compra por confirmação de hoje: %s", async dataCompra => {
    sim.resumos.mockImplementation(async ({ where }) => where.status !== "CONFIRMADO" ? [] : where.dataCompra === null
      ? [{ clienteId: cliente.id, _count: { _all: 1 }, _sum: { total: new Prisma.Decimal("0.10") }, _max: { confirmadoEm: new Date("2026-10-01T15:30:00Z") } }]
      : [{ clienteId: cliente.id, _count: { _all: 2 }, _sum: { total: new Prisma.Decimal("0.20") }, _max: { dataCompra: new Date(dataCompra + "T00:00:00Z") } }]);
    const { clientes } = await consultarClientesVenda({ verPedidos: true, verCredito: false });
    expect(clientes[0].resumoPedidos).toEqual({ quantidadePedidos: 3, valorTotalGasto: "0.30", ultimoPedido: dataCompra > "2026-10-01" ? dataCompra : "2026-10-01T15:30:00.000Z" });
    expect(sim.resumos).toHaveBeenCalledWith(expect.objectContaining({ where: { clienteId: { not: null }, status: "CONFIRMADO", dataCompra: { not: null } }, _max: { dataCompra: true } }));
  });

  it("não consulta nem envia métricas ou extrato sem suas permissões", async () => {
    const resultado = await consultarClientesVenda({ verPedidos: false, verCredito: false });
    expect(sim.resumos).not.toHaveBeenCalled();
    expect(sim.creditos).not.toHaveBeenCalled();
    expect(resultado.clientes[0].resumoPedidos).toBeNull();
    expect(resultado.creditos).toBeNull();
  });

  it("calcula o saldo do extrato com Decimal e conserva a origem do pedido", async () => {
    const movimento = { clienteId: cliente.id, data: new Date("2026-10-01T15:00:00Z"), pedidoAplicacao: null, tratamento: { pedido: { numero: 25 } }, motivo: "Motivo fictício", referenciaComunicacao: null };
    sim.creditos.mockResolvedValue([
      { ...movimento, id: "m1", tipo: "CONCESSAO", valor: new Prisma.Decimal("0.10") },
      { ...movimento, id: "m2", tipo: "LIBERACAO", valor: new Prisma.Decimal("0.20") },
      { ...movimento, id: "m3", tipo: "APLICACAO", valor: new Prisma.Decimal("0.05") },
    ]);
    const { creditos } = await consultarClientesVenda({ verPedidos: false, verCredito: true });
    expect(creditos?.[cliente.id].saldo).toBe(0.25);
    expect(creditos?.[cliente.id].movimentos).toHaveLength(3);
    expect(creditos?.[cliente.id].movimentos[0].pedidoNumero).toBe(25);
  });
});

describe("histórico de pedidos do cliente", () => {
  it("mantém pedidos declinados no histórico sem contabilizá-los nas métricas de confirmados", async () => {
    sim.contarPedidos.mockResolvedValue(1);
    sim.pedidos.mockResolvedValue([{ id: "declinado-teste", numero: 26, status: "DECLINADO", dataPedido: new Date("2026-10-01T15:00:00Z"), baseDataPedido: "CRIACAO", previsaoData: null, previsaoJanela: null, entregueEm: null, fusoHorario: "America/Sao_Paulo", total: new Prisma.Decimal("12.34") }]);
    const resultado = await consultarHistoricoPedidosCliente(cliente.id);
    expect(sim.contarPedidos).toHaveBeenCalledWith({ where: { clienteId: cliente.id, status: { not: "RASCUNHO" } } });
    expect(resultado.pedidos[0]).toMatchObject({ status: "DECLINADO", total: "12.34", previsaoData: null, entregueEm: null });
    await consultarClientesVenda({ verPedidos: true, verCredito: false });
    expect(sim.resumos).toHaveBeenCalledWith(expect.objectContaining({ where: { clienteId: { not: null }, status: "CONFIRMADO", dataCompra: null } }));
  });

  it("pagina sem truncamento silencioso e preserva data civil, janela e entrega efetiva", async () => {
    sim.contarPedidos.mockResolvedValue(70);
    sim.pedidos.mockResolvedValue([{
      id: "pedido-teste", numero: 25, status: "CANCELADO", previsaoData: new Date("2026-10-02T00:00:00Z"),
      dataPedido: new Date("2026-10-01T12:00:00Z"), baseDataPedido: "CONFIRMACAO",
      previsaoJanela: "14:00–16:00", entregueEm: new Date("2026-10-03T02:01:00Z"),
      fusoHorario: "America/Sao_Paulo", total: new Prisma.Decimal("999999.99"),
    }]);
    const resultado = await consultarHistoricoPedidosCliente(cliente.id, 999);
    expect(resultado).toMatchObject({ total: 70, pagina: 3, tamanhoPagina: 25 });
    const sql = sim.pedidos.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).toContain('ORDER BY "dataPedido" DESC, "id" DESC');
    expect(sql.sql).toContain('COALESCE("confirmadoEm", "createdAt")');
    expect(sql.sql).toContain('"status" <> \'RASCUNHO\'');
    expect(sql.values).toEqual(["grazing-legado-orders", "grazing-legado-orders", cliente.id, 25, 50]);
    expect(resultado.pedidos[0]).toMatchObject({
      status: "CANCELADO", previsaoData: "2026-10-02", previsaoJanela: "14:00–16:00",
      entregueEm: "2026-10-03T02:01:00.000Z", fusoHorario: "America/Sao_Paulo", total: "999999.99", dataPedido: "2026-10-01T12:00:00.000Z", baseDataPedido: "CONFIRMACAO",
    });
  });

  it.each([0, -1, 1.5, Number.NaN])("normaliza página inválida %s para a primeira", async pagina => {
    sim.contarPedidos.mockResolvedValue(70);
    expect((await consultarHistoricoPedidosCliente(cliente.id, pagina)).pagina).toBe(1);
    expect((sim.pedidos.mock.calls[0][0] as Prisma.Sql).values.slice(-2)).toEqual([25, 0]);
  });

  it("expõe número e data originais de histórico revertido sem criar entrega ou confirmação", async () => {
    sim.contarPedidos.mockResolvedValue(1);
    sim.pedidos.mockResolvedValue([{ id: "historico-teste", numero: -20001, origem: "HISTORICO_LEGADO", referenciaOrigem: "grazing-legado-orders", referenciaPedido: "20001", status: "HISTORICO_REVERTIDO", dataPedido: new Date("2026-09-01T02:59:59.999Z"), baseDataPedido: "CRIACAO_HISTORICA", previsaoData: null, previsaoJanela: null, entregueEm: null, fusoHorario: "America/Sao_Paulo", total: new Prisma.Decimal("0.30") }]);
    const resultado = await consultarHistoricoPedidosCliente(cliente.id);
    expect(resultado.pedidos[0]).toEqual({ id: "historico-teste", numero: 20001, status: "HISTORICO_REVERTIDO", dataPedido: "2026-09-01T02:59:59.999Z", baseDataPedido: "CRIACAO_HISTORICA", previsaoData: null, previsaoJanela: null, entregueEm: null, fusoHorario: "America/Sao_Paulo", total: "0.30" });
  });

  it.each(["vendas.clientes", "vendas.pedidos"])("exige %s na ação antes de acessar pedidos", async recurso => {
    sim.exigir.mockImplementation(async r => { if (r === recurso) throw new Error("SEM_ACESSO"); return {}; });
    await expect(consultarHistoricoPedidosClienteAction(cliente.id)).rejects.toThrow("SEM_ACESSO");
    expect(sim.contarPedidos).not.toHaveBeenCalled();
    expect(sim.pedidos).not.toHaveBeenCalled();
  });

  it("rejeita identidade inválida e não revela erros privados da consulta", async () => {
    expect(await consultarHistoricoPedidosClienteAction("../invalido")).toHaveProperty("erro");
    expect(sim.contarPedidos).not.toHaveBeenCalled();
    sim.contarPedidos.mockRejectedValue(new Error("informação privada do banco"));
    expect(await consultarHistoricoPedidosClienteAction(cliente.id)).toEqual({ erro: "Não foi possível consultar os pedidos. Tente novamente." });
  });
});
