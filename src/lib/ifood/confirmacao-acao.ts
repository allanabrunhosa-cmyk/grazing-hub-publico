import { eventoDaAcao, objeto, type AcaoIfoodNome } from "./dominio";

/** Apenas evento oficial correlacionado comprova resultado. GET details não é status. */
export function confirmacaoAcaoIfood(acao: string, corpo: unknown, enviadaEm: Date | null, evento: { codigoCompleto: string; ocorridoEm: Date; metadata: unknown }) {
  if (!enviadaEm || evento.ocorridoEm < enviadaEm || eventoDaAcao[acao as AcaoIfoodNome] !== evento.codigoCompleto) return null;
  if (evento.codigoCompleto !== "HANDSHAKE_SETTLEMENT") return "CONFIRMADA";
  const m = objeto(evento.metadata), c = corpo ? objeto(corpo) : {};
  if (m.disputeId !== c.disputeId || !["ACCEPTED", "REJECTED", "EXPIRED", "ALTERNATIVE_REPLIED"].includes(String(m.status))) return null;
  if (acao === "alternativeDispute" && m.status === "ALTERNATIVE_REPLIED") {
    const selecionada = m.selectedDisputeAlternative ? objeto(m.selectedDisputeAlternative) : {};
    if (selecionada.id !== c.alternativaId || selecionada.type !== objeto(c.payload).type) return null;
  }
  const esperado = acao === "acceptDispute" ? "ACCEPTED" : acao === "rejectDispute" ? "REJECTED" : "ALTERNATIVE_REPLIED";
  return m.status === esperado ? "CONFIRMADA" : "RECUSADA";
}
