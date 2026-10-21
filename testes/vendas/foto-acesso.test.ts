import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ sessao: vi.fn(), foto: vi.fn(), produtoPedido: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: { fotoProdutoVenda: { findUnique: sim.foto }, produtoVenda: { findFirst: sim.produtoPedido } } }));
import { GET } from "@/app/api/vendas/fotos/[id]/route";
const consultar = (id = "foto-teste") => GET(new Request("http://localhost/api/vendas/fotos/" + id), { params: Promise.resolve({ id }) });
beforeEach(() => { vi.resetAllMocks(); });
it("foto privada exige sessão e permissão antes de consultar o banco", async () => {
  sim.sessao.mockResolvedValue(null);
  expect((await consultar()).status).toBe(401);
  sim.sessao.mockResolvedValue({ admin: false, permissoes: {}, excecoes: {} });
  expect((await consultar()).status).toBe(403);
  expect(sim.foto).not.toHaveBeenCalled();
});
it("responde somente à identidade válida com cache privado e tipo protegido", async () => {
  sim.sessao.mockResolvedValue({ admin: false, permissoes: { "vendas.produtos": ["visualizar"] }, excecoes: {} });
  expect((await consultar("../invalido")).status).toBe(404);
  expect(sim.foto).not.toHaveBeenCalled();
  sim.foto.mockResolvedValue({ dados: new Uint8Array([1, 2, 3]), mime: "image/png" });
  const resposta = await consultar();
  expect(resposta.status).toBe(200);
  expect(resposta.headers.get("Cache-Control")).toBe("private, no-store");
  expect(resposta.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(sim.foto).toHaveBeenCalledWith({ where: { id: "foto-teste" }, select: { dados: true, mime: true } });
});
it("permite a foto em consulta fiscal, sem conceder acesso por permissão de edição isolada", async () => {
  sim.sessao.mockResolvedValue({ admin: false, permissoes: { "vendas.fiscal": ["editar"] }, excecoes: {} });
  expect((await consultar()).status).toBe(403); expect(sim.foto).not.toHaveBeenCalled();
  sim.sessao.mockResolvedValue({ admin: false, permissoes: { "vendas.fiscal": ["visualizar"] }, excecoes: {} });
  sim.foto.mockResolvedValue({ dados: new Uint8Array([1]), mime: "image/png" });
  expect((await consultar()).status).toBe(200);
});
it("operador de pedidos acessa somente foto vinculada a produto com item vigente de pedido", async () => {
  sim.sessao.mockResolvedValue({ admin: false, permissoes: { "vendas.pedidos": ["visualizar"] }, excecoes: {} });
  sim.produtoPedido.mockResolvedValue(null);
  expect((await consultar()).status).toBe(403);
  expect(sim.foto).not.toHaveBeenCalled();
  sim.produtoPedido.mockResolvedValue({ id: "produto-ficticio" });
  sim.foto.mockResolvedValue({ dados: new Uint8Array([1]), mime: "image/png" });
  expect((await consultar()).status).toBe(200);
  expect(sim.produtoPedido).toHaveBeenLastCalledWith({ where: { fotoUrl: "/api/vendas/fotos/foto-teste", itensPedidoVenda: { some: { vigente: true } } }, select: { id: true } });
  sim.produtoPedido.mockClear();
  sim.sessao.mockResolvedValue({ admin: false, permissoes: { "vendas.pedidos": ["editar"] }, excecoes: {} });
  expect((await consultar()).status).toBe(403);
  expect(sim.produtoPedido).not.toHaveBeenCalled();
});
