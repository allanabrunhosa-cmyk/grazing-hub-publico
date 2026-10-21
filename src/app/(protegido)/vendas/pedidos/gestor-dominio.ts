import { etapaGestorPedido } from "@/lib/vendas/pedidos-operacao-dominio";

export type ModoGestor = "quadros" | "calendario" | "lista";
export type GestorFiltros = { busca?: string; clienteId?: string; canalId?: string; produtoId?: string; status?: string; de?: string; ate?: string; pagina?: string; baseData?: string; operacional?: string; etapaGestor?: string; modo?: string; data?: string; visao?: string };
export const colunasGestor = [
  { id: "novo", nome: "Novo pedido", estados: ["PENDENTE"], vazio: "Aqui ficam os novos pedidos aguardando o próximo passo." },
  { id: "preparo", nome: "Em preparo", estados: ["EM_PREPARO"], vazio: "Aqui ficam os pedidos em preparo." },
  { id: "pronto", nome: "Pronto para entrega / retirada", estados: ["PRONTO"], vazio: "Aqui ficam os pedidos prontos para entrega ou retirada." },
  { id: "rota", nome: "A caminho", estados: ["EM_ENTREGA"], vazio: "Aqui ficam os pedidos a caminho do cliente." },
  { id: "entregues", nome: "Entregue", estados: ["ENTREGUE"], vazio: "Aqui ficam os pedidos entregues." },
] as const;
export function modoGestor(valor?: string): ModoGestor { return valor === "calendario" || valor === "lista" ? valor : "quadros"; }
export function etapaDoPedido(status: string, operacional: string) {
  const etapa = etapaGestorPedido(status, operacional);
  return colunasGestor.find(c => c.id === etapa);
}
export function nomeStatusGestor(status: string, operacional: string) {
  return etapaDoPedido(status, operacional)?.nome ?? ({ RECEBIDO_EXTERNO: "Aguardando confirmação iFood", RASCUNHO: "Em orçamento", DECLINADO: "Declinado", ESTORNADO: "Estornado", CANCELADO: "Cancelado", HISTORICO: "Histórico", HISTORICO_REVERTIDO: "Histórico revertido" } as Record<string, string>)[status] ?? "Interrompido";
}
export function instantePedidoGestor(pedido: { criadoEm: string; criadoEmExterno?: string }) { return pedido.criadoEmExterno ?? pedido.criadoEm; }
export function dataPedidoGestor(instante: string, fuso: string) {
  const data = new Date(instante);
  if (!Number.isFinite(data.getTime())) return "—";
  try { return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, day: "2-digit", month: "2-digit", year: "numeric" }).format(data); } catch { return "—"; }
}
export function horaPedidoGestor(instante: string, fuso: string) {
  const data = new Date(instante);
  if (!Number.isFinite(data.getTime())) return "—";
  try { return new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(data); } catch { return "—"; }
}
export function tempoPedidoGestor(instante: string, agora = Date.now()) {
  const inicio = new Date(instante).getTime();
  if (!Number.isFinite(inicio) || !Number.isFinite(agora)) return "—";
  const minutos = Math.max(0, Math.floor((agora - inicio) / 60000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60), restante = minutos % 60;
  if (horas < 24) return `há ${horas} h${restante ? ` ${restante} min` : ""}`;
  const dias = Math.floor(horas / 24), horasRestantes = horas % 24;
  return `há ${dias} d${horasRestantes ? ` ${horasRestantes} h` : ""}`;
}
export function rotaGestor(filtros: GestorFiltros, alteracoes: GestorFiltros = {}) {
  const permitidos = ["busca", "clienteId", "canalId", "produtoId", "status", "de", "ate", "pagina", "baseData", "operacional", "etapaGestor", "modo", "data", "visao"];
  const parametros = new URLSearchParams();
  const valores = { ...filtros, ...alteracoes };
  for (const chave of permitidos) { const valor = valores[chave as keyof GestorFiltros]; if (valor) parametros.set(chave, valor); }
  return `/vendas/pedidos${parametros.size ? `?${parametros}` : ""}`;
}
