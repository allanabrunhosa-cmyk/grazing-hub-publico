"use server";
import { prepararPagamento, pagamentoIgual } from "@/lib/notas-fiscais/pagamentos";
import { exigirPermissao } from "@/lib/permissoes/servidor";


import { resolverCategoriaCompraInsumo } from "@/lib/insumos/categoria-financeira";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { manifestarNotaFiscal } from "@/lib/sefaz/manifestar";
import { revalidatePath } from "next/cache";
import { validarConciliacao, type EntradaConciliacao } from "@/lib/notas-fiscais/validar-conciliacao";
import { validarCustosConciliacao } from "@/lib/notas-fiscais/validar-custos";
import { confirmarConciliacaoNotaAction } from "./actions";
import { chaveCompra } from "@/lib/financeiro/cancelamento-compra";

export async function aceitarNotaAction(entrada: EntradaConciliacao): Promise<{ erro: string } | { ok: true }> {
  await exigirPermissao("notas.manifestar", "editar");
  await exigirPermissao("notas", "visualizar");
  if (!(await getSession())) return { erro: "Sua sessão expirou. Entre novamente." };
  const erro = validarConciliacao(entrada);
  if (erro) return { erro };
  let aceiteRegistrado = false;
  try {
    // A transação mantém somente a trava de coordenação durante o envio remoto.
    // O histórico fiscal e a conciliação são gravados em transações independentes:
    // um rollback local jamais deve apagar um aceite já registrado na SEFAZ.
    return await prisma.$transaction(async (transacao) => {
      const [trava] = await transacao.$queryRaw<{ obtida: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext('aceite-nota'), hashtext(${entrada.notaFiscalId})) AS obtida
      `;
      if (!trava.obtida) return { erro: "Esta nota já está sendo aceita. Aguarde e confira o status antes de tentar novamente." };
      const nota = await transacao.notaFiscalRecebida.findUnique({
        where: { id: entrada.notaFiscalId },
        include: { itens: true, duplicatas: { include: { _count: { select: { lancamentos: true } } } } },
      });
      if (!nota) return { erro: "Nota fiscal não encontrada." };
      if (nota.ultimaManifestacao === "DESCONHECIMENTO_DA_OPERACAO" || nota.ultimaManifestacao === "OPERACAO_NAO_REALIZADA") return { erro: "Esta nota foi recusada. Não é possível reativar a compra pelo aceite." };
      if (await transacao.cancelamentoCompra.findUnique({ where: { chaveOrigem: chaveCompra({ tipo: "NOTA", id: nota.id }) } })) return { erro: "Esta compra foi cancelada. Os efeitos não podem ser recriados pelo aceite." };
      if (nota.tipo !== "PROC_NFE" || !nota.xml || !nota.itens.length) return { erro: "Importe o XML completo e preencha todos os itens antes de aceitar a nota." };
      if (nota.itens.some((item) => item.status === "PENDENTE" && !entrada.itens.some((acao) => acao.notaFiscalItemId === item.id))) {
        return { erro: "Preencha todos os itens antes de aceitar a nota." };
      }
      if (entrada.itens.some((item) => !nota.itens.some((atual) => atual.id === item.notaFiscalItemId))) return { erro: "Há itens de outra nota. Reabra o painel." };
      for (const parcela of entrada.duplicatas) {
        if (parcela.id && !nota.duplicatas.some((atual) => atual.id === parcela.id)) return { erro: "Há parcelas de outra nota. Reabra o painel." };
      }
      for (const atual of nota.duplicatas) {
        if (atual._count.lancamentos > 0) {
          const informada = entrada.duplicatas.find((parcela) => parcela.id === atual.id);
          if (!informada || informada.numero !== atual.numero || informada.valor !== Number(atual.valor) || informada.dataVencimento !== atual.dataVencimento.toISOString().slice(0, 10) || !pagamentoIgual(atual, informada)) {
            return { erro: "Uma parcela já lançada no financeiro não pode ser alterada neste aceite." };
          }
        }
      }
      for (const parcela of entrada.duplicatas) {
        if (nota.duplicatas.some(d => d.id === parcela.id && d._count.lancamentos > 0)) continue;
        try { await prepararPagamento(transacao, parcela); } catch (erro) { return { erro: erro instanceof Error ? erro.message : "Pagamento inválido." }; }
      }
      for (const item of entrada.itens) {
        if (item.acao === "CONCILIAR" && item.destino === "ESTOQUE" && item.fatorConversao !== undefined) {
          const original = nota.itens.find(i => i.id === item.notaFiscalItemId);
          if (!Number.isFinite(item.fatorConversao) || item.fatorConversao <= 0 || item.fatorConversao >= 1000000000 || Math.abs(Math.round(Number(original?.quantidadeComercial) * item.fatorConversao * 1000) / 1000 - item.quantidade) > 0.000001) return { erro: "Confira o fator de conversão e a quantidade do item." };
        }
      }
      const estoque = entrada.itens.filter((item) => item.acao === "CONCILIAR" && item.destino === "ESTOQUE");
      if (estoque.length) {
        const local = await transacao.localEstoque.findUnique({ where: { id: entrada.localId } });
        if (!local) return { erro: "Cadastre um local de estoque." };
      }
      for (const item of entrada.itens) {
        if (item.acao !== "CONCILIAR") continue;
        if (item.destino === "ESTOQUE") {
          const categoria = await resolverCategoriaCompraInsumo(transacao, item.insumoId);
          if ("erro" in categoria) return categoria;
        } else {
          const categoria = await transacao.categoriaFinanceira.findUnique({ where: { id: item.categoriaFinanceiraId } });
          if (!categoria?.ativo || categoria.excluidoEm || GRUPOS_RECEITA.includes(categoria.grupo)) return { erro: "Selecione uma categoria de despesa ativa para cada item de uso e consumo." };
        }
      }
      const custosValidados = validarCustosConciliacao(nota.xml, nota.itens, entrada.itens, entrada.distribuicaoDesconto);
      if ("erro" in custosValidados) return { erro: custosValidados.erro };
      aceiteRegistrado = nota.ultimaManifestacao === "CONFIRMACAO_DA_OPERACAO";
      if (!aceiteRegistrado) {
        const manifestacao = await manifestarNotaFiscal(nota.chaveAcesso, "CONFIRMACAO_DA_OPERACAO");
        revalidatePath("/notas-fiscais");
        if (!manifestacao.sucesso) return { erro: manifestacao.mensagem };
        aceiteRegistrado = true;
      }
      const pendentes = entrada.itens.filter((item) => nota.itens.some((atual) => atual.id === item.notaFiscalItemId && atual.status === "PENDENTE"));
      if (pendentes.length) {
        const conciliacao = await confirmarConciliacaoNotaAction({ ...entrada, itens: pendentes });
        if ("erro" in conciliacao) return { erro: `O aceite fiscal já foi registrado, mas a conciliação ficou pendente: ${conciliacao.erro} Use Aceitar nota novamente para concluir sem reenviar à SEFAZ.` };
      }
      return { ok: true };
    }, { timeout: 90_000, maxWait: 5_000 });
  } catch {
    return { erro: aceiteRegistrado
      ? "O aceite fiscal já foi registrado. Reabra a nota e use Aceitar nota para concluir a conciliação pendente sem reenviar à SEFAZ."
      : "Não foi possível concluir o aceite. Confira o status da nota antes de tentar novamente." };
  }
}
