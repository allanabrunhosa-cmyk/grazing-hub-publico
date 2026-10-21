CREATE TABLE "ConversaoInsumo" (
  "id" TEXT NOT NULL,
  "insumoId" TEXT NOT NULL,
  "unidade" "UnidadeMedida" NOT NULL,
  "fator" DECIMAL(15,6) NOT NULL,
  CONSTRAINT "ConversaoInsumo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversaoInsumo_fator_positivo" CHECK ("fator" > 0),
  CONSTRAINT "ConversaoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ConversaoInsumo_insumoId_unidade_key" ON "ConversaoInsumo"("insumoId", "unidade");

ALTER TABLE "PedidoCompraItem"
  ADD COLUMN "fatorConversao" DECIMAL(15,6),
  ADD COLUMN "unidadePrincipal" "UnidadeMedida",
  ADD CONSTRAINT "PedidoCompraItem_conversao_valida" CHECK (
    ("fatorConversao" IS NULL AND "unidadePrincipal" IS NULL) OR
    ("fatorConversao" IS NOT NULL AND "unidadePrincipal" IS NOT NULL AND "fatorConversao" > 0 AND "insumoId" IS NOT NULL)
  );
