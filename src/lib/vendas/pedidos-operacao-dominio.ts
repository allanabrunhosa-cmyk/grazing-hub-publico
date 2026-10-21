export const estadosOperacao: Record<string, string> = { PENDENTE: "Aguardando preparação", EM_PREPARO: "Em preparação", PRONTO: "Pronto para expedição", EM_ENTREGA: "Saiu para entrega", ENTREGUE: "Entregue", INTERROMPIDO: "Interrompido" };
export type ComandoOperacao = { tipo: "INICIAR" | "PREPARAR" | "EXPEDIR" | "PRONTO" | "SAIR" | "ENTREGAR" | "OCORRENCIA" | "RESOLVER" | "REAGENDAR" | "AVANCAR" | "VOLTAR" | "NOVA_TENTATIVA"; itemId?: string; quantidade?: string; motivo?: string; ocorrenciaId?: string; data?: string; janela?: string; confirmarIntegralmente?: boolean; conferenciaMaterial?: boolean; natureza?: "DEVOLUCAO" | "FALHA_ENTREGA"; recuperavel?: string; perda?: string };
export type DestinoFisicoPedido = { origem: "CANCELAMENTO" | "DEVOLUCAO" | "REVISAO"; itemId: string; reservaId?: string; produto: string; unidade: string; quantidade: string; materiais?: { reservaId: string; quantidade: string; acumulada: string }[] };
export type DirecaoStatusGestor = "avancar" | "voltar";
export type ConfiguracaoMovimentacaoEstoqueGestor = { movimentarEstoque: boolean; versao: number; podeAlterar: boolean; localMovimentarEstoqueId: string | null; locais: { id: string; nome: string }[] };
/** A ausência de configuração conserva o Gestor como controle de etapas. */
export function politicaMovimentacaoEstoqueGestor(valor: unknown) {
  const c = valor && typeof valor === "object" && !Array.isArray(valor) ? valor as { movimentarEstoque?: unknown; versaoMovimentarEstoque?: unknown; localMovimentarEstoqueId?: unknown } : null;
  return { movimentarEstoque: c?.movimentarEstoque === true, localMovimentarEstoqueId: typeof c?.localMovimentarEstoqueId === "string" && /^[a-zA-Z0-9_-]{1,180}$/.test(c.localMovimentarEstoqueId) ? c.localMovimentarEstoqueId : null, versao: typeof c?.versaoMovimentarEstoque === "number" && Number.isSafeInteger(c.versaoMovimentarEstoque) && c.versaoMovimentarEstoque >= 0 ? c.versaoMovimentarEstoque : 0 };
}
export type EtapaGestor = "novo" | "preparo" | "pronto" | "rota" | "entregues";
export const estadosEtapasGestor: Record<EtapaGestor, string[]> = { novo: ["PENDENTE"], preparo: ["EM_PREPARO"], pronto: ["PRONTO"], rota: ["EM_ENTREGA"], entregues: ["ENTREGUE"] };
/** Classificação de leitura: receber um pedido externo não confirma nem inicia produção. */
export function etapaGestorPedido(status: string, operacional: string): EtapaGestor | undefined {
  if (status === "RECEBIDO_EXTERNO") return "novo";
  return status === "CONFIRMADO" ? (Object.entries(estadosEtapasGestor).find(([, estados]) => estados.includes(operacional))?.[0] as EtapaGestor | undefined) : undefined;
}

/** O gesto compacto reutiliza as mesmas transições e os seus pré-requisitos. */
export function comandoAvancoGestor(estado: string, atendimento?: string | null): "INICIAR" | "PRONTO" | "SAIR" | "ENTREGAR" | null {
  if (estado === "PRONTO" && atendimento === "RETIRADA") return "ENTREGAR";
  const comandos: Record<string, "INICIAR" | "PRONTO" | "SAIR" | "ENTREGAR"> = { PENDENTE: "INICIAR", EM_PREPARO: "PRONTO", PRONTO: "SAIR", EM_ENTREGA: "ENTREGAR" };
  return comandos[estado] ?? null;
}

/** O retorno corrige a etapa, sem apagar a execução ou voltar a um pedido não iniciado. */
export function estadoAnteriorGestor(estado: string, atendimento?: string | null): "EM_PREPARO" | "PRONTO" | "EM_ENTREGA" | null {
  if (estado === "ENTREGUE" && atendimento === "RETIRADA") return "PRONTO";
  const anteriores: Record<string, "EM_PREPARO" | "PRONTO" | "EM_ENTREGA"> = { PRONTO: "EM_PREPARO", EM_ENTREGA: "PRONTO", ENTREGUE: "EM_ENTREGA" };
  return anteriores[estado] ?? null;
}
export type FatoOperacao = { id: string; tipo: string; motivo: string | null; usuarioNome: string; createdAt: string; depois: { comando?: ComandoOperacao; solicitacao?: ComandoOperacao; novaTentativa?: boolean; destinoFisico?: DestinoFisicoPedido; resolucaoDestino?: { recuperavel: string; perda: string; destino: string } } };
export function pendenciasOperacao(fatos: FatoOperacao[]) {
  const resolvidas = new Set(fatos.filter(f => f.tipo === "OPERACAO_RESOLVER").map(f => f.depois.comando?.ocorrenciaId));
  return fatos.filter(f => f.tipo === "OPERACAO_OCORRENCIA" && !resolvidas.has(f.id));
}
