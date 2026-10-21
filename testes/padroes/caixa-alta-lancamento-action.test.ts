vi.mock("server-only", () => ({}));
import { beforeEach, expect, it, vi } from "vitest";

const simulados = vi.hoisted(() => ({ criar: vi.fn(), transacao: vi.fn(), atividade: vi.fn() }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSession: vi.fn(async () => ({ userId: "usuario", nome: "Usuário sintético" })) }));
vi.mock("@/lib/financeiro/baixarLancamento", () => ({ baixarLancamento: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: simulados.transacao } }));

import { criarLancamentoAction } from "@/app/(protegido)/financeiro/lancamentos/actions";

beforeEach(() => {
  simulados.criar.mockReset().mockImplementation(async ({ data }) => ({ ...data, id: "lancamento", status: "PENDENTE" }));
  simulados.atividade.mockReset();
  simulados.transacao.mockReset().mockImplementation(async (executar) => executar({ lancamentoFinanceiro: { create: simulados.criar }, atividadeUsuario: { create: simulados.atividade } }));
});

it("normaliza descrição e contraparte no servidor antes de criar o lançamento", async () => {
  const formulario = new FormData();
  formulario.set("tipo", "DESPESA");
  formulario.set("descricao", "  Aluguel de setembro  ");
  formulario.set("valor", "1500");
  formulario.set("categoriaId", "ocupacao");
  formulario.set("dataCompetencia", "2026-09-01");
  formulario.set("contraparteNome", " Imobiliária São João ");

  expect(await criarLancamentoAction(null, formulario)).toEqual({ ok: true, ids: ["lancamento"] });
  expect(simulados.criar).toHaveBeenCalledWith({ data: expect.objectContaining({
    descricao: "ALUGUEL DE SETEMBRO",
    contraparteNome: "IMOBILIÁRIA SÃO JOÃO",
  }) });
  expect(simulados.atividade).toHaveBeenCalledExactlyOnceWith({ data: expect.objectContaining({ autorId: "usuario", autorNome: "Usuário sintético", acao: "CRIACAO", entidadeId: "lancamento", depois: expect.objectContaining({ valor: "1500", status: "PENDENTE" }) }) });
});
