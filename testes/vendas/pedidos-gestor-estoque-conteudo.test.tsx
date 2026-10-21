import React from "react";
import { beforeEach, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ exigir: vi.fn(), permitir: vi.fn(), identidade: vi.fn(), configurar: vi.fn(), listar: vi.fn(), loja: vi.fn(), catalogo: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: sim.exigir, podeAcessar: sim.permitir }));
vi.mock("@/lib/contexto-interface", () => ({ identidadeDaInterface: sim.identidade }));
vi.mock("@/lib/vendas/pedidos", () => ({ consultarMovimentacaoEstoqueGestorPedidos: sim.configurar, listarPedidos: sim.listar }));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoLoja: { findUnique: sim.loja }, clienteVenda: { findMany: sim.catalogo }, canalVenda: { findMany: sim.catalogo }, produtoVenda: { findMany: sim.catalogo } } }));
vi.mock("@/app/(protegido)/vendas/pedidos/gestor-client", () => ({ GestorPedidos: () => <div /> }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
import { GestorPedidos, type GestorProps } from "@/app/(protegido)/vendas/pedidos/gestor-client";
import { ConteudoGestorPedidos as ConteudoCompleto } from "@/app/(protegido)/vendas/pedidos/gestor-conteudo";
async function ConteudoGestorPedidos(p: Parameters<typeof ConteudoCompleto>[0]) {
  const tela = await ConteudoCompleto(p);
  const gestor = React.Children.toArray(tela.props.children).find(f => React.isValidElement(f) && f.type === GestorPedidos);
  if (!React.isValidElement<GestorProps>(gestor)) throw new Error("Gestor existente ausente da composição");
  return gestor;
}
const sessao = { usuarioId: "usuario-ficticio", admin: true };
const configuracao = { movimentarEstoque: false, versao: 0, podeAlterar: false, localMovimentarEstoqueId: null, locais: [] };
it("consulta históricos em lista, removendo filtros da fila e usando a criação", async () => {
  await ConteudoGestorPedidos({ searchParams: Promise.resolve({ status: "HISTORICO", modo: "calendario", etapaGestor: "preparo", operacional: "EM_PREPARO", busca: "22851" }) });
  expect(sim.listar).toHaveBeenLastCalledWith(expect.objectContaining({ status: "HISTORICO", modo: "lista", etapaGestor: undefined, operacional: undefined, baseData: "criacao", busca: "22851" }));
});
beforeEach(() => {
  vi.clearAllMocks(); sim.exigir.mockReset().mockResolvedValue(sessao); sim.identidade.mockResolvedValue("pedidos");
  sim.permitir.mockReset().mockResolvedValue(true); sim.configurar.mockResolvedValue(configuracao); sim.loja.mockResolvedValue(null); sim.catalogo.mockResolvedValue([]); sim.listar.mockResolvedValue({ pedidos: [] });
});
it("fornece ao Gestor a configuração validada pelo servidor sem derivar permissão no cliente", async () => {
  const tela = await ConteudoGestorPedidos({ searchParams: Promise.resolve({ modo: "lista", busca: "Caixa fictícia" }) });
  expect(sim.configurar).toHaveBeenCalledWith(sessao);
  expect(tela.props.configuracaoEstoque).toEqual(configuracao);
  expect(tela.props.filtros).toMatchObject({ modo: "lista", busca: "Caixa fictícia" });
  expect(sim.catalogo).toHaveBeenCalledWith({ where: { unificadoEmId: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
});
it.each([true, false])("fornece capacidade de cancelar=$autorizado exclusivamente pela permissão do servidor", async autorizado => {
  sim.permitir.mockImplementation((recurso: string, acao: string) => Promise.resolve(recurso === "vendas.pedidos.cancelar" && acao === "editar" ? autorizado : true));
  const tela = await ConteudoGestorPedidos({ searchParams: Promise.resolve({}) });
  expect(sim.permitir).toHaveBeenCalledWith("vendas.pedidos.cancelar", "editar");
  expect(tela.props.capacidades.cancelar).toBe(autorizado);
});
it.each([
  { admin: true, autorizado: true, esperado: true },
  { admin: false, autorizado: true, esperado: false },
  { admin: true, autorizado: false, esperado: false },
])("reserva a configuração iFood no menu ao admin=$admin com permissão=$autorizado", async ({ admin, autorizado, esperado }) => {
  sim.exigir.mockResolvedValue({ ...sessao, admin });
  sim.permitir.mockImplementation((recurso: string, acao: string) => Promise.resolve(recurso === "configuracoes.loja" && acao === "editar" ? autorizado : true));
  const composicao = await ConteudoCompleto({ searchParams: Promise.resolve({}) });
  const filhos = React.Children.toArray(composicao.props.children);
  const gestor = filhos.find(f => React.isValidElement(f) && f.type === GestorPedidos);
  if (!React.isValidElement<GestorProps>(gestor)) throw new Error("Gestor ausente da composição");
  expect(gestor.props.configurarIfood).toBe(esperado);
  expect(filhos.filter(f => React.isValidElement(f) && f.type === "div")).toEqual([]);
  if (admin) expect(sim.permitir).toHaveBeenCalledWith("configuracoes.loja", "editar");
  else expect(sim.permitir).not.toHaveBeenCalledWith("configuracoes.loja", "editar");
});
it.each(["quadros", "calendario", "lista"])("consulta a coorte operacional em %s quando a situação está ausente ou indica todos", async modo => {
  for (const status of [undefined, "todos", "operacionais"]) {
    const tela = await ConteudoGestorPedidos({ searchParams: Promise.resolve({ modo, ...(status ? { status } : {}) }) });
    expect(tela.props.filtros.status).toBe(status ?? "todos");
    expect(sim.listar).toHaveBeenLastCalledWith(expect.objectContaining({ modo, status: "operacionais", pagina: 1 }));
    expect(sim.listar.mock.lastCall?.[0].apenasEntreguesRecentes).toBeUndefined();
    expect(sim.listar.mock.lastCall?.[0].excluirCancelados).toBeUndefined();
  }
});
it.each(["RASCUNHO", "CANCELADO", "DECLINADO", "ESTORNADO"])("preserva a consulta explícita de %s na Lista, incluindo filtros e paginação", async status => {
  const filtros = { modo: "lista", status, busca: "Cliente fictício", clienteId: "cliente-ficticio", canalId: "canal-ficticio", pagina: "3", de: "2026-01-01", ate: "2026-10-09" };
  const tela = await ConteudoGestorPedidos({ searchParams: Promise.resolve(filtros) });
  expect(tela.props.filtros).toEqual(filtros);
  expect(sim.listar).toHaveBeenCalledExactlyOnceWith({ ...filtros, pagina: 3 });
});
it.each(["quadros", "lista"])("preserva entregues antigos no resultado operacional de %s sem impor período recente", async modo => {
  const resultado = { pedidos: [{ id: "entregue-antigo-ficticio", status: "CONFIRMADO", operacional: "ENTREGUE", criadoEm: "2025-01-01T12:00:00Z", entregueEm: "2025-01-02T12:00:00Z" }], quantidadeTotal: 1, pagina: 1, paginas: 1 };
  sim.listar.mockResolvedValueOnce(resultado);
  const tela = await ConteudoGestorPedidos({ searchParams: Promise.resolve({ modo }) });
  expect(sim.listar).toHaveBeenCalledExactlyOnceWith({ modo, status: "operacionais", pagina: 1 });
  expect(tela.props.resultado).toBe(resultado);
});
it("preserva uma situação explicitamente filtrada na URL", async () => {
  const tela = await ConteudoGestorPedidos({ searchParams: Promise.resolve({ status: "CONFIRMADO" }) });
  expect(tela.props.filtros.status).toBe("CONFIRMADO");
  expect(sim.listar).toHaveBeenCalledWith(expect.objectContaining({ status: "CONFIRMADO" }));
});
it("nega acesso antes de consultar estoque ou carteira", async () => {
  sim.exigir.mockRejectedValue(new Error("Acesso negado"));
  await expect(ConteudoGestorPedidos({ searchParams: Promise.resolve({}) })).rejects.toThrow("Acesso negado");
  expect(sim.configurar).not.toHaveBeenCalled(); expect(sim.loja).not.toHaveBeenCalled(); expect(sim.listar).not.toHaveBeenCalled();
});
it("redireciona o HUB antes de consultar configuração sem perder contexto", async () => {
  sim.identidade.mockResolvedValue("hub");
  await expect(ConteudoGestorPedidos({ searchParams: Promise.resolve({ modo: "lista", canalId: "site" }) })).rejects.toThrow("https://pedidos.grazinghub.com.br/vendas/pedidos");
  expect(sim.configurar).not.toHaveBeenCalled(); expect(sim.listar).not.toHaveBeenCalled();
});
