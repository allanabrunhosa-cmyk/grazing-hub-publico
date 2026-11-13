import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { EntradaDetalheDTO, EntradaSnapshot } from "@/lib/inventario/entrada-avulsa-historico";
import { ErroPagamentoEntrada, normalizarPagamentoEntrada, pagamentosEntradaIguais, validarPagamentoEntrada, type PagamentoEntradaInput } from "@/lib/inventario/entrada-avulsa-pagamento";
import { prepararPagamento } from "@/lib/notas-fiscais/pagamentos";
import { dataCalendarioValida, vencimentoCartao } from "@/lib/financeiro/cartoes";
import { travarCustosEntrega } from "@/lib/financeiro/custos-entrega";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import { registrarAtividade } from "@/lib/atividades/registro";

const incluirTitulo = {
  formaPagamento: true,
  cartaoCredito: { select: { diaFechamento: true, diaVencimento: true } },
  movimentacaoBancaria: true, vinculoExtrato: true,
  liquidacoesCartao: { include: { pagamento: true } },
  custosEntrega: { where: { desvinculadoEm: null }, select: { id: true } },
} satisfies Prisma.LancamentoFinanceiroInclude;

type AutorFinanceiroEntrada = {
  id: string; nome: string; perfilAcesso?: { sistema?: string | null; permissoes: unknown } | null;
  permissoesPersonalizadas: unknown;
};
const dia = (d: Date) => d.toISOString().slice(0, 10);
const nomeForma = { BOLETO: "Boleto", PIX: "Pix", CARTAO: "Cartão de crédito" };
function formaDoTitulo(nome: string | null | undefined): PagamentoEntradaInput["formaPagamento"] | null {
  return Object.entries(nomeForma).find(([, v]) => v.toLocaleLowerCase("pt-BR") === nome?.trim().toLocaleLowerCase("pt-BR"))?.[0] as PagamentoEntradaInput["formaPagamento"] | undefined ?? null;
}

/** Valida todos os títulos antes da primeira escrita. O cartão sempre usa a fatura real. */
export async function prepararParcelasEntrada(tx: Prisma.TransactionClient, pagamento: PagamentoEntradaInput, valorTotal: number) {
  const plano = validarPagamentoEntrada(pagamento, valorTotal);
  const parcelas = [];
  for (const [indice, parcela] of plano.parcelas.entries()) {
    try {
      parcelas.push({ valor: parcela.valor, ...await prepararPagamento(tx, { ...plano, dataVencimento: parcela.dataVencimento, parcelaCartao: (plano.parcelaCartao ?? 1) + indice }) });
    } catch (erro) { throw new ErroPagamentoEntrada(erro instanceof Error ? erro.message : "Confira as condições de pagamento."); }
  }
  const forma = await tx.formaPagamento.upsert({ where: { nome: nomeForma[plano.formaPagamento] }, create: { nome: nomeForma[plano.formaPagamento] }, update: {} });
  return { pagamento: plano, parcelas, formaPagamentoId: forma.id, recorrenciaGrupoId: parcelas.length > 1 ? randomUUID() : null };
}

async function lerFinanceiroEntrada(tx: Prisma.TransactionClient, compraId: string, snapshot: EntradaSnapshot) {
  const compra = await tx.entradaAvulsaCompra.findUnique({ where: { id: compraId } });
  if (!compra) throw new ErroPagamentoEntrada("A compra de origem não foi encontrada.");
  const titulos = await tx.lancamentoFinanceiro.findMany({ where: { origemEntradaAvulsaCompraId: compraId, status: { not: "CANCELADO" } },
    include: incluirTitulo, orderBy: [{ dataVencimento: "asc" }, { valor: "asc" }, { id: "asc" }] });
  const primeiro = titulos[0];
  const forma = formaDoTitulo(primeiro?.formaPagamento?.nome);
  const pagamento: PagamentoEntradaInput = { formaPagamento: forma ?? "BOLETO", cartaoCreditoId: primeiro?.cartaoCreditoId ?? null, dataCompra: null, parcelaCartao: 1,
    parcelas: titulos.map(l => ({ valor: Number(l.valor), dataVencimento: dia(l.dataVencimento) })) };
  let bloqueio: string | undefined;
  let aviso: string | undefined;
  let planoReconstruido = !!forma && titulos.every(l => formaDoTitulo(l.formaPagamento?.nome) === forma
    && l.cartaoCreditoId === primeiro.cartaoCreditoId && (forma === "CARTAO") === !!l.cartaoCreditoId);
  const bloquear = (mensagem: string) => { bloqueio ??= mensagem; };
  const avisar = (mensagem: string) => { planoReconstruido = false; aviso ??= mensagem; };
  if (!titulos.length || titulos.length > 36 || !titulos.reduce((s, l) => s.plus(l.valor), new Prisma.Decimal(0)).equals(compra.valorTotal)) bloquear("Os títulos atuais não correspondem ao total da compra. Confira a origem no Financeiro antes de alterar o pagamento.");
  if (!planoReconstruido) avisar("As condições de pagamento antigas estão incompletas ou são diferentes entre as parcelas. Informe a forma de pagamento e confira o novo plano.");
  if (titulos.some(l => l.tipo !== "DESPESA" || l.pedidoVendaId || l.fornecedorId !== primeiro.fornecedorId || l.contraparteNome !== primeiro.contraparteNome
    || l.categoriaId !== primeiro.categoriaId || l.dataCompetencia.getTime() !== primeiro.dataCompetencia.getTime())) bloquear("As condições dos títulos atuais são incompatíveis. Confira os lançamentos no Financeiro antes de alterar o pagamento.");
  if (titulos.some(l => l.status !== "PENDENTE" || l.dataPagamento || l.movimentacaoBancaria || l.vinculoExtrato || l.itemFaturaId || l.liquidacoesCartao.some(q => !q.pagamento.revertidoEm))) bloquear("O pagamento possui baixa, conciliação ou vínculo de fatura. Corrija os vínculos no Financeiro antes de alterar o plano.");
  if (titulos.some(l => l.custosEntrega.length)) bloquear("Desvincule o custo no Pedido antes de alterar o pagamento desta compra.");
  if (forma === "CARTAO") {
    const metadata = snapshot.pagamento?.formaPagamento === "CARTAO" && snapshot.pagamento.cartaoCreditoId === primeiro?.cartaoCreditoId ? snapshot.pagamento : null;
    const legado = !snapshot.pagamento && snapshot.dadosOriginais?.cartaoCreditoId === primeiro?.cartaoCreditoId ? snapshot.dadosOriginais : null;
    const dataCompra = metadata?.dataCompra ?? legado?.dataCompra;
    const ordinal = metadata?.parcelaCartao ?? Number(legado?.parcelaCartao ?? 1);
    const cartao = primeiro?.cartaoCredito;
    if (typeof dataCompra === "string" && dataCalendarioValida(dataCompra) && Number.isInteger(ordinal) && ordinal >= 1 && ordinal + titulos.length - 1 <= 120 && cartao) {
      const datasSnapshot = metadata?.parcelas.map(p => p.dataVencimento).sort();
      const corresponde = metadata
        ? JSON.stringify(datasSnapshot) === JSON.stringify(pagamento.parcelas.map(p => p.dataVencimento))
        : pagamento.parcelas.every((p, i) => vencimentoCartao(dataCompra, cartao.diaFechamento, cartao.diaVencimento, ordinal + i) === p.dataVencimento);
      if (corresponde) { pagamento.dataCompra = dataCompra; pagamento.parcelaCartao = ordinal; }
      else avisar("As datas antigas não correspondem às condições registradas do cartão. Selecione o cartão e informe a data da compra para conferir os novos vencimentos.");
    } else avisar("A data da compra ou a parcela inicial antiga do cartão não está registrada. Selecione o cartão e informe a data da compra para conferir os novos vencimentos.");
  }
  const plano = normalizarPagamentoEntrada(pagamento);
  const revisao = createHash("sha256").update(JSON.stringify({ compra: { id: compra.id, valorTotal: compra.valorTotal.toString(), fornecedorId: compra.fornecedorId }, pagamento: plano, planoReconstruido,
    titulos: titulos.map(l => ({ id: l.id, atualizadoEm: l.updatedAt.toISOString(), status: l.status, valor: l.valor.toString(), vencimento: l.dataVencimento.toISOString(),
      competencia: l.dataCompetencia.toISOString(), categoriaId: l.categoriaId, fornecedorId: l.fornecedorId, contraparteNome: l.contraparteNome,
      formaPagamentoId: l.formaPagamentoId, formaPagamentoNome: l.formaPagamento?.nome ?? null, contaBancariaId: l.contaBancariaId,
      cartaoCreditoId: l.cartaoCreditoId, dataPagamento: l.dataPagamento?.toISOString(), movimento: l.movimentacaoBancaria?.id, extrato: l.vinculoExtrato?.transacaoId,
      itemFaturaId: l.itemFaturaId, liquidacoes: l.liquidacoesCartao.filter(q => !q.pagamento.revertidoEm).map(q => q.id).sort(), custos: l.custosEntrega.map(c => c.id).sort() })) })).digest("hex");
  return { compra, titulos, planoReconstruido, financeiro: { pagamento: plano, revisao, ...(bloqueio ? { bloqueio } : {}), ...(aviso ? { aviso } : {}) } };
}

export async function consultarFinanceiroEntrada(tx: Prisma.TransactionClient, compraId: string, snapshot: EntradaSnapshot): Promise<NonNullable<EntradaDetalheDTO["financeiro"]>> {
  return (await lerFinanceiroEntrada(tx, compraId, snapshot)).financeiro;
}

/** Substitui o plano sem reutilizar os IDs que uma baixa concorrente pode ter lido. */
export async function alterarPagamentoEntrada(tx: Prisma.TransactionClient, compraId: string, snapshot: EntradaSnapshot, entrada: PagamentoEntradaInput & { revisao: string }, autor: AutorFinanceiroEntrada) {
  if (typeof entrada?.revisao !== "string" || !/^[a-f0-9]{64}$/.test(entrada.revisao)) throw new ErroPagamentoEntrada("Reabra a entrada e confira o pagamento atual.");
  const pagamento = validarPagamentoEntrada(entrada, snapshot.valorTotal);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('financeiro-cartoes'))`;
  await travarCustosEntrega(tx);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('cancelamento-compra'), hashtext($1))", `AVULSA:${compraId}`);
  await tx.$queryRaw`SELECT id FROM "EntradaAvulsaCompra" WHERE id = ${compraId} FOR UPDATE`;
  const ids = await tx.lancamentoFinanceiro.findMany({ where: { origemEntradaAvulsaCompraId: compraId, status: { not: "CANCELADO" } }, select: { id: true }, orderBy: { id: "asc" } });
  if (ids.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join(ids.map(l => l.id))}) ORDER BY id FOR UPDATE`);
  const atual = await lerFinanceiroEntrada(tx, compraId, snapshot);
  if (entrada.revisao !== atual.financeiro.revisao) throw new ErroPagamentoEntrada("O pagamento foi alterado por outra pessoa. Reabra a entrada e confira os títulos atuais.");
  if (atual.planoReconstruido && pagamentosEntradaIguais(pagamento, atual.financeiro.pagamento)) return { pagamento, anterior: atual.financeiro.pagamento, mudou: false, anteriores: [] as string[], novos: [] as string[] };
  if (autor.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva((autor.perfilAcesso?.permissoes ?? {}) as Permissoes, (autor.permissoesPersonalizadas ?? {}) as Excecoes, "financeiro.movimentacoes", "editar")) throw new ErroPagamentoEntrada("Seu acesso atual não permite alterar o pagamento desta compra.");
  if (atual.financeiro.bloqueio) throw new ErroPagamentoEntrada(atual.financeiro.bloqueio);
  const preparado = await prepararParcelasEntrada(tx, pagamento, Number(atual.compra.valorTotal));
  const anteriores = atual.titulos.map(l => l.id);
  const cancelados = await tx.lancamentoFinanceiro.updateMany({ where: { id: { in: anteriores }, status: "PENDENTE", dataPagamento: null, itemFaturaId: null,
    movimentacaoBancaria: null, vinculoExtrato: null, liquidacoesCartao: { none: { pagamento: { revertidoEm: null } } }, custosEntrega: { none: { desvinculadoEm: null } } }, data: { status: "CANCELADO" } });
  if (cancelados.count !== anteriores.length) throw new ErroPagamentoEntrada("O pagamento mudou durante a correção. Reabra a entrada.");
  const origem = atual.titulos[0];
  const novos: string[] = [];
  for (const parcela of preparado.parcelas) {
    const titulo = await tx.lancamentoFinanceiro.create({ data: { tipo: "DESPESA", descricao: origem.descricao, valor: parcela.valor,
      categoriaId: origem.categoriaId, dataCompetencia: origem.dataCompetencia, dataVencimento: parcela.dataVencimento, fornecedorId: origem.fornecedorId,
      contraparteNome: origem.contraparteNome, observacoes: origem.observacoes, criadoPorId: autor.id, origemEntradaAvulsaCompraId: compraId,
      formaPagamentoId: preparado.formaPagamentoId, cartaoCreditoId: parcela.cartaoCreditoId, contaBancariaId: parcela.contaBancariaId,
      recorrenciaGrupoId: preparado.recorrenciaGrupoId } });
    novos.push(titulo.id);
  }
  await tx.entradaAvulsaCompra.update({ where: { id: compraId }, data: { dataVencimento: preparado.parcelas[0].dataVencimento, pago: false, dataPagamento: null } });
  await registrarAtividade(tx, { userId: autor.id, nome: autor.nome }, { modulo: "financeiro", recurso: "financeiro.movimentacoes", acao: "ALTERAR_PAGAMENTO_ENTRADA", entidade: "EntradaAvulsaCompra", entidadeId: compraId,
    resumo: "Plano de pagamento da entrada avulsa alterado, com títulos anteriores cancelados e preservados.", categoria: "CRITICA",
    antes: { tipo: atual.planoReconstruido ? atual.financeiro.pagamento.formaPagamento : "NAO_RECONSTRUIDO", itens: atual.titulos.length,
      dataVencimento: atual.financeiro.pagamento.parcelas[0].dataVencimento, valorTotal: Number(atual.compra.valorTotal), camposAlterados: "pagamento" },
    depois: { tipo: pagamento.formaPagamento, itens: pagamento.parcelas.length, dataVencimento: pagamento.parcelas[0].dataVencimento,
      valorTotal: Number(atual.compra.valorTotal), camposAlterados: "pagamento" } });
  return { pagamento, anterior: atual.financeiro.pagamento, mudou: true, anteriores, novos };
}
