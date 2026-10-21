import { expect, it } from "vitest";
import { marcasDoInsumo } from "@/lib/insumos/marcas";
import { fornecedoresDoInsumo } from "@/lib/insumos/fornecedores";
import { ordenarItensContagem } from "@/app/(protegido)/inventario/contagem/ordenacao";
import { gerarHtmlContagem } from "@/app/(protegido)/inventario/contagem/impressao";
import { contagemTeste, itensContagemTeste } from "../inventario/dados";

it("mantém fornecedor principal primeiro mesmo com nome posterior no alfabeto, sem duplicar ou alterar entrada", () => {
  const fornecedores = [{ id: "a", nome: "Alfa" }, { id: "z", nome: "Zeta" }, { id: "b", nome: "Beta" }];
  expect(fornecedoresDoInsumo({ fornecedorPrincipalId: "z", fornecedoresHomologados: fornecedores })).toEqual([fornecedores[1], fornecedores[0], fornecedores[2]]);
  expect(fornecedores.map(f => f.id)).toEqual(["a", "z", "b"]);
  expect(fornecedoresDoInsumo({ fornecedorPrincipal: fornecedores[1], fornecedoresHomologados: [fornecedores[0]] }).map(f => f.id)).toEqual(["z", "a"]);
});
it("prioriza primeira marca homologada/campo principal e ordena as demais sem recuperar marca removida", () => {
  expect(marcasDoInsumo({ marcasHomologadas: ["Zeta", "Beta", "Alfa"] })).toEqual(["Zeta", "Alfa", "Beta"]);
  expect(marcasDoInsumo({ marca: "Zeta", marcasHomologadas: ["Alfa", "Zeta", "Beta"] })).toEqual(["Zeta", "Alfa", "Beta"]);
  expect(marcasDoInsumo({ marca: "Removida", marcasHomologadas: ["Zeta", "Alfa"] })).toEqual(["Zeta", "Alfa"]);
});
it("ordena a contagem pelo fornecedor/marca que aparece primeiro, mantendo ausentes no final", () => {
  const itens = [{ ...itensContagemTeste[0], id: "z", marcas: ["Zeta", "Alfa"], fornecedores: ["Zeta", "Alfa"] }, { ...itensContagemTeste[0], id: "b", marcas: ["Beta"], fornecedores: ["Beta"] }, { ...itensContagemTeste[0], id: "vazio", marcas: [], fornecedores: [] }];
  for (const coluna of ["marcas", "fornecedores"] as const) {
    expect(ordenarItensContagem(itens, { coluna, direcao: "asc" }).map(i => i.id)).toEqual(["b", "z", "vazio"]);
    expect(ordenarItensContagem(itens, { coluna, direcao: "desc" }).map(i => i.id)).toEqual(["z", "b", "vazio"]);
  }
  expect(gerarHtmlContagem(contagemTeste, itens, "")).toContain("Zeta, Alfa");
});
