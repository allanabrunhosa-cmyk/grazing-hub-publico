import type { RegraFiscal } from "./tipos";
import { dataFiscal } from "./validacao";
/** Exceção futura explícita. Orientações paulistas de base BRUTA não comprovam exceção. */
export function excecaoBaseLiquidaComprovada(regra: RegraFiscal, uf: string, data: string, fontes: string[]): boolean {
  if (regra.reforma?.preco2027?.baseIcms !== "LIQUIDA_RTC") return true;
  const e = regra.reforma.preco2027.excecaoBaseLiquida;
  if (!e || e.uf !== uf || !e.vigenciaInicio || e.vigenciaInicio > data || e.vigenciaFim && e.vigenciaFim < data || typeof e.ato !== "string" || e.ato.trim().length < 15 || typeof e.justificativa !== "string" || e.justificativa.trim().length < 15 || !fontes.includes(e.fonteNormativa)) return false;
  try {
    if (dataFiscal(data) !== data || dataFiscal(e.vigenciaInicio) !== e.vigenciaInicio || e.vigenciaFim && (dataFiscal(e.vigenciaFim) !== e.vigenciaFim || e.vigenciaFim < e.vigenciaInicio)) return false;
    const u = new URL(e.fonteNormativa);
    return u.protocol === "https:" && /(^|\.)(gov\.br|fazenda\.sp\.gov\.br)$/.test(u.hostname) && !u.username && !u.password && !/RC(?:32931[_-]?2025|33083[_-]?2026)/i.test(u.pathname);
  } catch { return false; }
}
