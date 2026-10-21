// A prévia usa apenas dados fictícios e não grava nem consulta estoque real.
export async function registrarPerdaAction() {
  return { ok: true };
}

export async function obterMovimentacoesInsumoAction({ insumoId, localId, dataReferencia }: { insumoId: string; localId?: string | null; dataReferencia?: string | null }) {
  const nomes: Record<string, string> = { acucar: "Açúcar refinado", leite: "Leite integral", bandeja: "Bandeja kraft" };
  const unidade = insumoId === "leite" ? "L" as const : insumoId === "bandeja" ? "UN" as const : "KG" as const;
  const movimentos = Array.from({ length: insumoId === "acucar" ? 50 : 3 }, (_, indice) => ({
    id: `${insumoId}-${indice}`,
    createdAt: new Date(Date.UTC(2026, 7, 20 + indice, 14)).toISOString(),
    localNome: localId === "cozinha" ? "Cozinha" : indice % 2 ? "Cozinha" : "Estoque central",
    tipo: indice < 12 || indice % 2 === 1 ? "ENTRADA_COMPRA" as const : "SAIDA_CONSUMO" as const,
    quantidade: 1,
    saldo: indice < 12 ? indice + 1 : indice % 2 === 0 ? 11 : 12,
    observacao: indice === 49 ? "Recebimento mais recente do fornecedor" : null,
    responsavelNome: "Allan · prévia",
  }));
  return { dados: { insumoId, insumoNome: nomes[insumoId], unidade, localNome: localId ? (localId === "cozinha" ? "Cozinha" : "Estoque central") : null, dataReferencia: dataReferencia ?? null, saldoReferencia: movimentos.at(-1)?.saldo ?? 0, saldoAnteriorAoTrecho: 0, temMais: insumoId === "acucar", limite: 50, movimentacoes: movimentos } };
}
