import "server-only";
import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import * as p from "@/lib/vendas/pedidos";
import { executarFisicoPedido } from "@/lib/vendas/pedidos-fisico";
import { periodoCalendario } from "@/lib/vendas/pedidos-agenda-dominio";
import * as custos from "@/lib/vendas/entregas-custos";
import type { ComandoOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import type { AdaptadorMcp } from "./negocio";
import type { NomePedidosMcp } from "./registro-pedidos";
import { ErroMcp } from "./politica";
const id = (d: Record<string, unknown>) => (d.pedidoId ?? d.id) as string;
const n = (d: Record<string, unknown>, k: string) => d[k] as string;
const v = (d: Record<string, unknown>) => d.versao as number;
const resumoSeguro = (resultado: unknown): unknown => {
  if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) return resultado;
  const campos = ["id", "numero", "versao", "status", "statusOperacional", "tipo", "valor", "retido", "concluidoEm", "recebido", "entradaLiquida", "creditoAplicado", "creditoRestaurado", "creditoRestauravel", "capturado", "repassado", "saldo", "saldoCliente", "elegivel", "origemId", "tratamentoId", "movimentoId"];
  const r = resultado as Record<string, unknown>;
  return { ...Object.fromEntries(campos.filter(k => k in r).map(k => [k, r[k]])), ...(Array.isArray(r.titulos) ? { titulos: r.titulos.map(x => { const t = x as Record<string, unknown>; return { id: t.id, revisao: t.revisao, valor: t.valor, status: t.status, vencimento: t.vencimento }; }) } : {}), ...(Array.isArray(r.externos) ? { externos: r.externos.map(x => { const t = x as Record<string, unknown>; return { id: t.id, tituloId: t.tituloId, tipo: t.tipo, status: t.status, valorBruto: t.valorBruto }; }) } : {}), ...(Array.isArray(r.tratamentos) ? { tratamentos: r.tratamentos.map(x => { const t = x as Record<string, unknown>; return { id: t.id, tipo: t.tipo, status: t.status, valor: t.valor }; }) } : {}) };
};
const operacional = (tipo: ComandoOperacao["tipo"], campos: string[] = [], conferencia = false): AdaptadorMcp => async (d, a) => resumoSeguro(await p.executarOperacaoInterfacePedido(id(d), v(d), { tipo, ...Object.fromEntries(campos.map(k => [k, d[k]])), ...(conferencia ? { conferenciaMaterial: true } : {}) }, a.chave, a.sessao));
const financeiro = (operacao: AdaptadorMcp): AdaptadorMcp => async (d, a) => { if (a.acesso.restricoes.contas !== null || a.acesso.restricoes.lancamentos !== null) throw new ErroMcp("insufficient_scope", 403, "Esta operação abrange o financeiro integral de um pedido e não está disponível em conexão com restrições de títulos ou contas."); return resumoSeguro(await operacao(d, a)); };
const fisico = (tipo: "CONSUMIR" | "EXPEDIR_REVENDA" | "LIBERAR" | "RETORNAR" | "PERDA"): AdaptadorMcp => async (d, a) => { await exigirPermissao("inventario", "editar"); const r = await executarFisicoPedido(id(d), v(d), { tipo, reservaId: n(d, "reservaId"), quantidade: n(d, "quantidade"), motivo: n(d, "motivo") }, a.chave, a.sessao); return resumoSeguro(r); };
export const ADAPTADORES_PEDIDOS: Record<NomePedidosMcp, AdaptadorMcp> = {
  pedidos_agenda: async d => { const periodo = periodoCalendario(n(d, "data"), n(d, "visao")); const r = await p.listarPedidos({ baseData: "entrega", de: periodo.inicio, ate: periodo.fim, status: "CONFIRMADO", pagina: d.pagina as number }); return { periodo, pagina: r.pagina, paginas: r.paginas, total: r.quantidadeTotal, pedidos: r.pedidos.map(pedido => ({ acompanhamentoIfood: pedido.acompanhamentoIfood, modoOperacao: pedido.acompanhamentoIfood ? "Acompanhamento — Takeat" : "Operação", id: pedido.id, numero: pedido.numero, versao: pedido.versao, atendimento: pedido.atendimento, operacional: pedido.operacional, previsaoData: pedido.previsaoData, previsaoJanela: pedido.previsaoJanela, fusoHorario: pedido.fusoHorario })) }; },
  pedidos_programacao: async d => { await exigirPermissao("vendas.pedidos", "visualizar"); const r = await p.listarPedidos({ baseData: "entrega", de: n(d, "de"), ate: n(d, "ate"), status: "CONFIRMADO", pagina: d.pagina as number }); const ids = r.pedidos.map(p => p.id); const itens = await prisma.itemPedidoVenda.findMany({ where: { pedidoId: { in: ids }, vigente: true }, take: 1001, orderBy: [{ pedidoId: "asc" }, { ordem: "asc" }], select: { id: true, pedidoId: true, produtoId: true, quantidade: true, unidadeSnapshot: true } }); if (itens.length > 1000) throw new ErroMcp("volume_excedido", 422, "Reduza o período ou consulte por pedido; programação excede 1.000 itens nesta página."); return { de: d.de, ate: d.ate, pagina: r.pagina, total: r.quantidadeTotal, pedidos: r.pedidos.map(pedido => ({ acompanhamentoIfood: pedido.acompanhamentoIfood, modoOperacao: pedido.acompanhamentoIfood ? "Acompanhamento — Takeat" : "Operação", id: pedido.id, numero: pedido.numero, versao: pedido.versao, operacional: pedido.operacional, previsaoData: pedido.previsaoData, previsaoJanela: pedido.previsaoJanela, fusoHorario: pedido.fusoHorario })), itens, limitacao: "Quantidades comerciais da programação; consultar movimentos/reservas para comprovar materiais e consumo." }; },
  pedidos_iniciar_preparo: operacional("INICIAR"),
  pedidos_preparar_item: operacional("PREPARAR", ["itemId", "quantidade"]),
  pedidos_expedir_item: operacional("EXPEDIR", ["itemId", "quantidade"]),
  pedidos_marcar_pronto: operacional("PRONTO", [], true),
  pedidos_sair_entrega: operacional("SAIR"),
  pedidos_ocorrencia: operacional("OCORRENCIA", ["motivo", "natureza", "itemId", "quantidade"]),
  pedidos_resolver_ocorrencia: operacional("RESOLVER", ["ocorrenciaId", "recuperavel", "perda", "motivo"]),
  pedidos_reagendar: operacional("REAGENDAR", ["data", "janela", "motivo"]),
  pedidos_nova_tentativa: async (d, a) => resumoSeguro(await p.executarOperacaoInterfacePedido(id(d), v(d), { tipo: "NOVA_TENTATIVA", ocorrenciaId: n(d, "ocorrenciaId"), motivo: n(d, "motivo"), confirmarIntegralmente: true, conferenciaMaterial: true }, a.chave, a.sessao)),
  pedidos_avancar_etapa: async (d, a) => resumoSeguro(await p.mudarStatusGestorPedido(id(d), v(d), "avancar", a.chave, a.sessao)),
  pedidos_voltar_etapa: async (d, a) => resumoSeguro(await p.mudarStatusGestorPedido(id(d), v(d), "voltar", a.chave, a.sessao)),
  pedidos_reservar_material: async (d, a) => { await exigirPermissao("inventario", "editar"); return resumoSeguro(await executarFisicoPedido(id(d), v(d), { tipo: "RESERVAR", itemId: n(d, "itemId"), localId: n(d, "localId"), quantidade: n(d, "quantidade") }, a.chave, a.sessao)); },
  pedidos_consumir_material: fisico("CONSUMIR"),
  pedidos_expedir_revenda: fisico("EXPEDIR_REVENDA"),
  pedidos_liberar_material: fisico("LIBERAR"),
  pedidos_retornar_material: fisico("RETORNAR"),
  pedidos_perder_material: fisico("PERDA"),
  pedidos_corrigir_recebimento: financeiro(async (d, a) => p.corrigirRecebimentoPedido(id(d), d.tituloId, d.revisao, d.motivo, a.chave, a.sessao)),
  pedidos_registrar_captura_cartao: financeiro(async (d, a) => p.registrarCapturaCartaoPedido(id(d), d.tituloId, d.referencia, d.evidencia, d.data, d.taxa, d.previsao, a.chave, a.sessao)),
  pedidos_registrar_boleto_emitido: financeiro(async (d, a) => p.registrarEmissaoBoletoPedido(id(d), d.tituloId, d.referencia, d.documento, d.vencimento, d.evidencia, a.chave, a.sessao)),
  pedidos_registrar_boleto_cancelado: financeiro(async (d, a) => p.registrarCancelamentoBoletoPedido(id(d), d.cobrancaId, d.evidencia, a.chave, a.sessao)),
  pedidos_registrar_entrada_tardia_boleto: financeiro(async (d, a) => p.registrarEntradaTardiaBoletoPedido(id(d), d.cobrancaId, d.contaId, d.data, d.evidencia, a.chave, a.sessao)),
  pedidos_registrar_boleto_pago: financeiro(async (d, a) => p.confirmarPagamentoBoletoPedido(id(d), d.cobrancaId, d.contaId, d.data, d.evidencia, a.chave, a.sessao)),
  pedidos_registrar_repasse_cartao: financeiro(async (d, a) => p.registrarRepasseCartaoPedido(id(d), d.pagamentoId, d.bruto, d.taxa, d.contaId, d.data, d.categoriaTaxaId, d.competenciaTaxa, d.evidencia, a.chave, a.sessao)),
  pedidos_solicitar_devolucao: financeiro(async (d, a) => p.solicitarDevolucaoPedido(id(d), d.devolver, d.reter, d.motivo, d.politica, d.comunicacao, a.chave, a.sessao)),
  pedidos_devolucao_processando: financeiro(async (d, a) => p.mudarEstadoDevolucaoPedido(id(d), d.tratamentoId, "PROCESSANDO", d.motivo, a.chave, a.sessao)),
  pedidos_devolucao_falhou: financeiro(async (d, a) => p.mudarEstadoDevolucaoPedido(id(d), d.tratamentoId, "FALHA", d.motivo, a.chave, a.sessao)),
  pedidos_devolucao_cancelar: financeiro(async (d, a) => p.mudarEstadoDevolucaoPedido(id(d), d.tratamentoId, "CANCELADA", d.motivo, a.chave, a.sessao)),
  pedidos_retomar_devolucao: financeiro(async (d, a) => p.retomarDevolucaoPedido(id(d), d.tratamentoId, a.chave, a.sessao)),
  pedidos_concluir_devolucao_contextual: financeiro(async (d, a) => p.concluirDevolucaoContextual(id(d), n(d,"tratamentoId"), n(d,"contaId"), n(d,"data"), n(d,"evidencia"), a.chave, a.sessao)),
  pedidos_concluir_devolucao: financeiro(async (d, a) => p.concluirDevolucaoPedido(id(d), d.tratamentoId, d.contaId, d.data, d.categoriaId, d.competencia, d.evidencia, a.chave, a.sessao)),
  pedidos_conceder_credito: financeiro(async (d, a) => p.concederCreditoPedido(id(d), d.valor, d.escolhaData, d.comunicacao, a.chave, a.sessao)),
  pedidos_liberar_credito: financeiro(async (d, a) => p.liberarCreditoAplicadoPedido(id(d), d.valor, d.motivo, d.comunicacao, a.chave, a.sessao)),
  clientes_ajustar_credito: financeiro(async (d, a) => p.ajustarCreditoCliente(d.clienteId, d.origemId, d.tipo, d.valor, d.motivo, a.chave, a.sessao)),
  pedidos_encerrar_manual: async (d, a) => resumoSeguro(await p.encerrarPedidoManual(id(d), v(d), d.estado as "DECLINADO" | "ESTORNADO", d.motivo, d.referencia, a.chave, a.sessao)),
  pedidos_custo_entrega: async (d, a) => custos.salvarCustoEntrega(id(d), v(d), d.estimado as string | null, d.efetivo as string | null, d.prestadorId as string | null, n(d, "motivo"), a.chave, a.sessao),
  pedidos_vincular_despesa_entrega: financeiro(async (d, a) => custos.vincularDespesaEntrega({ pedidoId: id(d), versao: v(d), lancamentoId: n(d, "lancamentoId"), revisao: n(d, "revisao"), valor: n(d, "valor"), motivo: n(d, "motivo"), chave: a.chave }, a.sessao)),
  pedidos_desvincular_despesa_entrega: financeiro(async (d, a) => custos.desvincularDespesaEntrega(id(d), n(d, "motivo"), a.chave, a.sessao)),
};
