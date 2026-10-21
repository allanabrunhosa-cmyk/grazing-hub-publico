import { describe, expect, it } from "vitest";
import { permissaoEfetiva, todasPermissoes, validarPermissoes, validarExcecoes, recursoDaRota } from "@/lib/permissoes/catalogo";
describe("perfis e exceções", () => {
  it("bloqueia tudo que não foi concedido", () => expect(permissaoEfetiva({}, {}, "compras", "editar")).toBe(false));
  it("não transforma visualizar em permissão de escrita", () => expect(permissaoEfetiva({ compras: ["visualizar"] }, {}, "compras", "adicionar")).toBe(false));
  it("exceção pode permitir ou negar sem alterar o perfil", () => {
    const perfil = { compras: ["visualizar", "editar"] as ("visualizar"|"editar")[] };
    expect(permissaoEfetiva(perfil, { compras: { editar: false } }, "compras", "editar")).toBe(false);
    expect(permissaoEfetiva(perfil, { compras: { adicionar: true } }, "compras", "adicionar")).toBe(true);
    expect(perfil.compras).toEqual(["visualizar", "editar"]);
  });
  it("bloquear visualização impede qualquer escrita", () => expect(permissaoEfetiva({ compras: ["visualizar", "editar"] }, { compras: { visualizar: false } }, "compras", "editar")).toBe(false));
  it("as ações não personalizadas continuam acompanhando o perfil", () => {
    const excecoes = { compras: { excluir: false } };
    expect(permissaoEfetiva({ compras: ["visualizar"] }, excecoes, "compras", "editar")).toBe(false);
    expect(permissaoEfetiva({ compras: ["visualizar", "editar"] }, excecoes, "compras", "editar")).toBe(true);
  });
  it("valida recursos e ações no servidor", () => {
    expect(() => validarPermissoes({ compras: ["superadmin"] })).toThrow();
    expect(() => validarPermissoes({ inexistente: ["visualizar"] })).toThrow();
    expect(() => validarPermissoes({ compras: ["editar"] })).toThrow();
    expect(() => validarExcecoes({ compras: { editar: "sim" } }, {})).toThrow();
    expect(validarExcecoes({ compras: { editar: false, visualizar: true } }, { compras: ["visualizar"] })).toEqual({});
  });
  it("mapeia rotas específicas antes das gerais", () => {
    expect(recursoDaRota("/vendas/bi")).toBe("vendas.bi");
    expect(recursoDaRota("/inventario/contagem/123")).toBe("inventario.contagem");
    expect(recursoDaRota("/financeiro/movimentacoes")).toBe("financeiro.movimentacoes");
    expect(recursoDaRota("/configuracoes/usuarios")).toBe("configuracoes.usuarios");
  });
  it("separa consulta, exportação, contatos e custos do Dashboard sem concessão implícita", () => {
    const base = validarPermissoes({ "vendas.bi": ["visualizar"] });
    expect(permissaoEfetiva(base, {}, "vendas.bi", "visualizar")).toBe(true);
    for (const recurso of ["vendas.bi.exportar", "vendas.bi.contatos", "vendas.bi.custos"]) {
      expect(permissaoEfetiva(base, {}, recurso, "visualizar")).toBe(false);
      expect(() => validarPermissoes({ [recurso]: ["visualizar"] })).not.toThrow();
      expect(() => validarPermissoes({ [recurso]: ["editar"] })).toThrow();
    }
    expect(permissaoEfetiva({ vendas: ["visualizar"] }, {}, "vendas.bi", "visualizar")).toBe(false);
  });
  it("reserva a Central de Design para administradores", () => {
    expect(recursoDaRota("/configuracoes/design/componentes")).toBe("configuracoes.design");
    expect(todasPermissoes()).not.toHaveProperty("configuracoes.design");
    expect(() => validarPermissoes({ "configuracoes.design": ["visualizar"] })).toThrow();
    expect(() => validarExcecoes({ "configuracoes.design": { visualizar: true } }, {})).toThrow();
  });
});
