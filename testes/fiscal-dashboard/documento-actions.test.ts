import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ guarda: vi.fn(), consultar: vi.fn(), recuperar: vi.fn(), emitir: vi.fn(), cancelar: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: m.guarda }));
vi.mock("@/lib/fiscal-dashboard/documento", () => ({ consultarDocumentoDashboard: m.consultar }));
vi.mock("@/app/(protegido)/vendas/pedidos/emissao-actions", () => ({ obterDocumentosEmissaoPedidoBrasilNfeAction: m.recuperar, emitirNotaPedidoDiretaBrasilNfeAction: m.emitir, cancelarNotaPedidoBrasilNfeAction: m.cancelar }));
import { consultarDocumentoDashboardAction, recuperarArquivosDocumentoDashboardAction } from "@/app/(protegido)/financeiro/fiscal/documento-actions";
beforeEach(() => { vi.resetAllMocks(); m.guarda.mockResolvedValue({ userId: "sintetico" }); m.recuperar.mockResolvedValue({ ok: true, documento: { id: "nota", xmlDisponivel: true, xml: "arquivo privado não deve retornar nesta fachada" } }); });

describe("recuperação explícita de arquivos pelo Dashboard", () => {
  it.each([["financeiro.fiscal.painel", "visualizar"], ["vendas.fiscal", "editar"], ["vendas.pedidos", "visualizar"]])("recusa sem %s/%s antes de recuperar arquivos", async (recurso, acao) => {
    m.guarda.mockImplementation(async (r, a = "visualizar") => { if (r === recurso && a === acao) throw Error("Sem acesso"); return {}; });
    await expect(recuperarArquivosDocumentoDashboardAction("nota")).rejects.toThrow("Sem acesso");
    expect(m.recuperar).not.toHaveBeenCalled(); expect(m.emitir).not.toHaveBeenCalled(); expect(m.cancelar).not.toHaveBeenCalled();
  });
  it.each(["", "../nota", "x".repeat(101)])("valida ID antes de delegar recuperação: %s", async id => {
    expect(await recuperarArquivosDocumentoDashboardAction(id)).toEqual({ erro: "Documento inválido." });
    expect(m.recuperar).not.toHaveBeenCalled();
  });
  it("delega apenas à obtenção manual existente e não expõe o documento no retorno", async () => {
    expect(await recuperarArquivosDocumentoDashboardAction("nota")).toEqual({ ok: true });
    expect(m.recuperar).toHaveBeenCalledExactlyOnceWith("nota");
    expect(m.guarda.mock.calls).toEqual([["financeiro.fiscal.painel"], ["vendas.fiscal", "editar"], ["vendas.pedidos"]]);
    expect(m.emitir).not.toHaveBeenCalled(); expect(m.cancelar).not.toHaveBeenCalled();
  });
  it("preserva a falha segura da ação existente para permitir nova tentativa", async () => {
    m.recuperar.mockResolvedValue({ erro: "Integração indisponível para recuperar este documento." });
    expect(await recuperarArquivosDocumentoDashboardAction("nota")).toEqual({ erro: "Integração indisponível para recuperar este documento." });
    expect(m.recuperar).toHaveBeenCalledTimes(1); expect(m.emitir).not.toHaveBeenCalled(); expect(m.cancelar).not.toHaveBeenCalled();
  });
  it.each(["A nota continua autorizada, mas o XML não foi recuperado. Tente novamente.", undefined, ""])("não converte autorização sem XML em recuperação bem-sucedida", async avisoArquivos => {
    m.recuperar.mockResolvedValue({ ok: true, documento: { id: "nota", status: "AUTORIZADO", xmlDisponivel: false, avisoArquivos, xml: "conteúdo privado não retornado" } });
    expect(await recuperarArquivosDocumentoDashboardAction("nota")).toEqual({ erro: avisoArquivos || "O XML da nota ainda não está disponível no HUB. Tente recuperar os arquivos novamente." });
    expect(m.recuperar).toHaveBeenCalledExactlyOnceWith("nota");
    expect(m.emitir).not.toHaveBeenCalled(); expect(m.cancelar).not.toHaveBeenCalled();
  });
  it("permite atualizar as métricas quando o XML foi recuperado e só a impressão permanece ausente", async () => {
    m.recuperar.mockResolvedValue({ ok: true, documento: { id: "nota", xmlDisponivel: true, formatoImpressao: null, avisoArquivos: "A impressão ainda não está disponível." } });
    expect(await recuperarArquivosDocumentoDashboardAction("nota")).toEqual({ ok: true });
    expect(m.recuperar).toHaveBeenCalledExactlyOnceWith("nota");
  });
  it("consultar detalhes continua somente leitura e não recupera arquivos automaticamente", async () => {
    m.consultar.mockResolvedValue({ campos: [], itens: [], aviso: null });
    await consultarDocumentoDashboardAction("NF_SAIDA", "nota");
    expect(m.consultar).toHaveBeenCalledExactlyOnceWith("NF_SAIDA", "nota");
    expect(m.recuperar).not.toHaveBeenCalled(); expect(m.emitir).not.toHaveBeenCalled(); expect(m.cancelar).not.toHaveBeenCalled();
  });
});
