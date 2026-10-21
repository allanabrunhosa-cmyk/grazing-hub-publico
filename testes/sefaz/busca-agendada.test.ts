import { beforeEach, describe, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ criar: vi.fn(), salvar: vi.fn(), buscar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { sefazDistribuicaoEstado: { upsert: s.criar, update: s.salvar } } }));
vi.mock("@/lib/sefaz/certificado", () => ({ obterCnpjConsulta: async () => "12345678000199" }));
vi.mock("@/lib/sefaz/sincronizar", () => ({ sincronizarDistribuicaoNFe: s.buscar }));
import { executarBuscaAgendada, inicioDoDiaEmBrasilia } from "@/lib/sefaz/busca-agendada";
beforeEach(() => {
  vi.resetAllMocks();
  s.criar.mockResolvedValue({ proximaBuscaEm: null, ultimaBuscaAutomaticaEm: null });
  s.buscar.mockResolvedValue({ novos: 2, xmlRecuperados: 1, xMotivoFinal: "Localizados", motivoParada: "SEM_NOVIDADE" });
});
describe("fila SEFAZ", () => {
  it("usa o dia de Brasília na virada de ano", () => {
    expect(inicioDoDiaEmBrasilia(new Date("2027-01-01T02:59:59Z")).toISOString()).toBe("2026-12-31T03:00:00.000Z");
  });
  it("executa descoberta diária às 03h15", async () => {
    expect(await executarBuscaAgendada(new Date("2026-09-11T06:15:00Z"))).toMatchObject({ erro: false, mensagem: expect.stringContaining("2 nota(s)") });
    expect(s.buscar).toHaveBeenCalledExactlyOnceWith(3);
  });
  it("acordar o servidor fora do horário sem pendências não consulta", async () => {
    await executarBuscaAgendada(new Date("2026-09-11T12:00:00Z"));
    expect(s.buscar).not.toHaveBeenCalled();
  });
  it("retoma pendência vencida mesmo depois de já ter feito a busca diária", async () => {
    s.criar.mockResolvedValue({ proximaBuscaEm: new Date("2026-09-11T11:00:00Z"), ultimaBuscaAutomaticaEm: new Date("2026-09-11T06:15:00Z") });
    await executarBuscaAgendada(new Date("2026-09-11T12:00:00Z"));
    expect(s.buscar).toHaveBeenCalledOnce();
  });
  it("mantém espera de uma pendência futura", async () => {
    s.criar.mockResolvedValue({ proximaBuscaEm: new Date("2026-09-11T13:00:00Z") });
    await executarBuscaAgendada(new Date("2026-09-11T12:00:00Z"));
    expect(s.buscar).not.toHaveBeenCalled();
  });
  it("falha do processo agenda recuperação sem repetir no mesmo ciclo", async () => {
    s.buscar.mockRejectedValue(new Error("Certificado indisponível"));
    expect(await executarBuscaAgendada(new Date("2026-09-11T06:15:00Z"))).toMatchObject({ erro: true });
    expect(s.buscar).toHaveBeenCalledOnce();
    expect(s.salvar).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ proximaBuscaEm: new Date("2026-09-11T07:15:00Z") }) }));
  });
});
