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
if (parametros.get("estado") === "sem-xml") {
  const recuperado = sessionStorage.getItem("fiscal-visual-recuperado") === "1";
  dados.recuperacaoArquivosSaidaPermitida = true;
  dados.saidasSemArquivos = recuperado ? [] : [{ id: "saida-sem-xml-sintetica", numero: "43", modelo: 55, pedidoId: "pedido-sintetico", pedidoNumero: "98" }];
  dados.ultimosDocumentos = [{ id: "ficticio-0", origem: "SAIDA", modelo: 55, numero: "42", status: "AUTORIZADO", dataFiscal: mes + "-15", valor: "100.00", pedidoId: null, pedidoNumero: "97" }];
  if (recuperado) dados.ultimosDocumentos.push({ id: "saida-sem-xml-sintetica", origem: "SAIDA", modelo: 55, numero: "43", status: "AUTORIZADO", dataFiscal: mes + "-16", valor: "100.00", pedidoId: null, pedidoNumero: "98" });
  dados.documentosPorTipo = { NF_ENTRADA: 0, NFC_ENTRADA: 0, NF_SAIDA: recuperado ? 2 : 1, NFS_ENTRADA: 0 };
  dados.metricas.faturamento = recuperado ? { valor: "200.00", quantidade: 2, motivo: null } : { valor: null, quantidade: null, motivo: "Há documentos sem XML fiscal oficial; recupere os arquivos da nota autorizada." };
  dados.metricas.ticketMedio = recuperado ? { valor: "100.00", quantidade: 2, motivo: null } : { ...dados.metricas.faturamento };
  dados.movimentoDiario = dados.movimentoDiario.map(d => ({ ...d, saidas: recuperado ? "0.00" : null }));
  dados.receitaPorDocumento = [{ modelo: 55, valor: recuperado ? "200.00" : null, quantidade: recuperado ? 2 : 1 }, { modelo: 65, valor: recuperado ? "0.00" : null, quantidade: 0 }];
  dados.pendencias = recuperado ? [] : [{ codigo: "SAIDAS_SEM_DATA", titulo: "Arquivo pendente", descricao: "Documento sintético sem XML local.", quantidade: 1, href: null }];
}
const estadoCertificado = parametros.get("certificado");
if (estadoCertificado === "ausente" || estadoCertificado === "vigente" || estadoCertificado === "vencido") {
  dados.integracao.certificado = resumirCertificadoDashboard(estadoCertificado === "ausente" ? null : { validoAte: new Date(estadoCertificado === "vencido" ? "2026-10-11T12:00:00Z" : "2026-12-07T12:00:00Z") }, new Date("2026-10-12T12:00:00Z"));
}
createRoot(document.getElementById("root")!).render(<FiscalPreviewLayout><PainelFiscal dados={dados} /></FiscalPreviewLayout>);
