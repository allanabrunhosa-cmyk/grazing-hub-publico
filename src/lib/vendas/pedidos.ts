import { pedidoEmAcompanhamento } from "@/lib/ifood/acompanhamento-dominio";
import { exigirEfeitoOperacional } from "@/lib/ifood/acompanhamento";
import { diaNoFuso, diaValido, somarDias, intervaloDatasPedidos } from "./pedidos-agenda-dominio";
import { dataCompraCivil, vencimentoPrazoPedido, type PrazoPagamentoPedido } from "./pedidos-data-compra";
import { VERSAO_CALENDARIO_BANCARIO } from "./calendario-bancario";
import "server-only";
import { horariosSnapshotIfood } from "@/lib/ifood/horarios-servidor";
import { createHash } from "node:crypto";
import { Prisma, type ClienteVenda } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { permissaoEfetiva, permissaoOperarPedido, type Excecoes, type Permissoes } from "@/lib/permissoes/catalogo";
import type { SessaoAtual } from "@/lib/session";
import { comandoAvancoGestor, estadoAnteriorGestor, etapaGestorPedido, estadosEtapasGestor, type ComandoOperacao, type DirecaoStatusGestor, type EtapaGestor, politicaMovimentacaoEstoqueGestor, type ConfiguracaoMovimentacaoEstoqueGestor } from "./pedidos-operacao-dominio";
import { coberturaComposicaoPedido, type CoberturaPedido } from "./pedidos-composicao";
import { baixarLancamento } from "@/lib/financeiro/baixarLancamento";
import { limitesEfetivos, precoObrigatorioNaConfiguracao, simularConfiguracao, opcoesEfetivas, lerAjustesOpcoes, validarComponentes, validarIdentidadeCobranca, type EnderecoVenda } from "./dominio";
import { cobrancasDoCliente, identidadePrincipalCliente } from "./cliente-cobranca";
import { normalizarEmailCliente } from "./cliente-identificadores";
import { precosOpcoes } from "./complementos";
import { permiteOpcaoAvulsa } from "./pedidos-catalogo";
import { salvarClienteNaTransacao } from "./persistencia";
import { prepararClienteParaSalvar, type ClientePreparado } from "./cliente-cobranca-servidor";
import { validarPagamentoComercial, type PagamentoComercialSnapshot } from "./pedidos-pagamento-comercial";
import { exigirFormaPagamentoCliente, exigirLimiteCreditoCliente, exigirVencimentoBoletoCliente, saldoDevedorCliente } from "./pedidos-regras-pagamento";
import { ErroPedidoVenda, exigirPedidoConfirmavel, exigirPagamentoConfirmacao, exigirTelefoneDestinatario, quantidadeComercial, validarEntradaPedido, type PedidoEntrada, type ItemPedidoEntrada } from "./pedidos-dominio";

import { liberarReservasCancelamento } from "./pedidos-fisico";
import { executarAutomaticoGestorNaTransacao } from "./pedidos-fisico-gestor";
import { exigirLiberacaoPedidos } from "./pedidos-liberacao";

import { janelasDoDia, validarHorarios } from "./pedidos-horarios-dominio";
import { validarFretePedido } from "./entregas";
import { embalagensDosItens, slotsDosItens, slotsPorUnidade } from "./entregas-veiculos";
import { assinaturaEntradas } from "./entregas-recibo";
import { fotografarMateriais } from "@/lib/tributacao/receita-material";
import { fotografarClassificacaoNormal, fotografarComponentesKit, fotografarReceitaFiscal, receitaDoSnapshot } from "@/lib/tributacao/fotografia-tecnica";
import { fotografarPoliticaKit } from "@/lib/tributacao/fotografia-kit";
import { hojeFiscal } from "@/lib/tributacao/validacao";
import type { ClassificacaoFiscal, FotografiaKitFiscal, ReceitaFiscalDocumentadaSnapshot } from "@/lib/tributacao/tipos";
import { itemComercialPreservado, type PrecoItemHistorico } from "./pedidos-preco-historico";
import { condicaoDoPagamento } from "./pedidos-condicao";
import { ehPedidoHistorico, ORIGEM_HISTORICA } from "./historico-dominio";
import { revisarObrigacoesPedido } from "./pedidos-revisao-financeira";
import { mensagemAlteracaoComercialPedido, validarInformacoesPedido, type InformacoesPedidoEntrada } from "./pedidos-edicao";
import { validarMotivoCancelamento, validarResponsavelCancelamento } from "./cancelamento-pedido-dominio";
import { ajusteDevolucaoExecucao, materialDestinado, quantidadeExecucao } from "./pedidos-execucao-dominio";
import { abrirDestinosCancelamento, prepararDevolucaoFisica, validarResolucaoDestino } from "./pedidos-destino";
import type { DestinoFisicoPedido } from "./pedidos-operacao-dominio";
type Tx = Prisma.TransactionClient;
async function conferirJanela(tx: Tx, data: string | null, janela: string | null) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pedidos-horarios'))`;
  const config = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { horariosPedidos: true } });
  if (data && !janelasDoDia(data, config?.horariosPedidos ? validarHorarios(config.horariosPedidos) : null).includes(janela ?? "")) throw new ErroPedidoVenda("Escolha uma janela nos horários de entrega.");
}

type Capacidade = "cliente" | "editarCliente" | "horarios" | "operar" | "consultar" | "rascunho" | "confirmar" | "revisar" | "desconto" | "preco" | "cancelar" | "receber" | "estornar" | "condicao" | "estoque" | "fiscal";
const recurso: Record<Capacidade, string> = {
  cliente: "vendas.clientes",
  editarCliente: "vendas.clientes",
  horarios: "vendas.horarios", operar: "vendas.pedidos.producao",
  fiscal: "vendas.fiscal", estoque: "inventario", consultar: "vendas.pedidos", rascunho: "vendas.pedidos", confirmar: "vendas.pedidos.confirmar", revisar: "vendas.pedidos.revisar",
  desconto: "vendas.pedidos.desconto", preco: "vendas.pedidos.preco", cancelar: "vendas.pedidos.cancelar",
  receber: "financeiro.baixas", estornar: "financeiro.estornos", condicao: "financeiro.movimentacoes",
};
const moedaMaxima = new Prisma.Decimal("999999999999.99");
const json = (valor: unknown) => JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
const hash = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
const dinheiro = (s: string) => new Prisma.Decimal(s);
const centavos = (v: Prisma.Decimal) => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
function jsonCanonico(valor: unknown): string {
  if (valor === Prisma.DbNull || valor == null) return "null";
  const ordenar = (v: unknown): unknown => Array.isArray(v) ? v.map(ordenar) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, ordenar(x)])) : v;
  return JSON.stringify(ordenar(JSON.parse(JSON.stringify(valor))));
}
function limite(v: Prisma.Decimal, nome: string) {
  if (!v.isFinite() || v.isNegative() || v.greaterThan(moedaMaxima)) throw new ErroPedidoVenda(`${nome} excede o limite monetário.`);
  return v;
}
function chave(valor: unknown) {
  if (typeof valor !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(valor)) throw new ErroPedidoVenda("Chave da operação inválida.");
  return valor;
}
function versao(valor: unknown) {
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor < 1) throw new ErroPedidoVenda("Versão do pedido inválida.");
  return valor;
}
function identificador(valor: unknown) {
  if (typeof valor !== "string" || !valor || valor.length > 100) throw new ErroPedidoVenda("Pedido inválido.");
  return valor;
}
function dataCivil(s: string | null) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (d.toISOString().slice(0, 10) !== s) throw new ErroPedidoVenda("Data prevista inválida.");
  return d;
}
export async function conferirAcesso(tx: Tx, sessao: SessaoAtual, capacidades: Capacidade[], pedidoId?: string, novoModo?: string) {
  // A gestão de acessos usa a mesma trava. Releitura ocorre dentro da transação crítica.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const usuario = await tx.usuario.findUnique({ where: { id: sessao.userId }, select: { id: true, nome: true, ativo: true, excluidoEm: true, sessaoVersao: true, permissoesPersonalizadas: true, perfilAcesso: { select: { sistema: true, permissoes: true } } } });
  if (!usuario?.ativo || usuario.excluidoEm || usuario.sessaoVersao !== (sessao.versao ?? 0)) throw new ErroPedidoVenda("Sua sessão foi encerrada.");
  const administrador = usuario.perfilAcesso?.sistema === "ADMINISTRADOR";
  if (pedidoId && capacidades.some(c => c !== "consultar")) await exigirEfeitoOperacional(tx, pedidoId);
  const base = (usuario.perfilAcesso?.permissoes ?? {}) as Permissoes;
  const excecoes = usuario.permissoesPersonalizadas as Excecoes;
  if (!administrador && capacidades.some(c => c === "operar" ? !permissaoOperarPedido(base, excecoes) : !permissaoEfetiva(base, excecoes, recurso[c], c === "consultar" ? "visualizar" : c === "rascunho" || c === "cliente" ? "adicionar" : "editar"))) throw new ErroPedidoVenda("Seu acesso não permite esta operação.");
  if (pedidoId && capacidades.some(c => !["consultar", "receber", "estornar", "condicao"].includes(c))) {
    const origem = await tx.pedidoVenda.findUnique({ where: { id: pedidoId }, select: { origem: true, status: true } });
    if (origem?.origem === "IFOOD" && !(origem.status === "CANCELADO" && capacidades.includes("receber") && capacidades.every(c => ["consultar", "receber", "condicao", "cancelar"].includes(c)))) throw new ErroPedidoVenda("Use as ações iFood nos detalhes do pedido. Edição local e movimentação de estoque estão desabilitadas para este canal.");
  }
  if (capacidades.some(c => c !== "consultar" && c !== "horarios")) await exigirLiberacaoPedidos(tx, undefined, { pedidoId, novoModo, financeiro: capacidades.some(c => c === "receber" || c === "estornar" || c === "condicao") });
  return { userId: usuario.id, nome: usuario.nome };
}
async function travarOperacao(tx: Tx, operacao: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`pedido-operacao:${operacao}`}))`;
}
async function repetida(tx: Tx, operacao: string, resumo: string) {
  const evento = await tx.historicoPedidoVenda.findUnique({ where: { chaveOperacao: operacao }, select: { pedidoId: true, hashOperacao: true } });
  if (!evento) return null;
  if (evento.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados.");
  const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: evento.pedidoId }, select: { id: true, numero: true, versao: true, status: true } });
  return pedido;
}
async function fotografia(tx: Tx, pedidoId: string) {
  const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" }, include: { reservas: true } } } });
  return json(pedido);
}
async function evento(tx: Tx, pedidoId: string, tipo: string, operacao: string, resumo: string, autor: { userId: string; nome: string }, anterior: number | null, nova: number, antes: Prisma.InputJsonValue | null, depois: Prisma.InputJsonValue, motivo?: string) {
  await tx.historicoPedidoVenda.create({ data: { pedidoId, tipo, chaveOperacao: operacao, hashOperacao: resumo, usuarioId: autor.userId, usuarioNome: autor.nome, versaoAnterior: anterior, versaoNova: nova, motivo: motivo || null, antes: antes ?? Prisma.DbNull, depois } });
}
function exigirAtualizado(contagem: number) {
  if (contagem !== 1) throw new ErroPedidoVenda("O pedido mudou em outra tela. Reabra para conferir antes de salvar.");
}
function exigePermissoesComerciais(d: PedidoEntrada): Capacidade[] {
  return [...(dinheiro(d.desconto).greaterThan(0) ? ["desconto" as const] : []), ...(d.itens.some(i => i.precoManual !== null) ? ["preco" as const] : [])];
}

export type CondicaoFinanceiraPedido = {
  categoriaId: string;
  dataCompetencia: string;
  vencimento?: string;
  creditoUtilizado?: string;
  parcelas: { valor: string; vencimento: string; formaPagamentoVendaId: string; parcelasCliente?: number }[];
};
const meiosDiretos = new Set(["PIX", "TRANSFERENCIA", "DINHEIRO"]);
const meiosPedido = new Set(["PIX", "BOLETO", "CARTAO_CREDITO", "CARTAO_DEBITO"]);
function dataFinanceira(valor: unknown, nome: string) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new ErroPedidoVenda(`Informe ${nome}.`);
  const data = new Date(`${valor}T12:00:00`);
  if (Number.isNaN(data.getTime()) || data.getFullYear() !== Number(valor.slice(0, 4)) || data.getMonth() + 1 !== Number(valor.slice(5, 7)) || data.getDate() !== Number(valor.slice(8))) throw new ErroPedidoVenda(`${nome} inválido.`);
  return data;
}
function valorFinanceiro(valor: unknown) {
  if (typeof valor !== "string" || !/^\d{1,12}(\.\d{1,2})?$/.test(valor)) throw new ErroPedidoVenda("Informe valores monetários em reais e centavos.");
  const quantia = dinheiro(valor);
  if (!quantia.greaterThan(0) || quantia.greaterThan(moedaMaxima)) throw new ErroPedidoVenda("Valor financeiro inválido.");
  return quantia;
}
async function saldoCreditoCliente(tx: Tx, clienteId: string) {
  const movimentos = await tx.creditoClienteMovimento.findMany({ where: { clienteId }, select: { tipo: true, valor: true } });
  return movimentos.reduce((s, m) => ["CONCESSAO", "LIBERACAO", "AJUSTE_CREDITO"].includes(m.tipo) ? s.plus(m.valor) : s.minus(m.valor), dinheiro("0"));
}
async function regrasClientePedido(tx: Tx, clienteId: string) {
  await tx.$queryRaw`SELECT id FROM "ClienteVenda" WHERE id = ${clienteId} FOR UPDATE`;
  return tx.clienteVenda.findUniqueOrThrow({ where: { id: clienteId }, select: { formasPagamentoHabilitadas: true, boletoDiasAposEntrega: true, limiteCreditoAberto: true } });
}
async function saldoAbertoCliente(tx: Tx, clienteId: string, pedidoId?: string) {
  const pedido = { clienteId, ...(pedidoId ? { id: pedidoId } : {}) };
  const [pendentes, capturas, repasses] = await Promise.all([
    tx.lancamentoFinanceiro.aggregate({ where: { tipo: "RECEITA", status: "PENDENTE", pedidoVenda: pedido }, _sum: { valor: true } }),
    tx.pagamentoExternoPedido.aggregate({ where: { status: "CAPTURADO", pedido }, _sum: { valorBruto: true } }),
    tx.repassePagamentoPedido.aggregate({ where: { pagamento: { status: "CAPTURADO", pedido } }, _sum: { valorBruto: true } }),
  ]);
  return saldoDevedorCliente(pendentes._sum.valor ?? dinheiro("0"), capturas._sum.valorBruto ?? dinheiro("0"), repasses._sum.valorBruto ?? dinheiro("0"));
}
/** Leitura para o editor; a confirmação revalida limite e saldo dentro da própria transação. */
export async function creditoAbertoCliente(clienteId: unknown) {
  const id = identificador(clienteId);
  return prisma.$transaction(async tx => {
    const cliente = await tx.clienteVenda.findUnique({ where: { id }, select: { limiteCreditoAberto: true } });
    if (!cliente) throw new ErroPedidoVenda("Cliente não encontrado.");
    const limite = cliente.limiteCreditoAberto, emAberto = await saldoAbertoCliente(tx, id);
    return { limite: limite?.toFixed(2) ?? null, emAberto: emAberto.toFixed(2), disponivel: limite ? Prisma.Decimal.max(0, limite.minus(emAberto)).toFixed(2) : null };
  });
}
async function conferirPrazosBoletoPedido(tx: Tx, id: string, regras: { boletoDiasAposEntrega: number | null }, pedido: Parameters<typeof exigirVencimentoBoletoCliente>[1]) {
  if (regras.boletoDiasAposEntrega === null) return;
  const [titulos, boletos] = await Promise.all([
    tx.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: id, status: "PENDENTE" }, select: { pedidoFormaSnapshot: true, dataVencimento: true } }),
    tx.pagamentoExternoPedido.findMany({ where: { pedidoId: id, tipo: "BOLETO", status: "EMITIDO" }, select: { vencimentoExterno: true } }),
  ]);
  for (const titulo of titulos) if ((titulo.pedidoFormaSnapshot as Record<string, unknown> | null)?.tipo === "BOLETO") exigirVencimentoBoletoCliente(regras, pedido, titulo.dataVencimento);
  for (const boleto of boletos) if (boleto.vencimentoExterno) exigirVencimentoBoletoCliente(regras, pedido, boleto.vencimentoExterno);
}
export async function consultarCreditoCliente(clienteId: string) {
  const movimentos = await prisma.creditoClienteMovimento.findMany({ where: { clienteId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const saldo = movimentos.reduce((s, m) => ["CONCESSAO", "LIBERACAO", "AJUSTE_CREDITO"].includes(m.tipo) ? s.plus(m.valor) : s.minus(m.valor), dinheiro("0"));
  return { saldo: saldo.toFixed(2), movimentos: movimentos.map(m => ({ id: m.id, tipo: m.tipo, valor: m.valor.toFixed(2), tratamentoId: m.tratamentoId, pedidoAplicacaoId: m.pedidoAplicacaoId, origemMovimentoId: m.origemMovimentoId, motivo: m.motivo, referenciaComunicacao: m.referenciaComunicacao, data: m.data.toISOString(), criadoPorId: m.criadoPorId })) };
}
async function validarCondicao(tx: Tx, entrada: unknown, total: Prisma.Decimal, dataCompra?: string | null) {
  if (!entrada || typeof entrada !== "object") throw new ErroPedidoVenda("Defina a condição financeira antes de confirmar.");
  const c = entrada as CondicaoFinanceiraPedido;
  if (typeof c.categoriaId !== "string" || !Array.isArray(c.parcelas) || c.parcelas.length > 36) throw new ErroPedidoVenda("Defina categoria e condições financeiras.");
  const credito = c.creditoUtilizado === undefined || c.creditoUtilizado === "" || c.creditoUtilizado === "0" || c.creditoUtilizado === "0.00" ? dinheiro("0") : valorFinanceiro(c.creditoUtilizado);
  if (credito.greaterThan(total) || (c.parcelas.length === 0 && credito.isZero())) throw new ErroPedidoVenda("Crédito usado não pode exceder o pedido nem deixar obrigação sem condição.");
  const competencia = dataFinanceira(c.dataCompetencia, "a competência contábil explícita");
  const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: c.categoriaId } });
  if (!categoria?.ativo || categoria.excluidoEm || categoria.grupo !== "RECEITA_BRUTA") throw new ErroPedidoVenda("Escolha categoria ativa de receita bruta.");
  const ids = [...new Set(c.parcelas.map(p => p.formaPagamentoVendaId))];
  const formas = await tx.formaPagamentoVenda.findMany({ where: { id: { in: ids } } });
  const porId = new Map(formas.map(f => [f.id, f]));
  const parcelas = c.parcelas.map((p, indice) => {
    const forma = porId.get(p.formaPagamentoVendaId);
    if (!forma?.ativo || !meiosPedido.has(forma.tipo)) throw new ErroPedidoVenda("A forma escolhida não está disponível em Pedidos.");
    if (forma.tipo === "PIX" && (!forma.taxaPercentual.isZero() || !forma.taxaFixa.isZero() || (Array.isArray(forma.faixasTaxa) && forma.faixasTaxa.length > 0))) throw new ErroPedidoVenda("Pix com taxa ainda não está habilitado para baixa direta em Pedidos.");
    const parcelasCliente = p.parcelasCliente ?? 1;
    if (!Number.isSafeInteger(parcelasCliente) || parcelasCliente < 1 || (forma.tipo === "CARTAO_CREDITO" ? parcelasCliente > 4 || (parcelasCliente > 1 && (!forma.permiteParcelamento || parcelasCliente > forma.maximoParcelas)) : parcelasCliente !== 1)) throw new ErroPedidoVenda("Parcelamento do cliente incompatível com a forma de pagamento.");
    const valor = valorFinanceiro(p.valor);
    return { raiz: `parcela-${indice + 1}`, valor, vencimento: dataFinanceira(p.vencimento, "o vencimento"), forma, formaSnapshot: json({ id: forma.id, nome: forma.nome, tipo: forma.tipo, versao: forma.versao, parcelasCliente, taxaPercentual: forma.taxaPercentual.toString(), taxaFixa: forma.taxaFixa.toString(), prazoDias: forma.prazoDias, ...(dataCompra ? { dataCompra, inicioPrazo: forma.inicioPrazo, contagemPrazo: forma.contagemPrazo, vencimentoFlexivel: forma.vencimentoFlexivel, ...(forma.contagemPrazo === "UTEIS" ? { calendario: VERSAO_CALENDARIO_BANCARIO } : {}) } : {}) }) };
  });
  if (!parcelas.reduce((s, p) => s.plus(p.valor), credito).equals(total)) throw new ErroPedidoVenda("A soma do crédito e das condições deve ser igual ao total confirmado do pedido.");
  return { categoriaId: categoria.id, competencia, parcelas, credito };
}
async function historicoFinanceiro(tx: Tx, pedidoId: string, operacao: string, resumo: string, tipo: string, autor: { userId: string; nome: string }, detalhes: unknown) {
  await tx.historicoFinanceiroPedido.create({ data: { pedidoId, chaveOperacao: operacao, hashOperacao: resumo, tipo, usuarioId: autor.userId, usuarioNome: autor.nome, detalhes: json(detalhes) } });
}
async function bloquearTitulos(tx: Tx, pedidoId: string) {
  await tx.$queryRaw`SELECT id FROM "LancamentoFinanceiro" WHERE "pedidoVendaId" = ${pedidoId} ORDER BY id FOR UPDATE`;
  return tx.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedidoId }, orderBy: { id: "asc" } });
}
async function resumoFinanceiro(tx: Tx, pedidoId: string) {
  const titulos = await tx.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedidoId, tipo: "RECEITA" }, orderBy: [{ pedidoParcelaRaiz: "asc" }, { createdAt: "asc" }] });
  const externos = await tx.pagamentoExternoPedido.findMany({ where: { pedidoId }, orderBy: { createdAt: "asc" } });
  const repasses = await tx.repassePagamentoPedido.findMany({ where: { pagamento: { pedidoId } }, orderBy: { createdAt: "asc" } });
  const tratamentos = await tx.tratamentoFinanceiroPedido.findMany({ where: { pedidoId }, orderBy: { createdAt: "asc" } });
  const fontes = await origensElegiveis(tx, pedidoId);
  const fontesCancelamento = await origensElegiveis(tx, pedidoId, true);
  const recebido = titulos.filter(t => t.status === "BAIXADO" && !t.pedidoQuitadoCredito).reduce((s, t) => s.plus(t.valor), dinheiro("0"));
  const creditoAplicado = titulos.filter(t => t.pedidoQuitadoCredito).reduce((s, t) => s.plus(t.valor), dinheiro("0"));
  const restauracoes = await tx.creditoClienteMovimento.findMany({ where: { pedidoAplicacaoId: pedidoId, tipo: "LIBERACAO" }, select: { valor: true } });
  const creditoRestaurado = restauracoes.reduce((s, m) => s.plus(m.valor), dinheiro("0"));
  const creditoRestauravel = Prisma.Decimal.max(0, creditoAplicado.minus(creditoRestaurado));
  const saldo = titulos.filter(t => t.status === "PENDENTE").reduce((s, t) => s.plus(t.valor), dinheiro("0"));
  const capturado = externos.filter(e => e.status === "CAPTURADO").reduce((s, e) => s.plus(e.valorBruto), dinheiro("0"));
  const repassado = repasses.reduce((s, r) => s.plus(r.valorBruto), dinheiro("0"));
  const entradaLiquida = recebido.minus(repasses.reduce((s, r) => s.plus(r.taxa), dinheiro("0")));
  return { elegivelCancelamento: fontesCancelamento.reduce((s, f) => s.plus(f.disponivel), dinheiro("0")).toFixed(2), recebido: recebido.toFixed(2), entradaLiquida: entradaLiquida.toFixed(2), creditoAplicado: creditoAplicado.toFixed(2), creditoRestaurado: creditoRestaurado.toFixed(2), creditoRestauravel: creditoRestauravel.toFixed(2), capturado: capturado.toFixed(2), repassado: repassado.toFixed(2), saldo: saldo.toFixed(2), saldoCliente: saldo.minus(capturado.minus(repassado)).toFixed(2), elegivel: fontes.reduce((s, f) => s.plus(f.disponivel), dinheiro("0")).toFixed(2), titulos: titulos.map(t => ({ id: t.id, revisao: t.updatedAt.toISOString(), raiz: t.pedidoParcelaRaiz!, valorOriginal: t.pedidoValorOriginal!.toFixed(2), valor: t.valor.toFixed(2), status: t.status, quitadoCredito: t.pedidoQuitadoCredito, vencimento: t.dataVencimento.toISOString(), forma: t.pedidoFormaSnapshot, dataPagamento: t.dataPagamento?.toISOString() ?? null })), externos: externos.map(e => ({ id: e.id, tituloId: e.tituloId, tipo: e.tipo, status: e.status, valorBruto: e.valorBruto.toFixed(2), parcelasCliente: e.parcelasCliente, referenciaExterna: e.referenciaExterna, documentoExterno: e.documentoExterno, vencimentoExterno: e.vencimentoExterno?.toISOString() ?? null, confirmadoEm: e.confirmadoEm?.toISOString() ?? null, taxa: e.taxa?.toFixed(2) ?? null, valorLiquido: e.valorLiquido?.toFixed(2) ?? null, previsaoRepasse: e.previsaoRepasse?.toISOString() ?? null, repassadoEm: e.repassadoEm?.toISOString() ?? null })), repasses: repasses.map(r => ({ id: r.id, pagamentoId: r.pagamentoId, valorBruto: r.valorBruto.toFixed(2), taxa: r.taxa.toFixed(2), valorLiquido: r.valorLiquido.toFixed(2), data: r.data.toISOString(), contaBancariaId: r.contaBancariaId })), tratamentos: tratamentos.map(t => ({ id: t.id, tipo: t.tipo, status: t.status, valor: t.valor.toFixed(2), retido: t.retido.toFixed(2), motivo: t.motivo, referenciaPolitica: t.referenciaPolitica, referenciaComunicacao: t.referenciaComunicacao, evidenciaConclusao: t.evidenciaConclusao, concluidoEm: t.concluidoEm?.toISOString() ?? null })) };
}

async function pagamentoComercial(tx: Tx, d: PedidoEntrada, confirmar = false, anterior?: unknown) {
  if (!d.pagamentoInformado) return null;
  const salvo = anterior as PagamentoComercialSnapshot | null;
  if (salvo && jsonCanonico({ formaId: salvo.formaId, parcelas: salvo.parcelas, vencimentos: salvo.vencimentos }) === jsonCanonico(d.pagamentoInformado)) return salvo;
  const forma = await tx.formaPagamentoVenda.findUnique({ where: { id: d.pagamentoInformado.formaId } });
  const snapshot = validarPagamentoComercial(d.pagamentoInformado, forma, confirmar);
  if (d.formaPagamentoInformada && d.formaPagamentoInformada !== snapshot.tipo) throw new ErroPedidoVenda("Tipo de pagamento diferente do cadastro selecionado.");
  return snapshot;
}
function clienteParaCobranca(cliente: ClienteVenda) {
  return { ...cliente, tipo: cliente.tipo === "PJ" ? "PJ" as const : "PF" as const,
    enderecos: (Array.isArray(cliente.enderecos) ? cliente.enderecos : []) as EnderecoVenda[] };
}
/** A Principal do pedido usa o cadastro salvo; o navegador só informa seu endereço. */
function vincularPrincipalPedido(d: PedidoEntrada, cliente: ClienteVenda): PedidoEntrada {
  const enderecos = d.enderecosCobranca ?? (d.cobranca?.tipo ? [d.cobranca] : undefined);
  if (!enderecos) return d;
  const titular = identidadePrincipalCliente(clienteParaCobranca(cliente));
  const enderecosCobranca = enderecos.map((endereco, indice) => indice === 0 ? { ...endereco, ...titular } : endereco);
  const cobrancaSelecionada = d.cobrancaSelecionada ?? 0;
  return { ...d, enderecosCobranca, cobrancaSelecionada, cobranca: enderecosCobranca[cobrancaSelecionada] };
}
function vincularLivroSalvoPedido(d: PedidoEntrada, cliente: ClienteVenda): PedidoEntrada {
  const enderecosCobranca = cobrancasDoCliente(clienteParaCobranca(cliente));
  const solicitado = d.cobrancaSelecionada ?? 0;
  const cobrancaSelecionada = solicitado >= 0 && solicitado < enderecosCobranca.length ? solicitado : 0;
  return { ...d, enderecosCobranca, cobrancaSelecionada, cobranca: enderecosCobranca[cobrancaSelecionada] };
}
async function cadastrarClienteDoRascunho(tx: Tx, d: PedidoEntrada, autor: { userId: string; nome: string }, preparado?: ClientePreparado) {
  const cliente = d.clienteId ? await tx.clienteVenda.findUnique({ where: { id: d.clienteId } }) : null;
  if (cliente?.unificadoEmId) throw new ErroPedidoVenda("Este cadastro foi unificado. Selecione o cadastro da empresa.");
  if (!d.clienteNovo && !d.clienteAtualizacao) return { entrada: cliente ? vincularPrincipalPedido(d, cliente) : d, clienteVersao: undefined };
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
  if (d.clienteAtualizacao) {
    const atualizacao = d.clienteAtualizacao;
    const antes = await tx.clienteVenda.findUnique({ where: { id: d.clienteId! } });
    if (!antes?.ativo || antes.unificadoEmId) throw new ErroPedidoVenda("Selecione um cliente ativo.");
    if (normalizarEmailCliente(atualizacao.email) !== normalizarEmailCliente(antes.email)) throw new ErroPedidoVenda("O e-mail do cliente não pode ser alterado pelo pedido.");
    if (!preparado) throw new ErroPedidoVenda("Reabra os dados do cliente antes de salvar.");
    await salvarClienteNaTransacao(tx, preparado.entrada, autor, "CADASTRO", preparado.comprovacao);
    const salvo = await tx.clienteVenda.findUniqueOrThrow({ where: { id: d.clienteId! } });
    return { entrada: vincularLivroSalvoPedido({ ...d, clienteAtualizacao: undefined }, salvo), clienteVersao: atualizacao.versao + 1 };
  }
  if (!preparado) throw new ErroPedidoVenda("Reabra os dados do cliente antes de salvar.");
  const clienteId = await salvarClienteNaTransacao(tx, preparado.entrada, autor, "CADASTRO", preparado.comprovacao);
  const salvo = await tx.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } });
  return { entrada: vincularLivroSalvoPedido({ ...d, clienteId, clienteNovo: undefined }, salvo), clienteVersao: 1 };
}
/** Autoriza e reconhece repetição antes de consultar CNPJ. A transação final repete ambas as guardas. */
async function prepararClienteDoPedido(d: PedidoEntrada, sessao: SessaoAtual, operacao: string, resumo: string, pedidoId?: string, modo?: string): Promise<ClientePreparado | undefined> {
  if (!d.clienteNovo && !d.clienteAtualizacao) return undefined;
  const repeticao = await prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["rascunho", ...(d.clienteNovo ? ["cliente" as const] : []), ...(d.clienteAtualizacao ? ["editarCliente" as const] : []), ...exigePermissoesComerciais(d)], pedidoId, modo);
    return Boolean(await repetida(tx, operacao, resumo));
  }, { timeout: 30000 });
  if (repeticao) return undefined;
  if (d.clienteNovo) return prepararClienteParaSalvar(d.clienteNovo);
  const antes = await prisma.clienteVenda.findUnique({ where: { id: d.clienteId! } });
  if (!antes?.ativo || antes.unificadoEmId) throw new ErroPedidoVenda("Selecione um cliente ativo.");
  const atualizacao = d.clienteAtualizacao!;
  if (normalizarEmailCliente(atualizacao.email) !== normalizarEmailCliente(antes.email)) throw new ErroPedidoVenda("O e-mail do cliente não pode ser alterado pelo pedido.");
  return prepararClienteParaSalvar({ ...antes, ...atualizacao, dataNascimento: atualizacao.dataNascimento === undefined ? antes.dataNascimento?.toISOString().slice(0, 10) ?? null : atualizacao.dataNascimento });
}
async function resultadoCadastroOperacao(tx: Tx, operacao: string) {
  const salvo = await tx.historicoPedidoVenda.findUniqueOrThrow({ where: { chaveOperacao: operacao }, select: { depois: true, versaoNova: true } });
  const depois = salvo.depois as { clienteVersao?: number; rascunho?: { clienteId?: string | null } } | null;
  return { clienteId: depois?.rascunho?.clienteId ?? null, clienteVersao: depois?.clienteVersao, versao: salvo.versaoNova!, status: "RASCUNHO" };
}
export async function calcularPedido(tx: Tx, d: PedidoEntrada, pagamentoAnterior?: unknown, itensAnteriores?: (PrecoItemHistorico & { produtoSnapshot: unknown; unidadeSnapshot: string; composicaoSnapshot: unknown; estadoComposicao: string })[], preservarPrecos = false) {
  exigirPedidoConfirmavel(d.enderecosCobranca || d.cobranca?.tipo ? { ...d, cobranca: null } : d);
  const cliente = await tx.clienteVenda.findUnique({ where: { id: d.clienteId! } });
  if (!cliente?.ativo || cliente.unificadoEmId) throw new ErroPedidoVenda("Selecione um cliente ativo.");
  d = vincularPrincipalPedido(d, cliente);
  exigirPedidoConfirmavel(d);
  const canal = await tx.canalVenda.findUnique({ where: { id: d.canalId! } });
  if (!canal) throw new ErroPedidoVenda("Selecione um canal cadastrado.");
  const comprador = { id: cliente.id, nome: cliente.nome, primeiroNome: cliente.primeiroNome, sobrenome: cliente.sobrenome, tipo: cliente.tipo, documento: cliente.documento, razaoSocial: cliente.razaoSocial, inscricaoEstadual: cliente.inscricaoEstadual, email: cliente.email, telefone: cliente.telefone, contato: cliente.contato };
  const cobrancas = cobrancasDoCliente(clienteParaCobranca(cliente));
  const cobranca = d.cobranca ?? cobrancas.find(e => e.nome === "Cobrança") ?? cobrancas[0] ?? null;
  if (cobranca?.titularPendente === true) throw new ErroPedidoVenda("Titular pendente. Confirme o CNPJ antes de faturar.");
  const destinatario = d.destinatario?.nome ? d.destinatario : { nome: cliente.nome, contato: cliente.telefone ?? cliente.contato ?? "" };
  const itens: {
    produtoId: string; versaoPedido: number; ordem: number; quantidade: string; unidadeSnapshot: string;
    produtoSnapshot: Prisma.InputJsonValue; escolhasSnapshot: Prisma.InputJsonValue; composicaoSnapshot: Prisma.InputJsonValue | typeof Prisma.DbNull;
    estadoComposicao: string; observacoes: string | null; precoOriginal: string; precoAplicado: string; acrescimos: string; desconto: string; totalLinha: string;
  }[] = [];
  const brutos: Prisma.Decimal[] = [];
  for (const [ordem, entrada] of d.itens.entries()) {
    const original = entrada.itemOrigemId ? itensAnteriores?.find(i => i.id === entrada.itemOrigemId) : itensAnteriores?.[ordem];
    const snapshot = original?.produtoSnapshot as { tipoEmbalagem?: { id: string } | null; complementoAvulso?: ItemPedidoEntrada["complementoAvulso"] } | undefined;
    const mesmaEmbalagem = entrada.tipoEmbalagemId === undefined || entrada.tipoEmbalagemId === (snapshot?.tipoEmbalagem?.id ?? null);
    const mesmoAvulso = ["produtoOrigemId", "grupoId", "opcaoId"].every(k => (entrada.complementoAvulso as Record<string, unknown> | undefined)?.[k] === (snapshot?.complementoAvulso as Record<string, unknown> | undefined)?.[k]);
    if (preservarPrecos && original?.produtoId && mesmoAvulso && itemComercialPreservado(entrada, original)) {
      let produtoSnapshot = original.produtoSnapshot;
      if (!mesmaEmbalagem) {
        const tipoEmbalagem = entrada.tipoEmbalagemId ? await tx.tipoEmbalagemVenda.findUnique({ where: { id: entrada.tipoEmbalagemId }, select: { id: true, nome: true, ativo: true } }) : null;
        if (entrada.tipoEmbalagemId && !tipoEmbalagem?.ativo) throw new ErroPedidoVenda("Tipo de embalagem indisponível. Atualize a embalagem no cadastro do produto.");
        produtoSnapshot = { ...(original.produtoSnapshot as Record<string, unknown>), tipoEmbalagem: tipoEmbalagem ? { id: tipoEmbalagem.id, nome: tipoEmbalagem.nome } : null };
      }
      const bruto = limite(centavos(dinheiro(original.precoAplicado.toString()).plus(original.acrescimos.toString()).mul(entrada.quantidade)), "Total do item");
      brutos.push(bruto);
      itens.push({ produtoId: original.produtoId, versaoPedido: 0, ordem, quantidade: entrada.quantidade, unidadeSnapshot: original.unidadeSnapshot,
        produtoSnapshot: json(produtoSnapshot), escolhasSnapshot: json(original.escolhasSnapshot), composicaoSnapshot: original.composicaoSnapshot == null ? Prisma.DbNull : json(original.composicaoSnapshot),
        estadoComposicao: original.estadoComposicao, observacoes: entrada.observacoes || null, precoOriginal: dinheiro(original.precoOriginal.toString()).toFixed(2), precoAplicado: dinheiro(original.precoAplicado.toString()).toFixed(2),
        acrescimos: dinheiro(original.acrescimos.toString()).toFixed(2), desconto: "0.00", totalLinha: bruto.toFixed(2) });
      continue;
    }
    const produto = await tx.produtoVenda.findUnique({ where: { id: entrada.produtoId }, include: {
      categorias: { include: { categoria: true } }, componentes: { include: { insumo: true }, orderBy: { ordem: "asc" } },
      grupos: { orderBy: { ordem: "asc" }, include: { grupo: { include: { opcoes: { orderBy: { ordem: "asc" } } } } } },
    } });
    if (!produto?.ativo || !produto.classificacoes.some(c => ["PRINCIPAL", "OPCAO", "COMPLEMENTO"].includes(c))) throw new ErroPedidoVenda("Produto indisponível.");
    let complementoAvulso: { produtoOrigemId: string; grupoId: string; grupoNome: string; opcaoId: string; opcaoNome: string; multiplicador: string; unidadeProduto: string; preco: string } | undefined;
    if (!entrada.complementoAvulso && produto.classificacoes.includes("COMPLEMENTO") && !produto.classificacoes.includes("PRINCIPAL")) throw new ErroPedidoVenda("Complementos só podem ser escolhidos dentro de um produto.");
    if (entrada.complementoAvulso) {
      const legado = itensAnteriores?.find(i => i.produtoId === entrada.produtoId && (i.produtoSnapshot as { complementoAvulso?: { opcaoId: string } }).complementoAvulso?.opcaoId === entrada.complementoAvulso?.opcaoId);
      if (!legado) throw new ErroPedidoVenda("Complementos só podem ser escolhidos dentro de um produto.");
      const origem = entrada.complementoAvulso;
      const principal = await tx.produtoVenda.findUnique({ where: { id: origem.produtoOrigemId }, include: { grupos: { include: { grupo: { include: { opcoes: true } } } } } });
      const vinculo = principal?.grupos.find(v => v.grupoId === origem.grupoId);
      const grupo = vinculo?.grupo;
      const opcao = grupo?.opcoes.find(o => o.id === origem.opcaoId);
      if (!principal?.ativo || !principal.classificacoes.includes("PRINCIPAL") || !vinculo || !grupo?.ativo || !permiteOpcaoAvulsa(grupo, vinculo) || !opcao?.ativo || opcao.produtoId !== produto.id || vinculo.opcoesExcluidas.includes(opcao.id)) throw new ErroPedidoVenda("Complemento opcional indisponível. Atualize a seleção do item.");
      const precoOrigem = principal.preco;
      const gruposOrigem = principal.grupos.map(v => ({ ...v.grupo, opcoes: v.grupo.opcoes.map(o => ({ ...o, preco: o.preco.toString() })) }));
      if ((!precoOrigem.gt(0) && !precoObrigatorioNaConfiguracao(gruposOrigem, principal.grupos.map(v => ({ ...v, ajustesOpcoes: lerAjustesOpcoes(v.ajustesOpcoes) }))))) throw new ErroPedidoVenda("Grupo de complementos indisponível.");
      if (!opcao.preco.gt(0) || !opcao.quantidade.gt(0)) throw new ErroPedidoVenda("O complemento avulso precisa de preço e quantidade de composição positivos.");
      if (Object.values(entrada.escolhas).some(q => q !== 0)) throw new ErroPedidoVenda("Complemento avulso não recebe outras escolhas.");
      complementoAvulso = { ...origem, grupoNome: grupo.nome, opcaoNome: opcao.nome, multiplicador: opcao.quantidade.toString(), unidadeProduto: produto.unidade, preco: opcao.preco.toFixed(2) };
    }
    const itemAnterior = entrada.itemOrigemId ? itensAnteriores?.find(i => i.id === entrada.itemOrigemId) : itensAnteriores?.[ordem];
    const anterior = itemAnterior?.produtoId === produto.id ? itemAnterior.produtoSnapshot as { tipoEmbalagem?: { id: string; nome: string } | null; slotsEntrega?: string | null; slotsConfiguracao?: string } : null;
    const tipoEmbalagemId = entrada.tipoEmbalagemId === undefined ? anterior ? anterior.tipoEmbalagem?.id ?? null : produto.tipoEmbalagemId : entrada.tipoEmbalagemId;
    const preservado = tipoEmbalagemId && anterior?.tipoEmbalagem?.id === tipoEmbalagemId ? anterior.tipoEmbalagem : null;
    const tipoEmbalagem = preservado ?? (tipoEmbalagemId ? await tx.tipoEmbalagemVenda.findUnique({ where: { id: tipoEmbalagemId }, select: { id: true, nome: true, ativo: true } }) : null);
    if (tipoEmbalagemId && !preservado && (!tipoEmbalagem || !("ativo" in tipoEmbalagem) || !tipoEmbalagem.ativo)) throw new ErroPedidoVenda("Tipo de embalagem indisponível. Atualize a embalagem no cadastro do produto.");
    const unidade = complementoAvulso ? "UN" : produto.unidade;
    const quantidade = quantidadeComercial(entrada.quantidade, unidade);
    const preco = produto.preco;
    const precosComplementos = await tx.produtoVenda.findMany({ where: { id: { in: produto.grupos.flatMap(v => v.grupo.opcoes.filter(o => o.usarPrecoPadrao && o.produtoId).map(o => o.produtoId!)) } }, select: { id: true, preco: true } });
    const cadastrosPrecos = precosComplementos.map(p => ({ id: p.id, preco: p.preco.toString() }));
    const grupos = complementoAvulso ? [] : produto.grupos.map(v => { const vinculo = { grupoId: v.grupoId, usarPadrao: v.usarPadrao, minimo: v.minimo, maximo: v.maximo, opcoesExcluidas: v.opcoesExcluidas, ajustesOpcoes: lerAjustesOpcoes(v.ajustesOpcoes) }; return { ...v.grupo, opcoes: opcoesEfetivas(precosOpcoes(v.grupo.opcoes.map(o => ({ ...o, preco: o.preco.toString(), quantidade: o.quantidade.toString(), composicao: o.composicao == null ? null : validarComponentes(o.composicao) })), cadastrosPrecos), vinculo), vinculo }; });
    const baseZeroHabilitada = precoObrigatorioNaConfiguracao(grupos, grupos.map(g => g.vinculo));
    if (!complementoAvulso && (!preco.greaterThan(0) && !baseZeroHabilitada)) throw new ErroPedidoVenda("Produto sem preço positivo ou escolha obrigatória paga.");
    const precoOriginal = complementoAvulso ? dinheiro(complementoAvulso.preco) : preco;
    const simulacao = simularConfiguracao(precoOriginal.toString(), grupos, entrada.escolhas);
    if (!simulacao.valido || simulacao.totalCentavos <= 0) throw new ErroPedidoVenda(simulacao.erros[0] ?? "Configuração sem preço final positivo.");
    const acrescimos = new Prisma.Decimal(simulacao.totalCentavos).div(100).minus(precoOriginal);
    const precoAplicado = entrada.precoManual === null ? precoOriginal : dinheiro(entrada.precoManual);
    const bruto = limite(centavos(precoAplicado.plus(acrescimos).mul(quantidade)), "Total do item");
    if (!bruto.greaterThan(0)) throw new ErroPedidoVenda("O item precisa ter valor positivo.");
    const escolhas = grupos.flatMap(g => g.opcoes.filter(o => entrada.escolhas[o.id]).map(o => ({ grupoId: g.id, grupoNome: g.nome, grupoTipo: g.tipo, opcaoId: o.id, opcaoNome: o.nome, produtoId: o.produtoId, quantidade: entrada.escolhas[o.id], multiplicador: o.composicao == null ? o.quantidade : "1", composicao: o.composicao, preco: o.preco, limites: limitesEfetivos(g, g.vinculo) })));
    const opcionais = await tx.produtoVenda.findMany({ where: { id: { in: escolhas.map(o => o.produtoId).filter((v): v is string => !!v) } }, include: { componentes: { include: { insumo: true } } } });
    const composicao = produto.componentes.map(c => ({ insumoId: c.insumoId, nome: c.insumo.nome, unidade: c.unidade, quantidade: c.quantidade.mul(complementoAvulso?.multiplicador ?? "1").toString(), origem: "PRODUTO" }));
    let pendente = produto.componentes.length === 0 && produto.tipo !== "PERSONALIZADO";
    const opcaoIdsComComposicao: string[] = [];
    for (const escolha of escolhas) {
      const opcional = opcionais.find(p => p.id === escolha.produtoId);
      if (!escolha.produtoId && escolha.composicao == null) { pendente = true; continue; }
      const aliasComposicao = escolha.grupoTipo === "COMPOSICAO" && !!escolha.composicao?.length;
      if (escolha.produtoId && (!opcional || !opcional.ativo && !aliasComposicao)) throw new ErroPedidoVenda("Complemento vinculado indisponível. Atualize as escolhas.");
      const componentes = escolha.composicao ?? opcional!.componentes;
      if (!componentes.length) { pendente = true; continue; }
      const insumos = escolha.composicao ? await tx.insumo.findMany({ where: { id: { in: componentes.map(c => c.insumoId) } } }) : [];
      for (const c of componentes) {
        const insumo = "insumo" in c ? c.insumo : insumos.find(i => i.id === c.insumoId);
        if (!insumo?.ativo || insumo.unidade !== c.unidade) throw new ErroPedidoVenda("Composição do complemento indisponível ou unidade alterada.");
        composicao.push({ insumoId: c.insumoId, nome: insumo.nome, unidade: c.unidade, quantidade: new Prisma.Decimal(c.quantidade).mul(escolha.multiplicador).mul(escolha.quantidade).toString(), origem: escolha.opcaoId });
      }
      opcaoIdsComComposicao.push(escolha.opcaoId);
    }
    const slotsConfiguracao = assinaturaEntradas({ escolhas: entrada.escolhas, complementoAvulso: entrada.complementoAvulso ?? null });
    const slotsEntrega = anterior?.slotsConfiguracao === slotsConfiguracao && Object.hasOwn(anterior, "slotsEntrega") ? anterior.slotsEntrega ?? null : slotsPorUnidade(produto.slotsEntrega, complementoAvulso?.multiplicador ?? "1", escolhas.filter(e => e.produtoId).map(e => ({ slots: opcionais.find(p => p.id === e.produtoId)?.slotsEntrega, quantidade: e.quantidade, multiplicador: e.multiplicador })));
    let materiaisFiscais: Awaited<ReturnType<typeof fotografarMateriais>> | undefined;
    try { materiaisFiscais = await fotografarMateriais(tx, composicao.map(c => c.insumoId)); } catch { /* Ausência de prova física bloqueia a prévia fiscal afetada, sem modificar o fluxo comercial. */ }
    let fotografiaKitFiscal: FotografiaKitFiscal | undefined;
    let receitaFiscalDocumentadaSnapshot: ReceitaFiscalDocumentadaSnapshot | undefined;
    try {
      const dataFiscal = hojeFiscal();
      const classificacao = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "CLASSIFICACAO", chave: produto.id, status: "ATIVO", vigenciaInicio: { lte: new Date(`${dataFiscal}T00:00:00Z`) } }, orderBy: [{ vigenciaInicio: "desc" }, { versao: "desc" }] });
      const dados = classificacao?.dados as unknown as ClassificacaoFiscal | undefined;
      if (classificacao && dados?.tratamento === "KIT_COMPOSTO") {
        const copia = structuredClone(dados);
        await fotografarComponentesKit(tx, copia, false, dataFiscal);
        fotografiaKitFiscal = fotografarPoliticaKit(copia, classificacao.id);
      }
      if (classificacao && dados?.receitaFiscalDocumentada) {
        const foto = dados.configuracaoNcm ? await fotografarReceitaFiscal(tx, dados, false, escolhas.map(e => e.opcaoId)) : await fotografarClassificacaoNormal(tx, dados);
        const receita = "opcaoHashes" in foto ? { principalHash: foto.principalHash, opcaoHashes: foto.opcaoHashes, materiais: foto.materiais, documentacaoHash: foto.documentacaoHash } : { principalHash: foto.principalHash, opcaoHashes: [], materiais: { principal: foto.materiais, opcoes: [] }, documentacaoHash: foto.documentacaoHash };
        const fisicaOrigem = receitaDoSnapshot(produto.unidade, composicao, escolhas, true, materiaisFiscais, produto.modoPreparo);
        for (const opcaoId of opcaoIdsComComposicao.filter(id => !receita.opcaoHashes.some(o => o.opcaoId === id))) {
          const hash = fisicaOrigem?.opcaoHashes.find(o => o.opcaoId === opcaoId), material = fisicaOrigem?.materiais?.opcoes.find(o => o.opcaoId === opcaoId);
          if (hash && material) { receita.opcaoHashes.push(hash); receita.materiais?.opcoes.push(material); }
        }
        receitaFiscalDocumentadaSnapshot = { classificacaoVersaoId: classificacao.id, receita };
      }
    } catch { /* Kit sem prova própria permanece comercialmente disponível, com emissão afetada pendente. */ }
    brutos.push(bruto);
    itens.push({ produtoId: produto.id, versaoPedido: 0, ordem, quantidade, unidadeSnapshot: unidade, observacoes: entrada.observacoes || null,
      produtoSnapshot: json({ slotsEntrega, slotsConfiguracao, nome: complementoAvulso?.opcaoNome ?? produto.nome, codigo: produto.codigo, tipo: produto.tipo, modoPreparo: produto.modoPreparo, comprovacaoFisicaFiscal: { baseSemIngredientes: produto.componentes.length === 0, opcaoIdsComComposicao }, ...(materiaisFiscais ? { materiaisFiscais } : {}), ...(fotografiaKitFiscal ? { fotografiaKitFiscal } : {}), ...(receitaFiscalDocumentadaSnapshot ? { receitaFiscalDocumentadaSnapshot } : {}), ...(complementoAvulso ? { complementoAvulso } : {}), ...(tipoEmbalagem || entrada.tipoEmbalagemId !== undefined ? { tipoEmbalagem: tipoEmbalagem ? { id: tipoEmbalagem.id, nome: tipoEmbalagem.nome } : null } : {}), classificacoes: produto.classificacoes, versao: produto.versao, categorias: produto.categorias.map(c => ({ id: c.categoriaId, nome: c.categoria.nome })), preco: complementoAvulso ? complementoAvulso.preco : preco.toString() }),
      escolhasSnapshot: json(escolhas.map(e => ({ ...e, composicaoFiscalComprovada: opcaoIdsComComposicao.includes(e.opcaoId), unidadeProduto: opcionais.find(p => p.id === e.produtoId)?.unidade ?? null, modoPreparoProduto: opcionais.find(p => p.id === e.produtoId)?.modoPreparo ?? null }))), composicaoSnapshot: composicao.length ? json(composicao) : Prisma.DbNull, estadoComposicao: pendente ? "PENDENTE" : "CONHECIDA", precoOriginal: precoOriginal.toFixed(2), precoAplicado: precoAplicado.toFixed(2), acrescimos: acrescimos.toFixed(2), desconto: "0.00", totalLinha: bruto.toFixed(2) });
  }
  const subtotal = limite(brutos.reduce((s, v) => s.plus(v), new Prisma.Decimal(0)), "Subtotal");
  const desconto = dinheiro(d.desconto), frete = dinheiro(d.frete), outrosCustos = dinheiro(d.outrosCustos ?? "0");
  if (desconto.greaterThan(subtotal)) throw new ErroPedidoVenda("O desconto não pode exceder o valor dos itens.");
  const rateios = brutos.map(v => v.mul(desconto).div(subtotal).toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN));
  let residuos = desconto.minus(rateios.reduce((s, v) => s.plus(v), new Prisma.Decimal(0))).mul(100).toNumber();
  for (let n = 0; residuos > 0; n = (n + 1) % rateios.length) {
    if (rateios[n].lessThan(brutos[n])) { rateios[n] = rateios[n].plus("0.01"); residuos--; }
  }
  for (const [n, item] of itens.entries()) {
    item.desconto = rateios[n].toFixed(2);
    item.totalLinha = brutos[n].minus(rateios[n]).toFixed(2);
  }
  const total = limite(subtotal.minus(desconto).plus(frete).plus(outrosCustos), "Total do pedido");
  const pagamento = await pagamentoComercial(tx, d, true, pagamentoAnterior);
  return { clienteId: cliente.id, canalId: canal.id, canalNomeSnapshot: canal.nome, atendimento: d.atendimento!, prazo: d.prazo!, previsaoData: dataCivil(d.previsaoData), previsaoJanela: d.previsaoJanela, compradorSnapshot: json(comprador), cobrancaSnapshot: d.cobranca ? json({ ...d.cobranca, nome: "Cobrança", ...(d.enderecosCobranca ? { enderecos: d.enderecosCobranca, selecionado: d.cobrancaSelecionada } : {}) }) : cobranca ? json(cobranca) : Prisma.DbNull, destinatarioSnapshot: json(destinatario), enderecoSnapshot: d.atendimento === "ENTREGA" ? json(d.endereco) : Prisma.DbNull, observacoes: d.observacoes || null, formaPagamentoInformada: pagamento?.tipo ?? d.formaPagamentoInformada ?? null, pagamentoInformadoSnapshot: pagamento ? json(pagamento) : Prisma.DbNull,
    subtotal: subtotal.toFixed(2), desconto: desconto.toFixed(2), frete: frete.toFixed(2), outrosCustos: outrosCustos.toFixed(2), total: total.toFixed(2), itens };
}

async function referenciaUnica(tx: Tx, d: PedidoEntrada, pedidoId?: string) {
  const campos = { referenciaOrigem: d.referenciaOrigem || null, referenciaEstabelecimento: d.referenciaEstabelecimento || null, referenciaPedido: d.referenciaPedido || null };
  if (campos.referenciaPedido) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${JSON.stringify(campos)}))`;
    if (await tx.pedidoVenda.findFirst({ where: { ...campos, ...(pedidoId ? { id: { not: pedidoId } } : {}) }, select: { id: true } })) throw new ErroPedidoVenda("Esta referência externa já pertence a outro pedido nessa origem e estabelecimento.");
  }
  return campos;
}

export async function criarRascunhoPedido(valor: unknown, operacao: unknown, sessao: SessaoAtual, modo: "HUB" | "EXTERNO" = "EXTERNO", versaoFinanceiro = 0): Promise<{ id: string; numero: number; versao: number; status: string; clienteId?: string | null; clienteVersao?: number }> {
  if (![0, 1].includes(versaoFinanceiro) || (versaoFinanceiro === 1 && modo !== "HUB")) throw new ErroPedidoVenda("Contrato financeiro inválido.");
  const d = validarEntradaPedido(valor), chaveOperacao = chave(operacao), resumo = hash({ tipo: "CRIADO", d, modo, ...(versaoFinanceiro ? { versaoFinanceiro } : {}) });
  exigirTelefoneDestinatario(d);
  const clientePreparado = await prepararClienteDoPedido(d, sessao, chaveOperacao, resumo, undefined, modo);
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["rascunho", ...(d.clienteNovo ? ["cliente" as const] : []), ...(d.clienteAtualizacao ? ["editarCliente" as const] : []), ...exigePermissoesComerciais(d)], undefined, modo);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    await travarOperacao(tx, chaveOperacao);
    const existente = await repetida(tx, chaveOperacao, resumo); if (existente) return { ...existente, ...await resultadoCadastroOperacao(tx, chaveOperacao) };
    await pagamentoComercial(tx, d);
    const { entrada: cadastroSalvo, clienteVersao } = await cadastrarClienteDoRascunho(tx, d, autor, clientePreparado);
    const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
    const fusoHorario = loja?.fusoHorario ?? "America/Sao_Paulo";
    const salvo = { ...cadastroSalvo, dataCompra: d.dataCompra ?? diaNoFuso(new Date(), fusoHorario) };
    const pedido = await tx.pedidoVenda.create({ data: { clienteId: salvo.clienteId, dataCompra: dataCivil(salvo.dataCompra), modoFinanceiro: modo, versaoFinanceiro, fusoHorario, ...await referenciaUnica(tx, salvo), chaveCriacao: chaveOperacao, hashCriacao: resumo, criadoPorId: autor.userId, rascunho: json(salvo) } });
    await evento(tx, pedido.id, "CRIADO", chaveOperacao, resumo, autor, null, 1, null, json({ rascunho: salvo, clienteVersao }));
    return { id: pedido.id, numero: pedido.numero, versao: pedido.versao, status: pedido.status, clienteId: salvo.clienteId, clienteVersao };
  }, { timeout: 30000 });
}

export async function salvarRascunhoPedido(pedidoId: unknown, versaoAtual: unknown, valor: unknown, operacao: unknown, sessao: SessaoAtual): Promise<{ id: string; numero: number; versao: number; status: string; clienteId?: string | null; clienteVersao?: number }> {
  const id = identificador(pedidoId), versaoPedido = versao(versaoAtual), d = validarEntradaPedido(valor), chaveOperacao = chave(operacao), resumo = hash({ tipo: "RASCUNHO_EDITADO", id, versaoPedido, d });
  exigirTelefoneDestinatario(d);
  const clientePreparado = await prepararClienteDoPedido(d, sessao, chaveOperacao, resumo, id);
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["rascunho", ...(d.clienteNovo ? ["cliente" as const] : []), ...(d.clienteAtualizacao ? ["editarCliente" as const] : []), ...exigePermissoesComerciais(d)], id);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    await travarOperacao(tx, chaveOperacao);
    const existente = await repetida(tx, chaveOperacao, resumo); if (existente) return { ...existente, ...await resultadoCadastroOperacao(tx, chaveOperacao) };
    const antes = await fotografia(tx, id);
    const original = antes as { dataCompra?: string | null; origem?: string; status?: string };
    const dataCompra = d.dataCompra ?? original.dataCompra?.slice(0, 10) ?? null;
    if (d.dataCompra && d.dataCompra !== original.dataCompra?.slice(0, 10) && (original.origem !== "INTERNO" || original.status !== "RASCUNHO")) throw new ErroPedidoVenda("A data da compra só pode mudar em um orçamento manual.");
    await pagamentoComercial(tx, d);
    const { entrada: cadastroSalvo, clienteVersao } = await cadastrarClienteDoRascunho(tx, d, autor, clientePreparado);
    const salvo = { ...cadastroSalvo, ...(dataCompra ? { dataCompra } : {}) };
    const atualizado = await tx.pedidoVenda.updateMany({ where: { id, versao: versaoPedido, status: "RASCUNHO" }, data: { clienteId: salvo.clienteId, dataCompra: dataCivil(dataCompra), ...await referenciaUnica(tx, salvo, id), rascunho: json(salvo), versao: { increment: 1 } } });
    exigirAtualizado(atualizado.count);
    const depois = await tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { id: true, numero: true, versao: true, status: true, clienteId: true } });
    await evento(tx, id, "RASCUNHO_EDITADO", chaveOperacao, resumo, autor, versaoPedido, depois.versao, antes, json({ rascunho: salvo, clienteVersao }));
    return { ...depois, clienteVersao };
  }, { timeout: 30000 });
}

export async function confirmarPedido(pedidoId: unknown, versaoAtual: unknown, operacao: unknown, sessao: SessaoAtual, condicao?: CondicaoFinanceiraPedido) {
  const id = identificador(pedidoId), versaoPedido = versao(versaoAtual), chaveOperacao = chave(operacao), resumo = hash({ tipo: "CONFIRMADO", id, versaoPedido, condicao: condicao ?? null });
  return prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["confirmar"], id);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    await travarOperacao(tx, chaveOperacao);
    const existente = await repetida(tx, chaveOperacao, resumo); if (existente) return existente;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id } });
    if (!pedido || pedido.status !== "RASCUNHO" || pedido.versao !== versaoPedido) throw new ErroPedidoVenda("Reabra o pedido antes de confirmar.");
    const d = validarEntradaPedido(pedido.rascunho);
    const dataCompra = dataCompraCivil(pedido.dataCompra);
    if ((d.dataCompra ?? null) !== dataCompra) throw new ErroPedidoVenda("A data da compra mudou. Reabra o orçamento antes de confirmar.");
    exigirTelefoneDestinatario(d);
    exigirPagamentoConfirmacao(d, pedido.modoFinanceiro as "HUB" | "EXTERNO", !!condicao);
    if (pedido.modoFinanceiro === "EXTERNO") await conferirJanela(tx, d.previsaoData, d.previsaoJanela);
    const autor = await conferirAcesso(tx, sessao, ["confirmar", ...exigePermissoesComerciais(d)], id);
    const calculado = { ...await calcularPedido(tx, d, pedido.pagamentoInformadoSnapshot), ...await referenciaUnica(tx, d, id) };
    if (d.pagamentoInformado) {
      const regras = await regrasClientePedido(tx, calculado.clienteId);
      exigirFormaPagamentoCliente(regras, d.pagamentoInformado.formaId);
      if (calculado.formaPagamentoInformada === "BOLETO") for (const vencimento of d.pagamentoInformado.vencimentos) exigirVencimentoBoletoCliente(regras, { ...pedido, previsaoData: calculado.previsaoData }, dataFinanceira(vencimento, "o vencimento do boleto"));
    }
    const entrega = await validarFretePedido(tx, d, dinheiro(calculado.subtotal).minus(calculado.desconto).toFixed(2), sessao, undefined, embalagensDosItens(calculado.itens), slotsDosItens(calculado.itens));
    calculado.frete = entrega.frete; calculado.total = limite(dinheiro(calculado.subtotal).minus(calculado.desconto).plus(entrega.frete).plus(calculado.outrosCustos), "Total do pedido").toFixed(2);
    if (pedido.modoFinanceiro === "EXTERNO" && condicao) throw new ErroPedidoVenda("Financeiro controlado externamente. Confirme sem condição financeira no HUB.");
    let condicaoEfetiva = condicao && dataCompra ? { ...condicao, dataCompetencia: dataCompra } : condicao;
    const confirmadoEm = new Date();
    if (pedido.versaoFinanceiro === 1) {
      // A categoria de receita é a do canal de venda; a interface não a escolhe por pedido.
      const canal = await tx.canalVenda.findUnique({ where: { id: calculado.canalId }, select: { nome: true, categoriaReceitaId: true } });
      if (!canal?.categoriaReceitaId) throw new ErroPedidoVenda(`Defina a categoria de receita do canal ${canal?.nome ?? "do pedido"} em Canais de venda antes de confirmar.`);
      if (condicao?.categoriaId && condicao.categoriaId !== canal.categoriaReceitaId) throw new ErroPedidoVenda("A categoria de receita vem do canal de venda. Reabra o pedido antes de confirmar.");
      const categoriaId = canal.categoriaReceitaId, dataCompetencia = dataCompra ?? diaNoFuso(confirmadoEm, pedido.fusoHorario);
      const pagamento = calculado.pagamentoInformadoSnapshot as PagamentoComercialSnapshot | null;
      const forma = dataCompra && pagamento && pagamento.tipo !== "BOLETO" && !condicao?.parcelas.length && !condicao?.vencimento ? await tx.formaPagamentoVenda.findUnique({ where: { id: pagamento.formaId } }) : null;
      const vencimentoAutomatico = forma && dataCompra ? vencimentoPrazoPedido(forma, dataCompra) : null;
      condicaoEfetiva = condicao?.parcelas.length
        ? { ...condicao, categoriaId, dataCompetencia }
        : condicaoDoPagamento({ total: calculado.total, credito: condicao?.creditoUtilizado || "0.00", pagamento, categoriaId, dataCompetencia, vencimento: condicao?.vencimento || vencimentoAutomatico || undefined });
    }
    const financeira = condicaoEfetiva ? await validarCondicao(tx, condicaoEfetiva, dinheiro(calculado.total), dataCompra) : null;
    if (financeira) {
      const regras = await regrasClientePedido(tx, calculado.clienteId);
      for (const parcela of financeira.parcelas) {
        exigirFormaPagamentoCliente(regras, parcela.forma.id);
        if (parcela.forma.tipo === "BOLETO") exigirVencimentoBoletoCliente(regras, { ...pedido, previsaoData: calculado.previsaoData }, parcela.vencimento);
      }
      if (regras.limiteCreditoAberto !== null) exigirLimiteCreditoCliente(regras.limiteCreditoAberto, await saldoAbertoCliente(tx, calculado.clienteId), dinheiro(calculado.total).minus(financeira.credito));
    } else if (pedido.modoFinanceiro === "HUB") {
      const regras = await regrasClientePedido(tx, calculado.clienteId);
      if (regras.limiteCreditoAberto !== null || regras.formasPagamentoHabilitadas !== null || regras.boletoDiasAposEntrega !== null) throw new ErroPedidoVenda("Defina a condição financeira para conferir as regras de pagamento deste cliente.");
    }
    if (financeira?.credito.greaterThan(0)) {
      await tx.$queryRaw`SELECT id FROM "ClienteVenda" WHERE id = ${d.clienteId!} FOR UPDATE`;
      if ((await saldoCreditoCliente(tx, d.clienteId!)).lessThan(financeira.credito)) throw new ErroPedidoVenda("Crédito disponível mudou; reabra antes de confirmar.");
    }
    const antes = await fotografia(tx, id);
    const atualizado = await tx.pedidoVenda.updateMany({ where: { id, versao: versaoPedido, status: "RASCUNHO" }, data: { ...Object.fromEntries(Object.entries(calculado).filter(([k]) => k !== "itens")), entregaSnapshot: entrega.snapshot, status: "CONFIRMADO", confirmadoEm, rascunho: Prisma.DbNull, versao: { increment: 1 } } });
    exigirAtualizado(atualizado.count);
    await tx.itemPedidoVenda.createMany({ data: calculado.itens.map(i => ({ ...i, pedidoId: id, versaoPedido: versaoPedido + 1 })) });
    if (financeira) {
      const comprador = calculado.compradorSnapshot as { nome: string };
      for (const [indice, parcela] of financeira.parcelas.entries()) await tx.lancamentoFinanceiro.create({ data: {
        tipo: "RECEITA", descricao: `Pedido #${pedido.numero} · parcela ${indice + 1}/${financeira.parcelas.length}`,
        valor: parcela.valor, categoriaId: financeira.categoriaId, dataCompetencia: financeira.competencia, dataVencimento: parcela.vencimento,
        contraparteNome: comprador.nome, criadoPorId: autor.userId, pedidoVendaId: id, pedidoEfeitoChave: `titulo:${indice + 1}`,
        pedidoParcelaRaiz: parcela.raiz, pedidoValorOriginal: parcela.valor, formaPagamentoVendaId: parcela.forma.id, pedidoFormaSnapshot: parcela.formaSnapshot,
      } });
      if (financeira.credito.greaterThan(0)) {
        const dataAplicacao = new Date();
        await tx.lancamentoFinanceiro.create({ data: { tipo: "RECEITA", descricao: `Pedido #${pedido.numero} · quitado com crédito do cliente`, valor: financeira.credito, categoriaId: financeira.categoriaId, dataCompetencia: financeira.competencia, dataVencimento: dataAplicacao, status: "BAIXADO", dataPagamento: dataAplicacao, contraparteNome: comprador.nome, criadoPorId: autor.userId, pedidoVendaId: id, pedidoEfeitoChave: `credito:${chaveOperacao}`, pedidoParcelaRaiz: `credito-${chaveOperacao}`, pedidoValorOriginal: financeira.credito, pedidoFormaSnapshot: json({ tipo: "CREDITO_CLIENTE", valor: financeira.credito.toFixed(2) }), pedidoQuitadoCredito: true } });
        await tx.creditoClienteMovimento.create({ data: { clienteId: d.clienteId!, tipo: "APLICACAO", valor: financeira.credito, pedidoAplicacaoId: id, data: dataAplicacao, chaveOperacao: `credito-aplicar:${chaveOperacao}`, hashOperacao: resumo, criadoPorId: autor.userId } });
      }
      await historicoFinanceiro(tx, id, chaveOperacao, resumo, "TITULOS_GERADOS", autor, { total: calculado.total, competencia: financeira.competencia.toISOString(), credito: financeira.credito.toString(), parcelas: financeira.parcelas.map(p => ({ raiz: p.raiz, valor: p.valor.toString(), vencimento: p.vencimento.toISOString(), formaId: p.forma.id })) });
    }
    const depois = await fotografia(tx, id);
    await evento(tx, id, "CONFIRMADO", chaveOperacao, resumo, autor, versaoPedido, versaoPedido + 1, antes, depois);
    return tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { id: true, numero: true, versao: true, status: true } });
  }, { timeout: 30000 });
}

type PedidoEdicao = Prisma.PedidoVendaGetPayload<{ include: { itens: true } }>;
function exigirComercialPreservado(pedido: PedidoEdicao, d: PedidoEntrada) {
  const recusar = () => { throw new ErroPedidoVenda(mensagemAlteracaoComercialPedido); };
  if (d.dataCompra !== undefined && d.dataCompra !== dataCompraCivil(pedido.dataCompra)) recusar();
  if (d.clienteNovo || d.clienteAtualizacao || d.entrega || d.clienteId !== pedido.clienteId || d.canalId !== pedido.canalId || d.atendimento !== pedido.atendimento || (d.observacoes || null) !== pedido.observacoes) recusar();
  for (const campo of ["desconto", "frete", "outrosCustos"] as const) if (!dinheiro(d[campo] ?? "0").equals(pedido[campo])) recusar();
  const endereco = snapshotTexto(pedido.enderecoSnapshot, ["pais", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "codigoMunicipio"]);
  const normalizado = endereco ? validarEntradaPedido({ endereco, itens: [] }).endereco : null;
  if (jsonCanonico(normalizado) !== jsonCanonico(d.endereco)) recusar();
  for (const campo of ["referenciaOrigem", "referenciaEstabelecimento", "referenciaPedido"] as const) if ((d[campo] || null) !== pedido[campo]) recusar();
  const entrega = pedido.entregaSnapshot as { veiculoEntregaId?: string } | null;
  if (d.veiculoEntregaId !== undefined && d.veiculoEntregaId !== (entrega?.veiculoEntregaId ?? null)) recusar();
  const pagamento = pedido.pagamentoInformadoSnapshot as PagamentoComercialSnapshot | null;
  if (d.formaPagamentoInformada && d.formaPagamentoInformada !== pedido.formaPagamentoInformada) recusar();
  if (jsonCanonico(d.pagamentoInformado ?? null) !== jsonCanonico(pagamento ? { formaId: pagamento.formaId, parcelas: pagamento.parcelas, vencimentos: pagamento.vencimentos } : null)) recusar();
  if (pedido.itens.length !== d.itens.length) recusar();
  for (const [indice, item] of pedido.itens.entries()) {
    const enviado = d.itens[indice], produto = item.produtoSnapshot as { tipoEmbalagem?: { id: string }; complementoAvulso?: { produtoOrigemId: string; grupoId: string; opcaoId: string } } | null;
    if (!enviado || enviado.produtoId !== item.produtoId || enviado.itemOrigemId && enviado.itemOrigemId !== item.id || !dinheiro(quantidadeComercial(enviado.quantidade, item.unidadeSnapshot)).equals(item.quantidade) || (enviado.observacoes || null) !== item.observacoes) recusar();
    if (enviado.tipoEmbalagemId !== undefined && enviado.tipoEmbalagemId !== (produto?.tipoEmbalagem?.id ?? null)) recusar();
    const origem = produto?.complementoAvulso;
    if (jsonCanonico(enviado.complementoAvulso ?? null) !== jsonCanonico(origem ? { produtoOrigemId: origem.produtoOrigemId, grupoId: origem.grupoId, opcaoId: origem.opcaoId } : null)) recusar();
    const escolhas = Array.isArray(item.escolhasSnapshot) ? item.escolhasSnapshot as { opcaoId: string; quantidade: number }[] : [];
    if (jsonCanonico(enviado.escolhas) !== jsonCanonico(Object.fromEntries(escolhas.map(e => [e.opcaoId, e.quantidade])))) recusar();
    const manual = item.precoOriginal.equals(item.precoAplicado) ? null : item.precoAplicado;
    if (enviado.precoManual === null ? manual !== null : manual === null || !dinheiro(enviado.precoManual).equals(manual)) recusar();
  }
}

/** Compatibilidade com o editor anterior: o contrato completo nunca revisa efeitos
 * comerciais, nem reconsulta o catálogo dos produtos já vendidos. */
export async function revisarPedido(pedidoId: unknown, versaoAtual: unknown, valor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const d = validarEntradaPedido(valor);
  const informacoes = validarInformacoesPedido({ previsaoData: d.previsaoData, previsaoJanela: d.previsaoJanela, cobranca: d.cobranca ?? null, destinatario: d.destinatario, motivo: "Atualização de informações do pedido" });
  return editarInformacoesPedidoInterna(pedidoId, versaoAtual, informacoes, operacao, sessao, { tipo: "REVISADO", entradaComercial: d });
}

export async function editarInformacoesPedido(pedidoId: unknown, versaoAtual: unknown, valor: unknown, operacao: unknown, sessao: SessaoAtual) {
  return editarInformacoesPedidoInterna(pedidoId, versaoAtual, validarInformacoesPedido(valor), operacao, sessao, { tipo: "INFORMACOES_ATUALIZADAS" });
}

async function editarInformacoesPedidoInterna(pedidoId: unknown, versaoAtual: unknown, d: InformacoesPedidoEntrada, operacao: unknown, sessao: SessaoAtual, contexto: { tipo: string; entradaComercial?: PedidoEntrada }) {
  const id = identificador(pedidoId), versaoPedido = versao(versaoAtual), chaveOperacao = chave(operacao), resumo = hash({ tipo: contexto.tipo, id, versaoPedido, d, entradaComercial: contexto.entradaComercial, usuarioId: sessao.userId });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "revisar"], id);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    await travarOperacao(tx, chaveOperacao);
    const existente = await repetida(tx, chaveOperacao, resumo); if (existente) return tx.pedidoVenda.findUniqueOrThrow({ where: { id: existente.id }, select: { id: true, numero: true, versao: true, status: true, statusOperacional: true } });
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } });
    if (!pedido || pedido.versao !== versaoPedido) throw new ErroPedidoVenda("O pedido mudou em outra tela. Reabra para conferir antes de salvar.");
    if (contexto.entradaComercial) {
      if (["RASCUNHO", "DECLINADO"].includes(pedido.status)) throw new ErroPedidoVenda("Edite os produtos e valores pelo orçamento.");
      exigirComercialPreservado(pedido, contexto.entradaComercial);
    }
    if (Object.hasOwn(d, "destinatario") && pedido.atendimento === "ENTREGA" && !d.destinatario?.nome) throw new ErroPedidoVenda("Informe o nome do destinatário.");
    const dados: Prisma.PedidoVendaUpdateManyMutationInput = {};
    if (Object.hasOwn(d, "previsaoData")) {
      const previsao = dataCivil(d.previsaoData ?? null);
      const alterada = pedido.previsaoData?.getTime() !== previsao?.getTime() || pedido.previsaoJanela !== d.previsaoJanela;
      if (alterada) {
        if (pedido.modoFinanceiro === "EXTERNO") await conferirJanela(tx, d.previsaoData ?? null, d.previsaoJanela ?? null);
        if (pedido.modoFinanceiro === "HUB" && pedido.clienteId) await conferirPrazosBoletoPedido(tx, id, await regrasClientePedido(tx, pedido.clienteId), { ...pedido, previsaoData: previsao });
      }
      dados.previsaoData = previsao;
      dados.previsaoJanela = d.previsaoJanela;
      dados.prazo = previsao ? "AGENDADO" : "IMEDIATO";
    }
    if (Object.hasOwn(d, "cobranca")) {
      const anterior = pedido.cobrancaSnapshot as { enderecos?: unknown[]; selecionado?: number; tipo?: "PF" | "PJ" } | null;
      if (!d.cobranca && anterior?.selecionado === 0) throw new ErroPedidoVenda("A cobrança Principal não pode ser removida.");
      if (d.cobranca && anterior?.selecionado === 0) {
        if (anterior.tipo) d.cobranca = { ...d.cobranca, ...validarIdentidadeCobranca(anterior) };
        else {
          const comprador = pedido.compradorSnapshot && typeof pedido.compradorSnapshot === "object" && !Array.isArray(pedido.compradorSnapshot) ? pedido.compradorSnapshot : null;
          if (comprador?.tipo === "PF" || comprador?.tipo === "PJ") {
            const titular = identidadePrincipalCliente({ tipo: comprador.tipo, nome: String(comprador.nome ?? ""), documento: String(comprador.documento ?? ""),
              razaoSocial: String(comprador.razaoSocial ?? ""), inscricaoEstadual: String(comprador.inscricaoEstadual ?? ""), enderecos: [] });
            d.cobranca = { ...d.cobranca, ...titular };
          }
        }
      }
      // Clientes antigos de UI podem alterar só o endereço. Conserva o titular já fotografado.
      if (d.cobranca && !d.cobranca.tipo && anterior?.tipo) d.cobranca = { ...d.cobranca, ...validarIdentidadeCobranca(anterior, true) };
      const selecionado = anterior?.selecionado ?? 0;
      const enderecos = d.cobranca && Array.isArray(anterior?.enderecos) ? anterior.enderecos.map((e, i) => i === selecionado ? d.cobranca : e) : null;
      dados.cobrancaSnapshot = d.cobranca ? json({ ...d.cobranca, nome: "Cobrança", ...(enderecos ? { enderecos, selecionado } : {}) }) : Prisma.DbNull;
    }
    if (Object.hasOwn(d, "destinatario")) dados.destinatarioSnapshot = d.destinatario ? json(d.destinatario) : Prisma.DbNull;
    if (["RASCUNHO", "DECLINADO"].includes(pedido.status)) {
      const rascunho = validarEntradaPedido(pedido.rascunho);
      const campos = Object.fromEntries(Object.entries(d).filter(([campo]) => campo !== "motivo"));
      const cobranca = Object.hasOwn(d, "cobranca") ? { enderecosCobranca: d.cobranca && rascunho.enderecosCobranca ? rascunho.enderecosCobranca.map((e, i) => i === (rascunho.cobrancaSelecionada ?? 0) ? d.cobranca : e) : undefined, cobrancaSelecionada: d.cobranca && rascunho.enderecosCobranca ? rascunho.cobrancaSelecionada : undefined } : {};
      const atualizado = { ...rascunho, ...campos, ...(Object.hasOwn(d, "previsaoData") ? { prazo: dados.prazo } : {}), ...cobranca };
      dados.rascunho = json(validarEntradaPedido(atualizado));
    }
    const antes = json({ previsaoData: pedido.previsaoData, previsaoJanela: pedido.previsaoJanela, prazo: pedido.prazo, cobrancaSnapshot: pedido.cobrancaSnapshot, destinatarioSnapshot: pedido.destinatarioSnapshot });
    exigirAtualizado((await tx.pedidoVenda.updateMany({ where: { id, versao: versaoPedido }, data: { ...dados, versao: { increment: 1 } } })).count);
    const depois = await tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { previsaoData: true, previsaoJanela: true, prazo: true, cobrancaSnapshot: true, destinatarioSnapshot: true } });
    await evento(tx, id, contexto.tipo, chaveOperacao, resumo, autor, versaoPedido, versaoPedido + 1, antes, json(depois), d.motivo);
    return tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { id: true, numero: true, versao: true, status: true, statusOperacional: true } });
  }, { timeout: 30000 });
}
export type TratamentoCancelamento = { destino?: "DEVOLUCAO" | "CREDITO"; reter?: string; politica?: string; comunicacao?: string; dataEscolha?: string };

export async function cancelarPedido(pedidoId: unknown, versaoAtual: unknown, motivoValor: unknown, operacao: unknown, sessao: SessaoAtual, tratamento: TratamentoCancelamento = {}, responsavelValor?: unknown) {
  const id = identificador(pedidoId), versaoPedido = versao(versaoAtual), motivo = validarMotivoCancelamento(motivoValor);
  // Integrações técnicas existentes mantêm a assinatura; a action interativa exige o nome.
  const responsavelInformado = responsavelValor === undefined ? undefined : validarResponsavelCancelamento(responsavelValor);
  if (!tratamento || typeof tratamento !== "object" || Array.isArray(tratamento)) throw new ErroPedidoVenda("Tratamento do cancelamento inválido.");
  if (tratamento.destino && !["DEVOLUCAO", "CREDITO"].includes(tratamento.destino)) throw new ErroPedidoVenda("Destino do pagamento inválido.");
  const contextoResponsavel = responsavelInformado === undefined ? {} : { responsavelInformado };
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "CANCELADO", id, versaoPedido, motivo, tratamento, ...contextoResponsavel });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["cancelar"], id);
    await travarOperacao(tx, chaveOperacao);
    const existente = await repetida(tx, chaveOperacao, resumo); if (existente) return existente;
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { versao: true, status: true, statusOperacional: true } });
    if (pedido.versao !== versaoPedido || pedido.status !== "CONFIRMADO") exigirAtualizado(0);
    if (pedido.statusOperacional === "ENTREGUE") throw new ErroPedidoVenda("Pedido entregue não pode ser cancelado. Volte a etapa operacional antes de cancelar.");
    const titulos = (await bloquearTitulos(tx, id)).filter(t => t.tipo === "RECEITA");
    const capturas = await tx.pagamentoExternoPedido.findMany({ where: { pedidoId: id, status: "CAPTURADO" }, include: { titulo: { select: { pedidoParcelaRaiz: true } } } });
    const raizesCapturadas = new Set(capturas.flatMap(c => c.titulo.pedidoParcelaRaiz ? [c.titulo.pedidoParcelaRaiz] : []));
    const antes = await fotografia(tx, id);
    await liberarReservasCancelamento(tx, id);
    const atualizado = await tx.pedidoVenda.updateMany({ where: { id, versao: versaoPedido, status: "CONFIRMADO", statusOperacional: { not: "ENTREGUE" } }, data: { status: "CANCELADO", statusOperacional: "INTERROMPIDO", canceladoEm: new Date(), versao: { increment: 1 } } });
    exigirAtualizado(atualizado.count);
    if (titulos.length) {
      await tx.lancamentoFinanceiro.updateMany({ where: { pedidoVendaId: id, status: "PENDENTE", pedidoParcelaRaiz: { notIn: [...raizesCapturadas] } }, data: { status: "CANCELADO" } });
      await historicoFinanceiro(tx, id, chaveOperacao, resumo, "SALDO_CANCELADO", autor, { valor: titulos.filter(t => t.status === "PENDENTE" && !raizesCapturadas.has(t.pedidoParcelaRaiz ?? "")).reduce((s, t) => s.plus(t.valor), dinheiro("0")).toString(), pagamentosPreservados: titulos.filter(t => t.status === "BAIXADO" && !t.pedidoQuitadoCredito).reduce((s, t) => s.plus(t.valor), dinheiro("0")).plus(capturas.reduce((s, c) => s.plus(c.valorBruto), dinheiro("0"))).toString(), motivo });
    }
    const fontes = await origensElegiveis(tx, id);
    const disponivel = fontes.reduce((s, f) => s.plus(f.disponivel), dinheiro("0"));
    if (disponivel.gt(0)) {
      if (tratamento.destino && !["DEVOLUCAO", "CREDITO"].includes(tratamento.destino)) throw new ErroPedidoVenda("Destino do pagamento inválido.");
      if (tratamento.destino === "CREDITO") {
        await concederCreditoPedido(id, disponivel.toFixed(2), tratamento.dataEscolha, tratamento.comunicacao, hash({ cancelamento: chaveOperacao, efeito: "credito" }), sessao, tx);
      } else {
        const retido = tratamento.reter && tratamento.reter !== "0.00" && tratamento.reter !== "0" ? valorFinanceiro(tratamento.reter) : dinheiro("0");
        if (retido.gte(disponivel)) throw new ErroPedidoVenda("A retenção deve ser menor que o pagamento disponível.");
        await solicitarDevolucaoPedido(id, disponivel.minus(retido).toFixed(2), retido.toFixed(2), motivo, tratamento.politica ?? "", tratamento.comunicacao ?? "", hash({ cancelamento: chaveOperacao, efeito: "devolucao" }), sessao, tx);
      }
    }
    const resumoCredito = await resumoFinanceiro(tx, id);
    if (dinheiro(resumoCredito.creditoRestauravel).gt(0)) {
      // A chave interna pode conter números/hífens; separadores impedem que seja
      // confundida com dados de cartão pela proteção das referências externas.
      const referenciaCancelamento = `Cancelamento ${chaveOperacao.match(/.{1,8}/g)!.join("/")}`;
      await liberarCreditoAplicadoPedido(id, resumoCredito.creditoRestauravel, motivo, referenciaCancelamento, hash({ cancelamento: chaveOperacao, efeito: "restaurar" }), sessao, tx);
    }
    await abrirDestinosCancelamento(tx, id, chaveOperacao, autor, versaoPedido);
    const depois = await fotografia(tx, id);
    const depoisCancelamento = responsavelInformado === undefined ? depois : json({ ...(depois as Prisma.InputJsonObject), ...contextoResponsavel });
    await evento(tx, id, "CANCELADO", chaveOperacao, resumo, autor, versaoPedido, versaoPedido + 1, antes, depoisCancelamento, motivo);
    return tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { id: true, numero: true, versao: true, status: true } });
  }, { timeout: 30000 });
}

export async function registrarEntregaPedido(pedidoId: unknown, versaoAtual: unknown, operacao: unknown, sessao: SessaoAtual) {
  return executarOperacaoPedido(pedidoId, versaoAtual, { tipo: "ENTREGAR" }, operacao, sessao);
}

async function administradorRealPedidos(tx: Tx, usuarioId: string) {
  const usuario = await tx.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { perfilAcesso: { select: { sistema: true } } } });
  return usuario.perfilAcesso?.sistema === "ADMINISTRADOR";
}
export async function consultarMovimentacaoEstoqueGestorPedidos(sessao: SessaoAtual): Promise<ConfiguracaoMovimentacaoEstoqueGestor> {
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar"]);
    const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } });
    const escopo = (loja?.pedidosLiberacao as { locais?: unknown } | null)?.locais;
    const autorizados = Array.isArray(escopo) ? escopo.filter((id): id is string => typeof id === "string") : [];
    const locais = await tx.localEstoque.findMany({ where: { ativo: true, ...(autorizados.length ? { id: { in: autorizados } } : {}) }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
    return { ...politicaMovimentacaoEstoqueGestor(loja?.pedidosLiberacao), locais, podeAlterar: await administradorRealPedidos(tx, autor.userId) };
  });
}
export async function salvarMovimentacaoEstoqueGestorPedidos(movimentarEstoque: unknown, versaoAtual: unknown, operacao: unknown, sessao: SessaoAtual, localValor?: unknown) {
  if (typeof movimentarEstoque !== "boolean" || typeof versaoAtual !== "number" || !Number.isSafeInteger(versaoAtual) || versaoAtual < 0) throw new ErroPedidoVenda("Configuração ou versão inválida.");
  const localInformado = localValor === undefined ? undefined : localValor === null || localValor === "" ? null : identificador(localValor);
  const chaveOperacao = chave(operacao), resumo = hash({ movimentarEstoque, versao: versaoAtual, localId: localInformado === undefined ? { preservar: true } : localInformado });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar"]);
    if (!await administradorRealPedidos(tx, autor.userId)) throw new ErroPedidoVenda("Somente um administrador pode alterar a configuração de estoque do Gestor.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('pedidos-estoque-gestor'))`;
    const idEvento = `gestor-estoque:${chaveOperacao}`;
    const repetido = await tx.historicoCadastroVenda.findUnique({ where: { id: idEvento } });
    if (repetido) {
      const depois = repetido.depois as { hash: string; movimentarEstoque: boolean; versao: number; localMovimentarEstoqueId: string | null };
      if (repetido.usuarioId !== autor.userId || depois.hash !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados.");
      return { movimentarEstoque: depois.movimentarEstoque, versao: depois.versao, localMovimentarEstoqueId: depois.localMovimentarEstoqueId };
    }
    await tx.$queryRaw`SELECT id FROM "ConfiguracaoLoja" WHERE id = 'singleton' FOR UPDATE`;
    const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } });
    const antes = politicaMovimentacaoEstoqueGestor(loja?.pedidosLiberacao);
    if (antes.versao !== versaoAtual) throw new ErroPedidoVenda("A configuração de estoque foi alterada em outra tela. Reabra antes de salvar.");
    const salvo = loja?.pedidosLiberacao;
    if (salvo != null && (typeof salvo !== "object" || Array.isArray(salvo))) throw new ErroPedidoVenda("A configuração de Pedidos está inválida. Confira antes de alterar.");
    const localMovimentarEstoqueId = localInformado === undefined ? antes.localMovimentarEstoqueId : localInformado;
    if (movimentarEstoque) {
      if (!localMovimentarEstoqueId) throw new ErroPedidoVenda("Escolha um local de estoque para ligar a movimentação automática.");
      const local = await tx.localEstoque.findUnique({ where: { id: localMovimentarEstoqueId }, select: { ativo: true } });
      const escopo = (salvo as { locais?: unknown } | null)?.locais;
      if (!local?.ativo || (Array.isArray(escopo) && escopo.length > 0 && !escopo.includes(localMovimentarEstoqueId))) throw new ErroPedidoVenda("Escolha um local ativo autorizado para Pedidos.");
    }
    const configuracao = json({ ...(salvo ?? { versao: 1, ativa: false, locais: [] }), movimentarEstoque, localMovimentarEstoqueId, versaoMovimentarEstoque: versaoAtual + 1 });
    await tx.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { pedidosLiberacao: configuracao }, update: { pedidosLiberacao: configuracao } });
    const depois = { movimentarEstoque, versao: versaoAtual + 1, localMovimentarEstoqueId };
    await tx.historicoCadastroVenda.create({ data: { id: idEvento, entidade: "PEDIDOS_ESTOQUE_GESTOR", registroId: "singleton", usuarioId: autor.userId, usuarioNome: autor.nome, antes: json(antes), depois: json({ ...depois, hash: resumo }) } });
    return depois;
  });
}

export async function mudarStatusGestorPedido(pedidoId: unknown, versaoAtual: unknown, direcao: DirecaoStatusGestor, operacao: unknown, sessao: SessaoAtual) {
  if (!["avancar", "voltar"].includes(direcao)) throw new ErroPedidoVenda("Direção da etapa inválida.");
  return executarOperacaoPedidoInterna(pedidoId, versaoAtual, direcao === "avancar" ? { tipo: "AVANCAR", confirmarIntegralmente: true } : { tipo: "VOLTAR" }, operacao, sessao, true);
}

export async function executarOperacaoPedido(pedidoId: unknown, versaoAtual: unknown, comandoSolicitado: ComandoOperacao, operacao: unknown, sessao: SessaoAtual) {
  return executarOperacaoPedidoInterna(pedidoId, versaoAtual, comandoSolicitado, operacao, sessao, false);
}

/** A interface operacional usa a mesma política automática do quadro. O serviço
 * físico explícito continua separado e exige reservas/consumos comprovados. */
export async function executarOperacaoInterfacePedido(pedidoId: unknown, versaoAtual: unknown, comando: ComandoOperacao, operacao: unknown, sessao: SessaoAtual) {
  return executarOperacaoPedidoInterna(pedidoId, versaoAtual, comando, operacao, sessao, true);
}
// A origem é informada somente por wrappers do servidor; nunca vem do comando do cliente.
async function executarOperacaoPedidoInterna(pedidoId: unknown, versaoAtual: unknown, comandoSolicitado: ComandoOperacao, operacao: unknown, sessao: SessaoAtual, origemGestor: boolean) {
  const id = identificador(pedidoId), versaoPedido = versao(versaoAtual), chaveOperacao = chave(operacao);
  if (!comandoSolicitado || !["INICIAR", "PREPARAR", "EXPEDIR", "PRONTO", "SAIR", "ENTREGAR", "OCORRENCIA", "RESOLVER", "REAGENDAR", "AVANCAR", "VOLTAR", "NOVA_TENTATIVA"].includes(comandoSolicitado.tipo)) throw new ErroPedidoVenda("Ação operacional inválida.");
  if (comandoSolicitado.confirmarIntegralmente !== undefined && (!["AVANCAR", "NOVA_TENTATIVA"].includes(comandoSolicitado.tipo) || typeof comandoSolicitado.confirmarIntegralmente !== "boolean")) throw new ErroPedidoVenda("Confirmação integral inválida.");
  if (comandoSolicitado.tipo === "REAGENDAR") {
    if (Object.entries(comandoSolicitado).some(([campo, valor]) => valor !== undefined && !["tipo", "data", "janela", "motivo"].includes(campo))) throw new ErroPedidoVenda("Ação de agenda inválida.");
    return editarInformacoesPedidoInterna(id, versaoPedido, validarInformacoesPedido({ previsaoData: comandoSolicitado.data, previsaoJanela: comandoSolicitado.janela, motivo: comandoSolicitado.motivo }), chaveOperacao, sessao, { tipo: "OPERACAO_REAGENDAR" });
  }
  const resumo = hash({ tipo: "OPERACAO", id, versaoPedido, comando: comandoSolicitado, ...(origemGestor ? { origem: "GESTOR" } : {}) });
  return prisma.$transaction(async tx => {
    let autor = await conferirAcesso(tx, sessao, comandoSolicitado.natureza ? ["revisar"] : comandoSolicitado.tipo === "VOLTAR" ? ["consultar", "revisar"] : [comandoSolicitado.tipo === "AVANCAR" ? "consultar" : ["INICIAR", "PREPARAR", "PRONTO", "OCORRENCIA"].includes(comandoSolicitado.tipo) ? "operar" : "revisar"], id);
    if (comandoSolicitado.natureza === "FALHA_ENTREGA") await conferirAcesso(tx, sessao, ["revisar"], id);
    await travarOperacao(tx, chaveOperacao);
    const existente = await repetida(tx, chaveOperacao, resumo);
    if (existente) {
      if (comandoSolicitado.tipo === "AVANCAR") {
        const eventoAnterior = await tx.historicoPedidoVenda.findUniqueOrThrow({ where: { chaveOperacao }, select: { depois: true } });
        const anterior = (eventoAnterior.depois as { comando?: ComandoOperacao }).comando?.tipo;
        if (!anterior || !["INICIAR", "PRONTO", "SAIR", "ENTREGAR"].includes(anterior)) throw new ErroPedidoVenda("Não foi possível conferir a etapa anterior. Reabra o pedido.");
        await conferirAcesso(tx, sessao, [["INICIAR", "PRONTO"].includes(anterior) ? "operar" : "revisar"], id);
      }
      return tx.pedidoVenda.findUniqueOrThrow({ where: { id: existente.id }, select: { id: true, numero: true, versao: true, status: true, statusOperacional: true } });
    }
    const lojaGestor = origemGestor ? await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } }) : null;
    const politicaEstoque = politicaMovimentacaoEstoqueGestor(lojaGestor?.pedidosLiberacao);
    const controleEtapas = origemGestor && !politicaEstoque.movimentarEstoque;
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id }, include: { itens: { where: { vigente: true } }, historico: { where: { tipo: { startsWith: "OPERACAO_" } } } } });
    if (pedido.versao !== versaoPedido || pedido.status === "RASCUNHO") throw new ErroPedidoVenda("O pedido mudou ou ainda não foi confirmado. Reabra para conferir.");
    const novaTentativa = comandoSolicitado.tipo === "NOVA_TENTATIVA";
    const avanco = novaTentativa ? "SAIR" : comandoSolicitado.tipo === "AVANCAR" ? comandoAvancoGestor(pedido.statusOperacional, pedido.atendimento) : null;
    if (comandoSolicitado.tipo === "AVANCAR" && !avanco) throw new ErroPedidoVenda("Não há próxima etapa disponível para este pedido.");
    const comando: ComandoOperacao = avanco ? { ...(novaTentativa ? comandoSolicitado : {}), tipo: avanco } : comandoSolicitado;
    if (avanco) autor = await conferirAcesso(tx, sessao, [["INICIAR", "PRONTO"].includes(avanco) ? "operar" : "revisar"], id);
    const tipo = comando.tipo;
    const retiradaDireta = tipo === "ENTREGAR" && pedido.atendimento === "RETIRADA" && pedido.statusOperacional === "PRONTO";
    if (tipo === "SAIR" && pedido.atendimento === "RETIRADA") throw new ErroPedidoVenda("Este pedido é de retirada. Registre a retirada sem saída para transporte.");
    const ocorrencia = tipo === "OCORRENCIA" || tipo === "RESOLVER";
    // A primeira entrega conserva o encerramento comercial/físico. Uma correção
    // de etapa reabre transições e permite cancelamento, sem liberar revisão ou estoque.
    const correcaoEtapa = ["VOLTAR", "PRONTO", "SAIR", "ENTREGAR"].includes(tipo);
    if (!ocorrencia && (pedido.status !== "CONFIRMADO" || (pedido.entregueEm && !correcaoEtapa))) throw new ErroPedidoVenda("Operação encerrada; registre uma ocorrência.");
    const motivo = typeof comando.motivo === "string" ? comando.motivo.trim() : "";
    if ((ocorrencia || novaTentativa) && (!motivo || motivo.length > 1000)) throw new ErroPedidoVenda("Informe motivo de até 1000 caracteres.");
    const fatos = pedido.historico.map(h => ({ ...h, comando: (h.depois as { comando?: ComandoOperacao }).comando }));
    if (comando.natureza !== undefined && (tipo !== "OCORRENCIA" || !["DEVOLUCAO", "FALHA_ENTREGA"].includes(comando.natureza))) throw new ErroPedidoVenda("Natureza da ocorrência inválida.");
    const destinoFisico = comando.natureza === "DEVOLUCAO" ? await prepararDevolucaoFisica(tx, id, comando) : undefined;
    let resolucaoDestino: Awaited<ReturnType<typeof validarResolucaoDestino>> | undefined;
    const somar = (itemId: string, acao: string) => new Prisma.Decimal(quantidadeExecucao(fatos, itemId, acao).toString());
    let estado = pedido.statusOperacional;
    const falhaEntrega = comando.natureza === "FALHA_ENTREGA";
    const falhas = fatos.filter(f => f.comando?.natureza === "FALHA_ENTREGA" && !fatos.some(r => r.comando?.tipo === "RESOLVER" && r.comando.ocorrenciaId === f.id));
    if (falhaEntrega) {
      await conferirAcesso(tx, sessao, ["revisar"], id);
      if (pedido.status !== "CONFIRMADO" || pedido.entregueEm || pedido.atendimento !== "ENTREGA" || estado !== "EM_ENTREGA" || falhas.length) throw new ErroPedidoVenda("Falha de entrega exige uma tentativa em rota ainda não concluída.");
      estado = "PRONTO";
    }
    if (novaTentativa) {
      if (pedido.entregueEm || pedido.atendimento !== "ENTREGA" || !falhas.some(f => f.id === comando.ocorrenciaId)) throw new ErroPedidoVenda("Selecione a falha pendente de uma entrega ainda não concluída.");
      if (comando.conferenciaMaterial !== true) throw new ErroPedidoVenda("Confirme a integridade e a disponibilidade de todos os produtos desta nova tentativa.");
    }
    const ajusteExecucao = destinoFisico && !pedido.entregueEm && pedido.status === "CONFIRMADO" ? ajusteDevolucaoExecucao(fatos, destinoFisico.itemId, destinoFisico.quantidade) : undefined;
    if (ajusteExecucao) estado = "EM_PREPARO";

    const exigirEstado = (esperado: string) => { if (estado !== esperado) throw new ErroPedidoVenda("Ação incompatível com a etapa atual. Reabra o pedido."); };
    if (tipo === "VOLTAR") {
      const anterior = estadoAnteriorGestor(estado, pedido.atendimento);
      if (!anterior) throw new ErroPedidoVenda("Não há etapa anterior disponível para este pedido.");
      estado = anterior;
    }
    if (tipo === "INICIAR") {
      exigirEstado("PENDENTE");
      if (!controleEtapas && pedido.modoFinanceiro === "EXTERNO" && pedido.previsaoData && pedido.previsaoData.toISOString().slice(0, 10) > somarDias(diaNoFuso(new Date(), pedido.fusoHorario), 2)) throw new ErroPedidoVenda("O preparo pode começar no máximo dois dias antes da entrega.");
      estado = "EM_PREPARO";
    }
    const apontamentos: { tipo: "PREPARAR" | "EXPEDIR"; itemId: string; quantidade: string }[] = [];
    // O Gestor desligado confirma somente as quantidades lógicas; o fluxo físico permanece estrito.
    // Primeiro validamos todo o lote; nenhum evento ou efeito físico é escrito aqui.
    const validarApontamento = async (acao: "PREPARAR" | "EXPEDIR", itemId: string | undefined, quantidade: string | undefined) => {
      exigirEstado(acao === "PREPARAR" ? "EM_PREPARO" : "PRONTO");
      if (pedido.entregueEm) throw new ErroPedidoVenda("Operação encerrada; registre uma ocorrência.");
      const item = pedido.itens.find(i => i.id === itemId);
      if (!item || typeof quantidade !== "string" || !/^\d{1,12}(\.\d{1,6})?$/.test(quantidade)) throw new ErroPedidoVenda("Item ou quantidade inválidos.");
      const qtd = quantidadeComercial(quantidade, item.unidadeSnapshot);
      if (somar(item.id, acao).plus(qtd).greaterThan(item.quantidade)) throw new ErroPedidoVenda("Quantidade excede o restante do item.");
      if (origemGestor) return;
      const reservas = await tx.reservaPedido.findMany({ where: { itemId: item.id } });
      const configuracao = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } });
      const fisicoObrigatorio = pedido.modoFinanceiro === "EXTERNO" || Boolean((configuracao?.pedidosLiberacao as { locais?: string[] } | null)?.locais?.length);
      if (fisicoObrigatorio && !reservas.length) throw new ErroPedidoVenda("Item sem reserva/execução física. Complete a composição e libere a quantidade antes de concluir.");
      if (reservas.length && !(acao === "PREPARAR" && (item.produtoSnapshot as { tipo?: string }).tipo === "REVENDA")) {
        const necessidade = new Map<string, Prisma.Decimal>();
        for (const r of reservas) necessidade.set(r.insumoId, (necessidade.get(r.insumoId) ?? dinheiro("0")).plus(r.consumida.minus(Prisma.Decimal.max(r.retornada.plus(r.perdida), materialDestinado(fatos, r.id).toString()))));
        const alvo = somar(item.id, acao).plus(qtd);
        for (const r of reservas) if ((necessidade.get(r.insumoId) ?? dinheiro("0")).lt(r.quantidade.div(r.quantidadeItem).mul(alvo))) throw new ErroPedidoVenda("Registre o consumo/saída física correspondente antes de apontar a quantidade concluída.");
      }
      if (somar(item.id, acao).plus(qtd).greaterThan(item.quantidade)) throw new ErroPedidoVenda("Quantidade excede o restante do item.");
    };
    if (tipo === "PREPARAR" || tipo === "EXPEDIR") await validarApontamento(tipo, comando.itemId, comando.quantidade);
    if (avanco && comandoSolicitado.confirmarIntegralmente && (tipo === "PRONTO" || tipo === "SAIR" || retiradaDireta)) {
      exigirEstado(tipo === "PRONTO" ? "EM_PREPARO" : "PRONTO");
      const acao = tipo === "PRONTO" ? "PREPARAR" : "EXPEDIR";
      for (const item of [...pedido.itens].sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))) {
        const restante = item.quantidade.minus(somar(item.id, acao));
        if (restante.isNegative()) throw new ErroPedidoVenda("Quantidades do pedido inconsistentes. Confira o histórico antes de avançar.");
        if (restante.isZero()) continue;
        await validarApontamento(acao, item.id, restante.toString());
        apontamentos.push({ tipo: acao, itemId: item.id, quantidade: restante.toString() });
      }
    }
    if (tipo === "PRONTO" || tipo === "SAIR" || retiradaDireta) {
      exigirEstado(tipo === "PRONTO" ? "EM_PREPARO" : "PRONTO");
      if (!pedido.itens.length || pedido.itens.some(i => !somar(i.id, tipo === "PRONTO" ? "PREPARAR" : "EXPEDIR").plus(apontamentos.find(a => a.itemId === i.id)?.quantidade ?? "0").equals(i.quantidade))) throw new ErroPedidoVenda("Registre todas as quantidades antes de avançar.");
      // Fatos lógicos do Gestor desligado não comprovam a execução física manual.
      if (!origemGestor) {
        const acao = tipo === "PRONTO" ? "PREPARAR" : "EXPEDIR";
        for (const item of pedido.itens) {
          if (!fatos.some(f => f.comando?.tipo === acao && f.comando.itemId === item.id && (f.depois as { origem?: string }).origem === "GESTOR_CONFIRMACAO_INTEGRAL")) continue;
          const reservas = await tx.reservaPedido.findMany({ where: { itemId: item.id } });
          const configuracao = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } });
          const obrigatorio = pedido.modoFinanceiro === "EXTERNO" || Boolean((configuracao?.pedidosLiberacao as { locais?: string[] } | null)?.locais?.length);
          if (obrigatorio && !reservas.length) throw new ErroPedidoVenda("Item sem reserva/execução física. Complete a composição antes de executar a operação manual.");
          if (!(acao === "PREPARAR" && (item.produtoSnapshot as { tipo?: string }).tipo === "REVENDA")) {
            const consumida = new Map<string, Prisma.Decimal>();
            for (const r of reservas) consumida.set(r.insumoId, (consumida.get(r.insumoId) ?? dinheiro("0")).plus(r.consumida.minus(Prisma.Decimal.max(r.retornada.plus(r.perdida), materialDestinado(fatos, r.id).toString()))));
            for (const r of reservas) if ((consumida.get(r.insumoId) ?? dinheiro("0")).lt(r.quantidade.div(r.quantidadeItem).mul(item.quantidade))) throw new ErroPedidoVenda("Registre o consumo/saída física correspondente antes da operação manual.");
          }
        }
      }
      estado = tipo === "PRONTO" || retiradaDireta ? "PRONTO" : "EM_ENTREGA";
    }
    if (["SAIR", "ENTREGAR"].includes(tipo) && fatos.some(f => f.comando?.tipo === "OCORRENCIA" && !(novaTentativa && f.id === comando.ocorrenciaId) && !fatos.some(r => r.comando?.tipo === "RESOLVER" && r.comando.ocorrenciaId === f.id))) throw new ErroPedidoVenda("Resolva as ocorrências pendentes antes de concluir a operação de entrega.");
    if (tipo === "ENTREGAR") { exigirEstado(retiradaDireta ? "PRONTO" : "EM_ENTREGA"); estado = "ENTREGUE"; }
    if (tipo === "RESOLVER") {
      if (!fatos.some(f => f.id === comando.ocorrenciaId && f.comando?.tipo === "OCORRENCIA") || fatos.some(f => f.comando?.tipo === "RESOLVER" && f.comando.ocorrenciaId === comando.ocorrenciaId)) throw new ErroPedidoVenda("Ocorrência inexistente ou já resolvida.");
      const destino = (fatos.find(f => f.id === comando.ocorrenciaId)!.depois as { destinoFisico?: DestinoFisicoPedido }).destinoFisico;
      if (destino) resolucaoDestino = await validarResolucaoDestino(tx, destino, comando);
      if (falhas.some(f => f.id === comando.ocorrenciaId) && (pedido.status !== "CANCELADO" || fatos.some(f => (f.depois as { destinoFisico?: unknown }).destinoFisico && !fatos.some(r => r.comando?.tipo === "RESOLVER" && r.comando.ocorrenciaId === f.id)))) throw new ErroPedidoVenda("A falha exige nova tentativa ou cancelamento com todos os destinos físicos resolvidos.");
    }
    const parciais = tipo === "PREPARAR" || tipo === "EXPEDIR" ? [{ tipo, itemId: comando.itemId!, quantidade: comando.quantidade! }] as typeof apontamentos : [];
    if (origemGestor && politicaEstoque.movimentarEstoque && (apontamentos.length || parciais.length)) {
      await executarAutomaticoGestorNaTransacao(tx, pedido, [...apontamentos, ...parciais], fatos, politicaEstoque, autor, chaveOperacao);
    }
    const antes = tipo === "INICIAR" && !controleEtapas ? json({ pedido: await fotografia(tx, id), cobertura: await coberturaComposicaoPedido(tx, pedido.itens) }) : json({ statusOperacional: pedido.statusOperacional, entregueEm: pedido.entregueEm, previsaoData: pedido.previsaoData, previsaoJanela: pedido.previsaoJanela });
    const entregueEm = tipo === "ENTREGAR" ? pedido.entregueEm ?? new Date() : pedido.entregueEm;
    const atualizado = await tx.pedidoVenda.updateMany({ where: { id, versao: versaoPedido }, data: { statusOperacional: estado, ...(tipo === "ENTREGAR" ? { entregueEm } : {}), versao: { increment: 1 } } });
    exigirAtualizado(atualizado.count);
    if (novaTentativa) {
      const chaveResolucao = hash({ chavePai: chaveOperacao, resolucaoFalha: comando.ocorrenciaId });
      await evento(tx, id, "OPERACAO_RESOLVER", chaveResolucao, chaveResolucao, autor, versaoPedido, versaoPedido + 1, null, json({ comando: { tipo: "RESOLVER", ocorrenciaId: comando.ocorrenciaId, motivo }, novaTentativa: true, produtosConferidos: pedido.itens.map(i => ({ itemId: i.id, quantidade: i.quantidade.toString() })) }), motivo);
    }
    for (const apontamento of apontamentos) {
      const chaveItem = hash({ chavePai: chaveOperacao, pedidoId: id, tipo: apontamento.tipo, itemId: apontamento.itemId });
      const totalAnterior = somar(apontamento.itemId, apontamento.tipo);
      await evento(tx, id, `OPERACAO_${apontamento.tipo}`, chaveItem, hash({ tipo: "APONTAMENTO_INTEGRAL", id, versaoPedido, chavePai: chaveOperacao, comando: apontamento }), autor, versaoPedido, versaoPedido + 1,
        json({ statusOperacional: pedido.statusOperacional, quantidadeApontada: totalAnterior.toString() }),
        json({ comando: apontamento, chavePai: chaveOperacao, origem: origemGestor ? "GESTOR_CONFIRMACAO_INTEGRAL" : "APONTAMENTO_INTEGRAL", validacaoFisica: !controleEtapas && (!origemGestor || ((pedido.itens.find(i => i.id === apontamento.itemId)!.produtoSnapshot as { tipo?: string }).tipo === "REVENDA") === (apontamento.tipo === "EXPEDIR")), ...(origemGestor ? { politicaEstoque } : {}), quantidadeApontada: totalAnterior.plus(apontamento.quantidade).toString() }));
    }
    await evento(tx, id, `OPERACAO_${tipo}`, chaveOperacao, resumo, autor, versaoPedido, versaoPedido + 1, antes, json({ comando, destinoFisico, resolucaoDestino, ajusteExecucao, statusOperacional: estado, entregueEm, ...(origemGestor ? { origem: "GESTOR", politicaEstoque, ...(parciais.length ? { validacaoFisica: !controleEtapas } : {}) } : {}), ...(avanco ? { solicitacao: comandoSolicitado, ...(comandoSolicitado.confirmarIntegralmente ? { apontamentosIntegrais: apontamentos } : {}) } : {}) }), motivo || (tipo === "VOLTAR" ? "Retorno sequencial solicitado no gestor de pedidos." : undefined));
    return tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { id: true, numero: true, versao: true, status: true, statusOperacional: true } });
  }, { timeout: 30000 });
}

export async function registrarRecebimentoPedido(pedidoValor: unknown, tituloValor: unknown, valor: unknown, contaValor: unknown, dataValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), tituloId = identificador(tituloValor), contaId = identificador(contaValor);
  const quantia = valorFinanceiro(valor), data = dataFinanceira(dataValor, "a data do recebimento");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "RECEBIMENTO", id, tituloId, valor: quantia.toFixed(2), contaId, data: data.toISOString() });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "receber"], id);
    await travarOperacao(tx, chaveOperacao);
    const anterior = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao }, select: { pedidoId: true, hashOperacao: true } });
    if (anterior) {
      if (anterior.pedidoId !== id || anterior.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados.");
      return resumoFinanceiro(tx, id);
    }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id }, select: { status: true } });
    if (pedido?.status !== "CONFIRMADO") throw new ErroPedidoVenda("Somente pedido confirmado aceita recebimento.");
    const conta = await tx.contaBancaria.findUnique({ where: { id: contaId }, select: { ativo: true } });
    if (!conta?.ativo) throw new ErroPedidoVenda("Selecione uma conta ativa.");
    await bloquearTitulos(tx, id);
    const titulo = await tx.lancamentoFinanceiro.findUnique({ where: { id: tituloId } });
    if (!titulo || titulo.pedidoVendaId !== id || titulo.status !== "PENDENTE" || !titulo.pedidoEfeitoChave || !titulo.pedidoParcelaRaiz || !titulo.pedidoValorOriginal || !titulo.formaPagamentoVendaId || !titulo.pedidoFormaSnapshot) throw new ErroPedidoVenda("Título indisponível. Atualize o pedido.");
    const forma = await tx.formaPagamentoVenda.findUnique({ where: { id: titulo.formaPagamentoVendaId }, select: { tipo: true } });
    if (!forma || !meiosDiretos.has(forma.tipo) || await tx.pagamentoExternoPedido.count({ where: { tituloId, status: "CAPTURADO" } })) throw new ErroPedidoVenda("Esta cobrança requer confirmação externa; não pode ser baixada como recebimento direto.");
    if (quantia.greaterThan(titulo.valor)) throw new ErroPedidoVenda("O recebimento excede o saldo deste título.");
    const saldo = titulo.valor.minus(quantia);
    if (saldo.greaterThan(0)) {
      await tx.lancamentoFinanceiro.update({ where: { id: titulo.id }, data: { valor: quantia } });
      await tx.lancamentoFinanceiro.create({ data: {
        tipo: "RECEITA", descricao: titulo.descricao, valor: saldo, categoriaId: titulo.categoriaId,
        dataCompetencia: titulo.dataCompetencia, dataVencimento: titulo.dataVencimento,
        contraparteNome: titulo.contraparteNome, criadoPorId: autor.userId, pedidoVendaId: id,
        pedidoEfeitoChave: `resto:${chaveOperacao}`, pedidoParcelaRaiz: titulo.pedidoParcelaRaiz,
        pedidoValorOriginal: titulo.pedidoValorOriginal, formaPagamentoVendaId: titulo.formaPagamentoVendaId,
        pedidoFormaSnapshot: titulo.pedidoFormaSnapshot as Prisma.InputJsonValue,
      } });
    }
    await baixarLancamento({ lancamentoId: titulo.id, contaBancariaId: contaId, dataPagamento: data, tx, origemPedido: true });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "RECEBIMENTO", autor, { tituloId, parcelaRaiz: titulo.pedidoParcelaRaiz, valorOriginal: titulo.pedidoValorOriginal.toString(), valorAnterior: titulo.valor.toString(), recebido: quantia.toString(), saldo: saldo.toString(), contaId, data: data.toISOString() });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

export async function corrigirRecebimentoPedido(pedidoValor: unknown, tituloValor: unknown, revisaoValor: unknown, motivoValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), tituloId = identificador(tituloValor);
  const motivo = typeof motivoValor === "string" ? motivoValor.trim() : "";
  if (!motivo || motivo.length > 1000 || typeof revisaoValor !== "string" || revisaoValor.length > 40) throw new ErroPedidoVenda("Informe a justificativa e reabra o recebimento atual.");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "RECEBIMENTO_CORRIGIDO", id, tituloId, revisaoValor, motivo });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "estornar", "condicao"], id);
    await travarOperacao(tx, chaveOperacao);
    const anterior = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao } });
    if (anterior) {
      if (anterior.pedidoId !== id || anterior.hashOperacao !== resumo || anterior.usuarioId !== autor.userId) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados.");
      return resumoFinanceiro(tx, id);
    }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id } });
    const titulos = await bloquearTitulos(tx, id), titulo = titulos.find(t => t.id === tituloId);
    if (!titulo || titulo.tipo !== "RECEITA" || titulo.status !== "BAIXADO" || titulo.pedidoQuitadoCredito || titulo.updatedAt.toISOString() !== revisaoValor) throw new ErroPedidoVenda("Recebimento alterado ou indisponível. Reabra o pedido.");
    if (!["PIX", "TRANSFERENCIA", "DINHEIRO"].includes((titulo.pedidoFormaSnapshot as { tipo?: string } | null)?.tipo ?? "")) throw new ErroPedidoVenda("Esta correção exige um recebimento direto; cobranças externas conservam seus fatos próprios.");
    if (await tx.vinculoExtrato.count({ where: { lancamentoId: tituloId } })) throw new ErroPedidoVenda("Desfaça a conciliação no Financeiro antes de corrigir o recebimento.");
    if (await tx.alocacaoTratamentoPedido.count({ where: { origemTituloId: tituloId, tratamento: { status: { in: ["SOLICITADA", "PROCESSANDO", "CONCLUIDA"] } } } })) throw new ErroPedidoVenda("Recebimento usado em devolução ou crédito. Resolva o tratamento antes de corrigir sua origem.");
    const movimento = await tx.movimentacaoBancaria.findUnique({ where: { lancamentoId: tituloId } });
    if (!movimento || !movimento.valor.eq(titulo.valor)) throw new ErroPedidoVenda("Entrada bancária inconsistente; nenhuma correção foi aplicada.");
    // Correção de registro, conforme contrato da baixa existente. A fotografia
    // integral permanece na auditoria; não registrar saída financeira fictícia.
    await tx.movimentacaoBancaria.delete({ where: { id: movimento.id } });
    await tx.lancamentoFinanceiro.update({ where: { id: tituloId }, data: { status: pedido.status === "CANCELADO" ? "CANCELADO" : "PENDENTE", dataPagamento: null, contaBancariaId: null } });
    const ajuste = pedido.versaoFinanceiro === 1 && pedido.status === "CONFIRMADO" ? await revisarObrigacoesPedido(tx, id, pedido.total, (await bloquearTitulos(tx, id)).filter(t => t.tipo === "RECEITA"), chaveOperacao, autor.userId) : null;
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "RECEBIMENTO_CORRIGIDO", autor, { tituloId, motivo, tituloAnterior: titulo, movimentoAnterior: movimento, ajuste, devolucaoDinheiro: false });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

export async function ajustarVencimentoPedido(pedidoValor: unknown, tituloValor: unknown, vencimentoValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), tituloId = identificador(tituloValor), vencimento = dataFinanceira(vencimentoValor, "o novo vencimento");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "VENCIMENTO", id, tituloId, vencimento: vencimento.toISOString() });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "revisar", "condicao"], id);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    await travarOperacao(tx, chaveOperacao);
    const anterior = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao }, select: { pedidoId: true, hashOperacao: true } });
    if (anterior) {
      if (anterior.pedidoId !== id || anterior.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados.");
      return resumoFinanceiro(tx, id);
    }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id }, select: { status: true, clienteId: true, previsaoData: true, entregueEm: true, confirmadoEm: true, fusoHorario: true } });
    if (pedido?.status !== "CONFIRMADO") throw new ErroPedidoVenda("Somente pedido confirmado aceita ajuste de vencimento.");
    await bloquearTitulos(tx, id);
    const titulo = await tx.lancamentoFinanceiro.findUnique({ where: { id: tituloId } });
    if (!titulo || titulo.pedidoVendaId !== id || titulo.status !== "PENDENTE") throw new ErroPedidoVenda("Somente título em aberto pode ter vencimento ajustado.");
    if (pedido.clienteId && (titulo.pedidoFormaSnapshot as Record<string, unknown> | null)?.tipo === "BOLETO") exigirVencimentoBoletoCliente(await regrasClientePedido(tx, pedido.clienteId), pedido, vencimento);
    await tx.lancamentoFinanceiro.update({ where: { id: tituloId }, data: { dataVencimento: vencimento } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "VENCIMENTO_AJUSTADO", autor, { tituloId, anterior: titulo.dataVencimento.toISOString(), novo: vencimento.toISOString() });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

function referenciaExterna(valor: unknown, nome: string) {
  if (typeof valor !== "string" || !valor.trim() || valor.length > 180 || /(?:\d[ -]?){13,19}/.test(valor)) throw new ErroPedidoVenda(`${nome} inválida ou contém dados de cartão.`);
  return valor.trim();
}

export async function registrarCapturaCartaoPedido(pedidoValor: unknown, tituloValor: unknown, referenciaValor: unknown, evidenciaValor: unknown, dataValor: unknown, taxaValor: unknown, previsaoValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), tituloId = identificador(tituloValor), referencia = referenciaExterna(referenciaValor, "Referência da transação"), evidencia = referenciaExterna(evidenciaValor, "Evidência da captura");
  const data = dataFinanceira(dataValor, "a data da captura");
  const taxa = taxaValor === null || taxaValor === undefined || taxaValor === "" ? null : valorFinanceiro(taxaValor);
  const previsaoInformada = previsaoValor ? dataFinanceira(previsaoValor, "a previsão do repasse") : null;
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "CAPTURA_CARTAO", id, tituloId, referencia, evidencia, data: data.toISOString(), taxa: taxa?.toFixed(2) ?? null, previsao: previsaoInformada?.toISOString() ?? null });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "receber"], id);
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.pagamentoExternoPedido.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.pedidoId !== id || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return resumoFinanceiro(tx, id); }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id }, select: { status: true } });
    await bloquearTitulos(tx, id);
    const titulo = await tx.lancamentoFinanceiro.findUnique({ where: { id: tituloId }, include: { formaPagamentoVenda: true } });
    if (pedido?.status !== "CONFIRMADO" || titulo?.pedidoVendaId !== id || titulo.status !== "PENDENTE" || !titulo.formaPagamentoVenda || !["CARTAO_CREDITO", "CARTAO_DEBITO"].includes(titulo.formaPagamentoVenda.tipo)) throw new ErroPedidoVenda("Cobrança de cartão indisponível.");
    if (await tx.pagamentoExternoPedido.count({ where: { tituloId, status: "CAPTURADO" } })) throw new ErroPedidoVenda("Esta cobrança já possui captura confirmada.");
    if (taxa && taxa.greaterThan(titulo.valor)) throw new ErroPedidoVenda("Taxa excede o valor capturado.");
    const parcelasCliente = Number((titulo.pedidoFormaSnapshot as Record<string, unknown> | null)?.parcelasCliente ?? 1);
    const snapshot = titulo.pedidoFormaSnapshot as (PrazoPagamentoPedido & { dataCompra?: string }) | null;
    const prevista = !previsaoInformada && snapshot?.dataCompra ? vencimentoPrazoPedido(snapshot, snapshot.dataCompra, data.toISOString().slice(0, 10)) : null;
    const previsao = previsaoInformada ?? (prevista ? dataFinanceira(prevista, "a previsão do repasse") : null);
    await tx.pagamentoExternoPedido.create({ data: { pedidoId: id, tituloId, tipo: titulo.formaPagamentoVenda.tipo, status: "CAPTURADO", valorBruto: titulo.valor, parcelasCliente, referenciaExterna: referencia, confirmadoEm: data, taxa, valorLiquido: taxa ? titulo.valor.minus(taxa) : null, previsaoRepasse: previsao, evidencia, criadoPorId: autor.userId, chaveOperacao, hashOperacao: resumo } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "CARTAO_CAPTURADO", autor, { tituloId, referencia, valorBruto: titulo.valor.toString(), parcelasCliente, taxa: taxa?.toString() ?? null, previsaoRepasse: previsao?.toISOString() ?? null, evidencia });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

export async function registrarEmissaoBoletoPedido(pedidoValor: unknown, tituloValor: unknown, referenciaValor: unknown, documentoValor: unknown, vencimentoValor: unknown, evidenciaValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), tituloId = identificador(tituloValor), referencia = referenciaExterna(referenciaValor, "Referência do emissor"), evidencia = referenciaExterna(evidenciaValor, "Evidência de emissão");
  const documento = documentoValor ? referenciaExterna(documentoValor, "Documento do emissor") : null;
  const vencimento = dataFinanceira(vencimentoValor, "o vencimento do boleto emitido");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "BOLETO_EMITIDO", id, tituloId, referencia, documento, vencimento: vencimento.toISOString(), evidencia });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "condicao"], id);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.pagamentoExternoPedido.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.pedidoId !== id || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return resumoFinanceiro(tx, id); }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id }, select: { status: true, clienteId: true, previsaoData: true, entregueEm: true, confirmadoEm: true, fusoHorario: true } });
    await bloquearTitulos(tx, id);
    const titulo = await tx.lancamentoFinanceiro.findUnique({ where: { id: tituloId }, include: { formaPagamentoVenda: true } });
    if (pedido?.status !== "CONFIRMADO" || titulo?.pedidoVendaId !== id || titulo.status !== "PENDENTE" || titulo.formaPagamentoVenda?.tipo !== "BOLETO") throw new ErroPedidoVenda("Cobrança de boleto indisponível.");
    if (pedido.clienteId) exigirVencimentoBoletoCliente(await regrasClientePedido(tx, pedido.clienteId), pedido, vencimento);
    if (await tx.pagamentoExternoPedido.count({ where: { tituloId, status: { in: ["EMITIDO", "PAGO"] } } })) throw new ErroPedidoVenda("Boleto já emitido para este título.");
    await tx.pagamentoExternoPedido.create({ data: { pedidoId: id, tituloId, tipo: "BOLETO", status: "EMITIDO", valorBruto: titulo.valor, referenciaExterna: referencia, documentoExterno: documento, vencimentoExterno: vencimento, evidencia, criadoPorId: autor.userId, chaveOperacao, hashOperacao: resumo } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "BOLETO_EMITIDO", autor, { tituloId, referencia, documento, vencimentoExterno: vencimento.toISOString(), evidencia });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

export async function registrarCancelamentoBoletoPedido(pedidoValor: unknown, cobrancaValor: unknown, evidenciaValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), cobrancaId = identificador(cobrancaValor), evidencia = referenciaExterna(evidenciaValor, "Evidência de cancelamento no emissor");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "BOLETO_CANCELADO_EXTERNAMENTE", id, cobrancaId, evidencia });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "condicao"], id); await travarOperacao(tx, chaveOperacao);
    const anterior = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao } });
    if (anterior) { if (anterior.pedidoId !== id || anterior.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return resumoFinanceiro(tx, id); }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id } });
    const titulos = await bloquearTitulos(tx, id), cobranca = await tx.pagamentoExternoPedido.findUnique({ where: { id: cobrancaId } });
    if (!cobranca || cobranca.pedidoId !== id || cobranca.tipo !== "BOLETO" || cobranca.status !== "EMITIDO") throw new ErroPedidoVenda("Boleto indisponível ou pagamento já informado.");
    await tx.pagamentoExternoPedido.update({ where: { id: cobrancaId }, data: { status: "CANCELADO_EXTERNAMENTE" } });
    const ajuste = pedido.status === "CONFIRMADO" && pedido.versaoFinanceiro === 1 ? await revisarObrigacoesPedido(tx, id, pedido.total, titulos.filter(t => t.tipo === "RECEITA"), chaveOperacao, autor.userId) : null;
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "BOLETO_CANCELADO_EXTERNAMENTE", autor, { cobrancaId, evidencia, cobrancaAnterior: cobranca, ajuste });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

export async function registrarEntradaTardiaBoletoPedido(pedidoValor: unknown, cobrancaValor: unknown, contaValor: unknown, dataValor: unknown, evidenciaValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), cobrancaId = identificador(cobrancaValor), contaId = identificador(contaValor), evidencia = referenciaExterna(evidenciaValor, "Evidência da entrada tardia"), data = dataFinanceira(dataValor, "a data da entrada tardia");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "BOLETO_ENTRADA_TARDIA", id, cobrancaId, contaId, data, evidencia });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "receber"], id); await travarOperacao(tx, chaveOperacao);
    const anterior = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao } });
    if (anterior) { if (anterior.pedidoId !== id || anterior.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return resumoFinanceiro(tx, id); }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id } }); await bloquearTitulos(tx, id);
    const cobranca = await tx.pagamentoExternoPedido.findUnique({ where: { id: cobrancaId }, include: { titulo: true } });
    if (!cobranca || cobranca.pedidoId !== id || cobranca.tipo !== "BOLETO" || !["EXCECAO_PAGAMENTO_TARDIO", "CANCELADO_EXTERNAMENTE"].includes(cobranca.status)) throw new ErroPedidoVenda("Entrada tardia indisponível ou já registrada.");
    if (!await tx.contaBancaria.count({ where: { id: contaId, ativo: true } })) throw new ErroPedidoVenda("Selecione uma conta ativa.");
    const base = cobranca.titulo;
    const titulo = await tx.lancamentoFinanceiro.create({ data: { tipo: "RECEITA", descricao: `Entrada tardia do boleto · Pedido #${pedido.numero}`, valor: cobranca.valorBruto, categoriaId: base.categoriaId, dataCompetencia: base.dataCompetencia, dataVencimento: data, contraparteNome: base.contraparteNome, criadoPorId: autor.userId, pedidoVendaId: id, pedidoEfeitoChave: `tardio:${cobrancaId}`, pedidoParcelaRaiz: `tardio-${cobrancaId}`, pedidoValorOriginal: cobranca.valorBruto, formaPagamentoVendaId: base.formaPagamentoVendaId, pedidoFormaSnapshot: base.pedidoFormaSnapshot as Prisma.InputJsonValue } });
    await baixarLancamento({ lancamentoId: titulo.id, contaBancariaId: contaId, dataPagamento: data, tx, origemPedido: true });
    await tx.pagamentoExternoPedido.update({ where: { id: cobrancaId }, data: { status: "PAGO_TARDIO", confirmadoEm: data } });
    if (pedido.status === "CONFIRMADO" && pedido.versaoFinanceiro === 1) await revisarObrigacoesPedido(tx, id, pedido.total, (await bloquearTitulos(tx, id)).filter(t => t.tipo === "RECEITA"), chaveOperacao, autor.userId);
    if (pedido.status === "CANCELADO" && pedido.origem !== "IFOOD") {
      await criarSolicitacaoDevolucao(tx, id, cobranca.valorBruto, dinheiro("0"), "Pagamento de boleto recebido após cancelamento", "", evidencia, `${chaveOperacao}:devolucao`, hash({ tipo: "BOLETO_TARDIO_DEVOLUCAO", id, cobrancaId }), autor, false);
    }
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "BOLETO_ENTRADA_TARDIA", autor, { cobrancaId, tituloId: titulo.id, valor: cobranca.valorBruto.toFixed(2), contaId, data, evidencia, statusComercialPreservado: pedido.status });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

export async function confirmarPagamentoBoletoPedido(pedidoValor: unknown, cobrancaValor: unknown, contaValor: unknown, dataValor: unknown, evidenciaValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), cobrancaId = identificador(cobrancaValor), contaId = identificador(contaValor), evidencia = referenciaExterna(evidenciaValor, "Evidência do pagamento"), data = dataFinanceira(dataValor, "a data do pagamento");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "BOLETO_PAGO", id, cobrancaId, contaId, data: data.toISOString(), evidencia });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "receber"], id);
    await travarOperacao(tx, chaveOperacao);
    const anterior = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao } });
    if (anterior) { if (anterior.pedidoId !== id || anterior.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return resumoFinanceiro(tx, id); }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id }, select: { status: true } });
    await bloquearTitulos(tx, id);
    const cobranca = await tx.pagamentoExternoPedido.findUnique({ where: { id: cobrancaId } });
    if (cobranca?.pedidoId !== id || cobranca.tipo !== "BOLETO" || cobranca.status !== "EMITIDO") throw new ErroPedidoVenda("Boleto externo indisponível.");
    if (pedido?.status !== "CONFIRMADO") {
      await tx.pagamentoExternoPedido.update({ where: { id: cobrancaId }, data: { status: "EXCECAO_PAGAMENTO_TARDIO", confirmadoEm: data } });
      await historicoFinanceiro(tx, id, chaveOperacao, resumo, "BOLETO_PAGO_APOS_CANCELAMENTO", autor, { cobrancaId, evidencia, data: data.toISOString() });
      return resumoFinanceiro(tx, id);
    }
    const titulo = await tx.lancamentoFinanceiro.findUnique({ where: { id: cobranca.tituloId } });
    const conta = await tx.contaBancaria.findUnique({ where: { id: contaId }, select: { ativo: true } });
    if (!titulo || titulo.status !== "PENDENTE" || !conta?.ativo) throw new ErroPedidoVenda("Título ou conta indisponível.");
    await baixarLancamento({ lancamentoId: titulo.id, contaBancariaId: contaId, dataPagamento: data, tx, origemPedido: true });
    await tx.pagamentoExternoPedido.update({ where: { id: cobrancaId }, data: { status: "PAGO", confirmadoEm: data } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "BOLETO_PAGO", autor, { cobrancaId, tituloId: titulo.id, valor: titulo.valor.toString(), contaId, data: data.toISOString(), evidencia });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

export async function registrarRepasseCartaoPedido(pedidoValor: unknown, pagamentoValor: unknown, brutoValor: unknown, taxaValor: unknown, contaValor: unknown, dataValor: unknown, categoriaTaxaValor: unknown, competenciaTaxaValor: unknown, evidenciaValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), pagamentoId = identificador(pagamentoValor), bruto = valorFinanceiro(brutoValor), contaId = identificador(contaValor);
  if (typeof taxaValor !== "string" || !/^\d{1,12}(\.\d{1,2})?$/.test(taxaValor)) throw new ErroPedidoVenda("Informe a taxa efetiva, inclusive zero quando comprovada.");
  const taxa = dinheiro(taxaValor), liquido = bruto.minus(taxa);
  if (liquido.isNegative()) throw new ErroPedidoVenda("Taxa não pode exceder o repasse bruto.");
  const data = dataFinanceira(dataValor, "a data do repasse"), evidencia = referenciaExterna(evidenciaValor, "Evidência do repasse");
  const categoriaTaxaId = taxa.greaterThan(0) ? identificador(categoriaTaxaValor) : null;
  const competenciaTaxa = taxa.greaterThan(0) ? dataFinanceira(competenciaTaxaValor, "a competência da taxa") : null;
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "REPASSE_CARTAO", id, pagamentoId, bruto: bruto.toFixed(2), taxa: taxa.toFixed(2), contaId, data: data.toISOString(), categoriaTaxaId, competenciaTaxa: competenciaTaxa?.toISOString() ?? null, evidencia });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "receber", "condicao"], id);
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.repassePagamentoPedido.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.pagamentoId !== pagamentoId || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return resumoFinanceiro(tx, id); }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id }, select: { status: true } });
    if (!pedido || !["CONFIRMADO", "CANCELADO"].includes(pedido.status)) throw new ErroPedidoVenda("Repasse exige pedido existente com captura comprovada.");
    await bloquearTitulos(tx, id);
    const pagamento = await tx.pagamentoExternoPedido.findUnique({ where: { id: pagamentoId }, include: { titulo: true, repasses: true } });
    if (!pagamento || pagamento.pedidoId !== id || pagamento.status !== "CAPTURADO" || !["CARTAO_CREDITO", "CARTAO_DEBITO", "IFOOD"].includes(pagamento.tipo)) throw new ErroPedidoVenda("Captura de cartão indisponível.");
    const jaRepassado = pagamento.repasses.reduce((s, r) => s.plus(r.valorBruto), dinheiro("0"));
    if (jaRepassado.plus(bruto).greaterThan(pagamento.valorBruto)) throw new ErroPedidoVenda("Repasse excede o bruto capturado.");
    const taxasAnteriores = pagamento.repasses.reduce((s, r) => s.plus(r.taxa), dinheiro("0"));
    if (pagamento.taxa && (taxasAnteriores.plus(taxa).greaterThan(pagamento.taxa) || (jaRepassado.plus(bruto).equals(pagamento.valorBruto) && !taxasAnteriores.plus(taxa).equals(pagamento.taxa)))) throw new ErroPedidoVenda("Taxas do repasse divergem da captura registrada.");
    const conta = await tx.contaBancaria.findUnique({ where: { id: contaId }, select: { ativo: true } });
    if (!conta?.ativo) throw new ErroPedidoVenda("Conta bancária indisponível.");
    if (categoriaTaxaId) {
      const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: categoriaTaxaId } });
      if (!categoria?.ativo || categoria.excluidoEm || categoria.grupo !== "DESPESAS_FINANCEIRAS") throw new ErroPedidoVenda("Escolha categoria ativa de despesas financeiras para a taxa.");
    }
    const raiz = pagamento.titulo.pedidoParcelaRaiz;
    const titulo = await tx.lancamentoFinanceiro.findFirst({ where: { pedidoVendaId: id, pedidoParcelaRaiz: raiz, status: "PENDENTE" } });
    if (!titulo || bruto.greaterThan(titulo.valor)) throw new ErroPedidoVenda("Saldo de repasse inconsistente com o título.");
    if (bruto.lessThan(titulo.valor)) {
      await tx.lancamentoFinanceiro.update({ where: { id: titulo.id }, data: { valor: bruto } });
      await tx.lancamentoFinanceiro.create({ data: { tipo: "RECEITA", descricao: titulo.descricao, valor: titulo.valor.minus(bruto), categoriaId: titulo.categoriaId, dataCompetencia: titulo.dataCompetencia, dataVencimento: titulo.dataVencimento, contraparteNome: titulo.contraparteNome, criadoPorId: autor.userId, pedidoVendaId: id, pedidoEfeitoChave: `resto-repasse:${chaveOperacao}`, pedidoParcelaRaiz: raiz, pedidoValorOriginal: titulo.pedidoValorOriginal, formaPagamentoVendaId: titulo.formaPagamentoVendaId, pedidoFormaSnapshot: titulo.pedidoFormaSnapshot as Prisma.InputJsonValue } });
    }
    await baixarLancamento({ lancamentoId: titulo.id, contaBancariaId: contaId, dataPagamento: data, tx, origemPedido: true });
    let taxaLancamentoId: string | null = null;
    if (taxa.greaterThan(0)) {
      const taxaLancamento = await tx.lancamentoFinanceiro.create({ data: { tipo: "DESPESA", descricao: `Taxa de repasse do pedido #${(await tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { numero: true } })).numero}`, valor: taxa, categoriaId: categoriaTaxaId!, dataCompetencia: competenciaTaxa!, dataVencimento: data, contraparteNome: pagamento.referenciaExterna, criadoPorId: autor.userId, pedidoVendaId: id, pedidoEfeitoChave: `taxa-repasse:${chaveOperacao}` } });
      taxaLancamentoId = taxaLancamento.id;
      await baixarLancamento({ lancamentoId: taxaLancamento.id, contaBancariaId: contaId, dataPagamento: data, tx, origemPedido: true });
    }
    await tx.repassePagamentoPedido.create({ data: { pagamentoId, valorBruto: bruto, taxa, valorLiquido: liquido, data, contaBancariaId: contaId, lancamentoId: titulo.id, taxaLancamentoId, evidencia, chaveOperacao, hashOperacao: resumo, criadoPorId: autor.userId } });
    if (jaRepassado.plus(bruto).equals(pagamento.valorBruto)) await tx.pagamentoExternoPedido.update({ where: { id: pagamentoId }, data: { repassadoEm: data } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "REPASSE_CARTAO", autor, { pagamentoId, bruto: bruto.toString(), taxa: taxa.toString(), liquido: liquido.toString(), contaId, data: data.toISOString(), categoriaTaxaId, competenciaTaxa: competenciaTaxa?.toISOString() ?? null, evidencia });
    return resumoFinanceiro(tx, id);
  }, { timeout: 30000 });
}

async function origensElegiveis(tx: Tx, pedidoId: string, considerarCancelamento = false) {
  const [titulos, externos, alocacoes] = await Promise.all([
    tx.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedidoId, tipo: "RECEITA", status: "BAIXADO" }, orderBy: { createdAt: "asc" } }),
    tx.pagamentoExternoPedido.findMany({ where: { pedidoId, status: "CAPTURADO" }, include: { titulo: { select: { pedidoParcelaRaiz: true } } }, orderBy: { createdAt: "asc" } }),
    tx.alocacaoTratamentoPedido.findMany({ where: { tratamento: { pedidoId, status: { in: ["SOLICITADA", "PROCESSANDO", "CONCLUIDA"] } } } }),
  ]);
  const raizesExternas = new Set(externos.map(e => e.titulo.pedidoParcelaRaiz));
  const fontes = [
    ...titulos.filter(t => !t.pedidoQuitadoCredito && !raizesExternas.has(t.pedidoParcelaRaiz)).map(t => ({ tituloId: t.id, externoId: null as string | null, pago: t.valor })),
    ...externos.map(e => ({ tituloId: e.tituloId, externoId: e.id as string | null, pago: e.valorBruto })),
  ];
  const disponiveis = fontes.map(f => ({ ...f, disponivel: f.pago.minus(alocacoes.filter(a => a.origemTituloId === f.tituloId && a.origemPagamentoExternoId === f.externoId).reduce((s, a) => s.plus(a.valor), dinheiro("0"))) }));
  const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId } });
  if (!considerarCancelamento && pedido.versaoFinanceiro === 1 && pedido.status !== "CANCELADO" && !pedido.entregueEm) {
    const movimentos = await tx.creditoClienteMovimento.findMany({ where: { pedidoAplicacaoId: pedidoId } });
    const creditoLiquido = movimentos.reduce((s, m) => m.tipo === "APLICACAO" ? s.plus(m.valor) : m.tipo === "LIBERACAO" ? s.minus(m.valor) : s, dinheiro("0"));
    let excesso = Prisma.Decimal.max(0, disponiveis.reduce((s, f) => s.plus(f.disponivel), creditoLiquido).minus(pedido.total));
    return disponiveis.map(f => { const disponivel = Prisma.Decimal.min(f.disponivel, excesso); excesso = excesso.minus(disponivel); return { ...f, disponivel }; });
  }
  return disponiveis;
}

export async function solicitarDevolucaoPedido(pedidoValor: unknown, devolucaoValor: unknown, retencaoValor: unknown, motivoValor: unknown, politicaValor: unknown, comunicacaoValor: unknown, operacao: unknown, sessao: SessaoAtual, transacao?: Tx) {
  const id = identificador(pedidoValor), devolucao = valorFinanceiro(devolucaoValor);
  const retencao = retencaoValor === "0" || retencaoValor === "0.00" ? dinheiro("0") : valorFinanceiro(retencaoValor);
  const motivo = typeof motivoValor === "string" ? motivoValor.trim() : "";
  const politica = typeof politicaValor === "string" ? politicaValor.trim() : "";
  const comunicacao = typeof comunicacaoValor === "string" ? comunicacaoValor.trim() : "";
  if ((retencao.greaterThan(0) && (!motivo || !politica || !comunicacao)) || motivo.length > 1000 || politica.length > 180 || comunicacao.length > 180) throw new ErroPedidoVenda("Retenção parcial exige motivo, política/comunicação e responsável autorizado.");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "DEVOLUCAO_SOLICITADA", id, devolucao: devolucao.toFixed(2), retencao: retencao.toFixed(2), motivo, politica, comunicacao });
  const executar = async (tx: Tx) => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "cancelar", "receber", ...(retencao.greaterThan(0) ? ["condicao" as const] : [])], id);
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.tratamentoFinanceiroPedido.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.pedidoId !== id || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return repeticao; }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id } });
    if (!pedido || pedido.status !== "CANCELADO" && !(pedido.versaoFinanceiro === 1 && pedido.status === "CONFIRMADO")) throw new ErroPedidoVenda("Devolução exige cancelamento, pós-venda ou excedente da revisão.");
    if (pedido.versaoFinanceiro === 1 && !motivo) throw new ErroPedidoVenda("Informe o motivo da devolução.");
    await bloquearTitulos(tx, id);
    return criarSolicitacaoDevolucao(tx, id, devolucao, retencao, motivo, politica, comunicacao, chaveOperacao, resumo, autor, pedido.versaoFinanceiro === 1 && !!pedido.entregueEm);
  };
  return transacao ? executar(transacao) : prisma.$transaction(executar, { timeout: 30000 });
}

export async function mudarEstadoDevolucaoPedido(pedidoValor: unknown, tratamentoValor: unknown, estadoValor: unknown, motivoValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), tratamentoId = identificador(tratamentoValor), estado = estadoValor;
  if (!["PROCESSANDO", "FALHA", "CANCELADA"].includes(String(estado))) throw new ErroPedidoVenda("Estado de devolução inválido.");
  const motivo = typeof motivoValor === "string" ? motivoValor.trim() : "";
  if ((estado === "FALHA" || estado === "CANCELADA") && !motivo) throw new ErroPedidoVenda("Informe o motivo da falha ou cancelamento da solicitação.");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "DEVOLUCAO_ESTADO", id, tratamentoId, estado, motivo });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "cancelar", "receber"], id);
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.pedidoId !== id || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return tx.tratamentoFinanceiroPedido.findUniqueOrThrow({ where: { id: tratamentoId } }); }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const tratamento = await tx.tratamentoFinanceiroPedido.findUnique({ where: { id: tratamentoId } });
    if (!tratamento || tratamento.pedidoId !== id || tratamento.tipo !== "DEVOLUCAO" || !["SOLICITADA", "PROCESSANDO"].includes(tratamento.status) || (estado === "PROCESSANDO" && tratamento.status !== "SOLICITADA")) throw new ErroPedidoVenda("Solicitação não admite esta transição.");
    const atualizado = await tx.tratamentoFinanceiroPedido.update({ where: { id: tratamentoId }, data: { status: String(estado) } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, `DEVOLUCAO_${estado}`, autor, { tratamentoId, motivo });
    return atualizado;
  }, { timeout: 30000 });
}

export async function concluirDevolucaoPedido(pedidoValor: unknown, tratamentoValor: unknown, contaValor: unknown, dataValor: unknown, categoriaValor: unknown, competenciaValor: unknown, evidenciaValor: unknown, operacao: unknown, sessao: SessaoAtual, transacao?: Tx) {
  const id = identificador(pedidoValor), tratamentoId = identificador(tratamentoValor), contaId = identificador(contaValor), categoriaId = identificador(categoriaValor), evidencia = referenciaExterna(evidenciaValor, "Evidência de devolução concluída");
  const data = dataFinanceira(dataValor, "a data da devolução");
  const competenciaAssinatura = competenciaValor ? dataFinanceira(competenciaValor, "a competência da devolução").toISOString() : null;
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "DEVOLUCAO_CONCLUIDA", id, tratamentoId, contaId, categoriaId, data: data.toISOString(), competencia: competenciaAssinatura, evidencia });
  const executar = async (tx: Tx) => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "cancelar", "receber", "condicao"], id);
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.pedidoId !== id || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return tx.tratamentoFinanceiroPedido.findUniqueOrThrow({ where: { id: tratamentoId } }); }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const tratamento = await tx.tratamentoFinanceiroPedido.findUnique({ where: { id: tratamentoId }, include: { alocacoes: true } });
    if (!tratamento || tratamento.pedidoId !== id || tratamento.tipo !== "DEVOLUCAO" || tratamento.status !== "PROCESSANDO") throw new ErroPedidoVenda("Devolução precisa estar em processamento.");
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id }, select: { numero: true, versaoFinanceiro: true } });
    const competencia = pedido.versaoFinanceiro === 1
      ? (await tx.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: id, tipo: "RECEITA" }, orderBy: { createdAt: "asc" }, select: { dataCompetencia: true } })).dataCompetencia
      : dataFinanceira(competenciaValor, "a competência da devolução");
    if (pedido.versaoFinanceiro === 0 && tratamento.alocacoes.some(a => a.origemPagamentoExternoId)) {
      const ids = tratamento.alocacoes.flatMap(a => a.origemPagamentoExternoId ? [a.origemPagamentoExternoId] : []);
      const capturas = await tx.pagamentoExternoPedido.findMany({ where: { id: { in: ids } }, include: { repasses: true } });
      if (capturas.some(c => c.repasses.reduce((s, r) => s.plus(r.valorBruto), dinheiro("0")).lessThan(c.valorBruto))) throw new ErroPedidoVenda("Devolução de cartão antes do repasse depende da configuração do intermediador; registre a exceção externamente.");
    }
    const conta = await tx.contaBancaria.findUnique({ where: { id: contaId }, select: { ativo: true } });
    const categoria = await tx.categoriaFinanceira.findUnique({ where: { id: categoriaId } });
    if (!conta?.ativo || !categoria?.ativo || categoria.excluidoEm || categoria.grupo !== "DEDUCOES_RECEITA") throw new ErroPedidoVenda("Informe conta e categoria de dedução de receita ativas, validadas para esta devolução.");
    const lancamento = await tx.lancamentoFinanceiro.create({ data: { tipo: "DESPESA", descricao: `Devolução do pedido #${pedido.numero}`, valor: tratamento.valor, categoriaId, dataCompetencia: competencia, dataVencimento: data, criadoPorId: autor.userId, pedidoVendaId: id, pedidoEfeitoChave: `devolucao:${tratamento.id}` } });
    await baixarLancamento({ lancamentoId: lancamento.id, contaBancariaId: contaId, dataPagamento: data, tx, origemPedido: true });
    const atualizado = await tx.tratamentoFinanceiroPedido.update({ where: { id: tratamentoId }, data: { status: "CONCLUIDA", evidenciaConclusao: evidencia, concluidoEm: data, devolucaoLancamentoId: lancamento.id } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "DEVOLUCAO_CONCLUIDA", autor, { tratamentoId, valor: tratamento.valor.toString(), retido: tratamento.retido.toString(), contaId, categoriaId, competencia: competencia.toISOString(), data: data.toISOString(), evidencia });
    return atualizado;
  };
  return transacao ? executar(transacao) : prisma.$transaction(executar, { timeout: 30000 });
}

export async function concederCreditoPedido(pedidoValor: unknown, valorCredito: unknown, escolhaDataValor: unknown, comunicacaoValor: unknown, operacao: unknown, sessao: SessaoAtual, transacao?: Tx) {
  const id = identificador(pedidoValor), valor = valorFinanceiro(valorCredito), escolhaEm = dataFinanceira(escolhaDataValor, "a data da escolha do cliente"), comunicacao = referenciaExterna(comunicacaoValor, "Referência da escolha do cliente");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "CREDITO_CONCEDIDO", id, valor: valor.toFixed(2), escolhaEm: escolhaEm.toISOString(), comunicacao });
  const executar = async (tx: Tx) => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "cancelar", "receber", "condicao"], id);
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.tratamentoFinanceiroPedido.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.pedidoId !== id || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return repeticao; }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id } });
    if (!pedido?.clienteId || pedido.status !== "CANCELADO" && !(pedido.versaoFinanceiro === 1 && pedido.status === "CONFIRMADO")) throw new ErroPedidoVenda("Crédito exige comprador cadastrado e cancelamento, pós-venda ou excedente de revisão.");
    await tx.$queryRaw`SELECT id FROM "ClienteVenda" WHERE id = ${pedido.clienteId} FOR UPDATE`;
    await bloquearTitulos(tx, id);
    const fontes = await origensElegiveis(tx, id);
    if (valor.greaterThan(fontes.reduce((s, f) => s.plus(f.disponivel), dinheiro("0")))) throw new ErroPedidoVenda("Crédito excede o valor pago elegível, já reservado ou devolvido.");
    let restante = valor;
    const alocacoes: { origemTituloId: string; origemPagamentoExternoId: string | null; valor: Prisma.Decimal; credito: Prisma.Decimal }[] = [];
    for (const fonte of fontes) {
      const aplicado = Prisma.Decimal.min(restante, fonte.disponivel);
      if (aplicado.greaterThan(0)) alocacoes.push({ origemTituloId: fonte.tituloId, origemPagamentoExternoId: fonte.externoId, valor: aplicado, credito: aplicado });
      restante = restante.minus(aplicado);
      if (restante.isZero()) break;
    }
    const tratamento = await tx.tratamentoFinanceiroPedido.create({ data: { pedidoId: id, tipo: "CREDITO", status: "CONCLUIDA", valor, reduzVenda: pedido.versaoFinanceiro === 1 && !!pedido.entregueEm, escolhaClienteEm: escolhaEm, referenciaComunicacao: comunicacao, concluidoEm: new Date(), chaveOperacao, hashOperacao: resumo, criadoPorId: autor.userId, alocacoes: { create: alocacoes } } });
    await tx.creditoClienteMovimento.create({ data: { clienteId: pedido.clienteId, tipo: "CONCESSAO", valor, tratamentoId: tratamento.id, motivo: "Escolha do cliente no tratamento financeiro", referenciaComunicacao: comunicacao, data: escolhaEm, chaveOperacao: `credito-conceder:${chaveOperacao}`, hashOperacao: resumo, criadoPorId: autor.userId } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "CREDITO_CONCEDIDO", autor, { tratamentoId: tratamento.id, clienteId: pedido.clienteId, valor: valor.toString(), escolhaEm: escolhaEm.toISOString(), comunicacao, alocacoes: alocacoes.map(a => ({ tituloId: a.origemTituloId, externoId: a.origemPagamentoExternoId, valor: a.valor.toString() })) });
    return tratamento;
  };
  return transacao ? executar(transacao) : prisma.$transaction(executar, { timeout: 30000 });
}

export async function liberarCreditoAplicadoPedido(pedidoValor: unknown, valorLiberar: unknown, motivoValor: unknown, comunicacaoValor: unknown, operacao: unknown, sessao: SessaoAtual, transacao?: Tx) {
  const id = identificador(pedidoValor), valor = valorFinanceiro(valorLiberar), motivo = typeof motivoValor === "string" ? motivoValor.trim() : "", comunicacao = referenciaExterna(comunicacaoValor, "Referência da decisão de liberação");
  if (!motivo || motivo.length > 1000) throw new ErroPedidoVenda("Informe o motivo da liberação do crédito aplicado.");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo: "CREDITO_LIBERADO", id, valor: valor.toFixed(2), motivo, comunicacao });
  const executar = async (tx: Tx) => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "cancelar", "receber", "condicao"], id);
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.creditoClienteMovimento.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.pedidoAplicacaoId !== id || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return repeticao; }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUnique({ where: { id } });
    if (!pedido?.clienteId || pedido.status !== "CANCELADO" && !(pedido.versaoFinanceiro === 1 && pedido.status === "CONFIRMADO")) throw new ErroPedidoVenda("A liberação requer cancelamento, pós-venda ou excedente de revisão e decisão autorizada.");
    await tx.$queryRaw`SELECT id FROM "ClienteVenda" WHERE id = ${pedido.clienteId} FOR UPDATE`;
    const aplicacao = await tx.creditoClienteMovimento.findFirst({ where: { pedidoAplicacaoId: id, tipo: "APLICACAO" } });
    if (!aplicacao || aplicacao.clienteId !== pedido.clienteId) throw new ErroPedidoVenda("Pedido não usou crédito deste cliente.");
    const jaLiberado = await tx.creditoClienteMovimento.aggregate({ where: { origemMovimentoId: aplicacao.id, tipo: "LIBERACAO" }, _sum: { valor: true } });
    if (valor.plus(jaLiberado._sum.valor ?? dinheiro("0")).greaterThan(aplicacao.valor)) throw new ErroPedidoVenda("Liberação excede o crédito aplicado ou já restaurado.");
    if (pedido.versaoFinanceiro === 1 && pedido.status === "CONFIRMADO" && !pedido.entregueEm) {
      const titulos = await tx.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: id, tipo: "RECEITA", status: "BAIXADO", pedidoQuitadoCredito: false } });
      const tratados = await tx.tratamentoFinanceiroPedido.aggregate({ where: { pedidoId: id, status: { in: ["SOLICITADA", "PROCESSANDO", "CONCLUIDA"] } }, _sum: { valor: true, retido: true } });
      const excedente = aplicacao.valor.plus(titulos.reduce((s, t) => s.plus(t.valor), dinheiro("0"))).minus(pedido.total).minus(jaLiberado._sum.valor ?? 0).minus(tratados._sum.valor ?? 0).minus(tratados._sum.retido ?? 0);
      if (valor.gt(excedente)) throw new ErroPedidoVenda("A restauração excede o valor que sobrou da revisão.");
    }
    const movimento = await tx.creditoClienteMovimento.create({ data: { clienteId: pedido.clienteId, tipo: "LIBERACAO", valor, reduzVenda: pedido.versaoFinanceiro === 1 && !!pedido.entregueEm, pedidoAplicacaoId: id, origemMovimentoId: aplicacao.id, motivo, referenciaComunicacao: comunicacao, data: new Date(), chaveOperacao, hashOperacao: resumo, criadoPorId: autor.userId } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "CREDITO_LIBERADO", autor, { aplicacaoId: aplicacao.id, valor: valor.toString(), motivo, comunicacao });
    return movimento;
  };
  return transacao ? executar(transacao) : prisma.$transaction(executar, { timeout: 30000 });
}

export async function ajustarCreditoCliente(clienteValor: unknown, origemValor: unknown, tipoValor: unknown, valorAjuste: unknown, motivoValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const clienteId = identificador(clienteValor), origemId = identificador(origemValor), valor = valorFinanceiro(valorAjuste), tipo = String(tipoValor), motivo = typeof motivoValor === "string" ? motivoValor.trim() : "";
  if (!["AJUSTE_CREDITO", "AJUSTE_DEBITO"].includes(tipo) || !motivo || motivo.length > 1000) throw new ErroPedidoVenda("Ajuste exige tipo e motivo autorizado.");
  const chaveOperacao = chave(operacao), resumo = hash({ tipo, clienteId, origemId, valor: valor.toFixed(2), motivo });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "cancelar", "receber", "condicao"]);
    await travarOperacao(tx, chaveOperacao);
    const repeticao = await tx.creditoClienteMovimento.findUnique({ where: { chaveOperacao } });
    if (repeticao) { if (repeticao.clienteId !== clienteId || repeticao.hashOperacao !== resumo) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return repeticao; }
    await tx.$queryRaw`SELECT id FROM "ClienteVenda" WHERE id = ${clienteId} FOR UPDATE`;
    const origem = await tx.creditoClienteMovimento.findUnique({ where: { id: origemId } });
    if (!origem || origem.clienteId !== clienteId) throw new ErroPedidoVenda("Origem do ajuste inválida.");
    if (tipo === "AJUSTE_DEBITO" && (await saldoCreditoCliente(tx, clienteId)).lessThan(valor)) throw new ErroPedidoVenda("Ajuste excede o saldo disponível.");
    if (tipo === "AJUSTE_CREDITO") {
      if (origem.tipo !== "AJUSTE_DEBITO") throw new ErroPedidoVenda("Ajuste a crédito só pode corrigir débito anterior comprovado.");
      const jaCorrigido = await tx.creditoClienteMovimento.aggregate({ where: { origemMovimentoId: origemId, tipo: "AJUSTE_CREDITO" }, _sum: { valor: true } });
      if (valor.plus(jaCorrigido._sum.valor ?? dinheiro("0")).greaterThan(origem.valor)) throw new ErroPedidoVenda("Correção excede o ajuste de origem.");
    }
    return tx.creditoClienteMovimento.create({ data: { clienteId, tipo, valor, origemMovimentoId: origemId, motivo, data: new Date(), chaveOperacao, hashOperacao: resumo, criadoPorId: autor.userId } });
  }, { timeout: 30000 });
}

export type FiltroPedidos = { clienteId?: string; canalId?: string; produtoId?: string; status?: string; de?: string; ate?: string; pagina?: number; baseData?: string; operacional?: string; busca?: string; etapaGestor?: string; incluirSemData?: boolean; apenasEntreguesRecentes?: boolean; excluirCancelados?: boolean; ordem?: "data-asc" };
function snapshotTexto<Campo extends string>(valor: unknown, campos: Campo[]) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const registro = valor as Record<string, unknown>;
  return Object.fromEntries(campos.flatMap(campo => typeof registro[campo] === "string" ? [[campo, registro[campo] as string]] : [])) as Partial<Record<Campo, string>>;
}
function rascunhoGestor(valor: Prisma.JsonValue | null) {
  if (!valor) return null;
  try { return validarEntradaPedido(valor); } catch { return null; }
}
function pagamentoSnapshotGestor(valor: unknown) {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const p = valor as Record<string, unknown>;
  if (typeof p.nome !== "string" || typeof p.tipo !== "string" || !Number.isSafeInteger(p.parcelas) || !Array.isArray(p.vencimentos)) return null;
  return { nome: p.nome, tipo: p.tipo, parcelas: p.parcelas as number, vencimentos: p.vencimentos.filter((v): v is string => typeof v === "string") };
}
function fotoPrivadaGestor(valor: unknown) { return typeof valor === "string" && /^\/api\/vendas\/fotos\/[a-zA-Z0-9_-]{1,100}$/.test(valor) ? { fotoUrl: valor } : {}; }
async function idsSemPrevisaoNoPeriodo(de: string | undefined, ate: string | undefined, incluirSemData: boolean) {
  // DateTime é armazenado em UTC sem offset. A conversão em duas etapas conserva
  // o dia civil de cada pedido, mesmo quando seu fuso difere da loja atual.
  const ids = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    WITH datas AS (
      SELECT id, CASE
        WHEN status IN ('RASCUNHO', 'DECLINADO') THEN COALESCE(
          NULLIF(rascunho->>'previsaoData', ''),
          CASE WHEN rascunho->>'prazo' = 'IMEDIATO' THEN
            to_char((COALESCE("confirmadoEm", "createdAt") AT TIME ZONE 'UTC') AT TIME ZONE "fusoHorario", 'YYYY-MM-DD') END)
        WHEN prazo = 'IMEDIATO' THEN
          to_char((COALESCE("confirmadoEm", "createdAt") AT TIME ZONE 'UTC') AT TIME ZONE "fusoHorario", 'YYYY-MM-DD')
      END AS dia
      FROM "PedidoVenda" WHERE "previsaoData" IS NULL
    )
    SELECT id FROM datas WHERE (${incluirSemData} AND dia IS NULL) OR (dia IS NOT NULL
      ${diaValido(de) ? Prisma.sql`AND dia >= ${de}` : Prisma.empty}
      ${diaValido(ate) ? Prisma.sql`AND dia <= ${ate}` : Prisma.empty})
  `);
  return ids.map(p => p.id);
}

export async function listarPedidos(filtro?: FiltroPedidos) {
  const momentoConsulta: { consultadoEm?: string } = { consultadoEm: new Date().toISOString() };
  const where: Prisma.PedidoVendaWhereInput = filtro?.excluirCancelados ? { status: { not: "CANCELADO" } } : {};
  if (filtro?.busca?.trim()) { const b = filtro.busca.trim().slice(0, 160); where.OR = [{ cliente: { nome: { contains: b, mode: "insensitive" } } }, { referenciaPedido: { contains: b, mode: "insensitive" } }, ...( /^\d{1,9}$/.test(b) ? [{ numero: Number(b) }] : [])]; }
  if (filtro?.clienteId) where.clienteId = filtro.clienteId;
  if (filtro?.canalId) where.canalId = filtro.canalId;
  if (filtro?.produtoId) where.itens = { some: { produtoId: filtro.produtoId, vigente: true } };
  const loja = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { fusoHorario: true } });
  const fuso = loja?.fusoHorario ?? "America/Sao_Paulo";
  const intervalo = intervaloDatasPedidos(filtro?.de, filtro?.ate, filtro?.baseData, fuso);
  const condicoes: Prisma.PedidoVendaWhereInput[] = [];
  // O arquivo comercial permanece pesquisável, fora das filas operacionais.
  if (filtro?.etapaGestor && Object.hasOwn(estadosEtapasGestor, filtro.etapaGestor) || filtro?.operacional && ["PENDENTE", "EM_PREPARO", "PRONTO", "EM_ENTREGA", "ENTREGUE", "INTERROMPIDO"].includes(filtro.operacional) || filtro?.status === "operacionais") condicoes.push({ origem: { not: "HISTORICO_LEGADO" }, OR: [{ referenciaOrigem: null }, { referenciaOrigem: { not: ORIGEM_HISTORICA } }] });
  if (Object.keys(intervalo).length) {
    if (filtro?.baseData === "entrega") {
      const ids = await idsSemPrevisaoNoPeriodo(filtro.de, filtro.ate, Boolean(filtro.incluirSemData));
      condicoes.push({ OR: [{ previsaoData: intervalo }, { id: { in: ids } }] });
    }
    else condicoes.push({ OR: [
      { dataCompra: intervaloDatasPedidos(filtro?.de, filtro?.ate, "entrega", fuso) },
      { dataCompra: null, [filtro?.status === "HISTORICO" ? "createdAt" : "confirmadoEm"]: intervalo },
    ] });
  }
  // Uma correção de etapa conserva a primeira entrega. Recência deve restringir
  // somente a coluna atualmente entregue para não ocultar pedidos de volta à operação.
  if (filtro?.apenasEntreguesRecentes) condicoes.push({ OR: [{ statusOperacional: { not: "ENTREGUE" } }, { entregueEm: { gte: new Date(somarDias(diaNoFuso(new Date(), fuso), -7) + "T00:00:00Z") } }] });
  if (condicoes.length) where.AND = condicoes;
  const paginaSolicitada = Number.isSafeInteger(filtro?.pagina) && (filtro?.pagina ?? 0) > 0 ? Math.min(filtro!.pagina!, 10000) : 1;
  // Contagens próprias ignoram a seleção comercial/operacional, mas conservam os demais filtros.
  const baseStatus: Prisma.PedidoVendaWhereInput = { ...where };
  const condicoesStatus: Prisma.PedidoVendaWhereInput[] = [];
  if (filtro?.status === "operacionais") condicoesStatus.push({ OR: [{ status: "CONFIRMADO", statusOperacional: { not: "INTERROMPIDO" } }, { status: "RECEBIDO_EXTERNO", origem: "IFOOD" }] });
  else if (!(filtro?.excluirCancelados && filtro.status === "CANCELADO") && filtro?.status && ["RASCUNHO", "CONFIRMADO", "RECEBIDO_EXTERNO", "CANCELADO", "DECLINADO", "ESTORNADO", "HISTORICO"].includes(filtro.status)) where.status = filtro.status;
  if (filtro?.operacional && ["PENDENTE", "EM_PREPARO", "PRONTO", "EM_ENTREGA", "ENTREGUE", "INTERROMPIDO"].includes(filtro.operacional)) where.statusOperacional = filtro.operacional;
  if (filtro?.etapaGestor && Object.hasOwn(estadosEtapasGestor, filtro.etapaGestor)) {
    const etapa = filtro.etapaGestor as EtapaGestor;
    if (etapa === "novo") condicoesStatus.push({ OR: [{ status: "CONFIRMADO", statusOperacional: "PENDENTE" }, { status: "RECEBIDO_EXTERNO", origem: "IFOOD" }] });
    else { condicoesStatus.push({ status: "CONFIRMADO" }); where.statusOperacional = { in: estadosEtapasGestor[etapa] }; }
  }
  if (condicoesStatus.length) where.AND = [...condicoes, ...condicoesStatus];
  const baseCanal: Prisma.PedidoVendaWhereInput = { ...where };
  delete baseCanal.canalId;
  const [total, quantidade, porCanal, porStatus] = await Promise.all([
    prisma.pedidoVenda.aggregate({ where: { ...where, AND: [...condicoes, ...condicoesStatus, { status: "CONFIRMADO" }] }, _sum: { total: true }, _count: { id: true } }),
    prisma.pedidoVenda.count({ where }),
    prisma.pedidoVenda.groupBy({ by: ["canalId"], where: baseCanal, _count: { _all: true } }),
    prisma.pedidoVenda.groupBy({ by: ["status", "statusOperacional", "origem"], where: baseStatus, _count: { _all: true } }),
  ]);
  const paginas = Math.ceil(quantidade / 50), pagina = Math.min(paginaSolicitada, Math.max(1, paginas));
  const pedidos = await prisma.pedidoVenda.findMany({ where, select: {
    id: true, numero: true, versao: true, fusoHorario: true, modoFinanceiro: true, origem: true, referenciaPedido: true, clienteId: true, status: true, statusOperacional: true, atendimento: true, prazo: true, dataCompra: true,
    ifood: { select: { snapshotCifrado: true, acompanhamento: true, loja: { select: { modoOperacao: true } } } }, previsaoData: true, previsaoJanela: true, createdAt: true, confirmadoEm: true, entregueEm: true, subtotal: true, total: true, frete: true, desconto: true, outrosCustos: true, formaPagamentoInformada: true, observacoes: true,
    compradorSnapshot: true, pagamentoInformadoSnapshot: true, cobrancaSnapshot: true, destinatarioSnapshot: true, enderecoSnapshot: true, rascunho: true, canalNomeSnapshot: true, cliente: { select: { nome: true } },
    historico: { where: { tipo: { in: ["OPERACAO_PREPARAR", "OPERACAO_EXPEDIR", "OPERACAO_REVISAO", "OPERACAO_OCORRENCIA"] } }, select: { depois: true } },
    itens: { where: { vigente: true }, orderBy: { ordem: "asc" }, select: { id: true, produtoId: true, produto: { select: { fotoUrl: true } }, quantidade: true, observacoes: true, unidadeSnapshot: true, produtoSnapshot: true, escolhasSnapshot: true, estadoComposicao: true, precoAplicado: true, totalLinha: true, reservas: { select: { reservada: true, consumida: true, loteExecucao: true, quantidadeItem: true } } } },
  }, orderBy: filtro?.ordem === "data-asc" ? [{ createdAt: "asc" }, { numero: "asc" }] : filtro?.baseData === "entrega" ? [{ previsaoData: "asc" }, { numero: "asc" }] : [{ createdAt: "desc" }, { numero: "desc" }], skip: (pagina - 1) * 50, take: 50 });
  const rascunhos = new Map(pedidos.filter(p => ["RASCUNHO", "DECLINADO"].includes(p.status)).map(p => [p.id, rascunhoGestor(p.rascunho)]));
  const entradas = [...rascunhos.values()].filter((d): d is PedidoEntrada => d !== null);
  const clienteIds = [...new Set([...pedidos.flatMap(p => p.clienteId ? [p.clienteId] : []), ...entradas.flatMap(d => d.clienteId ? [d.clienteId] : [])])];
  const [clientes, produtos, opcoes, canais, contagens, formas] = await Promise.all([
    entradas.length ? prisma.clienteVenda.findMany({ where: { id: { in: entradas.flatMap(d => d.clienteId ? [d.clienteId] : []) } }, select: { id: true, nome: true, tipo: true, documento: true, razaoSocial: true, inscricaoEstadual: true, email: true, telefone: true, contato: true } }) : [],
    entradas.length ? prisma.produtoVenda.findMany({ where: { id: { in: entradas.flatMap(d => d.itens.map(i => i.produtoId)) } }, select: { id: true, nome: true, unidade: true, fotoUrl: true } }) : [],
    entradas.length ? prisma.opcaoComplementoVenda.findMany({ where: { id: { in: entradas.flatMap(d => d.itens.flatMap(i => [...Object.keys(i.escolhas), ...(i.complementoAvulso ? [i.complementoAvulso.opcaoId] : [])])) } }, select: { id: true, nome: true } }) : [],
    entradas.length ? prisma.canalVenda.findMany({ where: { id: { in: entradas.flatMap(d => d.canalId ? [d.canalId] : []) } }, select: { id: true, nome: true } }) : [],
    clienteIds.length ? prisma.pedidoVenda.groupBy({ by: ["clienteId"], where: { status: "CONFIRMADO", clienteId: { in: clienteIds } }, _count: true }) : [],
    entradas.some(d => d.pagamentoInformado) ? prisma.formaPagamentoVenda.findMany({ where: { id: { in: entradas.flatMap(d => d.pagamentoInformado ? [d.pagamentoInformado.formaId] : []) } }, select: { id: true, nome: true, tipo: true } }) : [],
  ]);
  const contagensCanal: Record<string, number> = { "": porCanal.reduce((total, grupo) => total + grupo._count._all, 0), ...Object.fromEntries(porCanal.filter(g => g.canalId).map(g => [g.canalId!, g._count._all])) };
  const contagensStatus: Record<"todos" | "novo" | "orcamento" | "preparo" | "pronto" | "rota" | "entregues" | "cancelado", number> & Partial<Record<"declinado" | "estornado" | "interrompido", number>> = { todos: 0, novo: 0, orcamento: 0, preparo: 0, pronto: 0, rota: 0, entregues: 0, cancelado: 0, declinado: 0, estornado: 0, interrompido: 0 };
  for (const grupo of porStatus) {
    const quantidade = grupo._count._all;
    if (grupo.status === "CONFIRMADO" && grupo.statusOperacional !== "INTERROMPIDO" || grupo.status === "RECEBIDO_EXTERNO" && grupo.origem === "IFOOD") contagensStatus.todos += quantidade;
    if (grupo.status === "RASCUNHO") contagensStatus.orcamento += quantidade;
    if (grupo.status === "CANCELADO") contagensStatus.cancelado += quantidade;
    if (grupo.status === "DECLINADO") contagensStatus.declinado = (contagensStatus.declinado ?? 0) + quantidade;
    if (grupo.status === "ESTORNADO") contagensStatus.estornado = (contagensStatus.estornado ?? 0) + quantidade;
    if (grupo.status === "CONFIRMADO" && grupo.statusOperacional === "INTERROMPIDO") contagensStatus.interrompido = (contagensStatus.interrompido ?? 0) + quantidade;
    if (grupo.status === "CONFIRMADO" || grupo.status === "RECEBIDO_EXTERNO" && grupo.origem === "IFOOD") {
      const etapa = etapaGestorPedido(grupo.status, grupo.statusOperacional);
      if (etapa) contagensStatus[etapa] += quantidade;
    }
  }
  return { ...momentoConsulta, contagensCanal, contagensStatus, pedidos: pedidos.map(p => {
    const d = rascunhos.get(p.id), clienteId = d?.clienteId ?? p.clienteId;
    const comprador = d ? clientes.find(c => c.id === clienteId)?.nome ?? "Comprador não informado" : snapshotTexto(p.compradorSnapshot, ["nome"])?.nome ?? p.cliente?.nome ?? "Comprador não informado";
    const compradorSnapshot = { ...snapshotTexto(d ? d.clienteNovo ?? clientes.find(c => c.id === clienteId) : p.compradorSnapshot, ["nome", "tipo", "documento", "razaoSocial", "inscricaoEstadual", "email", "telefone", "contato"]), nome: comprador };
    const forma = d?.pagamentoInformado ? formas.find(f => f.id === d.pagamentoInformado?.formaId) : null;
    const pagamentoInformadoSnapshot = d ? forma && d.pagamentoInformado ? { nome: forma.nome, tipo: forma.tipo, parcelas: d.pagamentoInformado.parcelas, vencimentos: d.pagamentoInformado.vencimentos } : null : pagamentoSnapshotGestor(p.pagamentoInformadoSnapshot);
    const horariosIfood = horariosSnapshotIfood(p.ifood?.snapshotCifrado, p.fusoHorario);
    const previsaoData = d?.previsaoData ?? p.previsaoData?.toISOString().slice(0, 10) ?? null, prazo = d?.prazo ?? p.prazo;
    const itensDetalhes = d ? d.itens.map((i, indice) => ({ ...(i.produtoId ? { produtoId: i.produtoId } : {}), ...fotoPrivadaGestor(produtos.find(x => x.id === i.produtoId)?.fotoUrl), id: `rascunho-${p.id}-${indice}`, nome: i.complementoAvulso ? opcoes.find(o => o.id === i.complementoAvulso?.opcaoId)?.nome ?? "Complemento indisponível" : produtos.find(x => x.id === i.produtoId)?.nome ?? "Produto indisponível", quantidade: i.quantidade, observacoes: i.observacoes || null, unidade: i.complementoAvulso ? "UN" : produtos.find(x => x.id === i.produtoId)?.unidade ?? "", precoUnitario: i.precoManual ?? "0", total: "0", preparado: "0", expedido: "0", complementos: Object.entries(i.escolhas).filter(([, qtd]) => qtd > 0).map(([id, qtd]) => `${qtd} × ${opcoes.find(o => o.id === id)?.nome ?? "Opção indisponível"}`) })) : p.itens.map(i => {
      const nome = snapshotTexto(i.produtoSnapshot, ["nome"])?.nome ?? "Item do pedido";
      const escolhas = Array.isArray(i.escolhasSnapshot) ? i.escolhasSnapshot : [];
      const complementos = escolhas.flatMap(e => e && typeof e === "object" && !Array.isArray(e) && typeof e.opcaoNome === "string" && typeof e.quantidade === "number" ? [`${e.quantidade} × ${e.opcaoNome}`] : []);
      const apontado = (tipo: string) => quantidadeExecucao(p.historico, i.id, tipo).toString();
      return { ...(i.produtoId ? { produtoId: i.produtoId } : {}), ...fotoPrivadaGestor(i.produto?.fotoUrl), id: i.id, nome, quantidade: i.quantidade.toString(), observacoes: i.observacoes, unidade: i.unidadeSnapshot, precoUnitario: i.precoAplicado.toString(), total: i.totalLinha.toString(), complementos, preparado: apontado("PREPARAR"), expedido: apontado("EXPEDIR") };
    });
    return { ...(horariosIfood?.criadoEm ? { criadoEmExterno: horariosIfood.criadoEm.toISOString() } : {}), acompanhamentoIfood: pedidoEmAcompanhamento(p.ifood), id: p.id, versao: p.versao, fusoHorario: p.fusoHorario, modoFinanceiro: p.modoFinanceiro, origem: p.origem, referenciaPedido: p.referenciaPedido, numero: ehPedidoHistorico(p) ? Number(p.referenciaPedido) : p.numero, cliente: comprador, compradorSnapshot, pagamentoInformadoSnapshot, pedidosAnteriores: Math.max(0, (contagens.find(c => c.clienteId === clienteId)?._count ?? 0) - (p.status === "CONFIRMADO" ? 1 : 0)), canal: d ? canais.find(c => c.id === d.canalId)?.nome ?? null : p.canalNomeSnapshot, status: p.status, operacional: p.statusOperacional, atendimento: d?.atendimento ?? p.atendimento, prazo, observacoes: d?.observacoes ?? p.observacoes,
      destinatarioSnapshot: snapshotTexto(d?.destinatario ?? p.destinatarioSnapshot, ["nome", "primeiroNome", "sobrenome", "contato"]), enderecoSnapshot: snapshotTexto(d?.endereco ?? p.enderecoSnapshot, ["pais", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "codigoMunicipio"]), cobrancaSnapshot: snapshotTexto(d ? d.cobranca ?? null : p.cobrancaSnapshot, ["nome", "tipo", "nomeCompleto", "documento", "razaoSocial", "inscricaoEstadual", "inscricaoMunicipal", "telefone", "pais", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "codigoMunicipio"]),
      ...(p.dataCompra ? { dataCompra: dataCompraCivil(p.dataCompra) } : {}), previsaoData, dataGestor: previsaoData ?? (prazo === "IMEDIATO" ? diaNoFuso(p.confirmadoEm ?? p.createdAt, p.fusoHorario) : null), previsaoJanela: horariosIfood?.janela ?? d?.previsaoJanela ?? p.previsaoJanela, inicioPreparoIfood: horariosIfood?.inicioPreparo?.toISOString() ?? null, criadoEm: p.createdAt.toISOString(), confirmadoEm: p.confirmadoEm?.toISOString() ?? null, entregueEm: p.entregueEm?.toISOString() ?? null, subtotal: p.subtotal.toString(), total: p.total.toString(), frete: d?.frete ?? p.frete.toString(), desconto: d?.desconto ?? p.desconto.toString(), outrosCustos: d?.outrosCustos ?? p.outrosCustos.toString(), formaPagamentoInformada: d?.formaPagamentoInformada ?? p.formaPagamentoInformada, itens: itensDetalhes.length, itensDetalhes,
      itensSemComposicao: p.itens.filter(i => i.estadoComposicao !== "CONHECIDA").length, itensComDemandaNaoReservada: p.itens.filter(i => { const lotes = new Map(i.reservas.filter(r => r.reservada.gt(0) || r.consumida.gt(0)).map(r => [r.loteExecucao, r.quantidadeItem])); return [...lotes.values()].reduce((s, q) => s.plus(q), dinheiro("0")).lt(i.quantidade); }).length };
  }), carteira: { quantidade: total._count.id, valor: total._sum.total?.toString() ?? "0" }, quantidadeTotal: quantidade, pagina, paginas };
}

export type PedidoGestor = Awaited<ReturnType<typeof listarPedidos>>["pedidos"][number];

export async function obterPedido(idValor: string) {
  const id = identificador(idValor);
  const pedido = await prisma.pedidoVenda.findUnique({ where: { id }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } }, historico: { orderBy: { createdAt: "desc" } }, historicoFinanceiro: { orderBy: { createdAt: "desc" } } } });
  if (!pedido) throw new ErroPedidoVenda("Pedido não encontrado.");
  const financeiro = pedido.modoFinanceiro === "EXTERNO" ? null : await prisma.$transaction(tx => resumoFinanceiro(tx, id));
  const inicio = pedido.historico.find(h => h.tipo === "OPERACAO_INICIAR");
  const cobertura = ehPedidoHistorico(pedido) ? null : inicio ? (inicio.antes as { cobertura?: CoberturaPedido } | null)?.cobertura ?? null : await prisma.$transaction(tx => coberturaComposicaoPedido(tx, pedido.itens));
  const coberturaPendenteRevisao = Boolean(inicio && cobertura && (cobertura.itens.length !== pedido.itens.length || pedido.itens.some(i => !cobertura.itens.some(c => c.itemId === i.id))));
  // Fotografias fiscais podem conter política de rateio e fórmulas documentadas;
  // a operação comercial consome seu DTO habitual, inclusive no histórico.
  return JSON.parse(JSON.stringify({ ...pedido, dataCompra: dataCompraCivil(pedido.dataCompra), financeiro, cobertura: coberturaPendenteRevisao ? null : cobertura, coberturaPendenteRevisao }, (chave, valor) => ["fotografiaKitFiscal", "receitaFiscalDocumentadaSnapshot"].includes(chave) ? undefined : valor)) as Record<string, unknown>;
}

export async function encerrarPedidoManual(pedidoId: unknown, versaoAtual: unknown, estado: "DECLINADO" | "ESTORNADO", motivoValor: unknown, referenciaValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoId), v = versao(versaoAtual), motivo = typeof motivoValor === "string" ? motivoValor.trim() : "", referencia = typeof referenciaValor === "string" ? referenciaValor.trim() : "";
  if (!["DECLINADO", "ESTORNADO"].includes(estado) || !motivo || motivo.length > 1000 || referencia.length > 500 || (estado === "ESTORNADO" && !referencia)) throw new ErroPedidoVenda("Informe motivo e, para estorno, referência da devolução realizada externamente.");
  const k = chave(operacao), h = hash({ id, v, estado, motivo, referencia });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["cancelar"], id);
    await travarOperacao(tx, k);
    const anterior = await repetida(tx, k, h); if (anterior) return anterior;
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id } });
    if (p.modoFinanceiro !== "EXTERNO" || p.versao !== v || !(estado === "DECLINADO" ? p.status === "RASCUNHO" : ["CONFIRMADO", "CANCELADO"].includes(p.status))) throw new ErroPedidoVenda("Estado incompatível ou pedido alterado. Reabra para conferir. Pedidos do Financeiro usam o tratamento financeiro existente.");
    const antes = await fotografia(tx, id);
    await liberarReservasCancelamento(tx, id);
    const salvo = await tx.pedidoVenda.update({ where: { id }, data: { status: estado, statusOperacional: "INTERROMPIDO", versao: { increment: 1 } }, select: { id: true, numero: true, versao: true, status: true } });
    if (estado === "ESTORNADO" && p.status !== "CANCELADO") await abrirDestinosCancelamento(tx, id, k, autor, v);
    await evento(tx, id, estado, k, h, autor, v, v + 1, antes, json({ pedido: await fotografia(tx, id), referencia, devolucaoExternaDeclarada: estado === "ESTORNADO" }), motivo);
    return salvo;
  }, { timeout: 30000 });
}

/** Retoma a mesma solicitação, conferindo cada origem sob as mesmas travas. Nunca reenvia dinheiro. */
export async function retomarDevolucaoPedido(pedidoValor: unknown, tratamentoValor: unknown, operacao: unknown, sessao: SessaoAtual) {
  const id = identificador(pedidoValor), tratamentoId = identificador(tratamentoValor), k = chave(operacao), h = hash({ tipo: "DEVOLUCAO_RETOMADA", id, tratamentoId });
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["consultar", "cancelar", "receber"], id);
    await travarOperacao(tx, k);
    const anterior = await tx.historicoFinanceiroPedido.findUnique({ where: { chaveOperacao: k } });
    if (anterior) { if (anterior.pedidoId !== id || anterior.hashOperacao !== h) throw new ErroPedidoVenda("Esta chave já foi usada com outros dados."); return; }
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${id} FOR UPDATE`;
    await bloquearTitulos(tx, id);
    const tratamento = await tx.tratamentoFinanceiroPedido.findUnique({ where: { id: tratamentoId }, include: { alocacoes: true } });
    if (!tratamento || tratamento.pedidoId !== id || tratamento.tipo !== "DEVOLUCAO" || tratamento.status !== "FALHA") throw new ErroPedidoVenda("Solicitação não pode ser retomada.");
    const fontes = await origensElegiveis(tx, id);
    for (const a of tratamento.alocacoes) {
      const fonte = fontes.find(f => f.tituloId === a.origemTituloId && f.externoId === a.origemPagamentoExternoId);
      if (!fonte || fonte.disponivel.lt(a.valor)) throw new ErroPedidoVenda("Valor já reservado em outro tratamento. Confira antes de retomar.");
    }
    await tx.tratamentoFinanceiroPedido.update({ where: { id: tratamentoId }, data: { status: "SOLICITADA" } });
    await historicoFinanceiro(tx, id, k, h, "DEVOLUCAO_RETOMADA", autor, { tratamentoId, reenvioAutomatico: false });
  });
}

export async function concluirDevolucaoContextual(pedidoId: string, tratamentoId: string, contaId: string, data: string, evidencia: string, operacao: string, sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["consultar", "cancelar", "receber", "condicao"], pedidoId);
    await travarOperacao(tx, chave(operacao));
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id = ${pedidoId} FOR UPDATE`;
    const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, include: { canal: true } });
    if (!pedido.canal?.categoriaDevolucaoId) throw new ErroPedidoVenda("Categoria de devoluções pendente no cadastro do canal. O cancelamento e a solicitação foram preservados.");
    return concluirDevolucaoPedido(pedidoId, tratamentoId, contaId, data, pedido.canal.categoriaDevolucaoId, data, evidencia, operacao, sessao, tx);
  }, { timeout: 30000 });
}

async function criarSolicitacaoDevolucao(tx: Tx, id: string, devolucao: Prisma.Decimal, retencao: Prisma.Decimal, motivo: string, politica: string, comunicacao: string, chaveOperacao: string, resumo: string, autor: {userId:string;nome:string}, reduzVenda: boolean) {
    const fontes = await origensElegiveis(tx, id);
    const total = devolucao.plus(retencao);
    const disponivel = fontes.reduce((s, f) => s.plus(f.disponivel), dinheiro("0"));
    if (total.greaterThan(disponivel)) throw new ErroPedidoVenda("Devolução e retenção excedem o valor pago elegível.");
    let restanteDevolucao = devolucao, restanteRetencao = retencao;
    const alocacoes: { origemTituloId: string; origemPagamentoExternoId: string | null; valor: Prisma.Decimal; devolucao: Prisma.Decimal; retencao: Prisma.Decimal }[] = [];
    for (const fonte of fontes) {
      if (restanteDevolucao.plus(restanteRetencao).isZero()) break;
      const devolver = Prisma.Decimal.min(fonte.disponivel, restanteDevolucao);
      const reter = Prisma.Decimal.min(fonte.disponivel.minus(devolver), restanteRetencao);
      const valor = devolver.plus(reter);
      if (valor.greaterThan(0)) alocacoes.push({ origemTituloId: fonte.tituloId, origemPagamentoExternoId: fonte.externoId, valor, devolucao: devolver, retencao: reter });
      restanteDevolucao = restanteDevolucao.minus(devolver); restanteRetencao = restanteRetencao.minus(reter);
    }
    if (restanteDevolucao.greaterThan(0) || restanteRetencao.greaterThan(0)) throw new ErroPedidoVenda("Pagamentos elegíveis insuficientes.");
    const tratamento = await tx.tratamentoFinanceiroPedido.create({ data: { pedidoId: id, tipo: "DEVOLUCAO", status: "SOLICITADA", valor: devolucao, retido: retencao, reduzVenda, motivo: motivo || null, referenciaPolitica: politica || null, referenciaComunicacao: comunicacao || null, chaveOperacao, hashOperacao: resumo, criadoPorId: autor.userId, alocacoes: { create: alocacoes } } });
    await historicoFinanceiro(tx, id, chaveOperacao, resumo, "DEVOLUCAO_SOLICITADA", autor, { tratamentoId: tratamento.id, devolucao: devolucao.toString(), retencao: retencao.toString(), motivo, politica, comunicacao, alocacoes: alocacoes.map(a => ({ tituloId: a.origemTituloId, externoId: a.origemPagamentoExternoId, valor: a.valor.toString() })) });
    return tratamento;
}

/** Efeito interno do evento CAN confirmado. Não chama adquirente nem presume saída de dinheiro. */
export async function solicitarDevolucaoCancelamentoIfood(tx: Tx, pedidoId: string, autor: { userId: string; nome: string }) {
  const pedido = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId } });
  if (pedido.origem !== "IFOOD" || pedido.status !== "CANCELADO") throw new ErroPedidoVenda("Cancelamento externo ainda não confirmado.");
  const k = `ifood-cancelamento:${pedidoId}`;
  const anterior = await tx.tratamentoFinanceiroPedido.findUnique({ where: { chaveOperacao: k } });
  if (anterior) return anterior;
  await bloquearTitulos(tx, pedidoId);
  const fontes = await origensElegiveis(tx, pedidoId);
  const valor = fontes.reduce((s, f) => s.plus(f.disponivel), dinheiro("0"));
  if (!valor.gt(0)) return null;
  const motivo = "Cancelamento confirmado pelo iFood; ajuste de valores recebidos no HUB depende de comprovação. Reembolso ao consumidor é acompanhado pelo iFood.";
  return criarSolicitacaoDevolucao(tx, pedidoId, valor, dinheiro("0"), motivo, "", "", k, hash({tipo:"IFOOD_CANCELAMENTO",pedidoId,valor:valor.toFixed(2)}), autor, false);
}
export async function obterFinanceiroPedido(pedidoId: string) { return prisma.$transaction(tx => resumoFinanceiro(tx, identificador(pedidoId))); }
