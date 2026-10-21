export const ROTULO_ACOMPANHAMENTO_IFOOD = "Acompanhamento — Takeat";
export const BLOQUEIO_ACOMPANHAMENTO_IFOOD = "Acompanhamento — Takeat: comandos e efeitos operacionais do HUB estão bloqueados, inclusive para administrador.";
export function pedidoEmAcompanhamento(p: { acompanhamento?: boolean; loja?: { modoOperacao?: string } } | null | undefined) {
  return p?.acompanhamento === true || p?.loja?.modoOperacao === "ACOMPANHAMENTO";
}
export type LojaRecepcaoIfood = {
  ambiente: string; merchantId: string; modoOperacao?: string; pilotoAte?: Date | null;
  principalClientId?: string | null; pilotoEnquadramentoReferencia?: string | null; pilotoPresencaReferencia?: string | null;
  integracao: { clientId: string };
};
/** Janela é uma proteção interna, não garantia da disponibilidade do sistema principal. */
export function pilotoPreparado(l: LojaRecepcaoIfood, agora = new Date()) {
  return l.modoOperacao === "ACOMPANHAMENTO" && !!l.pilotoAte && l.pilotoAte > agora &&
    !!l.principalClientId && l.principalClientId.toLowerCase() !== l.integracao.clientId.toLowerCase() &&
    !!l.pilotoEnquadramentoReferencia && !!l.pilotoPresencaReferencia;
}
