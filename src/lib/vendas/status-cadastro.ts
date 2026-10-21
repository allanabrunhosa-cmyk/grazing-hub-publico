export const RECURSOS_STATUS_VENDA = {
  PRODUTO: "vendas.produtos", CLIENTE: "vendas.clientes", CATEGORIA: "vendas.catalogo",
  GRUPO: "vendas.catalogo", CATEGORIA_GRUPO: "vendas.catalogo", GRUPO_FISCAL: "vendas.fiscal",
  FORMA_PAGAMENTO: "vendas.formas-pagamento",
} as const;
export type TipoStatusVenda = keyof typeof RECURSOS_STATUS_VENDA;
