import { beforeEach, expect, it, vi } from "vitest";
import { ErroRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import { aprovarRegraBrasilNfeAction, historicoRegraBrasilNfeAction, inativarRegraBrasilNfeAction, salvarRascunhoRegraBrasilNfeAction, revisarRegraBrasilNfeAction, bloquearRegraBrasilNfeAction } from "@/app/(protegido)/vendas/fiscal/regras-brasilnfe/actions";

const m = vi.hoisted(() => ({ permissao: vi.fn(), salvar: vi.fn(), aprovar: vi.fn(), inativar: vi.fn(), revisar: vi.fn(), bloquear: vi.fn(), historico: vi.fn(), usuarios: vi.fn(), revalidar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidar }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: m.permissao }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuario: { findMany: m.usuarios } } }));
vi.mock("@/lib/fiscal-saida/brasilnfe/regras-tributarias", () => ({ salvarRascunhoRegraTributariaBrasilNfe: m.salvar, aprovarRegraTributariaBrasilNfe: m.aprovar, inativarRegraTributariaBrasilNfe: m.inativar, enviarRegraParaRevisaoBrasilNfe: m.revisar, bloquearRegraTributariaBrasilNfe: m.bloquear, obterHistoricoRegraTributariaBrasilNfe: m.historico }));
const sessao = { userId: "usuario-ficticio", versao: 1 };
beforeEach(() => {
  vi.clearAllMocks();
  m.permissao.mockResolvedValue(sessao); m.salvar.mockResolvedValue({}); m.aprovar.mockResolvedValue({}); m.inativar.mockResolvedValue({}); m.revisar.mockResolvedValue({}); m.bloquear.mockResolvedValue({});
  m.historico.mockResolvedValue({ id: "regra-ficticia", versoes: [{ responsavelId: "usuario-ficticio" }] }); m.usuarios.mockResolvedValue([{ id: "usuario-ficticio", nome: "Responsável fictício" }]);
});
it("salvar exige permissão central e encaminha sessão ao serviço, sem aprovar", async () => {
  const entrada = { modelo: 55, alvo: "EMPRESA" };
  expect(await salvarRascunhoRegraBrasilNfeAction(entrada)).toEqual({ ok: true });
  expect(m.permissao).toHaveBeenCalledWith("vendas.fiscal", "editar");
  expect(m.salvar).toHaveBeenCalledWith(entrada, sessao);
  expect(m.aprovar).not.toHaveBeenCalled(); expect(m.inativar).not.toHaveBeenCalled();
  expect(m.revalidar).toHaveBeenCalledWith("/vendas/fiscal/regras-brasilnfe");
});
it("recusa de acesso interrompe a ação antes da escrita", async () => {
  m.permissao.mockRejectedValue(new Error("acesso negado fictício"));
  await expect(salvarRascunhoRegraBrasilNfeAction({})).rejects.toThrow("acesso negado fictício");
  expect(m.salvar).not.toHaveBeenCalled(); expect(m.revalidar).not.toHaveBeenCalled();
});
it("erro de validação devolve somente mensagem e campo locais", async () => {
  m.salvar.mockRejectedValue(new ErroRegraFiscalBrasilNfe("fundamentacaoFiscal.fontes", "Confira as fontes da fundamentação."));
  expect(await salvarRascunhoRegraBrasilNfeAction({})).toEqual({ erro: "Confira as fontes da fundamentação.", campo: "fundamentacaoFiscal.fontes" });
  expect(m.revalidar).not.toHaveBeenCalled();
});
it("falha inesperada nunca devolve mensagem, cause ou dados refletidos", async () => {
  m.salvar.mockRejectedValue(new Error("Token=segredo-ficticio", { cause: { cookie: "segredo-ficticio", payload: "não mostrar" } }));
  const resposta = await salvarRascunhoRegraBrasilNfeAction({});
  expect(resposta).toEqual({ erro: "Não foi possível salvar a decisão tributária. Seu preenchimento foi mantido." });
  expect(JSON.stringify(resposta)).not.toMatch(/Token|cookie|payload|segredo-ficticio|cause/);
});
it("aprovação encaminha confirmação explícita para revalidação no servidor", async () => {
  const entrada = { regraId: "regra-ficticia", revisao: 1, fundamentacaoHash: "a".repeat(64), conteudoHash: "b".repeat(64), aplicacaoConferida: true };
  expect(await aprovarRegraBrasilNfeAction(entrada)).toEqual({ ok: true });
  expect(m.aprovar).toHaveBeenCalledWith(entrada, sessao);
  expect(m.permissao).toHaveBeenCalledWith("vendas.fiscal", "editar");
  expect(m.salvar).not.toHaveBeenCalled();
});
it.each([[revisarRegraBrasilNfeAction, m.revisar], [bloquearRegraBrasilNfeAction, m.bloquear]])("estado de revisão/bloqueio exige editar e encaminha sessão sem aprovação", async (acao, servico) => {
  const entrada = { regraId: "regra-ficticia", revisao: 1 };
  expect(await acao(entrada)).toEqual({ ok: true });
  expect(m.permissao).toHaveBeenCalledWith("vendas.fiscal", "editar");
  expect(servico).toHaveBeenCalledWith(entrada, sessao);
  expect(m.aprovar).not.toHaveBeenCalled(); expect(m.salvar).not.toHaveBeenCalled();
});
it.each([revisarRegraBrasilNfeAction, bloquearRegraBrasilNfeAction, aprovarRegraBrasilNfeAction])("negativa de permissão impede alteração de situação", async acao => {
  m.permissao.mockRejectedValue(new Error("acesso negado fictício"));
  await expect(acao({})).rejects.toThrow("acesso negado fictício");
  expect(m.revisar).not.toHaveBeenCalled(); expect(m.bloquear).not.toHaveBeenCalled(); expect(m.aprovar).not.toHaveBeenCalled();
});
it("inativar chama somente alteração de situação sem apagar histórico", async () => {
  const entrada = { regraId: "regra-ficticia", revisao: 1 };
  expect(await inativarRegraBrasilNfeAction(entrada)).toEqual({ ok: true });
  expect(m.inativar).toHaveBeenCalledWith(entrada, sessao); expect(m.salvar).not.toHaveBeenCalled();
});
it("histórico exige visualizar e projeta somente nomes dos responsáveis registrados", async () => {
  const r = await historicoRegraBrasilNfeAction("regra-ficticia");
  expect(m.permissao).toHaveBeenCalledWith("vendas.fiscal", "visualizar");
  expect(m.historico).toHaveBeenCalledWith("regra-ficticia", sessao);
  expect(m.usuarios).toHaveBeenCalledWith({ where: { id: { in: ["usuario-ficticio"] } }, select: { id: true, nome: true } });
  expect(r).toMatchObject({ ok: true, responsaveis: { "usuario-ficticio": "Responsável fictício" } });
  expect(m.salvar).not.toHaveBeenCalled(); expect(m.revalidar).not.toHaveBeenCalled();
});
