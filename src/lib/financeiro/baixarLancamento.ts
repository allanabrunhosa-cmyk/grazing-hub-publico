import { registrarAtividade, type AtorAtividade } from "@/lib/atividades/registro";
import { getSession } from "@/lib/session";
import { exigirEfeitoOperacional } from "@/lib/ifood/acompanhamento";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";

export type BaixarLancamentoInput = {
  lancamentoId: string;
  contaBancariaId: string;
  dataPagamento?: Date;
  tx?: Prisma.TransactionClient;
  origemPedido?: true;
  auditoriaOrigem?: true; // A conciliação já registra a mesma baixa em sua evidência transacional.
  atorAtividade?: Extract<AtorAtividade, { tipo: string }>;
};

// Único ponto que baixa um LancamentoFinanceiro (marca como pago/recebido) e gera a
// MovimentacaoBancaria correspondente de forma atômica — mesmo espírito de
// registrarMovimentacao.ts pro estoque, pra nunca deixar saldo de conta e status de
// lançamento dessincronizados.
export async function baixarLancamento(input: BaixarLancamentoInput): Promise<void> {
  const executar = async (tx: Prisma.TransactionClient) => {
    const lancamento = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: input.lancamentoId } });
    if (lancamento.pedidoVendaId) await exigirEfeitoOperacional(tx, lancamento.pedidoVendaId);
    if (lancamento.pedidoVendaId && !input.origemPedido) throw new Error("Recebimentos de Pedidos devem ser registrados no próprio pedido.");
    if (lancamento.status === "BAIXADO") throw new Error("Este lançamento já foi baixado.");
    if (lancamento.status === "CANCELADO") throw new Error("Este lançamento foi cancelado e não pode ser baixado.");
    if (lancamento.itemFaturaId) throw new Error("Liquide esta despesa em Cartões e Faturas para não duplicar o pagamento.");

    const dataPagamento = input.dataPagamento ?? new Date();

    const atualizacao = await tx.lancamentoFinanceiro.updateMany({
      where: { id: input.lancamentoId, status: "PENDENTE", itemFaturaId: null },
      data: { status: "BAIXADO", dataPagamento, contaBancariaId: input.contaBancariaId },
    });
    if (atualizacao.count !== 1) throw new Error("O lançamento mudou ou foi excluído. Atualize a tela antes de realizar a baixa.");

    await tx.movimentacaoBancaria.create({
      data: {
        contaBancariaId: input.contaBancariaId,
        tipo: lancamento.tipo === "RECEITA" ? "ENTRADA" : "SAIDA",
        valor: lancamento.valor,
        data: dataPagamento,
        descricao: lancamento.descricao,
        lancamentoId: lancamento.id,
      },
    });
    // Pedidos e conciliação já têm evidência própria; só complementa a baixa avulsa.
    if (!input.origemPedido && !input.auditoriaOrigem) {
      const ator = input.atorAtividade ?? await getSession();
      await registrarAtividade(tx, ator ?? { tipo: "SISTEMA", referencia: "Rotina financeira" }, {
        modulo: "financeiro", recurso: "financeiro.movimentacoes", acao: "BAIXA", entidade: "LancamentoFinanceiro", entidadeId: lancamento.id,
        resumo: "Baixa financeira registrada.", categoria: "CRITICA", antes: { status: lancamento.status }, depois: { status: "BAIXADO", dataPagamento, valor: lancamento.valor.toString() },
      });
    }

  };

  if (input.tx) {
    await executar(input.tx);
  } else {
    await prisma.$transaction(executar);
  }
}

export type EstornarBaixaInput = {
  lancamentoId: string;
  tx?: Prisma.TransactionClient;
  atorAtividade?: Extract<AtorAtividade, { tipo: string }>;
  desconciliacao?: {
    sessao: SessaoAtual;
    motivo: string;
  };
};

// Desfaz uma baixa: apaga a MovimentacaoBancaria gerada e volta o lançamento pro
// estado PENDENTE (sem conta/data de pagamento) — único jeito de voltar a editar ou
// excluir um lançamento já baixado, evitando corrigir um erro de lançamento mexendo
// direto no extrato da conta.
export async function estornarBaixaLancamento(input: EstornarBaixaInput): Promise<void> {
  const executar = async (tx: Prisma.TransactionClient) => {
    let autorDesconciliacao: { id: string; nome: string } | undefined;
    const vinculoInicial = await tx.vinculoExtrato.findUnique({
      where: { lancamentoId: input.lancamentoId },
      select: { transacaoId: true },
    });
    if (vinculoInicial && !input.desconciliacao) {
      throw new Error("Desfaça a conciliação bancária antes de cancelar esta baixa.");
    }
    if (vinculoInicial) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
      const usuario = await tx.usuario.findUnique({
        where: { id: input.desconciliacao!.sessao.userId },
        include: { perfilAcesso: true },
      });
      const sessao = input.desconciliacao!.sessao;
      if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) {
        throw new Error("Sua sessão foi encerrada. Entre novamente.");
      }
      const pode = (recurso: string, acao: "visualizar" | "excluir") =>
        usuario.perfilAcesso?.sistema === "ADMINISTRADOR"
        || permissaoEfetiva(
          (usuario.perfilAcesso?.permissoes ?? {}) as Permissoes,
          usuario.permissoesPersonalizadas as Excecoes,
          recurso,
          acao,
        );
      if (!pode("financeiro.movimentacoes", "visualizar") || !pode("financeiro.conciliacao", "excluir")) {
        throw new Error("Seu acesso não permite desfazer a conciliação desta baixa.");
      }
      autorDesconciliacao = { id: usuario.id, nome: usuario.nome };
      await tx.$queryRaw`SELECT id FROM "TransacaoExtrato" WHERE id = ${vinculoInicial.transacaoId} FOR UPDATE`;
    }
    await tx.$queryRaw`SELECT id FROM "LancamentoFinanceiro" WHERE id = ${input.lancamentoId} FOR UPDATE`;
    const lancamento = await tx.lancamentoFinanceiro.findUniqueOrThrow({
      where: { id: input.lancamentoId },
      include: { vinculoExtrato: true },
    });
    if (lancamento.pedidoVendaId) throw new Error("Baixa vinculada a Pedido exige correção financeira específica.");
    if (lancamento.status !== "BAIXADO") throw new Error("Este lançamento não está baixado.");
    if (lancamento.itemFaturaId) throw new Error("Desfaça o pagamento em Cartões e Faturas; a baixa pertence à fatura.");
    if (lancamento.vinculoExtrato) {
      if (!input.desconciliacao || lancamento.vinculoExtrato.transacaoId !== vinculoInicial?.transacaoId) {
        throw new Error("A conciliação deste lançamento mudou. Atualize a tela e tente novamente.");
      }

      const vinculos = await tx.vinculoExtrato.findMany({
        where: { transacaoId: lancamento.vinculoExtrato.transacaoId },
        select: { lancamentoId: true },
      });
      await tx.vinculoExtrato.deleteMany({ where: { transacaoId: lancamento.vinculoExtrato.transacaoId } });
      await tx.transacaoExtrato.update({
        where: { id: lancamento.vinculoExtrato.transacaoId },
        data: { conciliadaEm: null, conciliadaPorNome: null },
      });
      await tx.historicoConciliacao.create({
        data: {
          transacaoId: lancamento.vinculoExtrato.transacaoId,
          acao: "DESCONCILIACAO",
          autorId: autorDesconciliacao!.id,
          autorNome: autorDesconciliacao!.nome,
          motivo: input.desconciliacao.motivo,
          detalhes: {
            lancamentoIds: vinculos.map((vinculo) => vinculo.lancamentoId),
            baixasPreservadas: false,
            baixaCanceladaId: input.lancamentoId,
            origem: "CANCELAMENTO_DA_BAIXA",
          },
        },
      });
    }

    await tx.movimentacaoBancaria.deleteMany({ where: { lancamentoId: input.lancamentoId } });

    await tx.lancamentoFinanceiro.update({
      where: { id: input.lancamentoId },
      data: { status: "PENDENTE", dataPagamento: null, contaBancariaId: null },
    });
    if (!lancamento.vinculoExtrato) {
      const ator = input.desconciliacao?.sessao ?? input.atorAtividade ?? await getSession();
      await registrarAtividade(tx, ator ?? { tipo: "SISTEMA", referencia: "Rotina financeira" }, {
        modulo: "financeiro", recurso: "financeiro.movimentacoes", acao: "ESTORNO_BAIXA", entidade: "LancamentoFinanceiro", entidadeId: lancamento.id,
        resumo: "Baixa financeira estornada.", categoria: "CRITICA", antes: { status: "BAIXADO", dataPagamento: lancamento.dataPagamento }, depois: { status: "PENDENTE" },
      });
    }

  };

  if (input.tx) {
    await executar(input.tx);
  } else {
    await prisma.$transaction(executar);
  }
}
