CREATE TABLE "CartaoCredito" (
 "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL UNIQUE, "contaBancariaId" TEXT NOT NULL REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "diaFechamento" INTEGER NOT NULL CHECK ("diaFechamento" BETWEEN 1 AND 31),
 "diaVencimento" INTEGER NOT NULL CHECK ("diaVencimento" BETWEEN 1 AND 31),
 "ativo" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CartaoCredito_contaBancariaId_idx" ON "CartaoCredito"("contaBancariaId");
ALTER TABLE "LancamentoFinanceiro" ADD COLUMN "cartaoCreditoId" TEXT REFERENCES "CartaoCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotaFiscalDuplicata" ADD COLUMN "formaPagamento" TEXT NOT NULL DEFAULT 'BOLETO' CHECK ("formaPagamento" IN ('BOLETO','PIX','CARTAO')),
 ADD COLUMN "cartaoCreditoId" TEXT REFERENCES "CartaoCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD COLUMN "dataCompra" DATE, ADD COLUMN "parcelaCartao" INTEGER NOT NULL DEFAULT 1 CHECK ("parcelaCartao" BETWEEN 1 AND 120);
ALTER TABLE "InsumoCodigoFornecedor" ADD COLUMN "fatorConversao" DECIMAL(15,6), ADD COLUMN "unidadeComercial" TEXT, ADD COLUMN "unidadeEstoque" "UnidadeMedida";
