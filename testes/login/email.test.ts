import { afterEach, beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ criar: vi.fn(), enviar: vi.fn(), fechar: vi.fn(), configuracao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: { configuracaoEmail: { findUnique: s.configuracao } } }));
vi.mock("nodemailer", () => ({ default: { createTransport: s.criar } }));
import { emailConfigurado, enviarEmailRecuperacao } from "@/lib/recuperacao-senha/email";
import { cifrar, decifrar } from "@/lib/crypto";
beforeEach(() => {
  vi.stubEnv("EMAIL_SMTP_HOST", "smtp.example.invalid"); vi.stubEnv("EMAIL_SMTP_USUARIO", "usuario-ficticio");
  vi.stubEnv("EMAIL_SMTP_SENHA", "segredo-ficticio"); vi.stubEnv("EMAIL_REMETENTE", "acesso@example.invalid");
  vi.stubEnv("EMAIL_SMTP_PORTA", "465"); vi.stubEnv("APP_URL", "https://hub.example.invalid");
  s.criar.mockReturnValue({ sendMail: s.enviar, close: s.fechar }); s.enviar.mockResolvedValue({ accepted: ["pessoa@example.invalid"] });
  s.configuracao.mockResolvedValue(null);
});
it("configuração cifrada no banco funciona sem variáveis SMTP após redeploy", async () => {
  vi.stubEnv("AUTH_SECRET", "segredo-local-de-teste-sem-uso-real");
  for (const campo of ["EMAIL_SMTP_HOST", "EMAIL_SMTP_USUARIO", "EMAIL_SMTP_SENHA", "EMAIL_REMETENTE", "EMAIL_SMTP_PORTA", "APP_URL"]) vi.stubEnv(campo, "");
  const cifrada = cifrar("senha-ficticia", "grazing-hub-email");
  s.configuracao.mockResolvedValue({ host: "smtp.example.invalid", porta: 465, usuario: "resend", senhaCifrada: cifrada, remetente: "acesso@example.invalid", origem: "https://hub.example.invalid" });
  expect(cifrada).not.toContain("senha-ficticia"); expect(await emailConfigurado()).toBe(true);
  await enviarEmailRecuperacao("pessoa@example.invalid"); expect(s.criar).toHaveBeenCalledWith(expect.objectContaining({ auth: { user: "resend", pass: "senha-ficticia" } }));
  expect(() => decifrar(cifrada)).toThrow();
  expect(decifrar(cifrar("certificado-anterior"))).toBe("certificado-anterior");
});
afterEach(() => vi.unstubAllEnvs());
it("envia HTML e texto com TLS, domínio fixo, sem rastreamento próprio nem segredo nos logs", async () => {
  const token = "a".repeat(43); await enviarEmailRecuperacao("pessoa@example.invalid", token);
  expect(s.criar).toHaveBeenCalledWith(expect.objectContaining({ secure: true, requireTLS: true, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true }));
  const mensagem = s.enviar.mock.calls[0][0];
  expect(mensagem.text).toContain(`https://hub.example.invalid/login/redefinir#${token}`);
  expect(mensagem.html).toContain("30 minutos"); expect(mensagem.html).not.toContain("<img"); expect(mensagem.html).not.toContain("segredo-ficticio");
  expect(s.fechar).toHaveBeenCalled();
});
it("convite informa confirmação de e-mail e a conta compartilhada, sem senha inicial", async () => {
  await enviarEmailRecuperacao("pessoa@example.invalid", "a".repeat(43), true);
  const mensagem = s.enviar.mock.calls[0][0];
  expect(mensagem.subject).toContain("Crie sua senha e confirme seu e-mail");
  expect(mensagem.text).toContain("Atendimento");
  expect(mensagem.text).toContain("8 caracteres");
});
it("STARTTLS continua obrigatório na porta 587; aviso de alteração não inclui senha ou link", async () => {
  vi.stubEnv("EMAIL_SMTP_PORTA", "587"); await enviarEmailRecuperacao("pessoa@example.invalid");
  expect(s.criar).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true }));
  expect(s.enviar.mock.calls[0][0].text).toContain("As sessões anteriores foram encerradas");
  expect(s.enviar.mock.calls[0][0].text).not.toContain("/login/redefinir");
});
it("falha do transporte fecha conexão e configuração inválida não habilita recuperação", async () => {
  s.enviar.mockRejectedValueOnce(new Error("falha")); await expect(enviarEmailRecuperacao("pessoa@example.invalid")).rejects.toThrow(); expect(s.fechar).toHaveBeenCalled();
  vi.stubEnv("APP_URL", "http://hub.example.invalid"); expect(await emailConfigurado()).toBe(false);
  vi.stubEnv("APP_URL", "https://hub.example.invalid"); vi.stubEnv("EMAIL_SMTP_SENHA", ""); expect(await emailConfigurado()).toBe(false);
});
