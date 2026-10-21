import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { sanitizarItemNumeracaoBrasilNfe, sanitizarMetadadosErroBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/diagnostico-http";

const TOKEN = "segredo-token-empresa-num-testes", USER = "segredo-usertoken-num-testes";
const linha = { ModeloDocumento: 55, TipoAmbiente: 2, Serie: "001", Numero: 12, Padrao: true };
async function falha(Numeracoes: unknown[]) {
  const c = new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: true, Numeracoes, Error: "", Avisos: [] }), { headers: { "Content-Type": "application/json" } })) });
  try { await c.consultarNumeracao(); } catch (erro) { return erro; }
  throw Error("Falha esperada.");
}
describe("diagnóstico restrito do item de numeração", () => {
  it.each([
    [undefined, "ITEM", "AUSENTE", "AUSENTE"],
    [null, "ITEM", "NULO", "NULO"],
    [[], "ITEM", "ARRAY", "TIPO_INCOMPATIVEL"],
    [{ ...linha, ModeloDocumento: "55" }, "ModeloDocumento", "TEXTO", "TIPO_INCOMPATIVEL"],
    [{ ...linha, ModeloDocumento: 0 }, "ModeloDocumento", "INTEIRO", "FORA_LIMITE"],
    [{ ...linha, TipoAmbiente: 0 }, "TipoAmbiente", "INTEIRO", "FORA_LISTA"],
    [{ ...linha, TipoAmbiente: false }, "TipoAmbiente", "BOOLEANO", "TIPO_INCOMPATIVEL"],
    [{ ...linha, Serie: 1 }, "Serie", "INTEIRO", "TIPO_INCOMPATIVEL"],
    [{ ...linha, Serie: "1000" }, "Serie", "TEXTO", "FORMATO_INCOMPATIVEL"],
    [{ ...linha, Numero: undefined }, "Numero", "AUSENTE", "AUSENTE"],
    [{ ...linha, Numero: null }, "Numero", "NULO", "NULO"],
    [{ ...linha, Numero: "12" }, "Numero", "TEXTO", "TIPO_INCOMPATIVEL"],
    [{ ...linha, Numero: 0 }, "Numero", "INTEIRO", "FORA_LIMITE"],
    [{ ...linha, Numero: 1.5 }, "Numero", "NUMERO_NAO_INTEIRO", "FORA_LIMITE"],
    [{ ...linha, Padrao: 1 }, "Padrao", "INTEIRO", "TIPO_INCOMPATIVEL"],
  ])("indica campo/tipo/condição sem conservar o valor (%s)", async (entrada, campo, tipoObservado, motivo) => {
    // undefined vira null na lista JSON. A ausência de campo é coberta por Numero.
    const observado = entrada === undefined ? { tipoObservado: "NULO", motivo: "NULO" } : { tipoObservado, motivo };
    expect(await falha([entrada])).toMatchObject({ etapaContrato: "NUMERACAO_ITEM", diagnosticoSeguro: {
      categoria: "CONTRATO", httpStatus: 200, itemNumeracao: { posicao: 1, campo, ...observado },
    } });
  });
  it.each([
    [[linha, { ...linha, Serie: "1" }], "Serie", "SERIE_DUPLICADA"],
    [[linha, { ...linha, Serie: "2" }], "Padrao", "PADRAO_DUPLICADO"],
  ])("posiciona a segunda linha conflitante", async (lista, campo, motivo) => {
    expect(await falha(lista as unknown[])).toMatchObject({ diagnosticoSeguro: { itemNumeracao: { posicao: 2, campo, motivo } } });
  });
  it("não deixa um modelo adicional identificável impedir a leitura de 55/65", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ status: true,
      Numeracoes: [linha, { ModeloDocumento: 99, TipoAmbiente: 0, Serie: TOKEN, Numero: null, Padrao: "outro contrato" },
        { ModeloDocumento: 10 }, { ...linha, ModeloDocumento: 65 }], Avisos: [] }), { headers: { "Content-Type": "application/json" } }));
    const resposta = await new ClienteBrasilNfe({ token: TOKEN, userToken: USER }, { fetch: fetchMock }).consultarNumeracao();
    expect(resposta).toEqual({ numeracoes: [{ modelo: 55, ambiente: 2, serie: "001", numero: "12", padrao: true },
      { modelo: 65, ambiente: 2, serie: "001", numero: "12", padrao: true }], avisosPresentes: false, itensForaEscopo: 2 });
    expect(JSON.stringify(resposta)).not.toContain(TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([55, 65])("não descarta registro inválido do modelo %s entre outros modelos", async modelo => {
    expect(await falha([{ ModeloDocumento: 99 }, { ...linha, ModeloDocumento: modelo, Serie: 1 }])).toMatchObject({ diagnosticoSeguro: {
      itemNumeracao: { posicao: 2, campo: "Serie", tipoObservado: "INTEIRO", motivo: "TIPO_INCOMPATIVEL" },
    } });
  });
  it.each([undefined, null, "55", false, 55.5, {}, []])("modelo não identificável não é descartado %s", async ModeloDocumento => {
    expect(await falha([{ ...linha, ModeloDocumento }])).toMatchObject({ diagnosticoSeguro: { itemNumeracao: { campo: "ModeloDocumento" } } });
  });
  it.each(["ModeloDocumento", "TipoAmbiente", "Serie", "Numero", "Padrao"]) ("não conserva credencial refletida em %s", async campo => {
    const erro = await falha([{ ...linha, [campo]: `${TOKEN}<script>${USER}</script>`, inesperado: { Token: TOKEN } }]);
    const serializado = JSON.stringify(erro);
    expect(serializado).not.toContain(TOKEN); expect(serializado).not.toContain(USER); expect(serializado).not.toContain("<script>");
    expect(erro).not.toHaveProperty("cause"); expect(erro).not.toHaveProperty("response");
  });
  it("restaura só as quatro propriedades locais permitidas", () => {
    const entrada = { posicao: 2, campo: "Serie", tipoObservado: "TEXTO", motivo: "FORMATO_INCOMPATIVEL", valor: TOKEN, resposta: { UserToken: USER }, cause: Error(TOKEN) };
    const esperado = { posicao: 2, campo: "Serie", tipoObservado: "TEXTO", motivo: "FORMATO_INCOMPATIVEL" };
    expect(sanitizarItemNumeracaoBrasilNfe(entrada)).toEqual(esperado);
    expect(sanitizarMetadadosErroBrasilNfe({ categoria: "CONTRATO", etapaContrato: "NUMERACAO_ITEM", itemNumeracao: entrada })?.itemNumeracao).toEqual(esperado);
    expect(sanitizarMetadadosErroBrasilNfe({ categoria: "NEGOCIO", etapaContrato: "SERVICOS_ENVELOPE", itemNumeracao: entrada })).not.toHaveProperty("itemNumeracao");
  });
  it.each([0, -1, 1.5, 1001, "1", null])("recusa posição não permitida %s", posicao => {
    expect(sanitizarItemNumeracaoBrasilNfe({ posicao, campo: "Serie", tipoObservado: "TEXTO", motivo: "FORMATO_INCOMPATIVEL" })).toBeNull();
  });
  it.each(["campo", "tipoObservado", "motivo"])("recusa enum livre em %s", campo => {
    expect(sanitizarItemNumeracaoBrasilNfe({ posicao: 1, campo: "Serie", tipoObservado: "TEXTO", motivo: "FORMATO_INCOMPATIVEL", [campo]: TOKEN })).toBeNull();
  });
});
