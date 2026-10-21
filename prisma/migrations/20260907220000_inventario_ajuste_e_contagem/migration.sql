-- Renomeia AJUSTE_MANUAL -> AJUSTE_ENTRADA e adiciona AJUSTE_SAIDA, seguindo o padrão
-- direcional ENTRADA_/SAIDA_ já usado pelos outros valores do enum.
-- Seguro: nenhuma linha de aplicação grava em MovimentacaoEstoque hoje.
ALTER TYPE "TipoMovimentacaoEstoque" RENAME VALUE 'AJUSTE_MANUAL' TO 'AJUSTE_ENTRADA';
ALTER TYPE "TipoMovimentacaoEstoque" ADD VALUE 'AJUSTE_SAIDA';

-- Renomeia AJUSTE -> OUTRO em MotivoPerda pra não colidir semanticamente com os novos
-- valores de ajuste de movimentação (perda e ajuste de contagem são conceitos distintos).
ALTER TYPE "MotivoPerda" RENAME VALUE 'AJUSTE' TO 'OUTRO';

-- Trilha de auditoria: custo unitário aplicado numa entrada, usado pra recalcular o
-- custo médio do Insumo.
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "custoUnitario" DECIMAL(12,4);

-- Distingue "linha ainda não contada" de "usuário confirmou igual ao sistema" — necessário
-- pra contagem cega (nunca expor quantidadeSistema enquanto EM_ANDAMENTO).
ALTER TABLE "InventarioItem" ADD COLUMN "contado" BOOLEAN NOT NULL DEFAULT false;

-- Usado pela agregação de posição histórica (soma de movimentações até uma data).
CREATE INDEX "MovimentacaoEstoque_createdAt_idx" ON "MovimentacaoEstoque"("createdAt");
