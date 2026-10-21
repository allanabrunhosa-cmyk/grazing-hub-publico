ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "pedidosLiberacao" JSONB;
CREATE TABLE "ReservaPedido" (
 "id" TEXT PRIMARY KEY, "itemId" TEXT NOT NULL REFERENCES "ItemPedidoVenda"("id") ON DELETE RESTRICT,
 "localId" TEXT NOT NULL REFERENCES "LocalEstoque"("id") ON DELETE RESTRICT,
 "insumoId" TEXT NOT NULL REFERENCES "Insumo"("id") ON DELETE RESTRICT,
 "loteExecucao" TEXT NOT NULL, "quantidadeItem" DECIMAL(20,6) NOT NULL CHECK ("quantidadeItem">0),
 "quantidade" DECIMAL NOT NULL CHECK ("quantidade">0), "reservada" DECIMAL NOT NULL CHECK ("reservada">=0),
 "consumida" DECIMAL NOT NULL DEFAULT 0 CHECK ("consumida">=0),
 "liberada" DECIMAL NOT NULL DEFAULT 0 CHECK ("liberada">=0),
 "retornada" DECIMAL NOT NULL DEFAULT 0 CHECK ("retornada">=0),
 "perdida" DECIMAL NOT NULL DEFAULT 0 CHECK ("perdida">=0),
 "snapshot" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("reservada"+"consumida"+"liberada"="quantidade"), CHECK ("retornada"+"perdida"<="consumida")
);
CREATE UNIQUE INDEX "ReservaPedido_loteExecucao_insumoId_key" ON "ReservaPedido"("loteExecucao","insumoId");
CREATE INDEX "ReservaPedido_insumoId_localId_idx" ON "ReservaPedido"("insumoId","localId");
CREATE INDEX "ReservaPedido_itemId_idx" ON "ReservaPedido"("itemId");
