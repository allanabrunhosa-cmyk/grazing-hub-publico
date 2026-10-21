import { describe, expect, it, vi, beforeEach } from "vitest";

const fake = vi.hoisted(() => ({
  transaction: vi.fn(), query: vi.fn(), updateMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), update: vi.fn(),
  codigo: vi.fn(), dispositivo: vi.fn(), autorizacao: vi.fn(), sessao: vi.fn(), findEnvio: vi.fn(), createEnvio: vi.fn(),
  codigoUpdate: vi.fn(), dispositivoCreate: vi.fn(), deleteLimites: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: fake.transaction,
  envioPontoImpressao: { updateMany: fake.updateMany, findUnique: fake.findEnvio },
  dispositivoImpressao: { findUnique: fake.dispositivo },
} }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: fake.autorizacao }));
vi.mock("@/lib/session", () => ({ getSession: fake.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { autenticarDispositivo, consumirCodigoVinculo, finalizarEnvio, reservarProximoEnvio } from "@/lib/etiquetas/pontos";
import { situacaoConector, COMUNICACAO_RECENTE_MS } from "@/lib/etiquetas/pontos-estado";

beforeEach(() => {
  vi.resetAllMocks();
  fake.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    $queryRaw: fake.query,
    pontoImpressao: { findFirst: async () => ({ id: "ponto-a" }) },
    envioPontoImpressao: { updateMany: fake.updateMany, count: fake.count, findFirst: fake.findFirst, update: fake.update },
  }));
});

describe("presença e revogação", () => {
  const agora = new Date("2026-09-24T12:00:00Z");
  it("distingue vínculo, primeira comunicação e atraso pelo horário do servidor", () => {
    expect(situacaoConector(null, agora)).toBe("NAO_VINCULADO");
    expect(situacaoConector({ vistoEm: null, revogadoEm: null }, agora)).toBe("AGUARDANDO_PRIMEIRA_COMUNICACAO");
    expect(situacaoConector({ vistoEm: new Date(agora.getTime() - COMUNICACAO_RECENTE_MS), revogadoEm: null }, agora)).toBe("RECENTE");
    expect(situacaoConector({ vistoEm: new Date(agora.getTime() - COMUNICACAO_RECENTE_MS - 1), revogadoEm: null }, agora)).toBe("ATRASADA");
    expect(situacaoConector({ vistoEm: agora, revogadoEm: agora }, agora)).toBe("REVOGADO");
  });
  it("recusa token inválido, revogado e ponto inativo", async () => {
    expect(await autenticarDispositivo(new Request("https://example.invalid"))).toBeNull();
    expect(fake.dispositivo).not.toHaveBeenCalled();
    const request = new Request("https://example.invalid", { headers: { authorization: `Bearer gpi_${"a".repeat(64)}` } });
    fake.dispositivo.mockResolvedValue({ revogadoEm: new Date(), ponto: { ativo: true } });
    expect(await autenticarDispositivo(request)).toBeNull();
    fake.dispositivo.mockResolvedValue({ revogadoEm: null, ponto: { ativo: false } });
    expect(await autenticarDispositivo(request)).toBeNull();
    fake.dispositivo.mockResolvedValue({ revogadoEm: null, ponto: { ativo: true }, id: "device" });
    expect(await autenticarDispositivo(request)).toMatchObject({ id: "device" });
  });
});

describe("vínculo temporário", () => {
  const request = new Request("https://validades.grazinghub.com.br/api/etiquetas/conector/vincular", { headers: { "x-real-ip": "203.0.113.9" } });
  it("limita tentativas e consome o código uma única vez", async () => {
    let usado = false;
    fake.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
      $queryRaw: fake.query,
    pontoImpressao: { findFirst: async () => ({ id: "ponto-a" }) },
      limiteVinculoImpressao: { deleteMany: fake.deleteLimites },
      codigoVinculoImpressao: { findUnique: fake.codigo, updateMany: fake.codigoUpdate },
      dispositivoImpressao: { create: fake.dispositivoCreate },
    }));
    fake.query.mockResolvedValue([{ tentativas: 1 }]);
    fake.codigo.mockImplementation(async () => ({
      id: "codigo-1", pontoId: "ponto-1", lojaId: "singleton", usadoEm: usado ? new Date() : null,
      expiraEm: new Date(Date.now() + 60_000), tentativas: 0,
      ponto: { lojaId: "singleton", ativo: true, dispositivo: null },
    }));
    fake.codigoUpdate.mockImplementation(async () => { usado = true; return { count: 1 }; });
    const primeiro = await consumirCodigoVinculo("A".repeat(36), request);
    expect(primeiro).toMatchObject({ pontoId: "ponto-1", token: expect.stringMatching(/^gpi_[a-f0-9]{64}$/) });
    expect(await consumirCodigoVinculo("A".repeat(36), request)).toBeNull();
    expect(fake.dispositivoCreate).toHaveBeenCalledTimes(1);
    fake.query.mockResolvedValue([{ tentativas: 9 }]);
    expect(await consumirCodigoVinculo("B".repeat(36), request)).toBeNull();
  });
});

describe("fila por impressora", () => {
  it("não reserva quando outra consulta mantém a trava", async () => {
    fake.query.mockResolvedValue([{ obtida: false }]);
    expect(await reservarProximoEnvio("ponto-a", "loja-a")).toBeNull();
    expect(fake.findFirst).not.toHaveBeenCalled();
  });
  it("converte reserva vencida em incerta e não a reenvia enquanto há trabalho em curso", async () => {
    fake.query.mockResolvedValue([{ obtida: true }]);
    fake.count.mockResolvedValue(1);
    expect(await reservarProximoEnvio("ponto-a", "loja-a")).toBeNull();
    expect(fake.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ pontoId: "ponto-a", lojaId: "loja-a", estado: "RESERVADO" }),
      data: expect.objectContaining({ estado: "INCERTO" }),
    }));
    expect(fake.findFirst).not.toHaveBeenCalled();
  });
  it("reserva somente o próximo pendente da loja e do ponto", async () => {
    fake.query.mockResolvedValue([{ obtida: true }]);
    fake.count.mockResolvedValue(0);
    fake.findFirst.mockResolvedValue({ id: "envio-1" });
    fake.update.mockResolvedValue({ id: "envio-1", estado: "RESERVADO" });
    expect(await reservarProximoEnvio("ponto-a", "loja-a")).toMatchObject({ id: "envio-1" });
    expect(fake.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { pontoId: "ponto-a", lojaId: "loja-a", estado: "PENDENTE" } }));
  });
  it("só aceita confirmação de trabalho reservado para o mesmo ponto", async () => {
    fake.updateMany.mockResolvedValue({ count: 0 });
    expect(await finalizarEnvio("ponto-a", "envio-1", "ENVIADO_USB")).toBe(false);
    expect(fake.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "envio-1", pontoId: "ponto-a", estado: "RESERVADO" } }));
    fake.updateMany.mockResolvedValue({ count: 1 });
    expect(await finalizarEnvio("ponto-a", "envio-1", "INCERTO")).toBe(true);
  });
});
