import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { executarComAutorizacaoManualBrasilNfe, executarTransporteManualBrasilNfe, exigirTransmissaoBrasilNfeLiberada, liberacaoTransmissaoBrasilNfe, transmissaoBrasilNfeLiberada, type ContextoTransmissaoManualBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/bloqueio-transmissao";

const contexto = (mudancas: Partial<ContextoTransmissaoManualBrasilNfe> = {}): ContextoTransmissaoManualBrasilNfe => ({
  empresaId: "singleton", emitenteCnpj: "00000000000000", usuarioId: "usuario-exclusivamente-sintetico", documentoId: "documento-exclusivamente-sintetico",
  modelo: 55, ambiente: "HOMOLOGACAO", hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), versaoConfiguracao: 1,
  habilitacaoId: "habilitacao-exclusivamente-sintetica", autorizacaoId: "autorizacao-exclusivamente-sintetica", ...mudancas,
});
const restricao = (c: ContextoTransmissaoManualBrasilNfe) => ({ documentoId: c.documentoId, ambiente: c.ambiente, modelo: c.modelo, emitenteCnpj: c.emitenteCnpj, hashSnapshot: c.hashSnapshot, hashPayloadFiscal: c.hashPayloadFiscal, operacao: "ENVIAR" as const });

describe("Transmissão manual limitada ao escopo autenticado da ação", () => {
  it("cancelamento individual não autoriza emissão, outro documento ou transporte repetido", async () => {
    const c = contexto({ operacao: "CANCELAR" }), http = vi.fn(async () => "evento");
    await executarComAutorizacaoManualBrasilNfe(c, async () => {
      expect(transmissaoBrasilNfeLiberada({ ...restricao(c), operacao: "CANCELAR" })).toBe(true);
      expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(false);
      expect(transmissaoBrasilNfeLiberada({ ...restricao(c), operacao: "CANCELAR", documentoId: "outro" })).toBe(false);
      expect(await executarTransporteManualBrasilNfe(http)).toBe("evento");
      await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Emissão ainda não liberada");
    }, executar => executar());
    expect(http).toHaveBeenCalledTimes(1);
    expect(transmissaoBrasilNfeLiberada({ operacao: "CANCELAR" })).toBe(false);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it.each(["development", "test", "production"])("sem contexto o runtime%s e flags não habilitam transmissão", nodeEnv => {
    vi.stubEnv("NODE_ENV", nodeEnv);
    for (const chave of ["BRASIL_NFE_PRODUCAO_AUTORIZADA", "BRASIL_NFE_HOMOLOGACAO_AUTORIZADA", "BRASIL_NFE_EMISSAO_AUTOMATICA", "FISCAL_EMISSAO_HABILITADA"]) vi.stubEnv(chave, "true");
    expect(transmissaoBrasilNfeLiberada()).toBe(false);
    expect(transmissaoBrasilNfeLiberada(restricao(contexto({ ambiente: "PRODUCAO" })))).toBe(false);
    expect(liberacaoTransmissaoBrasilNfe()).toEqual({ liberada: false, motivo: "Emissão ainda não liberada." });
    expect(() => exigirTransmissaoBrasilNfeLiberada()).toThrow("Emissão ainda não liberada");
  });
  it.each(["HOMOLOGACAO", "PRODUCAO"] as const)("capacidade servidor válida fica restrita ao documento/emitente/modelo/ambiente%s", async ambiente => {
    const c = contexto({ ambiente });
    await executarComAutorizacaoManualBrasilNfe(c, async () => {
      expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(true);
      expect(() => exigirTransmissaoBrasilNfeLiberada(restricao(c))).not.toThrow();
      for (const alteracao of [{ documentoId: "outro-documento-ficticio" }, { modelo: 65 as const }, { ambiente: ambiente === "HOMOLOGACAO" ? "PRODUCAO" as const : "HOMOLOGACAO" as const }, { emitenteCnpj: "11111111111111" }, { hashSnapshot: "c".repeat(64) }, { hashPayloadFiscal: "d".repeat(64) }]) {
        expect(transmissaoBrasilNfeLiberada({ ...restricao(c), ...alteracao })).toBe(false);
        expect(() => exigirTransmissaoBrasilNfeLiberada({ ...restricao(c), ...alteracao })).toThrow("Emissão ainda não liberada");
      }
      expect(transmissaoBrasilNfeLiberada({ ...restricao(c), operacao: "CANCELAR" })).toBe(false);
      expect(transmissaoBrasilNfeLiberada({ ...restricao(c), canal: "LEGADO" })).toBe(false);
    });
    expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(false);
  });
  it.each([
    { empresaId: "outra-empresa" }, { emitenteCnpj: "invalido" }, { usuarioId: "" }, { documentoId: "" }, { modelo: 57 }, { ambiente: "DESCONHECIDO" },
    { hashSnapshot: "hash-nao-comprovado" }, { hashPayloadFiscal: "" }, { versaoConfiguracao: 0 }, { versaoConfiguracao: 1.5 }, { habilitacaoId: "" }, { autorizacaoId: "" },
  ])("metadado obrigatório inválido não abre escopo: %j", async mudanca => {
    const acao = vi.fn(async () => "nao executado");
    await expect(executarComAutorizacaoManualBrasilNfe({ ...contexto(), ...mudanca } as ContextoTransmissaoManualBrasilNfe, acao)).rejects.toThrow("Emissão ainda não liberada");
    expect(acao).not.toHaveBeenCalled(); expect(transmissaoBrasilNfeLiberada()).toBe(false);
  });
  it("erro encerra capacidade no finally sem habilitar outra ação", async () => {
    const c = contexto();
    await expect(executarComAutorizacaoManualBrasilNfe(c, async () => { expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(true); throw new Error("Falha exclusivamente sintética"); })).rejects.toThrow("Falha exclusivamente sintética");
    expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(false);
  });
  it("continuação destacada não conserva a autorização depois do término da ação", async () => {
    const c = contexto(); let liberar!: () => void, tardia!: Promise<boolean>;
    await executarComAutorizacaoManualBrasilNfe(c, async () => { const espera = new Promise<void>(r => { liberar = r; }); tardia = espera.then(() => transmissaoBrasilNfeLiberada(restricao(c))); });
    liberar(); expect(await tardia).toBe(false);
  });
  it("escopo expira sem prolongar a autorização original", async () => {
    const c = contexto(), instante = Date.now(); const relogio = vi.spyOn(Date, "now").mockReturnValue(instante);
    await executarComAutorizacaoManualBrasilNfe(c, async () => {
      relogio.mockReturnValue(instante + 119999); expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(true);
      relogio.mockReturnValue(instante + 120000); expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(false);
      expect(() => exigirTransmissaoBrasilNfeLiberada(restricao(c))).toThrow("Emissão ainda não liberada");
    });
  });
  it("escopo aninhado é recusado sem substituir a autorização externa", async () => {
    const c = contexto();
    await executarComAutorizacaoManualBrasilNfe(c, async () => {
      await expect(executarComAutorizacaoManualBrasilNfe(contexto({ documentoId: "outro-documento-ficticio" }), async () => "indevido")).rejects.toThrow("Emissão ainda não liberada");
      expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(true);
    });
  });
  it("contextos concorrentes não compartilham autorização", async () => {
    const a = contexto(), b = contexto({ documentoId: "segundo-documento-ficticio", ambiente: "PRODUCAO", modelo: 65 });
    let liberar!: () => void, avisar!: () => void; const entrou = new Promise<void>(r => { avisar = r; }), espera = new Promise<void>(r => { liberar = r; });
    const primeira = executarComAutorizacaoManualBrasilNfe(a, async () => { avisar(); await espera; return [transmissaoBrasilNfeLiberada(restricao(a)), transmissaoBrasilNfeLiberada(restricao(b))]; });
    await entrou;
    try {
      expect(transmissaoBrasilNfeLiberada()).toBe(false);
      expect(await executarComAutorizacaoManualBrasilNfe(b, async () => [transmissaoBrasilNfeLiberada(restricao(b)), transmissaoBrasilNfeLiberada(restricao(a))])).toEqual([true, false]);
    } finally { liberar(); }
    expect(await primeira).toEqual([true, false]); expect(transmissaoBrasilNfeLiberada()).toBe(false);
  });
  it("alterar o objeto de entrada não amplia a cópia selada do escopo", async () => {
    const c = contexto(), original = restricao(c);
    await executarComAutorizacaoManualBrasilNfe(c, async () => { c.documentoId = "outro-documento-ficticio"; c.modelo = 65; expect(transmissaoBrasilNfeLiberada(original)).toBe(true); expect(transmissaoBrasilNfeLiberada(restricao(c))).toBe(false); });
  });
  it("sem escopo ou guardião durável nenhum transporte é iniciado", async () => {
    const http = vi.fn(async () => "resposta-sintetica");
    await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Emissão ainda não liberada");
    await executarComAutorizacaoManualBrasilNfe(contexto(), async () => {
      await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Emissão ainda não liberada");
    });
    expect(http).not.toHaveBeenCalled();
  });
  it("o guardião recebe um único transporte; nova chamada no mesmo escopo é bloqueada", async () => {
    const http = vi.fn(async () => "resposta-sintetica"), guardiao = vi.fn(<T>(acao: () => Promise<T>) => acao());
    await executarComAutorizacaoManualBrasilNfe(contexto(), async () => {
      expect(await executarTransporteManualBrasilNfe(http)).toBe("resposta-sintetica");
      await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Emissão ainda não liberada");
    }, <T>(acao: () => Promise<T>) => guardiao(acao) as Promise<T>);
    expect(http).toHaveBeenCalledTimes(1); expect(guardiao).toHaveBeenCalledTimes(1);
  });
  it("suspensão durante a preparação impede POST e não libera repetição da autorização", async () => {
    let habilitada = true, liberar!: () => void, avisar!: () => void;
    const preparacao = new Promise<void>(r => { liberar = r; }), entrou = new Promise<void>(r => { avisar = r; });
    const http = vi.fn(async () => "resposta-sintetica");
    const guardiao = vi.fn(async <T>(acao: () => Promise<T>): Promise<T> => { if (!habilitada) throw new Error("Suspensa na conferência durável sintética"); return acao(); });
    const fluxo = executarComAutorizacaoManualBrasilNfe(contexto(), async () => {
      avisar(); await preparacao;
      await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Emissão ainda não liberada");
      habilitada = true;
      await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Emissão ainda não liberada");
    }, <T>(acao: () => Promise<T>) => guardiao(acao) as Promise<T>);
    await entrou;
    try { habilitada = false; } finally { liberar(); }
    await fluxo;
    expect(guardiao).toHaveBeenCalledTimes(1); expect(http).not.toHaveBeenCalled();
  });
  it("falha de transporte consome a chamada e nunca autoriza reenvio automático", async () => {
    const http = vi.fn(async () => { throw new Error("Timeout exclusivamente sintético"); });
    await executarComAutorizacaoManualBrasilNfe(contexto(), async () => {
      await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Timeout exclusivamente sintético");
      await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Emissão ainda não liberada");
    }, <T>(acao: () => Promise<T>) => acao());
    expect(http).toHaveBeenCalledTimes(1);
  });
  it("o callback entregue ao guardião também permite somente uma chamada HTTP", async () => {
    const http = vi.fn(async () => "resposta-sintetica");
    await executarComAutorizacaoManualBrasilNfe(contexto(), async () => {
      expect(await executarTransporteManualBrasilNfe(http)).toBe("resposta-sintetica");
    }, async <T>(acao: () => Promise<T>) => {
      const resultado = await acao();
      await expect(acao()).rejects.toThrow("Emissão ainda não liberada");
      return resultado;
    });
    expect(http).toHaveBeenCalledTimes(1);
  });
  it("concorrência no mesmo escopo conserva somente uma chamada aguardando o guardião", async () => {
    let liberar!: () => void, avisar!: () => void;
    const espera = new Promise<void>(r => { liberar = r; }), entrou = new Promise<void>(r => { avisar = r; }), http = vi.fn(async () => "resposta-sintetica");
    await executarComAutorizacaoManualBrasilNfe(contexto(), async () => {
      const primeira = executarTransporteManualBrasilNfe(http);
      await entrou;
      try { await expect(executarTransporteManualBrasilNfe(http)).rejects.toThrow("Emissão ainda não liberada"); } finally { liberar(); }
      expect(await primeira).toBe("resposta-sintetica");
    }, async <T>(acao: () => Promise<T>) => { avisar(); await espera; return acao(); });
    expect(http).toHaveBeenCalledTimes(1);
  });
  it("expiração enquanto aguarda a trava impede o HTTP depois da liberação", async () => {
    const instante = Date.now(), relogio = vi.spyOn(Date, "now").mockReturnValue(instante), http = vi.fn(async () => "resposta-sintetica");
    let liberar!: () => void, avisar!: () => void;
    const espera = new Promise<void>(r => { liberar = r; }), entrou = new Promise<void>(r => { avisar = r; });
    await executarComAutorizacaoManualBrasilNfe(contexto(), async () => {
      const resultado = executarTransporteManualBrasilNfe(http);
      const recusada = expect(resultado).rejects.toThrow("Emissão ainda não liberada");
      await entrou;
      try { relogio.mockReturnValue(instante + 120_000); } finally { liberar(); }
      await recusada;
    }, async <T>(acao: () => Promise<T>) => { avisar(); await espera; return acao(); });
    expect(http).not.toHaveBeenCalled();
  });
});
