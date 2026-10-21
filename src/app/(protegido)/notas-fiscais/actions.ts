"use server";
import { prepararPagamento, pagamentoIgual, type PagamentoNota } from "@/lib/notas-fiscais/pagamentos";
import type { CartaoOption } from "@/lib/financeiro/cartoes";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { paraCaixaAlta, paraCaixaAltaOpcional } from "@/lib/caixa-alta";


import { revalidatePath } from "next/cache";
import JSZip from "jszip";
import { extrairCustosNFe } from "@/lib/sefaz/custosNFe";
import { ratearValor, lerComposicaoCusto, type CustosNotaFiscal, type DistribuicaoDesconto } from "@/lib/notas-fiscais/custos";
import { validarCustosConciliacao } from "@/lib/notas-fiscais/validar-custos";
import { resolverFornecedorNota } from "@/lib/notas-fiscais/fornecedor";
import { resolverCategoriaCompraInsumo } from "@/lib/insumos/categoria-financeira";
import { caminhoCategoria, SELECAO_CATEGORIA_COM_CAMINHO } from "@/lib/financeiro/caminho-categoria";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { diaEntradaEstoque, validarDataEntradaEstoque } from "@/lib/notas-fiscais/data-entrada";
import { getSession } from "@/lib/session";
import { consultarCancelamentoCompra, prepararCancelamentoCompra, cancelarCompra, chaveCompra } from "@/lib/financeiro/cancelamento-compra";
import type { ConfirmacaoCancelamentoCompra, ResumoCancelamentoCompra } from "@/lib/financeiro/cancelamento-compra-tipos";
import { agendarBusca } from "@/lib/sefaz/busca-agendada";
import { manifestarNotaFiscal } from "@/lib/sefaz/manifestar";
import { extrairItensNFe, extrairDetalhesFiscaisNFe, extrairDuplicatasNFe } from "@/lib/sefaz/parseNFe";
import { registrarMovimentacao, type ModoCustoEntrada } from "@/lib/estoque/registrarMovimentacao";
import type { TipoManifestacao, UnidadeMedida } from "@/generated/prisma/client";
import type {
  ItemConciliacaoRow,
  DuplicataRow,
  DetalhesFiscaisRow,
} from "@/app/(protegido)/notas-fiscais/types";

export async function sincronizarAction(): Promise<{ agendada: true; mensagem: string } | { erro: string }> {
  await exigirPermissao("notas", "adicionar");
  if (!(await getSession())) return { erro: "Sua sessão expirou. Entre novamente." };
  try {
    const resumo = await agendarBusca();
    revalidatePath("/notas-fiscais");
    return resumo;
  } catch (erro) {
    return { erro: erro instanceof Error ? erro.message : "Erro desconhecido ao consultar a SEFAZ." };
  }
}

export async function manifestarAction(chaveAcesso: string, tipo: TipoManifestacao, justificativa?: string, confirmacao?: ConfirmacaoCancelamentoCompra) {
  await exigirPermissao("notas.manifestar", "editar");
  await exigirPermissao("notas", "visualizar");
  if (!(await getSession())) {
    return { sucesso: false, mensagem: "Sua sessão expirou. Entre novamente.", protocolo: null };
  }
  if (tipo === "CONFIRMACAO_DA_OPERACAO") return { sucesso: false, mensagem: "Use Aceitar nota para revisar os itens e confirmar a compra.", protocolo: null };
  const sessao = await getSession();
  if (!sessao) return { sucesso: false, mensagem: "Sua sessão expirou. Entre novamente.", protocolo: null };
  let recusaFiscalRegistrada = false;
  try {
  const resultado = await prisma.$transaction(async (transacao) => {
    const nota = await transacao.notaFiscalRecebida.findUnique({ where: { chaveAcesso }, select: { id: true, ultimaManifestacao: true, manifestacoes: true } });
    if (!nota) return { sucesso: false, mensagem: "Nota fiscal não encontrada.", protocolo: null };
    const [trava] = await transacao.$queryRaw<{ obtida: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(hashtext('aceite-nota'), hashtext(${nota.id})) AS obtida
    `;
    if (!trava.obtida) return { sucesso: false, mensagem: "Esta nota já está sendo atualizada. Aguarde e tente novamente.", protocolo: null };
    const recusa = tipo === "DESCONHECIMENTO_DA_OPERACAO" || tipo === "OPERACAO_NAO_REALIZADA";
    const temEfeitos = recusa && await transacao.notaFiscalItem.count({ where: { notaFiscalId: nota.id, OR: [{ movimentacaoEstoqueId: { not: null } }, { lancamentos: { some: {} } }] } }) > 0;
    if (temEfeitos) {
      // A coordenação fica na transação externa; a prévia solta as travas de linhas
      // antes do envio fiscal, que persiste seu histórico em outra conexão.
      const plano = await prisma.$transaction(tx => prepararCancelamentoCompra(tx, { tipo: "NOTA", id: nota.id }, sessao, true));
      if (!plano.anterior && (!confirmacao || (confirmacao.token !== plano.resumo.token) || !confirmacao.motivo || confirmacao.motivo.trim().length < 15 || confirmacao.motivo.trim().length > 255)) return { sucesso: false, mensagem: "Confira o popup dos itens e confirme a reversão integral com um motivo de 15 a 255 caracteres.", protocolo: null };
    }
    const resultadoFiscal = recusa && nota.ultimaManifestacao === tipo && nota.manifestacoes.some(m => m.tipo === tipo && (m.sucesso || m.cStat === "573"))
      ? { sucesso: true, mensagem: "Recusa fiscal já registrada; efeitos locais concluídos sem reenvio.", protocolo: null }
      : await manifestarNotaFiscal(chaveAcesso, tipo, justificativa);
    recusaFiscalRegistrada = recusa && resultadoFiscal.sucesso;
    if (resultadoFiscal.sucesso && temEfeitos && !(await transacao.cancelamentoCompra.findUnique({ where: { chaveOrigem: chaveCompra({ tipo: "NOTA", id: nota.id }) } }))) {
      await cancelarCompra({ tipo: "NOTA", id: nota.id }, confirmacao!, sessao);
    }
    return resultadoFiscal;
  }, { timeout: 90_000, maxWait: 5_000 });
  revalidatePath("/notas-fiscais");
  revalidarEfeitosCompra();
  return resultado;
  } catch (erro) {
    return { sucesso: false, mensagem: recusaFiscalRegistrada
      ? "A recusa fiscal já foi registrada, mas a reversão local ficou pendente. Reabra e confirme a recusa para concluir sem reenviar à SEFAZ."
      : erro instanceof Error ? erro.message : "Não foi possível concluir a recusa.", protocolo: null };
  }
}

function revalidarEfeitosCompra() {
  for (const rota of ["/notas-fiscais", "/inventario", "/inventario/movimentacoes", "/financeiro", "/financeiro/movimentacoes", "/financeiro/fluxo-de-caixa"]) revalidatePath(rota);
}

export async function obterResumoCancelamentoNotaAction(notaFiscalId: string): Promise<{ resumo: ResumoCancelamentoCompra | null } | { erro: string }> {
  await exigirPermissao("notas", "visualizar");
  await exigirPermissao("notas.manifestar", "editar");
  const sessao = await getSession();
  if (!sessao) return { erro: "Sua sessão expirou. Entre novamente." };
  try {
    const temEfeitos = await prisma.notaFiscalItem.count({ where: { notaFiscalId, OR: [{ movimentacaoEstoqueId: { not: null } }, { lancamentos: { some: {} } }] } });
    return { resumo: temEfeitos ? await consultarCancelamentoCompra({ tipo: "NOTA", id: notaFiscalId }, sessao) : null };
  } catch (erro) { return { erro: erro instanceof Error ? erro.message : "Não foi possível conferir os efeitos da nota." }; }
}

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export type ResultadoExportacaoXml = { nomeArquivo: string; conteudoBase64: string; quantidade: number; semXml: number } | { erro: string };

// Exporta somente os XMLs completos já armazenados, sem consultar a SEFAZ.
// Duas datas vazias selecionam todas as notas; um período usa a mesma data UTC da lista.
export async function exportarXmlPorDataAction(dataInicio: string, dataFim: string): Promise<ResultadoExportacaoXml> {
  await exigirPermissao("notas", "visualizar");
  if (!(await getSession())) return { erro: "Sua sessão expirou. Entre novamente." };
  if (typeof dataInicio !== "string" || typeof dataFim !== "string") return { erro: "Datas inválidas." };
  const todas = dataInicio === "" && dataFim === "";
  if (!todas && (!dataInicio || !dataFim)) {
    return { erro: "Preencha as duas datas ou limpe o período para exportar todas as notas." };
  }
  const inicio = new Date(dataInicio + "T00:00:00.000Z");
  const fim = new Date(dataFim + "T23:59:59.999Z");
  if (!todas) {
    if (!FORMATO_DATA.test(dataInicio) || !FORMATO_DATA.test(dataFim)
      || !Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime())
      || inicio.toISOString().slice(0, 10) !== dataInicio || fim.toISOString().slice(0, 10) !== dataFim) {
      return { erro: "Datas inválidas." };
    }
    if (dataInicio > dataFim) return { erro: "A data inicial precisa ser antes da data final." };
  }

  try {
    const notas = await prisma.notaFiscalRecebida.findMany({
      where: todas ? {} : { dataEmissao: { gte: inicio, lte: fim } },
      select: { chaveAcesso: true, xml: true, tipo: true },
      orderBy: { chaveAcesso: "asc" },
    });
    if (notas.length === 0) return { erro: todas ? "Nenhuma nota disponível para exportar." : "Nenhuma nota emitida nesse período." };
    const completas = notas.filter(nota => nota.tipo === "PROC_NFE" && nota.xml?.trim());
    if (completas.length === 0) {
      return { erro: "As notas selecionadas ainda não têm XML completo. Aguarde a recuperação pela SEFAZ ou importe o XML do fornecedor." };
    }
    const zip = new JSZip();
    for (const nota of completas) zip.file(nota.chaveAcesso + ".xml", nota.xml!);
    const conteudoBase64 = await zip.generateAsync({ type: "base64", compression: "DEFLATE" });
    return {
      nomeArquivo: todas ? "notas-fiscais_todas.zip" : "notas-fiscais_" + dataInicio + "_a_" + dataFim + ".zip",
      conteudoBase64,
      quantidade: completas.length,
      semXml: notas.length - completas.length,
    };
  } catch {
    return { erro: "Não foi possível preparar os XMLs. Tente novamente." };
  }
}

// Extrai os itens e as duplicatas do XML sob demanda (só na primeira vez que a nota é
// aberta pra conciliação — nunca durante a sincronização com a SEFAZ) e já pré-concilia
// os itens com InsumoCodigoFornecedor, quando existir memória de um vínculo anterior.
// Idempotente: reabrir a tela nunca duplica itens nem duplicatas — os dois gates são
// independentes porque uma nota pode ter itens extraídos numa versão anterior da
// feature e ainda não ter duplicatas. `detalhes` nunca é persistido, sempre reparseado.
export async function obterItensNotaFiscalAction(
  notaFiscalId: string
): Promise<{ erro: string } | { itens: ItemConciliacaoRow[]; duplicatas: DuplicataRow[]; detalhes: DetalhesFiscaisRow; custos: CustosNotaFiscal; cartoes: CartaoOption[] }> {
  await exigirPermissao("notas", "visualizar");
  const nota = await prisma.notaFiscalRecebida.findUnique({ where: { id: notaFiscalId } });
  if (!nota) return { erro: "Nota não encontrada." };
  if (!nota.xml) return { erro: "Esta nota ainda não tem o XML completo para conciliação. Aguarde a liberação pela SEFAZ e faça uma nova busca." };

  let itensExtraidos: ReturnType<typeof extrairItensNFe>;
  try {
    itensExtraidos = extrairItensNFe(nota.xml);
  } catch {
    return { erro: "Não foi possível ler os itens desta nota." };
  }
  if (itensExtraidos.length === 0) {
    return { erro: "Esta nota não tem itens de produto pra conciliar." };
  }

  const existentes = await prisma.notaFiscalItem.count({ where: { notaFiscalId } });
  if (existentes === 0) {
    const mapeamentos = nota.fornecedorCnpj
      ? await prisma.insumoCodigoFornecedor.findMany({
          where: {
            fornecedorCnpj: nota.fornecedorCnpj,
            codigoProduto: { in: itensExtraidos.map((i) => i.codigoProdutoFornecedor) },
          },
        })
      : [];
    const insumoPorCodigo = new Map(mapeamentos.map((m) => [m.codigoProduto, m.insumoId]));

    await prisma.notaFiscalItem.createMany({
      data: itensExtraidos.map((item) => ({
        notaFiscalId,
        numeroItem: item.numeroItem,
        codigoProdutoFornecedor: item.codigoProdutoFornecedor,
        descricaoProduto: item.descricaoProduto,
        codigoEan: item.codigoEan,
        ncm: item.ncm,
        cfop: item.cfop,
        unidadeComercial: item.unidadeComercial,
        quantidadeComercial: item.quantidadeComercial,
        valorUnitarioComercial: item.valorUnitarioComercial,
        valorTotalItem: item.valorTotalItem,
        insumoId: insumoPorCodigo.get(item.codigoProdutoFornecedor) ?? null,
      })),
    });
  }

  const duplicatasExistentes = await prisma.notaFiscalDuplicata.count({ where: { notaFiscalId } });
  if (duplicatasExistentes === 0) {
    let duplicatasExtraidas: ReturnType<typeof extrairDuplicatasNFe>;
    try {
      duplicatasExtraidas = extrairDuplicatasNFe(nota.xml);
    } catch {
      duplicatasExtraidas = [];
    }
    if (duplicatasExtraidas.length > 0) {
      await prisma.notaFiscalDuplicata.createMany({
        data: duplicatasExtraidas.map((d) => ({
          notaFiscalId,
          numero: d.numero,
          dataVencimento: d.dataVencimento,
          valor: d.valor,
        })),
      });
    }
  }

  const [itens, duplicatas] = await Promise.all([
    prisma.notaFiscalItem.findMany({
      where: { notaFiscalId },
      orderBy: { numeroItem: "asc" },
      include: { insumo: { select: { nome: true, especificacao: true, unidade: true } }, categoriaFinanceira: { select: SELECAO_CATEGORIA_COM_CAMINHO }, movimentacaoEstoque: { select: { createdAt: true } } },
    }),
    prisma.notaFiscalDuplicata.findMany({ where: { notaFiscalId }, orderBy: { dataVencimento: "asc" }, include: { _count: { select: { lancamentos: true } } } }),
  ]);

  const memorias = nota.fornecedorCnpj ? await prisma.insumoCodigoFornecedor.findMany({ where: { fornecedorCnpj: nota.fornecedorCnpj } }) : [];
  const extraidoPorNumeroItem = new Map(itensExtraidos.map((item) => [item.numeroItem, item]));
  const cartoes = await prisma.cartaoCredito.findMany({ where: { OR: [{ ativo: true, contaBancaria: { ativo: true } }, { duplicatas: { some: { notaFiscalId } } }] }, include: { contaBancaria: true }, orderBy: { nome: "asc" } });
  let detalhes: DetalhesFiscaisRow;
  try {
    const extraidos = extrairDetalhesFiscaisNFe(nota.xml);
    const fornecedorCadastrado = await resolverFornecedorNota(prisma, extraidos.emitenteCnpj);
    detalhes = { ...extraidos, fornecedorCadastrado };
  } catch {
    detalhes = {
      naturezaOperacao: null,
      modelo: null,
      serie: null,
      numero: null,
      codigoUnico: null,
      versao: null,
      emitenteCnpj: null,
      emitenteNome: null,
      emitenteEndereco: { logradouro: null, numero: null, bairro: null, municipio: null, uf: null },
      fornecedorCadastrado: null,
    };
  }

  let custos: CustosNotaFiscal;
  try { custos = extrairCustosNFe(nota.xml); }
  catch { return { erro: "Não foi possível ler os custos desta nota." }; }
  return {
    custos,
    itens: itens.map((item) => {
      const itemXml = extraidoPorNumeroItem.get(item.numeroItem);
      const quantidadeTributavel = itemXml?.quantidadeTributavel ?? null;
      const unidadeTributavel = itemXml?.unidadeTributavel ?? null;
      return {
        id: item.id,
        numeroItem: item.numeroItem,
        codigoProdutoFornecedor: item.codigoProdutoFornecedor,
        descricaoProduto: item.descricaoProduto,
        codigoEan: item.codigoEan,
        ncm: item.ncm,
        unidadeComercial: item.unidadeComercial,
        quantidadeComercial: Number(item.quantidadeComercial),
        unidadeTributavel,
        quantidadeTributavel,
        fatorConversao: (() => {
          if (
            item.insumo?.unidade === "KG" &&
            unidadeTributavel?.trim().toUpperCase() === "KG" &&
            quantidadeTributavel != null &&
            Number.isFinite(quantidadeTributavel) &&
            quantidadeTributavel > 0 &&
            Number(item.quantidadeComercial) > 0
          ) {
            return quantidadeTributavel / Number(item.quantidadeComercial);
          }
          const memoria = memorias.find(m => m.codigoProduto === item.codigoProdutoFornecedor && m.insumoId === item.insumoId && m.unidadeComercial === item.unidadeComercial && m.unidadeEstoque === item.insumo?.unidade);
          return memoria?.fatorConversao != null ? Number(memoria.fatorConversao) : null;
        })(),
        valorUnitarioComercial: item.valorUnitarioComercial != null ? Number(item.valorUnitarioComercial) : null,
        valorTotalItem: Number(item.valorTotalItem),
        composicaoCusto: lerComposicaoCusto(item.composicaoCusto),
        status: item.status,
        destino: item.destino,
        insumoId: item.insumoId,
        insumoNome: item.insumo?.nome ?? null,
        insumoEspecificacao: item.insumo?.especificacao ?? null,
        categoriaFinanceiraId: item.categoriaFinanceiraId,
        categoriaFinanceiraNome: item.categoriaFinanceira ? caminhoCategoria(item.categoriaFinanceira) : null,
        quantidadeConciliada: item.quantidadeConciliada != null ? Number(item.quantidadeConciliada) : null,
        dataEntradaEstoque: item.movimentacaoEstoque ? diaEntradaEstoque(item.movimentacaoEstoque.createdAt) : null,
        valorTotalConciliado: item.valorTotalConciliado != null ? Number(item.valorTotalConciliado) : null,
      };
    }),
    duplicatas: duplicatas.map((d) => ({
      id: d.id,
      numero: d.numero,
      dataVencimento: d.dataVencimento.toISOString().slice(0, 10),
      valor: Number(d.valor),
      formaPagamento: d.formaPagamento as PagamentoNota["formaPagamento"], cartaoCreditoId: d.cartaoCreditoId, dataCompra: d.dataCompra?.toISOString().slice(0, 10) ?? null, parcelaCartao: d.parcelaCartao, bloqueada: d._count.lancamentos > 0,
    })),
    detalhes,
    cartoes: cartoes.map(c => ({ id: c.id, nome: c.nome, contaBancariaId: c.contaBancariaId, contaBancariaNome: c.contaBancaria.nome, diaFechamento: c.diaFechamento, diaVencimento: c.diaVencimento, ativo: c.ativo && c.contaBancaria.ativo })),
  };
}

export type ItemConciliacaoInput =
  | { notaFiscalItemId: string; acao: "IGNORAR" }
  | {
      notaFiscalItemId: string;
      acao: "CONCILIAR";
      destino: "ESTOQUE";
      insumoId: string;
      quantidade: number;
      fatorConversao?: number;
      valorTotal: number;
      modoCusto: ModoCustoEntrada;
    }
  | {
      notaFiscalItemId: string;
      acao: "CONCILIAR";
      destino: "USO_E_CONSUMO";
      categoriaFinanceiraId: string;
      valorTotal: number;
    };

export type DuplicataInput = PagamentoNota & { id?: string; numero: string; dataVencimento: string; valor: number };

export type ResultadoConciliacaoNota = { erro: string } | { ok: true; movimentacoesCriadas: number };

// Erro com mensagem segura pra mostrar direto ao usuário (validação de negócio dentro
// da transação) — qualquer outro erro dentro da transação vira a mensagem genérica no
// catch, pra nunca vazar detalhe interno (ex: erro de driver do banco).
class ErroValidacaoConciliacao extends Error {}

// Divide o valor de um item proporcionalmente ao peso de cada duplicata na SOMA das
// duplicatas informadas (não no valor total da nota) — garante que a soma das partes
// sempre feche em exatamente `valorItem`, mesmo se o usuário editou as parcelas e a
// soma delas divergir do valor original da nota. Os maiores restos recebem os centavos restantes, sem gerar parcela negativa.
function ratearPorDuplicatas(
  valorItem: number,
  duplicatas: { id: string; valor: number }[]
): { duplicataId: string; valor: number }[] {
  const valores = ratearValor(valorItem, duplicatas.map(d => d.valor));
  return duplicatas.map((d, indice) => ({ duplicataId: d.id, valor: valores[indice] }));
}

// Confirma a conciliação: sincroniza as duplicatas (parcelas de pagamento) editadas
// pelo usuário, depois por item: destino ESTOQUE gera MovimentacaoEstoque
// (ENTRADA_COMPRA) uma única vez e memoriza o vínculo fornecedor+código→Insumo pras
// próximas notas; destino USO_E_CONSUMO não toca estoque. Em ambos os casos o valor do
// item é rateado proporcionalmente entre as duplicatas, gerando 1 LancamentoFinanceiro
// por parcela (categoria CMV padrão pra Estoque, ou a escolhida pra Uso e Consumo).
// Idempotente: um item que não estiver mais PENDENTE (já processado numa confirmação
// anterior) é pulado silenciosamente, protegendo contra duplo-clique/duplo-submit.
export async function confirmarConciliacaoNotaAction(input: {
  notaFiscalId: string;
  localId: string;
  dataEntradaEstoque?: string;
  itens: ItemConciliacaoInput[];
  duplicatas: DuplicataInput[];
  distribuicaoDesconto?: DistribuicaoDesconto;
}): Promise<ResultadoConciliacaoNota> {
  await exigirPermissao("notas.manifestar", "editar");
  await exigirPermissao("notas", "visualizar");
  const paraConciliar = input.itens.filter(
    (i): i is Extract<ItemConciliacaoInput, { acao: "CONCILIAR" }> => i.acao === "CONCILIAR"
  );
  const paraEstoque = paraConciliar.filter((i) => i.destino === "ESTOQUE");
  const paraUsoConsumo = paraConciliar.filter((i) => i.destino === "USO_E_CONSUMO");
  const entradaEstoque = paraEstoque.length > 0 ? validarDataEntradaEstoque(input.dataEntradaEstoque) : null;
  if (entradaEstoque && "erro" in entradaEstoque) return entradaEstoque;

  if (paraEstoque.length > 0 && !input.localId) return { erro: "Selecione o local de estoque." };
  if (paraEstoque.some((i) => !i.insumoId)) return { erro: "Selecione um insumo pra cada item de estoque." };
  if (paraEstoque.some((i) => !Number.isFinite(i.quantidade) || i.quantidade <= 0)) {
    return { erro: "Informe uma quantidade maior que zero pra cada item de estoque." };
  }
  if (paraUsoConsumo.some((i) => !i.categoriaFinanceiraId)) {
    return { erro: "Selecione uma categoria financeira pra cada item de uso e consumo." };
  }
  if (paraConciliar.some((i) => !Number.isFinite(i.valorTotal) || i.valorTotal < 0)) {
    return { erro: "Informe o valor total de cada item conciliado." };
  }

  const duplicatasValidas = input.duplicatas.filter(
    (d) => d.numero.trim() !== "" && Number.isFinite(d.valor) && d.valor > 0 && FORMATO_DATA.test(d.dataVencimento)
  );
  if (duplicatasValidas.length !== input.duplicatas.length) return { erro: "Preencha todas as parcelas corretamente." };
  if (paraConciliar.length > 0 && duplicatasValidas.length === 0) {
    return { erro: "Informe ao menos uma parcela (duplicata) válida." };
  }

  const session = await getSession();
  if (!session) return { erro: "Sua sessão expirou. Entre novamente." };

  try {
    const movimentacoesCriadas = await prisma.$transaction(async (tx) => {
      // Serializa a gravação local da mesma nota, inclusive em envios concorrentes.
      await tx.$queryRaw`SELECT id FROM "NotaFiscalRecebida" WHERE id = ${input.notaFiscalId} FOR UPDATE`;
      const nota = await tx.notaFiscalRecebida.findUniqueOrThrow({ where: { id: input.notaFiscalId } });
      if (nota.ultimaManifestacao !== "CONFIRMACAO_DA_OPERACAO") throw new ErroValidacaoConciliacao("Use Aceitar nota. Notas pendentes ou recusadas não geram estoque nem despesas.");
      if (await tx.cancelamentoCompra.findUnique({ where: { chaveOrigem: chaveCompra({ tipo: "NOTA", id: nota.id }) } })) throw new ErroValidacaoConciliacao("Esta compra foi cancelada e não pode gerar novamente estoque ou despesas.");
      const registrosCustos = nota.xml || input.distribuicaoDesconto
        ? await tx.notaFiscalItem.findMany({ where: { notaFiscalId: input.notaFiscalId } }) : [];
      const custosValidados = validarCustosConciliacao(nota.xml, registrosCustos, input.itens, input.distribuicaoDesconto);
      if ("erro" in custosValidados) throw new ErroValidacaoConciliacao(custosValidados.erro);
      const dataBase = nota.dataEmissao ?? new Date();

      // 1) Sincroniza as duplicatas antes de tudo — bloqueia remover uma que já gerou
      // lançamento (rastro fica em NotaFiscalItemLancamento).
      const duplicatasAtuais = await tx.notaFiscalDuplicata.findMany({
        where: { notaFiscalId: input.notaFiscalId },
        include: { _count: { select: { lancamentos: true } } },
      });
      const idsInformados = new Set(duplicatasValidas.filter((d) => d.id).map((d) => d.id));
      if (duplicatasValidas.some((d) => d.id && !duplicatasAtuais.some((atual) => atual.id === d.id))) {
        throw new ErroValidacaoConciliacao("Há parcelas de outra nota. Reabra o painel.");
      }
      for (const atual of duplicatasAtuais) {
        if (!idsInformados.has(atual.id)) {
          if (atual._count.lancamentos > 0) {
            throw new ErroValidacaoConciliacao(
              `A parcela "${atual.numero}" já tem lançamento financeiro gerado e não pode ser removida.`
            );
          }
          await tx.notaFiscalDuplicata.delete({ where: { id: atual.id } });
        }
      }
      const pagamentos = new Map<string, { contaBancariaId: string | null; formaPagamentoId: string }>();
      for (const d of duplicatasValidas) {
        const atual = duplicatasAtuais.find(p => p.id === d.id);
        if (atual && atual._count.lancamentos > 0) {
          if (atual.numero !== d.numero || Number(atual.valor) !== d.valor || atual.dataVencimento.toISOString().slice(0, 10) !== d.dataVencimento || !pagamentoIgual(atual, d)) throw new ErroValidacaoConciliacao("Uma parcela já lançada não pode ser alterada.");
          continue;
        }
        let preparado;
        try { preparado = await prepararPagamento(tx, d); } catch (erro) { throw new ErroValidacaoConciliacao(erro instanceof Error ? erro.message : "Pagamento inválido."); }
        const { contaBancariaId, ...dadosPagamento } = preparado;
        const nomeForma = { BOLETO: "Boleto", PIX: "Pix", CARTAO: "Cartão de crédito" }[preparado.formaPagamento];
        const forma = await tx.formaPagamento.upsert({ where: { nome: nomeForma }, create: { nome: nomeForma }, update: {} });
        let idParcela = d.id;
        if (d.id) {
          await tx.notaFiscalDuplicata.update({
            where: { id: d.id },
            data: { numero: d.numero, valor: d.valor, ...dadosPagamento },
          });
        } else {
          const criada = await tx.notaFiscalDuplicata.create({
            data: {
              notaFiscalId: input.notaFiscalId,
              numero: d.numero,
              ...dadosPagamento,
              valor: d.valor,
            },
          });
          idParcela = criada.id;
        }
        pagamentos.set(idParcela!, { contaBancariaId, formaPagamentoId: forma.id });
      }
      const duplicatasFinais = await tx.notaFiscalDuplicata.findMany({
        where: { notaFiscalId: input.notaFiscalId },
        orderBy: { dataVencimento: "asc" },
      });
      for (const d of duplicatasFinais) {
        if (pagamentos.has(d.id)) continue;
        const nome = d.formaPagamento === "CARTAO" ? "Cartão de crédito" : d.formaPagamento === "PIX" ? "Pix" : "Boleto";
        const forma = await tx.formaPagamento.upsert({ where: { nome }, create: { nome }, update: {} });
        const anterior = await tx.notaFiscalItemLancamento.findFirst({ where: { notaFiscalDuplicataId: d.id }, include: { lancamentoFinanceiro: true } });
        pagamentos.set(d.id, { formaPagamentoId: forma.id, contaBancariaId: anterior?.lancamentoFinanceiro.contaBancariaId ?? null });
      }
      const duplicatasParaRateio = duplicatasFinais.map((d) => ({ id: d.id, valor: Number(d.valor) }));

      const fornecedor = await resolverFornecedorNota(tx, nota.fornecedorCnpj);

      let criadas = 0;
      for (const acaoItem of input.itens) {
        const item = await tx.notaFiscalItem.findUnique({ where: { id: acaoItem.notaFiscalItemId } });
        if (!item || item.notaFiscalId !== input.notaFiscalId || item.status !== "PENDENTE") continue;

        if (acaoItem.acao === "IGNORAR") {
          await tx.notaFiscalItem.update({ where: { id: item.id }, data: { status: "IGNORADO" } });
          continue;
        }

        const composicaoCusto = custosValidados.composicoes.get(item.id);
        const partes = ratearPorDuplicatas(acaoItem.valorTotal, duplicatasParaRateio);

        if (acaoItem.destino === "ESTOQUE") {
          const categoriaEstoque = await resolverCategoriaCompraInsumo(tx, acaoItem.insumoId);
          if ("erro" in categoriaEstoque) throw new ErroValidacaoConciliacao(categoriaEstoque.erro);
          if (acaoItem.fatorConversao !== undefined && (!Number.isFinite(acaoItem.fatorConversao) || acaoItem.fatorConversao <= 0 || acaoItem.fatorConversao >= 1000000000 || Math.abs(Math.round(Number(item.quantidadeComercial) * acaoItem.fatorConversao * 1000) / 1000 - acaoItem.quantidade) > 0.000001)) throw new ErroValidacaoConciliacao("Confira o fator de conversão e a quantidade do item.");
          const resultado = await registrarMovimentacao({
            insumoId: acaoItem.insumoId,
            localId: input.localId,
            tipo: "ENTRADA_COMPRA",
            data: entradaEstoque && "data" in entradaEstoque ? entradaEstoque.data : undefined,
            quantidade: acaoItem.quantidade,
            custoUnitario: acaoItem.valorTotal / acaoItem.quantidade,
            modoCusto: acaoItem.modoCusto,
            considerarCustoZero: !!composicaoCusto,
            valorTotal: acaoItem.valorTotal,
            dataVencimento: dataBase,
            observacao: `NF-e ${nota.chaveAcesso} — item ${item.numeroItem}: ${item.descricaoProduto}`,
            criadoPorId: session?.userId ?? null,
            tx,
          });
          criadas++;

          for (const [indice, parte] of partes.entries()) {
              if (parte.valor <= 0) continue;
              const duplicata = duplicatasFinais.find((d) => d.id === parte.duplicataId)!;
              const lancamento = await tx.lancamentoFinanceiro.create({
                data: {
                  tipo: "DESPESA",
                  descricao: paraCaixaAlta(`NF-e ${nota.chaveAcesso} — ${item.descricaoProduto}`),
                  valor: parte.valor,
                  categoriaId: categoriaEstoque.id,
                  dataCompetencia: dataBase,
                  dataVencimento: duplicata.dataVencimento,
                  ...pagamentos.get(duplicata.id), cartaoCreditoId: duplicata.cartaoCreditoId,
                  fornecedorId: fornecedor?.id ?? null,
                  contraparteNome: fornecedor ? null : paraCaixaAltaOpcional(nota.fornecedorNome),
                  criadoPorId: session?.userId ?? null,
                  origemMovimentacaoEstoqueId: indice === 0 ? resultado.movimentacaoId : null,
                },
              });
              await tx.notaFiscalItemLancamento.create({
                data: {
                  notaFiscalItemId: item.id,
                  notaFiscalDuplicataId: parte.duplicataId,
                  lancamentoFinanceiroId: lancamento.id,
                  valor: parte.valor,
                },
              });
          }

          await tx.notaFiscalItem.update({
            where: { id: item.id },
            data: {
              status: "CONCILIADO",
              destino: "ESTOQUE",
              insumoId: acaoItem.insumoId,
              categoriaFinanceiraId: categoriaEstoque.id,
              quantidadeConciliada: acaoItem.quantidade,
              valorTotalConciliado: acaoItem.valorTotal,
              ...(composicaoCusto ? { composicaoCusto } : {}),
              movimentacaoEstoqueId: resultado.movimentacaoId,
            },
          });

          // Memoriza o vínculo — a próxima nota deste fornecedor com o mesmo código já
          // vem pré-conciliada em obterItensNotaFiscalAction.
          if (nota.fornecedorCnpj) {
            const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: acaoItem.insumoId }, select: { unidade: true } });
            const fator = acaoItem.fatorConversao ?? (Number(item.quantidadeComercial) > 0 ? acaoItem.quantidade / Number(item.quantidadeComercial) : null);
            const conversao = { fatorConversao: fator, unidadeComercial: item.unidadeComercial, unidadeEstoque: insumo.unidade };
            await tx.insumoCodigoFornecedor.upsert({
              where: {
                fornecedorCnpj_codigoProduto: { fornecedorCnpj: nota.fornecedorCnpj, codigoProduto: item.codigoProdutoFornecedor },
              },
              update: { insumoId: acaoItem.insumoId, ...conversao },
              create: {
                fornecedorCnpj: nota.fornecedorCnpj,
                codigoProduto: item.codigoProdutoFornecedor,
                ...conversao,
                insumoId: acaoItem.insumoId,
              },
            });
          }
          // Homologa o insumo com o fornecedor da nota automaticamente, se ele já estiver
          // cadastrado — passa a aparecer nos Pedidos de Compra desse fornecedor também.
          if (fornecedor) {
            await tx.insumoFornecedor.upsert({
              where: { insumoId_fornecedorId: { insumoId: acaoItem.insumoId, fornecedorId: fornecedor.id } },
              update: {},
              create: { insumoId: acaoItem.insumoId, fornecedorId: fornecedor.id },
            });
          }
        } else {
          const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: acaoItem.categoriaFinanceiraId }, select: { ativo: true, excluidoEm: true, grupo: true } });
          if (!categoria?.ativo || categoria.excluidoEm || GRUPOS_RECEITA.includes(categoria.grupo)) throw new ErroValidacaoConciliacao("Selecione uma categoria de despesa ativa para cada item de uso e consumo.");
          // USO_E_CONSUMO — não entra em estoque, vira despesa direta na categoria escolhida.
          for (const parte of partes) {
            if (parte.valor <= 0) continue;
            const duplicata = duplicatasFinais.find((d) => d.id === parte.duplicataId)!;
            const lancamento = await tx.lancamentoFinanceiro.create({
              data: {
                tipo: "DESPESA",
                descricao: paraCaixaAlta(`NF-e ${nota.chaveAcesso} — ${item.descricaoProduto}`),
                valor: parte.valor,
                categoriaId: acaoItem.categoriaFinanceiraId,
                dataCompetencia: dataBase,
                dataVencimento: duplicata.dataVencimento,
                  ...pagamentos.get(duplicata.id), cartaoCreditoId: duplicata.cartaoCreditoId,
                fornecedorId: fornecedor?.id ?? null,
                contraparteNome: fornecedor ? null : paraCaixaAltaOpcional(nota.fornecedorNome),
                criadoPorId: session?.userId ?? null,
              },
            });
            await tx.notaFiscalItemLancamento.create({
              data: {
                notaFiscalItemId: item.id,
                notaFiscalDuplicataId: parte.duplicataId,
                lancamentoFinanceiroId: lancamento.id,
                valor: parte.valor,
              },
            });
          }

          await tx.notaFiscalItem.update({
            where: { id: item.id },
            data: {
              status: "CONCILIADO",
              destino: "USO_E_CONSUMO",
              insumoId: null,
              categoriaFinanceiraId: acaoItem.categoriaFinanceiraId,
              quantidadeConciliada: null,
              valorTotalConciliado: acaoItem.valorTotal,
              ...(composicaoCusto ? { composicaoCusto } : {}),
              movimentacaoEstoqueId: null,
            },
          });
        }
      }
      return criadas;
    });

    revalidatePath("/notas-fiscais");
    revalidatePath("/inventario");
    revalidatePath("/inventario/movimentacoes");
    revalidatePath("/financeiro/contas");
    revalidatePath("/financeiro/movimentacoes");
    revalidatePath("/financeiro/lancamentos");
    revalidatePath("/financeiro");
    revalidatePath("/insumos");
    revalidatePath("/fornecedores");
    revalidatePath("/compras");
    return { ok: true, movimentacoesCriadas };
  } catch (erro) {
    if (erro instanceof ErroValidacaoConciliacao) return { erro: erro.message };
    return { erro: "Não foi possível confirmar a conciliação." };
  }
}

// Usado pelo dialog de conciliação depois de criar um insumo novo inline: devolve os
// dados mínimos pra montar a opção no combobox sem precisar recarregar a página.
export async function obterInsumoOptionAction(
  insumoId: string
): Promise<{ id: string; nome: string; especificacao: string | null; unidade: UnidadeMedida } | null> {
  await exigirPermissao("insumos", "visualizar");
  return prisma.insumo.findUnique({ where: { id: insumoId }, select: { id: true, nome: true, especificacao: true, unidade: true } });
}
