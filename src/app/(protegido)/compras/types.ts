import { unidadeMedidaAbreviada } from "@/lib/labels";
import type { StatusPedidoCompra, TipoDivergencia, TipoRecebimento, UnidadeMedida } from "@/generated/prisma/client";

export type FornecedorOption = { id: string; nome: string };

export type InsumoComFornecedorOption = {
  conversoes?: import("@/lib/insumos/conversoes").ConversaoInsumo[];
  id: string;
  nome: string;
  especificacao?: string | null;
  unidade: UnidadeMedida;
  custoMedio?: number;
  fornecedorPrincipalId: string | null;
  // todos os fornecedores homologados (inclui o principal) — usado pro combobox
  // de insumo em Compras liberar também o fornecedor alternativo, não só o principal.
  fornecedorIds: string[];
};

export type PedidoItemRow = {
  fatorConversao?: number | null;
  unidadePrincipal?: UnidadeMedida | null;
  id: string;
  insumoId: string | null;
  insumoNome: string;
  insumoEspecificacao?: string | null;
  // unidade em que este item foi comprado — pode diferir da unidade de estoque do insumo
  unidadeCompra: UnidadeMedida;
  quantidade: number;
  precoUnitario: number | null;
  precoTotal: number | null;
};

export type DivergenciaRow = { tipo: TipoDivergencia; descricao: string | null };

export type RecebimentoItemRow = {
  fatorConversao?: number | null;
  unidadePrincipal?: UnidadeMedida | null;
  id: string;
  pedidoItemId: string;
  insumoNome: string;
  insumoEspecificacao?: string | null;
  unidadeCompra: UnidadeMedida;
  quantidadeOrdenada: number;
  quantidadeRecebida: number;
  lote: string | null;
  validade: string | null;
  qualidadeOk: boolean;
  divergencias: DivergenciaRow[];
};

export type RecebimentoRow = {
  id: string;
  reabertoEm?: string | null;
  dataRecebimento: string;
  tipo: TipoRecebimento;
  responsavelNome: string;
  itens: RecebimentoItemRow[];
};

export type PedidoRow = {
  id: string;
  numero: number;
  fornecedorId: string | null;
  fornecedorAvulso?: string | null;
  usoConsumo?: boolean;
  excluidoEm?: string | null;
  historico?: { id: string; acao?: string; statusAnterior: StatusPedidoCompra; statusNovo: StatusPedidoCompra; motivo: string; usuarioNome: string; criadoEm: string }[];
  fornecedorNome: string;
  dataPedido: string;
  previsaoEntrega: string | null;
  status: StatusPedidoCompra;
  observacoes: string | null;
  itens: PedidoItemRow[];
  recebimentos: RecebimentoRow[];
  temDivergencia: boolean;
};

export type StatusExibicaoPedido = "PENDENTE" | "ATRASADO" | "RECEBIDO" | "RECEBIDO_COM_DIVERGENCIA" | "CANCELADO";

export const statusExibicaoLabels: Record<StatusExibicaoPedido, string> = {
  PENDENTE: "Pendente",
  ATRASADO: "Atrasado",
  RECEBIDO: "Recebido",
  RECEBIDO_COM_DIVERGENCIA: "Recebido c/ divergência",
  CANCELADO: "Cancelado",
};

// "Atrasado" e "c/ divergência" nunca são guardados — são calculados a partir do status
// real + previsão de entrega + histórico de divergências, igual à categoriaDaNota() do
// Manifesto de Notas.
export function statusExibicaoPedido(
  pedido: { status: StatusPedidoCompra; previsaoEntrega: string | null; temDivergencia: boolean },
  hojeISO: string
): StatusExibicaoPedido {
  if (pedido.status === "CANCELADO") return "CANCELADO";
  if (pedido.status === "RECEBIDO_TOTAL" || pedido.status === "RECEBIDO_PARCIAL") {
    return pedido.temDivergencia ? "RECEBIDO_COM_DIVERGENCIA" : "RECEBIDO";
  }
  return pedido.previsaoEntrega && pedido.previsaoEntrega.slice(0, 10) < hojeISO ? "ATRASADO" : "PENDENTE";
}

export function formatarNumeroPedido(numero: number): string {
  return `#${String(numero).padStart(4, "0")}`;
}

export function resumoItensPedido(itens: { insumoNome: string; insumoEspecificacao?: string | null; quantidade: number; unidadeCompra: UnidadeMedida }[]): string {
  const relevantes = itens.filter((i) => i.quantidade > 0);
  if (relevantes.length === 0) return "—";
  const primeiros = relevantes
    .slice(0, 2)
    .map((i) => `${i.insumoNome}${i.insumoEspecificacao ? ` — ${i.insumoEspecificacao}` : ""} ${i.quantidade}${unidadeMedidaAbreviada[i.unidadeCompra]}`)
    .join(", ");
  const resto = relevantes.length > 2 ? ` (+${relevantes.length - 2})` : "";
  return primeiros + resto;
}
