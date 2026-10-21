import type { StatusExibicaoPedido } from "./types";

// A mesma paleta sólida no calendário, na lista, na legenda e nos detalhes.
export const coresStatusPedido: Record<StatusExibicaoPedido, string> = {
  PENDENTE: "bg-slate-600 text-white border-slate-600",
  ATRASADO: "bg-amber-400 text-slate-950 border-amber-400",
  RECEBIDO: "bg-emerald-700 text-white border-emerald-700",
  RECEBIDO_COM_DIVERGENCIA: "bg-blue-700 text-white border-blue-700",
  CANCELADO: "bg-slate-700 text-white border-slate-700",
};
