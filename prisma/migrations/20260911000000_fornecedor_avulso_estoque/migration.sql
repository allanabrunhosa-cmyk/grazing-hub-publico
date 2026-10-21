-- Fornecedor pontual permitido tanto em compras de estoque quanto de uso e consumo.
ALTER TABLE "PedidoCompra" DROP CONSTRAINT "PedidoCompra_fornecedor_valido";
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedor_valido" CHECK (
  ("fornecedorId" IS NOT NULL AND "fornecedorAvulso" IS NULL)
  OR ("fornecedorId" IS NULL AND "fornecedorAvulso" IS NOT NULL AND length(trim("fornecedorAvulso")) > 0)
);
