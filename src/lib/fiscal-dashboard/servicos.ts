import { XMLParser } from "fast-xml-parser";
import { extrairDadosNfse } from "@/lib/nfse/parse";
import { diaFiscal } from "./dominio";
import type { AmbienteDashboardFiscal } from "./tipos";

const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: false, trimValues: true });
const nomesData = new Set(["dhemi", "dataemissaonfe", "dataemissaonfse", "dataemissao", "dtemissao"]);
/** Lê o XML já recebido. Comentários e texto solto não comprovam data ou ambiente. */
export function evidenciaServicoDashboard(xml: string, cnpj: string) {
  let data: string | null = null, documento = false;
  const ambientes = new Set<string>();
  try {
    // Reutiliza os limites, validação de XML e identidade do importador existente.
    extrairDadosNfse(xml, cnpj);
    function visitar(valor: unknown) {
      if (Array.isArray(valor)) { valor.forEach(visitar); return; }
      if (!valor || typeof valor !== "object") return;
      for (const [nome, conteudo] of Object.entries(valor)) {
        const campo = nome.toLowerCase();
        if (["nfse", "nfe", "compnfse"].includes(campo)) documento = true;
        if (campo === "tpamb") ambientes.add(typeof conteudo === "string" ? conteudo : "INVALIDO");
        if (data === null && nomesData.has(campo) && typeof conteudo === "string") data = conteudo;
        visitar(conteudo);
      }
    }
    visitar(parser.parse(xml));
    const unico = ambientes.size === 1 ? [...ambientes][0] : null;
    const ambiente: AmbienteDashboardFiscal | null = unico === "1" ? "PRODUCAO" : unico === "2" ? "HOMOLOGACAO" : null;
    return { documento, dia: data ? diaFiscal(String(data).slice(0, 10)) : null, dataInformada: data !== null, ambiente, ambienteInformado: ambientes.size > 0 };
  } catch {
    return { documento: false, dia: null, dataInformada: true, ambiente: null, ambienteInformado: true };
  }
}
