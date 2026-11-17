// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MatrizPermissoes } from "@/app/(protegido)/configuracoes/usuarios/matriz-permissoes";
import { SECOES, type Permissoes } from "@/lib/permissoes/catalogo";
import { MODULOS_MATRIZ, ORGANIZACAO_PERMISSOES, filtrarMatriz } from "@/lib/permissoes/organizacao";

afterEach(cleanup);
const ids = (modulos = MODULOS_MATRIZ) => modulos.flatMap(m => m.secoes.flatMap(s => s.temas.map(t => t.id)));

it("coloca cada permissão concedível em exatamente um módulo, seção e tema", () => {
  const concediveis = SECOES.filter(s => !s.administradorApenas).map(s => s.id);
  expect([...ids()].sort()).toEqual([...concediveis].sort());
  expect(new Set(ids()).size).toBe(ids().length);
  expect(MODULOS_MATRIZ.flatMap(m => m.secoes).some(s => s.id === "outras")).toBe(false);
  const declarados = ORGANIZACAO_PERMISSOES.flatMap(m => m.secoes.flatMap(s => s.temas.map(t => t.id)));
  expect(declarados.filter(id => !SECOES.some(s => s.id === id))).toEqual([]);
});

it("mantém nomes únicos de seção e de tema dentro do mesmo conjunto", () => {
  const secoes = MODULOS_MATRIZ.flatMap(m => m.secoes.map(s => s.nome));
  expect(new Set(secoes).size).toBe(secoes.length);
  for (const modulo of MODULOS_MATRIZ) {
    const temas = modulo.secoes.flatMap(s => s.temas.map(t => t.nomeMatriz ?? t.nome));
    expect(new Set(temas).size, modulo.nome).toBe(temas.length);
  }
});

it("a busca localiza o que liberar para baixar nota fiscal, sem depender de acento ou ordem", () => {
  const achados = ids(filtrarMatriz("fiscal BAIXAR nota"));
  expect(achados).toEqual(expect.arrayContaining(["notas", "financeiro.nfse", "financeiro.fiscal.painel", "vendas.fiscal"]));
  expect(achados).not.toContain("fornecedores");
  expect(ids(filtrarMatriz("servico"))).toContain("financeiro.nfse");
  expect(filtrarMatriz("   ")).toBe(MODULOS_MATRIZ);
  expect(filtrarMatriz("zzzz inexistente")).toEqual([]);
});

it("buscar abre os temas encontrados, retira ações em lote e conserva a edição do tema", () => {
  let atual: Permissoes = {};
  function Perfil() { const [base, definir] = useState<Permissoes>({ fornecedores: ["visualizar"] }); atual = base; return <MatrizPermissoes base={base} aoMudar={definir} />; }
  render(<Perfil />);
  expect(screen.queryByLabelText("Notas de serviço (NFS-e): Visualizar")).toBeNull();
  fireEvent.change(screen.getByLabelText("Buscar permissão"), { target: { value: "baixar nota fiscal" } });
  expect(screen.getByLabelText("Módulo Financeiro").hasAttribute("open")).toBe(true);
  expect(screen.queryByLabelText("Módulo Produção")).toBeNull();
  expect(screen.queryByRole("button", { name: "Tudo em Financeiro" })).toBeNull();
  expect(screen.queryByRole("checkbox", { name: "Financeiro: Visualizar em todas as seções" })).toBeNull();
  fireEvent.click(screen.getByLabelText("Notas de serviço (NFS-e): Visualizar"));
  expect(atual).toEqual({ fornecedores: ["visualizar"], "financeiro.nfse": ["visualizar"] });
  fireEvent.change(screen.getByLabelText("Buscar permissão"), { target: { value: "zzzz" } });
  expect(screen.getByRole("status").textContent).toContain("Nenhuma permissão encontrada");
  fireEvent.change(screen.getByLabelText("Buscar permissão"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Tudo em Financeiro" })).toBeTruthy();
  expect(atual["financeiro.nfse"]).toEqual(["visualizar"]);
});
