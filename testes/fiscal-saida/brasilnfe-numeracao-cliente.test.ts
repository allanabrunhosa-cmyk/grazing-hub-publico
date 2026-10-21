import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { prepararPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
const TOKEN = "token-empresa-sintetico-num", USER = "token-usuario-sintetico-num";
const item = { TipoAmbiente: 2, ModeloDocumento: 55, Serie: "001", Numero: 12, Padrao: true };
const resposta = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status, headers: { "Content-Type": "application/json" } });
function cliente(dados: unknown) { const transporte = vi.fn<typeof fetch>().mockResolvedValue(resposta(dados)); return { transporte, cliente: new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte }) }; }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("ConsultarNumeracao: contrato próprio booleano e somente leitura", () => {
  it("consulta rota oficial sem body; só retorna modelos 55/65, com série preservada e sem segredos", async () => {
    const m = cliente({ status: true, Numeracoes: [item, { ...item, TipoAmbiente: 1, ModeloDocumento: 65 }, { ...item, ModeloDocumento: 10, Serie: "SER" }], Error: "", Avisos: [], Token: TOKEN, UserToken: USER });
    expect(await m.cliente.consultarNumeracao()).toEqual({ numeracoes: [{ ambiente: 2, modelo: 55, serie: "001", numero: "12", padrao: true }, { ambiente: 1, modelo: 65, serie: "001", numero: "12", padrao: true }], itensForaEscopo: 1, avisosPresentes: false });
    expect(m.transporte).toHaveBeenCalledTimes(1);
    expect(m.transporte.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/empresa/ConsultarNumeracao");
    expect(m.transporte.mock.calls[0][1]).toMatchObject({ method: "POST", body: undefined, headers: { Token: TOKEN, UserToken: USER } });
  });
  it("consulta de leitura funciona com bloqueio geral de transmissão ativo", async () => {
    const m = cliente({ status: true, Numeracoes: [], Avisos: [] });
    expect(await m.cliente.consultarNumeracao()).toEqual({ numeracoes: [], avisosPresentes: false });
  });
  it("não aplica limites de NF-e ao contador de outros modelos que serão descartados", async () => {
    const m = cliente({ status: true, Numeracoes: [item, { ...item, ModeloDocumento: 10, Serie: "SÉRIE-FORA-DESTE-PROJETO", Numero: 10000000000 }], Avisos: [] });
    expect((await m.cliente.consultarNumeracao()).numeracoes).toHaveLength(1);
  });
  it("credencial numérica refletida no contador também fica bloqueada", async () => {
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(resposta({ status: true, Numeracoes: [{ ...item, Numero: 123456789 }], Avisos: [] }));
    await expect(new ClienteBrasilNfe({ token: "123456789", userToken: USER }, { fetch: transporte }).consultarNumeracao()).rejects.toMatchObject({ etapaContrato: "SEGREDO_REFLETIDO" });
  });
  it("UserToken ausente falha antes de acessar rede", async () => {
    const transporte = vi.fn<typeof fetch>();
    await expect(new ClienteBrasilNfe({ token: TOKEN }, { fetch: transporte }).consultarNumeracao()).rejects.toMatchObject({ codigo: "CONFIGURACAO_INCOMPLETA" });
    expect(transporte).not.toHaveBeenCalled();
  });
  it.each([0, 1, "true", null, undefined])("não aplica status de outros endpoints: %s", async status => {
    await expect(cliente({ status, Numeracoes: [item] }).cliente.consultarNumeracao()).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: "NUMERACAO_ENVELOPE" });
  });
  it("false é erro de negócio, conservado como booleano seguro sem Error externo", async () => {
    try { await cliente({ status: false, Error: `${TOKEN} ${USER} erro livre`, Numeracoes: [] }).cliente.consultarNumeracao(); } catch (erro) {
      expect(erro).toMatchObject({ diagnosticoSeguro: { categoria: "NEGOCIO", httpStatus: 200, statusFornecedor: false, tipoStatusFornecedor: "BOOLEANO" } });
      expect(JSON.stringify(erro)).not.toContain(TOKEN); expect(String(erro)).not.toContain(USER); expect(erro).not.toHaveProperty("cause"); return;
    }
    throw new Error("Falha esperada");
  });
  it.each([{ Numero: 0 }, { Numero: 1000000000 }, { Numero: 1.5 }, { Numero: "12" }, { Serie: "1X" }, { Serie: "1000" }, { Serie: TOKEN }, { TipoAmbiente: 3 }, { ModeloDocumento: 0 }, { Padrao: 1 }])("recusa campo incompatível %j", async alteracao => {
    await expect(cliente({ status: true, Numeracoes: [{ ...item, ...alteracao }] }).cliente.consultarNumeracao()).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: "NUMERACAO_ITEM" });
  });
  it.each([[item, { ...item, Serie: "1" }], [item, { ...item, Serie: "2" }]])("recusa série duplicada ou dois padrões no mesmo contexto", async Numeracoes => {
    await expect(cliente({ status: true, Numeracoes }).cliente.consultarNumeracao()).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
  });
  it.each([401, 403, 404, 429, 500, 503])("preserva HTTP %s sem confundir 403 e credencial", async http => {
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(resposta({ Error: TOKEN }, http));
    await expect(new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte }).consultarNumeracao()).rejects.toMatchObject({ codigo: http === 401 ? "CREDENCIAL_INVALIDA" : "EXTERNO", diagnosticoSeguro: { categoria: "HTTP", httpStatus: http } });
  });
  it("timeout mantém falha e não faz nova tentativa", async () => {
    vi.useFakeTimers(); const transporte = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const promessa = new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte, timeoutMs: 10 }).consultarNumeracao();
    const verificacao = expect(promessa).rejects.toMatchObject({ codigo: "TIMEOUT" }); await vi.advanceTimersByTimeAsync(11); await verificacao;
    expect(transporte).toHaveBeenCalledTimes(1);
  });
  it("não JSON, JSON inválido e transporte não conservam mensagens externas", async () => {
    for (const r of [new Response(TOKEN, { headers: { "Content-Type": "text/html" } }), new Response(`{${USER}`, { headers: { "Content-Type": "application/json" } })]) {
      const m = new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: vi.fn<typeof fetch>().mockResolvedValue(r) });
      await expect(m.consultarNumeracao()).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" });
    }
    await expect(new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error(TOKEN)) }).consultarNumeracao()).rejects.toMatchObject({ diagnosticoSeguro: { categoria: "TRANSPORTE" } });
  });
  it("bloqueia envio e cancelamento antes da borda HTTP real sem mock de liberação", async () => {
    const transporte = vi.fn<typeof fetch>(), c = new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte });
    const massa = massaPayloadLocal();
    const plano = prepararPayloadLocalBrasilNfe(massa.documento, 55, massa.cadastro, massa.parametros);
    await expect(c.enviarNotaFiscal(plano)).rejects.toMatchObject({ codigo: "TRANSMISSAO_BLOQUEADA" });
    await expect(c.cancelarNotaFiscal({ ChaveNF: "0".repeat(44), Justificativa: "Justificativa sintética de teste", TipoAmbiente: 2, NumeroProtocolo: "0".repeat(15), TipoDocumento: 0 })).rejects.toMatchObject({ codigo: "TRANSMISSAO_BLOQUEADA" });
    expect(transporte).not.toHaveBeenCalled();
  });
});
