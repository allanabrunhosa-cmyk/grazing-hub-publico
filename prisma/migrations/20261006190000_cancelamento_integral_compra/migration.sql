CREATE TABLE "CancelamentoCompra" (
  "id" TEXT NOT NULL,
  "chaveOrigem" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "autorId" TEXT NOT NULL,
  "autorNome" TEXT NOT NULL,
  "motivo" VARCHAR(255) NOT NULL,
  "resumo" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CancelamentoCompra_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CancelamentoCompra_chaveOrigem_key" ON "CancelamentoCompra"("chaveOrigem");
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "estornoDeId" TEXT;
CREATE UNIQUE INDEX "MovimentacaoEstoque_estornoDeId_key" ON "MovimentacaoEstoque"("estornoDeId");
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_estornoDeId_fkey"
  FOREIGN KEY ("estornoDeId") REFERENCES "MovimentacaoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
