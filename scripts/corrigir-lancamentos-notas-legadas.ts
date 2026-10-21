import { prisma } from "@/lib/prisma";
import { planejarCorrecaoNotaLegada, type NotaLegada, type PlanoCorrecaoNotaLegada } from "@/lib/notas-fiscais/correcao-lancamentos-legados";

const aplicar = process.argv.includes("--aplicar");
const confirmacao = process.argv.find(argumento => argumento.startsWith("--confirmar="))?.split("=")[1];
const chave = process.argv.find(argumento => argumento.startsWith("--chave="))?.split("=")[1];
const MARCADOR = "[Correção de custo NF-e 2026-09-11] Valor recalculado pelo XML para considerar frete, IPI, desconto e demais componentes.";

function numero(valor: unknown) { return valor == null ? null : Number(valor); }
function moeda(valor: number) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

async function carregarNotas(cliente: typeof prisma, ids?: string[]): Promise<NotaLegada[]> {
  const notas = await cliente.notaFiscalRecebida.findMany({
    where: {
      ...(ids ? { id: { in: ids } } : {}),
      ...(chave ? { chaveAcesso: chave } : {}),
      tipo: "PROC_NFE",
      xml: { not: null },
      itens: { some: { lancamentos: { some: {} } } },
    },
    orderBy: [{ dataEmissao: "asc" }, { chaveAcesso: "asc" }],
    include: {
      itens: {
        orderBy: { numeroItem: "asc" },
        include: {
          lancamentos: {
            orderBy: [{ notaFiscalDuplicata: { dataVencimento: "asc" } }, { id: "asc" }],
            include: {
              notaFiscalDuplicata: { select: { valor: true } },
              lancamentoFinanceiro: {
                select: {
                  id: true, valor: true, status: true, dataPagamento: true, observacoes: true,
                  vinculoExtrato: { select: { lancamentoId: true } },
                  movimentacaoBancaria: { select: { lancamentoId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  return notas.map(nota => ({
    id: nota.id,
    chaveAcesso: nota.chaveAcesso,
    fornecedorNome: nota.fornecedorNome,
    valorTotal: numero(nota.valorTotal),
    xml: nota.xml,
    itens: nota.itens.map(item => ({
      id: item.id,
      numeroItem: item.numeroItem,
      status: item.status,
      valorTotalItem: Number(item.valorTotalItem),
      valorTotalConciliado: numero(item.valorTotalConciliado),
      composicaoCusto: item.composicaoCusto,
      lancamentos: item.lancamentos.map(lancamento => ({
        id: lancamento.id,
        valor: Number(lancamento.valor),
        valorDuplicata: Number(lancamento.notaFiscalDuplicata.valor),
        lancamentoFinanceiro: {
          id: lancamento.lancamentoFinanceiro.id,
          valor: Number(lancamento.lancamentoFinanceiro.valor),
          status: lancamento.lancamentoFinanceiro.status,
          dataPagamento: lancamento.lancamentoFinanceiro.dataPagamento,
          temVinculoExtrato: !!lancamento.lancamentoFinanceiro.vinculoExtrato,
          temMovimentacaoBancaria: !!lancamento.lancamentoFinanceiro.movimentacaoBancaria,
        },
      })),
    })),
  }));
}

function avaliar(notas: NotaLegada[]) {
  const planos: PlanoCorrecaoNotaLegada[] = [];
  const bloqueadas: { chave: string; motivo: string }[] = [];
  for (const nota of notas) {
    const resultado = planejarCorrecaoNotaLegada(nota);
    if (resultado.situacao === "CORRIGIR") planos.push(resultado.plano);
    if (resultado.situacao === "BLOQUEADA") bloqueadas.push({ chave: nota.chaveAcesso, motivo: resultado.motivo });
  }
  return { planos, bloqueadas };
}

function exibir(planos: PlanoCorrecaoNotaLegada[], bloqueadas: { chave: string; motivo: string }[]) {
  for (const plano of planos) {
    console.log(`${plano.chaveAcesso} | ${plano.fornecedorNome ?? "Fornecedor não identificado"} | ${moeda(plano.valorAnterior)} -> ${moeda(plano.valorCorrigido)}`);
  }
  for (const bloqueada of bloqueadas) console.error(`BLOQUEADA ${bloqueada.chave}: ${bloqueada.motivo}`);
  console.log(`${planos.length} nota(s) apta(s); ${bloqueadas.length} bloqueada(s).`);
}

async function executar() {
  const avaliacaoInicial = avaliar(await carregarNotas(prisma));
  exibir(avaliacaoInicial.planos, avaliacaoInicial.bloqueadas);
  if (!aplicar) {
    console.log("Conferência concluída. Nenhum dado foi alterado.");
    return;
  }
  if (!/^\d+$/.test(confirmacao ?? "") || Number(confirmacao) !== avaliacaoInicial.planos.length || avaliacaoInicial.planos.length === 0) {
    throw new Error(`Use --confirmar=${avaliacaoInicial.planos.length} para confirmar a quantidade exata exibida.`);
  }

  const ids = avaliacaoInicial.planos.map(plano => plano.notaId).sort();
  await prisma.$transaction(async tx => {
    for (const id of ids) await tx.$queryRaw`SELECT id FROM "NotaFiscalRecebida" WHERE id = ${id} FOR UPDATE`;
    const avaliacaoSobTrava = avaliar(await carregarNotas(tx as typeof prisma, ids));
    if (avaliacaoSobTrava.bloqueadas.length || avaliacaoSobTrava.planos.length !== ids.length) {
      throw new Error("Os lançamentos mudaram depois da conferência. Nenhum valor foi corrigido.");
    }
    for (const plano of avaliacaoSobTrava.planos) {
      for (const item of plano.itens) {
        await tx.notaFiscalItem.update({
          where: { id: item.itemId },
          data: { valorTotalConciliado: item.valorCorrigido, composicaoCusto: item.composicaoCusto },
        });
        for (const lancamento of item.lancamentos) {
          const atual = await tx.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: lancamento.lancamentoFinanceiroId }, select: { observacoes: true } });
          await tx.notaFiscalItemLancamento.update({ where: { id: lancamento.vinculoId }, data: { valor: lancamento.valorCorrigido } });
          await tx.lancamentoFinanceiro.update({
            where: { id: lancamento.lancamentoFinanceiroId },
            data: {
              valor: lancamento.valorCorrigido,
              observacoes: atual.observacoes ? `${atual.observacoes}\n\n${MARCADOR}` : MARCADOR,
            },
          });
        }
      }
    }
  }, { timeout: 90_000 });
  console.log(`${ids.length} nota(s) corrigida(s) em uma única transação.`);
}

executar()
  .catch(erro => { console.error(erro instanceof Error ? erro.message : "Falha ao corrigir lançamentos."); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
