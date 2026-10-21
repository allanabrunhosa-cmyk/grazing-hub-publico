import { describe, expect, it } from "vitest";
import { escoposDoUsuario, intersectarEscopos, intersectarRestricoes, registroPermitido, RestricoesSchema } from "@/lib/mcp/politica";
import { ESCOPOS_MCP, ESCOPOS_GERENCIAIS } from "@/lib/mcp/catalogo";
import { retornoOAuthLogin } from "@/lib/mcp/retorno-login";
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
  it("retorno do login aceita somente o identificador opaco, sem redirecionamento aberto", () => {
    expect(retornoOAuthLogin("https://example.invalid")).toBeUndefined();
    expect(retornoOAuthLogin("../../login")).toBeUndefined();
    expect(retornoOAuthLogin("36f978ef-e302-4221-a156-a613eb9bfaf6")).toBe("36f978ef-e302-4221-a156-a613eb9bfaf6");
  });
});
