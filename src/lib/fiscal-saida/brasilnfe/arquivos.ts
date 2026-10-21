import "server-only";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { PDFDocumentLoadingTask } from "pdfjs-dist/types/src/display/api";
import { codigoAmbienteBrasilNfe, conferirChaveBrasilNfe, conferirIdentidadeBrasilNfe, conferirNumeroSerieChaveBrasilNfe, type IdentidadeConsultaBrasilNfe } from "./consulta";
import { NUMERO_FCI_FISCAL } from "@/lib/tributacao/fci";

const limiteXml = 2 * 1024 * 1024, limitePdf = 10 * 1024 * 1024, limiteHtml = 1024 * 1024;
const limitePaginasPdf = 100, prazoPdfMs = 15000;
export class ErroArquivosBrasilNfe extends Error {
  constructor(public readonly codigo: "ARQUIVO_INVALIDO" | "IDENTIDADE_DIVERGENTE" | "HTML_NFCE_NAO_SUPORTADO") {
    super(codigo === "HTML_NFCE_NAO_SUPORTADO" ? "A representação NFC-e retornada é HTML. O HUB ainda não armazena esse formato como documento fiscal." : "Arquivo fiscal Brasil NFe inválido ou divergente do documento autorizado.");
    this.name = "ErroArquivosBrasilNfe";
  }
}
/** Conferência adicional do campo enviado. Não consulta cadastro de FCI nem
 * substitui a validação de identidade, protocolo e formato do XML autorizado. */
export function conferirFciXmlBrasilNfe(xml: string, produtos: unknown) {
  if (!Array.isArray(produtos) || !produtos.some(p => p && typeof p === "object" && !Array.isArray(p) && "nFCI" in p)) return;
  if (!xml || Buffer.byteLength(xml) > limiteXml || /<!DOCTYPE|<!ENTITY|<\s*(?:html|script)\b/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  const raiz = objeto(new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, trimValues: true }).parse(xml));
  const inf = objeto(objeto(objeto(raiz.nfeProc).NFe).infNFe), itens = Array.isArray(inf.det) ? inf.det : inf.det ? [inf.det] : [];
  if (itens.length !== produtos.length || produtos.length > 990) throw new ErroArquivosBrasilNfe("IDENTIDADE_DIVERGENTE");
  produtos.forEach((p, indice) => {
    const esperado = objeto(p);
    if (esperado.nFCI === undefined) return;
    const item = objeto(itens[indice]), produto = objeto(item.prod);
    if (typeof esperado.nFCI !== "string" || !NUMERO_FCI_FISCAL.test(esperado.nFCI) || item["@_nItem"] !== String(indice + 1) || produto.cProd !== esperado.CodProdutoServico || produto.nFCI !== esperado.nFCI) throw new ErroArquivosBrasilNfe("IDENTIDADE_DIVERGENTE");
  });
}
function decodificarBase64(v: unknown, limite: number): Buffer {
  if (typeof v !== "string" || !v || v.length > Math.ceil(limite / 3) * 4 || v.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v)) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  const b = Buffer.from(v, "base64");
  if (!b.length || b.length > limite || b.toString("base64") !== v) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  return b;
}
function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  return v as Record<string, unknown>;
}
async function conferirEstruturaPdf(bytes: Uint8Array) {
  let tarefa: PDFDocumentLoadingTask | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let encerrado = false;
  const ler = async () => {
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (encerrado) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
    // Bytes locais somente. PDF.js interpreta objetos e streams; não executa JavaScript.
    // Verbosidade zero evita expor trechos do arquivo nos avisos do parser.
    tarefa = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, stopAtErrors: true, verbosity: 0, useSystemFonts: false, disableFontFace: true });
    const documento = await tarefa.promise;
    if (!Number.isSafeInteger(documento.numPages) || documento.numPages < 1 || documento.numPages > limitePaginasPdf) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
    for (let n = 1; n <= documento.numPages; n++) {
      if (encerrado) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
      const pagina = await documento.getPage(n);
      await pagina.getOperatorList();
      pagina.cleanup();
    }
  };
  const prazo = new Promise<never>((_, rejeitar) => { timer = setTimeout(() => rejeitar(new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO")), prazoPdfMs); });
  try { await Promise.race([ler(), prazo]); }
  catch { throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO"); }
  finally {
    encerrado = true;
    if (timer) clearTimeout(timer);
    try { await tarefa?.destroy(); } catch { /* Erro de limpeza não expõe conteúdo do parser. */ }
  }
}
/** Valida formato e vínculo ao documento autorizado; não afirma que verificou a
 * assinatura criptográfica da SEFAZ. XML/PDF não são aceitos pelo nome do arquivo. */
export async function validarArquivosBrasilNfe(arquivos: { Base64Xml?: unknown; Base64File?: unknown }, contexto: { identidade: IdentidadeConsultaBrasilNfe; chave: string; protocolo: string; aceitarHtml?: boolean }): Promise<{ xml?: string; pdf?: Uint8Array; html?: string }> {
  const i = conferirIdentidadeBrasilNfe(contexto.identidade);
  conferirChaveBrasilNfe(contexto.chave, i);
  if (!/^\d{1,30}$/.test(contexto.protocolo)) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  let xml: string | undefined, pdf: Buffer | undefined, html: string | undefined;
  if (arquivos.Base64Xml != null) {
    try { xml = new TextDecoder("utf-8", { fatal: true }).decode(decodificarBase64(arquivos.Base64Xml, limiteXml)); }
    catch { throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO"); }
    if (/<!DOCTYPE|<!ENTITY|<\s*(?:html|script)\b/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
    const raiz = objeto(new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, trimValues: true }).parse(xml));
    const processo = objeto(raiz.nfeProc), inf = objeto(objeto(processo.NFe).infNFe), ide = objeto(inf.ide), emit = objeto(inf.emit), protocolo = objeto(objeto(processo.protNFe).infProt);
    if (processo["@_xmlns"] !== "http://www.portalfiscal.inf.br/nfe" || !["100", "150"].includes(String(protocolo.cStat))) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
    if (typeof ide.nNF !== "string" || !/^\d{1,9}$/.test(ide.nNF) || typeof ide.serie !== "string" || !/^\d{1,3}$/.test(ide.serie)) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
    try { conferirNumeroSerieChaveBrasilNfe(contexto.chave, ide.nNF, ide.serie); }
    catch { throw new ErroArquivosBrasilNfe("IDENTIDADE_DIVERGENTE"); }
    if (inf["@_Id"] !== `NFe${contexto.chave}` || protocolo.chNFe !== contexto.chave || protocolo.nProt !== contexto.protocolo || emit.CNPJ !== i.emitenteCnpj || ide.mod !== String(i.modeloDocumento) || ide.tpAmb !== String(codigoAmbienteBrasilNfe(i.ambiente)) || protocolo.tpAmb !== String(codigoAmbienteBrasilNfe(i.ambiente))) throw new ErroArquivosBrasilNfe("IDENTIDADE_DIVERGENTE");
  }
  if (arquivos.Base64File != null) {
    pdf = decodificarBase64(arquivos.Base64File, limitePdf);
    if (pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      if (i.modeloDocumento !== 65 || !/^\s*(?:<!doctype\s+html|<html\b)/i.test(pdf.subarray(0, 1024).toString("utf8"))) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
      if (!contexto.aceitarHtml) throw new ErroArquivosBrasilNfe("HTML_NFCE_NAO_SUPORTADO");
      html = sanitizarHtmlNfceBrasilNfe(pdf, contexto.chave);
      pdf = undefined;
    } else {
      if (!/%%EOF\s*$/.test(pdf.subarray(Math.max(0, pdf.length - 1024)).toString("ascii")) || /\/(?:JavaScript|JS|Launch|EmbeddedFile)\b/.test(pdf.toString("latin1"))) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
      await conferirEstruturaPdf(pdf);
    }
  }
  if (!xml && !pdf && !html) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  return { ...(xml ? { xml } : {}), ...(pdf ? { pdf } : {}), ...(html ? { html } : {}) };
}

type NoHtml = Record<string, unknown>;
/** Aceita somente HTML/XHTML bem formado no subconjunto estático. O parser existente
 * valida a árvore; nunca transforma HTML arbitrário por substituições permissivas.
 * Formato fora desse recorte exige conferência, não é conservado como PDF. */
export function sanitizarHtmlNfceBrasilNfe(bytes: Uint8Array, chave: string): string {
  if (!bytes.length || bytes.length > limiteHtml || !/^\d{44}$/.test(chave)) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  let html: string;
  try { html = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO"); }
  // Só o DOCTYPE HTML sem subconjuntos é removido; entidades externas nunca passam.
  html = html.replace(/^\s*<!doctype html>\s*/i, "");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(html) || /<!DOCTYPE|<!ENTITY|<\?/i.test(html) || XMLValidator.validate(html) !== true) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  const arvore = new XMLParser({ preserveOrder: true, ignoreAttributes: false, parseTagValue: false, trimValues: false, processEntities: true }).parse(html) as NoHtml[];
  const tags = new Set(["html", "head", "title", "body", "div", "span", "p", "br", "hr", "h1", "h2", "h3", "h4", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "strong", "b", "em", "i", "small", "pre", "section", "ul", "ol", "li"]);
  const escapar = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  let texto = "", nos = 0;
  const ler = (lista: NoHtml[], profundidade: number): string => {
    if (profundidade > 40 || !Array.isArray(lista)) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
    return lista.map(no => {
      if (++nos > 20000) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
      const nomes = Object.keys(no).filter(k => k !== ":@");
      if (nomes.length !== 1) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
      const nome = nomes[0];
      if (nome === "#text") {
        if (typeof no[nome] !== "string") throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
        texto += no[nome]; return escapar(no[nome]);
      }
      if (!tags.has(nome) || !Array.isArray(no[nome])) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
      const atributos = no[":@"] == null ? {} : objeto(no[":@"]);
      let permitidos = "";
      for (const [atributo, valor] of Object.entries(atributos)) {
        if ((atributo === "@_colspan" || atributo === "@_rowspan") && ["td", "th"].includes(nome) && typeof valor === "string" && /^(?:[1-9]|[1-9]\d)$/.test(valor)) permitidos += ` ${atributo.slice(2)}="${valor}"`;
        else if (["@_class", "@_id"].includes(atributo) && typeof valor === "string" && /^[A-Za-z0-9 _-]{0,200}$/.test(valor)) { /* nomes visuais removidos */ }
        else if (atributo === "@_xmlns" && valor === "http://www.w3.org/1999/xhtml" && nome === "html") { /* namespace não vira URL ativa */ }
        else throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
      }
      return `<${nome}${permitidos}>${ler(no[nome] as NoHtml[], profundidade + 1)}</${nome}>`;
    }).join("");
  };
  if (arvore.length !== 1 || !Object.hasOwn(arvore[0], "html")) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  const seguro = ler(arvore, 0);
  if (!texto.replace(/[\s.\/-]/g, "").includes(chave)) throw new ErroArquivosBrasilNfe("IDENTIDADE_DIVERGENTE");
  return `<!DOCTYPE html>${seguro}`;
}

export function validarXmlCancelamentoBrasilNfe(base64: unknown, contexto: { identidade: IdentidadeConsultaBrasilNfe; chave: string; protocoloCancelamento: string; numeroSequencialEvento?: number }): string {
  const i = conferirIdentidadeBrasilNfe(contexto.identidade);
  conferirChaveBrasilNfe(contexto.chave, i);
  if (!/^\d{1,30}$/.test(contexto.protocoloCancelamento)) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  let xml: string;
  try { xml = new TextDecoder("utf-8", { fatal: true }).decode(decodificarBase64(base64, limiteXml)); } catch { throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO"); }
  if (/<!DOCTYPE|<!ENTITY|<\s*(?:html|script)\b/i.test(xml) || XMLValidator.validate(xml) !== true) throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  const raiz = objeto(new XMLParser({ ignoreAttributes: false, parseTagValue: false, parseAttributeValue: false, trimValues: true }).parse(xml));
  const proc = objeto(raiz.procEventoNFe), evento = objeto(objeto(proc.evento).infEvento), retorno = objeto(objeto(proc.retEvento).infEvento);
  if (proc["@_xmlns"] !== "http://www.portalfiscal.inf.br/nfe" || retorno.cStat !== "135" || evento.tpEvento !== "110111" || retorno.tpEvento !== "110111") throw new ErroArquivosBrasilNfe("ARQUIVO_INVALIDO");
  if (evento.tpAmb !== String(codigoAmbienteBrasilNfe(i.ambiente)) || retorno.tpAmb !== String(codigoAmbienteBrasilNfe(i.ambiente)) || evento.CNPJ !== i.emitenteCnpj || evento.chNFe !== contexto.chave || retorno.chNFe !== contexto.chave || retorno.nProt !== contexto.protocoloCancelamento) throw new ErroArquivosBrasilNfe("IDENTIDADE_DIVERGENTE");
  if (typeof evento.nSeqEvento !== "string" || !/^[1-9]\d{0,2}$/.test(evento.nSeqEvento) || retorno.nSeqEvento !== evento.nSeqEvento || (contexto.numeroSequencialEvento !== undefined && evento.nSeqEvento !== String(contexto.numeroSequencialEvento))) throw new ErroArquivosBrasilNfe("IDENTIDADE_DIVERGENTE");
  return xml;
}
