import { describe, expect, it } from "vitest";
import { CATALOGO, permissaoEfetiva, todasPermissoes, validarPermissoes, validarExcecoes, recursoDaRota, type Acao, type Permissoes } from "@/lib/permissoes/catalogo";
import { CAPACIDADES_ATENDIMENTO, SECOES_ATENDIMENTO } from "@/lib/permissoes/atendimento";

const contrato: Record<string, Acao[]> = {
  crm: ["visualizar", "editar"],
  "crm.atendimento.mensagens": ["visualizar", "adicionar"],
  "crm.atendimento.notas": ["visualizar", "adicionar"],
  "crm.atendimento.etiquetas": ["visualizar", "editar"],
  "crm.atendimento.contatos": ["visualizar", "adicionar", "editar"],
  "crm.atendimento.agenda": ["visualizar", "adicionar", "editar"],
  "crm.atendimento.pipeline": ["visualizar", "adicionar", "editar"],
  "crm.atendimento.duvidas": ["visualizar", "adicionar", "editar"],
  "crm.atendimento.conhecimento": ["visualizar", "adicionar", "editar", "excluir"],
  "crm.atendimento.ia": ["visualizar", "editar"],
  "crm.atendimento.skills": ["visualizar", "adicionar", "editar", "excluir"],
  "crm.atendimento.tom": ["visualizar", "editar"],
  "crm.atendimento.followup": ["visualizar", "editar"],
  "crm.atendimento.configuracoes": ["visualizar", "editar"],
  "crm.atendimento.modelos": ["visualizar", "adicionar", "editar", "excluir"],
  "crm.atendimento.automacoes": ["visualizar"],
  "crm.atendimento.canais": ["visualizar"],
  "crm.atendimento.equipe": ["visualizar"],
  "crm.atendimento.conversas": ["visualizar", "adicionar"],
  "crm.atendimento.lembretes": ["visualizar", "adicionar", "editar", "excluir"],
  "crm.atendimento.atalhos": ["visualizar", "adicionar", "editar", "excluir"],
  "crm.atendimento.modelos.sincronizacao": ["visualizar", "editar"],
  "crm.atendimento.atividades": ["visualizar"],
  "crm.atendimento.atividades.equipe": ["visualizar"],
};

describe("permissões centrais do Atendimento por operação", () => {
  it("agrupa cada recurso em uma única seção do Atendimento", () => {
    const ids = SECOES_ATENDIMENTO.flatMap(secao => secao.recursos);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(Object.keys(contrato).sort());
    expect(SECOES_ATENDIMENTO.map(secao => secao.nome)).toContain("Chat");
    expect(SECOES_ATENDIMENTO.map(secao => secao.nome)).toContain("Agenda");
    expect(SECOES_ATENDIMENTO.map(secao => secao.nome)).toContain("Pipeline");
  });
  it("declara apenas operações reais e mantém a entrada histórica na navegação Vendas", () => {
    const secoes = CATALOGO.find(modulo => modulo.id === "vendas")!.secoes.filter(secao => secao.id === "crm" || secao.id.startsWith("crm.atendimento."));
    expect(Object.fromEntries(secoes.map(secao => [secao.id, secao.acoes]))).toEqual(contrato);
    expect(secoes.find(secao => secao.id === "crm")).toMatchObject({ nome: "Atendimento", rota: "/vendas/atendimento", nomeMatriz: "Conversas e fila" });
    expect(recursoDaRota("/vendas/atendimento")).toBe("crm");
    expect(recursoDaRota("/crm")).toBe("crm");
    expect(validarPermissoes(contrato)).toEqual(contrato);
    for (const { recurso, acao } of Object.values(CAPACIDADES_ATENDIMENTO)) expect(contrato[recurso]).toContain(acao);
  });
  it("rejeita ações sem suporte e escrita sem visualizar", () => {
    for (const [recurso, acoes] of Object.entries(contrato)) {
      for (const acao of ["editar", "adicionar", "excluir"] as const) {
        if (!acoes.includes(acao)) {
          expect(() => validarPermissoes({ [recurso]: ["visualizar", acao] })).toThrow();
          expect(() => validarExcecoes({ [recurso]: { [acao]: true } }, {})).toThrow();
        } else expect(() => validarPermissoes({ [recurso]: [acao] })).toThrow("Habilite Visualizar");
      }
    }
  });
  it("nenhuma chave nova herda escrita da permissão ampla", () => {
    const legado: Permissoes = { crm: ["visualizar", "editar"], "crm.atendimento.configuracoes": ["visualizar", "editar"] };
    for (const recurso of Object.keys(contrato).filter(id => id !== "crm" && id !== "crm.atendimento.configuracoes")) {
      expect(permissaoEfetiva(legado, {}, recurso, "visualizar")).toBe(false);
      for (const acao of ["editar", "adicionar", "excluir"] as const) expect(permissaoEfetiva(legado, {}, recurso, acao)).toBe(false);
    }
    expect(permissaoEfetiva({ "crm.atendimento.mensagens": ["visualizar"] }, {}, "crm.atendimento.mensagens", "adicionar")).toBe(false);
  });
  it("normaliza exceções sem alterar o perfil e conserva vetos específicos", () => {
    const base: Permissoes = { "crm.atendimento.conhecimento": ["visualizar", "editar", "excluir"] };
    const veto = { "crm.atendimento.conhecimento": { visualizar: true, excluir: false } };
    expect(validarExcecoes(veto, base)).toEqual({ "crm.atendimento.conhecimento": { excluir: false } });
    expect(permissaoEfetiva(base, veto, "crm.atendimento.conhecimento", "editar")).toBe(true);
    expect(permissaoEfetiva(base, veto, "crm.atendimento.conhecimento", "excluir")).toBe(false);
    expect(permissaoEfetiva(base, { "crm.atendimento.conhecimento": { visualizar: false } }, "crm.atendimento.conhecimento", "excluir")).toBe(false);
    expect(base).toEqual({ "crm.atendimento.conhecimento": ["visualizar", "editar", "excluir"] });
    expect(validarExcecoes({ "crm.atendimento.mensagens": { visualizar: true, adicionar: true } }, base)).toEqual({ "crm.atendimento.mensagens": { visualizar: true, adicionar: true } });
    for (const recurso of Object.keys(contrato)) expect(todasPermissoes()[recurso]).toEqual(contrato[recurso]);
  });
});
