import "server-only";
import { registrarAtividade, type AtorAtividade } from "@/lib/atividades/registro";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Prisma, type TipoMovimentacaoEstoque } from "@/generated/prisma/client";
import { DecimalEstoque } from "./quantidade";

const TIPOS_ENTRADA: TipoMovimentacaoEstoque[] = ["ENTRADA_COMPRA", "AJUSTE_ENTRADA"];

// "MEDIA" (padrão) = recalcula o custo médio ponderado, como sempre. "NOVO" = pula a
// média e substitui o custo médio direto pelo custo desta entrada — pra quando o
// usuário sinaliza que a base de custo anterior estava desatualizada.
export type ModoCustoEntrada = "MEDIA" | "NOVO";

export type RegistrarMovimentacaoInput = {
  insumoId: string;
  localId: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number;
  data?: Date;
  observacao?: string | null;
  criadoPorId?: string | null;
  // Rotinas servidoras sem sessão devem informar identidade técnica explicitamente.
  atorAtividade?: Extract<AtorAtividade, { tipo: string }>;
  custoUnitario?: number | null;
  modoCusto?: ModoCustoEntrada;
  considerarCustoZero?: boolean;
  origemPerdaId?: string | null;
  entradaAvulsaCompraId?: string | null;
  entradaAvulsaRegistroId?: string | null;
  producaoPreparacaoId?: string | null;
  // reservado — não usado nesta entrega, mas mantém o helper pronto pro futuro fluxo
  // de conferência de entrada a partir de itens de Nota Fiscal.
  origemRecebimentoItemId?: string | null;
  // Compra/pagamento — só preenchidos pela Entrada Avulsa (tipo "compra simples"),
  // reservados pro futuro módulo de Contas a Pagar.
  valorTotal?: number | null;
  dataVencimento?: Date | null;
  pago?: boolean;
  dataPagamento?: Date | null;
  tx?: Prisma.TransactionClient;
};

export type RegistrarMovimentacaoResultado = {
  movimentacaoId: string;
  saldoAnterior: number;
  saldoNovo: number;
};

// Único ponto que grava MovimentacaoEstoque e atualiza SaldoEstoque de forma atômica —
// usado por Entrada Avulsa, Perda e Finalização de Contagem, pra nunca deixar os dois
// dessincronizados.
export async function registrarMovimentacao(
  input: RegistrarMovimentacaoInput
): Promise<RegistrarMovimentacaoResultado> {
  if (!Number.isFinite(input.quantidade) || input.quantidade <= 0) {
    throw new Error("Quantidade deve ser maior que zero.");
  }
  const executar = (tx: Prisma.TransactionClient) => registrarNaTransacao(tx, input, new DecimalEstoque(input.quantidade), false);
  return input.tx ? executar(input.tx) : prisma.$transaction(executar);
}

async function registrarNaTransacao(tx: Prisma.TransactionClient, input: Omit<RegistrarMovimentacaoInput, "quantidade">, quantidade: InstanceType<typeof DecimalEstoque>, automaticoGestor: boolean): Promise<RegistrarMovimentacaoResultado> {
    const ehEntrada = TIPOS_ENTRADA.includes(input.tipo);
    // Reservas de Pedidos participam da mesma fronteira de escrita dos outros módulos.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estoque-reservas-pedidos'))`;
    if (!ehEntrada && !automaticoGestor) {
      const reservas = await tx.reservaPedido.aggregate({ where: { insumoId: input.insumoId, localId: input.localId }, _sum: { reservada: true } });
      const reservado = reservas._sum.reservada;
      if (reservado?.gt(0)) {
        const atual = await tx.saldoEstoque.findUnique({ where: { insumoId_localId: { insumoId: input.insumoId, localId: input.localId } } });
        if (new DecimalEstoque(atual?.quantidadeAtual ?? 0).minus(quantidade).lt(reservado)) throw new Error("Saída utilizaria quantidade reservada por Pedidos. Trate a reserva antes de alterar o estoque.");
      }
    }
    // Custo médio vive no Insumo (não por local) — soma o saldo de TODOS os locais ANTES
    // de aplicar esta movimentação, senão a própria entrada contaminaria "saldoAnterior".
    if (ehEntrada && input.custoUnitario != null && (input.custoUnitario > 0 || (input.considerarCustoZero && input.custoUnitario === 0))) {
      if (input.modoCusto === "NOVO") {
        await tx.insumo.update({ where: { id: input.insumoId }, data: { custoMedio: input.custoUnitario } });
      } else {
        const [agregado, insumo] = await Promise.all([
          tx.saldoEstoque.aggregate({ where: { insumoId: input.insumoId }, _sum: { quantidadeAtual: true } }),
          tx.insumo.findUniqueOrThrow({ where: { id: input.insumoId }, select: { custoMedio: true } }),
        ]);
        const saldoAnteriorTotal = Number(agregado._sum.quantidadeAtual ?? 0);
        const custoMedioAnterior = Number(insumo.custoMedio);
        const denominador = saldoAnteriorTotal + quantidade.toNumber();
        const novoCustoMedio =
          denominador > 0
            ? (saldoAnteriorTotal * custoMedioAnterior + quantidade.toNumber() * input.custoUnitario) / denominador
            : input.custoUnitario;
        await tx.insumo.update({ where: { id: input.insumoId }, data: { custoMedio: novoCustoMedio } });
      }
    }
    // Saídas (SAIDA_CONSUMO/SAIDA_PERDA/AJUSTE_SAIDA) nunca mexem em custoMedio — a base de
    // custo do estoque restante só muda quando entra unidade nova a um custo diferente.

    const delta = ehEntrada ? quantidade : quantidade.negated();
    const saldo = await tx.saldoEstoque.upsert({
      where: { insumoId_localId: { insumoId: input.insumoId, localId: input.localId } },
      update: { quantidadeAtual: { increment: delta } },
      create: { insumoId: input.insumoId, localId: input.localId, quantidadeAtual: delta },
    });
    const saldoNovo = Number(saldo.quantidadeAtual);

    const movimentacao = await tx.movimentacaoEstoque.create({
      data: {
        insumoId: input.insumoId,
        localId: input.localId,
        tipo: input.tipo,
        quantidade,
        observacao: input.observacao ?? null,
        criadoPorId: input.criadoPorId ?? null,
        origemPerdaId: input.origemPerdaId ?? null,
        entradaAvulsaCompraId: input.entradaAvulsaCompraId ?? null,
        entradaAvulsaRegistroId: input.entradaAvulsaRegistroId ?? null,
        producaoPreparacaoId: input.producaoPreparacaoId ?? null,
        origemRecebimentoItemId: input.origemRecebimentoItemId ?? null,
        custoUnitario: ehEntrada ? (input.custoUnitario ?? null) : null,
        valorTotal: input.valorTotal ?? null,
        dataVencimento: input.dataVencimento ?? null,
        pago: input.pago ?? false,
        dataPagamento: input.dataPagamento ?? null,
        ...(input.data ? { createdAt: input.data } : {}),
      },
    });

    // A data efetiva do estoque pode ser retroativa; a atividade recebe o relógio do banco.
    // Fora de sessão validada, não atribuir a rotina ao criadoPorId legado.
    const autorAtividade = input.atorAtividade ?? await getSession();
    await registrarAtividade(tx, autorAtividade ?? { tipo: "SISTEMA", referencia: "Rotina de estoque" }, {
      modulo: "estoque", recurso: "inventario", acao: input.tipo, entidade: "MovimentacaoEstoque",
      entidadeId: movimentacao.id, resumo: "Movimentação de estoque registrada.",
      fonteTabela: "MovimentacaoEstoque", fonteId: movimentacao.id,
      correlacaoId: input.entradaAvulsaCompraId ?? input.origemPerdaId ?? input.producaoPreparacaoId ?? undefined,
    });
    return { movimentacaoId: movimentacao.id, saldoAnterior: new DecimalEstoque(saldo.quantidadeAtual).minus(delta).toNumber(), saldoNovo };
}

/** Quantidades explicitamente apontadas na produção; preserva a precisão decimal
 * sem mudar o contrato numérico dos consumidores históricos do gravador. */
export async function registrarMovimentacaoPreparacao(input: Omit<RegistrarMovimentacaoInput, "quantidade" | "tx"> & { quantidade: string; tx: Prisma.TransactionClient; producaoPreparacaoId: string }) {
  const quantidade = new DecimalEstoque(input.quantidade);
  if (!quantidade.isFinite() || !quantidade.gt(0) || !/^\d{1,12}(\.\d{1,6})?$/.test(input.quantidade)) throw new Error("Quantidade de produção inválida.");
  return registrarNaTransacao(input.tx, input, quantidade, false);
}

/** Deltas de correção preservam toda a escala já gravada, inclusive legado.
 * A fronteira de saldo/reservas/auditoria continua sendo o gravador comum. */
export async function registrarAjusteEntradaAvulsa(input: Omit<RegistrarMovimentacaoInput, "quantidade" | "tx" | "tipo" | "entradaAvulsaRegistroId"> & {
  quantidade: string; tx: Prisma.TransactionClient; tipo: "AJUSTE_ENTRADA" | "AJUSTE_SAIDA"; entradaAvulsaRegistroId: string;
}) {
  const quantidade = new DecimalEstoque(input.quantidade);
  if (!/^\d{1,35}(\.\d{1,30})?$/.test(input.quantidade) || !quantidade.isFinite() || !quantidade.gt(0)) throw new Error("Quantidade do ajuste fora da precisão do estoque.");
  const resultado = await registrarNaTransacao(input.tx, input, quantidade, false);
  const saldo = await input.tx.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: input.insumoId, localId: input.localId } } });
  const delta = input.tipo === "AJUSTE_ENTRADA" ? quantidade : quantidade.negated();
  return { movimentacaoId: resultado.movimentacaoId, saldoAnterior: new DecimalEstoque(saldo.quantidadeAtual).minus(delta).toFixed(), saldoNovo: saldo.quantidadeAtual.toFixed() };
}

/** Exceção exclusivamente servidora do Gestor: não expõe uma flag no gravador público. */
export async function registrarConsumoAutomaticoGestorPedido(input: {
  tx: Prisma.TransactionClient; pedidoId: string; reservaId: string;
  quantidade: string; usuarioId: string; observacao: string;
}) {
  const qtd = new DecimalEstoque(input.quantidade);
  if (!qtd.isFinite() || !qtd.gt(0)) throw new Error("Quantidade automática deve ser positiva.");
  const [reserva, loja] = await Promise.all([
    input.tx.reservaPedido.findFirst({ where: { id: input.reservaId, item: { pedidoId: input.pedidoId, vigente: true } }, include: { item: { include: { pedido: true } } } }),
    input.tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } }),
  ]);
  const politica = loja?.pedidosLiberacao as { movimentarEstoque?: unknown } | null;
  if (politica?.movimentarEstoque !== true || !reserva || reserva.item.pedido.status !== "CONFIRMADO" || reserva.item.pedido.entregueEm || qtd.gt(reserva.consumida)) throw new Error("Consumo automático indisponível para esta reserva.");
  const revenda = (reserva.snapshot as { tipoProduto?: string }).tipoProduto === "REVENDA";
  if (reserva.item.pedido.statusOperacional !== (revenda ? "PRONTO" : "EM_PREPARO")) throw new Error("Etapa incompatível com o consumo automático.");
  const resultado = await registrarNaTransacao(input.tx, { insumoId: reserva.insumoId, localId: reserva.localId, tipo: "SAIDA_CONSUMO", criadoPorId: input.usuarioId, observacao: input.observacao }, qtd, true);
  // Strings preservam a precisão auditável; o contrato histórico do gravador público é numérico.
  const saldo = await input.tx.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: reserva.insumoId, localId: reserva.localId } } });
  const outras = await input.tx.reservaPedido.aggregate({ where: { insumoId: reserva.insumoId, localId: reserva.localId, item: { pedidoId: { not: input.pedidoId } } }, _sum: { reservada: true } });
  return { movimentacaoId: resultado.movimentacaoId, saldoAnterior: new DecimalEstoque(saldo.quantidadeAtual).plus(qtd).toString(), saldoNovo: saldo.quantidadeAtual.toString(), reservasOutrosPedidos: outras._sum.reservada?.toString() ?? "0", permitirSaldoNegativo: true, origem: "GESTOR_AUTOMATICO" as const };
}
