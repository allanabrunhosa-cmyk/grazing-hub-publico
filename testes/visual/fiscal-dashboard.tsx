import { FiscalPreviewLayout } from "./fiscal-layout";
import { createRoot } from "react-dom/client";
import { PainelFiscal } from "@/app/(protegido)/financeiro/fiscal/painel-fiscal";
import { criarDashboardFiscalFicticio } from "./fiscal-dashboard-dados";
import { resumirCertificadoDashboard } from "@/lib/fiscal-dashboard/certificado";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(parametros.get("mes") ?? "") ? parametros.get("mes")! : "2026-10";
const dados = criarDashboardFiscalFicticio(mes, parametros.get("ambiente") === "HOMOLOGACAO" ? "HOMOLOGACAO" : "PRODUCAO", parametros.get("estado") === "indisponivel");
if (parametros.has("de") || parametros.has("ate")) { dados.filtros.de = parametros.get("de") ?? ""; dados.filtros.ate = parametros.get("ate") ?? ""; }
const estadoCertificado = parametros.get("certificado");
if (estadoCertificado === "ausente" || estadoCertificado === "vigente" || estadoCertificado === "vencido") {
  dados.integracao.certificado = resumirCertificadoDashboard(estadoCertificado === "ausente" ? null : { validoAte: new Date(estadoCertificado === "vencido" ? "2026-10-11T12:00:00Z" : "2026-12-07T12:00:00Z") }, new Date("2026-10-12T12:00:00Z"));
}
createRoot(document.getElementById("root")!).render(<FiscalPreviewLayout><PainelFiscal dados={dados} /></FiscalPreviewLayout>);
