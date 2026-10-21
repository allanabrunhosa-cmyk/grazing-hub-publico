import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AdaptadorBrasilNfeM1 } from "@/lib/fiscal-saida/brasilnfe/adaptador";
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { obterAdaptadorFiscalSaida } from "@/lib/fiscal-saida/provedor";
import { identidadeFicticia, respostaFicticia } from "./brasilnfe-fixtures";
describe("Adaptador técnico Brasil NFe M1", () => {
  it("registro operacional permanece ausente independentemente de credenciais", () => { expect(obterAdaptadorFiscalSaida()).toBeNull(); });
  it("todos os métodos operacionais falham; callback não autentica e nenhuma consulta é enviada", async () => {
    const cliente = { consultarNotaFiscal: vi.fn() }, a = new AdaptadorBrasilNfeM1(cliente, identidadeFicticia.emitenteCnpj);
    await expect(a.enviar(identidadeFicticia, {})).rejects.toThrow("Emissão ainda não liberada");
    await expect(a.cancelar(identidadeFicticia, "motivo fictício")).rejects.toThrow("Emissão ainda não liberada");
    await expect(a.consultar(identidadeFicticia)).rejects.toThrow("bloqueados");
    await expect(a.obterDocumentos(identidadeFicticia)).rejects.toThrow("bloqueados");
    expect(await a.autenticarRetorno(Buffer.from("retorno fictício"), new Headers())).toBeNull();
    expect(cliente.consultarNotaFiscal).not.toHaveBeenCalled();
  });
  it("consulta explícita somente produz evidências, com emitente e modelo vinculados", async () => {
    const cliente = { consultarNotaFiscal: vi.fn().mockResolvedValue(respostaFicticia()) }, a = new AdaptadorBrasilNfeM1(cliente, identidadeFicticia.emitenteCnpj);
    expect(await a.consultarEvidencias(identidadeFicticia)).toMatchObject({ documentoId: identidadeFicticia.documentoId, permiteReenvio: false });
    expect(cliente.consultarNotaFiscal).toHaveBeenCalledExactlyOnceWith({ IdentificadorInterno: identidadeFicticia.documentoId, TipoAmbiente: 2, ModeloDocumento: 55, RetornarArquivos: false });
    await expect(a.consultarEvidencias({ ...identidadeFicticia, emitenteCnpj: "11111111111111" })).rejects.toThrow("bloqueados");
    await expect(a.consultarEvidencias({ ...identidadeFicticia, ambiente: "PRODUCAO" })).rejects.toThrow("bloqueados");
    expect(cliente.consultarNotaFiscal).toHaveBeenCalledTimes(1);
  });
  it("timeout/credencial inválida não vira documento ausente ou sucesso", async () => {
    const cliente = { consultarNotaFiscal: vi.fn().mockRejectedValue(new Error("token-ficticio-nao-pode-vazar")) }, a = new AdaptadorBrasilNfeM1(cliente, identidadeFicticia.emitenteCnpj);
    await expect(a.consultarEvidencias(identidadeFicticia)).rejects.toThrow("comprovar");
    await expect(a.consultarEvidencias(identidadeFicticia)).rejects.not.toThrow("token-ficticio");
  });
  it("cliente real e adaptador compartilham o contrato de consulta e preservam int64", async () => {
    const wire = JSON.stringify(respostaFicticia()).replace('"90071992547409930001"', "90071992547409930001");
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(new Response(wire, { headers: { "content-type": "application/json" } }));
    const a = new AdaptadorBrasilNfeM1(new ClienteBrasilNfe({ token: "token-sintetico-exclusivo-suite" }, { fetch: transporte }), identidadeFicticia.emitenteCnpj);
    const r = await a.consultarEvidencias(identidadeFicticia);
    expect(r.autorizacoes[0].protocolo).toBe("90071992547409930001");
    expect(r.permiteReenvio).toBe(false);
    expect(transporte.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/ConsultarNotaFiscal");
    expect(JSON.parse(String(transporte.mock.calls[0][1]?.body))).toEqual({ IdentificadorInterno: identidadeFicticia.documentoId, ModeloDocumento: 55, TipoAmbiente: 2, RetornarArquivos: false });
  });
  it.each([401, 403, 404, 429, 500])("preserva HTTP %s na consulta, sem conservar corpo, credencial ou causa", async http => {
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(new Response('token-sintetico-exclusivo-suite causa externa', { status: http }));
    const a = new AdaptadorBrasilNfeM1(new ClienteBrasilNfe({ token: "token-sintetico-exclusivo-suite" }, { fetch: transporte }), identidadeFicticia.emitenteCnpj);
    const erro = await a.consultarEvidencias(identidadeFicticia).catch(e => e);
    expect(erro.diagnosticoSeguro).toMatchObject({ categoria: "HTTP", httpStatus: http });
    expect(JSON.stringify(erro)).not.toMatch(/token-sintetico|causa externa|cause/);
  });
  it.each([0, 1, false])("observa status %s sem alterar o contrato da consulta ou conservar textos", async status => {
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status, Encontrada: "incompativel", Historico: [], erros: [], Error: "", avisos: [] }), { headers: { "content-type": "application/json" } }));
    const a = new AdaptadorBrasilNfeM1(new ClienteBrasilNfe({ token: "token-sintetico" }, { fetch: transporte }), identidadeFicticia.emitenteCnpj);
    const erro = await a.consultarEvidencias(identidadeFicticia).catch(e => e);
    expect(erro.diagnosticoSeguro).toMatchObject({ httpStatus: 200, statusFornecedor: status, tipoStatusFornecedor: typeof status === "number" ? "NUMERO" : "BOOLEANO" });
    expect(JSON.stringify(erro)).not.toMatch(/Encontrada|incompativel|token-sintetico/);
  });
  it("suprime status que reflete credencial; indicadores não conservam Error ou itens de erros", async () => {
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: 1, erros: [{ descricao: "user-fixture-segredo" }], Error: "user-fixture-segredo" }), { headers: { "content-type": "application/json" } }));
    const a = new AdaptadorBrasilNfeM1(new ClienteBrasilNfe({ token: "1", userToken: "user-fixture-segredo" }, { fetch: transporte }), identidadeFicticia.emitenteCnpj);
    const erro = await a.consultarEvidencias(identidadeFicticia).catch(e => e);
    expect(erro.diagnosticoSeguro).toMatchObject({ httpStatus: 200, statusFornecedor: null, estadoStatusFornecedor: "SUPRIMIDO_SEGREDO", indicadores: ["STATUS_NUMERICO_NAO_ZERO", "ERROR_PREENCHIDO", "ERROS_PREENCHIDOS"] });
    expect(JSON.stringify(erro)).not.toMatch(/user-fixture|descricao/);
  });
});
