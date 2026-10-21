import { describe, expect, it } from "vitest";
import { interpretarRespostaAdn, resumirRespostaAdn } from "@/lib/nfse/resposta-distribuicao";

describe("contrato oficial da distribuição ADN", () => {
  it.each([200, 404])("aceita HTTP %s apenas com ausência explícita de documentos", http => {
    expect(interpretarRespostaAdn(http, JSON.stringify({
      StatusProcessamento: "NENHUM_DOCUMENTO_LOCALIZADO", LoteDFe: null, Erros: [],
    }))).toMatchObject({ nenhum: true, documentos: [], status: "NENHUM_DOCUMENTO_LOCALIZADO" });
  });
  it.each(["", "<html>Not Found</html>", "{}", "[]", "null"])("não transforma corpo inválido em ausência de notas: %s", corpo => {
    expect(() => interpretarRespostaAdn(404, corpo)).toThrow("sem confirmar ausência");
  });
  it.each([401, 403, 429, 500, 503])("não mascara falha HTTP %s mesmo com status de ausência no corpo", http => {
    expect(() => interpretarRespostaAdn(http, '{"StatusProcessamento":"NENHUM_DOCUMENTO_LOCALIZADO"}')).toThrow("Não foi possível verificar");
  });
  it("informa código e descrição da rejeição em vez de HTTP genérico", () => {
    expect(() => interpretarRespostaAdn(400, JSON.stringify({
      StatusProcessamento: "REJEICAO",
      Erros: [{ Codigo: "TESTE", Descricao: "CNPJ da consulta inválido", Complemento: "Confira o cadastro" }],
    }))).toThrow("TESTE — CNPJ da consulta inválido — Confira o cadastro");
  });
  it("rejeição em HTTP 200 também é falha", () => {
    expect(() => interpretarRespostaAdn(200, '{"StatusProcessamento":"REJEICAO"}')).toThrow("rejeitou");
  });
  it.each([[{}], "erro ilegível", [{ Codigo: "E999" }]])("não ignora erros sem descrição válida", erros => {
    expect(() => interpretarRespostaAdn(404, JSON.stringify({
      StatusProcessamento: "NENHUM_DOCUMENTO_LOCALIZADO", Erros: erros,
    }))).toThrow("Não foi possível verificar");
  });
  it.each([
    { StatusProcessamento: "DOCUMENTOS_LOCALIZADOS", LoteDFe: [] },
    { StatusProcessamento: "DOCUMENTOS_LOCALIZADOS", LoteDFe: [null] },
    { StatusProcessamento: "DOCUMENTOS_LOCALIZADOS", LoteDFe: {} },
    { StatusProcessamento: "NENHUM_DOCUMENTO_LOCALIZADO", LoteDFe: [{ NSU: 1 }] },
  ])("rejeita lote inconsistente com o status oficial", resposta => {
    expect(() => interpretarRespostaAdn(200, JSON.stringify(resposta))).toThrow("Não foi possível verificar");
  });
  it("não guarda XML ou corpo HTML no diagnóstico de comunicação", () => {
    const resultado = resumirRespostaAdn(200, JSON.stringify({
      StatusProcessamento: "DOCUMENTOS_LOCALIZADOS", LoteDFe: [{ ArquivoXml: "<segredo/>" }],
    }));
    expect(JSON.stringify(resultado.diagnostico)).not.toContain("segredo");
    expect(resultado.diagnostico).toEqual({ http: 200, status: "DOCUMENTOS_LOCALIZADOS", erros: [], alertas: [] });
  });
});
