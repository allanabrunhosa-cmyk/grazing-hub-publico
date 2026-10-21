// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CampoStatusAtivo, StatusAtivoSalvavel } from "@/components/status-ativo";
import { toast } from "sonner";
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it("altera com um clique, impede abrir detalhes e permite reativar", async () => {
  const salvar = vi.fn(), abrirDetalhes = vi.fn();
  function Lista() {
    const [ativo, definirAtivo] = useState(true);
    return <div onClick={abrirDetalhes}><StatusAtivoSalvavel ativo={ativo} nome="Fornecedor" salvar={async proximo => { salvar(proximo); definirAtivo(proximo); return { ok: true }; }} /></div>;
  }
  render(<Lista />);
  const usuario = userEvent.setup(), controle = screen.getByRole("switch", { name: "Status de Fornecedor" });
  await usuario.click(controle);
  expect(salvar).toHaveBeenCalledExactlyOnceWith(false);
  expect(controle.getAttribute("aria-checked")).toBe("false");
  expect(abrirDetalhes).not.toHaveBeenCalled();
  await usuario.click(controle);
  expect(salvar).toHaveBeenLastCalledWith(true);
  expect(controle.getAttribute("aria-checked")).toBe("true");
});
it("bloqueia clique duplicado enquanto salva e preserva status em falha", async () => {
  let concluir!: (valor: { erro: string }) => void;
  const salvar = vi.fn(() => new Promise<{ erro: string }>(resolver => { concluir = resolver; }));
  render(<StatusAtivoSalvavel ativo nome="Farinha" salvar={salvar} />);
  const controle = screen.getByRole("switch");
  fireEvent.click(controle); fireEvent.click(controle);
  expect(salvar).toHaveBeenCalledOnce();
  expect(controle).toHaveProperty("disabled", true);
  concluir({ erro: "Sem permissão." });
  await waitFor(() => expect(controle).toHaveProperty("disabled", false));
  expect(controle.getAttribute("aria-checked")).toBe("true");
  expect(toast.error).toHaveBeenCalledWith("Sem permissão.");
});
it("funciona pelo teclado e mantém o valor esperado pelo formulário", async () => {
  render(<form aria-label="Cadastro"><CampoStatusAtivo nome="Insumo" /></form>);
  const usuario = userEvent.setup();
  await usuario.tab(); await usuario.keyboard(" ");
  const formulario = screen.getByRole("form") as HTMLFormElement;
  expect(new FormData(formulario).get("ativo")).toBe("");
  await usuario.keyboard("{Enter}");
  expect(new FormData(formulario).get("ativo")).toBe("on");
});
it("trata perda de conexão sem afirmar que o status foi salvo", async () => {
  render(<StatusAtivoSalvavel ativo nome="Conta" salvar={async () => { throw Error("Sem rede"); }} />);
  await userEvent.click(screen.getByRole("switch"));
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Atualize a página"));
  expect(toast.success).not.toHaveBeenCalled();
});
