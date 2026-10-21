// CNPJ exclusivamente fictício, com dígitos verificadores válidos para a fixture.
import { EventEmitter } from "node:events";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn(), certificado: vi.fn(), agente: vi.fn() }));
vi.mock("https", () => ({ request: mocks.request }));
vi.mock("@/lib/sefaz/certificado", () => ({ carregarCertificadoPem: mocks.certificado, criarAgenteMTLS: mocks.agente }));
import { assinarConsultaMunicipal, conferirXmlMunicipal, lerRespostaMunicipal, localizarNfseMunicipal, validarConsultaMunicipal } from "@/lib/nfse/municipal-sp";
import { extrairDadosNfse } from "@/lib/nfse/parse";

const entrada = { municipioCodigo: "3550308", cnpjPrestador: "12345678000190", numero: "42", dataEmissao: "2026-09-01", codigoVerificacao: "ABCD1234" };
const tomador = "11222333000181";
const chave = "1".repeat(50);
const nota = { ChaveNFe: { NumeroNFe: "42", CodigoVerificacao: "ABCD1234", ChaveNotaNacional: chave }, CPFCNPJPrestador: { CNPJ: entrada.cnpjPrestador }, CPFCNPJTomador: { CNPJ: tomador }, RazaoSocialPrestador: "Prestador fictício", RazaoSocialTomador: "Tomador fictício", StatusNFe: "N", DataEmissaoNFe: "2026-09-01T10:00:00", ValorServicos: "619.00" };
const builder = new XMLBuilder({ ignoreAttributes: false });
function resposta(notas: unknown[] = [nota], erro?: unknown) {
  return builder.build({ Envelope: { Body: { ConsultaNFeRecebidasResponse: { RetornoXML: builder.build({ RetornoConsulta: { Cabecalho: { Sucesso: erro ? "false" : "true" }, NFe: notas, ...(erro ? { Erro: erro } : {}) } }) } } } });
}
function responder(corpo: string, status = 200) {
  mocks.request.mockImplementationOnce((_opcoes, callback) => {
    const req = new EventEmitter();
    return Object.assign(req, { end(corpoEnviado: string) {
      enviados.push(corpoEnviado);
      const res = Object.assign(new EventEmitter(), { statusCode: status });
      callback(res); res.emit("data", Buffer.from(corpo)); res.emit("end"); req.emit("close");
    }, destroy(erro: Error) { req.emit("error", erro); req.emit("close"); } });
  });
}
const enviados: string[] = [];
const par = forge.pki.rsa.generateKeyPair(1024);
const cert = forge.pki.createCertificate();
cert.publicKey = par.publicKey; cert.serialNumber = "01";
cert.validity.notBefore = new Date("2026-01-01"); cert.validity.notAfter = new Date("2027-01-01");
cert.setSubject([{ name: "commonName", value: "Teste local" }]); cert.setIssuer(cert.subject.attributes); cert.sign(par.privateKey);
const certPem = forge.pki.certificateToPem(cert), chavePem = forge.pki.privateKeyToPem(par.privateKey);
beforeEach(() => { vi.resetAllMocks(); enviados.length = 0; mocks.certificado.mockResolvedValue({ certPem, chavePem }); mocks.agente.mockResolvedValue({ destroy: vi.fn() }); });

describe("consulta municipal de São Paulo", () => {
  it("assina o pedido inteiro, com URI vazia e tomador, data e página corretos", async () => {
    const xml = await assinarConsultaMunicipal(tomador, entrada.dataEmissao, 2);
    const doc = new DOMParser().parseFromString(xml);
    const assinatura = new SignedXml({ publicCert: certPem });
    assinatura.loadSignature(doc.getElementsByTagName("Signature")[0]);
    expect(assinatura.checkSignature(xml)).toBe(true);
    expect(xml).toContain('Reference URI=""');
    expect(xml).toContain('<Cabecalho Versao="2">');
    expect(xml).toContain('<NumeroPagina>2</NumeroPagina>');
    expect(xml.match(new RegExp(tomador, "g"))).toHaveLength(2);
    expect(assinatura.checkSignature(xml.replace('NumeroPagina>2', 'NumeroPagina>3'))).toBe(false);
  });
  it("normaliza o número e código, mas rejeita outro município, RPS/letras e data inválida", () => {
    expect(validarConsultaMunicipal({ ...entrada, numero: "00042", codigoVerificacao: "abcd-1234" })).toMatchObject({ numero: "42", codigoVerificacao: "ABCD1234" });
    for (const alteracao of [{ municipioCodigo: "2507507" }, { numero: "R42" }, { codigoVerificacao: "123" }, { dataEmissao: "2026-02-30" }, { cnpjPrestador: "123abc45678000190" }]) {
      expect(() => validarConsultaMunicipal({ ...entrada, ...alteracao })).toThrow();
    }
  });
  it("seleciona somente a nota pedida e confere todos os identificadores", () => {
    const localizada = lerRespostaMunicipal(resposta([{ ...nota, ChaveNFe: { NumeroNFe: "99" } }, { ...nota, ChaveNFe: { ...nota.ChaveNFe, CodigoVerificacao: "ABCD-1234" } }]), entrada, tomador);
    expect(localizada).toMatchObject({ quantidade: 2, nota: { chave, numero: "42", valorServico: 619 } });
    expect(localizada.nota?.xmlMunicipal).toContain("<NFe>");
    expect(localizada.nota?.xmlMunicipal).not.toContain("<NumeroNFe>99</NumeroNFe>");
    expect(extrairDadosNfse(localizada.nota!.xmlMunicipal, tomador)).toMatchObject({
      identificador: `NFS${chave}`, prestadorCnpj: entrada.cnpjPrestador,
      tomadorCnpj: tomador, numero: "42", valorServico: 619,
    });
    const incorretas = [
      { ...nota, ChaveNFe: { ...nota.ChaveNFe, CodigoVerificacao: "XXXXXXXX" } },
      { ...nota, CPFCNPJTomador: { CNPJ: "99999999000199" } },
      { ...nota, DataEmissaoNFe: "2026-09-02" }, { ...nota, StatusNFe: "C" },
      { ...nota, ChaveNFe: { ...nota.ChaveNFe, ChaveNotaNacional: "" } },
    ];
    for (const incorreta of incorretas) expect(() => lerRespostaMunicipal(resposta([incorreta]), entrada, tomador)).toThrow();
    expect(() => lerRespostaMunicipal(resposta([nota, nota]), entrada, tomador)).toThrow("mais de uma");
    expect(() => lerRespostaMunicipal(resposta([], { Descricao: "Sem autorização" }), entrada, tomador)).toThrow("Sem autorização");
    expect(() => lerRespostaMunicipal('<!DOCTYPE x><x/>', entrada, tomador)).toThrow("XML inválido");
  });
  it("consulta por dia, pagina de 50 em 50 e usa somente o endpoint municipal de leitura", async () => {
    responder(resposta(Array.from({ length: 50 }, (_, i) => ({ ...nota, ChaveNFe: { NumeroNFe: String(100 + i) } }))));
    responder(resposta());
    expect(await localizarNfseMunicipal(entrada, tomador)).toMatchObject({ chave });
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(mocks.request.mock.calls[0][0]).toMatchObject({ hostname: "nfews.prefeitura.sp.gov.br", path: "/lotenfe.asmx", method: "POST" });
    const parse = new XMLParser({ removeNSPrefix: true });
    const pedido = parse.parse(enviados[1]).Envelope.Body.ConsultaNFeRecebidasRequest;
    expect(pedido.VersaoSchema).toBe(2);
    expect(pedido.MensagemXML).toContain("<NumeroPagina>2</NumeroPagina>");
    expect(pedido.MensagemXML).toContain("<dtInicio>2026-09-01</dtInicio><dtFim>2026-09-01</dtFim>");
  });
  it("distingue ausência de nota, erro HTTP e limite de paginação", async () => {
    responder(resposta([]));
    await expect(localizarNfseMunicipal(entrada, tomador)).rejects.toThrow("Nenhuma NFS-e");
    responder("", 503);
    await expect(localizarNfseMunicipal(entrada, tomador)).rejects.toThrow("HTTP 503");
    await expect(localizarNfseMunicipal({ ...entrada, dataEmissao: "2025-09-01" }, tomador)).rejects.toThrow("desde 2026");
    const lote = resposta(Array.from({ length: 50 }, () => ({ ...nota, ChaveNFe: { NumeroNFe: "99" } })));
    for (let i = 0; i < 10; i++) responder(lote);
    await expect(localizarNfseMunicipal(entrada, tomador)).rejects.toThrow("muitas notas");
    expect(mocks.request).toHaveBeenCalledTimes(12);
  });
  it("recusa XML nacional de outra nota, sem tomador ou com valor divergente", () => {
    const localizada = { ...entrada, chave, valorServico: 619, xmlMunicipal: "<RetornoConsulta/>" };
    const xml = `<NFSe><infNFSe Id="NFS${chave}"><nNFSe>42</nNFSe><emit><CNPJ>${entrada.cnpjPrestador}</CNPJ><xNome>Prestador</xNome></emit><DPS><infDPS><dhEmi>2026-09-01T10:00:00</dhEmi><toma><CNPJ>${tomador}</CNPJ><xNome>Tomador</xNome></toma><valores><vServPrest><vServ>619.00</vServ></vServPrest></valores></infDPS></DPS></infNFSe></NFSe>`;
    expect(() => conferirXmlMunicipal(xml, localizada, tomador)).not.toThrow();
    for (const incorreto of [xml.replace("619.00", "620.00"), xml.replace(tomador, ""), xml.replace("<nNFSe>42", "<nNFSe>43"), xml.replace(`NFS${chave}`, `NFS${"2".repeat(50)}`), xml.replace(entrada.cnpjPrestador, "99999999000199")]) {
      expect(() => conferirXmlMunicipal(incorreto, localizada, tomador)).toThrow();
    }
  });
});
