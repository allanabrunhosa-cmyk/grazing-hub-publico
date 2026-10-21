import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { interpretarConsultaBrasilNfe, prepararConsultaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/consulta";
import { identidadeFicticia, notaFicticia, respostaFicticia, chaveFicticia } from "./brasilnfe-fixtures";
describe("Consulta Brasil NFe delimitada e conservadora", () => {
  it.each([55, 65] as const)("consulta estável do modelo %s sem arquivos/ambiente qualquer", modeloDocumento => {
    expect(prepararConsultaBrasilNfe({ ...identidadeFicticia, modeloDocumento })).toEqual({ IdentificadorInterno: identidadeFicticia.documentoId, TipoAmbiente: 2, ModeloDocumento: modeloDocumento, RetornarArquivos: false });
  });
  it("considera autorização anterior mesmo se a tentativa principal foi rejeitada", () => {
    const r = respostaFicticia(); r.Nota = { ...notaFicticia(), Status: 3, Emitida: false, CodStatusResposta: 999, NumeroProtocolo: null as unknown as string }; r.Historico = [notaFicticia()];
    const consulta = interpretarConsultaBrasilNfe(r, identidadeFicticia);
    expect(consulta.autorizacoes).toHaveLength(1); expect(consulta.autorizacoes[0].protocolo).toBe("90071992547409930001");
    expect(consulta.permiteReenvio).toBe(false); expect(consulta.conferenciaNecessaria).toBe(true);
  });
  it("duas autorizações distintas exigem conferência, nunca elege silenciosamente a mais recente", () => {
    const r = respostaFicticia(); r.Historico = [{ ...notaFicticia(), Chave: chaveFicticia(55, "000000124"), Numero: "124" }];
    expect(interpretarConsultaBrasilNfe(r, identidadeFicticia)).toMatchObject({ motivo: "MULTIPLAS_AUTORIZACOES", permiteReenvio: false });
  });
  it("aceita série e número coerentes com zeros à esquerda sem perder protocolo", () => {
    const r = respostaFicticia(); r.Nota.Numero = "000000123"; r.Nota.Serie = "001";
    expect(interpretarConsultaBrasilNfe(r, identidadeFicticia).autorizacoes[0]).toMatchObject({ numero: "000000123", serie: "001", protocolo: "90071992547409930001" });
  });
  it.each([{ Numero: "999" }, { Serie: "2" }])("rejeita número/série divergente da chave na principal e no histórico: %j", alteracao => {
    const principal = respostaFicticia(); principal.Nota = { ...notaFicticia(), ...alteracao };
    expect(() => interpretarConsultaBrasilNfe(principal, identidadeFicticia)).toThrow("não corresponde");
    const historico = respostaFicticia(); historico.Historico = [{ ...notaFicticia(), ...alteracao }];
    expect(() => interpretarConsultaBrasilNfe(historico, identidadeFicticia)).toThrow("não corresponde");
  });
  it("ausência documentada não comprova idempotência nem autoriza reenvio", () => {
    const r = { ...respostaFicticia(), Encontrada: false, Nota: null };
    expect(interpretarConsultaBrasilNfe(r, identidadeFicticia)).toMatchObject({ encontrada: false, motivo: "AUSENCIA_SEM_GARANTIA_DE_IDEMPOTENCIA", permiteReenvio: false });
  });
  it.each([{ CodTipoAmbiente: 1 }, { ModeloDocumento: 65 }, { IdentificadorInterno: "outro-documento" }, { Chave: chaveFicticia().replace("00000000000000", "11111111111111") }])("rejeita identidade divergente em toda tentativa: %j", alteracao => {
    const r = respostaFicticia(); r.Historico = [{ ...notaFicticia(), ...alteracao }];
    expect(() => interpretarConsultaBrasilNfe(r, identidadeFicticia)).toThrow("não corresponde");
  });
  it("rejeita envelope, erro externo e números já imprecisos sem expor conteúdo", () => {
    expect(() => interpretarConsultaBrasilNfe("<html>credencial privada</html>", identidadeFicticia)).toThrow("comprovar");
    expect(() => interpretarConsultaBrasilNfe({ ...respostaFicticia(), erros: [{ descricao: "token secreto" }] }, identidadeFicticia)).toThrow("comprovar");
    const r = respostaFicticia(); r.Nota.NumeroProtocolo = Number.MAX_SAFE_INTEGER + 2 as unknown as string;
    expect(() => interpretarConsultaBrasilNfe(r, identidadeFicticia)).toThrow("comprovar");
    expect(prepararConsultaBrasilNfe({ ...identidadeFicticia, ambiente: "PRODUCAO" }).TipoAmbiente).toBe(1);
    expect(() => interpretarConsultaBrasilNfe(respostaFicticia(), { ...identidadeFicticia, ambiente: "PRODUCAO" })).toThrow("não corresponde");
    expect(() => prepararConsultaBrasilNfe({ ...identidadeFicticia, chaveIdempotencia: "pedido-ficticio" })).toThrow("comprovar");
  });
});
