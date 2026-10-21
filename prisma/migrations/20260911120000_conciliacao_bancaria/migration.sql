ALTER TABLE "ContaBancaria" ADD COLUMN "referenciaOfx" TEXT;
CREATE UNIQUE INDEX "ContaBancaria_referenciaOfx_key" ON "ContaBancaria"("referenciaOfx");
CREATE TABLE "ImportacaoExtrato" (
  "id" TEXT PRIMARY KEY, "contaBancariaId" TEXT NOT NULL REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "nomeArquivo" TEXT NOT NULL, "hashArquivo" TEXT NOT NULL, "formato" TEXT NOT NULL, "referenciaOfx" TEXT,
  "autorId" TEXT NOT NULL, "autorNome" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ImportacaoExtrato_contaBancariaId_hashArquivo_key" ON "ImportacaoExtrato"("contaBancariaId", "hashArquivo");
CREATE TABLE "TransacaoExtrato" (
  "id" TEXT PRIMARY KEY, "contaBancariaId" TEXT NOT NULL REFERENCES "ContaBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "importacaoId" TEXT NOT NULL REFERENCES "ImportacaoExtrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "chave" TEXT NOT NULL, "impressao" TEXT NOT NULL, "identificador" TEXT, "data" DATE NOT NULL, "descricao" TEXT NOT NULL,
  "valor" DECIMAL(14,2) NOT NULL CHECK ("valor" <> 0), "conciliadaEm" TIMESTAMP(3), "conciliadaPorNome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "TransacaoExtrato_contaBancariaId_chave_key" ON "TransacaoExtrato"("contaBancariaId", "chave");
CREATE INDEX "TransacaoExtrato_contaBancariaId_data_idx" ON "TransacaoExtrato"("contaBancariaId", "data");
CREATE INDEX "TransacaoExtrato_contaBancariaId_impressao_idx" ON "TransacaoExtrato"("contaBancariaId", "impressao");
CREATE TABLE "VinculoExtrato" (
  "lancamentoId" TEXT PRIMARY KEY REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "transacaoId" TEXT NOT NULL REFERENCES "TransacaoExtrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "VinculoExtrato_transacaoId_idx" ON "VinculoExtrato"("transacaoId");
CREATE TABLE "HistoricoConciliacao" (
  "id" TEXT PRIMARY KEY, "transacaoId" TEXT NOT NULL REFERENCES "TransacaoExtrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "acao" TEXT NOT NULL, "autorId" TEXT NOT NULL, "autorNome" TEXT NOT NULL, "motivo" TEXT, "detalhes" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "HistoricoConciliacao_transacaoId_createdAt_idx" ON "HistoricoConciliacao"("transacaoId", "createdAt");
