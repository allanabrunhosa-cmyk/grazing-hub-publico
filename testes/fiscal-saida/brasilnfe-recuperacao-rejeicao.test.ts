import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { interpretarConsultaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/consulta";
import { interpretarRecuperacaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/resposta-fiscal";
import { chaveFicticia, identidadeFicticia, notaFicticia, respostaFicticia } from "./brasilnfe-fixtures";
const rejeitada = (codigo = 181) => ({ ...notaFicticia(), Status: 3, Emitida: false, CodStatusResposta: codigo, NumeroProtocolo: null });
function recuperar(nota: unknown, historico: unknown[] = [], status = 1) {
  const e = interpretarConsultaBrasilNfe({ ...respostaFicticia(), status, Nota: nota, Historico: historico }, identidadeFicticia);
  return { evidencia: e, retorno: interpretarRecuperacaoFiscalBrasilNfe(e, identidadeFicticia) };
}
describe("Recuperação de rejeição única com identidade fiscal comprovada", () => {
  it.each([0, 1])("181 é rejeição da tentativa, não status do envelope %s nem autorização", status => {
    const r = recuperar(rejeitada(), [], status);
    expect(r.evidencia).toMatchObject({ statusConsulta: status, autorizacoes: [], permiteReenvio: false });
    expect(r.retorno).toMatchObject({ status: "REJEITADO", ordenacao: "LOCAL_OBSERVACAO", chave: chaveFicticia(), referencia: chaveFicticia(), numero: "123", serie: "1", erro: expect.stringContaining("181") });
    expect(r.retorno).not.toHaveProperty("protocolo"); expect(r.retorno.erro).toContain("reenvio automático permanece bloqueado");
    expect(recuperar(rejeitada(), [], status).retorno.eventoId).toBe(r.retorno.eventoId);
  });
  it.each([215, 225, 386, 725, 787])("aceita rejeição %s da lista restrita em uma única tentativa", codigo => {
    expect(recuperar(rejeitada(codigo)).retorno.status).toBe("REJEITADO");
  });
  it.each([182, 204, 539, 105, 108, 999])("código não incluído %s exige conferência", codigo => {
    expect(recuperar(rejeitada(codigo)).retorno.status).toBe("PENDENTE_CONFERENCIA");
  });
  it.each([204, 539])("consulta explica a duplicidade %s e preserva bloqueio de reenvio", codigo => {
    const r = recuperar(rejeitada(codigo));
    expect(r.retorno).toMatchObject({ status: "PENDENTE_CONFERENCIA", erro: expect.stringContaining("Duplicidade") });
    expect(r.retorno.erro).toContain(String(codigo)); expect(r.evidencia.permiteReenvio).toBe(false);
  });
  it("rejeição recuperada conserva motivo do CFOP da NFC-e", () => {
    expect(recuperar(rejeitada(725)).retorno).toMatchObject({ status: "REJEITADO", erro: expect.stringContaining("CFOP inválido para NFC-e") });
  });
  it("sem prova do emitente não presume rejeição comprovada", () => {
    const r = recuperar({ ...rejeitada(), Chave: null }); expect(r.retorno.status).toBe("PENDENTE_CONFERENCIA"); expect(r.evidencia.permiteReenvio).toBe(false);
  });
  it("histórico de rejeições múltiplas não elege uma tentativa para liberar resultado", () => {
    const r = recuperar(rejeitada(), [{ ...rejeitada(225), Chave: chaveFicticia(55, "000000124"), Numero: "124" }]);
    expect(r.retorno.status).toBe("PENDENTE_CONFERENCIA"); expect(r.evidencia.historico).toHaveLength(1); expect(r.evidencia.permiteReenvio).toBe(false);
  });
  it("autorização anterior com outra chave ou denegação no histórico mantém conferência", () => {
    const a = recuperar(rejeitada(), [{ ...notaFicticia(), Chave: chaveFicticia(55, "000000124"), Numero: "124" }]); expect(a.retorno.status).toBe("PENDENTE_CONFERENCIA");
    const d = recuperar(rejeitada(), [{ ...notaFicticia(), Status: 4, Emitida: false, CodStatusResposta: 301 }]); expect(d.retorno.status).toBe("PENDENTE_CONFERENCIA");
  });
  it.each([{ Emitida: true }, { NumeroProtocolo: "900719925474099312345" }])("contradição de emissão/protocolo falha sem classificar rejeição: %j", alteracao => {
    expect(() => recuperar({ ...rejeitada(), ...alteracao })).toThrow();
  });
  it("não aplica uma evidência a outro identificador", () => {
    const e = recuperar(rejeitada()).evidencia; expect(() => interpretarRecuperacaoFiscalBrasilNfe(e, { ...identidadeFicticia, documentoId: "outro-doc", chaveIdempotencia: "outro-doc" })).toThrow("não corresponde");
  });
  it("mensagens externas não são copiadas para o retorno fiscal", () => {
    const r = recuperar({ ...rejeitada(), DsStatusResposta: "token-sintetico-privado", Token: "token-sintetico-privado" }); expect(JSON.stringify(r)).not.toContain("token-sintetico-privado");
  });
});
