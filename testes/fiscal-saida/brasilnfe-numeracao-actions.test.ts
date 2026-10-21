import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ exigir: vi.fn(), consultar: vi.fn(), atualizar: vi.fn(), revalidar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.exigir }));
vi.mock("next/cache", () => ({ revalidatePath: sim.revalidar }));
vi.mock("@/lib/fiscal-saida/brasilnfe/numeracao", () => ({ consultarNumeracaoFiscalBrasilNfe: sim.consultar, atualizarNumeracaoFiscalBrasilNfe: sim.atualizar }));
import { atualizarNumeracaoFiscalBrasilNfeAction, consultarNumeracaoFiscalBrasilNfeAction } from "@/app/(protegido)/financeiro/fiscal/numeracao/actions";
import { ErroConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dominio";

const entrada = { versao: 3, modelo: 55, ambiente: 2, serie: "6", proximoNumero: "1", padrao: true, operacaoId: "00000000-0000-4000-8000-000000000001", consultadoEm: "2026-10-15T12:00:00.000Z", confirmarAtualizacao: true };
const sessao = { userId: "administrador-sintetico" };
beforeEach(() => { vi.resetAllMocks(); sim.exigir.mockResolvedValue(sessao); });
afterEach(() => vi.restoreAllMocks());

describe("Fronteira administrativa de séries e numeração", () => {
  it("recusa sem a permissão central antes de chamar o domínio", async () => {
    sim.exigir.mockRejectedValue(new Error("NEGADO_SINTETICO"));
    await expect(atualizarNumeracaoFiscalBrasilNfeAction(entrada)).rejects.toThrow("NEGADO_SINTETICO");
    expect(sim.exigir).toHaveBeenCalledExactlyOnceWith("configuracoes.brasilnfe", "editar");
    expect(sim.atualizar).not.toHaveBeenCalled(); expect(sim.consultar).not.toHaveBeenCalled(); expect(sim.revalidar).not.toHaveBeenCalled();
  });

  it("encaminha a seleção para uma única operação de domínio após autorização", async () => {
    const dados = { versaoConfiguracao: 3, atualizacao: { situacao: "CONFIRMADA" } };
    sim.atualizar.mockResolvedValue(dados);
    expect(await atualizarNumeracaoFiscalBrasilNfeAction(entrada)).toEqual({ ok: true, dados });
    expect(sim.exigir).toHaveBeenCalledExactlyOnceWith("configuracoes.brasilnfe", "editar");
    expect(sim.atualizar).toHaveBeenCalledExactlyOnceWith(entrada, sessao);
    expect(sim.consultar).not.toHaveBeenCalled(); expect(sim.revalidar.mock.calls).toEqual([["/financeiro/fiscal/numeracao"], ["/financeiro/fiscal/configuracoes"]]);
  });

  it("retorna o estado pendente do domínio sem forçar confirmação ou repetir a consulta", async () => {
    const dados = { versaoConfiguracao: 3, atualizacao: { situacao: "PENDENTE_CONFERENCIA", confirmadoEm: null } };
    sim.atualizar.mockResolvedValue(dados);
    const r = await atualizarNumeracaoFiscalBrasilNfeAction(entrada);
    expect(r).toEqual({ ok: true, dados }); expect(sim.atualizar).toHaveBeenCalledOnce(); expect(sim.consultar).not.toHaveBeenCalled();
  });

  it("preserva mensagem local de pré-validação sem afirmar que houve atualização", async () => {
    sim.atualizar.mockRejectedValue(new ErroConfiguracaoBrasilNfe("Consulte a numeração antes de salvar."));
    expect(await atualizarNumeracaoFiscalBrasilNfeAction(entrada)).toEqual({ erro: "Consulte a numeração antes de salvar." });
    expect(sim.revalidar).not.toHaveBeenCalled(); expect(sim.atualizar).toHaveBeenCalledOnce();
  });

  it("não devolve Error/cause, mensagens livres, headers ou credenciais em falha inesperada", async () => {
    const registrar = vi.spyOn(console, "error").mockImplementation(() => {});
    sim.atualizar.mockRejectedValue(new Error("TOKEN-SINTETICO-NAO-EXIBIR", { cause: { headers: { UserToken: "USER-TOKEN-SINTETICO" }, certificado: "CERTIFICADO-SINTETICO" } }));
    const r = await atualizarNumeracaoFiscalBrasilNfeAction(entrada);
    expect(r).toEqual({ erro: "Resultado da atualização não confirmado. Consulte a numeração antes de repetir; nenhum reenvio será automático.", conferenciaNecessaria: true });
    expect(JSON.stringify(r)).not.toMatch(/TOKEN-SINTETICO|headers|CERTIFICADO|cause/);
    expect(registrar).not.toHaveBeenCalled(); expect(sim.revalidar).not.toHaveBeenCalled(); expect(sim.atualizar).toHaveBeenCalledOnce(); expect(sim.consultar).not.toHaveBeenCalled();
  });

  it("mantém a consulta existente separada da mutação e protegida pela mesma permissão", async () => {
    const dados = { versaoConfiguracao: 3, linhas: [] }; sim.consultar.mockResolvedValue(dados);
    expect(await consultarNumeracaoFiscalBrasilNfeAction({ versao: 3 })).toEqual({ ok: true, dados });
    expect(sim.exigir).toHaveBeenCalledExactlyOnceWith("configuracoes.brasilnfe", "editar");
    expect(sim.consultar).toHaveBeenCalledExactlyOnceWith({ versao: 3 }, sessao); expect(sim.atualizar).not.toHaveBeenCalled();
  });
});
