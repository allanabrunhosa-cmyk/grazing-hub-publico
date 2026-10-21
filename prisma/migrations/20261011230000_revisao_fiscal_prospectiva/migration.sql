-- Repreparar uma operação com nova vigência/configuração cria outra fotografia.
ALTER TABLE "DocumentoFiscalSaida" ADD COLUMN "revisaoFiscal" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "DocumentoFiscalSaida_pedidoId_versaoPedido_key";
CREATE UNIQUE INDEX "DocumentoFiscalSaida_pedidoId_versaoPedido_revisaoFiscal_key" ON "DocumentoFiscalSaida"("pedidoId","versaoPedido","revisaoFiscal");
ALTER TABLE "DocumentoFiscalSaida" ADD CONSTRAINT "DocumentoFiscalSaida_revisaoFiscal_check" CHECK ("revisaoFiscal" > 0);
