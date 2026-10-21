import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";
import type { AdaptadorFiscalSaida } from "@/lib/fiscal-saida/contrato";
const s = vi.hoisted(() => ({ transacao: vi.fn(), evento: vi.fn(), enviar: vi.fn(), consultar: vi.fn(), cancelar: vi.fn(), adapter: null as AdaptadorFiscalSaida | null, permissao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: s.transacao, eventoFiscalSaida: { findUnique: s.evento } } }));
vi.mock("@/lib/vendas/pedidos", () => ({ conferirAcesso: vi.fn(async () => ({ userId: "admin-ficticio" })) }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: s.permissao }));
vi.mock("@/lib/fiscal-saida/brasilnfe/configuracao", () => ({ conferirAcessoAdministrativoBrasilNfe: vi.fn(), obterClienteHomologacaoBrasilNfe: async () => ({ versao: 1, emitenteHash: "a".repeat(64), emitenteCnpj: "00000000000000", cliente: { enviarNotaFiscal: s.enviar, consultarNotaFiscal: s.consultar, cancelarNotaFiscal: s.cancelar } }) }));
vi.mock("@/lib/fiscal-saida/provedor", () => ({ obterAdaptadorFiscalSaida: () => s.adapter, BLOQUEIO_PRODUCAO_FISCAL_SAIDA: "Produção bloqueada.", BLOQUEIO_OPERACIONAL_BRASILNFE_M1: "Operação bloqueada." }));
import { executarComAutorizacaoManualBrasilNfe, exigirTransmissaoBrasilNfeLiberada, liberacaoTransmissaoBrasilNfe, transmissaoBrasilNfeLiberada } from "@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao";
import { configurarHabilitacaoEmissaoBrasilNfe, emitirNotaPedidoBrasilNfe, obterAdaptadorOperacionalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";
import { transmitirUmaHomologacaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/homologacao";
import { registrarCapacidadeEmissaoManualBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/capacidade-operacional";
import { executarFiscalSaidaManual, processarFiscalSaida, solicitarAcaoFiscalSaida } from "@/lib/fiscal-saida/servico";
import { criarAdaptadorBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe";
import { POST } from "@/app/api/fiscal-saida/retorno/route";
import { emitirNotaPedidoBrasilNfeAction } from "@/app/(protegido)/vendas/pedidos/emissao-actions";
import { identidadeFicticia, notaFicticia, respostaFicticia } from "./brasilnfe-fixtures";
const sessao = { userId: "admin-ficticio", versao: 0 } as SessaoAtual;
const comando = { documentoId: identidadeFicticia.documentoId, modelo: 55, ambiente: "HOMOLOGACAO", hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), total: "10.00", autorizarUmaTransmissao: true, conferenciaSemDocumentoExterno: true };
describe("Estrutura fiscal: não existe liberação global por cadastro, flag ou capacidade antiga", () => {
  beforeEach(() => { vi.clearAllMocks(); s.adapter = null; s.permissao.mockResolvedValue(sessao); s.evento.mockResolvedValue(null); });
  afterEach(() => vi.unstubAllEnvs());
  it.each(["development", "test", "production"])("ambiente %s e flags antigas não liberam emissão", nodeEnv => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    for (const nome of ["BRASIL_NFE_PRODUCAO_AUTORIZADA", "BRASIL_NFE_HOMOLOGACAO_AUTORIZADA", "BRASIL_NFE_EMISSAO_AUTOMATICA", "FISCAL_EMISSAO_HABILITADA"]) vi.stubEnv(nome, "true");
    expect(transmissaoBrasilNfeLiberada()).toBe(false); expect(liberacaoTransmissaoBrasilNfe()).toEqual({ liberada: false, motivo: "Emissão ainda não liberada." });
    expect(() => exigirTransmissaoBrasilNfeLiberada()).toThrow("Emissão ainda não liberada");
  });
  it.each(["HOMOLOGACAO", "PRODUCAO"] as const)("comando sem confirmação e habilitação incompleta em%s falham antes de banco/credenciais/rede", async ambiente => {
    await expect(emitirNotaPedidoBrasilNfe({ ...comando, ambiente, autorizarUmaTransmissao: false }, sessao)).rejects.toThrow("Confirme somente");
    await expect(configurarHabilitacaoEmissaoBrasilNfe({ ambiente, habilitada: true, confirmarAtivacao: true }, sessao)).rejects.toThrow("Confira o ambiente");
    await expect(transmitirUmaHomologacaoBrasilNfe({ ...comando, ambiente: 2 }, sessao)).rejects.toThrow("Emissão ainda não liberada");
    expect(s.transacao).not.toHaveBeenCalled(); expect(s.enviar).not.toHaveBeenCalled();
  });
  it("a action mantém permissão central antes de preparar qualquer contexto de transmissão", async () => {
    s.permissao.mockRejectedValueOnce(new Error("Permissão central recusada no teste sintético"));
    await expect(emitirNotaPedidoBrasilNfeAction(comando)).rejects.toThrow("Permissão central recusada");
    expect(s.permissao).toHaveBeenCalledWith("vendas.fiscal", "editar"); expect(s.transacao).not.toHaveBeenCalled();
  });
  it("factory com habilitação histórica válida conserva leitura e nega envio/cancelamento", async () => {
    const tx = { documentoFiscalSaida: { findUniqueOrThrow: vi.fn().mockResolvedValue({ ambiente: "HOMOLOGACAO", modeloDocumento: 55 }) }, eventoConfiguracaoBrasilNfe: { findMany: vi.fn().mockResolvedValue([{ id: "habilitacao-historica", createdAt: new Date("2026-10-01T12:00:00Z"), dados: { revisao: 1, ambiente: "HOMOLOGACAO", habilitada: true, modelos: [55], emitenteHash: "a".repeat(64), versaoConfiguracao: 1 } }]) } };
    s.transacao.mockImplementation(async f => f(tx));
    const a = await obterAdaptadorOperacionalBrasilNfe(sessao, identidadeFicticia.documentoId); expect(a).not.toBeNull();
    const bancoAntes = s.transacao.mock.calls.length;
    await expect(a!.enviar(identidadeFicticia, {})).rejects.toThrow("Emissão ainda não liberada");
    await expect(a!.cancelar(identidadeFicticia, "Justificativa exclusivamente sintética.")).rejects.toThrow("Emissão ainda não liberada");
    expect(s.transacao).toHaveBeenCalledTimes(bancoAntes); expect(s.enviar).not.toHaveBeenCalled(); expect(s.cancelar).not.toHaveBeenCalled();
  });
  it("capacidade manual anterior não permite enfileirar mutações nem ativar processador/callback", async () => {
    const a = s.adapter = { id: "BRASIL_NFE", ambiente: "HOMOLOGACAO", enviar: s.enviar, cancelar: s.cancelar, consultar: s.consultar, obterDocumentos: vi.fn(), autenticarRetorno: vi.fn() };
    registrarCapacidadeEmissaoManualBrasilNfe(a, identidadeFicticia.documentoId);
    for (const acao of ["ENVIAR", "CANCELAR"] as const) await expect(solicitarAcaoFiscalSaida(identidadeFicticia.documentoId, acao, "Motivo exclusivamente sintético.", sessao)).rejects.toThrow("Emissão ainda não liberada");
    await expect(executarFiscalSaidaManual(a, identidadeFicticia.documentoId, "ENVIAR", "Autorização anterior fictícia.", sessao)).rejects.toThrow("Emissão ainda não liberada");
    expect(await processarFiscalSaida()).toMatchObject({ processado: false, mensagem: "Emissão ainda não liberada." });
    expect((await POST(new Request("http://localhost/api/fiscal-saida/retorno", { method: "POST", body: "{}" }))).status).toBe(503);
    expect(s.transacao).not.toHaveBeenCalled(); expect(a.autenticarRetorno).not.toHaveBeenCalled(); expect(s.enviar).not.toHaveBeenCalled(); expect(s.cancelar).not.toHaveBeenCalled();
  });
  it("escopo válido de um documento não habilita processador automático, cancelamento ou callback", async () => {
    const a = s.adapter = { id: "BRASIL_NFE", ambiente: "HOMOLOGACAO", enviar: s.enviar, cancelar: s.cancelar, consultar: s.consultar, obterDocumentos: vi.fn(), autenticarRetorno: vi.fn() };
    registrarCapacidadeEmissaoManualBrasilNfe(a, identidadeFicticia.documentoId);
    await executarComAutorizacaoManualBrasilNfe({ empresaId: "singleton", emitenteCnpj: "00000000000000", usuarioId: sessao.userId, documentoId: identidadeFicticia.documentoId, modelo: 55, ambiente: "HOMOLOGACAO", hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), versaoConfiguracao: 1, habilitacaoId: "habilitacao-sintetica", autorizacaoId: "autorizacao-sintetica" }, async () => {
      expect(await processarFiscalSaida()).toMatchObject({ processado: false });
      await expect(solicitarAcaoFiscalSaida(identidadeFicticia.documentoId, "CANCELAR", "Justificativa exclusivamente sintética.", sessao)).rejects.toThrow("Emissão ainda não liberada");
      await expect(solicitarAcaoFiscalSaida("outro-documento-ficticio", "ENVIAR", "Justificativa exclusivamente sintética.", sessao)).rejects.toThrow("Emissão ainda não liberada");
      expect((await POST(new Request("http://localhost/api/fiscal-saida/retorno", { method: "POST", body: "{}" }))).status).toBe(503);
    });
    expect(s.transacao).not.toHaveBeenCalled(); expect(s.enviar).not.toHaveBeenCalled(); expect(s.cancelar).not.toHaveBeenCalled(); expect(a.autenticarRetorno).not.toHaveBeenCalled();
  });
  it.each(["HOMOLOGACAO", "PRODUCAO"] as const)("adaptador legado %s não transmite nem pré-visualiza, mesmo com flag de produção", async ambiente => {
    const transporte = vi.fn<typeof fetch>();
    const a = criarAdaptadorBrasilNfe({ token: "token-exclusivamente-sintetico", userToken: "user-exclusivamente-sintetico", cnpj: "00000000000000", ambiente, producaoAutorizada: true, consultaIdentificadorValidada: true, homologacaoReferencia: "Prova exclusivamente sintética" }, transporte);
    const i = { ...identidadeFicticia, ambiente };
    await expect(a.enviar(i, {})).rejects.toThrow("Emissão ainda não liberada"); await expect(a.cancelar(i, "Motivo exclusivamente fictício.")).rejects.toThrow("Emissão ainda não liberada");
    await expect(a.preVisualizar!(i, {})).rejects.toThrow("Emissão ainda não liberada"); expect(transporte).not.toHaveBeenCalled();
  });
  it("contexto da emissão nova não autoriza o adaptador legado nem o callback", async () => {
    const transporte = vi.fn<typeof fetch>();
    const a = criarAdaptadorBrasilNfe({ token: "token-exclusivamente-sintetico", userToken: "user-exclusivamente-sintetico", cnpj: "00000000000000", ambiente: "HOMOLOGACAO", producaoAutorizada: false, consultaIdentificadorValidada: true, homologacaoReferencia: "Prova exclusivamente sintética" }, transporte);
    await executarComAutorizacaoManualBrasilNfe({ empresaId: "singleton", emitenteCnpj: "00000000000000", usuarioId: sessao.userId, documentoId: identidadeFicticia.documentoId, modelo: 55, ambiente: "HOMOLOGACAO", hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), versaoConfiguracao: 1, habilitacaoId: "habilitacao-sintetica", autorizacaoId: "autorizacao-sintetica" }, async () => {
      await expect(a.enviar(identidadeFicticia, {})).rejects.toThrow("Emissão ainda não liberada");
      await expect(a.cancelar(identidadeFicticia, "Justificativa exclusivamente sintética.")).rejects.toThrow("Emissão ainda não liberada");
      await expect(a.preVisualizar!(identidadeFicticia, {})).rejects.toThrow("Emissão ainda não liberada");
      expect((await POST(new Request("http://localhost/api/fiscal-saida/retorno", { method: "POST", body: "{}" }))).status).toBe(503);
    });
    expect(transporte).not.toHaveBeenCalled();
  });
  it("consulta do próprio documento no legado continua disponível sem mutação", async () => {
    const transporte = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ ...respostaFicticia(), Nota: notaFicticia() }), { headers: { "content-type": "application/json" } }));
    const a = criarAdaptadorBrasilNfe({ token: "token-exclusivamente-sintetico", userToken: "user-exclusivamente-sintetico", cnpj: "00000000000000", ambiente: "HOMOLOGACAO", producaoAutorizada: false, consultaIdentificadorValidada: true, homologacaoReferencia: "Prova exclusivamente sintética" }, transporte);
    expect((await a.consultar(identidadeFicticia)).status).toBe("AUTORIZADO"); expect(transporte.mock.calls[0][0]).toBe("https://api.brasilnfe.com.br/services/fiscal/ConsultarNotaFiscal");
  });
});
