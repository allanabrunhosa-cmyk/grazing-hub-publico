import type { Acao } from "@/lib/permissoes/catalogo";
import { FUNCOES_NEGOCIO_MCP } from "./registro-negocio";

export const FUNCOES_FINANCEIRAS_MCP = [
  { nome: "financeiro_dre", escopo: "financeiro:dre:ler", titulo: "DRE", recurso: "financeiro.dre", detalhada: false, descricao: "Resultado consolidado por período, em caixa ou competência, com os cálculos da DRE do HUB." },
  { nome: "financeiro_fluxo_caixa", escopo: "financeiro:fluxo:ler", titulo: "Fluxo de caixa", recurso: "financeiro.fluxo", detalhada: false, descricao: "Fluxo diário realizado e previsto, incluindo as projeções de faturas do HUB." },
  { nome: "financeiro_saldos", escopo: "financeiro:saldos:ler", titulo: "Saldos", recurso: "financeiro.bancario", detalhada: false, descricao: "Saldo consolidado das contas autorizadas em uma data; não inclui dados bancários." },
  { nome: "financeiro_lancamentos", escopo: "financeiro:lancamentos:ler", titulo: "Lançamentos", recurso: "financeiro.movimentacoes", detalhada: true, descricao: "Registros financeiros paginados ou um registro pelo identificador interno, sem descrições livres ou dados pessoais." },
  { nome: "financeiro_contas", escopo: "financeiro:contas:ler", titulo: "Contas a pagar e receber", recurso: "financeiro.baixas", detalhada: true, descricao: "Lançamentos a pagar/receber por vencimento e situação, sem executar baixas." },
  { nome: "financeiro_plano_contas", escopo: "financeiro:plano:ler", titulo: "Plano de contas", recurso: "financeiro.plano", detalhada: true, descricao: "Categorias financeiras e sua hierarquia, limitadas aos registros permitidos quando houver restrição." },
] as const;

export type NomeFinanceiroMcp = typeof FUNCOES_FINANCEIRAS_MCP[number]["nome"];
export const FUNCOES_MCP = [
  ...FUNCOES_FINANCEIRAS_MCP.map(f => ({ ...f, modulo: "Financeiro", acao: "visualizar" as Acao, escrita: false, confirmacao: false, destrutiva: false, externa: false })),
  ...FUNCOES_NEGOCIO_MCP,
];

export type EscopoMcp = typeof FUNCOES_MCP[number]["escopo"];
export type NomeFuncaoMcp = typeof FUNCOES_MCP[number]["nome"];
export function recursosDaFuncaoMcp(funcao: typeof FUNCOES_MCP[number]): string[] {
  return funcao.nome === "financeiro_contas" ? [funcao.recurso, "financeiro.movimentacoes"] : [funcao.recurso];
}
// Metadados dos mesmos controles centrais exigidos pelos serviços compartilhados.
// Não concede acesso nem substitui a autorização executada novamente pelo serviço.
export function exigenciasDaFuncaoMcp(f: typeof FUNCOES_MCP[number]): { recurso: string; acao: Acao }[] {
  const requisitos = recursosDaFuncaoMcp(f).filter(Boolean).map(recurso => ({ recurso, acao: f.acao }));
  const mais = (recurso: string, acao: Acao = "visualizar") => requisitos.push({ recurso, acao });
  if (f.nome === "insumos_custos") mais("insumos");
  if (f.nome === "produtos_custos") mais("vendas.produtos");
  if (f.nome === "pedidos_avancar_etapa") mais("vendas.pedidos");
  if (f.nome === "insumos_importar") { mais("insumos", "editar"); mais("financeiro.custos"); }
  if (f.nome === "fornecedores_importar") mais("fornecedores", "editar");
  if (f.nome === "compras_receber" || f.nome === "compras_reabrir") mais("compras");
  if (["financeiro_baixar_lancamento", "financeiro_estornar_baixa"].includes(f.nome)) mais("financeiro.movimentacoes");
  if (["pedidos_programacao", "pedidos_agenda"].includes(f.nome) || f.modulo === "Financeiro de pedidos" || f.modulo === "Custos de entrega" || f.modulo === "Estoque de pedidos") mais("vendas.pedidos");
  if (f.modulo === "Estoque de pedidos") mais("inventario", "editar");
  if (["faturas_correspondencias", "faturas_vincular", "faturas_criar_despesa", "faturas_concluir_despesas"].includes(f.nome)) mais("financeiro.movimentacoes");
  if (f.nome === "faturas_criar_despesa") mais("financeiro.movimentacoes", "adicionar");
  if (f.nome === "faturas_concluir_despesas") mais("financeiro.baixas", "editar");
  if (["faturas_selecionar_pagamento", "faturas_pagar", "faturas_reverter_pagamento"].includes(f.nome)) mais("financeiro.faturas");
  if (["pedidos_solicitar_devolucao", "pedidos_devolucao_processando", "pedidos_devolucao_falhou", "pedidos_devolucao_cancelar", "pedidos_retomar_devolucao", "pedidos_concluir_devolucao_contextual", "pedidos_conceder_credito", "pedidos_liberar_credito", "clientes_ajustar_credito"].includes(f.nome)) mais("financeiro.baixas", "editar");
  if (["pedidos_concluir_devolucao", "pedidos_conceder_credito", "pedidos_liberar_credito", "clientes_ajustar_credito"].includes(f.nome)) mais("vendas.pedidos.cancelar", "editar");
  if (["pedidos_corrigir_recebimento", "pedidos_registrar_repasse_cartao", "pedidos_concluir_devolucao", "pedidos_concluir_devolucao_contextual", "pedidos_conceder_credito", "pedidos_liberar_credito", "clientes_ajustar_credito"].includes(f.nome)) mais("financeiro.movimentacoes", "editar");
  if (f.nome === "pedidos_ajustar_vencimento") { mais("vendas.pedidos"); mais("vendas.pedidos.revisar", "editar"); }
  if (f.nome === "faturas_corrigir_cartao") mais("financeiro.movimentacoes", "editar");
  return requisitos;
}
export const ESCOPOS_MCP = FUNCOES_MCP.map(f => f.escopo);
export const ESCOPOS_FINANCEIROS_V1 = FUNCOES_FINANCEIRAS_MCP.map(f => f.escopo);
// Apenas para interpretar histórico v1. Não é perfil ativo nem inclui módulos v2.
export const ESCOPOS_GERENCIAIS = FUNCOES_FINANCEIRAS_MCP.filter(f => !f.detalhada).map(f => f.escopo);
export const LIMITES_MCP = { entradaBytes: 16_384, saidaBytes: 512_000, registros: 5_000, pagina: 100, dias: 366, chamadasMinuto: 60, retencaoDias: 90, timeoutMs: 10_000 } as const;
