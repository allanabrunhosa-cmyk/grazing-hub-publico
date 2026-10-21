// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const sim = vi.hoisted(() => ({ preparar: vi.fn(), aplicar: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock("@/app/(protegido)/vendas/importacao/actions", () => ({ prepararImportacaoVendaAction: sim.preparar, aplicarImportacaoVendaAction: sim.aplicar }));
import { ImportacaoCatalogo } from "@/app/(protegido)/vendas/importacao/importacao-client";
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const previa = { pacote: { origem: "IFOOD", loja: "Loja teste", referencia: "Amostra fictícia" }, token: "a".repeat(64), contagens: { novos: 1, atualizar: 0, manter: 0, conflitos: 0 }, linhas: [{ entidade: "PRODUTO", chave: "p", nome: "Produto de teste", situacao: "NOVO", motivo: "Será criado inativo" }] };
async function carregar() {
  const arquivo = new File(["{}"], "catalogo.json", { type: "application/json" });
  Object.defineProperty(arquivo, "text", { value: async () => "{}" });
  fireEvent.change(screen.getByLabelText("Pacote de catálogo (.json)"), { target: { files: [arquivo] } });
  await userEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
  await screen.findByText("Produto de teste");
  await screen.findByRole("button", { name: "Aplicar registros sem conflito" });
}
describe("conferência da importação", () => {
  it("exige prévia e confirmação, preserva erro e permite conferir novamente", async () => {
    sim.preparar.mockResolvedValue({ previa });
    sim.aplicar.mockResolvedValue({ erro: "O catálogo mudou depois da prévia." });
    render(<ImportacaoCatalogo aplicar />);
    await carregar();
    const botao = () => screen.getByRole("button", { name: "Aplicar registros sem conflito" }) as HTMLButtonElement;
    expect(botao().disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(botao());
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "O catálogo mudou depois da prévia.");
    expect(sim.aplicar).toHaveBeenCalledWith("{}", previa.token);
    await waitFor(() => expect(botao().disabled).toBe(true));
    await userEvent.click(screen.getByRole("button", { name: "Atualizar prévia" }));
    await waitFor(() => expect(sim.preparar).toHaveBeenCalledTimes(2));
  });
  it("perfil de consulta não pode confirmar aplicação", async () => {
    sim.preparar.mockResolvedValue({ previa });
    render(<ImportacaoCatalogo aplicar={false} />);
    await carregar();
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Aplicar registros sem conflito" }) as HTMLButtonElement).disabled).toBe(true);
    expect(sim.aplicar).not.toHaveBeenCalled();
  });
});
