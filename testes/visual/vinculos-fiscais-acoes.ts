export async function salvarFiscalVendaAction(_id: string, versao: number) {
  return new URLSearchParams(location.search).has("erro") ? { erro: "Conflito simulado: reabra para conferir." } : { ok: true as const, versao: versao + 1 };
}
