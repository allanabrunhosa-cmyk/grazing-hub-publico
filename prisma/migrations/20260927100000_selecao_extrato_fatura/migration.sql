ALTER TABLE "FaturaCartao" ADD COLUMN "transacaoSelecionadaId" TEXT;
ALTER TABLE "FaturaCartao" ADD CONSTRAINT "FaturaCartao_transacaoSelecionadaId_fkey" FOREIGN KEY ("transacaoSelecionadaId") REFERENCES "TransacaoExtrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "FaturaCartao_transacaoSelecionadaId_idx" ON "FaturaCartao"("transacaoSelecionadaId");
