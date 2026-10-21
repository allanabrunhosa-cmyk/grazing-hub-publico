// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MatrizPermissoes } from "@/app/(protegido)/configuracoes/usuarios/matriz-permissoes";
import { validarPermissoes, validarExcecoes, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
afterEach(cleanup);
it("seleciona e deseleciona a coluna, respeitando ações aplicáveis e os outros módulos", () => {
  let atual: Permissoes = {};
  function Perfil() { const [base, definir] = useState<Permissoes>({ fornecedores: ["visualizar", "editar"], "financeiro.dre": ["visualizar"] }); atual = base; return <MatrizPermissoes base={base} aoMudar={definir} />; }
  render(<Perfil />);
  const editar = screen.getByRole("checkbox", { name: "Suprimentos: Editar em todas as seções" });
  expect(editar.getAttribute("aria-checked")).toBe("mixed");
  fireEvent.click(editar);
  expect(editar.getAttribute("aria-checked")).toBe("true");
  expect(atual.compras).toEqual(expect.arrayContaining(["visualizar", "editar"]));
  expect(atual["inventario.entrada"]).toBeUndefined();
  expect(validarPermissoes(atual)).toEqual(atual);
  fireEvent.click(editar);
  expect(atual.compras).toEqual(["visualizar"]);
  fireEvent.click(screen.getByRole("checkbox", { name: "Suprimentos: Visualizar em todas as seções" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Suprimentos: Visualizar em todas as seções" }));
  expect(atual.compras).toEqual([]);
  expect(atual["financeiro.dre"]).toEqual(["visualizar"]);
});
it("aplica o módulo inteiro pelos botões da linha de seções sem enviar o formulário", () => {
  const enviar = vi.fn(); let atual: Permissoes = {};
  function Perfil() { const [base, definir] = useState<Permissoes>({}); atual = base; return <form onSubmit={enviar}><MatrizPermissoes base={base} aoMudar={definir} /></form>; }
  render(<Perfil />);
  const tudo = screen.getByRole("button", { name: "Tudo em Suprimentos" });
  expect(tudo.closest("summary")?.textContent).toContain("seções");
  fireEvent.click(tudo);
  expect(atual.compras).toEqual(["visualizar", "editar", "adicionar", "excluir"]);
  expect(tudo.closest("details")?.open).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Bloquear em Suprimentos" }));
  expect(atual.compras).toEqual([]); expect(enviar).not.toHaveBeenCalled();
});
it("personaliza a coluna sem mudar o perfil herdado e mantém personalizações de outro módulo", () => {
  const base: Permissoes = { compras: ["visualizar", "adicionar"] }; let atual: Excecoes = {};
  function Usuario() { const [excecoes, definir] = useState<Excecoes>({ "financeiro.dre": { visualizar: true } }); atual = excecoes; return <MatrizPermissoes base={base} excecoes={excecoes} aoPersonalizar={definir} />; }
  render(<Usuario />);
  const adicionar = screen.getByRole("checkbox", { name: "Suprimentos: Adicionar em todas as seções" });
  fireEvent.click(adicionar);
  expect(atual.compras).toBeUndefined();
  expect(atual.fornecedores).toEqual({ adicionar: true, visualizar: true });
  expect(validarExcecoes(atual, base)).toEqual(atual);
  fireEvent.click(adicionar);
  expect(atual.compras).toEqual({ adicionar: false });
  expect(atual["financeiro.dre"]).toEqual({ visualizar: true });
  expect(base).toEqual({ compras: ["visualizar", "adicionar"] });
});
it("mantém a matriz de perfil protegido sem edição individual ou em lote", () => {
  const mudar = vi.fn(); render(<MatrizPermissoes base={{}} bloqueada aoMudar={mudar} />);
  const coluna = screen.getByRole("checkbox", { name: "Suprimentos: Excluir em todas as seções" });
  expect(coluna).toHaveProperty("disabled", true); fireEvent.click(coluna);
  expect(screen.getByLabelText("Pedidos de compra: Excluir")).toHaveProperty("disabled", true);
  expect(screen.queryByRole("button", { name: "Tudo em Suprimentos" })).toBeNull(); expect(mudar).not.toHaveBeenCalled();
});
