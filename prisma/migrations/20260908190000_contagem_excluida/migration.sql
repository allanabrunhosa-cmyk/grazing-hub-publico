-- Contagem de estoque em andamento pode ser excluída (soft delete) — nunca some do
-- banco, só passa a aparecer no histórico com esse status.
ALTER TYPE "StatusContagem" ADD VALUE 'EXCLUIDO';
