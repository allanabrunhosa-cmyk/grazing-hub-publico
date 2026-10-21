import { expect, it } from "vitest";
import { lerPacoteCatalogo } from "@/lib/vendas/importacao-dominio";
export const pacoteTeste = () => ({ formato: 1, origem: "IFOOD", loja: "loja-teste", referencia: "Pacote fictício de teste",
  categorias: [{ chave: "cat", nome: "Categoria importada" }],
  grupos: [{ chave: "g", nome: "Grupo importado", tipo: "COMPLEMENTAR", minimo: 1, maximo: 1, repetir: false, opcoes: [{ chave: "porcao", nome: "Porção", preco: "25", quantidade: "1", produtoChave: "fixo" }] }],
  produtos: [
    { chave: "fixo", nome: "Porção importada", tipo: "PADRAO", categorias: [], grupos: [], preco: "25", pendencias: ["Conferir porção e receita."] },
    { chave: "config", nome: "Produto configurável importado", tipo: "PERSONALIZADO", categorias: ["cat"], grupos: [{ chave: "g", usarPadrao: true, minimo: 1, maximo: 1 }], preco: "0" },
  ],
});
it("lê pacote normalizado e não aceita formatos arbitrários ou dados malformados", () => {
  expect(lerPacoteCatalogo(JSON.stringify(pacoteTeste())).produtos).toHaveLength(2);
  expect(() => lerPacoteCatalogo("não é JSON")).toThrow("JSON válido");
  expect(() => lerPacoteCatalogo(JSON.stringify({ ...pacoteTeste(), formato: 2 }))).toThrow("não suportado");
  expect(() => lerPacoteCatalogo(" ".repeat(2_000_001))).toThrow("2 MB");
});
it("normaliza matriz externa em preço único Site vigente e preserva zero explícito", () => {
  const pacote = pacoteTeste();
  const { preco: _preco, ...produto } = pacote.produtos[0]; void _preco;
  const legados = [{ canal: "IFOOD", preco: "130", precoPromocional: null }, { canal: " Site ", preco: "100", precoPromocional: "80" }];
  const importar = (precos: typeof legados) => lerPacoteCatalogo(JSON.stringify({ ...pacote, produtos: [{ ...produto, precos }, pacote.produtos[1]] })).produtos[0];
  expect(importar(legados).preco).toBe("80");
  expect(importar([{ canal: "SITE", preco: "0", precoPromocional: null }, legados[0]]).preco).toBe("0");
  expect(importar([legados[0]]).preco).toBe("130");
  expect(importar(legados)).not.toHaveProperty("precos");
  expect(() => importar([{ canal: "SITE", preco: "100", precoPromocional: "101" }])).toThrow("promocional");
  expect(() => importar([legados[0], legados[0]])).toThrow("repetido");
});
it("identidade repetida e dependência ausente são rejeitadas antes de gravar", () => {
  const p = pacoteTeste(); p.produtos.push(p.produtos[0]);
  expect(() => lerPacoteCatalogo(JSON.stringify(p))).toThrow("identidade externa repetida");
  const q = pacoteTeste(); q.grupos[0].opcoes[0].produtoChave = "não existe";
  expect(() => lerPacoteCatalogo(JSON.stringify(q))).toThrow("precisa estar no pacote");
});
it("normaliza Extras sem copiar limite legado e recusa grupos aninhados", () => {
  const p = pacoteTeste(); p.grupos[0].tipo = "EXTRAS"; p.grupos[0].minimo = 4; p.grupos[0].maximo = 3;
  expect(lerPacoteCatalogo(JSON.stringify(p)).grupos[0]).toMatchObject({ minimo: 0, maximo: null, repetir: true });
  const q = pacoteTeste(); q.grupos[0].opcoes[0].produtoChave = "config";
  expect(() => lerPacoteCatalogo(JSON.stringify(q))).toThrow("aninhados");
});
