import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { exigirDespesaSemCustoEntrega, travarCustosEntrega } from "./custos-entrega";
import type { ConfirmacaoCancelamentoCompra, ResumoCancelamentoCompra } from "./cancelamento-compra-tipos";
import type { EntradaSnapshot } from "@/lib/inventario/entrada-avulsa-historico";

export type OrigemCompra = { tipo: "NOTA" | "AVULSA" | "MOVIMENTO"; id: string };
const incluirTitulo = { movimentacaoBancaria: true, vinculoExtrato: true, liquidacoesCartao: { include: { pagamento: true } } } satisfies Prisma.LancamentoFinanceiroInclude;
const incluirMovimento = { insumo: true, local: true, estornoCompra: true, notaFiscalItem: true } satisfies Prisma.MovimentacaoEstoqueInclude;
const json = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v));
export function chaveCompra(origem: OrigemCompra) { return origem.tipo + ":" + origem.id; }

export async function origemCompraLancamento(tx: Prisma.TransactionClient, id: string): Promise<OrigemCompra | null> {
  const l = await tx.lancamentoFinanceiro.findUnique({ where: { id }, include: { notaFiscalItemLancamento: { include: { notaFiscalItem: true } } } });
  if (!l) throw new Error("Lançamento não encontrado.");
  if (l.notaFiscalItemLancamento) return { tipo: "NOTA", id: l.notaFiscalItemLancamento.notaFiscalItem.notaFiscalId };
  if (l.origemEntradaAvulsaCompraId) return { tipo: "AVULSA", id: l.origemEntradaAvulsaCompraId };
  if (l.origemMovimentacaoEstoqueId) return { tipo: "MOVIMENTO", id: l.origemMovimentacaoEstoqueId };
  return null;
}

async function autor(tx: Prisma.TransactionClient, sessao: SessaoAtual, escrita: boolean) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))");
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0)) throw new Error("Sua sessão expirou. Entre novamente.");
  const pode = (recurso: string, acao: "visualizar" | "editar" | "excluir") => u.perfilAcesso?.sistema === "ADMINISTRADOR"
    || permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, (u.permissoesPersonalizadas ?? {}) as Excecoes, recurso, acao);
  if (!pode("financeiro.movimentacoes", escrita ? "excluir" : "visualizar")) throw new Error("Sem permissão para cancelar esta compra.");
  return { id: u.id, nome: u.nome, pode };
}

export async function prepararCancelamentoCompra(tx: Prisma.TransactionClient, origem: OrigemCompra, sessao: SessaoAtual, escrita = false, compensarEntrada = false) {
  if (!origem.id || origem.id.length > 100 || !["NOTA", "AVULSA", "MOVIMENTO"].includes(origem.tipo)) throw new Error("Origem de compra inválida.");
  const usuario = await autor(tx, sessao, escrita);
  await travarCustosEntrega(tx);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('cancelamento-compra'), hashtext($1))", chaveCompra(origem));
  let descricao: string;
  let lancamentos: Prisma.LancamentoFinanceiroGetPayload<{ include: typeof incluirTitulo }>[];
  let movimentos: Prisma.MovimentacaoEstoqueGetPayload<{ include: typeof incluirMovimento }>[];
  if (origem.tipo === "NOTA") {
    if (!usuario.pode("notas", "visualizar")) throw new Error("Sem permissão para consultar a nota de origem.");
    await tx.$queryRawUnsafe('SELECT id FROM "NotaFiscalRecebida" WHERE id = $1 FOR UPDATE', origem.id);
    const nota = await tx.notaFiscalRecebida.findUniqueOrThrow({ where: { id: origem.id }, include: { itens: { include: { movimentacaoEstoque: { include: incluirMovimento } } } } });
    descricao = "NF-e nº " + Number(nota.chaveAcesso.slice(25, 34)) + " — " + (nota.fornecedorNome ?? "Compra");
    lancamentos = await tx.lancamentoFinanceiro.findMany({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: origem.id } } }, include: incluirTitulo, orderBy: { id: "asc" } });
    movimentos = nota.itens.flatMap(i => i.movimentacaoEstoque ? [i.movimentacaoEstoque] : []);
  } else if (origem.tipo === "AVULSA") {
    await tx.$queryRawUnsafe('SELECT id FROM "EntradaAvulsaCompra" WHERE id = $1 FOR UPDATE', origem.id);
    const compra = await tx.entradaAvulsaCompra.findUniqueOrThrow({ where: { id: origem.id }, include: { fornecedor: true, registro: true, movimentacoes: { include: incluirMovimento } } });
    if (!compensarEntrada && compra.registro && compra.registro.versao > 1 && !(compra.registro.snapshot as EntradaSnapshot).cancelada) {
      const itens = (compra.registro.snapshot as EntradaSnapshot).itens;
      const originais = compra.movimentacoes.filter(m => !m.estornoDeId);
      if (itens.length !== originais.length || itens.some(i => !originais.some(m => m.insumoId === i.insumoId && m.localId === i.localId && m.quantidade.equals(i.quantidadeEstoque)))) {
        throw new Error("Esta entrada possui correções de estoque. O cancelamento integral original não é seguro; confira e corrija a entrada no Histórico de entradas avulsas antes de cancelar a compra.");
      }
    }
    descricao = "Compra sem nota — " + compra.fornecedor.nome;
    lancamentos = await tx.lancamentoFinanceiro.findMany({ where: { origemEntradaAvulsaCompraId: origem.id }, include: incluirTitulo, orderBy: { id: "asc" } });
    movimentos = compra.movimentacoes.filter(m => !m.estornoDeId);
  } else {
    await tx.$queryRawUnsafe('SELECT id FROM "MovimentacaoEstoque" WHERE id = $1 FOR UPDATE', origem.id);
    const movimento = await tx.movimentacaoEstoque.findUniqueOrThrow({ where: { id: origem.id }, include: incluirMovimento });
    if (movimento.notaFiscalItem || movimento.entradaAvulsaCompraId) throw new Error("Cancele pela compra de origem.");
    descricao = "Compra — " + movimento.insumo.nome;
    lancamentos = await tx.lancamentoFinanceiro.findMany({ where: { origemMovimentacaoEstoqueId: origem.id }, include: incluirTitulo, orderBy: { id: "asc" } });
    movimentos = [movimento];
  }
  movimentos.sort((a, b) => a.id.localeCompare(b.id));
  if (lancamentos.length) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join(lancamentos.map(l => l.id).sort())}) ORDER BY id FOR UPDATE`);
    lancamentos = await tx.lancamentoFinanceiro.findMany({ where: { id: { in: lancamentos.map(l => l.id) } }, include: incluirTitulo, orderBy: { id: "asc" } });
  }
  if (movimentos.length && !usuario.pode("inventario", escrita ? "editar" : "visualizar")) throw new Error("Sem permissão para estornar o estoque desta compra.");
  const anterior = await tx.cancelamentoCompra.findUnique({ where: { chaveOrigem: chaveCompra(origem) } });
  if (anterior) return { resumo: { ...(anterior.resumo as unknown as ResumoCancelamentoCompra), cancelada: true }, anterior, usuario, lancamentos, movimentos };
  if (lancamentos.some(l => l.tipo !== "DESPESA" || l.status === "BAIXADO" || l.movimentacaoBancaria || l.vinculoExtrato || l.itemFaturaId || l.pedidoVendaId || l.liquidacoesCartao.some(q => !q.pagamento.revertidoEm))) throw new Error("A compra tem pagamento ou vínculo ativo. Desfaça a baixa/conciliação e os vínculos antes de cancelar.");
  if (movimentos.some(m => m.estornoDeId || m.estornoCompra || m.tipo !== "ENTRADA_COMPRA" || !m.quantidade.gt(0))) throw new Error("Há movimentos incompatíveis ou já estornados. Confira a compra de origem.");
  await exigirDespesaSemCustoEntrega(tx, { id: { in: lancamentos.map(l => l.id) } });
  const itens = movimentos.map(m => ({ id: m.insumoId, descricao: m.insumo.nome, quantidade: m.quantidade.toString(), unidade: m.insumo.unidade, local: m.local.nome, data: m.createdAt.toISOString(), movimentoId: m.id }));
  const fotografia = { origem, lancamentos: lancamentos.map(l => ({ id: l.id, valor: l.valor.toString(), status: l.status, atualizadoEm: l.updatedAt.toISOString() })), itens, locais: movimentos.map(m => m.localId) };
  const resumo: ResumoCancelamentoCompra = { chaveOrigem: chaveCompra(origem), descricao, token: createHash("sha256").update(JSON.stringify(fotografia)).digest("hex"),
    quantidadeLancamentos: lancamentos.filter(l => l.status === "PENDENTE").length, valor: lancamentos.filter(l => l.status === "PENDENTE").reduce((s, l) => s.plus(l.valor), new Prisma.Decimal(0)).toFixed(2), itens, cancelada: false };
  return { resumo, anterior, usuario, lancamentos, movimentos };
}

export async function executarCancelamentoCompra(tx: Prisma.TransactionClient, origem: OrigemCompra, confirmacao: ConfirmacaoCancelamentoCompra, sessao: SessaoAtual) {
  if (!confirmacao || !/^[a-f0-9]{64}$/.test(confirmacao.token) || typeof confirmacao.motivo !== "string" || confirmacao.motivo.trim().length < 15 || confirmacao.motivo.trim().length > 255) throw new Error("Confirme a prévia e informe um motivo de 15 a 255 caracteres.");
  const plano = await prepararCancelamentoCompra(tx, origem, sessao, true);
  if (plano.anterior) {
    if (plano.anterior.token !== confirmacao.token) throw new Error("A compra já foi cancelada. Atualize a tela.");
    return { ok: true as const, quantidade: 0 };
  }
  if (plano.resumo.token !== confirmacao.token) throw new Error("A compra mudou. Reabra a confirmação e confira novamente os itens.");
  const ids = plano.lancamentos.filter(l => l.status === "PENDENTE").map(l => l.id);
  const cancelados = await tx.lancamentoFinanceiro.updateMany({ where: { id: { in: ids }, status: "PENDENTE", itemFaturaId: null, pedidoVendaId: null }, data: { status: "CANCELADO" } });
  if (cancelados.count !== ids.length) throw new Error("A compra mudou durante o cancelamento. Nenhum estorno foi aplicado.");
  const estornos = [];
  for (const m of plano.movimentos) {
    if (!Number.isFinite(Number(m.quantidade)) || !m.quantidade.equals(new Prisma.Decimal(Number(m.quantidade)))) throw new Error("Quantidade fora da precisão suportada. Nenhum estorno foi aplicado.");
    const resultado = await registrarMovimentacao({ insumoId: m.insumoId, localId: m.localId, tipo: "AJUSTE_SAIDA", quantidade: Number(m.quantidade), data: m.createdAt,
      criadoPorId: plano.usuario.id, observacao: "Estorno da compra " + plano.resumo.descricao + ". " + confirmacao.motivo.trim(), tx });
    await tx.movimentacaoEstoque.update({ where: { id: resultado.movimentacaoId }, data: { estornoDeId: m.id } });
    estornos.push({ originalId: m.id, estornoId: resultado.movimentacaoId, quantidade: m.quantidade.toString(), data: m.createdAt.toISOString(), saldoAnterior: resultado.saldoAnterior, saldoNovo: resultado.saldoNovo });
  }
  await tx.cancelamentoCompra.create({ data: { chaveOrigem: chaveCompra(origem), token: plano.resumo.token, autorId: plano.usuario.id, autorNome: plano.usuario.nome, motivo: confirmacao.motivo.trim(), resumo: json(plano.resumo) } });
  await tx.historicoAcesso.create({ data: { autorId: plano.usuario.id, entidade: "COMPRA", entidadeId: chaveCompra(origem), acao: "CANCELAMENTO_INTEGRAL",
    antes: json({ lancamentos: plano.lancamentos.map(l => ({ id: l.id, status: l.status, valor: l.valor.toString() })), itens: plano.resumo.itens }),
    depois: json({ motivo: confirmacao.motivo.trim(), lancamentosCancelados: ids, estornos }) } });
  return { ok: true as const, quantidade: cancelados.count };
}

export async function consultarCancelamentoCompra(origem: OrigemCompra, sessao: SessaoAtual) {
  return prisma.$transaction(async tx => (await prepararCancelamentoCompra(tx, origem, sessao)).resumo);
}
export async function cancelarCompra(origem: OrigemCompra, confirmacao: ConfirmacaoCancelamentoCompra, sessao: SessaoAtual) {
  return prisma.$transaction(tx => executarCancelamentoCompra(tx, origem, confirmacao, sessao), { timeout: 30_000, maxWait: 5_000 });
}

/** Participa da transação que compensa a versão atual no Estoque. */
export async function cancelarObrigacoesEntradaAvulsa(tx: Prisma.TransactionClient, compraId: string, sessao: SessaoAtual, motivo: string) {
  const origem: OrigemCompra = { tipo: "AVULSA", id: compraId };
  const plano = await prepararCancelamentoCompra(tx, origem, sessao, true, true);
  if (plano.anterior) throw new Error("Esta compra já foi estornada. Atualize o histórico.");
  const ids = plano.lancamentos.filter(l => l.status === "PENDENTE").map(l => l.id);
  const cancelados = await tx.lancamentoFinanceiro.updateMany({ where: { id: { in: ids }, status: "PENDENTE", itemFaturaId: null, pedidoVendaId: null }, data: { status: "CANCELADO" } });
  if (cancelados.count !== ids.length) throw new Error("A compra mudou. Nenhum estorno foi aplicado.");
  await tx.cancelamentoCompra.create({ data: { chaveOrigem: chaveCompra(origem), token: plano.resumo.token, autorId: plano.usuario.id, autorNome: plano.usuario.nome, motivo, resumo: json(plano.resumo) } });
  await tx.historicoAcesso.create({ data: { autorId: plano.usuario.id, entidade: "COMPRA", entidadeId: chaveCompra(origem), acao: "CANCELAMENTO_INTEGRAL", antes: json(plano.resumo), depois: json({ motivo, lancamentosCancelados: ids, estoque: "Compensação da versão atual na mesma transação" }) } });
}
