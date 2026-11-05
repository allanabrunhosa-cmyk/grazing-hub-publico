vi.mock("server-only", () => ({}));
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EntradaTratamentoLocalNota } from "@/lib/notas-fiscais/tratamento-local";

const simulacao = vi.hoisted(() => ({
  sessao: vi.fn(), manifestar: vi.fn(), transacao: vi.fn(), consulta: vi.fn(), executar: vi.fn(),
  usuario: vi.fn(), nota: vi.fn(), atualizar: vi.fn(), efeitos: vi.fn(), cancelamento: vi.fn(),
  auditar: vi.fn(), historico: vi.fn(), financeiro: vi.fn(), estoque: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: simulacao.transacao } }));
vi.mock("@/lib/session", () => ({ getSession: simulacao.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn() }));
vi.mock("@/lib/sefaz/manifestar", () => ({ manifestarNotaFiscal: simulacao.manifestar }));
vi.mock("@/lib/financeiro/cancelamento-compra", () => ({ chaveCompra: ({ tipo, id }: { tipo: string; id: string }) => `${tipo}:${id}` }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { tratarOutraOperacaoNotaAction } from "@/app/(protegido)/notas-fiscais/tratamento-local-actions";

const inicial = {
  id: "nota-teste", chaveAcesso: "0".repeat(44), tipo: "PROC_NFE", xml: "<nfeProc/>", ultimaManifestacao: null as string | null,
  tratamentoLocal: null as string | null, dataDevolucao: null as Date | null, motivoTratamentoLocal: null as string | null,
  tratamentoLocalEm: null as Date | null, tratamentoLocalVersao: 0,
};
let nota = { ...inicial };
let auditorias: Array<{ autorId: string; entidade: string; entidadeId: string; acao: string; depois: Record<string, unknown> }> = [];
const entrada: EntradaTratamentoLocalNota = { notaFiscalId: "nota-teste", versao: 0, acao: "DEVOLUCAO", dataDevolucao: "2024-02-29", motivo: "Devolução do equipamento já concluída." };
const banco = {
  $queryRaw: simulacao.consulta, $executeRawUnsafe: simulacao.executar,
  usuario: { findUnique: simulacao.usuario }, notaFiscalRecebida: { findUnique: simulacao.nota, updateMany: simulacao.atualizar },
  notaFiscalItem: { count: simulacao.efeitos }, cancelamentoCompra: { findUnique: simulacao.cancelamento },
  historicoAcesso: { create: simulacao.auditar, findFirst: simulacao.historico },
  lancamentoFinanceiro: { create: simulacao.financeiro }, movimentacaoEstoque: { create: simulacao.estoque },
};

beforeEach(() => {
  vi.resetAllMocks();
  nota = { ...inicial };
  auditorias = [];
  simulacao.sessao.mockResolvedValue({ userId: "usuario-teste", versao: 1 });
  simulacao.usuario.mockResolvedValue({ id: "usuario-teste", ativo: true, senhaDefinida: true, excluidoEm: null, sessaoVersao: 1, perfilAcesso: { sistema: "ADMINISTRADOR" } });
  simulacao.nota.mockImplementation(async () => ({ ...nota }));
  simulacao.consulta.mockResolvedValue([{ obtida: true }]);
  simulacao.efeitos.mockResolvedValue(0);
  simulacao.cancelamento.mockResolvedValue(null);
  simulacao.atualizar.mockImplementation(async ({ where, data }) => {
    if (nota.tratamentoLocalVersao !== where.tratamentoLocalVersao) return { count: 0 };
    nota = { ...nota, ...data };
    return { count: 1 };
  });
  simulacao.auditar.mockImplementation(async ({ data }) => { auditorias.push(data); return data; });
  simulacao.historico.mockImplementation(async () => [...auditorias].reverse().find(a => a.acao === "REABRIR_NOTA") ?? null);
  simulacao.manifestar.mockImplementation(async () => {
    // Esta gravação representa a conexão fiscal independente da transação local.
    nota.ultimaManifestacao = "CONFIRMACAO_DA_OPERACAO";
    return { sucesso: true, mensagem: "Confirmada", protocolo: "protocolo-sintetico" };
  });
  simulacao.transacao.mockImplementation(async executar => {
    const antes = { ...nota };
    const quantidadeAuditorias = auditorias.length;
    try { return await executar(banco); }
    catch (erro) {
      nota = { ...antes, ultimaManifestacao: nota.ultimaManifestacao };
      auditorias.length = quantidadeAuditorias;
      throw erro;
    }
  });
});

describe("tratamento local autorizado de NF-e", () => {
  it("registra confirmação fiscal e devolução sem compra, estoque ou despesas", async () => {
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ ok: true, versao: 1 });
    expect(simulacao.manifestar).toHaveBeenCalledExactlyOnceWith(nota.chaveAcesso, "CONFIRMACAO_DA_OPERACAO");
    expect(nota).toMatchObject({ tratamentoLocal: "DEVOLUCAO_REGISTRADA", dataDevolucao: new Date("2024-02-29T15:00:00Z"), motivoTratamentoLocal: entrada.motivo, tratamentoLocalVersao: 1 });
    expect(auditorias).toHaveLength(1);
    expect(auditorias[0]).toMatchObject({ autorId: "usuario-teste", entidadeId: nota.id, acao: "DEVOLUCAO_REGISTRADA" });
    expect(simulacao.financeiro).not.toHaveBeenCalled();
    expect(simulacao.estoque).not.toHaveBeenCalled();
    expect(simulacao.manifestar.mock.invocationCallOrder[0]).toBeLessThan(simulacao.consulta.mock.invocationCallOrder[1]);
  });
  it("repetição idêntica do registro não reenvia nem duplica auditoria", async () => {
    await tratarOutraOperacaoNotaAction(entrada);
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ ok: true, versao: 1 });
    expect(simulacao.manifestar).toHaveBeenCalledOnce();
    expect(simulacao.atualizar).toHaveBeenCalledOnce();
    expect(auditorias).toHaveLength(1);
  });
  it("ignorar é apenas controle interno e conserva o histórico fiscal", async () => {
    nota.xml = "";
    nota.ultimaManifestacao = "CIENCIA_DA_OPERACAO";
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, acao: "IGNORAR", dataDevolucao: undefined })).toEqual({ ok: true, versao: 1 });
    expect(nota).toMatchObject({ tratamentoLocal: "IGNORADA", dataDevolucao: null, ultimaManifestacao: "CIENCIA_DA_OPERACAO" });
    expect(simulacao.manifestar).not.toHaveBeenCalled();
    expect(simulacao.financeiro).not.toHaveBeenCalled();
    expect(simulacao.estoque).not.toHaveBeenCalled();
  });
  it("reabre com nova revisão, preservando confirmação fiscal e auditorias", async () => {
    await tratarOutraOperacaoNotaAction(entrada);
    const reabertura = { ...entrada, versao: 1, acao: "REABRIR" as const, motivo: "Reabrir para conferir o tratamento aplicado." };
    expect(await tratarOutraOperacaoNotaAction(reabertura)).toEqual({ ok: true, versao: 2 });
    expect(nota).toMatchObject({ tratamentoLocal: null, dataDevolucao: null, motivoTratamentoLocal: null, tratamentoLocalEm: null, tratamentoLocalVersao: 2, ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" });
    expect(auditorias).toHaveLength(2);
    expect(await tratarOutraOperacaoNotaAction(reabertura)).toEqual({ ok: true, versao: 2 });
    expect(auditorias).toHaveLength(2);
    expect(simulacao.manifestar).toHaveBeenCalledOnce();
  });
  it("recusa troca de tratamento sem reabertura e revisões antigas", async () => {
    await tratarOutraOperacaoNotaAction(entrada);
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, acao: "IGNORAR" })).toHaveProperty("erro");
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, versao: 1, acao: "IGNORAR" })).toMatchObject({ erro: expect.stringContaining("Reabra") });
    nota.tratamentoLocalVersao = 3;
    expect(await tratarOutraOperacaoNotaAction(entrada)).toHaveProperty("erro");
    expect(auditorias).toHaveLength(1);
  });
  it("retoma uma confirmação já gravada sem reenviar", async () => {
    nota.ultimaManifestacao = "CONFIRMACAO_DA_OPERACAO";
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ ok: true, versao: 1 });
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("não grava tratamento se a SEFAZ rejeitar", async () => {
    simulacao.manifestar.mockResolvedValue({ sucesso: false, mensagem: "Rejeição sintética" });
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ erro: "Rejeição sintética" });
    expect(simulacao.atualizar).not.toHaveBeenCalled();
    expect(auditorias).toHaveLength(0);
  });
  it("falha local preserva confirmação fiscal e retoma sem reenvio", async () => {
    simulacao.auditar.mockRejectedValueOnce(new Error("Falha sintética"));
    expect(await tratarOutraOperacaoNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("sem reenviar à SEFAZ") });
    expect(nota).toMatchObject({ ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO", tratamentoLocal: null, tratamentoLocalVersao: 0 });
    expect(await tratarOutraOperacaoNotaAction(entrada)).toEqual({ ok: true, versao: 1 });
    expect(simulacao.manifestar).toHaveBeenCalledOnce();
    expect(auditorias).toHaveLength(1);
  });
  it("recusa efeitos locais e cancelamento da compra antes da confirmação", async () => {
    simulacao.efeitos.mockResolvedValueOnce(1);
    expect(await tratarOutraOperacaoNotaAction(entrada)).toHaveProperty("erro");
    simulacao.cancelamento.mockResolvedValueOnce({ id: "cancelamento-teste" });
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, acao: "IGNORAR" })).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
    expect(simulacao.atualizar).not.toHaveBeenCalled();
  });
  it("reconfere efeitos sob trava local após o envio fiscal", async () => {
    simulacao.efeitos.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect(await tratarOutraOperacaoNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("confirmação fiscal já foi registrada") });
    expect(simulacao.atualizar).not.toHaveBeenCalled();
    expect(simulacao.manifestar).toHaveBeenCalledOnce();
  });
  it.each(["DESCONHECIMENTO_DA_OPERACAO", "OPERACAO_NAO_REALIZADA"])("não confirma nota recusada: %s", status => {
    nota.ultimaManifestacao = status;
    return expect(tratarOutraOperacaoNotaAction(entrada)).resolves.toHaveProperty("erro");
  });
  it("exige XML completo apenas para registrar devolução", async () => {
    nota.xml = "";
    expect(await tratarOutraOperacaoNotaAction(entrada)).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("bloqueia concorrência e não tenta envio fiscal", async () => {
    simulacao.consulta.mockResolvedValue([{ obtida: false }]);
    expect(await tratarOutraOperacaoNotaAction(entrada)).toHaveProperty("erro");
    expect(simulacao.manifestar).not.toHaveBeenCalled();
  });
  it("revalida sessão e permissão no servidor antes de qualquer efeito", async () => {
    simulacao.usuario.mockResolvedValueOnce({ ativo: false });
    expect(await tratarOutraOperacaoNotaAction(entrada)).toHaveProperty("erro");
    simulacao.usuario.mockResolvedValueOnce({ id: "usuario-teste", ativo: true, senhaDefinida: true, sessaoVersao: 1, perfilAcesso: { sistema: "OPERADOR", permissoes: {} } });
    expect(await tratarOutraOperacaoNotaAction(entrada)).toMatchObject({ erro: expect.stringContaining("permissão") });
    expect(simulacao.manifestar).not.toHaveBeenCalled();
    expect(simulacao.atualizar).not.toHaveBeenCalled();
  });
  it("exige sessão e valida motivo/data antes da transação", async () => {
    simulacao.sessao.mockResolvedValueOnce(null);
    expect(await tratarOutraOperacaoNotaAction(entrada)).toHaveProperty("erro");
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, motivo: "curto" })).toHaveProperty("erro");
    expect(await tratarOutraOperacaoNotaAction({ ...entrada, dataDevolucao: "9999-01-01" })).toHaveProperty("erro");
    expect(simulacao.transacao).not.toHaveBeenCalled();
  });
});
