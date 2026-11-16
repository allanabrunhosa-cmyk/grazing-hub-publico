import { beforeEach, describe, expect, it, vi } from "vitest";

const simulacao = vi.hoisted(() => ({ permissao: vi.fn(), consultar: vi.fn(), vincular: vi.fn(), revalidar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: simulacao.revalidar }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: simulacao.permissao }));
vi.mock("@/lib/financeiro/faturas/servico", () => ({ consultarCorrespondencias: simulacao.consultar, vincularItem: simulacao.vincular }));
vi.mock("@/lib/financeiro/faturas/regras", () => ({ salvarRegra: vi.fn() }));
vi.mock("@/lib/financeiro/faturas/arquivo", () => ({ SenhaPdfNecessaria: class extends Error {} }));
import { ErroFatura } from "@/lib/financeiro/faturas/dominio";
import { correspondenciasFaturaAction, vincularFaturaAction } from "@/app/(protegido)/financeiro/cartoes/actions";

beforeEach(() => {
  vi.clearAllMocks();
  simulacao.permissao.mockResolvedValue({ userId: "usuario-ficticio" });
  simulacao.consultar.mockResolvedValue({ candidatos: [], estornos: [], sugestao: null });
  simulacao.vincular.mockResolvedValue({ ok: true });
});

describe("consulta de candidatos sem reiniciar a tela da fatura", () => {
  it("preserva as duas permissões e consulta sem invalidar layout ou dados RSC", async () => {
    const resposta = { candidatos: [{ id: "titulo-ficticio" }], estornos: [], sugestao: null };
    simulacao.consultar.mockResolvedValue(resposta);
    expect(await correspondenciasFaturaAction("fatura", "item", true)).toBe(resposta);
    await correspondenciasFaturaAction("fatura", "item");
    expect(simulacao.permissao.mock.calls).toEqual([
      ["financeiro.faturas", "visualizar"], ["financeiro.movimentacoes", "visualizar"],
      ["financeiro.faturas", "visualizar"], ["financeiro.movimentacoes", "visualizar"],
    ]);
    expect(simulacao.consultar.mock.calls).toEqual([["fatura", "item", true], ["fatura", "item", false]]);
    expect(simulacao.revalidar).not.toHaveBeenCalled();
  });

  it("não consulta sem permissão nem invalida uma recusa", async () => {
    simulacao.permissao.mockRejectedValue(new Error("Sem permissão"));
    await expect(correspondenciasFaturaAction("fatura", "item")).rejects.toThrow("Sem permissão");
    expect(simulacao.consultar).not.toHaveBeenCalled();
    expect(simulacao.revalidar).not.toHaveBeenCalled();
  });

  it("mantém o erro de domínio sem atualizar a página", async () => {
    simulacao.consultar.mockRejectedValue(new ErroFatura("Item indisponível"));
    expect(await correspondenciasFaturaAction("fatura", "item")).toEqual({ erro: "Item indisponível" });
    expect(simulacao.revalidar).not.toHaveBeenCalled();
  });

  it("continua invalidando o financeiro depois de uma alteração confirmada", async () => {
    const entrada = { lancamentos: [{ id: "titulo-ficticio", versao: "2026-11-16T12:00:00.000Z" }] };
    expect(await vincularFaturaAction("fatura", 1, "item", entrada)).toEqual({ ok: true });
    expect(simulacao.vincular).toHaveBeenCalledWith("fatura", 1, "item", entrada, { userId: "usuario-ficticio" });
    expect(simulacao.revalidar).toHaveBeenCalledExactlyOnceWith("/financeiro", "layout");
  });
});
