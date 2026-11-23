import { describe, expect, it } from "vitest";
import { escoposDoUsuario, intersectarEscopos, intersectarRestricoes, registroPermitido, RestricoesSchema } from "@/lib/mcp/politica";
import { ESCOPOS_MCP, ESCOPOS_GERENCIAIS } from "@/lib/mcp/catalogo";
import { retornoOAuthLogin } from "@/lib/mcp/retorno-login";
import { intersectarAcessos, permissaoEfetiva } from "@/lib/permissoes/catalogo";
const pessoa = { ativo: true, excluidoEm: null, sessaoVersao: 0, admin: false, permissoes: {}, excecoes: {} };
describe("MCP: negação por padrão e limites consentidos", () => {
  it("administrar integrações não concede acesso financeiro", () => {
    expect(escoposDoUsuario({ ...pessoa, permissoes: { "configuracoes.mcp": ["visualizar", "editar"] } })).toEqual(["hub:v2:conexao_contexto"]);
  });
  it("intersecta usuário, perfil, política e token; desconhecidos não ganham acesso", () => {
    const doUsuario = escoposDoUsuario({ ...pessoa, permissoes: { "financeiro.dre": ["visualizar"] } });
    expect(intersectarEscopos(doUsuario, ESCOPOS_MCP, ESCOPOS_GERENCIAIS, ["financeiro:dre:ler", "financeiro:futuro:ler"])).toEqual(["financeiro:dre:ler"]);
    expect(intersectarEscopos(ESCOPOS_MCP, [])).toEqual([]);
  });
  it("redução individual prevalece e conta desativada não tem escopos", () => {
    expect(escoposDoUsuario({ ...pessoa, permissoes: { "financeiro.dre": ["visualizar"] }, excecoes: { "financeiro.dre": { visualizar: false } } })).toEqual(["hub:v2:conexao_contexto"]);
    expect(escoposDoUsuario({ ...pessoa, ativo: false, admin: true })).toEqual([]);
  });
  it("intersecta restrições, incluindo nenhum registro e IDs projetados de faturas", () => {
    const r = intersectarRestricoes({ contas: ["a", "b"], lancamentos: ["l1"] }, { contas: ["b", "c"], lancamentos: null });
    expect(registroPermitido(r, "fatura:l1:pagamento", "b")).toBe(true);
    expect(registroPermitido(r, "l1", "a")).toBe(false);
    expect(registroPermitido(r, "l2", "b")).toBe(false);
    expect(registroPermitido({ contas: [], lancamentos: null }, "l1", null)).toBe(false);
    expect(() => RestricoesSchema.parse({ empresa: "outra", contas: null, lancamentos: null })).toThrow();
  });
  it("perfil da conexão nunca excede o responsável: interseção de perfis e personalizações", () => {
    const admin = { admin: true, permissoes: {}, excecoes: {} };
    const consulta = { admin: false, permissoes: { "financeiro.dre": ["visualizar" as const], "vendas.clientes": ["visualizar" as const, "editar" as const] }, excecoes: { "vendas.clientes": { editar: false } } };
    // Administrador com conexão de consulta fica com o perfil da conexão, já sem a ação vetada.
    const limitado = intersectarAcessos(admin, consulta);
    expect(limitado.admin).toBe(false);
    expect(permissaoEfetiva(limitado.permissoes, limitado.excecoes, "financeiro.dre", "visualizar")).toBe(true);
    expect(permissaoEfetiva(limitado.permissoes, limitado.excecoes, "vendas.clientes", "editar")).toBe(false);
    expect(escoposDoUsuario({ ...pessoa, ...limitado })).toContain("financeiro:dre:ler");
    // Conexão com perfil Administrador não amplia quem não é administrador.
    expect(intersectarAcessos(consulta, admin)).toEqual({ admin: false, permissoes: consulta.permissoes, excecoes: consulta.excecoes });
    expect(intersectarAcessos(admin, admin).admin).toBe(true);
    // Entre dois perfis comuns só resta o que ambos permitem; permissão extra da conexão não cria acesso.
    const pessoaComum = { admin: false, permissoes: { "vendas.clientes": ["visualizar" as const] }, excecoes: {} };
    const conexao = { admin: false, permissoes: { "vendas.clientes": ["visualizar" as const, "editar" as const] }, excecoes: { "financeiro.dre": { visualizar: true } } };
    expect(intersectarAcessos(pessoaComum, conexao)).toEqual({ admin: false, permissoes: { "vendas.clientes": ["visualizar"] }, excecoes: {} });
    expect(escoposDoUsuario({ ...pessoa, ...intersectarAcessos(pessoaComum, { admin: false, permissoes: {}, excecoes: {} }) })).toEqual(["hub:v2:conexao_contexto"]);
  });
  it("retorno do login aceita somente o identificador opaco, sem redirecionamento aberto", () => {
    expect(retornoOAuthLogin("https://example.invalid")).toBeUndefined();
    expect(retornoOAuthLogin("../../login")).toBeUndefined();
    expect(retornoOAuthLogin("36f978ef-e302-4221-a156-a613eb9bfaf6")).toBe("36f978ef-e302-4221-a156-a613eb9bfaf6");
  });
});
