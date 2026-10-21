import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";

const sim = vi.hoisted(() => ({ banco: null as unknown as Prisma.TransactionClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return { $transaction: async (executar: (tx: Prisma.TransactionClient) => unknown) => executar(sim.banco) }; } }));
vi.mock("@/lib/ifood/acompanhamento", () => ({ exigirEfeitoOperacional: async () => undefined }));
import { calcularPedido, criarRascunhoPedido, editarInformacoesPedido, salvarRascunhoPedido } from "@/lib/vendas/pedidos";
import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";

const postal = { nome: "Principal", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Sintética", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
const pf = { ...postal, tipo: "PF" as const, nomeCompleto: "Titular sintético", documento: "12345678901" };
const terceira = { ...postal, numero: "2", tipo: "PJ" as const, documento: "12345678000190", razaoSocial: "Terceira sintética", inscricaoEstadual: "ISENTO", inscricaoMunicipal: "42" };
const cadastro = () => ({ id: "cliente", ativo: true, unificadoEmId: null, tipo: "PF", nome: "Comprador sintético", documento: "99999999999" as string | null, razaoSocial: null, inscricaoEstadual: null, enderecos: [pf], email: null, telefone: null, contato: null });
const entrada = (selecionado = 0) => validarEntradaPedido({ clienteId: "cliente", canalId: "canal", atendimento: "RETIRADA", prazo: "IMEDIATO", enderecosCobranca: [terceira, terceira], cobrancaSelecionada: selecionado, itens: [{ itemOrigemId: "item", produtoId: "produto", quantidade: "1", escolhas: {}, precoManual: null }] });
const itemAnterior = { id: "item", produtoId: "produto", quantidade: "1", precoOriginal: "10.00", precoAplicado: "10.00", acrescimos: "0.00", escolhasSnapshot: [], produtoSnapshot: { nome: "Produto sintético" }, unidadeSnapshot: "UN", composicaoSnapshot: null, estadoComposicao: "PENDENTE" };
const sessao = { userId: "operador", versao: 0 } as SessaoAtual;

function banco(cliente: Omit<ReturnType<typeof cadastro>, "enderecos"> & { enderecos: unknown[] } = cadastro(), cobrancaSnapshot: unknown = null) {
  const pedido: Record<string, unknown> = { id: "pedido", numero: 1, versao: 2, status: "CONFIRMADO", origem: "LOCAL", modoFinanceiro: "EXTERNO", atendimento: "RETIRADA", compradorSnapshot: { tipo: "PF", nome: "Comprador histórico", documento: "11111111111" }, cobrancaSnapshot };
  const tx = {
    $executeRaw: vi.fn(async () => 1), $queryRaw: vi.fn(async () => []),
    usuario: { findUnique: vi.fn(async () => ({ id: "operador", nome: "Operador sintético", ativo: true, sessaoVersao: 0, perfilAcesso: { sistema: "ADMINISTRADOR" } })) },
    configuracaoLoja: { findUnique: vi.fn(async () => ({ fusoHorario: "America/Sao_Paulo" })) },
    clienteVenda: { findUnique: vi.fn(async () => cliente), findUniqueOrThrow: vi.fn(async () => cliente) },
    canalVenda: { findUnique: vi.fn(async () => ({ id: "canal", nome: "Canal sintético" })) },
    pedidoVenda: {
      findUnique: vi.fn(async () => pedido), findUniqueOrThrow: vi.fn(async () => pedido),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { Object.assign(pedido, data); return pedido; }),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { Object.assign(pedido, data); return { count: 1 }; }),
    },
    historicoPedidoVenda: { findUnique: vi.fn(async () => null), create: vi.fn(async () => ({})) },
  };
  sim.banco = tx as unknown as Prisma.TransactionClient;
  return { tx, pedido };
}
beforeEach(() => vi.clearAllMocks());

describe("Principal vinculada no servidor de pedidos", () => {
  it("bloqueia titular pendente derivado da cobrança legada quando o orçamento omite a seleção", async () => {
    const pendente = { ...postal, nome: "Cobrança", tipo: "PJ", titularPendente: true, documento: "", razaoSocial: "" };
    const { tx } = banco({ ...cadastro(), enderecos: [pf, pendente] });
    const recebido = validarEntradaPedido({ ...entrada(), enderecosCobranca: undefined, cobrancaSelecionada: undefined, cobranca: null });
    await expect(calcularPedido(sim.banco, recebido, undefined, [itemAnterior], true)).rejects.toThrow("Titular pendente. Confirme o CNPJ antes de faturar.");
    expect(tx.pedidoVenda.updateMany).not.toHaveBeenCalled(); expect(tx.historicoPedidoVenda.create).not.toHaveBeenCalled();
  });
  it("mantém cobrança legada completa quando o orçamento omite a seleção", async () => {
    banco({ ...cadastro(), enderecos: [pf, { ...terceira, nome: "Cobrança" }] });
    const recebido = validarEntradaPedido({ ...entrada(), enderecosCobranca: undefined, cobrancaSelecionada: undefined, cobranca: null });
    expect((await calcularPedido(sim.banco, recebido, undefined, [itemAnterior], true)).cobrancaSnapshot).toMatchObject({ tipo: "PJ", documento: terceira.documento, razaoSocial: terceira.razaoSocial });
  });
  it("permite pedido com Principal válida e adicional pendente não selecionado", async () => {
    const pendente = { ...postal, nome: "Cobrança 2", tipo: "PJ", titularPendente: true, documento: "", razaoSocial: "" };
    banco({ ...cadastro(), enderecos: [pf, pendente] });
    const recebido = validarEntradaPedido({ ...entrada(), enderecosCobranca: undefined, cobrancaSelecionada: undefined, cobranca: null });
    expect((await calcularPedido(sim.banco, recebido, undefined, [itemAnterior], true)).cobrancaSnapshot).toMatchObject({ tipo: "PF", documento: "99999999999", nomeCompleto: "Comprador sintético" });
  });
  it("substitui titular forjado da Principal pelo cadastro salvo e mantém seu endereço", async () => {
    const { tx } = banco();
    const recebido = entrada();
    const resultado = await calcularPedido(sim.banco, recebido, undefined, [itemAnterior], true);
    expect(resultado.cobrancaSnapshot).toMatchObject({ numero: "2", tipo: "PF", nomeCompleto: "Comprador sintético", documento: "99999999999", selecionado: 0 });
    expect(recebido.cobranca).toMatchObject({ tipo: "PJ" });
    expect(tx.clienteVenda.findUnique).toHaveBeenCalledOnce();
  });
  it("usa documento do JSON salvo quando o geral está vazio e ignora documento enviado pelo pedido", async () => {
    banco({ ...cadastro(), documento: null });
    expect((await calcularPedido(sim.banco, entrada(), undefined, [itemAnterior], true)).cobrancaSnapshot).toMatchObject({ nomeCompleto: "Comprador sintético", documento: pf.documento });
  });
  it("trata cobrança moderna avulsa como Principal ao gravar e confirmar", async () => {
    const { tx } = banco();
    const moderno = validarEntradaPedido({ ...entrada(), enderecosCobranca: undefined, cobrancaSelecionada: undefined, cobranca: terceira });
    await criarRascunhoPedido(moderno, "avulsa-principal-sintetica", sessao);
    expect(tx.pedidoVenda.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rascunho: expect.objectContaining({ cobrancaSelecionada: 0, enderecosCobranca: [expect.objectContaining({ tipo: "PF", documento: "99999999999", nomeCompleto: "Comprador sintético", numero: "2" })] }) }) }));
    expect((await calcularPedido(sim.banco, moderno, undefined, [itemAnterior], true)).cobrancaSnapshot).toMatchObject({ tipo: "PF", documento: "99999999999", nomeCompleto: "Comprador sintético", numero: "2", selecionado: 0, enderecos: [{ tipo: "PF", documento: "99999999999" }] });
  });
  it("conserva integralmente o titular adicional selecionado", async () => {
    banco();
    const recebido = entrada(1);
    const resultado = await calcularPedido(sim.banco, recebido, undefined, [itemAnterior], true);
    expect(resultado.cobrancaSnapshot).toMatchObject({ ...recebido.cobranca, nome: "Cobrança", selecionado: 1, enderecos: [{ tipo: "PF", documento: "99999999999" }, { tipo: "PJ", documento: terceira.documento }] });
  });
  it("vincula a Principal antes de gravar criação e alteração do orçamento", async () => {
    const { tx } = banco();
    await criarRascunhoPedido(entrada(), "criacao-principal-sintetica", sessao);
    expect(tx.pedidoVenda.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rascunho: expect.objectContaining({ cobranca: expect.objectContaining({ tipo: "PF", documento: "99999999999" }) }) }) }));
    await salvarRascunhoPedido("pedido", 2, entrada(), "edicao-principal-sintetica", sessao);
    expect(tx.pedidoVenda.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rascunho: expect.objectContaining({ cobranca: expect.objectContaining({ tipo: "PF", documento: "99999999999" }) }) }) }));
  });
  it("preserva identidade fotografada ao editar endereço da Principal, sem consultar o cliente atual", async () => {
    const { tx, pedido } = banco(cadastro(), { ...pf, selecionado: 0, enderecos: [pf, terceira] });
    await editarInformacoesPedido("pedido", 2, { cobranca: { ...terceira, numero: "99" }, motivo: "Correção sintética de endereço" }, "snapshot-principal-sintetico", sessao);
    expect(pedido.cobrancaSnapshot).toMatchObject({ tipo: "PF", nomeCompleto: pf.nomeCompleto, documento: pf.documento, numero: "99", selecionado: 0 });
    expect(tx.clienteVenda.findUnique).not.toHaveBeenCalled();
  });
  it("recupera Principal legada do comprador histórico sem usar cadastro atual", async () => {
    const { pedido } = banco(cadastro(), { ...postal, selecionado: 0, enderecos: [postal] });
    await editarInformacoesPedido("pedido", 2, { cobranca: { ...terceira, numero: "88" }, motivo: "Correção sintética legada" }, "snapshot-legado-sintetico", sessao);
    expect(pedido.cobrancaSnapshot).toMatchObject({ tipo: "PF", nomeCompleto: "Comprador histórico", documento: "11111111111", numero: "88" });
  });
  it("recusa remover a Principal fotografada antes de gravar efeitos", async () => {
    const { tx, pedido } = banco(cadastro(), { ...pf, selecionado: 0, enderecos: [pf] });
    await expect(editarInformacoesPedido("pedido", 2, { cobranca: null, motivo: "Remoção sintética forjada" }, "remover-principal-sintetica", sessao)).rejects.toThrow("A cobrança Principal não pode ser removida.");
    expect(pedido.cobrancaSnapshot).toMatchObject(pf);
    expect(tx.pedidoVenda.updateMany).not.toHaveBeenCalled();
    expect(tx.historicoPedidoVenda.create).not.toHaveBeenCalled();
  });
  it.each([1, undefined])("mantém edição independente de adicional ou cobrança sem índice (%s)", async selecionado => {
    const { pedido } = banco(cadastro(), { ...pf, ...(selecionado === undefined ? {} : { selecionado }), enderecos: [pf, terceira] });
    await editarInformacoesPedido("pedido", 2, { cobranca: terceira, motivo: "Correção sintética independente" }, `snapshot-independente-${String(selecionado)}`, sessao);
    expect(pedido.cobrancaSnapshot).toMatchObject({ tipo: "PJ", documento: terceira.documento, razaoSocial: terceira.razaoSocial });
  });
});
