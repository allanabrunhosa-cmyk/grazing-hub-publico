import type { SaidaParaDashboard } from "@/lib/fiscal-dashboard/agregacao";
export const cnpjEmitenteDashboard = "00000000000000";
export const cnpjFornecedorDashboard = "11111111111111";
export const protocoloDashboard = "900000000000000";
export function chaveDashboard(modelo = 55, cnpj = cnpjEmitenteDashboard, mes = "2610", numero = 123) {
  return `35${mes}${cnpj}${modelo}001${String(numero).padStart(9, "0")}1000000010`;
}
export function xmlDashboard(opcoes: { valor?: string | null; data?: string | null; ambiente?: "1" | "2"; modelo?: 55 | 65; cnpj?: string; destinatario?: string; mesChave?: string; numero?: number; status?: string } = {}) {
  const cnpj = opcoes.cnpj ?? cnpjEmitenteDashboard, modelo = opcoes.modelo ?? 55, numero = opcoes.numero ?? 123;
  const chave = chaveDashboard(modelo, cnpj, opcoes.mesChave ?? "2610", numero), ambiente = opcoes.ambiente ?? "1";
  const data = opcoes.data === undefined ? "2026-10-01T00:30:00-03:00" : opcoes.data;
  const valor = opcoes.valor === undefined ? "125.37" : opcoes.valor;
  return `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}"><ide><mod>${modelo}</mod><tpAmb>${ambiente}</tpAmb><nNF>${numero}</nNF><serie>1</serie>${data ? `<dhEmi>${data}</dhEmi>` : ""}</ide><emit><CNPJ>${cnpj}</CNPJ></emit>${opcoes.destinatario ? `<dest><CNPJ>${opcoes.destinatario}</CNPJ></dest>` : ""}<total><ICMSTot>${valor ? `<vNF>${valor}</vNF>` : ""}</ICMSTot></total></infNFe></NFe><protNFe><infProt><tpAmb>${ambiente}</tpAmb><chNFe>${chave}</chNFe><nProt>${protocoloDashboard}</nProt><cStat>${opcoes.status ?? "100"}</cStat></infProt></protNFe></nfeProc>`;
}
export function saidaDashboard(opcoes: Partial<SaidaParaDashboard> = {}): SaidaParaDashboard {
  return { id: "saida-sintetica", ambiente: "PRODUCAO", status: "AUTORIZADO", chaveFiscal: chaveDashboard(), protocolo: protocoloDashboard,
    numero: "123", xml: xmlDashboard(), pedidoId: "pedido-sintetico", pedidoNumero: 41, ...opcoes };
}
export function resumoDashboard(situacao = "1", valor = "50.01", data = "2026-10-03T12:00:00-03:00") {
  return `<resNFe><chNFe>${chaveDashboard(55, cnpjFornecedorDashboard)}</chNFe><dhEmi>${data}</dhEmi><vNF>${valor}</vNF><cSitNFe>${situacao}</cSitNFe></resNFe>`;
}
export function resumoCancelamentoDashboard() {
  return `<resEvento><chNFe>${chaveDashboard(55, cnpjFornecedorDashboard)}</chNFe><tpEvento>110111</tpEvento><dhEvento>2026-10-04T12:00:00-03:00</dhEvento><nProt>${protocoloDashboard}</nProt></resEvento>`;
}
export function cancelamentoDashboard(opcoes: { data?: string; ambiente?: "1" | "2"; status?: string; chave?: string } = {}) {
  const chave = opcoes.chave ?? chaveDashboard(), ambiente = opcoes.ambiente ?? "1";
  return `<procEventoNFe><evento><infEvento><tpAmb>${ambiente}</tpAmb><chNFe>${chave}</chNFe><tpEvento>110111</tpEvento><dhEvento>2026-09-30T23:00:00-03:00</dhEvento></infEvento></evento><retEvento><infEvento><tpAmb>${ambiente}</tpAmb><chNFe>${chave}</chNFe><tpEvento>110111</tpEvento><cStat>${opcoes.status ?? "135"}</cStat><nProt>${protocoloDashboard}</nProt><dhRegEvento>${opcoes.data ?? "2026-10-01T00:01:00-03:00"}</dhRegEvento></infEvento></retEvento></procEventoNFe>`;
}
