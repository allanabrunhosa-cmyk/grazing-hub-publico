import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { AmbienteDashboardFiscal, FiltrosDashboardFiscal } from "./tipos";

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: true, removeNSPrefix: true });
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const texto = (v: unknown): string | null => typeof v === "string" && v.length ? v : null;
const ambienteXml = (v: unknown): AmbienteDashboardFiscal | null => v === "1" ? "PRODUCAO" : v === "2" ? "HOMOLOGACAO" : null;
export class ErroPeriodoDashboard extends Error {}

/** Valores fiscais em centavos inteiros, sem conversão intermediária por float. */
export function centavosFiscais(valor: unknown): bigint | null {
  if (typeof valor !== "string" || !/^\d{1,18}(?:\.\d{1,2})?$/.test(valor)) return null;
  const [inteiro, decimal = ""] = valor.split(".");
  return BigInt(inteiro) * BigInt(100) + BigInt(decimal.padEnd(2, "0"));
}
export function moedaFiscal(centavos: bigint): string {
  return `${centavos / BigInt(100)}.${String(centavos % BigInt(100)).padStart(2, "0")}`;
}
export function diaFiscal(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(valor)) return null;
  const dia = valor.slice(0, 10);
  if (dia < "0001-01-01") return null;
  const data = new Date(`${dia}T12:00:00Z`);
  if (!Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== dia) return null;
  if (valor.length > 10 && !Number.isFinite(Date.parse(valor))) return null;
  // A competência conserva a data escrita pela autoridade no XML, inclusive seu offset.
  return dia;
}
export function normalizarFiltrosDashboard(
  parametros: Record<string, string | string[] | undefined>, agora = new Date(),
): FiltrosDashboardFiscal {
  const mesAtual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(agora);
  const mes = typeof parametros.mes === "string" && /^(?:20\d{2})-(?:0[1-9]|1[0-2])$/.test(parametros.mes) ? parametros.mes : mesAtual;
  const filtros: FiltrosDashboardFiscal = { mes, ambiente: parametros.ambiente === "HOMOLOGACAO" ? "HOMOLOGACAO" : "PRODUCAO" };
  if (parametros.de !== undefined || parametros.ate !== undefined) {
    for (const campo of ["de", "ate"] as const) {
      const valor = parametros[campo];
      if (valor !== undefined && (typeof valor !== "string" || valor !== "" && (valor.length !== 10 || !diaFiscal(valor)))) throw new ErroPeriodoDashboard("Informe datas válidas no formato AAAA-MM-DD.");
      filtros[campo] = typeof valor === "string" ? valor : "";
    }
    if (filtros.de && filtros.ate && filtros.de > filtros.ate) throw new ErroPeriodoDashboard("A data inicial deve ser anterior ou igual à final.");
  }
  return filtros;
}
export type EvidenciaDocumentoFiscal = {
  chave: string | null;
  ambiente: AmbienteDashboardFiscal | null;
  modelo: 55 | 65 | null;
  numero: string | null;
  emitenteCnpj: string | null;
  destinatarioCnpj: string | null;
  diaEmissao: string | null;
  total: bigint | null;
  protocolo: string | null;
  autorizado: boolean;
  cancelado: boolean;
  diaCancelamento: string | null;
  eventoCancelamentoResumido: boolean;
  resumo: boolean;
};
const vazio = (): EvidenciaDocumentoFiscal => ({ chave: null, ambiente: null, modelo: null, numero: null, emitenteCnpj: null, destinatarioCnpj: null, diaEmissao: null, total: null, protocolo: null, autorizado: false, cancelado: false, diaCancelamento: null, eventoCancelamentoResumido: false, resumo: false });
function chaveValida(v: unknown): string | null { const t = texto(v); return t && /^\d{44}$/.test(t) ? t : null; }
export function modeloPelaChave(chave: string | null): 55 | 65 | null {
  return chave && /^\d{44}$/.test(chave) ? chave.slice(20, 22) === "55" ? 55 : chave.slice(20, 22) === "65" ? 65 : null : null;
}
export function extrairEvidenciaFiscal(xml: string | null): EvidenciaDocumentoFiscal {
  if (!xml || xml.length > 2 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) return vazio();
  try {
    const raiz = objeto(parser.parse(xml));
    const resumo = objeto(raiz.resNFe);
    if (Object.keys(resumo).length) {
      const chave = chaveValida(resumo.chNFe);
      return { ...vazio(), chave, ambiente: ambienteXml(resumo.tpAmb), modelo: modeloPelaChave(chave),
        numero: chave?.slice(25, 34).replace(/^0+(?=\d)/, "") ?? null, diaEmissao: diaFiscal(resumo.dhEmi),
        total: centavosFiscais(resumo.vNF), autorizado: resumo.cSitNFe === "1", cancelado: resumo.cSitNFe === "3", resumo: true };
    }
    const resumoEvento = objeto(raiz.resEvento);
    if (Object.keys(resumoEvento).length) {
      const chave = chaveValida(resumoEvento.chNFe);
      // O resumo do evento não conserva o cStat de confirmação. dhEvento é a
      // solicitação, não a data fiscal de registro do cancelamento.
      return { ...vazio(), chave, ambiente: ambienteXml(resumoEvento.tpAmb), modelo: modeloPelaChave(chave),
        protocolo: texto(resumoEvento.nProt), eventoCancelamentoResumido: !!chave && resumoEvento.tpEvento === "110111" };
    }
    const evento = objeto(raiz.procEventoNFe);
    if (Object.keys(evento).length) {
      const solicitado = objeto(objeto(evento.evento).infEvento);
      const retorno = objeto(objeto(evento.retEvento).infEvento);
      const chave = chaveValida(retorno.chNFe);
      const cancelado = solicitado.tpEvento === "110111" && retorno.tpEvento === "110111" && solicitado.tpAmb === retorno.tpAmb
        && solicitado.chNFe === chave && ["135", "155"].includes(String(retorno.cStat)) && !!texto(retorno.nProt);
      return { ...vazio(), chave, ambiente: ambienteXml(retorno.tpAmb), modelo: modeloPelaChave(chave), cancelado,
        diaCancelamento: cancelado ? diaFiscal(retorno.dhRegEvento) : null, protocolo: texto(retorno.nProt) };
    }
    const processo = objeto(raiz.nfeProc);
    const nota = objeto(objeto(processo.NFe).infNFe);
    const ide = objeto(nota.ide), protocolo = objeto(objeto(processo.protNFe).infProt);
    const chave = chaveValida(protocolo.chNFe), chaveNota = texto(nota["@_Id"])?.replace(/^NFe/, "");
    const ambiente = ambienteXml(ide.tpAmb);
    const modelo = ide.mod === "55" ? 55 : ide.mod === "65" ? 65 : null;
    const emitenteCnpj = texto(objeto(nota.emit).CNPJ);
    const numero = texto(ide.nNF), serie = texto(ide.serie);
    const identica = !!chave && chave === chaveNota && modelo === modeloPelaChave(chave)
      && ambiente !== null && ambiente === ambienteXml(protocolo.tpAmb)
      && emitenteCnpj === chave.slice(6, 20)
      && numero?.padStart(9, "0") === chave.slice(25, 34) && serie?.padStart(3, "0") === chave.slice(22, 25);
    const autorizado = identica && ["100", "150"].includes(String(protocolo.cStat)) && !!texto(protocolo.nProt);
    return { ...vazio(), chave, ambiente, modelo, numero,
      emitenteCnpj, destinatarioCnpj: texto(objeto(nota.dest).CNPJ),
      diaEmissao: diaFiscal(ide.dhEmi ?? ide.dEmi), total: centavosFiscais(objeto(objeto(nota.total).ICMSTot).vNF),
      protocolo: texto(protocolo.nProt), autorizado, cancelado: identica && ["101", "151"].includes(String(protocolo.cStat)) };
  } catch { return vazio(); }
}
