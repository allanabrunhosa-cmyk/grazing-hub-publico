import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
vi.mock("server-only", () => ({}));
// A liberação existe somente nesta suíte de ciclos simulados. Runtime permanece bloqueado.
vi.mock("@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao", () => ({ exigirTransmissaoBrasilNfeLiberada: () => {}, transmissaoBrasilNfeLiberada: () => true, executarTransporteManualBrasilNfe: <T>(acao: () => Promise<T>) => acao() }));
import { AdaptadorBrasilNfeM1, type PortaOperacaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/adaptador";
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { prepararPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { sanitizarHtmlNfceBrasilNfe, validarXmlCancelamentoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/arquivos";
import { interpretarEnvioFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/resposta-fiscal";
import { obterAdaptadorFiscalSaida } from "@/lib/fiscal-saida/provedor";
import type { RetornoEnvioBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/tipos-http";
import { chaveFicticia, identidadeFicticia, notaFicticia, respostaFicticia } from "./brasilnfe-fixtures";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";

const TOKEN = "token-ficticio-operacoes-exclusivo-suite", USER = "usuario-ficticio-operacoes-exclusivo-suite";
const PROTOCOLO = "90071992547409930001", CANCELAMENTO = "90071992547409930002";
const b64 = (v: string) => Buffer.from(v).toString("base64");
const json = (v: unknown) => new Response(JSON.stringify(v), { headers: { "content-type": "application/json" } });
const identidade = (modelo: 55 | 65 = 55) => ({ ...identidadeFicticia, documentoId: "documento-ficticio", chaveIdempotencia: "documento-ficticio", modeloDocumento: modelo });
function plano(modelo: 55 | 65 = 55) { const m = massaPayloadLocal(); return prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros); }
function retornoWire(modelo = 55) { return { ReturnNF: { Numero: "123", Serie: "1", ChaveNF: chaveFicticia(modelo), NumeroProtocolo: PROTOCOLO, CodTipoAmbiente: 2, CodStatusRespostaSefaz: 100, Ok: true }, Error: "", Avisos: [] }; }
function xmlNota(modelo = 55) { return `<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chaveFicticia(modelo)}"><ide><mod>${modelo}</mod><tpAmb>2</tpAmb><serie>1</serie><nNF>123</nNF></ide><emit><CNPJ>00000000000000</CNPJ></emit></infNFe></NFe><protNFe><infProt><tpAmb>2</tpAmb><chNFe>${chaveFicticia(modelo)}</chNFe><nProt>${PROTOCOLO}</nProt><cStat>100</cStat></infProt></protNFe></nfeProc>`; }
function xmlEvento(modelo = 55) { return `<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe"><evento><infEvento><tpAmb>2</tpAmb><CNPJ>00000000000000</CNPJ><chNFe>${chaveFicticia(modelo)}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento></infEvento></evento><retEvento><infEvento><tpAmb>2</tpAmb><chNFe>${chaveFicticia(modelo)}</chNFe><tpEvento>110111</tpEvento><nSeqEvento>1</nSeqEvento><cStat>135</cStat><nProt>${CANCELAMENTO}</nProt></infEvento></retEvento></procEventoNFe>`; }
function pdf() { const p = new jsPDF(); p.text("Documento ficticio da suite", 10, 10); return Buffer.from(p.output("arraybuffer")).toString("base64"); }
function porta(modelo: 55 | 65 = 55, autorizada = false): PortaOperacaoBrasilNfe {
  return { autorizar: vi.fn().mockResolvedValue(undefined), preparar: vi.fn().mockResolvedValue(plano(modelo)), obterAutorizacao: vi.fn().mockResolvedValue(autorizada ? { chave: chaveFicticia(modelo), numero: "123", serie: "1", protocolo: PROTOCOLO } : null) };
}
function montar(respostas: unknown[], p = porta(), modelo: 55 | 65 = 55) {
  const transporte = vi.fn<typeof fetch>(); for (const r of respostas) transporte.mockResolvedValueOnce(json(r));
  const c = new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte });
  return { transporte, cliente: c, adaptador: new AdaptadorBrasilNfeM1(c, "00000000000000", p), identidade: identidade(modelo), porta: p };
}

describe("Operações técnicas Brasil NFe, exclusivamente simuladas", () => {
  it("arquivo anexado inválido conserva chave/protocolo do retorno para consulta, sem sucesso simulado", async () => {
    const m = montar([{ ...retornoWire(), Base64Xml: b64("<html>falha exclusivamente ficticia</html>") }]);
    const r = await m.adaptador.enviar(m.identidade, massaPayloadLocal().documento.payload);
    expect(r.status).toBe("PENDENTE_CONFERENCIA"); expect(r.chave).toBe(chaveFicticia()); expect(r.protocolo).toBe(PROTOCOLO);
    expect(m.transporte).toHaveBeenCalledTimes(1); expect(r.erro).not.toContain("html");
  });
  it("verifica somente certificado interno, sem senha/arquivo ou alteração e com ambos headers", async () => {
    const m = montar([{ status: true, Error: "", Expirado: false, DtExpiracao: "2026-11-07", Avisos: [], Senha: TOKEN }]);
    expect(await m.cliente.verificarCertificadoInterno()).toEqual({ valido: true, expirado: false, dataExpiracao: "2026-11-07", avisosPresentes: false });
    expect(m.transporte.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/empresa/VerificarCertificado");
    expect(JSON.parse(String(m.transporte.mock.calls[0][1]?.body))).toEqual({ Interno: true });
    expect(m.transporte.mock.calls[0][1]?.headers).toMatchObject({ Token: TOKEN, UserToken: USER });
  });
  it.each([0, 1, false, "true"])("certificado status %s não vira sucesso booleano", async status => {
    const m = montar([{ status, Error: "", Expirado: false, DtExpiracao: "2026-11-07" }]);
    await expect(m.cliente.verificarCertificadoInterno()).rejects.toThrow();
  });
  it("certificado informa expiração, valida calendário e nunca expõe Error", async () => {
    const m = montar([{ status: true, Error: "", Expirado: true, DtExpiracao: "2026-11-07" }, { status: true, Error: "", Expirado: false, DtExpiracao: "2026-02-30" }, { status: false, Error: TOKEN, Expirado: false, DtExpiracao: "2026-11-07" }]);
    expect(await m.cliente.verificarCertificadoInterno()).toMatchObject({ valido: false, expirado: true });
    await expect(m.cliente.verificarCertificadoInterno()).rejects.toThrow("contrato");
    await expect(m.cliente.verificarCertificadoInterno()).rejects.not.toThrow(TOKEN);
  });
  it("sem UserToken certificado não chama a rede nem substitui credenciais", async () => {
    const transporte = vi.fn<typeof fetch>(), c = new ClienteBrasilNfe({ token: TOKEN }, { fetch: transporte });
    await expect(c.verificarCertificadoInterno()).rejects.toMatchObject({ codigo: "CONFIGURACAO_INCOMPLETA" });
    expect(transporte).not.toHaveBeenCalled();
  });
  it("CSC dos dois ambientes sai somente como quatro flags", async () => {
    const m = montar([{ CNPJ: "00000000000000", Configuracao: { NFCe: { IdCSCHomologacao: "000001", CSCHomologacao: TOKEN, IdCSCProducao: "000002", CSCProducao: USER } } }]);
    const dto = await m.cliente.buscarEmpresa();
    expect(dto.nfceHomologacao).toEqual({ idCscConfigurado: true, cscConfigurado: true });
    expect(dto.nfceProducao).toEqual({ idCscConfigurado: true, cscConfigurado: true });
    expect(JSON.stringify(dto)).not.toMatch(new RegExp(`${TOKEN}|${USER}`));
  });
  it.each([55, 65] as const)("envia somente plano atestado do modelo %s, sem float/Token/email/produção", async modelo => {
    const m = montar([retornoWire(modelo)], porta(modelo), modelo);
    const r = await m.adaptador.enviar(m.identidade, {});
    expect(r).toMatchObject({ status: "AUTORIZADO", chave: chaveFicticia(modelo), protocolo: PROTOCOLO, ordenacao: "LOCAL_OBSERVACAO" });
    expect(r).not.toHaveProperty("sequencia");
    const body = String(m.transporte.mock.calls[0][1]?.body);
    expect(body).toContain('"ValorTotal":24.53');
    expect(JSON.parse(body)).toMatchObject({ TipoAmbiente: 2, ModeloDocumento: modelo, EnviarEmail: false, IdentificadorInterno: "documento-ficticio" });
    expect(body).not.toMatch(/Token|UserToken|"Serie"/);
    for (const campo of ["Numero", "ValorFrete", "ValorDesconto"]) expect(JSON.parse(body)).not.toHaveProperty(campo);
    expect(m.transporte.mock.calls[0][1]?.headers).not.toHaveProperty("UserToken");
    expect(m.porta.autorizar).toHaveBeenCalledExactlyOnceWith("ENVIAR", m.identidade);
  });
  it("DTO reconstituído não contorna o atestado do construtor", async () => {
    const m = montar([]);
    await expect(m.cliente.enviarNotaFiscal(structuredClone(plano()))).rejects.toThrow();
    expect(m.transporte).not.toHaveBeenCalled();
  });
  it("produção, permissão negada, plano divergente e autorização anterior impedem envio", async () => {
    const p = porta(), m = montar([], p);
    await expect(m.adaptador.enviar({ ...m.identidade, ambiente: "PRODUCAO" }, {})).rejects.toThrow();
    vi.mocked(p.autorizar).mockRejectedValueOnce(new Error("Permissão central insuficiente."));
    await expect(m.adaptador.enviar(m.identidade, {})).rejects.toThrow("Permissão");
    vi.mocked(p.preparar).mockResolvedValueOnce(plano(65));
    await expect(m.adaptador.enviar(m.identidade, {})).rejects.toThrow("bloqueados");
    vi.mocked(p.obterAutorizacao).mockResolvedValueOnce({ chave: chaveFicticia(), numero: "123", serie: "1", protocolo: PROTOCOLO });
    expect(await m.adaptador.enviar(m.identidade, {})).toMatchObject({ status: "PENDENTE_CONFERENCIA" });
    expect(m.transporte).not.toHaveBeenCalled(); expect(obterAdaptadorFiscalSaida()).toBeNull();
  });
  it("preserva literal int64 recebido no protocolo, sem dados livres", async () => {
    const texto = JSON.stringify(retornoWire()).replace(`"${PROTOCOLO}"`, PROTOCOLO);
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(new Response(texto, { headers: { "content-type": "application/json" } }));
    const c = new ClienteBrasilNfe({ token: TOKEN }, { fetch: transporte });
    expect(await c.enviarNotaFiscal(plano())).toMatchObject({ protocolo: PROTOCOLO });
  });
  it.each([401, 403, 404, 429, 500, 503])("HTTP%s da transmissão permanece incerto, sem retry ou erro externo", async status => {
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(new Response(`${TOKEN} detalhe externo`, { status }));
    const c = new ClienteBrasilNfe({ token: TOKEN }, { fetch: transporte });
    try { await c.enviarNotaFiscal(plano()); throw new Error("O endpoint não deveria ser aceito."); }
    catch (erro) {
      expect(erro).toMatchObject({ codigo: status === 401 ? "CREDENCIAL_INVALIDA" : "EXTERNO", diagnosticoSeguro: { categoria: "HTTP", httpStatus: status } });
      expect(JSON.stringify(erro)).not.toContain(TOKEN);
    }
    expect(transporte).toHaveBeenCalledTimes(1);
  });
  it("Error ausente/contrato malformado e ambiente externo1 não são sucesso", async () => {
    const semError = { ReturnNF: retornoWire().ReturnNF, Avisos: [] }, producao = retornoWire(); producao.ReturnNF.CodTipoAmbiente = 1;
    const m = montar([semError, { Error: "", ReturnNF: [TOKEN] }, producao]);
    await expect(m.cliente.enviarNotaFiscal(plano())).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
    await expect(m.cliente.enviarNotaFiscal(plano())).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
    await expect(m.cliente.enviarNotaFiscal(plano())).rejects.toMatchObject({ codigo: "PRODUCAO_BLOQUEADA" });
  });
  it.each([215, 225, 386, 725, 787])("rejeição comprovada %s usa mensagem local e não retorna sucesso", async codigo => {
    const r = retornoWire(); r.ReturnNF.Ok = false; r.ReturnNF.CodStatusRespostaSefaz = codigo; r.ReturnNF.NumeroProtocolo = "";
    const m = montar([r]);
    expect(await m.adaptador.enviar(m.identidade, {})).toMatchObject({ status: "REJEITADO", erro: expect.stringContaining(String(codigo)) });
  });
  it.each([110, 301, 302, 303])("denegação %s é terminal, sem autorização/reenvio", async codigo => {
    const r = retornoWire(); r.ReturnNF.Ok = false; r.ReturnNF.CodStatusRespostaSefaz = codigo;
    const m = montar([r]); expect(await m.adaptador.enviar(m.identidade, {})).toMatchObject({ status: "DENEGADO", chave: chaveFicticia(), numero: "123", serie: "1", protocolo: PROTOCOLO, erro: expect.stringContaining(String(codigo)) });
  });
  it.each([204, 539, 105, 108, 999])("código ambíguo/duplicidade %s exige conferência", async codigo => {
    const r = retornoWire(); r.ReturnNF.Ok = false; r.ReturnNF.CodStatusRespostaSefaz = codigo;
    const m = montar([r]); expect(await m.adaptador.enviar(m.identidade, {})).toMatchObject({ status: "PENDENTE_CONFERENCIA" });
  });
  it("retorno contraditório e chave divergente não viram autorização", async () => {
    const r = retornoWire(); r.Error = `${TOKEN} segredo refletido`;
    const m = montar([r]); const resposta = await m.adaptador.enviar(m.identidade, {});
    expect(resposta.status).toBe("PENDENTE_CONFERENCIA"); expect(JSON.stringify(resposta)).not.toContain(TOKEN);
    const base: RetornoEnvioBrasilNfe = { numero: "123", serie: "1", chave: chaveFicticia(65), protocolo: PROTOCOLO, codigoSefaz: 100, ok: true, ambiente: 2, erroPresente: false };
    expect(() => interpretarEnvioFiscalBrasilNfe(base, identidade())).toThrow("corresponde");
  });
  it("recupera autorização no histórico e deduplica evento sem inventar sequência", async () => {
    const anterior = { ...notaFicticia(), IdentificadorInterno: "documento-ficticio" };
    const rejeitada = { ...anterior, Status: 3, Emitida: false, Chave: null, NumeroProtocolo: null, CodStatusResposta: 225 };
    const wire = { ...respostaFicticia(), Nota: rejeitada, Historico: [anterior] };
    const m = montar([wire, wire]);
    const a = await m.adaptador.consultar(m.identidade), b = await m.adaptador.consultar(m.identidade);
    expect(a.status).toBe("AUTORIZADO"); expect(a.eventoId).toBe(b.eventoId); expect(a).not.toHaveProperty("sequencia");
    expect(m.transporte).toHaveBeenCalledTimes(2);
  });
  it("ausência, autorização múltipla e status2 não autorizam reenvio/cancelamento presumido", async () => {
    const n = { ...notaFicticia(), IdentificadorInterno: "documento-ficticio" };
    const m = montar([{ Encontrada: false, Nota: null, Historico: [], erros: [], avisos: [], status: 0 }, { ...respostaFicticia(), Nota: n, Historico: [{ ...n, Chave: chaveFicticia(55, "000000124"), Numero: "124" }] }, { ...respostaFicticia(), Nota: { ...n, Status: 2 }, Historico: [] }]);
    for (let tentativa = 0; tentativa < 3; tentativa++) expect(await m.adaptador.consultar(m.identidade)).toMatchObject({ status: "PENDENTE_CONFERENCIA" });
  });
  it.each([55, 65] as const)("cancelamento %s conserva autorização e valida protocolo/evento135", async modelo => {
    const m = montar([{ Status: 1, CodStatusRespostaSefaz: 135, NuProtocolo: CANCELAMENTO, NumeroSequencial: 1, Error: "", Base64Xml: modelo === 55 ? b64(xmlEvento(modelo)) : null }, ...(modelo === 65 ? [b64(xmlEvento(modelo))] : [])], porta(modelo, true), modelo);
    const resposta = await m.adaptador.cancelar(m.identidade, "Motivo exclusivamente fictício para a suíte.");
    expect(resposta).toMatchObject({ status: "CANCELADO", protocolo: PROTOCOLO, protocoloCancelamento: CANCELAMENTO });
    expect(JSON.parse(String(m.transporte.mock.calls[0][1]?.body))).toEqual({ ChaveNF: chaveFicticia(modelo), Justificativa: "Motivo exclusivamente fictício para a suíte.", TipoAmbiente: 2, NumeroProtocolo: PROTOCOLO, TipoDocumento: 0 });
    if (modelo === 65) expect(JSON.parse(String(m.transporte.mock.calls[1][1]?.body))).toEqual({ ChaveNF: chaveFicticia(65), NuProtocolo: CANCELAMENTO, TipoArquivo: 1 });
  });
  it.each([1, 2, 3])("status evento%s sem135 não confirma cancelamento", async status => {
    const m = montar([{ Status: status, CodStatusRespostaSefaz: 100, NuProtocolo: CANCELAMENTO, NumeroSequencial: 1, Error: "" }], porta(55, true));
    expect(await m.adaptador.cancelar(m.identidade, "Motivo fictício válido somente na suíte.")).toMatchObject({ status: "PENDENTE_CONFERENCIA" });
    expect(m.transporte).toHaveBeenCalledTimes(1);
  });
  it("prazo de cancelamento recusado aparece claramente e não apaga a autorização", async () => {
    const m = montar([{ Status: 3, CodStatusRespostaSefaz: 501, NuProtocolo: null, NumeroSequencial: null, Error: "Detalhe externo nunca publicado" }], porta(55, true));
    const r = await m.adaptador.cancelar(m.identidade, "Cancelamento exclusivamente sintético.");
    expect(r.status).toBe("AUTORIZADO");
    expect(r.erro).toContain("Prazo de cancelamento"); expect(r.erro).toContain("501");
    expect(r.erro).not.toContain("Detalhe externo"); expect(m.transporte).toHaveBeenCalledTimes(1);
  });
  it("cancelamento incerto sem protocolo vai à conferência sem retransmitir", async () => {
    const p = porta(55, true); vi.mocked(p.obterAutorizacao).mockResolvedValue({ chave: chaveFicticia(), numero: "123", serie: "1", protocolo: PROTOCOLO, cancelamentoPendente: true });
    const m = montar([], p);
    expect(await m.adaptador.consultar(m.identidade)).toMatchObject({ status: "PENDENTE_CONFERENCIA" });
    expect(await m.adaptador.cancelar(m.identidade, "Motivo fictício válido somente na suíte.")).toMatchObject({ status: "PENDENTE_CONFERENCIA" });
    expect(m.transporte).not.toHaveBeenCalled();
  });
  it("cancelamento já protocolado recupera somente XML do próprio evento com flagfalse", async () => {
    const p = porta(55, true);
    vi.mocked(p.obterAutorizacao).mockResolvedValue({ chave: chaveFicticia(), numero: "123", serie: "1", protocolo: PROTOCOLO, protocoloCancelamento: CANCELAMENTO, cancelamentoPendente: false });
    const m = montar([b64(xmlEvento())], p);
    expect(await m.adaptador.consultar(m.identidade)).toMatchObject({ status: "CANCELADO", protocolo: PROTOCOLO, protocoloCancelamento: CANCELAMENTO });
    expect(m.transporte).toHaveBeenCalledTimes(1);
    expect(m.transporte.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/ObterArquivoEvento");
    expect(JSON.parse(String(m.transporte.mock.calls[0][1]?.body))).toEqual({ ChaveNF: chaveFicticia(), NuProtocolo: CANCELAMENTO, TipoArquivo: 1 });
  });
  it("falha ao obter XML do cancelamento preserva somente protocolo seguro para recuperação", async () => {
    const m = montar([{ Status: 1, CodStatusRespostaSefaz: 135, NuProtocolo: CANCELAMENTO, NumeroSequencial: 1, Error: "", Base64Xml: null }, b64("<html>erro externo fictício</html>")], porta(65, true), 65);
    const r = await m.adaptador.cancelar(m.identidade, "Motivo fictício válido somente na suíte.");
    expect(r).toMatchObject({ status: "PENDENTE_CONFERENCIA", protocoloCancelamento: CANCELAMENTO });
    expect(r).not.toHaveProperty("protocolo"); expect(m.transporte).toHaveBeenCalledTimes(2);
  });
  it("timeout do envio/cancelamento não repete operação nem expõe causa", async () => {
    const transporte = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const c = new ClienteBrasilNfe({ token: TOKEN }, { fetch: transporte, timeoutMs: 2 });
    const a = new AdaptadorBrasilNfeM1(c, "00000000000000", porta(55, true));
    await expect(a.cancelar(identidade(), "Motivo fictício válido somente na suíte.")).rejects.toMatchObject({ codigo: "TIMEOUT" });
    const b = new AdaptadorBrasilNfeM1(c, "00000000000000", porta());
    await expect(b.enviar(identidade(), {})).rejects.toMatchObject({ codigo: "TIMEOUT" });
    expect(transporte).toHaveBeenCalledTimes(2);
  });
  it("obtém exclusivamente XML/DANFE próprios e evento, nunca período/entrada", async () => {
    const p = porta(55, true); vi.mocked(p.obterAutorizacao).mockResolvedValue({ chave: chaveFicticia(), numero: "123", serie: "1", protocolo: PROTOCOLO, protocoloCancelamento: CANCELAMENTO });
    const m = montar([b64(xmlNota()), pdf(), b64(xmlEvento())], p);
    const documentos = await m.adaptador.obterDocumentos(m.identidade);
    expect(documentos.xml).toContain(PROTOCOLO); expect(documentos.xmlCancelamento).toContain(CANCELAMENTO); expect(documentos.pdf).toBeInstanceOf(Uint8Array);
    expect(m.transporte.mock.calls.map(c => JSON.parse(String(c[1]?.body)))).toEqual([{ ChaveNF: chaveFicticia(), FileType: 1, TipoDocumentoFiscal: 1 }, { ChaveNF: chaveFicticia(), FileType: 2, TipoDocumentoFiscal: 1 }, { ChaveNF: chaveFicticia(), NuProtocolo: CANCELAMENTO, TipoArquivo: 1 }]);
  });
  it("representação NFC-e segura é HTML separado, jamaisPDF", async () => {
    const m = montar([b64(xmlNota(65)), b64(`<html><body><table><tr><td>Documento fictício</td></tr></table><p>${chaveFicticia(65)}</p></body></html>`)], porta(65, true), 65);
    const r = await m.adaptador.obterDocumentos(m.identidade);
    expect(r.html).toContain(chaveFicticia(65)); expect(r).not.toHaveProperty("pdf");
  });
  it.each([`<script>alert(1)</script>`, `<a href="https://example.test">link</a>`, `<div onclick="alert(1)">x</div>`, `<iframe></iframe>`, `<img src="https://example.test/x" />`, `<div style="background:url(https://example.test)">x</div>`])("rejeita conteúdo ativo HTML %s", parte => {
    const html = `<html><body><p>${chaveFicticia(65)}</p>${parte}</body></html>`;
    expect(() => sanitizarHtmlNfceBrasilNfe(Buffer.from(html), chaveFicticia(65))).toThrow("inválido");
  });
  it("HTML malformado/sem identidade e XMLcancelamento divergente falham", () => {
    expect(() => sanitizarHtmlNfceBrasilNfe(Buffer.from("<html><body>incompleto"), chaveFicticia(65))).toThrow();
    expect(() => sanitizarHtmlNfceBrasilNfe(Buffer.from("<html><body>outra nota</body></html>"), chaveFicticia(65))).toThrow("divergente");
    expect(() => validarXmlCancelamentoBrasilNfe(b64(xmlEvento().replace("<tpAmb>2</tpAmb>", "<tpAmb>1</tpAmb>")), { identidade: identidade(), chave: chaveFicticia(), protocoloCancelamento: CANCELAMENTO })).toThrow("divergente");
  });
  it("arquivos só aceitam scalarBase64 e bloqueiam Token/UserToken refletidos decodificados", async () => {
    const codificado = [...TOKEN].map(c => `&#${c.charCodeAt(0)};`).join("");
    const m = montar([{ Base64Xml: b64(xmlNota()) }, b64(`<xml>${TOKEN}</xml>`), b64(`<xml>${USER}</xml>`), "%%%%", b64(`<html><body>${codificado}</body></html>`)]);
    const req = { ChaveNF: chaveFicticia(), FileType: 1 as const, TipoDocumentoFiscal: 1 as const };
    for (let n = 0; n < 5; n++) await expect(m.cliente.obterArquivoNotaFiscal(req)).rejects.not.toThrow(TOKEN);
    expect(m.transporte).toHaveBeenCalledTimes(5);
  });
});
