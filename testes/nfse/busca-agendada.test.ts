// CNPJ exclusivamente fictício, com dígitos verificadores válidos para a fixture.
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ estado: vi.fn(), sincronizar: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { nfseDistribuicaoEstado: { findUnique: mocks.estado } } }));
vi.mock("@/lib/sefaz/certificado", () => ({ obterCnpjConsulta: async () => "11222333000181" }));
vi.mock("@/lib/nfse/servico", () => ({ sincronizarNfse: mocks.sincronizar }));
import { executarBuscaAutomaticaNfse } from "@/lib/nfse/busca-agendada";
import { buscaAutomaticaNfseDevida, proximaBuscaDiariaNfse } from "@/lib/nfse/agenda";

const agora = new Date("2026-09-23T06:15:00Z");
beforeEach(() => { vi.resetAllMocks(); mocks.estado.mockResolvedValue(null); mocks.sincronizar.mockResolvedValue({ motivo: "Nenhuma nova NFS-e." }); });
describe("busca automática de NFS-e independente da SEFAZ", () => {
  it("inicia às 03h15 de Brasília", async () => {
    expect(buscaAutomaticaNfseDevida(null, new Date("2026-09-23T06:14:59Z"))).toBe(false);
    await executarBuscaAutomaticaNfse(agora);
    expect(mocks.sincronizar).toHaveBeenCalledExactlyOnceWith("Busca automática", { automatica: true });
  });
  it("recupera execução atrasada após reinício, mas não repete o mesmo dia", () => {
    expect(buscaAutomaticaNfseDevida(null, new Date("2026-09-23T12:00:00Z"))).toBe(true);
    expect(buscaAutomaticaNfseDevida({ ultimaBuscaAutomaticaEm: agora }, new Date("2026-09-23T12:00:00Z"))).toBe(false);
  });
  it("não consulta durante o cooldown manual, mesmo com agenda vencida", async () => {
    mocks.estado.mockResolvedValue({ proximaBuscaEm: new Date("2026-09-23T07:15:00Z") });
    expect(await executarBuscaAutomaticaNfse(agora)).toHaveProperty("erro", false);
    expect(mocks.sincronizar).not.toHaveBeenCalled();
  });
  it("continua o próximo lote somente no horário previsto", () => {
    const estado = { ultimaBuscaAutomaticaEm: agora, proximaBuscaAutomaticaEm: new Date("2026-09-23T06:20:00Z") };
    expect(buscaAutomaticaNfseDevida(estado, agora)).toBe(false);
    expect(buscaAutomaticaNfseDevida(estado, new Date("2026-09-23T06:20:00Z"))).toBe(true);
  });
  it("calcula a próxima madrugada na virada do mês e do ano", () => {
    expect(proximaBuscaDiariaNfse(new Date("2026-09-30T06:15:00Z")).toISOString()).toBe("2026-10-01T06:15:00.000Z");
    expect(proximaBuscaDiariaNfse(new Date("2026-12-31T23:59:00Z")).toISOString()).toBe("2027-01-01T06:15:00.000Z");
  });
  it("propaga falhas para o registro do serviço", async () => {
    mocks.sincronizar.mockResolvedValue({ erro: "Serviço indisponível." });
    expect(await executarBuscaAutomaticaNfse(agora)).toEqual({ mensagem: "Serviço indisponível.", erro: true });
  });
});
