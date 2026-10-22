import type { VersaoFiscalDto } from "./tipos";
/** Projeção pura da vigência, compartilhada entre ficha e motor. */
export function versoesVigentes(versoes: VersaoFiscalDto[], data: string): VersaoFiscalDto[] {
  const r = new Map<string, VersaoFiscalDto>();
  for (const v of versoes) {
    if (v.status !== "ATIVO" || v.vigenciaInicio > data) continue;
    const k = `${v.tipo}:${v.chave}`, a = r.get(k);
    if (!a || v.vigenciaInicio > a.vigenciaInicio || v.vigenciaInicio === a.vigenciaInicio && v.versao > a.versao) r.set(k, v);
  }
  return [...r.values()];
}
