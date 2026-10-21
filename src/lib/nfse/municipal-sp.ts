import { request } from "https";
import { createPrivateKey, X509Certificate } from "node:crypto";
import { SignedXml } from "xml-crypto";
import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import { carregarCertificadoPem, criarAgenteMTLS } from "@/lib/sefaz/certificado";
import { dataCalendarioValida } from "@/lib/financeiro/cartoes";

// Manual municipal 3.3.8, ConsultaNFeRecebidas; schemas v02-6 (11/09/2026).
// Somente consulta: nunca emitir, cancelar ou manifestar documentos neste conector.
const NAMESPACE = "http://www.prefeitura.sp.gov.br/nfe";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false, parseTagValue: false });
const LIMITE_RESPOSTA = 8 * 1024 * 1024;

export type ConsultaMunicipalNfse = {
  municipioCodigo: string;
  cnpjPrestador: string;
  numero: string;
  dataEmissao: string;
  codigoVerificacao: string;
};

export function validarConsultaMunicipal(input: ConsultaMunicipalNfse): ConsultaMunicipalNfse {
  if (input.municipioCodigo !== "3550308") throw new Error("A integração municipal está disponível para São Paulo/SP. Para outros municípios, use a chave nacional ou o XML oficial.");
  if (!/^[\d.\/\-\s]+$/.test(input.cnpjPrestador)) throw new Error("Informe o CNPJ do prestador com 14 dígitos.");
  const cnpjPrestador = input.cnpjPrestador.replace(/\D/g, "");
  if (!/^\d{14}$/.test(cnpjPrestador)) throw new Error("Informe o CNPJ do prestador com 14 dígitos.");
  const numero = input.numero.trim();
  if (!/^\d{1,12}$/.test(numero) || BigInt(numero) === BigInt(0)) throw new Error("Informe o número da NFS-e, não o número do RPS.");
  if (!dataCalendarioValida(input.dataEmissao)) throw new Error("Informe uma data de emissão válida.");
  const codigoVerificacao = input.codigoVerificacao.trim().replace(/-/g, "").toUpperCase();
  if (!/^[A-Z0-9]{8}$/.test(codigoVerificacao)) throw new Error("Informe os 8 caracteres do código de verificação da nota.");
  return { ...input, cnpjPrestador, numero: BigInt(numero).toString(), codigoVerificacao };
}

export async function assinarConsultaMunicipal(cnpj: string, data: string, pagina: number) {
  if (!/^\d{14}$/.test(cnpj) || !dataCalendarioValida(data) || !Number.isInteger(pagina) || pagina < 1) throw new Error("Dados inválidos para a consulta municipal.");
  const { certPem, chavePem } = await carregarCertificadoPem();
  const chave = createPrivateKey(chavePem);
  const certificado = certPem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g)
    ?.find(pem => new X509Certificate(pem).checkPrivateKey(chave));
  if (!certificado) throw new Error("Não foi possível identificar o certificado de assinatura da consulta municipal.");
  const xml = `<p:PedidoConsultaNFePeriodo xmlns:p="${NAMESPACE}"><Cabecalho Versao="2"><CPFCNPJRemetente><CNPJ>${cnpj}</CNPJ></CPFCNPJRemetente><CPFCNPJ><CNPJ>${cnpj}</CNPJ></CPFCNPJ><dtInicio>${data}</dtInicio><dtFim>${data}</dtFim><NumeroPagina>${pagina}</NumeroPagina></Cabecalho></p:PedidoConsultaNFePeriodo>`;
  const assinatura = new SignedXml({ privateKey: chavePem, publicCert: certificado });
  assinatura.addReference({ xpath: "/*", transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature", C14N], digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1", isEmptyUri: true });
  assinatura.canonicalizationAlgorithm = C14N;
  assinatura.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
  assinatura.computeSignature(xml);
  return assinatura.getSignedXml();
}

async function consultarPagina(cnpj: string, data: string, pagina: number, tempoRestante: number) {
  const xml = await assinarConsultaMunicipal(cnpj, data, pagina);
  const corpo = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><ConsultaNFeRecebidasRequest xmlns="${NAMESPACE}"><VersaoSchema>2</VersaoSchema><MensagemXML><![CDATA[${xml}]]></MensagemXML></ConsultaNFeRecebidasRequest></soap:Body></soap:Envelope>`;
  const agent = await criarAgenteMTLS();
  try {
    return await new Promise<string>((resolve, reject) => {
      const req = request({ hostname: "nfews.prefeitura.sp.gov.br", path: "/lotenfe.asmx", method: "POST", agent,
        headers: { "Content-Type": `application/soap+xml; charset=utf-8; action="${NAMESPACE}/ws/consultaNFeRecebidas"`, "Content-Length": Buffer.byteLength(corpo) } }, res => {
        const blocos: Buffer[] = []; let tamanho = 0;
        res.on("data", bloco => {
          tamanho += bloco.length;
          if (tamanho > LIMITE_RESPOSTA) req.destroy(new Error("A resposta da Prefeitura excedeu o tamanho permitido."));
          else blocos.push(Buffer.from(bloco));
        });
        res.on("error", reject);
        res.on("end", () => {
          if (res.statusCode !== 200) return reject(new Error(`A Prefeitura de São Paulo retornou HTTP ${res.statusCode ?? 0}. Tente novamente mais tarde.`));
          resolve(Buffer.concat(blocos).toString("utf8"));
        });
      });
      const limite = setTimeout(() => req.destroy(new Error("A Prefeitura de São Paulo demorou para responder. Tente novamente.")), Math.min(30_000, tempoRestante));
      req.on("close", () => clearTimeout(limite));
      req.on("error", reject);
      req.end(corpo);
    });
  } finally { agent.destroy(); }
}

type Registro = Record<string, unknown>;
function registro(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Registro : {};
}
function lerXml(xml: string): Registro {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) throw new Error("A Prefeitura retornou um XML inválido.");
  return registro(parser.parse(xml));
}
function texto(valor: unknown) { return typeof valor === "string" ? valor : ""; }
function numeroIgual(a: unknown, b: string) { return /^\d+$/.test(texto(a)) && BigInt(texto(a)).toString() === b; }
function codigoVerificacao(valor: unknown) { return texto(valor).trim().replace(/-/g, "").toUpperCase(); }

export type NotaMunicipalLocalizada = ConsultaMunicipalNfse & { chave: string; valorServico: number; xmlMunicipal: string };

export function lerRespostaMunicipal(xml: string, input: ConsultaMunicipalNfse, cnpjTomador: string): { quantidade: number; nota: NotaMunicipalLocalizada | null } {
  const corpo = registro(registro(lerXml(xml).Envelope).Body);
  if (corpo.Fault) throw new Error("A Prefeitura não conseguiu processar a consulta municipal. Tente novamente mais tarde.");
  const retornoXml = texto(registro(corpo.ConsultaNFeRecebidasResponse).RetornoXML);
  if (!retornoXml) throw new Error("A Prefeitura não retornou o resultado da consulta municipal.");
  const retorno = registro(lerXml(retornoXml).RetornoConsulta);
  if (registro(retorno.Cabecalho).Sucesso !== "true" || retorno.Erro) {
    const erro = registro(Array.isArray(retorno.Erro) ? retorno.Erro[0] : retorno.Erro);
    throw new Error(`A Prefeitura de São Paulo recusou a consulta${texto(erro.Descricao) ? `: ${texto(erro.Descricao).slice(0, 400)}` : ". Confira o cadastro e as permissões do certificado no portal municipal."}`);
  }
  const notas = (Array.isArray(retorno.NFe) ? retorno.NFe : retorno.NFe ? [retorno.NFe] : []).map(registro);
  const candidatas = notas.filter(nota => registro(nota.CPFCNPJPrestador).CNPJ === input.cnpjPrestador && numeroIgual(registro(nota.ChaveNFe).NumeroNFe, input.numero));
  if (candidatas.length > 1) throw new Error("A Prefeitura retornou mais de uma nota com essa identificação. Confira os dados no portal municipal.");
  const nota = candidatas[0];
  if (!nota) return { quantidade: notas.length, nota: null };
  const chaveNota = registro(nota.ChaveNFe);
  if (codigoVerificacao(chaveNota.CodigoVerificacao) !== codigoVerificacao(input.codigoVerificacao)) throw new Error("O código de verificação não corresponde à NFS-e localizada. Confira o código impresso na nota.");
  if (registro(nota.CPFCNPJTomador).CNPJ !== cnpjTomador) throw new Error("A NFS-e municipal não está emitida para o CNPJ configurado no HUB.");
  if (texto(nota.DataEmissaoNFe).slice(0, 10) !== input.dataEmissao) throw new Error("A data da NFS-e localizada difere da emissão informada.");
  if (nota.StatusNFe !== "N") throw new Error("A nota municipal está cancelada ou não está em situação normal. Confira a situação na Prefeitura.");
  const chave = texto(chaveNota.ChaveNotaNacional);
  if (!/^\d{50}$/.test(chave)) throw new Error("A Prefeitura localizou a nota, mas ainda não disponibilizou sua chave nacional. Importe o XML oficial ou tente novamente após a disponibilização.");
  const valorServico = Number(nota.ValorServicos);
  if (!texto(nota.RazaoSocialPrestador) || !texto(nota.RazaoSocialTomador) || !Number.isFinite(valorServico) || valorServico <= 0) throw new Error("A Prefeitura retornou a nota com identificação ou valor incompletos.");
  // A resposta do período pode conter notas de terceiros. Persistimos somente o registro
  // já conferido, reserializado sem alterar seus campos, quando o XML nacional ainda não
  // estiver disponível na Sefin.
  const construtor = new XMLBuilder({ ignoreAttributes: false, format: true });
  const xmlMunicipal = `<?xml version="1.0" encoding="UTF-8"?>\n${construtor.build({
    "p:RetornoConsulta": {
      "@_xmlns:p": NAMESPACE,
      Cabecalho: { "@_Versao": "2", Sucesso: "true" },
      NFe: nota,
    },
  })}`;
  return { quantidade: notas.length, nota: { ...input, chave, valorServico, xmlMunicipal } };
}

export async function localizarNfseMunicipal(input: ConsultaMunicipalNfse, cnpjTomador: string) {
  const consulta = validarConsultaMunicipal(input);
  if (consulta.dataEmissao < "2026-01-01") throw new Error("A consulta municipal integrada atende notas emitidas desde 2026. Para notas anteriores, importe o XML oficial.");
  const limite = Date.now() + 90_000;
  for (let pagina = 1; pagina <= 10; pagina++) {
    const restante = limite - Date.now();
    if (restante <= 0) throw new Error("A consulta municipal excedeu o tempo permitido. Tente novamente mais tarde.");
    const resposta = lerRespostaMunicipal(await consultarPagina(cnpjTomador, consulta.dataEmissao, pagina, restante), consulta, cnpjTomador);
    if (resposta.nota) return resposta.nota;
    if (resposta.quantidade < 50) throw new Error("Nenhuma NFS-e foi encontrada para esse prestador, número e data. Informe o número da NFS-e, não o número do RPS, e confira a data de emissão.");
  }
  throw new Error("Há muitas notas para essa data. Consulte a chave no portal municipal ou importe o XML oficial.");
}

// Confere o XML nacional efetivamente baixado antes da persistência. Não basta confiar
// apenas na chave retornada pela consulta municipal nem aceitar um tomador ausente.
export function conferirXmlMunicipal(xml: string, nota: NotaMunicipalLocalizada, cnpjTomador: string) {
  const nfse = registro(registro(lerXml(xml).NFSe).infNFSe);
  const dps = registro(registro(nfse.DPS).infDPS);
  if (nfse["@_Id"] !== `NFS${nota.chave}` || !numeroIgual(nfse.nNFSe, nota.numero)
    || registro(nfse.emit).CNPJ !== nota.cnpjPrestador || registro(dps.toma).CNPJ !== cnpjTomador
    || !texto(registro(nfse.emit).xNome) || !texto(registro(dps.toma).xNome)
    || texto(dps.dhEmi ?? nfse.dhEmi).slice(0, 10) !== nota.dataEmissao) {
    throw new Error("O XML nacional não corresponde à NFS-e municipal consultada. Nenhuma nota foi importada.");
  }
  const valor = Number(registro(registro(dps.valores).vServPrest).vServ);
  if (!Number.isFinite(valor) || Math.round(valor * 100) !== Math.round(nota.valorServico * 100)) throw new Error("O valor do XML nacional difere da nota municipal. Nenhuma nota foi importada.");
}
