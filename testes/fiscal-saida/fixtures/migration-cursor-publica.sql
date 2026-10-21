-- Trava de concorrência: impede duas consultas simultâneas à SEFAZ pro mesmo CNPJ.
ALTER TABLE "SefazDistribuicaoEstado" ADD COLUMN "emConsulta" BOOLEAN NOT NULL DEFAULT false;

-- Auditoria permanente de avanço manual de cursor (fora do fluxo automático de sincronização).
CREATE TABLE "SefazDistribuicaoCursorHistorico" (
  "id" TEXT NOT NULL,
  "cnpj" TEXT NOT NULL,
  "ultNSUAntes" TEXT NOT NULL,
  "ultNSUDepois" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SefazDistribuicaoCursorHistorico_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SefazDistribuicaoCursorHistorico_cnpj_idx" ON "SefazDistribuicaoCursorHistorico"("cnpj");

-- Exportação pública: somente a estrutura do banco.
-- A recuperação operacional histórica permanece no arquivo privado original.
