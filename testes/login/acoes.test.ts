import { beforeEach, expect, it, vi } from "vitest";
const s = vi.hoisted(() => ({ after: vi.fn(), reserva: vi.fn(), preparar: vi.fn(), concluir: vi.fn(), configurado: vi.fn(), enviar: vi.fn(), cookie: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: s.after }));
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: s.cookie }) }));
vi.mock("@/lib/recuperacao-senha/servico", () => ({ reservarSolicitacao: s.reserva, prepararRecuperacao: s.preparar, concluirRecuperacao: s.concluir, linkRecuperacaoValido: vi.fn() }));
vi.mock("@/lib/recuperacao-senha/email", () => ({ emailConfigurado: s.configurado, enviarEmailRecuperacao: s.enviar }));
import { solicitarRecuperacaoAction, redefinirSenhaAction } from "@/app/login/recuperacao-actions";
import { MENSAGEM_SOLICITACAO } from "@/lib/recuperacao-senha/validacao";
beforeEach(() => { s.configurado.mockReturnValue(true); s.reserva.mockResolvedValue(true); });
it("retorna mesma resposta no limite e agenda envio somente depois da resposta", async () => {
  const dados = new FormData(); dados.set("email", " PESSOA@example.invalid ");
  expect(await solicitarRecuperacaoAction(null, dados)).toEqual({ ok: true, mensagem: MENSAGEM_SOLICITACAO });
  expect(s.reserva).toHaveBeenCalledWith("pessoa@example.invalid"); expect(s.preparar).not.toHaveBeenCalled();
  await s.after.mock.calls[0][0](); expect(s.preparar).toHaveBeenCalledWith("pessoa@example.invalid");
  s.reserva.mockResolvedValue(false); s.after.mockClear();
  expect(await solicitarRecuperacaoAction(null, dados)).toEqual({ ok: true, mensagem: MENSAGEM_SOLICITACAO }); expect(s.after).not.toHaveBeenCalled();
});
it("configuração ausente e e-mail inválido não simulam sucesso nem consultam conta", async () => {
  const dados = new FormData(); dados.set("email", "invalido"); expect(await solicitarRecuperacaoAction(null, dados)).toHaveProperty("erro");
  dados.set("email", "pessoa@example.invalid"); s.configurado.mockReturnValue(false);
  expect(await solicitarRecuperacaoAction(null, dados)).toHaveProperty("erro"); expect(s.reserva).not.toHaveBeenCalled();
});
it("sucesso encerra cookie, retorna apenas ok e agenda aviso sem senha", async () => {
  s.concluir.mockResolvedValue({ ok: true, email: "pessoa@example.invalid" });
  const dados = new FormData(); dados.set("senha", "SenhaSeguraFicticia");
  expect(await redefinirSenhaAction(null, dados)).toEqual({ ok: true }); expect(s.cookie).toHaveBeenCalled();
  await s.after.mock.calls[0][0](); expect(s.enviar).toHaveBeenCalledWith("pessoa@example.invalid");
});
