import type { ContagemDetalhe, ContagemItemRow } from "@/app/(protegido)/inventario/types";

export const itensContagemTeste: ContagemItemRow[] = [
  { id: "queijo", insumoId: "queijo", nome: "Queijo brie", especificacao: "Peça de 1 kg", unidade: "KG", fornecedores: ["Laticínios Serra", "Queijaria Central"], tipoEstoque: "REFRIGERADO", estoqueMinimo: 3.5, estoqueMaximo: 25, contado: true, ajustado: false, quantidadeContada: 12, quantidadeSistema: 19 },
  { id: "acucar", insumoId: "acucar", nome: "Açúcar", unidade: "KG", fornecedores: ["Armazém Central"], tipoEstoque: "SECO", estoqueMinimo: 5, estoqueMaximo: null, contado: true, ajustado: true, quantidadeContada: 2, quantidadeSistema: 1 },
  { id: "pao", insumoId: "pao", nome: "Pão artesanal", especificacao: "Preparação de fermentação natural", unidade: "UN", fornecedores: ["Padaria do Bairro"], tipoEstoque: "CONGELADO", estoqueMinimo: 0, estoqueMaximo: 50, contado: false, ajustado: false, quantidadeContada: null, quantidadeSistema: 30 },
  { id: "uva", insumoId: "uva", nome: "Uva verde", unidade: "KG", fornecedores: [], tipoEstoque: null, estoqueMinimo: 0, estoqueMaximo: null, contado: false, ajustado: false, quantidadeContada: null, quantidadeSistema: 4 },
];

export const contagemTeste: ContagemDetalhe = {
  id: "contagem-visual", localNome: "Estoque principal", dataContagem: "2026-09-10T12:00:00.000Z", status: "EM_ANDAMENTO",
  itens: itensContagemTeste.map((item) => ({ ...item, quantidadeSistema: null })),
};
