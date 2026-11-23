-- Registro de avisos de revisão de NCM já enviados por e-mail.
-- SQL manual aditivo: cria somente uma tabela nova, sem alterar dados, classificações,
-- documentos ou permissões existentes. Cada assinatura identifica o estado atual da
-- composição de um produto frente à classificação vigente; o aviso é enviado uma vez.
BEGIN;
CREATE TABLE "AlertaRevisaoNcm" (
  "id" TEXT NOT NULL,
  "assinatura" TEXT NOT NULL,
  "versaoId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "mudancas" JSONB NOT NULL,
  "destinatarios" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertaRevisaoNcm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AlertaRevisaoNcm_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoEstruturaFiscal"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AlertaRevisaoNcm_assinatura_key" ON "AlertaRevisaoNcm"("assinatura");
CREATE INDEX "AlertaRevisaoNcm_versaoId_idx" ON "AlertaRevisaoNcm"("versaoId");
COMMIT;
