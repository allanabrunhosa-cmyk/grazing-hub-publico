import { beforeEach, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  sessao: vi.fn(), permissao: vi.fn(), transaction: vi.fn(), ponto: vi.fn(), dispositivoRevogar: vi.fn(), codigoRevogar: vi.fn(), filaRevogar: vi.fn(),
  confirmar: vi.fn(), criar: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: fake.sessao }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: fake.permissao }));
vi.mock("@/lib/etiquetas/pontos", () => ({ LOJA_ETIQUETAS: "singleton", emitirCodigoVinculo: vi.fn() }));
vi.mock("@/lib/etiquetas/pontos-wifi", () => ({ cifrarSenhaWifi: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: fake.transaction,
  configuracaoLoja: { upsert: vi.fn() }, pontoImpressao: { create: fake.criar },
  envioPontoImpressao: { updateMany: fake.confirmar },
} }));
import { confirmarSaidaFisicaPontoAction, criarPontoImpressaoAction, revogarPontoAction } from "@/app/(protegido)/producao/etiquetas/pontos-actions";

beforeEach(() => { vi.resetAllMocks(); fake.permissao.mockResolvedValue({}); });

it("impede gestão por usuário sem perfil administrador", async () => {
  fake.sessao.mockResolvedValue({ userId: "operador", admin: false });
  expect(await criarPontoImpressaoAction("Cozinha", "impressora")).toHaveProperty("erro");
  expect(fake.criar).not.toHaveBeenCalled();
});

it("revogação invalida credencial, código pendente e reserva em andamento", async () => {
  fake.sessao.mockResolvedValue({ userId: "admin", admin: true });
  fake.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    pontoImpressao: { findFirst: fake.ponto },
    dispositivoImpressao: { updateMany: fake.dispositivoRevogar },
    codigoVinculoImpressao: { updateMany: fake.codigoRevogar },
    envioPontoImpressao: { updateMany: fake.filaRevogar },
  }));
  fake.ponto.mockResolvedValue({ id: "ponto-1", lojaId: "singleton" });
  expect(await revogarPontoAction("ponto-1")).toEqual({ ok: true });
  expect(fake.dispositivoRevogar).toHaveBeenCalledWith(expect.objectContaining({ where: { pontoId: "ponto-1", revogadoEm: null } }));
  expect(fake.codigoRevogar).toHaveBeenCalledWith(expect.objectContaining({ where: { pontoId: "ponto-1", usadoEm: null } }));
  expect(fake.filaRevogar).toHaveBeenCalledWith(expect.objectContaining({ where: { pontoId: "ponto-1", estado: "RESERVADO" }, data: expect.objectContaining({ estado: "INCERTO" }) }));
});

it("só registra conferência física com permissão e resultado elegível", async () => {
  fake.permissao.mockRejectedValueOnce(new Error("sem permissão"));
  await expect(confirmarSaidaFisicaPontoAction("envio-1")).rejects.toThrow("sem permissão");
  expect(fake.confirmar).not.toHaveBeenCalled();
  fake.sessao.mockResolvedValue({ userId: "operador", admin: false });
  fake.confirmar.mockResolvedValue({ count: 0 });
  expect(await confirmarSaidaFisicaPontoAction("envio-1")).toHaveProperty("erro");
  expect(fake.confirmar).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "envio-1", lojaId: "singleton", estado: { in: ["ENVIADO_USB", "INCERTO"] } } }));
});
