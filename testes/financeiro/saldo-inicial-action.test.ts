import { beforeEach, expect, it, vi } from "vitest";

const simulados = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn(), atualizar: vi.fn(), revalidar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: simulados.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findUnique: simulados.usuario }, contaBancaria: { updateMany: simulados.atualizar } } }));
vi.mock("next/cache", () => ({ revalidatePath: simulados.revalidar }));
import { editarSaldoInicialAction } from "@/app/(protegido)/financeiro/bancario/actions";

function formulario(valor = "-1234,56", data = "2026-09-10") {
  const dados = new FormData();
  dados.set("saldoInicial", valor);
  dados.set("dataSaldoInicial", data);
  return dados;
}
beforeEach(() => {
  vi.resetAllMocks();
  simulados.sessao.mockResolvedValue({ userId: "administrador", admin: true });
  simulados.usuario.mockResolvedValue({ admin: true, ativo: true });
  simulados.atualizar.mockResolvedValue({ count: 1 });
});

it("exige sessão antes de consultar ou atualizar o saldo", async () => {
  simulados.sessao.mockResolvedValue(null);
  await expect(editarSaldoInicialAction("conta", formulario())).rejects.toThrow("NEXT_REDIRECT");
  expect(simulados.usuario).not.toHaveBeenCalled();
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it.each([null, { userId: "leitor", admin: false, permissoes: {}, excecoes: {} }, { userId: "leitor", admin: false, permissoes: { "financeiro.saldo": ["visualizar"] }, excecoes: {} }])("rejeita sessão revogada ou sem a permissão atual de saldo: %j", async (sessao) => {
  simulados.sessao.mockResolvedValue(sessao);
  await expect(editarSaldoInicialAction("conta", formulario())).rejects.toThrow("NEXT_REDIRECT");
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it("permite o saldo para perfil com autorização explícita, sem exigir ser administrador", async () => {
  simulados.sessao.mockResolvedValue({ userId: "financeiro", admin: false, permissoes: { "financeiro.saldo": ["visualizar", "editar"] }, excecoes: {} });
  expect(await editarSaldoInicialAction("conta", formulario())).toEqual({ ok: true });
});
it.each(["", "abc", "10abc", "NaN", "Infinity", "1e3", "1.234,56", "10,999", "1000000000000"])("rejeita saldo inválido %s", async (valor) => {
  expect(await editarSaldoInicialAction("conta", formulario(valor))).toHaveProperty("erro");
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it.each(["", "2026-02-29", "2026-04-31", "0000-01-01", "1999-12-31", "1900-01-01", "0206-10-10"])("rejeita data inválida %s", async (data) => {
  expect(await editarSaldoInicialAction("conta", formulario("0", data))).toHaveProperty("erro");
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
it.each([["-1234,56", -1234.56], ["0", 0], ["999999999999.99", 999999999999.99]])("salva somente a base da conta com valor %s e atualiza as telas", async (texto, valor) => {
  expect(await editarSaldoInicialAction("conta", formulario(String(texto)))).toEqual({ ok: true });
  expect(simulados.atualizar).toHaveBeenCalledExactlyOnceWith({ where: { id: "conta" }, data: { saldoInicial: valor, dataSaldoInicial: new Date("2026-09-10T00:00:00Z") } });
  for (const rota of ["bancario", "movimentacoes", "fluxo-de-caixa"]) expect(simulados.revalidar).toHaveBeenCalledWith(`/financeiro/${rota}`);
});
it("informa conta inexistente sem revalidar", async () => {
  simulados.atualizar.mockResolvedValue({ count: 0 });
  expect(await editarSaldoInicialAction("ausente", formulario())).toEqual({ erro: "Conta bancária não encontrada." });
  expect(simulados.revalidar).not.toHaveBeenCalled();
});
it.each([undefined, null, "", " ", {}])("rejeita identificador de conta inválido antes da gravação: %j", async (id) => {
  expect(await editarSaldoInicialAction(id as string, formulario())).toHaveProperty("erro");
  expect(simulados.atualizar).not.toHaveBeenCalled();
});
