// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ salvar: vi.fn(), refresh: vi.fn(), sucesso: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: sim.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: sim.sucesso } }));
vi.mock("@/app/(protegido)/vendas/pedidos/gestor-actions", () => ({ salvarMovimentacaoEstoqueGestorPedidosAction: sim.salvar }));
import { ConfigurarEstoqueGestor } from "@/app/(protegido)/vendas/pedidos/configurar-estoque-gestor";

const configuracao = { movimentarEstoque: false, versao: 0, podeAlterar: true, localMovimentarEstoqueId: "local-teste", locais: [{ id: "local-teste", nome: "Estoque fictício" }] };
beforeEach(() => { vi.clearAllMocks(); sim.salvar.mockReset().mockResolvedValue({ ok: true, movimentarEstoque: true, versao: 1, localMovimentarEstoqueId: "local-teste" }); });
afterEach(cleanup);
async function abrir(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.click(screen.getByRole("button", { name: "Configurar estoque dos pedidos" }));
  return screen.getByRole("dialog", { name: "Estoque dos pedidos" });
}

describe("configuração local de estoque do Gestor", () => {
  it("inicia desligado e só confirma a mudança no Salvar, retornando o foco ao gatilho", async () => {
    render(<ConfigurarEstoqueGestor configuracao={configuracao} />);
    const usuario = userEvent.setup(), gatilho = screen.getByRole("button", { name: "Configurar estoque dos pedidos" });
    const dialogo = await abrir(usuario);
    const controle = within(dialogo).getByRole("switch", { name: "Status de Movimentar estoque" });
    expect(controle.getAttribute("aria-checked")).toBe("false");
    expect(dialogo.textContent).toContain("sem criar reservas nem baixas");
    expect(within(dialogo).getByRole("button", { name: "Salvar" }).hasAttribute("disabled")).toBe(true);
    await usuario.click(controle);
    expect(dialogo.textContent).toContain("baixam estoque ao marcar Pronto");
    expect(dialogo.textContent).toContain("Saldo negativo");
    expect(sim.salvar).not.toHaveBeenCalled();
    await usuario.click(within(dialogo).getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(true, 0, expect.any(String), "local-teste");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sim.refresh).toHaveBeenCalledOnce();
    expect(sim.sucesso).toHaveBeenCalledWith("Configuração de estoque salva.");
    await waitFor(() => expect(document.activeElement).toBe(gatilho));
    await abrir(usuario);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });

  it("permite consultar sem oferecer salvamento a quem não pode alterar", async () => {
    render(<ConfigurarEstoqueGestor configuracao={{ ...configuracao, podeAlterar: false }} />);
    const usuario = userEvent.setup(), dialogo = await abrir(usuario);
    const controle = within(dialogo).getByRole("switch");
    expect(controle.hasAttribute("disabled")).toBe(true);
    expect(dialogo.textContent).toContain("Somente administradores");
    expect(within(dialogo).queryByRole("button", { name: "Salvar" })).toBeNull();
    await usuario.click(within(dialogo).getAllByRole("button", { name: "Fechar" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sim.salvar).not.toHaveBeenCalled();
  });

  it("protege o rascunho no Escape e descarta somente após confirmação", async () => {
    render(<ConfigurarEstoqueGestor configuracao={configuracao} />);
    const usuario = userEvent.setup();
    await abrir(usuario);
    await usuario.click(screen.getByRole("switch"));
    await usuario.keyboard("{Escape}");
    const aviso = screen.getByRole("alertdialog");
    expect(aviso.textContent).toContain("Sair sem salvar?");
    expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
    await usuario.click(within(aviso).getByRole("button", { name: "Continuar editando" }));
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));
    await usuario.click(screen.getByRole("button", { name: "Sair sem salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await abrir(usuario);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    expect(sim.salvar).not.toHaveBeenCalled();
  });

  it("trava a solicitação e o fechamento enquanto aguarda confirmação", async () => {
    let concluir!: (resultado: { ok: true; movimentarEstoque: boolean; versao: number; localMovimentarEstoqueId: string }) => void;
    sim.salvar.mockReturnValue(new Promise(resolve => { concluir = resolve; }));
    render(<ConfigurarEstoqueGestor configuracao={configuracao} />);
    const usuario = userEvent.setup(), dialogo = await abrir(usuario);
    await usuario.click(screen.getByRole("switch"));
    const salvar = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(salvar); fireEvent.click(salvar);
    expect(sim.salvar).toHaveBeenCalledOnce();
    expect(screen.getByRole("switch").getAttribute("aria-busy")).toBe("true");
    await usuario.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Estoque dos pedidos" })).toBe(dialogo);
    expect(screen.queryByText("Sair sem salvar?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Fechar" })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")).toBe(true);
    await act(async () => concluir({ ok: true, movimentarEstoque: true, versao: 1, localMovimentarEstoqueId: "local-teste" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("mantém valor e erro do servidor e reutiliza a chave na nova tentativa", async () => {
    sim.salvar.mockResolvedValueOnce({ erro: "Conflito de versão. Confira a configuração." });
    render(<ConfigurarEstoqueGestor configuracao={configuracao} />);
    const usuario = userEvent.setup(); await abrir(usuario);
    await usuario.click(screen.getByRole("switch"));
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert").textContent).toContain("Conflito de versão");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect(sim.refresh).not.toHaveBeenCalled();
    const chave = sim.salvar.mock.calls[0][2];
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar.mock.calls[1][2]).toBe(chave);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("explica falha de transporte sem fechar ou anunciar sucesso", async () => {
    sim.salvar.mockRejectedValueOnce(new Error("Falha simulada"));
    render(<ConfigurarEstoqueGestor configuracao={configuracao} />);
    const usuario = userEvent.setup(); await abrir(usuario);
    await usuario.click(screen.getByRole("switch"));
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível confirmar");
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect(sim.refresh).not.toHaveBeenCalled();
    expect(sim.sucesso).not.toHaveBeenCalled();
  });

  it("preserva o rascunho e sua versão quando outra configuração chega durante a edição", async () => {
    sim.salvar.mockResolvedValue({ erro: "A configuração foi alterada por outra pessoa." });
    const view = render(<ConfigurarEstoqueGestor configuracao={configuracao} />);
    const usuario = userEvent.setup(); await abrir(usuario);
    await usuario.click(screen.getByRole("switch"));
    view.rerender(<ConfigurarEstoqueGestor configuracao={{ ...configuracao, versao: 2 }} />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(true, 0, expect.any(String), "local-teste");
    expect(screen.getByRole("alert").textContent).toContain("outra pessoa");
  });

  it("não reverte uma confirmação local com resposta antiga e recebe versões posteriores", async () => {
    sim.salvar.mockResolvedValue({ ok: true, movimentarEstoque: true, versao: 2, localMovimentarEstoqueId: "local-teste" });
    const view = render(<ConfigurarEstoqueGestor configuracao={configuracao} />);
    const usuario = userEvent.setup(); await abrir(usuario);
    await usuario.click(screen.getByRole("switch"));
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    view.rerender(<ConfigurarEstoqueGestor configuracao={{ ...configuracao }} />);
    await abrir(usuario);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    await usuario.keyboard("{Escape}");
    view.rerender(<ConfigurarEstoqueGestor configuracao={{ ...configuracao, versao: 3 }} />);
    await abrir(usuario);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("não escolhe o primeiro local e exige seleção explícita antes de ligar", async () => {
    render(<ConfigurarEstoqueGestor configuracao={{ ...configuracao, localMovimentarEstoqueId: null }} />);
    const usuario = userEvent.setup(); await abrir(usuario);
    const local = screen.getByRole("combobox", { name: "Local de estoque" });
    expect(local.textContent).toContain("Sem local selecionado");
    await usuario.click(screen.getByRole("switch"));
    expect(screen.getByRole("button", { name: "Salvar" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Selecione um local disponível para ativar a baixa automática.")).toBeTruthy();
    await usuario.click(local);
    await usuario.click(await screen.findByRole("option", { name: "Estoque fictício" }));
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(true, 0, expect.any(String), "local-teste");
  });

  it("preserva um local salvo indisponível e permite limpar enquanto desligado", async () => {
    sim.salvar.mockResolvedValue({ ok: true, movimentarEstoque: false, versao: 1, localMovimentarEstoqueId: null });
    render(<ConfigurarEstoqueGestor configuracao={{ ...configuracao, localMovimentarEstoqueId: "local-inativo" }} />);
    const usuario = userEvent.setup(); await abrir(usuario);
    const local = screen.getByRole("combobox", { name: "Local de estoque" });
    expect(local.textContent).toContain("Local salvo indisponível");
    await usuario.click(local);
    await usuario.click(await screen.findByRole("option", { name: "Sem local selecionado" }));
    await usuario.click(screen.getByRole("button", { name: "Salvar" }));
    expect(sim.salvar).toHaveBeenCalledWith(false, 0, expect.any(String), null);
  });

  it("protege também a alteração somente do local de estoque", async () => {
    render(<ConfigurarEstoqueGestor configuracao={{ ...configuracao, locais: [...configuracao.locais, { id: "segundo-local", nome: "Segundo estoque fictício" }] }} />);
    const usuario = userEvent.setup(); await abrir(usuario);
    await usuario.click(screen.getByRole("combobox", { name: "Local de estoque" }));
    await usuario.click(await screen.findByRole("option", { name: "Segundo estoque fictício" }));
    await usuario.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog").textContent).toContain("Sair sem salvar?");
    expect(screen.getByRole("alertdialog", { name: "Sair sem salvar?" })).toBeTruthy();
    expect(sim.salvar).not.toHaveBeenCalled();
  });
});
