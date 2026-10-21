import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClienteBrasilNfe, ErroHttpBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { interpretarConsultaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/consulta";
import { interpretarRecuperacaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/resposta-fiscal";
import { identidadeFicticia, notaFicticia, respostaFicticia, chaveFicticia } from "./brasilnfe-fixtures";
const token = "token-consulta-sintetico-nao-utilizavel", userToken = "usertoken-consulta-sintetico-nao-utilizavel";
const rejeitada = () => ({ ...notaFicticia(), Status: 3, Emitida: false, CodStatusResposta: 225, Chave: null, NumeroProtocolo: null });
async function consultar(resposta: unknown) {
  const transporte = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(resposta), { headers: { "Content-Type": "application/json" } }));
  const cliente = new ClienteBrasilNfe({ token, userToken }, { fetch: transporte });
  const dto = await cliente.consultarNotaFiscal({ documentoId: identidadeFicticia.documentoId, modelo: 55, ambiente: "HOMOLOGACAO" });
  expect(transporte).toHaveBeenCalledExactlyOnceWith("https://api.brasilnfe.com.br/services/fiscal/ConsultarNotaFiscal", expect.objectContaining({ method: "POST" }));
  return dto;
}
describe("Contrato exclusivo do envelope ConsultarNotaFiscal", () => {
  it.each([0, 1] as const)("preserva status %s coerente e autoriza apenas pela própria tentativa", async status => {
    const dto = await consultar({ ...respostaFicticia(), status }); expect(dto.status).toBe(status);
    const evidencia = interpretarConsultaBrasilNfe(dto, identidadeFicticia); expect(evidencia.statusConsulta).toBe(status); expect(evidencia.autorizacoes).toHaveLength(1);
    expect(interpretarRecuperacaoFiscalBrasilNfe(evidencia, identidadeFicticia)).toMatchObject({ status: "AUTORIZADO", chave: chaveFicticia(), protocolo: "90071992547409930001" });
  });
  it("status 1 processado com rejeição não significa autorização", async () => {
    const dto = await consultar({ ...respostaFicticia(), status: 1, Nota: rejeitada() }); const e = interpretarConsultaBrasilNfe(dto, identidadeFicticia);
    expect(e).toMatchObject({ statusConsulta: 1, autorizacoes: [], permiteReenvio: false }); expect(e.notaPrincipal).toMatchObject({ situacaoFornecedor: 3, codigoResposta: 225 });
    expect(interpretarRecuperacaoFiscalBrasilNfe(e, identidadeFicticia).status).toBe("PENDENTE_CONFERENCIA");
  });
  it("BR0008 informa sem localização sem liberar reenvio nem conservar mensagens", async () => {
    const dto = await consultar({ Encontrada: false, Nota: null, Historico: [], status: 1, erros: [{ codigo: "BR0008", descricao: token, correcao: userToken }], avisos: [token] });
    expect(dto).toMatchObject({ status: 1, Encontrada: false, erros: [{ codigo: "BR0008" }], avisos: [], avisosPresentes: true }); expect(JSON.stringify(dto)).not.toMatch(/token-consulta|usertoken-consulta/);
    const e = interpretarConsultaBrasilNfe(dto, identidadeFicticia); expect(e).toMatchObject({ encontrada: false, statusConsulta: 1, codigoAusencia: "BR0008", permiteReenvio: false, autorizacoes: [] });
    expect(interpretarRecuperacaoFiscalBrasilNfe(e, identidadeFicticia).status).toBe("PENDENTE_CONFERENCIA");
  });
  it.each([2, 3, -1, true, "1", null])("não aceita status %s como consulta processada", async status => {
    await expect(consultar({ ...respostaFicticia(), status })).rejects.toBeInstanceOf(ErroHttpBrasilNfe);
    expect(() => interpretarConsultaBrasilNfe({ ...respostaFicticia(), status }, identidadeFicticia)).toThrow();
  });
  it.each([
    { Error: token }, { erros: [{ codigo: "BR9999", descricao: token }] }, { erros: [{ codigo: token, descricao: userToken }] },
    { Encontrada: false, Nota: null, erros: [{ codigo: "BR0008" }, { codigo: "BR9999" }] },
    { erros: [{ codigo: "BR0008" }] }, { Encontrada: false, Nota: null, status: 0, erros: [{ codigo: "BR0008" }] },
    { Encontrada: false, Nota: null, Historico: [notaFicticia()], erros: [{ codigo: "BR0008" }] },
    { Encontrada: true, Nota: null }, { erros: [{ codigo: "BR0008", descricao: { token } }] },
  ])("erro desconhecido ou envelope contraditório falha sem vazamento: %#", async alteracao => {
    try { await consultar({ ...respostaFicticia(), status: 1, ...alteracao }); throw Error("Deveria recusar a fixture."); }
    catch (erro) { expect(erro).toBeInstanceOf(ErroHttpBrasilNfe); expect(JSON.stringify(erro)).not.toContain(token); expect(String(erro)).not.toContain(userToken); expect(erro).not.toHaveProperty("cause"); }
  });
  it.each([{ IdentificadorInterno: "outro-documento" }, { CodTipoAmbiente: 1 }, { ModeloDocumento: 65 }, { Numero: "124" }, { Serie: "2" }, { CnpjEmissor: "11111111111111" }])("confere identidade da principal e do histórico antes da projeção: %j", async alteracao => {
    await expect(consultar({ ...respostaFicticia(), status: 1, Nota: { ...notaFicticia(), ...alteracao } })).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
    await expect(consultar({ ...respostaFicticia(), status: 1, Historico: [{ ...notaFicticia(), ...alteracao }] })).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });
  it("emitente divergente na chave nunca cruza o limite do contexto fiscal", async () => {
    const dto = await consultar({ ...respostaFicticia(), status: 1, Nota: { ...notaFicticia(), Chave: chaveFicticia().replace("00000000000000", "11111111111111") } });
    expect(() => interpretarConsultaBrasilNfe(dto, identidadeFicticia)).toThrow("não corresponde");
  });
  it.each([{ Emitida: false }, { NumeroProtocolo: null }, { CodStatusResposta: 225 }])("envelope 1 não completa autorização fiscal parcial: %j", async alteracao => {
    await expect(consultar({ ...respostaFicticia(), status: 1, Nota: { ...notaFicticia(), ...alteracao } })).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });
  it("rejeição com protocolo ou código de autorização é contraditória", async () => {
    await expect(consultar({ ...respostaFicticia(), status: 1, Nota: { ...rejeitada(), CodStatusResposta: 100 } })).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });
  it("duas autorizações mantêm as tentativas e protocolos separados para conferência", async () => {
    const dto = await consultar({ ...respostaFicticia(), status: 1, Historico: [{ ...notaFicticia(), Chave: chaveFicticia(55, "000000124"), Numero: "124", NumeroProtocolo: "90071992547409930002" }] });
    const e = interpretarConsultaBrasilNfe(dto, identidadeFicticia); expect(e).toMatchObject({ statusConsulta: 1, motivo: "MULTIPLAS_AUTORIZACOES", permiteReenvio: false });
    expect(e.autorizacoes.map(a => a.protocolo)).toEqual(["90071992547409930001", "90071992547409930002"]); expect(interpretarRecuperacaoFiscalBrasilNfe(e, identidadeFicticia).status).toBe("PENDENTE_CONFERENCIA");
  });
  it("rejeição mais recente não apaga a autorização anterior nem mistura protocolos", async () => {
    const dto = await consultar({ ...respostaFicticia(), status: 1, Nota: rejeitada(), Historico: [notaFicticia()] });
    const e = interpretarConsultaBrasilNfe(dto, identidadeFicticia); expect(e.notaPrincipal?.protocolo).toBeNull(); expect(e.autorizacoes[0].protocolo).toBe("90071992547409930001");
    expect(interpretarRecuperacaoFiscalBrasilNfe(e, identidadeFicticia)).toMatchObject({ status: "AUTORIZADO", protocolo: "90071992547409930001" });
  });
});
