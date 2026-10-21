
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { caminhoCategoria, categoriasComCaminho, SELECAO_CATEGORIA_COM_CAMINHO } from "@/lib/financeiro/caminho-categoria";
import { prisma } from "@/lib/prisma";
import { MovimentacoesView } from "./movimentacoes-view";
import { projetarRelatorioFaturas } from "@/lib/financeiro/faturas/relatorios";
import { AvisoFaturas } from "../cartoes/aviso";
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";
import type { LancamentoRow } from "@/app/(protegido)/financeiro/types";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";

export default async function MovimentacoesPage({ searchParams }: { searchParams: Promise<{ entidade?: string | string[] }> }) {
  const sessao = await exigirPermissao("financeiro.movimentacoes");
  const entidadeId = entidadeInicial((await searchParams).entidade);
  const pode = (recurso: string, acao: "visualizar" | "editar" | "adicionar" | "excluir") => sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, acao);
  const verConciliacao = pode("financeiro.conciliacao", "visualizar");
  const [lancamentos, categorias, fornecedores, formasPagamento, contas, avulsas, transacoes] = await Promise.all([
    prisma.lancamentoFinanceiro.findMany({
      where: { status: { not: "CANCELADO" } },
      orderBy: { dataVencimento: "desc" },
      include: {
        vinculoExtrato: { select: { transacaoId: true } },
        categoria: { select: SELECAO_CATEGORIA_COM_CAMINHO },
        fornecedor: { select: { nome: true } },
        contaBancaria: { select: { nome: true } },
        formaPagamento: { select: { nome: true } },
        notaFiscalItemLancamento: { select: {
          notaFiscalDuplicata: { select: { id: true, numero: true, valor: true } },
          notaFiscalItem: { select: { descricaoProduto: true, notaFiscal: { select: { id: true, chaveAcesso: true, fornecedorNome: true } } } },
        } },
      },
    }),
    prisma.categoriaFinanceira.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: SELECAO_CATEGORIA_COM_CAMINHO }),
    prisma.fornecedor.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.formaPagamento.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    prisma.contaBancaria.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, ativo: true, saldoInicial: true, dataSaldoInicial: true } }),
    prisma.movimentacaoBancaria.findMany({ where: { lancamentoId: null }, include: { contaBancaria: { select: { nome: true } } } }),
    verConciliacao ? prisma.transacaoExtrato.findMany({ orderBy: [{ data: "asc" }, { id: "asc" }], include: { importacao: { select: { nomeArquivo: true } }, vinculos: true, historico: { orderBy: { createdAt: "desc" } } } }) : Promise.resolve([]),
  ]);
  const contasBancarias = contas.filter((c) => c.ativo).map((c) => ({ id: c.id, nome: c.nome }));

  const linhas: LancamentoRow[] = lancamentos.map((l) => ({
    id: l.id,
    versao: l.updatedAt.toISOString(),
    transacaoExtratoId: l.vinculoExtrato?.transacaoId ?? null,
    tipo: l.tipo,
    descricao: l.descricao,
    valor: Number(l.valor),
    categoriaId: l.categoriaId,
    categoriaNome: caminhoCategoria(l.categoria),
    categoriaGrupo: l.categoria.grupo,
    dataCompetencia: l.dataCompetencia.toISOString(),
    dataVencimento: l.dataVencimento.toISOString(),
    status: l.status,
    dataPagamento: l.dataPagamento ? l.dataPagamento.toISOString() : null,
    pedidoQuitadoCredito: l.pedidoQuitadoCredito,
    pedidoVendaId: l.pedidoVendaId,
    contaBancariaId: l.contaBancariaId,
    contaBancariaNome: l.contaBancaria?.nome ?? null,
    fornecedorId: l.fornecedorId,
    fornecedorNome: l.fornecedor?.nome ?? null,
    formaPagamentoId: l.formaPagamentoId,
    formaPagamentoNome: l.formaPagamento?.nome ?? null,
    contraparteNome: l.contraparteNome,
    observacoes: l.observacoes,
    notaFiscalItemDescricao: l.notaFiscalItemLancamento?.notaFiscalItem.descricaoProduto ?? null,
    notaFiscal: l.notaFiscalItemLancamento ? {
      id: l.notaFiscalItemLancamento.notaFiscalItem.notaFiscal.id,
      numero: String(Number(l.notaFiscalItemLancamento.notaFiscalItem.notaFiscal.chaveAcesso.slice(25, 34))),
      serie: String(Number(l.notaFiscalItemLancamento.notaFiscalItem.notaFiscal.chaveAcesso.slice(22, 25))),
      fornecedorNome: l.notaFiscalItemLancamento.notaFiscalItem.notaFiscal.fornecedorNome,
      parcela: {
        id: l.notaFiscalItemLancamento.notaFiscalDuplicata.id,
        numero: l.notaFiscalItemLancamento.notaFiscalDuplicata.numero,
        valor: Number(l.notaFiscalItemLancamento.notaFiscalDuplicata.valor),
      },
    } : null,
  }));

  const projecao = await projetarRelatorioFaturas(linhas);
  const entidadeInicialId = projecao.linhas.some(l => l.id === entidadeId && l.status !== "CANCELADO" && !l.pedidoQuitadoCredito) ? entidadeId : undefined;
  return (
    <div className="space-y-6">
      <BarraAcoes titulo="Movimentações" descricao="Seu extrato de receitas e despesas, realizadas e previstas">
        <LancamentoDialog
          categorias={categoriasComCaminho(categorias)}
          fornecedores={fornecedores}
          formasPagamento={formasPagamento}
          contasBancarias={contasBancarias}
          podeCadastrarBeneficiario={pode("fornecedores", "adicionar")}
        />
      </BarraAcoes>
      <AvisoFaturas />
      <MovimentacoesView
        key={entidadeInicialId ?? "lista"}
        entidadeInicialId={entidadeInicialId}
        conciliacao={verConciliacao ? {
          acesso: { importar: pode("financeiro.conciliacao", "adicionar"), conciliar: pode("financeiro.conciliacao", "editar"),
            criar: pode("financeiro.conciliacao", "editar") && pode("financeiro.movimentacoes", "adicionar") && pode("financeiro.baixas", "editar"),
            baixar: pode("financeiro.baixas", "editar"), desfazer: pode("financeiro.conciliacao", "excluir"),
            editarMovimentacao: pode("financeiro.movimentacoes", "editar"), excluirMovimentacao: pode("financeiro.movimentacoes", "excluir") },
          transacoes: transacoes.map(t => ({ id: t.id, contaBancariaId: t.contaBancariaId, data: t.data.toISOString().slice(0, 10), descricao: t.descricao, valor: Number(t.valor), identificador: t.identificador,
            arquivo: t.importacao.nomeArquivo, conciliadaEm: t.conciliadaEm?.toISOString() ?? null, conciliadaPorNome: t.conciliadaPorNome,
            lancamentoIds: t.vinculos.map(v => v.lancamentoId), historico: t.historico.map(h => ({ data: h.createdAt.toISOString(), acao: h.acao, autor: h.autorNome, motivo: h.motivo })) })),
        } : undefined}
        saldosIniciais={contas.map((c) => ({ id: c.id, saldoInicial: Number(c.saldoInicial), dataSaldoInicial: c.dataSaldoInicial?.toISOString().slice(0, 10) ?? null }))}
        saldoInicial={contas.reduce((soma, c) => soma + Number(c.saldoInicial), 0)}
        avulsas={avulsas.filter(m => !projecao.movimentosSubstituidos.has(m.id)).map((m) => ({ id: m.id, tipo: m.tipo, valor: Number(m.valor), data: m.data.toISOString(), descricao: m.descricao, contaBancariaNome: m.contaBancaria.nome, contaBancariaId: m.contaBancariaId }))}
        linhas={projecao.linhas}
        categorias={categoriasComCaminho(categorias)}
        fornecedores={fornecedores}
        formasPagamento={formasPagamento}
        contasBancarias={contasBancarias}
        podeCadastrarBeneficiario={pode("fornecedores", "adicionar")}
      />
    </div>
  );
}
