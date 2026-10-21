-- Informações comerciais, sem geração de títulos ou movimentos financeiros.
ALTER TABLE "PedidoVenda" ADD COLUMN "pagamentoInformadoSnapshot" JSONB;
