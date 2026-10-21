/*
  Warnings:

  - You are about to drop the column `cienciaEnviada` on the `NotaFiscalRecebida` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "TipoManifestacao" AS ENUM ('CIENCIA_DA_OPERACAO', 'CONFIRMACAO_DA_OPERACAO', 'DESCONHECIMENTO_DA_OPERACAO', 'OPERACAO_NAO_REALIZADA');

-- AlterTable
ALTER TABLE "NotaFiscalRecebida" DROP COLUMN "cienciaEnviada",
ADD COLUMN     "ultimaManifestacao" "TipoManifestacao";

-- CreateTable
CREATE TABLE "ManifestacaoNFe" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "tipo" "TipoManifestacao" NOT NULL,
    "justificativa" TEXT,
    "sucesso" BOOLEAN NOT NULL DEFAULT false,
    "protocolo" TEXT,
    "cStat" TEXT,
    "xMotivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManifestacaoNFe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManifestacaoNFe_notaFiscalId_idx" ON "ManifestacaoNFe"("notaFiscalId");

-- AddForeignKey
ALTER TABLE "ManifestacaoNFe" ADD CONSTRAINT "ManifestacaoNFe_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscalRecebida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
