import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import type { RequisicaoAtualizacaoNumeracaoBrasilNfeHttp } from "@/lib/fiscal-saida/brasilnfe/numeracao-dto";
const TOKEN = "empresa-somente-sintetica-num", USER = "usuario-somente-sintetico-num";
const entrada: RequisicaoAtualizacaoNumeracaoBrasilNfeHttp = { TipoAmbiente: 2, ModeloDocumento: 55, Serie: "006", Numero: 1, Padrao: true };
const resposta = (dados: unknown, status = 200) => new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });
function cliente(dados: unknown) { const transporte = vi.fn<typeof fetch>().mockResolvedValue(resposta(dados)); return { transporte, cliente: new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte }) }; }
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("AtualizarNumeracao: contrato administrativo oficial sem emissão", () => {
  it.each([{ TipoAmbiente: 1, ModeloDocumento: 55, Serie: "6" }, { TipoAmbiente: 2, ModeloDocumento: 55, Serie: "006" }, { TipoAmbiente: 1, ModeloDocumento: 65, Serie: "7" }, { TipoAmbiente: 2, ModeloDocumento: 65, Serie: "007" }] as const)("mantém modelo/ambiente/serie separados (%#)", async contexto => {
    const comando = { ...entrada, ...contexto }, m = cliente({ status: true, Numeracao: comando, Error: "", Avisos: [], Token: TOKEN, UserToken: USER });
    expect(await m.cliente.atualizarNumeracao(comando)).toEqual({ ambiente: contexto.TipoAmbiente, modelo: contexto.ModeloDocumento, serie: contexto.Serie, numero: "1", padrao: true });
    expect(m.transporte).toHaveBeenCalledExactlyOnceWith("https://api.brasilnfe.com.br/services/empresa/AtualizarNumeracao", expect.objectContaining({ method: "POST", redirect: "error", cache: "no-store", body: JSON.stringify(comando), headers: { Accept: "application/json", "Content-Type": "application/json", Token: TOKEN, UserToken: USER } }));
  });
  it("recria somente o corpo permitido, sem propriedades extras", async () => {
    const m = cliente({ status: true, Numeracao: entrada });
    await m.cliente.atualizarNumeracao({ ...entrada, Token: USER, Emitir: true } as RequisicaoAtualizacaoNumeracaoBrasilNfeHttp);
    expect(m.transporte.mock.calls[0][1]?.body).toBe(JSON.stringify(entrada));
  });
  it.each([{ TipoAmbiente: 3 }, { ModeloDocumento: 10 }, { ModeloDocumento: "55" }, { Serie: "6x" }, { Serie: "1000" }, { Serie: 6 }, { Numero: 0 }, { Numero: -1 }, { Numero: 1.5 }, { Numero: 1000000000 }, { Numero: "1" }, { Padrao: "true" }])("entrada inválida não alcança HTTP (%#)", async mudanca => {
    const m = cliente({ status: true, Numeracao: entrada });
    await expect(m.cliente.atualizarNumeracao({ ...entrada, ...mudanca } as RequisicaoAtualizacaoNumeracaoBrasilNfeHttp)).rejects.toMatchObject({ codigo: "CONFIGURACAO_INCOMPLETA" });
    expect(m.transporte).not.toHaveBeenCalled();
  });
  it("UserToken obrigatório não é inferido do Token", async () => {
    const transporte = vi.fn<typeof fetch>();
    await expect(new ClienteBrasilNfe({ token: TOKEN }, { fetch: transporte }).atualizarNumeracao(entrada)).rejects.toMatchObject({ codigo: "CONFIGURACAO_INCOMPLETA" }); expect(transporte).not.toHaveBeenCalled();
  });
  it.each([{ TipoAmbiente: 1 }, { ModeloDocumento: 65 }, { Serie: "7" }, { Numero: 2 }, { Padrao: false }, { Numero: "1" }])("resposta com identidade/valor divergente permanece incerta (%#)", async mudanca => {
    await expect(cliente({ status: true, Numeracao: { ...entrada, ...mudanca } }).cliente.atualizarNumeracao(entrada)).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: "NUMERACAO_ITEM" });
  });
  it.each([0, 1, "true", null])("status de outro contrato não vira sucesso (%#)", async status => {
    await expect(cliente({ status, Numeracao: entrada }).cliente.atualizarNumeracao(entrada)).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA", etapaContrato: "NUMERACAO_ENVELOPE" });
  });
  it("status false conserva negação documentada sem texto externo nem retentativa", async () => {
    const m = cliente({ status: false, Error: `${TOKEN} ${USER} descrição privada` });
    try { await m.cliente.atualizarNumeracao(entrada); } catch (erro) {
      expect(erro).toMatchObject({ diagnosticoSeguro: { categoria: "NEGOCIO", httpStatus: 200, statusFornecedor: false } });
      expect(JSON.stringify(erro)).not.toMatch(/somente-sintet|descrição privada/); expect(erro).not.toHaveProperty("cause"); expect(m.transporte).toHaveBeenCalledTimes(1); return;
    } throw new Error("Falha sintética obrigatória.");
  });
  it.each([401, 403, 404, 429, 500])("HTTP %i não vira contador confirmado", async status => {
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(resposta({ Error: TOKEN }, status));
    await expect(new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte }).atualizarNumeracao(entrada)).rejects.toMatchObject({ diagnosticoSeguro: { categoria: "HTTP", httpStatus: status } }); expect(transporte).toHaveBeenCalledTimes(1);
  });
  it("timeout não repete a atualização", async () => {
    vi.useFakeTimers(); const transporte = vi.fn<typeof fetch>(() => new Promise(() => {}));
    const chamada = new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte, timeoutMs: 10 }).atualizarNumeracao(entrada);
    const conferir = expect(chamada).rejects.toMatchObject({ codigo: "TIMEOUT" }); await vi.advanceTimersByTimeAsync(11); await conferir; expect(transporte).toHaveBeenCalledTimes(1);
  });
  it("HTML/JSON inválido e falha de transporte não carregam conteúdo externo", async () => {
    for (const r of [new Response(TOKEN, { headers: { "content-type": "text/html" } }), new Response(`{${USER}`, { headers: { "content-type": "application/json" } })]) {
      const transporte = vi.fn<typeof fetch>().mockResolvedValue(r);
      await expect(new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte }).atualizarNumeracao(entrada)).rejects.toMatchObject({ codigo: "RESPOSTA_INVALIDA" }); expect(transporte).toHaveBeenCalledTimes(1);
    }
    const transporte = vi.fn<typeof fetch>().mockRejectedValue(new Error(TOKEN));
    await expect(new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: transporte }).atualizarNumeracao(entrada)).rejects.toMatchObject({ diagnosticoSeguro: { categoria: "TRANSPORTE" } });
  });
});
