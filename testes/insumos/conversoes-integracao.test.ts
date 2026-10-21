vi.mock("server-only", () => ({}));
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveInsumoAction, importInsumosAction } from "@/app/(protegido)/insumos/actions";
import { salvarPedidoAction, confirmarRecebimentoAction } from "@/app/(protegido)/compras/actions";

const estado = vi.hoisted(() => ({ autenticado: true, sessao: { userId: "", nome: "Teste conversões", email: "", admin: true } }));
vi.mock("@/lib/session", () => ({ getSession: async () => estado.autenticado ? estado.sessao : null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
let insumoId = "", fornecedorId = "";
function formulario(fator = "10") {
  const dados = new FormData();
  for (const [chave, valor] of Object.entries({ nome: `Açúcar teste ${estado.sessao.userId}`, tipo: "INSUMO", unidade: "KG", ativo: "on", conversoes: JSON.stringify([{ unidade: "FD", fator }]) })) dados.set(chave, valor);
  if (insumoId) dados.set("id", insumoId);
  return dados;
}
function entrada(fator = 10) {
  return { fornecedorId, previsaoEntrega: null, observacoes: null, itens: [{ insumoId, quantidade: 2, unidadeCompra: "FD" as const, precoUnitario: 50, conversao: { fator, unidadePrincipal: "KG" as const } }] };
}

describe.skipIf(process.env.CONVERSOES_BANCO_TESTE !== "1")("Conversões no PostgreSQL local", () => {
  beforeAll(async () => {
    if (!["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error("Teste permitido somente no banco local.");
    estado.sessao.userId = (await prisma.usuario.create({ data: { nome: estado.sessao.nome, email: `conversoes-${Date.now()}@example.invalid`, senhaHash: "teste-sem-login" } })).id;
    fornecedorId = (await prisma.fornecedor.create({ data: { nome: `Fornecedor conversões ${estado.sessao.userId}` } })).id;
  });
  afterAll(async () => {
    if (!estado.sessao.userId) return;
    await prisma.$transaction(async (tx) => {
      const filtro = { pedido: { criadoPorId: estado.sessao.userId } };
      await tx.recebimentoDivergencia.deleteMany({ where: { recebimentoItem: { recebimento: filtro } } });
      await tx.recebimentoItem.deleteMany({ where: { recebimento: filtro } });
      await tx.recebimento.deleteMany({ where: filtro });
      await tx.pedidoCompraHistorico.deleteMany({ where: filtro });
      await tx.pedidoCompra.deleteMany({ where: { criadoPorId: estado.sessao.userId } });
      if (insumoId) { await tx.cotacao.deleteMany({ where: { insumoId } }); await tx.insumo.delete({ where: { id: insumoId } }); }
      if (fornecedorId) await tx.fornecedor.delete({ where: { id: fornecedorId } });
      await tx.usuario.delete({ where: { id: estado.sessao.userId } });
    });
    await prisma.$disconnect();
  });
  it("exige sessão e salva fatores junto com o insumo", async () => {
    estado.autenticado = false;
    expect(await saveInsumoAction({ error: null }, formulario())).toHaveProperty("error", "Sua sessão expirou. Entre novamente.");
    estado.autenticado = true;
    const resultado = await saveInsumoAction({ error: null }, formulario());
    expect(resultado.error).toBeNull();
    insumoId = resultado.insumoId!;
    const salvo = await prisma.conversaoInsumo.findFirstOrThrow({ where: { insumoId } });
    expect(Number(salvo.fator)).toBe(10);
  });
  it("rejeita fator inválido sem alterar nome nem conversão existente", async () => {
    const dados = formulario("0"); dados.set("nome", "Nome que não deve ser salvo");
    expect((await saveInsumoAction({ error: null }, dados)).error).toBeTruthy();
    const salvo = await prisma.insumo.findUniqueOrThrow({ where: { id: insumoId }, include: { conversoes: true } });
    expect(salvo.nome).toContain("Açúcar teste");
    expect(Number(salvo.conversoes[0].fator)).toBe(10);
  });
  it("preserva conversão no pedido e na edição depois de alterar o cadastro", async () => {
    const antes = await Promise.all([prisma.movimentacaoEstoque.count({ where: { insumoId } }), prisma.lancamentoFinanceiro.count()]);
    const resultado = await salvarPedidoAction(entrada());
    if ("erro" in resultado) throw new Error(resultado.erro);
    const pedido = await prisma.pedidoCompra.findUniqueOrThrow({ where: { id: resultado.pedidoId }, include: { itens: true } });
    expect(Number(pedido.itens[0].quantidade)).toBe(2);
    expect(Number(pedido.itens[0].precoTotal)).toBe(100);
    expect(Number(pedido.itens[0].fatorConversao)).toBe(10);
    expect(pedido.itens[0].unidadePrincipal).toBe("KG");
    expect(Number((await prisma.cotacao.findFirstOrThrow({ where: { insumoId } })).precoUnitario)).toBe(5);
    expect((await saveInsumoAction({ error: null }, formulario("12"))).error).toBeNull();
    expect(await salvarPedidoAction(entrada())).toHaveProperty("erro");
    const alteracao = entrada();
    const editado = await salvarPedidoAction({ ...alteracao, pedidoId: pedido.id, itens: [{ ...alteracao.itens[0], pedidoItemOriginalId: pedido.itens[0].id }] });
    expect(editado).toHaveProperty("ok", true);
    const item = await prisma.pedidoCompraItem.findFirstOrThrow({ where: { pedidoId: pedido.id, ativo: true } });
    expect(Number(item.fatorConversao)).toBe(10);
    expect(await confirmarRecebimentoAction({ pedidoId: pedido.id, responsavel: "Teste", dataRecebimento: "2026-09-10", itens: [{ pedidoItemId: item.id, insumoId, quantidadeRecebida: 2, lote: null, validade: null, qualidadeOk: true }] })).toHaveProperty("ok", true);
    expect(await Promise.all([prisma.movimentacaoEstoque.count({ where: { insumoId } }), prisma.lancamentoFinanceiro.count()])).toEqual(antes);
    expect(Number((await prisma.recebimentoItem.findFirstOrThrow({ where: { pedidoItemId: item.id } })).quantidadeRecebida)).toBe(2);
  });
  it("bloqueia troca da unidade via importação quando há conversões cadastradas", async () => {
    const resultado = await importInsumosAction([{ nome: `Açúcar teste ${estado.sessao.userId}`, unidade: "UN" }]);
    expect(resultado.atualizados).toBe(0);
    expect(resultado.erros[0].mensagem).toContain("fatores de conversão");
    expect((await prisma.insumo.findUniqueOrThrow({ where: { id: insumoId } })).unidade).toBe("KG");
  });
  it("não aceita fator falsificado nem item original de outro pedido", async () => {
    expect(await salvarPedidoAction(entrada(999))).toHaveProperty("erro");
    const dados = entrada(12);
    expect(await salvarPedidoAction({ ...dados, itens: [{ ...dados.itens[0], pedidoItemOriginalId: "outro-pedido" }] })).toHaveProperty("erro");
  });
  it("remove conversões explicitamente e preserva pedidos anteriores", async () => {
    const dados = formulario(); dados.set("conversoes", "[]");
    expect((await saveInsumoAction({ error: null }, dados)).error).toBeNull();
    expect(await prisma.conversaoInsumo.count({ where: { insumoId } })).toBe(0);
    expect(Number((await prisma.pedidoCompraItem.findFirstOrThrow({ where: { insumoId, fatorConversao: { not: null } } })).fatorConversao)).toBe(10);
  });
});

// Estas regressões isolam a regra operacional; as guardas reais são exercitadas em testes/permissoes/fronteiras.test.ts.
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn(async () => estado.sessao) }));
