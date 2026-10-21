import { describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ decifrar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/ifood/tokens", () => ({ decifrarIfood: sim.decifrar }));
import { horariosSnapshotIfood } from "@/lib/ifood/horarios-servidor";

describe("Horários seletivos do snapshot iFood", () => {
  it("retorna criação do pedido remoto, sem repassar os demais dados do snapshot", () => {
    sim.decifrar.mockReturnValue({ createdAt: "2026-10-09T21:20:00Z", orderType: "TAKEOUT", orderTiming: "IMMEDIATE", takeout: { takeoutDateTime: "2026-10-09T22:00:00Z" }, privado: "não-serializar" });
    const horario = horariosSnapshotIfood("cifra-ficticia", "America/Sao_Paulo");
    expect(horario?.criadoEm?.toISOString()).toBe("2026-10-09T21:20:00.000Z");
    expect(horario?.janela).toBe("19:00");
    expect(JSON.stringify(horario)).not.toContain("não-serializar");
  });
  it("preserva ausência de snapshot e não inventa criação de um legado inválido", () => {
    expect(horariosSnapshotIfood(undefined, "America/Sao_Paulo")).toBeNull();
    sim.decifrar.mockReturnValue({ createdAt: "inválido", orderType: "TAKEOUT", orderTiming: "IMMEDIATE" });
    expect(horariosSnapshotIfood("cifra-ficticia", "America/Sao_Paulo")?.criadoEm).toBeNull();
  });
});
