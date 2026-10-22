import { expect, it } from "vitest";
import { atalhoPendenciaFiscal, referenciasFiscaisPedido } from "@/lib/tributacao/atalhos";
it("aponta o componente do kit sem mudar linhas, códigos ou fotografias", () => {
  const itens = [{ produtoId: "kit-ficticio", produtoSnapshot: { nome: "Kit fictício", fotografiaKitFiscal: { componentes: [{ referenciaInternaInsumoId: "fruta-ficticia", descricao: "Fruta fictícia" }] } } }];
  const antes = structuredClone(itens), refs = referenciasFiscaisPedido(itens, []);
  expect(atalhoPendenciaFiscal("Item fiscal 2 — Fruta fictícia: NCM ausente.", refs)).toBe("/financeiro/fiscal/vinculos?produto=INSUMO%3Afruta-ficticia#ficha-fiscal");
  expect(atalhoPendenciaFiscal("Kit fictício / Fruta fictícia: Origem ausente.", refs)).toBe("/financeiro/fiscal/vinculos?produto=INSUMO%3Afruta-ficticia#ficha-fiscal");
  expect(itens).toEqual(antes);
});
it("não escolhe cadastro quando há nomes ambíguos e identifica a empresa", () => {
  expect(atalhoPendenciaFiscal("Produto fictício: Origem ausente.", [{ id: "a", nome: "Produto fictício" }, { id: "b", nome: "Produto fictício" }])).toBe("/financeiro/fiscal/vinculos");
  expect(atalhoPendenciaFiscal("Confirmar CRT do perfil fiscal.", [])).toBe("/financeiro/fiscal/configuracoes#empresa");
});
