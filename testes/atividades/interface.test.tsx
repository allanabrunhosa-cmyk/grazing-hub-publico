// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AtividadesUsuario } from "@/app/(protegido)/configuracoes/usuarios/atividades-usuario";
import { UsuariosPermissoes } from "@/app/(protegido)/configuracoes/usuarios/usuarios-permissoes";
import type { AtividadeRow, DetalheAtividade, PaginaAtividades } from "@/lib/atividades/types";

const sim = vi.hoisted(() => ({ salvar: vi.fn(), carregar: vi.fn(), excluir: vi.fn(), historico: vi.fn(), excluidos: vi.fn() }));
vi.mock("@/app/(protegido)/configuracoes/usuarios/actions", () => ({
  salvarUsuarioAcesso: sim.salvar, carregarAcessos: sim.carregar, excluirUsuarioAcesso: sim.excluir,
  carregarHistoricoAcessos: sim.historico,
  carregarUsuariosExcluidos: sim.excluidos,
  salvarPerfilAcesso: vi.fn(), excluirPerfilAcesso: vi.fn(), alterarStatusUsuarioAcesso: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const evento: AtividadeRow = { id: "evt-1", data: "2026-10-01T02:30:00.000Z", autor: "Autora fictícia", atorTipo: "USUARIO", origem: "INTERFACE", modulo: "pedidos", acao: "EDITAR", entidade: "PedidoVenda", resumo: "Pedido fictício atualizado", resultado: "SUCESSO" };
const pagina: PaginaAtividades = { eventos: [evento], proximoCursor: null, inicioCobertura: "2026-09-01T12:00:00.000Z" };
const detalhe: DetalheAtividade = { evento, alteracoes: [{ campo: "Situação", antes: "Rascunho", depois: "Confirmado" }], link: "/vendas/pedidos", referenciaDisponivel: true };
const dados = { perfis: [{ id: "p1", nome: "Equipe", descricao: "", sistema: null, permissoes: {}, usuarios: 1, versao: "1" }], usuarios: [{ id: "u1", nome: "Pessoa fictícia", email: "pessoa@example.invalid", ativo: false, perfilAcessoId: "p1", excecoes: {}, versao: "2" }], historico: [] };
const resposta = (dados: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => dados }) as Response;
const chamada = vi.fn<typeof fetch>();
function montar() { return render(<AtividadesUsuario usuarioId="u1" nomeUsuario="Pessoa fictícia" podeVer />); }
async function selecionar(rotulo: string, opcao: string) {
  const u = userEvent.setup(); await u.click(screen.getByRole("combobox", { name: rotulo }));
  await u.click(await screen.findByRole("option", { name: opcao }));
}
beforeEach(() => { vi.stubGlobal("fetch", chamada); chamada.mockResolvedValue(resposta(pagina)); });
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe("aba de atividades por usuário", () => {
  it("consulta excluídos sob demanda, busca apenas ao confirmar e oferece somente Atividades", async () => {
    sim.excluidos.mockResolvedValue([{ id: "u-excluido", nome: "Pessoa excluída fictícia" }]);
    render(<UsuariosPermissoes inicial={dados} podeVerAtividades />);
    expect(sim.excluidos).not.toHaveBeenCalled();
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Usuários excluídos" }));
    await screen.findByText("Pessoa excluída fictícia");
    fireEvent.change(screen.getByLabelText("Buscar usuários excluídos"), { target: { value: "Pessoa" } });
    expect(sim.excluidos).toHaveBeenCalledTimes(1);
    await u.click(screen.getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(sim.excluidos).toHaveBeenLastCalledWith("Pessoa"));
    await u.click(screen.getByRole("button", { name: "Atividades de Pessoa excluída fictícia" }));
    await screen.findByText(evento.resumo);
    const dialogo = within(screen.getByRole("dialog", { name: "Pessoa excluída fictícia" }));
    expect(dialogo.getByRole("tab", { name: "Atividades" })).toBeTruthy();
    expect(dialogo.queryByRole("tab", { name: "Cadastro" })).toBeNull();
    expect(dialogo.queryByRole("button", { name: /Salvar usuário|Excluir usuário/ })).toBeNull();
    expect(String(chamada.mock.calls[0][0])).toContain("/api/usuarios/u-excluido/atividades?");
  });
  it("carrega histórico global somente na abertura e isola falha da consulta", async () => {
    sim.historico.mockResolvedValueOnce({ erro: "Histórico temporariamente indisponível." }).mockResolvedValueOnce([]);
    render(<UsuariosPermissoes inicial={dados} podeVerAtividades />);
    expect(sim.historico).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Histórico de alterações" }));
    await screen.findByText("Histórico temporariamente indisponível.");
    expect(sim.salvar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("As alterações feitas a partir de agora aparecerão aqui.");
    expect(sim.historico).toHaveBeenCalledTimes(2);
    expect(chamada).not.toHaveBeenCalled();
  });
  it("não carrega históricos junto da listagem; aba preserva rascunho e não envia o cadastro", async () => {
    render(<UsuariosPermissoes inicial={dados} podeVerAtividades />);
    const u = userEvent.setup();
    expect(chamada).not.toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Gerenciar Pessoa fictícia" }));
    expect(chamada).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nome completo"), { target: { value: "Rascunho preservado" } });
    await u.click(screen.getByRole("tab", { name: "Atividades" }));
    await screen.findByText(evento.resumo);
    expect(sim.salvar).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Salvar usuário" })).toBeNull();
    await u.click(screen.getByRole("tab", { name: "Cadastro" }));
    expect(screen.getByLabelText("Nome completo")).toHaveProperty("value", "Rascunho preservado");
    expect(screen.getByRole("button", { name: "Excluir usuário" })).toBeTruthy();
    expect(sim.excluir).not.toHaveBeenCalled();
  });

  it("nega acesso antes de solicitar os dados e conserva a aba visível", async () => {
    render(<UsuariosPermissoes inicial={dados} capacidades={["visualizar"]} />);
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "Ver acesso de Pessoa fictícia" }));
    await u.click(screen.getByRole("tab", { name: "Atividades" }));
    expect(screen.getByText("Seu perfil não permite consultar atividades de usuários.")).toBeTruthy();
    expect(chamada).not.toHaveBeenCalled();
  });

  it("abre últimos 30 dias por autor, 50 por vez e apresenta data no fuso de São Paulo", async () => {
    montar(); await screen.findByText(evento.resumo);
    const url = new URL(String(chamada.mock.calls[0][0]), "https://hub.example.invalid");
    expect(url.pathname).toBe("/api/usuarios/u1/atividades");
    expect(url.searchParams.get("perspectiva")).toBe("autor");
    expect(url.searchParams.has("cursor")).toBe(false);
    expect((Date.parse(url.searchParams.get("ate")!) - Date.parse(url.searchParams.get("de")!)) / 86400000).toBe(29);
    expect(screen.getAllByText("30/09/2026, 23:30:00")).toHaveLength(2);
    expect(screen.getByText(/50 eventos por carregamento/)).toBeTruthy();
    expect(chamada.mock.calls[0][1]).toEqual(expect.objectContaining({ cache: "no-store" }));
  });

  it("aplica todos os filtros e separa alterações no cadastro da autoria", async () => {
    montar(); await screen.findByText(evento.resumo);
    await selecionar("Mostrar", "Alterações no cadastro do usuário");
    await selecionar("Módulo", "Usuários e permissões");
    await selecionar("Resultado", "Acesso negado");
    await selecionar("Origem", "MCP");
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "ALTERAR_PERFIL" } });
    expect(chamada).toHaveBeenCalledTimes(1);
    fireEvent.submit(screen.getByRole("form", { name: "Filtros de atividades" }));
    await waitFor(() => expect(chamada).toHaveBeenCalledTimes(2));
    const url = new URL(String(chamada.mock.calls[1][0]), "https://hub.example.invalid");
    expect(Object.fromEntries(url.searchParams)).toEqual({ de: "2026-01-01", ate: "2026-12-31", perspectiva: "cadastro", modulo: "acessos", acao: "ALTERAR_PERFIL", resultado: "NEGADO", origem: "MCP" });
    expect(screen.getByText(/O autor de cada alteração aparece no evento/)).toBeTruthy();
    expect(screen.getByText(/Autor: Autora fictícia/)).toBeTruthy();
  });

  it("limita o campo de ação e não consulta período invertido", async () => {
    montar(); await screen.findByText(evento.resumo);
    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "EDITAR<script>" } });
    expect(screen.getByLabelText("Ação")).toHaveProperty("value", "EDITARscript");
    expect(screen.getByLabelText("Ação")).toHaveProperty("maxLength", 100);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-01-01" } });
    fireEvent.submit(screen.getByRole("form", { name: "Filtros de atividades" }));
    expect(chamada).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toContain("período válido");
  });

  it("consulta detalhes sob demanda, permite link autorizado e escapa diferenças", async () => {
    chamada.mockResolvedValueOnce(resposta(pagina)).mockResolvedValueOnce(resposta({ ...detalhe, alteracoes: [{ campo: "Nome", antes: "<script>senha</script>", depois: "Nome permitido" }] }));
    montar(); await screen.findByText(evento.resumo); expect(chamada).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: `Ver detalhes de ${evento.resumo}` }));
    await screen.findByText("Nome permitido");
    expect(chamada.mock.calls[1][0]).toBe("/api/usuarios/u1/atividades/evt-1");
    expect(screen.getByText("<script>senha</script>")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByRole("link", { name: "Abrir registro" }).getAttribute("href")).toBe("/vendas/pedidos");
    expect(screen.queryByRole("button", { name: /Excluir.*atividade|Limpar histórico/ })).toBeNull();
  });

  it("mantém evidência quando entidade/origem desapareceu, sem inventar link ou diferenças", async () => {
    chamada.mockResolvedValueOnce(resposta(pagina)).mockResolvedValueOnce(resposta({ ...detalhe, alteracoes: [], link: null, referenciaDisponivel: false }));
    montar(); await screen.findByText(evento.resumo);
    fireEvent.click(screen.getByRole("button", { name: `Ver detalhes de ${evento.resumo}` }));
    await screen.findByText(/O registro de origem não está mais disponível/);
    expect(screen.queryByRole("link", { name: "Abrir registro" })).toBeNull();
    expect(screen.getByText(/Não há diferenças de campos disponíveis/)).toBeTruthy();
  });

  it("mostra negação de detalhes sem expor conteúdo interno ou link", async () => {
    chamada.mockResolvedValueOnce(resposta(pagina)).mockResolvedValueOnce(resposta({ erro: "payload privado" }, 403));
    montar(); await screen.findByText(evento.resumo);
    fireEvent.click(screen.getByRole("button", { name: `Ver detalhes de ${evento.resumo}` }));
    await screen.findByText("Seu perfil não permite consultar os detalhes deste evento.");
    expect(screen.queryByText("payload privado")).toBeNull();
    expect(screen.queryByRole("link", { name: "Abrir registro" })).toBeNull();
  });

  it("carrega próxima página pelo cursor e reinicia ao aplicar filtros", async () => {
    chamada.mockResolvedValueOnce(resposta({ ...pagina, proximoCursor: "cursor-estavel" })).mockResolvedValueOnce(resposta({ ...pagina, inicioCobertura: null, eventos: [{ ...evento, id: "evt-2", resumo: "Outro evento" }] })).mockResolvedValueOnce(resposta({ eventos: [], proximoCursor: null, inicioCobertura: null }));
    montar(); await screen.findByText(evento.resumo);
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais 50" }));
    await screen.findByText("Outro evento");
    const url = new URL(String(chamada.mock.calls[1][0]), "https://hub.example.invalid");
    expect(url.searchParams.get("cursor")).toBe("cursor-estavel");
    expect(screen.getByText("2 eventos carregados")).toBeTruthy();
    expect(screen.getByText(/Primeiro registro disponível: 01\/09\/2026, 09:00:00/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText(/Nenhuma atividade disponível/);
    expect(String(chamada.mock.calls[2][0])).not.toContain("cursor=");
    expect(screen.queryByText("Outro evento")).toBeNull();
  });

  it("mostra erro recuperável e acesso negado sem vazar mensagem interna", async () => {
    chamada.mockRejectedValueOnce(new Error("conexão privada"));
    montar(); await screen.findByText("Não foi possível carregar as atividades. Tente novamente.");
    expect(screen.queryByText("conexão privada")).toBeNull();
    chamada.mockResolvedValueOnce(resposta({ erro: "detalhe restrito" }, 403));
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("Seu perfil não permite consultar este histórico.");
    expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
    expect(screen.queryByText("detalhe restrito")).toBeNull();
  });

  it("impede que resposta antiga substitua os filtros atuais", async () => {
    let concluir!: (r: Response) => void;
    chamada.mockImplementationOnce(() => new Promise(resolve => { concluir = resolve; })).mockResolvedValueOnce(resposta({ ...pagina, eventos: [{ ...evento, resumo: "Filtro atual" }] }));
    montar(); expect(screen.getByText("Carregando atividades…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await screen.findByText("Filtro atual");
    await act(async () => concluir(resposta(pagina)));
    expect(screen.queryByText(evento.resumo)).toBeNull();
    expect(chamada.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("consulta filtros não marca cadastro salvo como rascunho", async () => {
    render(<UsuariosPermissoes inicial={dados} podeVerAtividades />);
    const u = userEvent.setup(); await u.click(screen.getByRole("button", { name: "Gerenciar Pessoa fictícia" }));
    await u.click(screen.getByRole("tab", { name: "Atividades" })); await screen.findByText(evento.resumo);
    fireEvent.change(screen.getByLabelText("Ação"), { target: { value: "EDITAR" } });
    await u.click(within(screen.getByRole("tabpanel", { name: "Atividades" })).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByText("Sair sem salvar")).toBeNull(); expect(sim.salvar).not.toHaveBeenCalled();
  });
});
