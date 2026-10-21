// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const s = vi.hoisted(() => ({ solicitar: vi.fn(), redefinir: vi.fn(), verificar: vi.fn(), login: vi.fn() }));
vi.mock("@/app/login/recuperacao-actions", () => ({ solicitarRecuperacaoAction: s.solicitar, redefinirSenhaAction: s.redefinir, verificarLinkRecuperacaoAction: s.verificar }));
vi.mock("@/app/login/actions", () => ({ loginAction: s.login }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
import { LoginForm } from "@/app/login/login-form";
import { SolicitarRecuperacaoForm, RedefinirSenhaForm } from "@/app/login/recuperacao-form";
import { MENSAGEM_SOLICITACAO, ERRO_LINK, validarNovaSenha } from "@/lib/recuperacao-senha/validacao";
beforeEach(() => { window.history.replaceState(null, "", `/login/redefinir#${"a".repeat(43)}`); s.verificar.mockResolvedValue({ valido: true }); s.solicitar.mockResolvedValue({ ok: true, mensagem: MENSAGEM_SOLICITACAO }); s.redefinir.mockResolvedValue({ ok: true }); });
afterEach(cleanup);
it("login permite mostrar/ocultar sem enviar o formulário e abre a recuperação", async () => {
  render(<LoginForm />); const senha = screen.getByLabelText("Senha");
  await userEvent.type(senha, "SenhaFicticia123");
  await userEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
  expect(senha.getAttribute("type")).toBe("text"); expect(senha.getAttribute("autocomplete")).toBe("current-password");
  await userEvent.click(screen.getByRole("button", { name: "Ocultar senha" })); expect(senha.getAttribute("type")).toBe("password");
  expect(s.login).not.toHaveBeenCalled(); expect(screen.getByText("Esqueci minha senha").getAttribute("href")).toBe("/login/recuperar");
});
it("solicitação apresenta confirmação neutra, orientação de spam e bloqueia reenvio imediato", async () => {
  render(<SolicitarRecuperacaoForm />);
  await userEvent.type(screen.getByLabelText("E-mail da conta"), "pessoa@example.invalid");
  await userEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));
  expect(await screen.findByText(MENSAGEM_SOLICITACAO)).toBeTruthy(); expect(screen.getByText(/Confira também o spam/)).toBeTruthy();
  expect((screen.getByLabelText("E-mail da conta") as HTMLInputElement).value).toBe("pessoa@example.invalid");
  expect((screen.getByRole("button", { name: /Reenviar em/ }) as HTMLButtonElement).disabled).toBe(true);
});
it("falha de conexão mantém o formulário utilizável sem afirmar envio", async () => {
  s.solicitar.mockRejectedValueOnce(new Error("sem rede")); render(<SolicitarRecuperacaoForm />);
  fireEvent.change(screen.getByLabelText("E-mail da conta"), { target: { value: "pessoa@example.invalid" } });
  await userEvent.click(screen.getByRole("button", { name: "Enviar link de recuperação" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Não foi possível conectar ao sistema. Confira sua conexão e tente novamente.");
  expect(screen.queryByText("Confira seu e-mail")).toBeNull();
});
it("link inválido impede entrada de senha e oferece novo pedido", async () => {
  s.verificar.mockResolvedValueOnce({ valido: false }); render(<RedefinirSenhaForm />);
  expect(await screen.findByText(ERRO_LINK)).toBeTruthy(); expect(screen.queryByLabelText("Nova senha")).toBeNull(); expect(screen.getByText("Solicitar novo link")).toBeTruthy();
});
it("confirmação diferente bloqueia envio e sucesso remove segredo da URL", async () => {
  render(<RedefinirSenhaForm />);
  fireEvent.change(await screen.findByLabelText("Nova senha"), { target: { value: "SenhaSegura123!" } });
  fireEvent.change(screen.getByLabelText("Confirme a nova senha"), { target: { value: "SenhaDiferente123!" } });
  await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
  expect(await screen.findByText(/As senhas não coincidem/)).toBeTruthy(); expect(s.redefinir).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirme a nova senha"), { target: { value: "SenhaSegura123!" } });
  await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
  expect(await screen.findByText("Senha alterada com sucesso")).toBeTruthy(); await waitFor(() => expect(window.location.hash).toBe(""));
});
it("valida mínimo, confirmação e limite real do bcrypt para caracteres multibyte", () => {
  expect(validarNovaSenha("curta", "curta")).toMatch(/8 caracteres/);
  expect(validarNovaSenha("á".repeat(37), "á".repeat(37))).toMatch(/72 bytes/);
  expect(validarNovaSenha("Uma frase longa para acesso!", "Uma frase longa para acesso!")).toBeNull();
  expect(validarNovaSenha("Abcdefg!", "Abcdefg!")).toBeNull();
  expect(validarNovaSenha("abcdefgh!", "abcdefgh!")).toMatch(/maiúscula/);
  expect(validarNovaSenha("Abcdefgh", "Abcdefgh")).toMatch(/especial/);
  expect(validarNovaSenha("Abcdefg ", "Abcdefg ")).toMatch(/especial/);
});
