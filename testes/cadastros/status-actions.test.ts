import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ sessao: vi.fn(), usuario: vi.fn(), fornecedor: vi.fn(), insumo: vi.fn(), anterior: vi.fn(), registrar: vi.fn(), bloquear: vi.fn(), revalidar: vi.fn(), permissao: vi.fn() }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: m.registrar }));
vi.mock("@/lib/session", () => ({ getSession: m.sessao }));
vi.mock("@/lib/prisma", () => {
  const tx = { $queryRaw: m.bloquear, fornecedor: { updateMany: m.fornecedor, findFirst: m.anterior }, insumo: { updateMany: m.insumo, findFirst: m.anterior } };
  return { prisma: { usuario: { findFirst: m.usuario }, ...tx, $transaction: async (executar: (banco: typeof tx) => unknown) => executar(tx) } };
});
vi.mock("next/cache", () => ({ revalidatePath: m.revalidar }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: m.permissao }));
import { alterarStatusFornecedorAction, alterarStatusInsumoAction } from "@/app/(protegido)/status-cadastros-actions";
beforeEach(() => {
  vi.resetAllMocks(); m.sessao.mockResolvedValue({ userId: "administrador", nome: "Administrador sintético" }); m.usuario.mockResolvedValue({ id: "administrador" });
  m.anterior.mockResolvedValue({ ativo: true });
  m.fornecedor.mockResolvedValue({ count: 1 }); m.insumo.mockResolvedValue({ count: 1 });
});
it.each([
  ["fornecedor", alterarStatusFornecedorAction, m.fornecedor], ["insumo", alterarStatusInsumoAction, m.insumo],
] as const)("salva status explícito de %s sem alterar os demais dados, inclusive em repetição", async (tipo, acao, atualizar) => {
  const where = { id: "cadastro", ...(tipo === "insumo" ? { excluidoEm: null } : {}) };
  expect(await acao("cadastro", false)).toEqual({ ok: true });
  expect(await acao("cadastro", false)).toEqual({ ok: true });
  expect(atualizar).toHaveBeenNthCalledWith(1, { where, data: { ativo: false } });
  expect(atualizar).toHaveBeenNthCalledWith(2, { where, data: { ativo: false } });
  expect(await acao("cadastro", true)).toEqual({ ok: true });
  expect(atualizar).toHaveBeenLastCalledWith({ where, data: { ativo: true } });
  expect(m.revalidar).toHaveBeenCalledWith("/compras");
  expect(m.revalidar).toHaveBeenCalledWith("/fornecedores");
  expect(m.revalidar).toHaveBeenCalledWith("/inventario", "layout");
});
it("recusa sessão ausente e usuário inativo sem gravar", async () => {
  m.sessao.mockResolvedValue(null);
  expect(await alterarStatusInsumoAction("cadastro", false)).toHaveProperty("erro");
  m.sessao.mockResolvedValue({ userId: "desativado" }); m.usuario.mockResolvedValue(null);
  expect(await alterarStatusFornecedorAction("cadastro", false)).toHaveProperty("erro");
  expect(m.insumo).not.toHaveBeenCalled(); expect(m.fornecedor).not.toHaveBeenCalled();
});
it("recusa entrada inválida e diferencia registro removido de falha de persistência", async () => {
  expect(await alterarStatusInsumoAction("", false)).toHaveProperty("erro");
  expect(await alterarStatusInsumoAction("cadastro", "false" as unknown as boolean)).toHaveProperty("erro");
  expect(m.insumo).not.toHaveBeenCalled();
  m.insumo.mockResolvedValueOnce({ count: 0 });
  expect(await alterarStatusInsumoAction("removido", true)).toEqual({ erro: expect.stringContaining("não encontrado") });
  m.fornecedor.mockRejectedValueOnce(Error("Banco indisponível"));
  expect(await alterarStatusFornecedorAction("cadastro", true)).toHaveProperty("erro");
  expect(m.revalidar).not.toHaveBeenCalled();
});
it("exige a permissão de edição do módulo antes de qualquer alteração", async () => {
  m.permissao.mockRejectedValueOnce(Error("Sem acesso"));
  await expect(alterarStatusFornecedorAction("cadastro", false)).rejects.toThrow("Sem acesso");
  expect(m.permissao).toHaveBeenCalledWith("fornecedores", "editar");
  expect(m.fornecedor).not.toHaveBeenCalled();
  await alterarStatusInsumoAction("cadastro", false);
  expect(m.permissao).toHaveBeenLastCalledWith("insumos", "editar");
});
it("registra o autor servidor e os estados reais sem gravar novamente um status igual", async () => {
  await alterarStatusInsumoAction("cadastro", false);
  expect(m.registrar).toHaveBeenCalledWith(expect.any(Object), { userId: "administrador", nome: "Administrador sintético" }, expect.objectContaining({
    recurso: "insumos", entidadeId: "cadastro", acao: "INATIVACAO", antes: { ativo: true }, depois: { ativo: false },
  }));
  m.anterior.mockResolvedValueOnce({ ativo: false });
  await alterarStatusInsumoAction("cadastro", false);
  expect(m.registrar).toHaveBeenCalledTimes(1);
});
it("erro de registro não responde sucesso nem revalida os consumidores", async () => {
  m.registrar.mockRejectedValueOnce(Error("Falha de atividade sintética"));
  expect(await alterarStatusFornecedorAction("cadastro", false)).toHaveProperty("erro");
  expect(m.revalidar).not.toHaveBeenCalled();
});
