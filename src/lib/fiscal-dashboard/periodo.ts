import { periodoDoMes } from "@/lib/financeiro/periodos";
import type { DocumentoDashboardFiscal, FiltrosDashboardFiscal, TipoDocumentoDashboardFiscal } from "./tipos";

export function limitesPeriodoDashboard(filtros: FiltrosDashboardFiscal) {
  const mes = periodoDoMes(filtros.mes)!;
  return filtros.de !== undefined || filtros.ate !== undefined
    ? { de: filtros.de ?? "", ate: filtros.ate ?? "" } : mes;
}
export function pertenceAoPeriodoDashboard(dia: string, filtros: FiltrosDashboardFiscal) {
  const { de, ate } = limitesPeriodoDashboard(filtros);
  return (!de || dia >= de) && (!ate || dia <= ate);
}
export function mesCandidatoDashboard(mes: string, filtros: FiltrosDashboardFiscal) {
  const { de, ate } = limitesPeriodoDashboard(filtros);
  return (!de || mes >= de.slice(0, 7)) && (!ate || mes <= ate.slice(0, 7));
}
export function tipoDocumentoDashboard(doc: DocumentoDashboardFiscal): TipoDocumentoDashboardFiscal {
  return doc.tipo ?? (doc.origem === "SAIDA" ? "NF_SAIDA" : doc.modelo === 65 ? "NFC_ENTRADA" : "NF_ENTRADA");
}
export const TIPOS_DOCUMENTO_DASHBOARD: { valor: TipoDocumentoDashboardFiscal; nome: string }[] = [
  { valor: "NF_ENTRADA", nome: "NF entrada" }, { valor: "NFC_ENTRADA", nome: "NFC entrada" },
  { valor: "NF_SAIDA", nome: "NF saída" }, { valor: "NFS_ENTRADA", nome: "NFS entrada" },
];
