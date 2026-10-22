import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";
import type { PreviaEmissaoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/operacional";

const s = vi.hoisted(() => ({ preparar: vi.fn(), emitir: vi.fn(), consultar: vi.fn(), documentos: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/fiscal-saida/brasilnfe/operacional", () => ({ prepararEmissaoPedidoBrasilNfe: s.preparar, emitirNotaPedidoBrasilNfe: s.emitir, consultarEmissaoPedidoBrasilNfe: s.consultar }));
vi.mock("@/lib/fiscal-saida/servico", () => ({ consultarFiscalSaida: s.documentos }));
import { consultarResultadoEmissaoPedidoBrasilNfe, emitirNotaPedidoDiretaBrasilNfe, obterResultadoLocalEmissaoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/emissao-direta";

const sessao = { userId: "autor-sintetico", admin: true } as SessaoAtual;
const entrada = { pedidoId: "pedido-sintetico", versaoPedido: 3, modelo: 65 as 55 | 65 };
function previa() {
  return { pedidoId: entrada.pedidoId, versaoPedido: 3, modelo: 65, ambiente: "PRODUCAO", total: "271.00", pendencias: [], podeEmitir: true,
    liberacaoTransmissao: { liberada: true, motivo: null }, contextoOperacao: { indicadorPresenca: 4, exigeEscolhaPresenca: false },
    documento: { id: "documento-sintetico", hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64) },
  } as unknown as PreviaEmissaoPedidoBrasilNfe;
}
function documento(alteracoes = {}) {
  return { id: "documento-sintetico", status: "AUTORIZADO", ambiente: "PRODUCAO", provedor: "BRASIL_NFE", tentativas: 1, referenciaProvedor: "referencia-sintetica", chaveFiscal: "chave-sintetica", protocolo: "protocolo-sintetico", eventos: [], ...alteracoes };
}
beforeEach(() => { vi.resetAllMocks(); s.preparar.mockResolvedValue(previa()); s.emitir.mockResolvedValue(documento()); s.documentos.mockResolvedValue([]); });

describe("Um clique produtivo por pedido, sem parâmetros fiscais privilegiados do navegador", () => {
  it.each([55, 65] as const)("prepara e transmite uma vez no modelo%s, sempre em produção", async modelo => {
    const p = previa(); p.modelo = modelo; p.contextoOperacao!.indicadorPresenca = 2; s.preparar.mockResolvedValue(p);
    const r = await emitirNotaPedidoDiretaBrasilNfe({ ...entrada, modelo, indicadorPresenca: 2 }, sessao);
    expect(r).toEqual({ ok: true, documento: documento(), conferirAntesDeRepetir: true });
    expect(s.preparar).toHaveBeenCalledExactlyOnceWith(entrada.pedidoId, 3, modelo, "PRODUCAO", sessao, { indicadorPresenca: 2 }, { somenteVersoesAtivas: true });
    expect(s.emitir).toHaveBeenCalledExactlyOnceWith({ documentoId: "documento-sintetico", modelo, ambiente: "PRODUCAO", hashSnapshot: "a".repeat(64), hashPayloadFiscal: "b".repeat(64), total: "271.00", autorizarUmaTransmissao: true, conferenciaSemDocumentoExterno: true, indicadorPresenca: 2 }, sessao);
    expect(s.consultar).not.toHaveBeenCalled();
  });
  it.each([
    null, {}, { ...entrada, pedidoId: "<pedido>" }, { ...entrada, versaoPedido: 0 }, { ...entrada, versaoPedido: 2_147_483_648 },
    { ...entrada, modelo: 57 }, { ...entrada, modelo: "65" }, { ...entrada, ambiente: "HOMOLOGACAO" },
    { ...entrada, hashSnapshot: "a".repeat(64) }, { ...entrada, autorizarUmaTransmissao: true },
    { ...entrada, indicadorPresenca: 0 }, { ...entrada, indicadorPresenca: 8 }, { ...entrada, modelo: 55, indicadorPresenca: 4 },
    { ...entrada, pagamentoCartaoNaoIntegrado: false }, { ...entrada, pagamentoCartaoNaoIntegrado: "true" }, { ...entrada, modelo: 55, pagamentoCartaoNaoIntegrado: true },
  ])("recusa entrada adulterada antes de preparar: %j", async valor => {
    await expect(emitirNotaPedidoDiretaBrasilNfe(valor, sessao)).rejects.toThrow();
    expect(s.preparar).not.toHaveBeenCalled(); expect(s.emitir).not.toHaveBeenCalled(); expect(s.consultar).not.toHaveBeenCalled();
  });
  it("não presume presença e devolve o campo necessário sem transmitir", async () => {
    const p = previa(); p.contextoOperacao = { indicadorPresenca: null, exigeEscolhaPresenca: true }; s.preparar.mockResolvedValue(p);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ erro: expect.any(String), exigeEscolhaPresenca: true, conferirAntesDeRepetir: false,
      pendencias: [expect.objectContaining({ campo: "indicadorPresenca", mensagem: expect.stringContaining("como a venda foi realizada") })] });
    expect(s.preparar.mock.calls[0][5]).toEqual({}); expect(s.emitir).not.toHaveBeenCalled();
  });
  it("devolve motivos fiscais por produto e configuração sem esconder a causa", async () => {
    const p = previa(); p.pendencias = [{ campo: "itens.ncm", mensagem: "Produto sintético: falta NCM de 8 dígitos.", href: "/financeiro/fiscal/vinculos" }, { campo: "csc", mensagem: "Falta o CSC de produção.", href: "/financeiro/fiscal/configuracoes" }]; p.podeEmitir = false; s.preparar.mockResolvedValue(p);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ pendencias: p.pendencias, conferirAntesDeRepetir: false });
    expect(s.emitir).not.toHaveBeenCalled();
  });
  it("envia o cartão comercial sem exigir declaração de quitação", async () => {
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ ok: true });
    expect(s.emitir).toHaveBeenCalledTimes(1);
    expect(s.preparar.mock.calls[0][5]).toEqual({});
  });

  it("resultado incerto de outra revisão bloqueia retry e mantém o documento para consulta", async () => {
    const p = previa(); p.pendencias = [{ campo: "duplicidade", mensagem: "Existe tentativa desta venda neste ambiente.", href: "" }]; s.preparar.mockResolvedValue(p);
    const incerto = documento({ id: "documento-anterior", status: "INCERTO", referenciaProvedor: null, chaveFiscal: null, protocolo: null }); s.documentos.mockResolvedValue([incerto]); s.consultar.mockResolvedValue(incerto);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ documento: incerto, conferirAntesDeRepetir: true });
    expect(s.emitir).not.toHaveBeenCalled();
  });
  it("não envia revisão pendente sem aprovação administrativa", async () => {
    const p = previa(); p.revisaoConsolidada = { hash: "c".repeat(64), pendente: true, podeAprovar: false, versoes: [{ id: "versao-sintetica", hash: "d".repeat(64), status: "RASCUNHO", tipo: "REGRA", rotulo: "Regra sintética" }], parametros: [], declaracoes: [] }; s.preparar.mockResolvedValue(p);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ pendencias: [expect.objectContaining({ campo: "revisaoConsolidada" })] }); expect(s.emitir).not.toHaveBeenCalled();
  });
  it("não aprova rascunhos globais pelo clique Emitir, inclusive para administrador", async () => {
    const p = previa(); p.revisaoConsolidada = { hash: "c".repeat(64), pendente: true, podeAprovar: true, versoes: [{ id: "versao-sintetica", hash: "d".repeat(64), status: "RASCUNHO", tipo: "REGRA", rotulo: "Regra sintética" }], parametros: [], declaracoes: [] }; s.preparar.mockResolvedValue(p);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ pendencias: [expect.objectContaining({ campo: "revisaoConsolidada", href: "/financeiro/fiscal/vinculos" })] });
    expect(s.emitir).not.toHaveBeenCalled();
  });
  it("versões já aprovadas não geram novo comando de aprovação", async () => {
    const p = previa(); p.revisaoConsolidada = { hash: "c".repeat(64), pendente: false, podeAprovar: false, versoes: [{ id: "versao-sintetica", hash: "d".repeat(64), status: "ATIVO", tipo: "REGRA", rotulo: "Regra sintética" }], parametros: [], declaracoes: [] }; s.preparar.mockResolvedValue(p);
    await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao);
    expect(s.emitir.mock.calls[0][0]).not.toHaveProperty("revisaoConsolidada");
  });
  it.each(["podeEmitir", "hash", "habilitacao", "suspensao"])("guarda%s fechada impede o serviço de transmissão", async guarda => {
    const p = previa(); if (guarda === "podeEmitir") p.podeEmitir = false; if (guarda === "hash") p.documento!.hashPayloadFiscal = null; if (guarda === "habilitacao") p.liberacaoTransmissao = { liberada: false, motivo: "Integração não habilitada para este modelo." }; if (guarda === "suspensao") p.controleManual = { suspensa: true, motivo: "Emissão suspensa." }; s.preparar.mockResolvedValue(p);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toHaveProperty("erro"); expect(s.emitir).not.toHaveBeenCalled();
  });
  it("rejeição certa preserva o motivo sem consultar ou reenviar automaticamente", async () => {
    const resultado = documento({ status: "REJEITADO", ultimoErro: "Motivo exclusivamente sintético." }); s.emitir.mockResolvedValueOnce(resultado);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ ok: true, documento: resultado, conferirAntesDeRepetir: true });
    expect(s.emitir).toHaveBeenCalledTimes(1); expect(s.consultar).not.toHaveBeenCalled();
  });
  it.each([55, 65] as const)("recupera autorização do modelo%s no mesmo clique após resposta inconclusiva", async modelo => {
    const incerto = documento({ status: "PENDENTE_CONFERENCIA", protocolo: null, chaveFiscal: null, referenciaProvedor: null });
    s.emitir.mockResolvedValue(incerto); s.consultar.mockResolvedValue(documento());
    expect(await emitirNotaPedidoDiretaBrasilNfe({ ...entrada, modelo }, sessao)).toEqual({ ok: true, documento: documento(), conferirAntesDeRepetir: true });
    expect(s.consultar).toHaveBeenCalledExactlyOnceWith(incerto.id, sessao);
    expect(s.emitir).toHaveBeenCalledTimes(1); expect(s.preparar).toHaveBeenCalledTimes(1);
    expect(s.emitir.mock.invocationCallOrder[0]).toBeLessThan(s.consultar.mock.invocationCallOrder[0]);
  });
  it.each(["PROCESSANDO", "INCERTO", "PENDENTE_CONFERENCIA"])("consulta uma vez após%s e mantém incerteza se não houver confirmação", async status => {
    const incerto = documento({ status, protocolo: null }); s.emitir.mockResolvedValue(incerto); s.consultar.mockResolvedValue(incerto);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toEqual({ ok: true, documento: incerto, conferirAntesDeRepetir: true });
    expect(s.consultar).toHaveBeenCalledExactlyOnceWith(incerto.id, sessao); expect(s.emitir).toHaveBeenCalledTimes(1);
  });
  it("rejeição recuperada permite corrigir depois, sem segunda transmissão no mesmo clique", async () => {
    const incerto = documento({ status: "PENDENTE_CONFERENCIA", protocolo: null }); s.emitir.mockResolvedValue(incerto);
    const rejeitado = documento({ status: "REJEITADO", protocolo: null }); s.consultar.mockResolvedValue(rejeitado);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toEqual({ ok: true, documento: rejeitado, conferirAntesDeRepetir: false });
    expect(s.emitir).toHaveBeenCalledTimes(1); expect(s.preparar).toHaveBeenCalledTimes(1);
  });
  it("não contorna perda de permissão na consulta após o envio", async () => {
    s.emitir.mockResolvedValue(documento({ status: "INCERTO", protocolo: null })); s.consultar.mockRejectedValue(new Error("Permissão recusada"));
    await expect(emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).rejects.toThrow("Permissão recusada");
    expect(s.emitir).toHaveBeenCalledTimes(1); expect(s.preparar).toHaveBeenCalledTimes(1);
  });
});

describe("Novo clique reconcilia antes de enviar", () => {
  const incerto = () => documento({ status: "PENDENTE_CONFERENCIA", protocolo: null });
  it("consulta resultado incerto e emite outra revisão somente após rejeição certa", async () => {
    s.documentos.mockResolvedValue([incerto()]); s.consultar.mockResolvedValue(documento({ status: "REJEITADO", protocolo: null }));
    expect(await emitirNotaPedidoDiretaBrasilNfe({ ...entrada, modelo: 55 }, sessao)).toHaveProperty("ok", true);
    expect(s.consultar).toHaveBeenCalledExactlyOnceWith("documento-sintetico", sessao);
    expect(s.preparar).toHaveBeenCalledTimes(1); expect(s.emitir).toHaveBeenCalledTimes(1);
    expect(s.consultar.mock.invocationCallOrder[0]).toBeLessThan(s.preparar.mock.invocationCallOrder[0]);
  });
  it("consulta que recupera autorização não prepara nem envia outra nota", async () => {
    s.documentos.mockResolvedValue([incerto()]); s.consultar.mockResolvedValue(documento());
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ ok: true, documento: { status: "AUTORIZADO" } });
    expect(s.preparar).not.toHaveBeenCalled(); expect(s.emitir).not.toHaveBeenCalled();
  });
  it("incerteza persistente devolve motivo e aceita nova consulta pelo mesmo clique", async () => {
    s.documentos.mockResolvedValue([incerto()]); s.consultar.mockResolvedValue(incerto());
    for (let i=0;i<2;i++) expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ erro: expect.stringContaining("não enviou outra nota"), conferirAntesDeRepetir: true });
    expect(s.consultar).toHaveBeenCalledTimes(2); expect(s.preparar).not.toHaveBeenCalled(); expect(s.emitir).not.toHaveBeenCalled();
  });
  it("autorização existente não exige outra consulta nem transmissão", async () => {
    s.documentos.mockResolvedValue([documento()]);
    expect(await emitirNotaPedidoDiretaBrasilNfe(entrada, sessao)).toMatchObject({ ok: true, documento: { status: "AUTORIZADO" } });
    expect(s.consultar).not.toHaveBeenCalled(); expect(s.emitir).not.toHaveBeenCalled();
  });
});
describe("Recuperação da resposta perdida, sem repetir emissão", () => {
  it("não usa homologação como resultado do clique produtivo", async () => {
    s.documentos.mockResolvedValue([documento({ ambiente: "HOMOLOGACAO" })]);
    expect(await obterResultadoLocalEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).toEqual({ documento: null, conferirAntesDeRepetir: false, resultadoAmbiguo: false });
  });
  it("ausência de tentativa é informada por leitura local, sem consulta externa", async () => {
    expect(await consultarResultadoEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).toEqual({ ok: true, documento: null, conferirAntesDeRepetir: false });
    expect(s.consultar).not.toHaveBeenCalled(); expect(s.preparar).not.toHaveBeenCalled(); expect(s.emitir).not.toHaveBeenCalled();
  });
  it("autorização durável anterior ao POST exige conferência mesmo com zero tentativas", async () => {
    const autorizado = documento({ status: "PREPARADO", tentativas: 0, referenciaProvedor: null, chaveFiscal: null, protocolo: null, eventos: [{ tipo: "EMISSAO_MANUAL_AUTORIZADA" }] }); s.documentos.mockResolvedValue([autorizado]); s.consultar.mockResolvedValue(autorizado);
    expect(await consultarResultadoEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).toMatchObject({ conferirAntesDeRepetir: true });
    expect(s.consultar).toHaveBeenCalledExactlyOnceWith(autorizado.id, sessao); expect(s.emitir).not.toHaveBeenCalled();
  });
  it.each(["PROCESSANDO", "INCERTO", "PENDENTE_CONFERENCIA"])("consulta o único resultado%s, nunca chama ENVIAR", async status => {
    const d = documento({ status }); s.documentos.mockResolvedValue([d]); s.consultar.mockResolvedValue(d);
    expect(await consultarResultadoEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).toEqual({ ok: true, documento: d, conferirAntesDeRepetir: true });
    expect(s.consultar).toHaveBeenCalledExactlyOnceWith(d.id, sessao); expect(s.emitir).not.toHaveBeenCalled(); expect(s.preparar).not.toHaveBeenCalled();
  });
  it("preserva múltiplos resultados sem escolher silenciosamente o documento para consulta", async () => {
    s.documentos.mockResolvedValue([documento(), documento({ id: "outro-documento" })]);
    await expect(consultarResultadoEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).rejects.toThrow("mais de um resultado"); expect(s.consultar).not.toHaveBeenCalled(); expect(s.emitir).not.toHaveBeenCalled();
  });
  it("várias rejeições certas históricas não criam bloqueio perpétuo de emissão", async () => {
    const rejeitada = documento({ status: "REJEITADO", chaveFiscal: null, protocolo: null });
    s.documentos.mockResolvedValue([rejeitada, { ...rejeitada, id: "rejeicao-anterior" }]);
    expect(await obterResultadoLocalEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).toEqual({ documento: rejeitada, conferirAntesDeRepetir: false, resultadoAmbiguo: false });
    expect(await consultarResultadoEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).toMatchObject({ documento: rejeitada, conferirAntesDeRepetir: false }); expect(s.consultar).not.toHaveBeenCalled();
  });
  it("consulta que comprova rejeição sem identidade autoriza preparar nova revisão, sem reenviar", async () => {
    s.documentos.mockResolvedValue([documento({ status: "PENDENTE_CONFERENCIA", chaveFiscal: null, protocolo: null })]);
    const rejeitada = documento({ status: "REJEITADO", chaveFiscal: null, protocolo: null }); s.consultar.mockResolvedValue(rejeitada);
    expect(await consultarResultadoEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).toEqual({ ok: true, documento: rejeitada, conferirAntesDeRepetir: false }); expect(s.emitir).not.toHaveBeenCalled();
  });
  it("não consulta outro emissor com credenciais Brasil NFe", async () => {
    const d = documento({ provedor: "OUTRO_EMISSOR" }); s.documentos.mockResolvedValue([d]);
    expect(await consultarResultadoEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).toMatchObject({ documento: d, conferirAntesDeRepetir: true }); expect(s.consultar).not.toHaveBeenCalled();
  });
  it("permissão recusada na leitura não prepara nem consulta API", async () => {
    s.documentos.mockRejectedValue(new Error("Permissão recusada"));
    await expect(consultarResultadoEmissaoPedidoBrasilNfe(entrada.pedidoId, sessao)).rejects.toThrow("Permissão recusada"); expect(s.consultar).not.toHaveBeenCalled(); expect(s.emitir).not.toHaveBeenCalled();
  });
});
