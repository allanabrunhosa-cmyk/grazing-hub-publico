import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  permissao: vi.fn(),
  sessao: vi.fn(),
  revalidar: vi.fn(),
  excluir: vi.fn(),
  plano: vi.fn(),
  procurar: vi.fn(),
  consultarPorId: vi.fn(),
  consultarBloqueado: vi.fn(),
  criar: vi.fn(),
  atualizar: vi.fn(),
  atualizarStatus: vi.fn(),
  usuario: vi.fn(),
  transacao: vi.fn(),
  bloquear: vi.fn(),
  removerComposicao: vi.fn(),
  removerVinculos: vi.fn(),
}));

vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: m.permissao }));
vi.mock("@/lib/atividades/registro", () => ({ registrarAtividade: vi.fn() }));
vi.mock("@/lib/insumos/exclusao-servidor", () => ({ ErroInsumoExcluido: class extends Error {}, conferirInsumosComposicao: vi.fn(), consultarPlanoExclusaoInsumo: m.plano, excluirInsumoPreservandoHistorico: m.excluir }));
vi.mock("@/lib/session", () => ({ getSession: m.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidar }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    insumo: {
      delete: m.excluir,
      findFirst: m.procurar,
      findUnique: m.consultarPorId,
      create: m.criar,
      updateMany: m.atualizarStatus,
    },
    usuario: { findFirst: m.usuario },
    $transaction: m.transacao,
  },
}));

import {
  consultarExclusaoInsumoAction,
  deleteInsumoAction,
  importInsumosAction,
  saveInsumoAction,
} from "@/app/(protegido)/insumos/actions";
import { alterarStatusInsumoAction } from "@/app/(protegido)/status-cadastros-actions";

beforeEach(() => {
  vi.resetAllMocks();
  m.permissao.mockResolvedValue({ userId: "usuario-teste", admin: true });
  m.sessao.mockResolvedValue({ userId: "usuario-teste" });
  m.usuario.mockResolvedValue({ id: "usuario-teste" });
  m.procurar.mockResolvedValue(null);
  m.excluir.mockResolvedValue({ error: null });
  m.plano.mockResolvedValue({ vinculos: { preparacoes: [], produtos: [], complementos: [], outrosVinculos: false, revisao: "previa" } });
  m.criar.mockResolvedValue({ id: "insumo-teste" });
  m.consultarPorId.mockResolvedValue({
    id: "insumo-teste", nome: "Insumo de teste", tipo: "INSUMO", unidade: "KG",
    especificacao: null, custoMedio: 0, categoriaId: null,
    fornecedorPrincipalId: null, fornecedoresHomologados: [],
    usadoEm: [], componentesVenda: [], _count: {},
  });
  m.consultarBloqueado.mockResolvedValue({
    unidade: "KG", marcasHomologadas: [], conversoes: [], versaoConfiguracaoEtiqueta: 1,
  });
  m.atualizarStatus.mockResolvedValue({ count: 1 });
  m.transacao.mockImplementation(async (operacao) => operacao({
    $queryRaw: m.bloquear,
    insumo: {
      findUnique: m.consultarPorId,
      findFirst: m.consultarPorId,
      updateMany: m.atualizarStatus,
      delete: m.excluir,
      findUniqueOrThrow: m.consultarBloqueado,
      create: m.criar,
      update: m.atualizar,
    },
    composicaoInsumo: { deleteMany: m.removerComposicao },
    insumoFornecedor: { deleteMany: m.removerVinculos },
  }));
});

function conferirAtualizacaoDosConsumidores() {
  expect(m.revalidar).toHaveBeenCalledWith("/insumos");
  expect(m.revalidar).toHaveBeenCalledWith("/fornecedores");
  expect(m.revalidar).toHaveBeenCalledWith("/compras");
}

describe("atualização dos insumos vinculados nos fornecedores", () => {
  it("atualiza fornecedores e compras após excluir um insumo", async () => {
    expect(await deleteInsumoAction("insumo-teste")).toEqual({ error: null });
    expect(m.permissao).toHaveBeenCalledWith("insumos", "excluir");
    expect(m.excluir).toHaveBeenCalledWith(expect.any(Object), "insumo-teste", undefined, expect.objectContaining({ userId: "usuario-teste" }));
    conferirAtualizacaoDosConsumidores();
    expect(m.revalidar).toHaveBeenCalledWith("/vendas", "layout");
  });

  it("não revalida nem tenta novamente quando o servidor exige nova confirmação", async () => {
    m.excluir.mockResolvedValueOnce({ error: "Composições mudaram", vinculos: { produtos: [{ id: "novo", nome: "Produto fictício" }], revisao: "nova" } });
    expect(await deleteInsumoAction("insumo-teste", "previa")).toMatchObject({ error: "Composições mudaram" });
    expect(m.excluir).toHaveBeenCalledTimes(1);
    expect(m.revalidar).not.toHaveBeenCalled();
  });

  it("consulta vínculos sem excluir nem revalidar e exige permissão de exclusão", async () => {
    expect(await consultarExclusaoInsumoAction("insumo-teste")).toEqual({ error: null, vinculos: { preparacoes: [], produtos: [], complementos: [], outrosVinculos: false, revisao: "previa" } });
    expect(m.permissao).toHaveBeenCalledWith("insumos", "excluir");
    expect(m.excluir).not.toHaveBeenCalled();
    expect(m.revalidar).not.toHaveBeenCalled();
    m.permissao.mockRejectedValueOnce(Error("Sem acesso"));
    await expect(consultarExclusaoInsumoAction("insumo-teste")).rejects.toThrow("Sem acesso");
  });

  it("falha de consulta não autoriza a exclusão", async () => {
    m.plano.mockRejectedValueOnce(Error("Falha simulada"));
    expect(await consultarExclusaoInsumoAction("insumo-teste")).toEqual({ error: expect.any(String) });
    expect(m.excluir).not.toHaveBeenCalled();
  });

  it("não revalida fornecedores quando a exclusão falha", async () => {
    m.excluir.mockRejectedValueOnce(Error("Restrição de integridade simulada"));
    expect(await deleteInsumoAction("insumo-teste")).toEqual({ error: expect.any(String) });
    expect(m.revalidar).not.toHaveBeenCalled();
  });

  it("recusa exclusão sem permissão antes de gravar ou revalidar", async () => {
    m.permissao.mockRejectedValueOnce(Error("Sem acesso"));
    await expect(deleteInsumoAction("insumo-teste")).rejects.toThrow("Sem acesso");
    expect(m.excluir).not.toHaveBeenCalled();
    expect(m.revalidar).not.toHaveBeenCalled();
  });

  it("atualiza fornecedores e compras após criar insumo por importação", async () => {
    expect(await importInsumosAction([{ nome: "Insumo de teste", unidade: "KG", status: "ativo" }]))
      .toEqual({ criados: 1, atualizados: 0, erros: [] });
    expect(m.criar).toHaveBeenCalledWith({ data: expect.objectContaining({ nome: "Insumo de teste", ativo: true }) });
    conferirAtualizacaoDosConsumidores();
  });

  it.each(["ativo", "inativo"])("atualiza fornecedores e compras após importar status %s de insumo existente", async (status) => {
    m.procurar.mockResolvedValueOnce({ id: "insumo-teste" });
    expect(await importInsumosAction([{ nome: "Insumo de teste", unidade: "KG", status }]))
      .toEqual({ criados: 0, atualizados: 1, erros: [] });
    expect(m.atualizar).toHaveBeenCalledWith({
      where: { id: "insumo-teste" }, data: expect.objectContaining({ ativo: status === "ativo" }),
    });
    conferirAtualizacaoDosConsumidores();
  });

  it.each(["adicionar", "editar"])("recusa importação sem permissão de %s antes de gravar ou revalidar", async (negada) => {
    m.permissao.mockImplementation(async (_modulo, operacao) => {
      if (operacao === negada) throw Error("Sem acesso");
      return { userId: "usuario-teste", admin: true };
    });
    await expect(importInsumosAction([{ nome: "Insumo de teste", unidade: "KG" }])).rejects.toThrow("Sem acesso");
    expect(m.procurar).not.toHaveBeenCalled();
    expect(m.criar).not.toHaveBeenCalled();
    expect(m.transacao).not.toHaveBeenCalled();
    expect(m.revalidar).not.toHaveBeenCalled();
  });

  it("recusa importação com sessão expirada antes de gravar ou revalidar", async () => {
    m.sessao.mockResolvedValueOnce(null);
    expect(await importInsumosAction([{ nome: "Insumo de teste", unidade: "KG" }]))
      .toEqual({ criados: 0, atualizados: 0, erros: [{ linha: 0, mensagem: expect.any(String) }] });
    expect(m.criar).not.toHaveBeenCalled();
    expect(m.transacao).not.toHaveBeenCalled();
    expect(m.revalidar).not.toHaveBeenCalled();
  });

  it("mantém a revalidação de fornecedores ao inativar um insumo no formulário", async () => {
    const form = new FormData();
    form.set("id", "insumo-teste");
    form.set("nome", "Insumo de teste");
    form.set("unidade", "KG");
    expect(await saveInsumoAction({ error: null }, form)).toHaveProperty("error", null);
    expect(m.atualizar).toHaveBeenCalledWith({
      where: { id: "insumo-teste" }, data: expect.objectContaining({ ativo: false }),
    });
    conferirAtualizacaoDosConsumidores();
  });

  it("mantém a revalidação de fornecedores ao inativar um insumo pela ação de status", async () => {
    expect(await alterarStatusInsumoAction("insumo-teste", false)).toEqual({ ok: true });
    expect(m.atualizarStatus).toHaveBeenCalledWith({ where: { id: "insumo-teste", excluidoEm: null }, data: { ativo: false } });
    conferirAtualizacaoDosConsumidores();
  });
});
