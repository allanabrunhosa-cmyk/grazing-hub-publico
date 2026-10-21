import "dotenv/config";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { prisma } from "@/lib/prisma";
import { reagendarPedidoAction } from "@/app/(protegido)/compras/reagendar-pedido";
import { salvarPedidoAction, confirmarRecebimentoAction, reabrirPedidoAction, cancelarPedidoAction, excluirPedidoAction } from "@/app/(protegido)/compras/actions";
const { sessao } = vi.hoisted(() => ({ sessao: { userId: "", nome: "Teste Compras", email: "", admin: true } }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => sessao) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const entrada = { fornecedorId: null, fornecedorAvulso: "Loja avulsa de teste", usoConsumo: true, previsaoEntrega: "2026-09-10", observacoes: null,
  itens: [{ insumoId: null, descricao: "Papel para escritório", quantidade: 3, unidadeCompra: "UN" as const, precoUnitario: 9.5 }] };
let fornecedorId = "", insumoId = "";
async function criar() {
  const resultado = await salvarPedidoAction(entrada);
  if ("erro" in resultado) throw new Error(resultado.erro);
  return prisma.pedidoCompra.findUniqueOrThrow({ where: { id: resultado.pedidoId }, include: { itens: { where: { ativo: true } } } });
}
async function receber(pedido: Awaited<ReturnType<typeof criar>>) {
  return confirmarRecebimentoAction({ pedidoId: pedido.id, responsavel: "Equipe", dataRecebimento: "2026-09-10", itens: pedido.itens.map(i => ({ pedidoItemId: i.id, insumoId: i.insumoId, quantidadeRecebida: 3, lote: null, validade: null, qualidadeOk: true })) });
}
describe.skipIf(process.env.COMPRAS_BANCO_TESTE !== "1")("Compras no PostgreSQL local", () => {
  beforeAll(async () => {
    const endereco = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) throw new Error("Teste permitido somente no banco local.");
    const usuario = await prisma.usuario.create({ data: { nome: sessao.nome, email: "compras-teste-" + Date.now() + "@example.invalid", senhaHash: "conta-de-teste-sem-login" } });
    sessao.userId = usuario.id;
    fornecedorId = (await prisma.fornecedor.create({ data: { nome: "Fornecedor de teste " + usuario.id } })).id;
    insumoId = (await prisma.insumo.create({ data: { nome: "Insumo de teste", unidade: "UN", fornecedorPrincipalId: fornecedorId } })).id;
  });
  afterAll(async () => {
    if (!sessao.userId) return;
    const filtro = { pedido: { criadoPorId: sessao.userId } };
    await prisma.$transaction(async tx => {
      await tx.recebimentoDivergencia.deleteMany({ where: { recebimentoItem: { recebimento: filtro } } });
      await tx.recebimentoItem.deleteMany({ where: { recebimento: filtro } });
      await tx.recebimento.deleteMany({ where: filtro });
      await tx.pedidoCompraHistorico.deleteMany({ where: filtro });
      await tx.pedidoCompra.deleteMany({ where: { criadoPorId: sessao.userId } });
      await tx.cotacao.deleteMany({ where: { insumoId } });
      await tx.insumo.delete({ where: { id: insumoId } });
      await tx.fornecedor.delete({ where: { id: fornecedorId } });
      await tx.usuario.delete({ where: { id: sessao.userId } });
    });
    await prisma.$disconnect();
  });
  it("reagenda apenas a previsão, preserva itens e registra autoria e datas no histórico", async () => {
    const pedido = await criar();
    const entrada = { pedidoId: pedido.id, previsaoAnterior: "2026-09-10", previsaoEntrega: "2026-09-15" };
    expect(await reagendarPedidoAction(entrada)).toHaveProperty("ok", true);
    const atualizado = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: pedido.id }, include: { itens: true, historico: true } });
    expect(atualizado.previsaoEntrega?.toISOString().slice(0, 10)).toBe("2026-09-15");
    expect(atualizado.status).toBe(pedido.status);
    expect(atualizado.dataPedido).toEqual(pedido.dataPedido);
    expect(atualizado.itens).toEqual(pedido.itens);
    expect(atualizado.historico).toEqual([expect.objectContaining({ acao: "REAGENDAMENTO", usuarioId: sessao.userId, usuarioNome: sessao.nome, motivo: "Previsão de entrega: 10/09/2026 → 15/09/2026.", statusAnterior: "CONFIRMADO", statusNovo: "CONFIRMADO" })]);
    expect(await reagendarPedidoAction({ ...entrada, previsaoAnterior: "2026-09-15" })).toHaveProperty("ok", true);
    expect(await prisma.pedidoCompraHistorico.count({ where: { pedidoId: pedido.id } })).toBe(1);
  });
  it("rejeita datas inválidas e alterações concorrentes sem sobrescrever a primeira", async () => {
    const pedido = await criar();
    const entrada = { pedidoId: pedido.id, previsaoAnterior: "2026-09-10", previsaoEntrega: "2026-09-15" };
    for (const data of ["2026-02-30", "", "10/09/2026"]) expect(await reagendarPedidoAction({ ...entrada, previsaoEntrega: data })).toHaveProperty("erro");
    const respostas = await Promise.all([reagendarPedidoAction(entrada), reagendarPedidoAction({ ...entrada, previsaoEntrega: "2026-09-16" })]);
    expect(respostas.filter(r => "ok" in r)).toHaveLength(1);
    expect(respostas.filter(r => "erro" in r)).toHaveLength(1);
    expect(await prisma.pedidoCompraHistorico.count({ where: { pedidoId: pedido.id } })).toBe(1);
  });
  it("não permite reagendar recebidos, cancelados ou excluídos", async () => {
    for (const estado of ["recebido", "cancelado", "excluido"]) {
      const pedido = await criar();
      if (estado === "recebido") await receber(pedido);
      if (estado === "cancelado") await cancelarPedidoAction({ pedidoId: pedido.id, responsavel: "Teste", justificativa: "Teste reagendamento" });
      if (estado === "excluido") await excluirPedidoAction(pedido.id);
      expect(await reagendarPedidoAction({ pedidoId: pedido.id, previsaoAnterior: "2026-09-10", previsaoEntrega: "2026-09-16" })).toHaveProperty("erro");
      expect((await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: pedido.id } })).previsaoEntrega).toEqual(pedido.previsaoEntrega);
      expect(await prisma.pedidoCompraHistorico.count({ where: { pedidoId: pedido.id, acao: "REAGENDAMENTO" } })).toBe(0);
    }
  });
  it("agenda pedido que ainda não tinha previsão", async () => {
    const pedido = await criar();
    await prisma.pedidoCompra.update({ where: { id: pedido.id }, data: { previsaoEntrega: null } });
    expect(await reagendarPedidoAction({ pedidoId: pedido.id, previsaoAnterior: null, previsaoEntrega: "2026-09-16" })).toHaveProperty("ok", true);
    expect((await prisma.pedidoCompraHistorico.findFirstOrThrow({ where: { pedidoId: pedido.id } })).motivo).toContain("sem data → 16/09/2026");
  });
  it("cria e recebe uso e consumo avulso sem insumo, cotação, estoque ou financeiro", async () => {
    const antes = await Promise.all([prisma.movimentacaoEstoque.count(), prisma.lancamentoFinanceiro.count(), prisma.cotacao.count(), prisma.insumo.count()]);
    const pedido = await criar();
    expect(pedido).toMatchObject({ usoConsumo: true, fornecedorId: null, fornecedorAvulso: entrada.fornecedorAvulso });
    expect(pedido.itens[0]).toMatchObject({ insumoId: null, descricao: entrada.itens[0].descricao });
    expect(await receber(pedido)).toHaveProperty("ok", true);
    expect(await Promise.all([prisma.movimentacaoEstoque.count(), prisma.lancamentoFinanceiro.count(), prisma.cotacao.count(), prisma.insumo.count()])).toEqual(antes);
  });
  it("exclui preservando recebimentos, itens, status e autoria no histórico", async () => {
    const pedido = await criar();
    expect(await receber(pedido)).toHaveProperty("ok", true);
    const respostas = await Promise.all([excluirPedidoAction(pedido.id), excluirPedidoAction(pedido.id)]);
    expect(respostas.filter(r => "ok" in r)).toHaveLength(1);
    const excluido = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: pedido.id }, include: { itens: true, recebimentos: { include: { itens: true } }, historico: true } });
    expect(excluido.excluidoEm).toBeInstanceOf(Date);
    expect(excluido.status).toBe("RECEBIDO_TOTAL");
    expect(excluido.itens).toHaveLength(pedido.itens.length);
    expect(excluido.recebimentos).toHaveLength(1);
    expect(excluido.recebimentos[0].itens).toHaveLength(pedido.itens.length);
    expect(excluido.historico.filter(h => h.acao === "EXCLUSAO")).toEqual([expect.objectContaining({ usuarioId: sessao.userId, usuarioNome: sessao.nome, statusAnterior: "RECEBIDO_TOTAL", statusNovo: "RECEBIDO_TOTAL" })]);
    expect(await reabrirPedidoAction({ pedidoId: pedido.id, motivo: "Tentar reabrir excluído" })).toHaveProperty("erro");
    expect(await prisma.pedidoCompra.count({ where: { id: pedido.id, excluidoEm: null } })).toBe(0);
  });
  it("impede editar, receber ou cancelar um pedido excluído", async () => {
    const pedido = await criar();
    expect(await excluirPedidoAction(pedido.id)).toHaveProperty("ok", true);
    expect(await salvarPedidoAction({ ...entrada, pedidoId: pedido.id })).toHaveProperty("erro");
    expect(await receber(pedido)).toHaveProperty("erro");
    expect(await cancelarPedidoAction({ pedidoId: pedido.id, responsavel: "Ana", justificativa: "Teste" })).toHaveProperty("erro");
    expect(await prisma.recebimento.count({ where: { pedidoId: pedido.id } })).toBe(0);
    expect(await prisma.pedidoCompraHistorico.count({ where: { pedidoId: pedido.id } })).toBe(1);
  });
  it("mantém pedidos de estoque e o registro de cotação", async () => {
    const resultado = await salvarPedidoAction({ ...entrada, usoConsumo: false, fornecedorId, fornecedorAvulso: null, itens: [{ ...entrada.itens[0], insumoId }] });
    expect(resultado).toHaveProperty("ok", true);
    expect(await prisma.cotacao.count({ where: { insumoId, fornecedorId } })).toBe(1);
  });
  it("reabre, edita e recebe novamente mantendo as quantidades e descrições antigas", async () => {
    const pedido = await criar();
    await receber(pedido);
    expect(await reabrirPedidoAction({ pedidoId: pedido.id, motivo: "Corrigir itens conferidos" })).toEqual({ ok: true });
    const reaberto = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: pedido.id }, include: { recebimentos: true, historico: true } });
    expect(reaberto.status).toBe("CONFIRMADO");
    expect(reaberto.recebimentos[0].reabertoEm).not.toBeNull();
    expect(reaberto.historico.find(h => h.statusNovo === "CONFIRMADO")).toMatchObject({ usuarioId: sessao.userId, usuarioNome: sessao.nome, statusAnterior: "RECEBIDO_TOTAL", motivo: "Corrigir itens conferidos" });
    expect(await salvarPedidoAction({ ...entrada, pedidoId: pedido.id, itens: [{ ...entrada.itens[0], descricao: "Descrição corrigida", quantidade: 2 }] })).toHaveProperty("ok", true);
    const antigo = await prisma.pedidoCompraItem.findUniqueOrThrow({ where: { id: pedido.itens[0].id } });
    expect(antigo.ativo).toBe(false);
    expect(antigo.descricao).toBe("Papel para escritório");
    expect(Number(antigo.quantidade)).toBe(3);
    const atualizado = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: pedido.id }, include: { itens: { where: { ativo: true } } } });
    expect(await receber(atualizado)).toHaveProperty("ok", true);
    expect(await prisma.recebimento.count({ where: { pedidoId: pedido.id } })).toBe(2);
  });
  it("serializa dois recebimentos e duas reaberturas concorrentes", async () => {
    const pedido = await criar();
    const recebimentos = await Promise.all([receber(pedido), receber(pedido)]);
    expect(recebimentos.filter(r => "ok" in r)).toHaveLength(1);
    const reaberturas = await Promise.all([reabrirPedidoAction({ pedidoId: pedido.id, motivo: "Nova conferência" }), reabrirPedidoAction({ pedidoId: pedido.id, motivo: "Nova conferência" })]);
    expect(reaberturas.filter(r => "ok" in r)).toHaveLength(1);
    expect(await prisma.pedidoCompraHistorico.count({ where: { pedidoId: pedido.id, statusNovo: "CONFIRMADO" } })).toBe(1);
  });
  it("rejeita item de outro pedido, repetido ou omitido sem gravar recebimento", async () => {
    const pedido = await criar(), outro = await criar();
    const linha = { pedidoItemId: outro.itens[0].id, insumoId: null, quantidadeRecebida: 2, lote: null, validade: null, qualidadeOk: true };
    for (const itens of [[linha], [{ ...linha, pedidoItemId: pedido.itens[0].id }, { ...linha, pedidoItemId: pedido.itens[0].id }], []]) {
      expect(await confirmarRecebimentoAction({ pedidoId: pedido.id, responsavel: "Teste", dataRecebimento: "2026-09-10", itens })).toHaveProperty("erro");
    }
    expect(await prisma.recebimento.count({ where: { pedidoId: pedido.id } })).toBe(0);
  });
  it("rejeita estoque sem insumo, descrições vazias e datas inexistentes", async () => {
    expect(await salvarPedidoAction({ ...entrada, usoConsumo: false })).toHaveProperty("erro");
    expect(await salvarPedidoAction({ ...entrada, itens: [{ ...entrada.itens[0], descricao: " " }] })).toHaveProperty("erro");
    expect(await salvarPedidoAction({ ...entrada, previsaoEntrega: "2026-02-30" })).toHaveProperty("erro");
  });
  it("compra estoque de fornecedor avulso sem cadastrar fornecedor nem cotação", async () => {
    const antes = await Promise.all([prisma.fornecedor.count(), prisma.cotacao.count()]);
    const resultado = await salvarPedidoAction({ ...entrada, usoConsumo: false, itens: [{ ...entrada.itens[0], insumoId }] });
    if ("erro" in resultado) throw new Error(resultado.erro);
    const pedido = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: resultado.pedidoId }, include: { itens: { where: { ativo: true } } } });
    expect(pedido).toMatchObject({ usoConsumo: false, fornecedorId: null, fornecedorAvulso: entrada.fornecedorAvulso });
    expect(pedido.itens[0].insumoId).toBe(insumoId);
    expect(await receber(pedido)).toHaveProperty("ok", true);
    expect(await Promise.all([prisma.fornecedor.count(), prisma.cotacao.count()])).toEqual(antes);
    expect(await salvarPedidoAction({ ...entrada, usoConsumo: false, fornecedorAvulso: "  ", itens: [{ ...entrada.itens[0], insumoId }] })).toHaveProperty("erro");
  });
  it("não reabre pendentes ou cancelados e exige motivo", async () => {
    const pedido = await criar();
    expect(await reabrirPedidoAction({ pedidoId: pedido.id, motivo: "Conferir novamente" })).toHaveProperty("erro");
    expect(await reabrirPedidoAction({ pedidoId: pedido.id, motivo: " " })).toHaveProperty("erro");
    await cancelarPedidoAction({ pedidoId: pedido.id, responsavel: "Teste", justificativa: "Compra dispensada" });
    expect(await reabrirPedidoAction({ pedidoId: pedido.id, motivo: "Conferir novamente" })).toHaveProperty("erro");
  });
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn().mockResolvedValue(undefined) }));
