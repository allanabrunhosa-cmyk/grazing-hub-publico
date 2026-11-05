import { describe, expect, it } from "vitest";
import { validarTratamentoLocalNota } from "@/lib/notas-fiscais/tratamento-local";

const entrada = { notaFiscalId: "nota-teste", versao: 0, acao: "DEVOLUCAO" as const, dataDevolucao: "2026-11-03", motivo: "Devolução já realizada do equipamento." };
const agora = new Date("2026-11-04T01:00:00Z");

describe("tratamento local de outra operação fiscal", () => {
  it("valida a devolução realizada e normaliza somente o motivo", () => {
    expect(validarTratamentoLocalNota({ ...entrada, motivo: `  ${entrada.motivo}  ` }, agora)).toEqual({
      ...entrada, dataDevolucao: new Date("2026-11-03T15:00:00Z"),
    });
  });
  it.each([undefined, "", "2026-02-30", "2025-02-29", "03/11/2026", "2026-11-03T12:00:00Z"])("exige dia válido para devolução: %s", dataDevolucao => {
    expect(validarTratamentoLocalNota({ ...entrada, dataDevolucao }, agora)).toHaveProperty("erro");
  });
  it("recusa amanhã no calendário de Brasília, mesmo já sendo esse dia em UTC", () => {
    expect(validarTratamentoLocalNota({ ...entrada, dataDevolucao: "2026-11-04" }, agora)).toMatchObject({ erro: expect.stringContaining("não pode ser futura") });
  });
  it.each(["IGNORAR", "REABRIR"] as const)("não exige nem propaga data de devolução para %s", acao => {
    expect(validarTratamentoLocalNota({ ...entrada, acao, dataDevolucao: undefined }, agora)).toEqual({ ...entrada, acao, dataDevolucao: null });
  });
  it.each(["", "x".repeat(14), "x".repeat(501), "Motivo com controle\u0000 inválido"])("recusa motivo inválido", motivo => {
    expect(validarTratamentoLocalNota({ ...entrada, motivo }, agora)).toHaveProperty("erro");
  });
  it.each([15, 500])("admite limite de motivo com %s caracteres", tamanho => {
    expect(validarTratamentoLocalNota({ ...entrada, motivo: "x".repeat(tamanho) }, agora)).not.toHaveProperty("erro");
  });
  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_647])("recusa revisão inválida: %s", versao => {
    expect(validarTratamentoLocalNota({ ...entrada, versao }, agora)).toHaveProperty("erro");
  });
  it("recusa ação desconhecida e nota inválida antes de qualquer efeito", () => {
    expect(validarTratamentoLocalNota({ ...entrada, acao: "CONFIRMAR" } as never, agora)).toHaveProperty("erro");
    expect(validarTratamentoLocalNota({ ...entrada, notaFiscalId: "" }, agora)).toHaveProperty("erro");
    expect(validarTratamentoLocalNota({ ...entrada, notaFiscalId: "x".repeat(101) }, agora)).toHaveProperty("erro");
    expect(validarTratamentoLocalNota(null as never, agora)).toHaveProperty("erro");
  });
});
