-- Unidade em que cada item de pedido foi comprado — pode ser diferente da unidade
-- de estoque do Insumo (ex: comprar em caixa algo cujo saldo é controlado em kg).
ALTER TABLE "PedidoCompraItem" ADD COLUMN "unidadeCompra" "UnidadeMedida";

-- Backfill: itens já existentes foram todos registrados na própria unidade do Insumo,
-- já que esse campo não existia até agora.
UPDATE "PedidoCompraItem" pci
SET "unidadeCompra" = i."unidade"
FROM "Insumo" i
WHERE i.id = pci."insumoId";

ALTER TABLE "PedidoCompraItem" ALTER COLUMN "unidadeCompra" SET NOT NULL;
