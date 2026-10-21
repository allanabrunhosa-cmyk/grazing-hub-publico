import { beforeEach, describe, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ sessao: vi.fn(), lista: vi.fn(), primeiro: vi.fn(), fonte: vi.fn(), alvo: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({ getSession: s.sessao }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  atividadeUsuario: { findMany: s.lista, findFirst: s.primeiro },
  historicoAcesso: { findUnique: s.fonte }, pedidoVenda: { findUnique: s.alvo },
  pedidoCompra: { findUnique: s.alvo }, produtoVenda: { findUnique: s.alvo }, clienteVenda: { findUnique: s.alvo },
  fornecedor: { findUnique: s.alvo }, insumo: { findFirst: s.alvo },
  faturaCartao: { findUnique: s.alvo }, lancamentoFinanceiro: { findFirst: s.alvo },
} }));
import { consultarAtividades, consultarDetalheAtividade } from "@/lib/atividades/consulta";
import { GET as listaGET } from "@/app/api/usuarios/[id]/atividades/route";
import { GET as detalheGET } from "@/app/api/usuarios/[id]/atividades/[eventoId]/route";
const filtros = { usuarioId: "alvo", de: "2026-10-01", ate: "2026-10-31" };
const evento = (id = "evento") => ({ id, ocorridoEm: new Date("2026-10-10T15:00:00Z"), autorId: "alvo", autorNome: "Autor histórico",
  atorTipo: "USUARIO", atorReferencia: null, origem: "INTERFACE", modulo: "acessos", recurso: "configuracoes.usuarios",
  acao: "USUARIO_ATUALIZADO", entidade: "Usuário", resumo: "Usuário alterado.", resultado: "SUCESSO",
  fonteTabela: "HistoricoAcesso", fonteId: "fonte", entidadeId: "outro", antes: null, depois: null });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_SECRET", "segredo-sintetico-exclusivo-de-teste");
  s.sessao.mockResolvedValue({ userId: "leitor", admin: false, permissoes: {
    "configuracoes.usuarios": ["visualizar"], "configuracoes.usuarios.atividades": ["visualizar"],
  }, excecoes: {} });
  s.primeiro.mockImplementation(async ({ select }) => select.sequencia ? { sequencia: BigInt(200) } : { ocorridoEm: new Date("2026-10-01T00:00:00Z") });
  s.lista.mockResolvedValue([evento()]);
  s.fonte.mockResolvedValue({ antes: { ativo: true, senhaHash: "secreto", email: "privado@example.invalid", valor: "10.00" },
    depois: { ativo: false, senha: "secreto", token: "secreto", valor: "20.00" } });
});
describe("consulta protegida de atividades", () => {
  it("nega por padrão, inclusive acesso direto à lista e detalhes da API", async () => {
    s.sessao.mockResolvedValue({ userId: "sem-acesso", admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"] }, excecoes: {} });
    await expect(consultarAtividades(filtros)).rejects.toMatchObject({ status: 403 });
    expect((await listaGET(new Request("http://localhost/?de=2026-10-01&ate=2026-10-31"), { params: Promise.resolve({ id: "alvo" }) })).status).toBe(403);
    expect((await detalheGET(new Request("http://localhost"), { params: Promise.resolve({ id: "alvo", eventoId: "evento" }) })).status).toBe(403);
    expect(s.lista).not.toHaveBeenCalled(); expect(s.fonte).not.toHaveBeenCalled();
  });
  it("exige sessão e preserva administrador oficial", async () => {
    s.sessao.mockResolvedValue(null); await expect(consultarAtividades(filtros)).rejects.toMatchObject({ status: 401 });
    s.sessao.mockResolvedValue({ admin: true, permissoes: {}, excecoes: {} });
    expect((await consultarAtividades(filtros)).eventos).toHaveLength(1);
  });
  it("consulta pelo autor por padrão e cadastro por afetado, nunca pelo e-mail", async () => {
    await consultarAtividades(filtros);
    expect(s.lista.mock.calls[0][0]).toMatchObject({ where: { autorId: "alvo", atorTipo: "USUARIO", recurso: { in: ["configuracoes.usuarios", "configuracoes.usuarios.atividades"] } }, take: 51 });
    await consultarAtividades({ ...filtros, perspectiva: "cadastro" });
    expect(s.lista.mock.calls[1][0].where).toHaveProperty("usuarioAfetadoId", "alvo");
    expect(s.lista.mock.calls[1][0].where).not.toHaveProperty("autorId");
  });
  it("não retorna payload, segredos, dados pessoais ou valores restritos", async () => {
    s.primeiro.mockResolvedValue(evento());
    const detalhe = await consultarDetalheAtividade("alvo", "evento");
    expect(detalhe.alteracoes).toEqual([{ campo: "ativo", antes: "true", depois: "false" }]);
    const json = JSON.stringify(detalhe); expect(json).not.toMatch(/senha|token|email|privado|10.00|20.00|fonteId/);
    expect(s.primeiro.mock.calls[0][0].where.recurso.in).not.toContain("financeiro.movimentacoes");
  });
  it("detalhe de outro usuário ou módulo restrito fica indisponível", async () => {
    s.primeiro.mockResolvedValue(null);
    await expect(consultarDetalheAtividade("outra-pessoa", "evento")).rejects.toMatchObject({ status: 404 });
    expect(s.fonte).not.toHaveBeenCalled();
  });
  it("referência removida e entidade ausente são tratadas sem perder o evento", async () => {
    s.primeiro.mockResolvedValue(evento()); s.fonte.mockResolvedValue(null);
    expect(await consultarDetalheAtividade("alvo", "evento")).toMatchObject({ referenciaDisponivel: false, alteracoes: [], link: null });
  });
  it.each([
    ["PedidoCompra", "compras", "/compras"], ["PRODUTO", "vendas.produtos", "/vendas/produtos"],
    ["CLIENTE", "vendas.clientes", "/vendas/clientes"], ["Insumo", "insumos", "/insumos"], ["Fornecedor", "fornecedores", "/fornecedores"],
    ["LancamentoFinanceiro", "financeiro.movimentacoes", "/financeiro/movimentacoes"],
  ])("link de %s exige entidade existente e permissão do módulo", async (entidade, recurso, rota) => {
    const sessao = { userId: "leitor", admin: false, permissoes: { "configuracoes.usuarios": ["visualizar"], "configuracoes.usuarios.atividades": ["visualizar"], [recurso]: ["visualizar"] }, excecoes: {} };
    s.sessao.mockResolvedValue(sessao); s.primeiro.mockResolvedValue({ ...evento(), entidade, recurso, entidadeId: "alvo-link" });
    s.alvo.mockResolvedValue({ id: "alvo-link" });
    expect((await consultarDetalheAtividade("alvo", "evento")).link).toBe(rota + "?entidade=alvo-link");
    s.alvo.mockResolvedValue(null); expect((await consultarDetalheAtividade("alvo", "evento")).link).toBeNull();
    s.alvo.mockClear(); s.sessao.mockResolvedValue({ ...sessao, permissoes: { "configuracoes.usuarios": ["visualizar"], "configuracoes.usuarios.atividades": ["visualizar"] } });
    expect((await consultarDetalheAtividade("alvo", "evento")).link).toBeNull(); expect(s.alvo).not.toHaveBeenCalled();
  });
  it("50 eventos, cursor com filtros vinculados e limite de inserção, sem OFFSET", async () => {
    s.lista.mockResolvedValue(Array.from({ length: 51 }, (_, i) => evento("evento-" + String(i).padStart(3, "0"))));
    const pagina = await consultarAtividades(filtros);
    expect(pagina.eventos).toHaveLength(50); expect(pagina.proximoCursor).toBeTruthy();
    await consultarAtividades({ ...filtros, cursor: pagina.proximoCursor! });
    expect(s.lista.mock.calls[1][0].where).toMatchObject({ sequencia: { lte: BigInt(200) }, OR: [{ ocorridoEm: { lt: new Date("2026-10-10T15:00:00Z") } }, { ocorridoEm: new Date("2026-10-10T15:00:00Z"), id: { lt: "evento-049" } }] });
    expect(s.lista.mock.calls[1][0]).not.toHaveProperty("skip");
    await expect(consultarAtividades({ ...filtros, modulo: "financeiro", cursor: pagina.proximoCursor! })).rejects.toMatchObject({ status: 400 });
  });
  it("valida filtros na API e falha de consulta vira 503 independente", async () => {
    const context = { params: Promise.resolve({ id: "alvo" }) };
    expect((await listaGET(new Request("http://localhost/?de=2026-02-30&ate=2026-10-31"), context)).status).toBe(400);
    s.lista.mockRejectedValue(new Error("senha=nao-expor"));
    const r = await listaGET(new Request("http://localhost/?de=2026-10-01&ate=2026-10-31"), context);
    expect(r.status).toBe(503); expect(await r.text()).not.toContain("senha");
  });
});
