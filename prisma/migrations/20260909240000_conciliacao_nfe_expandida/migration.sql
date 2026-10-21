-- CreateEnum
CREATE TYPE "DestinoItemNota" AS ENUM ('ESTOQUE', 'USO_E_CONSUMO');

-- AlterTable
ALTER TABLE "NotaFiscalItem"
  ADD COLUMN "destino" "DestinoItemNota" NOT NULL DEFAULT 'ESTOQUE',
  ADD COLUMN "categoriaFinanceiraId" TEXT;

-- CreateTable
CREATE TABLE "NotaFiscalDuplicata" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "dataVencimento" TIMESTAMP(3) NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscalDuplicata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscalItemLancamento" (
    "id" TEXT NOT NULL,
    "notaFiscalItemId" TEXT NOT NULL,
    "notaFiscalDuplicataId" TEXT NOT NULL,
    "lancamentoFinanceiroId" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotaFiscalItemLancamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotaFiscalDuplicata_notaFiscalId_idx" ON "NotaFiscalDuplicata"("notaFiscalId");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalItemLancamento_lancamentoFinanceiroId_key" ON "NotaFiscalItemLancamento"("lancamentoFinanceiroId");

-- CreateIndex
CREATE INDEX "NotaFiscalItemLancamento_notaFiscalItemId_idx" ON "NotaFiscalItemLancamento"("notaFiscalItemId");

-- CreateIndex
CREATE INDEX "NotaFiscalItemLancamento_notaFiscalDuplicataId_idx" ON "NotaFiscalItemLancamento"("notaFiscalDuplicataId");

-- CreateIndex
CREATE INDEX "NotaFiscalItem_categoriaFinanceiraId_idx" ON "NotaFiscalItem"("categoriaFinanceiraId");

-- AddForeignKey
ALTER TABLE "NotaFiscalItem" ADD CONSTRAINT "NotaFiscalItem_categoriaFinanceiraId_fkey" FOREIGN KEY ("categoriaFinanceiraId") REFERENCES "CategoriaFinanceira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalDuplicata" ADD CONSTRAINT "NotaFiscalDuplicata_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscalRecebida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalItemLancamento" ADD CONSTRAINT "NotaFiscalItemLancamento_notaFiscalItemId_fkey" FOREIGN KEY ("notaFiscalItemId") REFERENCES "NotaFiscalItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalItemLancamento" ADD CONSTRAINT "NotaFiscalItemLancamento_notaFiscalDuplicataId_fkey" FOREIGN KEY ("notaFiscalDuplicataId") REFERENCES "NotaFiscalDuplicata"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalItemLancamento" ADD CONSTRAINT "NotaFiscalItemLancamento_lancamentoFinanceiroId_fkey" FOREIGN KEY ("lancamentoFinanceiroId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
