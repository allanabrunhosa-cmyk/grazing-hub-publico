import { limitesEfetivos, type ProdutoEntrada } from "./dominio";
import type { ItemPedidoEntrada } from "./pedidos-dominio";

type Produto = Pick<ProdutoEntrada, "nome" | "ativo" | "classificacoes" | "categorias" | "grupos" | "preco"> & { id: string };
export type OpcaoCatalogoPedido = {
  value: string; label: string; produtoId: string; categorias: string[]; indisponivel: boolean;
  motivoIndisponivel?: string; secao?: { id: string; nome: string };
  complementoAvulso?: ItemPedidoEntrada["complementoAvulso"];
};

export function chaveItemCatalogoPedido(item: Pick<ItemPedidoEntrada, "produtoId" | "complementoAvulso">) {
  const origem = item.complementoAvulso;
  return origem ? `opcao:${origem.produtoOrigemId}:${origem.grupoId}:${origem.opcaoId}:${item.produtoId}` : item.produtoId;
}

/** A opção avulsa é uma porção; os limites do vínculo precisam permitir essa escolha. */
export function permiteOpcaoAvulsa(grupo: { tipo: string; minimo: number; maximo: number | null }, vinculo: Omit<Produto["grupos"][number], "ajustesOpcoes"> & { ajustesOpcoes?: unknown }) {
  const limites = limitesEfetivos(grupo, vinculo);
  return limites.minimo === 0 && (limites.maximo === null || limites.maximo >= 1);
}

/** Novos itens vendem produtos; complementos são escolhas internas. Itens históricos continuam identificáveis pela chave legada. */
export function opcoesCatalogoPedido(produtos: Produto[]): OpcaoCatalogoPedido[] {
  return produtos.filter(p => p.ativo && (p.classificacoes?.includes("PRINCIPAL") || (p.classificacoes?.includes("OPCAO") && !p.classificacoes.includes("COMPLEMENTO"))))
    .map(p => ({ value: p.id, produtoId: p.id, label: p.nome, categorias: p.categorias, indisponivel: false }));
}
