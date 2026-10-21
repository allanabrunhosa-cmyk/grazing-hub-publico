// Datas financeiras operacionais exigem ano completo de 2000 a 2200.
export const DATA_LANCAMENTO_MIN = "2000-01-01";
export const DATA_LANCAMENTO_MAX = "2200-12-31";

export function dataLancamentoValida(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || texto < DATA_LANCAMENTO_MIN || texto > DATA_LANCAMENTO_MAX) return false;
  const data = new Date(texto + "T00:00:00Z");
  return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === texto;
}
