import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
const s = vi.hoisted(() => ({ contexto: vi.fn(), criar: vi.fn(), lote: vi.fn(), raw: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/contexto-execucao", () => ({ contextoExecucao: s.contexto }));
import { registrarAtividade, definirContextoAtividade } from "@/lib/atividades/registro";
import { alteracoesPermitidas } from "@/lib/atividades/privacidade";
import { criarCursor, lerCursor, validarFiltros } from "@/lib/atividades/filtros";
const tx = { atividadeUsuario: { create: s.criar, createMany: s.lote }, $queryRaw: s.raw } as unknown as Prisma.TransactionClient;
const ator = { userId: "autor", nome: "Autor sintético" };
const evento = { modulo: "acessos" as const, recurso: "configuracoes.usuarios", acao: "EDICAO", entidade: "Usuário", usuarioAfetadoId: "alvo", resumo: "Cadastro alterado." };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("AUTH_SECRET", "segredo-exclusivo-teste"); });
describe("registro mínimo e integridade", () => {
  it("deriva autor servidor e preserva usuário afetado separado, sem timestamp do cliente", async () => {
    await registrarAtividade(tx, ator, { ...evento, depois: { ativo: true, senha: "proibido", senhaHash: "proibido", token: "proibido", email: "proibido", dados: { segredo: "proibido" } } });
    expect(s.criar.mock.calls[0][0].data).toMatchObject({ autorId: "autor", usuarioAfetadoId: "alvo", atorTipo: "USUARIO", depois: { ativo: true } });
    expect(JSON.stringify(s.criar.mock.calls)).not.toContain("proibido"); expect(s.criar.mock.calls[0][0].data).not.toHaveProperty("ocorridoEm");
  });
  it("identifica MCP validado e recusa outro autor", async () => {
    s.contexto.mockReturnValue({ usuarioId: "autor" });
    await registrarAtividade(tx, ator, evento); expect(s.criar.mock.calls[0][0].data.origem).toBe("MCP");
    await expect(registrarAtividade(tx, { ...ator, userId: "impostor" }, evento)).rejects.toThrow("incompatível");
  });
  it("integração preserva iniciador e não finge ser administrador", async () => {
    await registrarAtividade(tx, { tipo: "INTEGRACAO", referencia: "integracao-sintetica", iniciadorId: "iniciador" }, { ...evento, origem: "API" });
    expect(s.criar.mock.calls[0][0].data).toMatchObject({ autorId: null, atorTipo: "INTEGRACAO", iniciadorId: "iniciador", origem: "API" });
  });
  it("dedup explícita e eventos legítimos independentes", async () => {
    await registrarAtividade(tx, ator, { ...evento, deduplicacao: "operacao:efeito1" });
    expect(s.lote).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    await registrarAtividade(tx, ator, evento); await registrarAtividade(tx, ator, evento); expect(s.criar).toHaveBeenCalledTimes(2);
  });
  it("referência não duplica payload e falha do registro propaga para rollback", async () => {
    await expect(registrarAtividade(tx, ator, { ...evento, fonteTabela: "Insumo", fonteId: "i", antes: { ativo: true } })).rejects.toThrow("Referência");
    s.criar.mockRejectedValue(new Error("falha-sintetica"));
    await expect(registrarAtividade(tx, ator, evento)).rejects.toThrow("falha-sintetica");
  });
  it("limita metadados e mostra só diferenças permitidas", async () => {
    await expect(registrarAtividade(tx, ator, { ...evento, resumo: "x".repeat(241) })).rejects.toThrow();
    expect(alteracoesPermitidas({ ativo: true, valor: "10", token: "x" }, { ativo: false, valor: "11" })).toEqual([{ campo: "ativo", antes: "true", depois: "false" }]);
    await definirContextoAtividade(tx, "API", "correlacao"); expect(s.raw).toHaveBeenCalled();
  });
  it("cursor assinado e dias civis de São Paulo inclusive transição histórica de fuso", () => {
    const f = validarFiltros({ usuarioId: "alvo", de: "2018-11-04", ate: "2018-11-04" });
    expect(f.inicio.toISOString()).toBe("2018-11-04T03:00:00.000Z"); expect(f.fim.toISOString()).toBe("2018-11-05T02:00:00.000Z");
    const c = criarCursor({ data: "2026-10-10T15:00:00.000Z", id: "id", limite: "10", filtros: f.hash });
    expect(lerCursor(c, f.hash).limite).toBe("10"); expect(() => lerCursor(c + "a", f.hash)).toThrow(); expect(() => lerCursor(c, "outro")).toThrow();
  });
});
