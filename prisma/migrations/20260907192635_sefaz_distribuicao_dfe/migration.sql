-- CreateEnum
CREATE TYPE "TipoDocumentoSefaz" AS ENUM ('RES_NFE', 'PROC_NFE');

-- CreateTable
CREATE TABLE "SefazDistribuicaoEstado" (
    "id" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "ultNSU" TEXT NOT NULL DEFAULT '000000000000000',
    "bloqueadoAte" TIMESTAMP(3),
    "ultimoCStat" TEXT,
    "ultimoMotivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SefazDistribuicaoEstado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotaFiscalRecebida" (
    "id" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "nsu" TEXT NOT NULL,
    "tipo" "TipoDocumentoSefaz" NOT NULL,
    "xml" TEXT,
    "fornecedorCnpj" TEXT,
    "fornecedorNome" TEXT,
    "valorTotal" DECIMAL(14,2),
    "dataEmissao" TIMESTAMP(3),
    "cienciaEnviada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscalRecebida_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SefazDistribuicaoEstado_cnpj_key" ON "SefazDistribuicaoEstado"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalRecebida_chaveAcesso_key" ON "NotaFiscalRecebida"("chaveAcesso");

-- CreateIndex
CREATE INDEX "NotaFiscalRecebida_tipo_idx" ON "NotaFiscalRecebida"("tipo");

-- CreateIndex
CREATE INDEX "NotaFiscalRecebida_fornecedorCnpj_idx" ON "NotaFiscalRecebida"("fornecedorCnpj");
