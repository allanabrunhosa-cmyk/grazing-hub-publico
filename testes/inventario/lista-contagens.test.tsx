// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";

const navegar = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navegar }));
vi.mock("next/link", () => ({ default: (props: ComponentProps<"a">) => <a {...props} /> }));
vi.mock("@/app/(protegido)/inventario/contagem/actions", () => ({
  excluirContagemAction: vi.fn(), salvarItemContagemAction: vi.fn(), finalizarContagemAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { excluirContagemAction, finalizarContagemAction, salvarItemContagemAction } from "@/app/(protegido)/inventario/contagem/actions";
import { ContagemTable } from "@/app/(protegido)/inventario/contagem/contagem-table";
import { ContagemForm } from "@/app/(protegido)/inventario/contagem/[id]/contagem-form";
import { contagemTeste } from "./dados";
import type { ContagemListRow } from "@/app/(protegido)/inventario/types";
import { toast } from "sonner";

const linha: ContagemListRow = { id: "em-andamento", localNome: "Estoque principal", dataContagem: "2026-09-10T12:00:00Z", status: "EM_ANDAMENTO", totalItens: 4, itensContados: 2, itensAjustados: 0, responsavelNome: "Responsável de teste" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(excluirContagemAction).mockResolvedValue({ ok: true });
  vi.mocked(salvarItemContagemAction).mockResolvedValue({ ok: true });
  vi.mocked(finalizarContagemAction).mockResolvedValue({ ok: true, ajustes: 1 });
  sessionStorage.clear();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

describe("Retomar contagem", () => {
  it("alterna o botão Contados entre todos os itens e apenas os contados", async () => {
    const usuario = userEvent.setup();
    render(<ContagemForm contagem={contagemTeste} />);
    const botao = screen.getByRole("button", { name: /^Contados \(\d[\d.]*\)$/ });
    expect(botao.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Pão artesanal")).toBeTruthy();
    await usuario.click(botao);
    expect(botao.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Açúcar")).toBeTruthy();
    expect(screen.queryByText("Pão artesanal")).toBeNull();
    await usuario.click(botao);
    expect(botao.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Pão artesanal")).toBeTruthy();
    await usuario.type(screen.getByRole("textbox", { name: "Quantidade contada de Pão artesanal" }), "7");
    await usuario.tab();
    await usuario.click(botao);
    expect(screen.getByText("Pão artesanal")).toBeTruthy();
    expect(screen.queryByText("Uva verde")).toBeNull();
  });
  it("abre ao clicar em Em andamento ou em outra célula da linha", async () => {
    const usuario = userEvent.setup();
    render(<ContagemTable linhas={[linha]} />);
    await usuario.click(screen.getByText("Em andamento"));
    expect(navegar.push).toHaveBeenLastCalledWith("/inventario/contagem/em-andamento");
    await usuario.click(screen.getByText("2 de 4 contados"));
    expect(navegar.push).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("link", { name: "Continuar contagem" }).getAttribute("href")).toBe("/inventario/contagem/em-andamento");
  });

  it("reabre com as quantidades salvas, inclusive zero, sem preencher itens pendentes", () => {
    render(<ContagemForm contagem={{ ...contagemTeste, itens: contagemTeste.itens.map((item) => item.id === "queijo" ? { ...item, quantidadeContada: 0 } : item) }} />);
    expect((screen.getByRole("textbox", { name: "Quantidade contada de Açúcar" }) as HTMLInputElement).value).toBe("2");
    expect((screen.getByRole("textbox", { name: "Quantidade contada de Queijo brie" }) as HTMLInputElement).value).toBe("0");
    expect((screen.getByRole("textbox", { name: "Quantidade contada de Pão artesanal" }) as HTMLInputElement).value).toBe("");
  });
});

describe("Gravação da contagem", () => {
  it("confirma por Enter e cancela por Escape sem gravar no blur", async () => {
    const usuario = userEvent.setup();
    render(<ContagemForm contagem={contagemTeste} />);
    const campo = screen.getByRole("textbox", { name: "Quantidade contada de Açúcar" }) as HTMLInputElement;
    await usuario.clear(campo); await usuario.paste("1,125"); await usuario.tab();
    expect(salvarItemContagemAction).not.toHaveBeenCalled();
    await usuario.click(campo); await usuario.keyboard("{Escape}");
    expect(campo.value).toBe("2");
    await usuario.clear(campo); await usuario.paste("1,125"); await usuario.keyboard("{Enter}");
    await waitFor(() => expect(salvarItemContagemAction).toHaveBeenCalledWith("acucar", 1.125));
    expect(sessionStorage.getItem(`contagem-estoque:${contagemTeste.id}`)).toBeNull();
  });
  it("finaliza com todas as quantidades exibidas mesmo se a gravação isolada falhar", async () => {
    vi.mocked(salvarItemContagemAction).mockRejectedValueOnce(new Error("falha de rede"));
    const usuario = userEvent.setup();
    render(<ContagemForm contagem={contagemTeste} />);

    const pao = screen.getByRole("textbox", { name: "Quantidade contada de Pão artesanal" }) as HTMLInputElement;
    await usuario.type(pao, "7,125");
    await usuario.tab();
    expect(salvarItemContagemAction).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Confirmar contagem de Pão artesanal" }));

    expect(await screen.findByText("Não salvo")).toBeDefined();
    expect(pao.value).toBe("7,125");

    await usuario.click(screen.getByRole("button", { name: "Finalizar contagem" }));
    await usuario.click(await screen.findByRole("button", { name: "Sim, finalizar" }));

    await waitFor(() => expect(finalizarContagemAction).toHaveBeenCalledWith(
      contagemTeste.id,
      expect.arrayContaining([
        { id: "pao", quantidadeContada: 7.125 },
        { id: "uva", quantidadeContada: null },
        { id: "acucar", quantidadeContada: 2 },
      ]),
    ));
    expect(vi.mocked(finalizarContagemAction).mock.calls[0][1]).toHaveLength(contagemTeste.itens.length);
    await waitFor(() => expect(navegar.refresh).toHaveBeenCalledOnce());
  });

  it("mantém o diálogo e os valores preenchidos quando a finalização falha", async () => {
    vi.mocked(finalizarContagemAction).mockRejectedValueOnce(new Error("ação indisponível"));
    const usuario = userEvent.setup();
    render(<ContagemForm contagem={contagemTeste} />);
    const pao = screen.getByRole("textbox", { name: "Quantidade contada de Pão artesanal" }) as HTMLInputElement;
    await usuario.type(pao, "4");
    await usuario.click(screen.getByRole("button", { name: "Finalizar contagem" }));
    await usuario.click(await screen.findByRole("button", { name: "Sim, finalizar" }));

    const dialogo = screen.getByRole("dialog");
    await waitFor(() => expect(within(dialogo).getByRole("alert").textContent).toContain("Os valores continuam preenchidos"));
    expect(pao.value).toBe("4");
    expect(navegar.refresh).not.toHaveBeenCalled();
  });

  it("recupera o valor ainda não salvo após a tela ser recarregada", async () => {
    const usuario = userEvent.setup();
    const tela = render(<ContagemForm contagem={contagemTeste} />);
    await usuario.type(screen.getByRole("textbox", { name: "Quantidade contada de Pão artesanal" }), "9,5");
    tela.unmount();

    render(<ContagemForm contagem={contagemTeste} />);
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Quantidade contada de Pão artesanal" }) as HTMLInputElement).value).toBe("9,5"));
  });

  it("impede finalizar quando uma quantidade tem mais de três casas decimais", async () => {
    const usuario = userEvent.setup();
    render(<ContagemForm contagem={contagemTeste} />);
    await usuario.type(screen.getByRole("textbox", { name: "Quantidade contada de Pão artesanal" }), "1,2345");
    await usuario.click(screen.getByRole("button", { name: "Finalizar contagem" }));
    await usuario.click(await screen.findByRole("button", { name: "Sim, finalizar" }));
    expect(await screen.findByText("Revise a quantidade informada para Pão artesanal.")).toBeDefined();
    expect(finalizarContagemAction).not.toHaveBeenCalled();
  });
});

describe("Atalho de exclusão", () => {
  it("pede confirmação sem abrir a contagem e permite cancelar", async () => {
    const usuario = userEvent.setup();
    render(<ContagemTable linhas={[linha]} />);
    await usuario.click(screen.getByRole("button", { name: /Excluir contagem de/ }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Estoque principal")).toBeDefined();
    expect(navegar.push).not.toHaveBeenCalled();
    expect(excluirContagemAction).not.toHaveBeenCalled();
    await usuario.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    expect(excluirContagemAction).not.toHaveBeenCalled();
  });

  it("exclui somente a contagem selecionada após a confirmação e atualiza a lista", async () => {
    const usuario = userEvent.setup();
    render(<ContagemTable linhas={[linha]} />);
    await usuario.click(screen.getByRole("button", { name: /Excluir contagem de/ }));
    await usuario.click(await screen.findByRole("button", { name: "Sim, excluir" }));
    await waitFor(() => expect(excluirContagemAction).toHaveBeenCalledWith("em-andamento"));
    expect(navegar.push).not.toHaveBeenCalled();
    await waitFor(() => expect(navegar.refresh).toHaveBeenCalledOnce());
  });

  it("mantém a confirmação aberta e informa quando a exclusão é recusada", async () => {
    vi.mocked(excluirContagemAction).mockResolvedValue({ erro: "Contagem já finalizada." });
    const usuario = userEvent.setup();
    render(<ContagemTable linhas={[linha]} />);
    await usuario.click(screen.getByRole("button", { name: /Excluir contagem de/ }));
    await usuario.click(await screen.findByRole("button", { name: "Sim, excluir" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Contagem já finalizada."));
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(navegar.refresh).not.toHaveBeenCalled();
  });

  it("não oferece exclusão para contagens finalizadas ou já excluídas", async () => {
    const usuario = userEvent.setup();
    render(<ContagemTable linhas={[{ ...linha, id: "finalizada", status: "FINALIZADO" }, { ...linha, id: "excluida", status: "EXCLUIDO" }]} />);
    expect(screen.queryByRole("button", { name: /Excluir contagem de/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver contagem" }).getAttribute("href")).toBe("/inventario/contagem/finalizada");
    await usuario.click(screen.getByRole("button", { name: /^Excluídas \(\d[\d.]*\)$/ }));
    expect(screen.queryByRole("button", { name: /Excluir contagem de/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Ver contagem" }).getAttribute("href")).toBe("/inventario/contagem/excluida");
  });
});

describe("Filtro de contagens excluídas", () => {
  it("separa o histórico excluído e permite voltar às contagens em andamento e finalizadas", async () => {
    const usuario = userEvent.setup();
    render(<ContagemTable linhas={[linha, { ...linha, id: "finalizada", localNome: "Cozinha", status: "FINALIZADO" }, { ...linha, id: "excluida", localNome: "Depósito antigo", status: "EXCLUIDO" }]} />);
    expect(screen.getByRole("button", { name: /^Contagens \(\d[\d.]*\)$/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Estoque principal")).toBeDefined();
    expect(screen.getByText("Cozinha")).toBeDefined();
    expect(screen.queryByText("Depósito antigo")).toBeNull();
    await usuario.click(screen.getByRole("button", { name: /^Excluídas \(\d[\d.]*\)$/ }));
    expect(screen.getByRole("button", { name: /^Excluídas \(\d[\d.]*\)$/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("Estoque principal")).toBeNull();
    expect(screen.queryByText("Cozinha")).toBeNull();
    expect(screen.getByText("Depósito antigo")).toBeDefined();
    await usuario.click(screen.getByRole("button", { name: /^Contagens \(\d[\d.]*\)$/ }));
    expect(screen.getByText("Estoque principal")).toBeDefined();
    expect(screen.getByText("Cozinha")).toBeDefined();
    expect(screen.queryByText("Depósito antigo")).toBeNull();
  });

  it("retira da lista após a atualização da exclusão e mantém o histórico acessível mesmo com a lista vazia", async () => {
    const usuario = userEvent.setup();
    const { rerender } = render(<ContagemTable linhas={[linha]} />);
    rerender(<ContagemTable linhas={[{ ...linha, status: "EXCLUIDO" }]} />);
    expect(screen.getByText("Nenhuma contagem disponível.")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Estoque principal" })).toBeNull();
    await usuario.click(screen.getByRole("button", { name: /^Excluídas \(\d[\d.]*\)$/ }));
    expect(screen.getByRole("link", { name: "Ver contagem" }).getAttribute("href")).toBe("/inventario/contagem/em-andamento");
  });

  it("informa quando não há histórico excluído", async () => {
    const usuario = userEvent.setup();
    render(<ContagemTable linhas={[linha]} />);
    await usuario.click(screen.getByRole("button", { name: /^Excluídas \(\d[\d.]*\)$/ }));
    expect(screen.getByText("Nenhuma contagem excluída.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("Cancelamento de contagem finalizada", () => {
  const finalizada = { ...linha, id: "finalizada", status: "FINALIZADO" as const };
  it("administrador precisa informar motivo e reconhecer consequências antes do clique de confirmação", async () => {
    const usuario = userEvent.setup();
    render(<ContagemTable linhas={[finalizada]} administrador />);
    await usuario.click(screen.getByRole("button", { name: /Excluir contagem de/ }));
    expect(screen.getByText("Atenção: esta ação altera o estoque.")).toBeDefined();
    const confirmar = screen.getByRole("button", { name: "Cancelar e estornar ajustes" }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    await usuario.type(screen.getByRole("textbox", { name: "Motivo do cancelamento" }), "Conferência incorreta");
    expect(confirmar.disabled).toBe(true);
    await usuario.click(screen.getByRole("checkbox"));
    expect(confirmar.disabled).toBe(false);
    await usuario.click(confirmar);
    await waitFor(() => expect(excluirContagemAction).toHaveBeenCalledWith("finalizada", { confirmarEstorno: true, motivo: "Conferência incorreta" }));
    await waitFor(() => expect(navegar.refresh).toHaveBeenCalledOnce());
  });
  it("permite desistir sem modificar o estoque", async () => {
    const usuario = userEvent.setup(); render(<ContagemTable linhas={[finalizada]} administrador />);
    await usuario.click(screen.getByRole("button", { name: /Excluir contagem de/ }));
    await usuario.click(screen.getByRole("button", { name: "Manter contagem" }));
    expect(excluirContagemAction).not.toHaveBeenCalled();
  });
  it("erro permanece visível, conserva o motivo e permite reenviar", async () => {
    vi.mocked(excluirContagemAction).mockResolvedValueOnce({ erro: "Histórico inconsistente." });
    const usuario = userEvent.setup(); render(<ContagemTable linhas={[finalizada]} administrador />);
    await usuario.click(screen.getByRole("button", { name: /Excluir contagem de/ }));
    await usuario.type(screen.getByRole("textbox", { name: "Motivo do cancelamento" }), "Erro de conferência");
    await usuario.click(screen.getByRole("checkbox"));
    await usuario.click(screen.getByRole("button", { name: "Cancelar e estornar ajustes" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Histórico inconsistente.");
    expect(navegar.refresh).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Cancelar e estornar ajustes" }));
    await waitFor(() => expect(navegar.refresh).toHaveBeenCalledOnce());
  });
  it("detalhe também restringe o botão ao administrador", () => {
    const { rerender } = render(<ContagemForm contagem={{ ...contagemTeste, status: "FINALIZADO" }} />);
    expect(screen.queryByRole("button", { name: "Excluir contagem" })).toBeNull();
    rerender(<ContagemForm contagem={{ ...contagemTeste, status: "FINALIZADO" }} administrador />);
    expect(screen.getByRole("button", { name: "Excluir contagem" })).toBeDefined();
  });
  it("histórico cancelado mostra autor, motivo e ajustes estornados sem alegar ausência de ajustes", () => {
    render(<ContagemForm administrador contagem={{ ...contagemTeste, status: "EXCLUIDO", exclusao: { data: "2026-09-11T12:00:00Z", autor: "Administrador teste", motivo: "Conferência incorreta", ajustesEstornados: true } }} />);
    expect(screen.getByText("Administrador teste")).toBeDefined();
    expect(screen.getByText("Motivo: Conferência incorreta")).toBeDefined();
    expect(screen.getByText("Estornado")).toBeDefined();
    expect(screen.queryByText(/nenhum ajuste de estoque foi aplicado/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir contagem" })).toBeNull();
  });
});
