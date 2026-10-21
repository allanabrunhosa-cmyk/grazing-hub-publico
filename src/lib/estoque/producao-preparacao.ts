import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import { registrarMovimentacaoPreparacao } from "./registrarMovimentacao";
import { detectarCicloComposicao } from "@/lib/vendas/pedidos-prontidao";

export class ErroProducaoPreparacao extends Error {}
export type EntradaProducao = { preparacaoId: string; revisao: string; localId: string; quantidade: string; data: string; motivo: string; ingredientes: { insumoId: string; quantidade: string }[]; chave: string };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const assinatura = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const idValido = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
function quantidade(v: unknown) {
  if (typeof v !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(v) || !new Prisma.Decimal(v).gt(0)) throw new ErroProducaoPreparacao("Informe quantidades positivas, com até seis casas decimais.");
  return new Prisma.Decimal(v);
}
async function autor(tx: Prisma.TransactionClient, sessao: SessaoAtual, somenteAdmin = false) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroProducaoPreparacao("Sua sessão foi encerrada.");
  const admin = u.perfilAcesso?.sistema === "ADMINISTRADOR";
  if (!admin && (somenteAdmin || !permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, u.permissoesPersonalizadas as Excecoes, "inventario", "editar"))) throw new ErroProducaoPreparacao("Seu acesso não permite registrar esta produção.");
  return u;
}
export async function registrarProducaoPreparacao(d: EntradaProducao, sessao: SessaoAtual) {
  if (!d || !idValido(d.preparacaoId) || !idValido(d.localId) || !/^[a-zA-Z0-9_-]{16,100}$/.test(d.chave) || !d.motivo?.trim() || d.motivo.length > 1000 || !Array.isArray(d.ingredientes) || !d.ingredientes.length || d.ingredientes.length > 100 || new Set(d.ingredientes.map(i => i.insumoId)).size !== d.ingredientes.length) throw new ErroProducaoPreparacao("Confira preparação, local, ingredientes e justificativa.");
  const q = quantidade(d.quantidade);
  for (const i of d.ingredientes) { if (!idValido(i.insumoId)) throw new ErroProducaoPreparacao("Ingrediente inválido."); quantidade(i.quantidade); }
  const data = new Date(`${d.data}T12:00:00-03:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.data) || !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== d.data) throw new ErroProducaoPreparacao("Informe a data real da produção.");
  const hash = assinatura({ ...d, ingredientes: [...d.ingredientes].sort((a, b) => a.insumoId.localeCompare(b.insumoId)) });
  return prisma.$transaction(async tx => {
    const u = await autor(tx, sessao);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estoque-reservas-pedidos'))`;
    const existente = await tx.producaoPreparacao.findUnique({ where: { chaveOperacao: d.chave } });
    if (existente) { if (existente.hashOperacao !== hash || existente.criadoPorId !== u.id) throw new ErroProducaoPreparacao("Chave já utilizada por outro registro."); return existente; }
    const ids = [d.preparacaoId, ...d.ingredientes.map(i => i.insumoId)].sort();
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Insumo" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`);
    const p = await tx.insumo.findUnique({ where: { id: d.preparacaoId }, include: { componentes: { include: { componente: true } }, conversoes: true } });
    const local = await tx.localEstoque.findUnique({ where: { id: d.localId } });
    if (!p?.ativo || p.tipo !== "PRODUTO_INTERMEDIARIO" || !local?.ativo) throw new ErroProducaoPreparacao("Preparação ou local indisponível.");
    if (p.updatedAt.toISOString() !== d.revisao) throw new ErroProducaoPreparacao("A ficha mudou. Reabra e confira as quantidades reais.");
    if (!p.rendimentoQuantidade?.gt(0) || !p.rendimentoUnidade || !p.componentes.length || p.componentes.length !== d.ingredientes.length || p.componentes.some(c => !c.componente.ativo || !d.ingredientes.some(i => i.insumoId === c.componenteId))) throw new ErroProducaoPreparacao("Complete a ficha/rendimento e informe cada ingrediente efetivamente consumido.");
    const fator = p.rendimentoUnidade === p.unidade ? new Prisma.Decimal(1) : p.conversoes.find(c => c.unidade === p.rendimentoUnidade)?.fator;
    if (!fator?.gt(0)) throw new ErroProducaoPreparacao("Configure a conversão do rendimento para a unidade de estoque.");
    const grafo = await tx.composicaoInsumo.findMany({ select: { produtoId: true, componenteId: true } });
    const mapa = new Map<string, string[]>(); for (const c of grafo) mapa.set(c.produtoId, [...mapa.get(c.produtoId) ?? [], c.componenteId]);
    if (detectarCicloComposicao(p.id, mapa)) throw new ErroProducaoPreparacao("A ficha contém ciclo de preparações.");
    for (const i of d.ingredientes) {
      const saldo = await tx.saldoEstoque.findUnique({ where: { insumoId_localId: { insumoId: i.insumoId, localId: d.localId } } });
      const reservas = await tx.reservaPedido.aggregate({ where: { insumoId: i.insumoId, localId: d.localId }, _sum: { reservada: true } });
      if (new Prisma.Decimal(saldo?.quantidadeAtual ?? 0).minus(reservas._sum.reservada ?? 0).lt(quantidade(i.quantidade))) throw new ErroProducaoPreparacao(`Estoque disponível insuficiente: ${p.componentes.find(c => c.componenteId === i.insumoId)!.componente.nome}. Confira entradas e reservas antes de registrar.`);
    }
    const fotografia = { preparacao: { id: p.id, nome: p.nome, unidade: p.unidade, revisao: d.revisao, rendimentoQuantidade: p.rendimentoQuantidade.toString(), rendimentoUnidade: p.rendimentoUnidade, fator: fator.toString() }, quantidadeProduzida: q.toString(), ingredientes: p.componentes.map(c => ({ insumoId: c.componenteId, nome: c.componente.nome, unidade: c.componente.unidade, quantidadeFicha: c.quantidade.toString(), porcao: c.porcao, quantidadeConsumida: quantidade(d.ingredientes.find(i => i.insumoId === c.componenteId)!.quantidade).toString(), custoCadastroObservado: c.componente.custoMedio.gt(0) ? c.componente.custoMedio.toString() : null })), custoApurado: null, metodoCusto: "NAO_APURADO", fonteQuantidades: "APONTAMENTO_REAL_DO_OPERADOR" };
    const producao = await tx.producaoPreparacao.create({ data: { preparacaoId: p.id, localId: d.localId, quantidade: q, data, snapshot: json(fotografia), motivo: d.motivo.trim(), chaveOperacao: d.chave, hashOperacao: hash, criadoPorId: u.id } });
    for (const i of [...fotografia.ingredientes].sort((a, b) => a.insumoId.localeCompare(b.insumoId))) await registrarMovimentacaoPreparacao({ tx, producaoPreparacaoId: producao.id, insumoId: i.insumoId, localId: d.localId, tipo: "SAIDA_CONSUMO", quantidade: i.quantidadeConsumida, data, criadoPorId: u.id, observacao: `Produção ${producao.id}: consumo real de ingrediente` });
    await registrarMovimentacaoPreparacao({ tx, producaoPreparacaoId: producao.id, insumoId: p.id, localId: d.localId, tipo: "AJUSTE_ENTRADA", quantidade: q.toString(), data, criadoPorId: u.id, observacao: `Produção ${producao.id}: rendimento real da preparação; custo não apurado` });
    return producao;
  }, { timeout: 30000 });
}

export async function corrigirProducaoPreparacao(id: string, motivo: string, chave: string, sessao: SessaoAtual) {
  if (!idValido(id) || !motivo?.trim() || motivo.length > 1000 || !/^[a-zA-Z0-9_-]{16,100}$/.test(chave)) throw new ErroProducaoPreparacao("Informe a produção e o motivo da correção administrativa.");
  const hash = assinatura({ id, motivo: motivo.trim(), usuarioId: sessao.userId });
  return prisma.$transaction(async tx => {
    const u = await autor(tx, sessao, true);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estoque-reservas-pedidos'))`;
    const p = await tx.producaoPreparacao.findUniqueOrThrow({ where: { id }, include: { movimentos: true } });
    if (p.corrigidoEm) { const anterior = p.correcao as { chave?: string; hash?: string }; if (anterior?.chave === chave && anterior.hash === hash) return p; throw new ErroProducaoPreparacao("Produção já corrigida."); }
    const snap = p.snapshot as { preparacao: { unidade: string }; ingredientes: { insumoId: string; unidade: string }[] };
    const ids = [p.preparacaoId, ...snap.ingredientes.map(i => i.insumoId)].sort();
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Insumo" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR SHARE`);
    const insumos = await tx.insumo.findMany({ where: { id: { in: [p.preparacaoId, ...snap.ingredientes.map(i => i.insumoId)] } } });
    if ([{ insumoId: p.preparacaoId, unidade: snap.preparacao.unidade }, ...snap.ingredientes].some(i => insumos.find(atual => atual.id === i.insumoId)?.unidade !== i.unidade)) throw new ErroProducaoPreparacao("Unidades alteradas desde a produção. Corrija o cadastro antes do ajuste.");
    const saldo = await tx.saldoEstoque.findUnique({ where: { insumoId_localId: { insumoId: p.preparacaoId, localId: p.localId } } });
    if (!saldo || saldo.quantidadeAtual.lt(p.quantidade)) throw new ErroProducaoPreparacao("A preparação já foi utilizada. Trate os movimentos dependentes antes da correção.");
    const reversoes = [];
    // O gravador protege reservas existentes. Não repõe saldo fotografado nem
    // usa custo atual: corrige exclusivamente os deltas do apontamento errado.
    for (const m of p.movimentos.sort((a, b) => (a.tipo === "AJUSTE_ENTRADA" ? -1 : 1) - (b.tipo === "AJUSTE_ENTRADA" ? -1 : 1))) {
      const r = await registrarMovimentacaoPreparacao({ tx, producaoPreparacaoId: p.id, insumoId: m.insumoId, localId: m.localId, tipo: m.tipo === "AJUSTE_ENTRADA" ? "AJUSTE_SAIDA" : "AJUSTE_ENTRADA", quantidade: m.quantidade.toString(), criadoPorId: u.id, observacao: `Correção administrativa da produção ${id}: ${motivo.trim()}` });
      reversoes.push({ origem: m.id, reversao: r.movimentacaoId });
    }
    return tx.producaoPreparacao.update({ where: { id }, data: { corrigidoEm: new Date(), correcao: json({ chave, hash, motivo: motivo.trim(), usuarioId: u.id, usuarioNome: u.nome, reversoes, custoApurado: null }) } });
  }, { timeout: 30000 });
}
