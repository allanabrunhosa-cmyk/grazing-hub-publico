import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executarComAutorizacaoManualBrasilNfe, type ContextoTransmissaoManualBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao";
import { ClienteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cliente";
import { prepararPayloadLocalBrasilNfe, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";
import { chaveFicticia } from "./brasilnfe-fixtures";

function plano(modelo: 55 | 65 = 55, alterar?: (massa: ReturnType<typeof massaPayloadLocal>) => void) {
  const massa = massaPayloadLocal(); alterar?.(massa);
  return prepararPayloadLocalBrasilNfe(massa.documento, modelo, massa.cadastro, massa.parametros);
}
function contexto(resultado: ReturnType<typeof plano>): ContextoTransmissaoManualBrasilNfe {
  return { empresaId: "singleton", emitenteCnpj: "00000000000000", usuarioId: "usuario-exclusivamente-sintetico", documentoId: resultado.documentoId,
    modelo: resultado.modelo, ambiente: "HOMOLOGACAO", hashSnapshot: resultado.hashPayload, hashPayloadFiscal: createHash("sha256").update(serializarPayloadLocalBrasilNfe(resultado)).digest("hex"),
    versaoConfiguracao: 1, habilitacaoId: "habilitacao-exclusivamente-sintetica", autorizacaoId: "autorizacao-exclusivamente-sintetica" };
}
function cliente() {
  const http = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ ReturnNF: { Numero: "123", Serie: "1", ChaveNF: chaveFicticia(), NumeroProtocolo: "90071992547409930001", CodTipoAmbiente: 2, CodStatusRespostaSefaz: 100, Ok: true }, Error: "", Avisos: [] }), { headers: { "content-type": "application/json" } }));
  return { http, cliente: new ClienteBrasilNfe({ token: "token-exclusivamente-sintetico-cliente" }, { fetch: http }) };
}
const guardiao = <T>(acao: () => Promise<T>) => acao();

describe("Última barreira HTTP vincula a autorização ao payload fiscal exato", () => {
  it("plano selado correto, ambiente e hashes autorizados permitem somente um POST", async () => {
    const autorizado = plano(), m = cliente();
    await executarComAutorizacaoManualBrasilNfe(contexto(autorizado), async () => {
      expect(await m.cliente.enviarNotaFiscal(autorizado)).toMatchObject({ ok: true, codigoSefaz: 100 });
      await expect(m.cliente.enviarNotaFiscal(autorizado)).rejects.toThrow("Emissão ainda não liberada");
    }, guardiao);
    expect(m.http).toHaveBeenCalledTimes(1);
  });
  it.each(["DOCUMENTO", "MODELO", "SNAPSHOT", "PAYLOAD_FISCAL"] as const)("plano selado com%s diferente não usa o escopo de outro documento", async campo => {
    const autorizado = plano(), m = cliente();
    const divergente = campo === "MODELO" ? plano(65) : plano(55, massa => {
      if (campo === "DOCUMENTO") { massa.documento.id = "outro-documento-sintetico"; massa.parametros.vinculo.documentoId = massa.documento.id; }
      if (campo === "SNAPSHOT") { massa.documento.payload.pedido.id = "outro-pedido-sintetico"; massa.documento.hashPayload = createHash("sha256").update(JSON.stringify(massa.documento.payload)).digest("hex"); massa.parametros.vinculo.hashPayload = massa.documento.hashPayload; }
      if (campo === "PAYLOAD_FISCAL") massa.parametros.operacao.NaturezaOperacao = "Outra natureza exclusivamente sintética";
    });
    expect(divergente.montagemConcluida).toBe(true);
    await executarComAutorizacaoManualBrasilNfe(contexto(autorizado), async () => {
      await expect(m.cliente.enviarNotaFiscal(divergente)).rejects.toThrow("Emissão ainda não liberada");
    }, guardiao);
    expect(m.http).not.toHaveBeenCalled();
  });
  it("sem guardião ou fora do escopo o plano correto não alcança a rede", async () => {
    const autorizado = plano(), m = cliente();
    await expect(m.cliente.enviarNotaFiscal(autorizado)).rejects.toThrow("Emissão ainda não liberada");
    await executarComAutorizacaoManualBrasilNfe(contexto(autorizado), async () => {
      await expect(m.cliente.enviarNotaFiscal(autorizado)).rejects.toThrow("Emissão ainda não liberada");
    });
    expect(m.http).not.toHaveBeenCalled();
  });
  it("recusa local do guardião não aparece como falha de transporte nem expõe seu erro", async () => {
    const autorizado = plano(), m = cliente();
    await executarComAutorizacaoManualBrasilNfe(contexto(autorizado), async () => {
      await expect(m.cliente.enviarNotaFiscal(autorizado)).rejects.toMatchObject({ codigo: "TRANSMISSAO_BLOQUEADA", message: "Emissão ainda não liberada." });
    }, async () => { throw new Error("Mensagem privada exclusivamente sintética"); });
    expect(m.http).not.toHaveBeenCalled();
  });
});
