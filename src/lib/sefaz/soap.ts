import { request } from "https";
import { URL } from "url";
import { criarAgenteMTLS } from "@/lib/sefaz/certificado";

const NFE_DISTRIBUICAO_URL = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const NFE_DISTRIBUICAO_ACTION = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";

const NFE_RECEPCAO_EVENTO_URL = "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx";
// O nome real da operação no WSDL atual é "nfeRecepcaoEventoNF" (com sufixo "NF") — o
// nome antigo "nfeRecepcaoEvento", usado em versões anteriores do serviço, faz a SEFAZ
// devolver "Unable to handle request. The action ... was not recognized." (confirmado
// direto no WSDL publicado em .../NFeRecepcaoEvento4.asmx?wsdl).
const NFE_RECEPCAO_EVENTO_ACTION = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEventoNF";

function montarEnvelopeSoap(nomeMetodo: string, namespaceMetodo: string, xmlDadosMsg: string, mensagemDireta: boolean): string {
  // Recepção de eventos usa document/literal bare: a parte de entrada do WSDL
  // é tns:nfeDadosMsg, diretamente no Body. Distribuição mantém seu wrapper atual.
  const corpo = mensagemDireta
    ? `<nfeDadosMsg xmlns="${namespaceMetodo}">${xmlDadosMsg}</nfeDadosMsg>`
    : `<${nomeMetodo} xmlns="${namespaceMetodo}"><nfeDadosMsg>${xmlDadosMsg}</nfeDadosMsg></${nomeMetodo}>`;
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    corpo +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

// POST SOAP 1.2 genérico, autenticado por mTLS com o certificado A1 (via Agent do certificado.ts).
async function chamarWebServiceSoap(
  urlServico: string,
  action: string,
  nomeMetodo: string,
  namespaceMetodo: string,
  xmlDadosMsg: string,
  mensagemDireta = false
): Promise<string> {
  const envelope = montarEnvelopeSoap(nomeMetodo, namespaceMetodo, xmlDadosMsg, mensagemDireta);
  const url = new URL(urlServico);
  const agent = await criarAgenteMTLS();

  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        agent,
        headers: {
          "Content-Type": `application/soap+xml; charset=utf-8; action="${action}"`,
          "Content-Length": Buffer.byteLength(envelope),
        },
        timeout: 30_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const corpo = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`SEFAZ retornou HTTP ${res.statusCode}: ${corpo.slice(0, 500)}`));
            return;
          }
          resolve(corpo);
        });
      }
    );

    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao chamar a SEFAZ (30s).")));
    req.on("error", (erro) => reject(erro));
    req.write(envelope);
    req.end();
  });
}

// Webservice de Distribuição de DF-e (puxar as notas).
export function chamarNfeDistribuicaoDFe(xmlDistDFeInt: string): Promise<string> {
  return chamarWebServiceSoap(
    NFE_DISTRIBUICAO_URL,
    NFE_DISTRIBUICAO_ACTION,
    "nfeDistDFeInteresse",
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe",
    xmlDistDFeInt
  );
}

// Webservice de Recepção de Evento (Manifestação do Destinatário, entre outros eventos).
export function chamarNfeRecepcaoEvento(xmlEnvEvento: string): Promise<string> {
  return chamarWebServiceSoap(
    NFE_RECEPCAO_EVENTO_URL,
    NFE_RECEPCAO_EVENTO_ACTION,
    "nfeRecepcaoEventoNF",
    "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4",
    xmlEnvEvento,
    true
  );
}
