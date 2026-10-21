-- Auditoria aditiva: nenhuma contagem, saldo ou movimentação existente é alterada.
ALTER TABLE "InventarioContagem"
  ADD COLUMN "finalizadaEm" TIMESTAMP(3),
  ADD COLUMN "excluidaEm" TIMESTAMP(3),
  ADD COLUMN "excluidaPorId" TEXT,
  ADD COLUMN "excluidaPorNome" TEXT,
  ADD COLUMN "motivoExclusao" TEXT,
  ADD COLUMN "ajustesEstornados" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventarioContagem" ADD CONSTRAINT "InventarioContagem_excluidaPorId_fkey"
  FOREIGN KEY ("excluidaPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventarioItem"
  ADD COLUMN "unidadeAjuste" "UnidadeMedida",
  ADD COLUMN "movimentoAjusteId" TEXT,
  ADD COLUMN "movimentoEstornoId" TEXT;
CREATE UNIQUE INDEX "InventarioItem_movimentoAjusteId_key" ON "InventarioItem"("movimentoAjusteId");
CREATE UNIQUE INDEX "InventarioItem_movimentoEstornoId_key" ON "InventarioItem"("movimentoEstornoId");
ALTER TABLE "InventarioItem" ADD CONSTRAINT "InventarioItem_movimentoAjusteId_fkey"
  FOREIGN KEY ("movimentoAjusteId") REFERENCES "MovimentacaoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventarioItem" ADD CONSTRAINT "InventarioItem_movimentoEstornoId_fkey"
  FOREIGN KEY ("movimentoEstornoId") REFERENCES "MovimentacaoEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
