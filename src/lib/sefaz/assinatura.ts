import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";
import { carregarCertificadoPem } from "@/lib/sefaz/certificado";

// Padrão de assinatura exigido pela NF-e: XML-DSig "Enveloped", RSA-SHA1, C14N
// (não exclusive) — mesmo padrão usado em qualquer XML assinado do projeto NFe
// (a própria nota, cancelamento, carta de correção, eventos em geral).
const ALGORITMO_ASSINATURA = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const ALGORITMO_CANONICALIZACAO = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const ALGORITMO_DIGEST = "http://www.w3.org/2000/09/xmldsig#sha1";
const TRANSFORM_ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";

// Assina o elemento identificado por `nomeElemento` (ex.: "infEvento") dentro do XML.
// O elemento precisa já ter o atributo Id preenchido — a lib usa esse valor existente
// como referência (URI="#Id") em vez de gerar um novo, que é exatamente o que a NF-e exige
// (Id no formato ID + tpEvento + chave de acesso + nSeqEvento).
export async function assinarElemento(xml: string, nomeElemento: string): Promise<string> {
  const { certPem, chavePem } = await carregarCertificadoPem();

  const sig = new SignedXml({
    privateKey: chavePem,
    publicCert: certPem,
  });

  sig.addReference({
    xpath: `//*[local-name(.)='${nomeElemento}']`,
    transforms: [TRANSFORM_ENVELOPED, ALGORITMO_CANONICALIZACAO],
    digestAlgorithm: ALGORITMO_DIGEST,
  });
  sig.canonicalizationAlgorithm = ALGORITMO_CANONICALIZACAO;
  sig.signatureAlgorithm = ALGORITMO_ASSINATURA;

  sig.computeSignature(xml);
  return sig.getSignedXml();
}

// Reconfere matematicamente uma assinatura já aplicada — usado só em teste local,
// pra validar o assinador sem precisar mandar nada pra SEFAZ.
export async function verificarAssinatura(xmlAssinado: string): Promise<boolean> {
  const { certPem } = await carregarCertificadoPem();

  const doc = new DOMParser().parseFromString(xmlAssinado);
  const nos = xpath.select(
    "//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']",
    doc
  );
  if (!Array.isArray(nos) || nos.length === 0) {
    throw new Error("Nenhuma tag <Signature> encontrada no XML assinado.");
  }

  const sig = new SignedXml({ publicCert: certPem });
  sig.loadSignature(nos[0] as Parameters<SignedXml["loadSignature"]>[0]);
  return sig.checkSignature(xmlAssinado);
}
