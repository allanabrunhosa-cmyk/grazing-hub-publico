import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import { SELECAO_CATEGORIA_COM_CAMINHO } from "@/lib/financeiro/caminho-categoria";
import { travarCustosEntrega, exigirDespesaSemCustoEntrega } from "@/lib/financeiro/custos-entrega";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { DecimalEstoque } from "@/lib/estoque/quantidade";
import { resolverCategoriaCompraInsumo } from "@/lib/insumos/categoria-financeira";
import { GRUPOS_RECEITA } from "@/lib/labels";
import { registrarAtividade } from "@/lib/atividades/registro";
import { diaEntradaEstoque, validarDataEntradaEstoque } from "./data-entrada";
import { prepararPagamento, pagamentoIgual } from "./pagamentos";
import { centavos, ratearItensPorDuplicatas, type ComposicaoCusto } from "./custos";
import { validarConciliacao, type EntradaConciliacao } from "./validar-conciliacao";
import { validarCustosConciliacao } from "./validar-custos";
import { resolverFornecedorNota } from "./fornecedor";

export class ErroCorrecaoNota extends Error {}
export type EntradaCorrecaoNota = EntradaConciliacao & { versao: string; motivo: string };
const json = (valor: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(valor));
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
function falhar(mensagem: string): never { throw new ErroCorrecaoNota(mensagem); }

export async function consultarCorrecaoNota(tx: Prisma.TransactionClient, notaFiscalId: string) {
  const [nota, ultimaCorrecao] = await Promise.all([
    tx.notaFiscalRecebida.findUnique({ where: { id: notaFiscalId }, include: {
      itens: { orderBy: { numeroItem: "asc" }, include: {
        insumo: { select: { nome: true, especificacao: true, unidade: true } },
        categoriaFinanceira: { select: SELECAO_CATEGORIA_COM_CAMINHO },
        movimentacaoEstoque: { include: { estornoCompra: true } },
        lancamentos: { orderBy: { id: "asc" }, include: { lancamentoFinanceiro: { include: {
          movimentacaoBancaria: true, vinculoExtrato: true, liquidacoesCartao: { include: { pagamento: true } },
        } } } },
      } },
      duplicatas: { orderBy: [{ dataVencimento: "asc" }, { id: "asc" }] },
    } }),
    tx.historicoAcesso.findFirst({ where: { entidade: "NOTA_FISCAL", entidadeId: notaFiscalId, acao: "CORRECAO_LOCAL" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
  ]);
  return { nota, ultimaCorrecao, versao: hash({ nota, ultimaCorrecaoId: ultimaCorrecao?.id }) };
}
export type EstadoCorrecaoNota = Awaited<ReturnType<typeof consultarCorrecaoNota>>;

export function dataRecebimentoCorrigida(estado: Pick<EstadoCorrecaoNota, "ultimaCorrecao">, itemId: string, original?: Date | null, dataRecebimento?: Date | null) {
  if (dataRecebimento) return dataRecebimento.toISOString().slice(0, 10);
  const depois = estado.ultimaCorrecao?.depois as { recebimentos?: Record<string, string> } | null;
  return depois?.recebimentos?.[itemId] ?? (original ? diaEntradaEstoque(original) : null);
}

function validarEntrada(input: EntradaCorrecaoNota) {
  if (!input || typeof input.notaFiscalId !== "string" || !input.notaFiscalId || input.notaFiscalId.length > 100
    || typeof input.versao !== "string" || !/^[a-f0-9]{64}$/.test(input.versao)
    || typeof input.motivo !== "string" || input.motivo.trim().length < 15 || input.motivo.trim().length > 255 || /[\u0000-\u001f]/.test(input.motivo)
    || !Array.isArray(input.itens) || !input.itens.length || input.itens.length > 1000 || !Array.isArray(input.duplicatas) || input.duplicatas.length > 120) falhar("Reabra a nota e informe um motivo de 15 a 255 caracteres para a correção.");
  if (input.itens.some(i => !i || typeof i.notaFiscalItemId !== "string" || i.notaFiscalItemId.length > 100)) falhar("Itens inválidos. Reabra a nota.");
  if (input.duplicatas.some(d => !d || typeof d.numero !== "string" || d.numero.length > 60 || /[\u0000-\u001f]/.test(d.numero) || !Number.isFinite(d.valor) || d.valor >= 1e12 || Math.abs(d.valor * 100 - Math.round(d.valor * 100)) > .00001)) falhar("Confira o número e o valor das parcelas, com até duas casas decimais.");
  if (input.itens.some(i => i.acao === "CONCILIAR" && (!Number.isFinite(i.valorTotal) || i.valorTotal >= 1e12 || Math.abs(i.valorTotal * 100 - Math.round(i.valorTotal * 100)) > .00001 || (i.destino === "ESTOQUE" && (!Number.isFinite(i.quantidade) || i.quantidade >= 1e9 || Math.abs(i.quantidade * 1000 - Math.round(i.quantidade * 1000)) > .00001))))) falhar("Confira valores com duas casas e quantidades com até três casas decimais.");
  // Local e data vazios preservam os dados de cada item, inclusive notas recebidas em locais distintos.
  const erro = validarConciliacao({ ...input, localId: input.localId || "preservar", dataEntradaEstoque: input.dataEntradaEstoque || diaEntradaEstoque(), itens: input.itens.filter(i => i.acao !== "IGNORAR") });
  if (erro) falhar(erro);
  if (new Set(input.itens.map(i => i.notaFiscalItemId)).size !== input.itens.length) falhar("Há itens repetidos. Reabra a nota.");
}

export async function corrigirNotaNaTransacao(tx: Prisma.TransactionClient, input: EntradaCorrecaoNota, sessao: SessaoAtual) {
  validarEntrada(input);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) falhar("Sua sessão expirou. Entre novamente.");
  const pode = (recurso: string, acao: "visualizar" | "editar" | "adicionar" | "excluir") => usuario.perfilAcesso?.sistema === "ADMINISTRADOR"
    || permissaoEfetiva((usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, (usuario.permissoesPersonalizadas ?? {}) as Excecoes, recurso, acao);
  if (!pode("notas", "visualizar") || !pode("notas.manifestar", "editar")) falhar("Seu acesso não permite corrigir esta nota.");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('financeiro-cartoes'))`;
  await travarCustosEntrega(tx);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estoque-reservas-pedidos'))`;
  const [trava] = await tx.$queryRaw<{ obtida: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('aceite-nota'), hashtext(${input.notaFiscalId})) AS obtida`;
  if (!trava?.obtida) falhar("Esta nota já está sendo atualizada. Aguarde e reabra o detalhe.");
  await tx.$queryRaw`SELECT id FROM "NotaFiscalRecebida" WHERE id = ${input.notaFiscalId} FOR UPDATE`;
  const ids = await tx.lancamentoFinanceiro.findMany({ where: { notaFiscalItemLancamento: { notaFiscalItem: { notaFiscalId: input.notaFiscalId } } }, select: { id: true }, orderBy: { id: "asc" } });
  if (ids.length) await tx.$queryRaw(Prisma.sql`SELECT id FROM "LancamentoFinanceiro" WHERE id IN (${Prisma.join(ids.map(l => l.id))}) ORDER BY id FOR UPDATE`);
  const estado = await consultarCorrecaoNota(tx, input.notaFiscalId);
  const notaLida = estado.nota;
  if (!notaLida || notaLida.ultimaManifestacao !== "CONFIRMACAO_DA_OPERACAO") falhar("Somente uma nota aceita pode ter suas informações locais corrigidas.");
  if (notaLida.tratamentoLocal) falhar("Reabra o tratamento local desta nota antes de corrigir informações da compra. A edição não reativa notas ignoradas ou devolvidas.");
  // Títulos cancelados conservam sua história; não são candidatos à edição nem à reativação.
  const nota = { ...notaLida, itens: notaLida.itens.map(i => ({ ...i, lancamentos: i.lancamentos.filter(l => l.lancamentoFinanceiro.status !== "CANCELADO") })) };
  const financeiroCancelado = new Set(notaLida.itens.filter(i => i.lancamentos.length && i.lancamentos.every(l => l.lancamentoFinanceiro.status === "CANCELADO")).map(i => i.id));
  if (await tx.cancelamentoCompra.findUnique({ where: { chaveOrigem: "NOTA:" + nota.id } })) falhar("Esta compra foi cancelada e não pode ser reativada pela edição.");
  const hashOperacao = hash({ autorId: usuario.id, input });
  if (estado.versao !== input.versao) {
    const antes = estado.ultimaCorrecao?.antes as { versao?: string } | null;
    const depois = estado.ultimaCorrecao?.depois as { hashOperacao?: string } | null;
    if (estado.ultimaCorrecao?.autorId === usuario.id && antes?.versao === input.versao && depois?.hashOperacao === hashOperacao) return;
    falhar("Esta nota ou seus lançamentos foram alterados. Reabra o detalhe antes de salvar.");
  }
  if (input.itens.length !== nota.itens.length || input.itens.some(i => !nota.itens.some(a => a.id === i.notaFiscalItemId))) falhar("Os itens da nota mudaram. Reabra o detalhe.");
  if (input.duplicatas.some(d => d.id && !nota.duplicatas.some(a => a.id === d.id))) falhar("Há parcelas de outra nota. Reabra o detalhe.");
  if (input.itens.some(i => i.acao === "IGNORAR" && nota.itens.some(a => a.id === i.notaFiscalItemId && (a.status !== "IGNORADO" || a.movimentacaoEstoqueId || a.lancamentos.length)))) falhar("Um item já integrado não pode ser ignorado pela edição.");
  const valoresMudaram = input.itens.some(acao => acao.acao === "CONCILIAR" && nota.itens.some(item => item.id === acao.notaFiscalItemId && (item.status !== "CONCILIADO" || item.valorTotalConciliado == null || !item.valorTotalConciliado.equals(acao.valorTotal))));
  // Revisão de pagamento, recebimento ou insumo não recalcula custos históricos nem exige uma composição ausente no legado.
  const custos = valoresMudaram ? validarCustosConciliacao(nota.xml, nota.itens.map(i => ({ ...i, status: input.itens.some(acao => acao.notaFiscalItemId === i.id && acao.acao === "CONCILIAR") ? "PENDENTE" : i.status })), input.itens, input.distribuicaoDesconto) : { composicoes: new Map<string, ComposicaoCusto>() };
  if ("erro" in custos) falhar(custos.erro);
  const total = input.itens.reduce((s, i) => s + (i.acao === "CONCILIAR" ? centavos(i.valorTotal) : 0), 0);
  const valoresParcelasMudaram = input.duplicatas.length !== nota.duplicatas.length || input.duplicatas.some(d => !nota.duplicatas.some(a => a.id === d.id && a.valor.equals(d.valor)));
  if ((valoresMudaram || valoresParcelasMudaram) && input.duplicatas.reduce((s, d) => s + centavos(d.valor), 0) !== total) falhar("O total das parcelas deve ser igual ao total dos itens integrados.");

  const preparadas: { entrada: EntradaConciliacao["duplicatas"][number]; atual: typeof nota.duplicatas[number] | undefined; preparado: Omit<Awaited<ReturnType<typeof prepararPagamento>>, "formaPagamento"> & { formaPagamento: string }; formaId: string; pagamentoMudou: boolean }[] = [];
  for (const d of input.duplicatas) {
    const atual = nota.duplicatas.find(a => a.id === d.id);
    const anterior = nota.itens.flatMap(i => i.lancamentos).find(l => l.notaFiscalDuplicataId === d.id)?.lancamentoFinanceiro;
    const pagamentoMudou = !atual || !pagamentoIgual(atual, d) || atual.dataVencimento.toISOString().slice(0, 10) !== d.dataVencimento;
    let preparado;
    if (!pagamentoMudou && atual) preparado = { formaPagamento: atual.formaPagamento, cartaoCreditoId: atual.cartaoCreditoId, dataCompra: atual.dataCompra, parcelaCartao: atual.parcelaCartao, dataVencimento: atual.dataVencimento, contaBancariaId: anterior?.contaBancariaId ?? null };
    else { try { preparado = await prepararPagamento(tx, d); } catch (e) { falhar(e instanceof Error ? e.message : "Pagamento inválido."); } }
    const nome = preparado.formaPagamento === "CARTAO" ? "Cartão de crédito" : preparado.formaPagamento === "PIX" ? "Pix" : "Boleto";
    const forma = await tx.formaPagamento.upsert({ where: { nome }, create: { nome }, update: {} });
    preparadas.push({ entrada: { ...d }, atual, preparado, formaId: anterior && !pagamentoMudou ? anterior.formaPagamentoId ?? forma.id : forma.id, pagamentoMudou });
  }

  const itensParaRateio = nota.itens.flatMap(item => {
    const acao = input.itens.find(i => i.notaFiscalItemId === item.id)!;
    return acao.acao === "CONCILIAR" && !financeiroCancelado.has(item.id) ? [{ item, acao }] : [];
  });
  const refazerExistentes = valoresParcelasMudaram || itensParaRateio.some(({ item, acao }) => item.lancamentos.length > 0 && (item.valorTotalConciliado == null || !item.valorTotalConciliado.equals(acao.valorTotal)));
  // Incluir um item pendente ou antes ignorado não modifica os títulos dos itens
  // já integrados. Seus centavos são fixos, inclusive se houver baixa ou vínculo.
  const fixos = new Set(refazerExistentes ? [] : itensParaRateio.filter(({ item }) => item.status === "CONCILIADO" && item.lancamentos.length > 0).map(({ item }) => item.id));
  const rateios = new Map<string, number[]>();
  for (const { item } of itensParaRateio) if (fixos.has(item.id)) {
    rateios.set(item.id, preparadas.map(p => item.lancamentos.reduce((soma, elo) => soma + (elo.notaFiscalDuplicataId === p.entrada.id ? centavos(Number(elo.lancamentoFinanceiro.valor)) : 0), 0) / 100));
  }
  const valoresAnteriores = preparadas.map((_, indice) => [...rateios.values()].reduce((soma, linha) => soma + centavos(linha[indice]), 0) / 100);
  const itensNovos = itensParaRateio.filter(({ item }) => !fixos.has(item.id));
  const matrizRateio = ratearItensPorDuplicatas(itensNovos.map(({ acao }) => acao.valorTotal), preparadas.map(p => p.entrada.valor), valoresAnteriores);
  itensNovos.forEach(({ item }, indice) => rateios.set(item.id, matrizRateio[indice]));

  type Item = typeof nota.itens[number];
  type Titulo = Item["lancamentos"][number]["lancamentoFinanceiro"];
  const protegido = (l: Titulo) => l.status !== "PENDENTE" || !!l.itemFaturaId || !!l.movimentacaoBancaria || !!l.vinculoExtrato || !!l.pedidoVendaId || l.liquidacoesCartao.some(q => !q.pagamento.revertidoEm);
  const categorias = new Map<string, string>();
  const alteracoesFinanceiras: { id: string }[] = [];
  let precisaAdicionarTitulo = false;
  let precisaCancelarTitulo = false;
  for (const item of nota.itens) {
    const acao = input.itens.find(i => i.notaFiscalItemId === item.id)!;
    if (acao.acao === "IGNORAR") continue;
    let categoriaId = item.categoriaFinanceiraId;
    if (acao.destino === "ESTOQUE") {
      if (!categoriaId || item.insumoId !== acao.insumoId || item.destino !== "ESTOQUE") {
        const categoria = await resolverCategoriaCompraInsumo(tx, acao.insumoId);
        if ("erro" in categoria) falhar(categoria.erro);
        categoriaId = categoria.id;
      }
      if (acao.fatorConversao !== undefined && (!Number.isFinite(acao.fatorConversao) || acao.fatorConversao <= 0 || acao.fatorConversao >= 1e9 || Math.abs(Math.round(Number(item.quantidadeComercial) * acao.fatorConversao * 1000) / 1000 - acao.quantidade) > .000001)) falhar("Confira o fator de conversão e a quantidade do item.");
    } else categoriaId = acao.categoriaFinanceiraId;
    const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: categoriaId! } });
    if ((!categoria?.ativo || categoria.excluidoEm || GRUPOS_RECEITA.includes(categoria.grupo)) && categoriaId !== item.categoriaFinanceiraId) falhar("Selecione uma categoria de despesa ativa.");
    categorias.set(item.id, categoriaId!);
    if (financeiroCancelado.has(item.id)) continue;
    const rateio = rateios.get(item.id)!;
    for (const elo of item.lancamentos) {
      const indice = preparadas.findIndex(p => p.entrada.id === elo.notaFiscalDuplicataId);
      const parcela = preparadas[indice];
      const novoValor = indice < 0 ? 0 : rateio[indice];
      if (novoValor <= 0) precisaCancelarTitulo = true;
      const alteraEfeito = centavos(Number(elo.lancamentoFinanceiro.valor)) !== centavos(novoValor) || !!parcela?.pagamentoMudou || !parcela;
      const alteraCategoria = elo.lancamentoFinanceiro.categoriaId !== categoriaId;
      if (alteraEfeito && protegido(elo.lancamentoFinanceiro)) falhar("Uma parcela alterada já tem pagamento ou vínculo ativo. Desfaça a baixa/conciliação ou o vínculo da parcela antes de corrigir o pagamento ou o valor. Os demais dados podem ser editados separadamente.");
      if (alteraEfeito || alteraCategoria) alteracoesFinanceiras.push({ id: elo.lancamentoFinanceiroId });
    }
    if (rateio.some((v, n) => v > 0 && !item.lancamentos.some(l => l.notaFiscalDuplicataId === preparadas[n].entrada.id))) {
      precisaAdicionarTitulo = true;
      alteracoesFinanceiras.push({ id: "novo" });
    }
  }
  if (alteracoesFinanceiras.length && !pode("financeiro.movimentacoes", "editar")) falhar("Sem permissão para corrigir os lançamentos financeiros da nota.");
  if (precisaAdicionarTitulo && !pode("financeiro.movimentacoes", "adicionar")) falhar("Sem permissão para adicionar os novos lançamentos financeiros desta alteração de parcelas.");
  if (precisaCancelarTitulo && !pode("financeiro.movimentacoes", "excluir")) falhar("Sem permissão para cancelar os lançamentos financeiros retirados desta alteração de parcelas.");
  const existentesAlterados = alteracoesFinanceiras.filter(a => a.id !== "novo");
  if (existentesAlterados.length) {
    try { await exigirDespesaSemCustoEntrega(tx, { id: { in: existentesAlterados.map(a => a.id) } }); }
    catch (e) { falhar(e instanceof Error ? e.message : "Despesa vinculada a uma entrega."); }
  }

  const recebimentos: Record<string, string | null> = {};
  const ajustes: { itemId: string; originalId?: string; novaEntradaId?: string; estornoId?: string }[] = [];
  const deltas = new Map<string, { quantidade: InstanceType<typeof DecimalEstoque>; valor: InstanceType<typeof DecimalEstoque> }>();
  const fisicos = [];
  for (const item of nota.itens) {
    const acao = input.itens.find(i => i.notaFiscalItemId === item.id)!;
    if (acao.acao === "IGNORAR") continue;
    const original = item.movimentacaoEstoque;
    const data = input.dataEntradaEstoque || dataRecebimentoCorrigida(estado, item.id, original?.createdAt, item.dataRecebimento) || (acao.destino === "ESTOQUE" ? diaEntradaEstoque() : null);
    recebimentos[item.id] = data;
    const localId = input.localId || original?.localId;
    if (acao.destino === "ESTOQUE" && !localId) falhar("Selecione o local para o item que passará a entrar no estoque.");
    const mudouFisico = acao.destino === "ESTOQUE" ? !original || original.insumoId !== acao.insumoId || original.localId !== localId || !original.quantidade.equals(acao.quantidade) || !new Prisma.Decimal(item.valorTotalConciliado ?? 0).equals(acao.valorTotal) : !!original;
    if (!mudouFisico) continue;
    if (!pode("inventario", "editar")) falhar("Sem permissão para corrigir o recebimento no estoque.");
    if (original && (original.tipo !== "ENTRADA_COMPRA" || original.estornoDeId || original.estornoCompra)) falhar("A entrada deste item já foi estornada ou não pode ser corrigida por este formulário.");
    if (acao.destino === "ESTOQUE") {
      const [insumo, local] = await Promise.all([tx.insumo.findUnique({ where: { id: acao.insumoId } }), tx.localEstoque.findUnique({ where: { id: localId! } })]);
      if (!insumo || ((!insumo.ativo || insumo.excluidoEm) && item.insumoId !== acao.insumoId) || !local || (!local.ativo && original?.localId !== localId)) falhar("Selecione insumo e local ativos para o novo recebimento.");
    }
    const delta = (id: string, quantidade: Prisma.Decimal | number, valor: Prisma.Decimal | number, sinal: number) => {
      const d = deltas.get(id) ?? { quantidade: new DecimalEstoque(0), valor: new DecimalEstoque(0) };
      d.quantidade = d.quantidade.plus(new DecimalEstoque(quantidade).times(sinal)); d.valor = d.valor.plus(new DecimalEstoque(valor).times(sinal)); deltas.set(id, d);
    };
    if (original) delta(original.insumoId, original.quantidade, item.valorTotalConciliado ?? 0, -1);
    if (acao.destino === "ESTOQUE") delta(acao.insumoId, acao.quantidade, acao.valorTotal, 1);
    fisicos.push({ item, acao, original, localId });
  }
  // Uma correção só de data altera o metadado auditado, sem refazer entradas nem custo.
  if (input.dataEntradaEstoque && "erro" in validarDataEntradaEstoque(input.dataEntradaEstoque)) falhar("Informe uma data de recebimento válida, sem data futura.");
  if (input.dataEntradaEstoque && nota.itens.some(i => recebimentos[i.id] && recebimentos[i.id] !== dataRecebimentoCorrigida(estado, i.id, i.movimentacaoEstoque?.createdAt, i.dataRecebimento)) && !pode("inventario", "editar")) falhar("Sem permissão para corrigir a data de recebimento.");
  const custosResiduais = [];
  if (deltas.size) await tx.$queryRaw(Prisma.sql`SELECT id FROM "Insumo" WHERE id IN (${Prisma.join([...deltas.keys()].sort())}) ORDER BY id FOR UPDATE`);
  for (const [insumoId, delta] of deltas) {
    const [insumo, saldo] = await Promise.all([tx.insumo.findUniqueOrThrow({ where: { id: insumoId } }), tx.saldoEstoque.aggregate({ where: { insumoId }, _sum: { quantidadeAtual: true } })]);
    const quantidade = new DecimalEstoque(saldo._sum.quantidadeAtual ?? 0);
    const novaQuantidade = quantidade.plus(delta.quantidade);
    const valor = quantidade.times(insumo.custoMedio).plus(delta.valor);
    const residuo = novaQuantidade.isZero() && valor.abs().lte("0.01");
    if (novaQuantidade.lt(0) || (!residuo && valor.lt(0)) || (novaQuantidade.isZero() && !residuo)) falhar(`O custo residual de ${insumo.nome} não comporta esta correção. Confira o estoque e os custos antes de salvar.`);
    const novo = novaQuantidade.gt(0) ? valor.div(novaQuantidade).toDecimalPlaces(4) : new DecimalEstoque(insumo.custoMedio);
    if (!novo.isFinite() || novo.gte(1e8)) falhar("O custo médio resultante ultrapassa o limite do cadastro.");
    custosResiduais.push({ insumoId, anterior: insumo.custoMedio.toString(), novo: novo.toString() });
  }
  // As entradas novas são registradas antes das compensações: reservas são verificadas sobre o saldo final.
  for (const f of fisicos) {
    let novaEntradaId: string | undefined;
    if (f.acao.acao === "CONCILIAR" && f.acao.destino === "ESTOQUE") {
      novaEntradaId = (await registrarMovimentacao({ tx, insumoId: f.acao.insumoId, localId: f.localId!, tipo: "ENTRADA_COMPRA", quantidade: f.acao.quantidade, valorTotal: f.acao.valorTotal, criadoPorId: usuario.id, observacao: `Correção local da NF-e, item ${f.item.numeroItem}. ${input.motivo.trim()}` })).movimentacaoId;
    }
    ajustes.push({ itemId: f.item.id, originalId: f.original?.id, novaEntradaId });
  }
  for (const f of fisicos) {
    if (!f.original) continue;
    const atual = await tx.saldoEstoque.findUnique({ where: { insumoId_localId: { insumoId: f.original.insumoId, localId: f.original.localId } } });
    if (!atual || atual.quantidadeAtual.lt(f.original.quantidade)) falhar("Saldo disponível insuficiente para corrigir o recebimento após consumos e reservas.");
    let estorno;
    try { estorno = await registrarMovimentacao({ tx, insumoId: f.original.insumoId, localId: f.original.localId, tipo: "AJUSTE_SAIDA", quantidade: Number(f.original.quantidade), criadoPorId: usuario.id, observacao: `Compensação da entrada corrigida da NF-e, item ${f.item.numeroItem}. ${input.motivo.trim()}` }); }
    catch (e) { falhar(e instanceof Error ? e.message : "Não foi possível compensar o recebimento."); }
    await tx.movimentacaoEstoque.update({ where: { id: estorno.movimentacaoId }, data: { estornoDeId: f.original.id } });
    ajustes.find(a => a.itemId === f.item.id)!.estornoId = estorno.movimentacaoId;
  }
  for (const c of custosResiduais) await tx.insumo.update({ where: { id: c.insumoId }, data: { custoMedio: c.novo } });

  for (const p of preparadas) {
    const { formaPagamento, cartaoCreditoId, dataCompra, parcelaCartao, dataVencimento } = p.preparado;
    const pagamento = { formaPagamento, cartaoCreditoId, dataCompra, parcelaCartao, dataVencimento };
    const dados = { numero: p.entrada.numero, valor: p.entrada.valor, ...pagamento };
    if (p.atual) await tx.notaFiscalDuplicata.update({ where: { id: p.atual.id }, data: dados });
    else p.entrada.id = (await tx.notaFiscalDuplicata.create({ data: { ...dados, notaFiscalId: nota.id } })).id;
  }
  const fornecedor = await resolverFornecedorNota(tx, nota.fornecedorCnpj);
  for (const item of nota.itens) {
    const acao = input.itens.find(i => i.notaFiscalItemId === item.id)!;
    if (acao.acao === "IGNORAR") continue;
    const partes = rateios.get(item.id) ?? preparadas.map(() => 0);
    const ajuste = ajustes.find(a => a.itemId === item.id);
    const movimentoId = ajuste ? ajuste.novaEntradaId ?? null : item.movimentacaoEstoqueId;
    // Desvincula somente a referência técnica da entrada antiga, preservando o título.
    if (ajuste) for (const l of item.lancamentos) if (l.lancamentoFinanceiro.origemMovimentacaoEstoqueId) await tx.lancamentoFinanceiro.update({ where: { id: l.lancamentoFinanceiroId }, data: { origemMovimentacaoEstoqueId: null } });
    for (const elo of item.lancamentos) {
      const indice = preparadas.findIndex(p => p.entrada.id === elo.notaFiscalDuplicataId);
      if (indice >= 0 && partes[indice] > 0) continue;
      await tx.lancamentoFinanceiro.update({ where: { id: elo.lancamentoFinanceiroId }, data: { status: "CANCELADO" } });
      await tx.notaFiscalItemLancamento.delete({ where: { id: elo.id } });
    }
    let origemAtribuida = false;
    for (const [indice, p] of preparadas.entries()) {
      if (financeiroCancelado.has(item.id)) continue;
      if (partes[indice] <= 0) continue;
      const anterior = item.lancamentos.find(l => l.notaFiscalDuplicataId === p.entrada.id);
      const dados = { valor: partes[indice], categoriaId: categorias.get(item.id)!, dataVencimento: anterior && !p.pagamentoMudou ? anterior.lancamentoFinanceiro.dataVencimento : p.preparado.dataVencimento,
        ...(p.pagamentoMudou || !anterior ? { contaBancariaId: p.preparado.contaBancariaId, formaPagamentoId: p.formaId, cartaoCreditoId: p.preparado.cartaoCreditoId } : {}),
        ...(ajuste ? { origemMovimentacaoEstoqueId: !origemAtribuida ? movimentoId : null } : {}),
      };
      origemAtribuida = true;
      if (anterior) {
        await tx.lancamentoFinanceiro.update({ where: { id: anterior.lancamentoFinanceiroId }, data: dados });
        await tx.notaFiscalItemLancamento.update({ where: { id: anterior.id }, data: { valor: partes[indice] } });
      } else {
        const modelo = item.lancamentos[0]?.lancamentoFinanceiro;
        const criado = await tx.lancamentoFinanceiro.create({ data: { ...dados, tipo: "DESPESA", descricao: modelo?.descricao ?? `NF-e ${nota.chaveAcesso} - ${item.descricaoProduto}`.toUpperCase(), dataCompetencia: modelo?.dataCompetencia ?? nota.dataEmissao ?? new Date(), fornecedorId: modelo?.fornecedorId, contraparteNome: modelo?.contraparteNome ?? nota.fornecedorNome?.toUpperCase(), criadoPorId: usuario.id } });
        await tx.notaFiscalItemLancamento.create({ data: { notaFiscalItemId: item.id, notaFiscalDuplicataId: p.entrada.id!, lancamentoFinanceiroId: criado.id, valor: partes[indice] } });
      }
    }
    await tx.notaFiscalItem.update({ where: { id: item.id }, data: { status: "CONCILIADO", destino: acao.destino, insumoId: acao.destino === "ESTOQUE" ? acao.insumoId : null,
      categoriaFinanceiraId: categorias.get(item.id), quantidadeConciliada: acao.destino === "ESTOQUE" ? acao.quantidade : null,
      valorTotalConciliado: acao.valorTotal, movimentacaoEstoqueId: movimentoId, dataRecebimento: recebimentos[item.id] ? new Date(recebimentos[item.id] + "T12:00:00Z") : null, ...(custos.composicoes.has(item.id) ? { composicaoCusto: json(custos.composicoes.get(item.id)) } : {}),
    } });
    if (acao.destino === "ESTOQUE" && nota.fornecedorCnpj) {
      const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: acao.insumoId }, select: { unidade: true } });
      const conversao = { insumoId: acao.insumoId, fatorConversao: acao.fatorConversao ?? (Number(item.quantidadeComercial) > 0 ? acao.quantidade / Number(item.quantidadeComercial) : null), unidadeComercial: item.unidadeComercial, unidadeEstoque: insumo.unidade };
      await tx.insumoCodigoFornecedor.upsert({ where: { fornecedorCnpj_codigoProduto: { fornecedorCnpj: nota.fornecedorCnpj, codigoProduto: item.codigoProdutoFornecedor } }, update: conversao, create: { ...conversao, fornecedorCnpj: nota.fornecedorCnpj, codigoProduto: item.codigoProdutoFornecedor } });
    }
    if (acao.destino === "ESTOQUE" && fornecedor) await tx.insumoFornecedor.upsert({ where: { insumoId_fornecedorId: { insumoId: acao.insumoId, fornecedorId: fornecedor.id } }, update: {}, create: { insumoId: acao.insumoId, fornecedorId: fornecedor.id } });
  }
  for (const anterior of nota.duplicatas) if (!preparadas.some(p => p.entrada.id === anterior.id)) {
    await tx.notaFiscalItemLancamento.deleteMany({ where: { notaFiscalDuplicataId: anterior.id, lancamentoFinanceiro: { status: "CANCELADO" } } });
    await tx.notaFiscalDuplicata.delete({ where: { id: anterior.id } });
  }
  const depois = await consultarCorrecaoNota(tx, nota.id);
  await tx.historicoAcesso.create({ data: { autorId: usuario.id, entidade: "NOTA_FISCAL", entidadeId: nota.id, acao: "CORRECAO_LOCAL", antes: json({ versao: input.versao, nota: notaLida }), depois: json({ hashOperacao, motivo: input.motivo.trim(), nota: depois.nota, recebimentos, ajustes, custosResiduais }) } });
  await registrarAtividade(tx, { userId: usuario.id, nome: usuario.nome }, { modulo: "financeiro", recurso: "notas.manifestar", acao: "CORRIGIR_NOTA_ACEITA", entidade: "NotaFiscalRecebida", entidadeId: nota.id, resumo: "Informações locais de nota aceita corrigidas com histórico preservado." });
}
