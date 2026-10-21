import { Prisma } from "@/generated/prisma/client";

export class ErroIfood extends Error {}
export const uuid = (v: unknown): string => {
  if (typeof v !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v)) throw new ErroIfood("Identificador iFood inválido.");
  return v.toLowerCase();
};
export function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroIfood("Resposta iFood fora do contrato.");
  return v as Record<string, unknown>;
}
export const texto = (v: unknown, max = 1000) => typeof v === "string" ? v.slice(0, max) : "";
export function instante(v: unknown): Date {
  if (typeof v !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) throw new ErroIfood("Horário iFood inválido.");
  return new Date(v);
}
export function moeda(v: unknown) {
  if ((typeof v !== "string" && typeof v !== "number") || !/^\d{1,12}(\.\d{1,2})?$/.test(String(v))) throw new ErroIfood("Valor monetário iFood inválido.");
  return new Prisma.Decimal(String(v));
}
export type EventoRemoto = { id: string; orderId: string | null; merchantId: string; code: string; fullCode: string; createdAt: Date; metadata: Record<string, unknown> };
export function lerEvento(v: unknown, merchant: string): EventoRemoto {
  const e = objeto(v);
  if (e.merchantId && uuid(e.merchantId) !== merchant) throw new ErroIfood("Evento fora da loja autorizada.");
  // A referência v1.0 não exige merchantId no evento. Polling sempre filtra UMA loja.
  return { id: uuid(e.id), orderId: e.orderId == null ? null : uuid(e.orderId), merchantId: merchant, code: texto(e.code, 80), fullCode: texto(e.fullCode, 100), createdAt: instante(e.createdAt), metadata: e.metadata ? objeto(e.metadata) : {} };
}
export const ESTADOS = { PLC: "PLACED", CFM: "CONFIRMED", PRS: "PREPARATION_STARTED", RTP: "READY_TO_PICKUP", DSP: "DISPATCHED", CON: "CONCLUDED", CAN: "CANCELLED" } as const;
const ordem = ["PLACED", "CONFIRMED", "PREPARATION_STARTED", "READY_TO_PICKUP", "DISPATCHED", "CONCLUDED"];
export function proximoEstado(atual: string, evento: Pick<EventoRemoto, "code" | "fullCode" | "createdAt">, ultimo: Date | null) {
  const estado = ESTADOS[evento.code as keyof typeof ESTADOS];
  if (!estado || estado !== evento.fullCode) return null;
  if (atual === "CANCELLED" || (atual === "CONCLUDED" && estado !== "CANCELLED")) return null;
  if (ultimo && evento.createdAt < ultimo && estado !== "CANCELLED") return null;
  if (estado !== "CANCELLED" && ordem.indexOf(estado) <= ordem.indexOf(atual)) return null;
  return estado;
}
export type AcaoIfoodNome = "confirm" | "startPreparation" | "readyToPickup" | "dispatch" | "requestCancellation" | "verifyDeliveryCode" | "acceptDispute" | "rejectDispute" | "alternativeDispute";
export type ContextoAcao = { estado: string; modalidade: string; entregaPor: string | null; inicioPreparo: Date | null; pendente: boolean; autorizada: boolean; disputaId?: string | null; disputaAte?: Date | null; disputaCompativel?: boolean; disputaAlternativas?: boolean; revisaoPendente?: boolean; confirmarAte?: Date | null };
export function acoesPermitidas(c: ContextoAcao, agora = new Date()): AcaoIfoodNome[] {
  if (!c.autorizada || c.pendente) return [];
  if (c.disputaId && c.disputaAte && c.disputaAte > agora) return c.disputaCompativel ? ["acceptDispute", "rejectDispute", ...(c.disputaAlternativas ? ["alternativeDispute" as const] : [])] : [];
  if (c.revisaoPendente) return [];
  if (!ordem.includes(c.estado) || c.estado === "CONCLUDED") return [];
  const a: AcaoIfoodNome[] = ["requestCancellation"];
  if (c.estado === "PLACED" && (!c.confirmarAte || c.confirmarAte > agora)) a.unshift("confirm");
  if (c.estado === "CONFIRMED" && (!c.inicioPreparo || c.inicioPreparo <= agora)) a.unshift("startPreparation");
  if (["CONFIRMED", "PREPARATION_STARTED"].includes(c.estado) && (!c.inicioPreparo || c.inicioPreparo <= agora)) a.unshift("readyToPickup");
  if (c.estado === "READY_TO_PICKUP" && c.modalidade === "DELIVERY" && c.entregaPor === "MERCHANT") a.unshift("dispatch");
  if (c.estado === "DISPATCHED" && c.modalidade === "DELIVERY" && c.entregaPor === "MERCHANT") a.unshift("verifyDeliveryCode");
  return a;
}
export function estadoInterno(estado: string) {
  return ({ PLACED: "PENDENTE", CONFIRMED: "PENDENTE", PREPARATION_STARTED: "EM_PREPARO", READY_TO_PICKUP: "PRONTO", DISPATCHED: "EM_ENTREGA", CONCLUDED: "ENTREGUE", CANCELLED: "INTERROMPIDO" } as Record<string, string>)[estado];
}
export const eventoDaAcao: Record<AcaoIfoodNome, string> = { confirm: "CONFIRMED", startPreparation: "PREPARATION_STARTED", readyToPickup: "READY_TO_PICKUP", dispatch: "DISPATCHED", requestCancellation: "CANCELLED", verifyDeliveryCode: "CONCLUDED", acceptDispute: "HANDSHAKE_SETTLEMENT", rejectDispute: "HANDSHAKE_SETTLEMENT", alternativeDispute: "HANDSHAKE_SETTLEMENT" };
