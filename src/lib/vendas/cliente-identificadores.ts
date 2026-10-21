/** Caixa e espaços não criam outra identidade. Não altera pontos ou sufixos do provedor. */
export function normalizarEmailCliente(valor: string | null | undefined): string | null {
  return valor?.trim().toLowerCase() || null;
}

/** Identificadores reservados localizam a raiz, sem substituir seu titular. */
export function identificadoresAlternativosCliente(origens: readonly { email?: string | null; tipo?: string; documento?: string | null; enderecos?: unknown }[]) {
  const emails = new Set<string>(), documentos = new Set<string>();
  for (const origem of origens) {
    const email = normalizarEmailCliente(origem.email);
    if (email) emails.add(email);
    const primeiro = Array.isArray(origem.enderecos) ? origem.enderecos[0] : null;
    const principal = primeiro && typeof primeiro === "object" && !Array.isArray(primeiro) ? primeiro as Record<string, unknown> : null;
    const legado = principal?.tipo === origem.tipo && typeof principal?.documento === "string" ? principal.documento : "";
    const documento = (origem.documento || legado).replace(/\D/g, "");
    if (documento) documentos.add(documento);
  }
  return { emailsAlternativos: [...emails], documentosAlternativos: [...documentos] };
}
