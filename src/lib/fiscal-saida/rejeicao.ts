/** Chave gerada para XML rejeitado não é um protocolo de autorização.
 * Outra revisão usa outra identidade; nunca reenvia a solicitação rejeitada. */
export function rejeicaoFiscalCorrigivel(d: { status: string; protocolo?: string | null; protocoloCancelamento?: string | null; cancelamentoPendente?: boolean } | null | undefined): boolean {
  return d?.status === "REJEITADO" && !d.protocolo && !d.protocoloCancelamento && !d.cancelamentoPendente;
}
