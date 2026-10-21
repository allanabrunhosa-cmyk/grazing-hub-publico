import { expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ processar: vi.fn(), encerrar: vi.fn(async () => {}) }));
vi.mock("server-only", () => ({}));
vi.mock("dotenv/config", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { $disconnect: s.encerrar } }));
vi.mock("@/lib/fiscal-saida/servico", () => ({ processarFiscalSaida: s.processar }));
it("script da fila não processa nem consulta banco nesta entrega de estrutura", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await import("../../scripts/processar-fiscal-saida");
    expect(s.processar).not.toHaveBeenCalled(); expect(s.encerrar).toHaveBeenCalledOnce(); expect(log).toHaveBeenCalledWith("Emissão ainda não liberada.");
  } finally { log.mockRestore(); }
});
