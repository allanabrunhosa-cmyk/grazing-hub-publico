CREATE TYPE "OrigemNfse" AS ENUM ('NACIONAL', 'MUNICIPAL', 'ARQUIVO');
CREATE TYPE "StatusNfse" AS ENUM ('PENDENTE', 'LANCADA', 'CANCELADA');

CREATE TABLE "NotaFiscalServico" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identificador" TEXT NOT NULL,
  "chaveAcesso" TEXT,
  "nsu" TEXT,
  "origem" "OrigemNfse" NOT NULL,
  "status" "StatusNfse" NOT NULL DEFAULT 'PENDENTE',
  "xml" TEXT,
  "numero" TEXT,
  "serie" TEXT,
  "codigoVerificacao" TEXT,
  "prestadorCnpj" TEXT,
  "prestadorNome" TEXT,
  "tomadorCnpj" TEXT,
  "tomadorNome" TEXT,
  "valorServico" DECIMAL(14,2),
  "valorLiquido" DECIMAL(14,2),
  "valorIss" DECIMAL(14,2),
  "dataEmissao" TIMESTAMP(3),
  "dataCompetencia" TIMESTAMP(3),
  "municipioCodigo" TEXT,
  "municipioNome" TEXT,
  "uf" TEXT,
  "fornecedorId" TEXT,
  "observacoes" TEXT,
  "criadoPorId" TEXT,
  "criadoPorNome" TEXT,
  "canceladaEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "NotaFiscalServico_identificador_key" ON "NotaFiscalServico"("identificador");
CREATE UNIQUE INDEX "NotaFiscalServico_chaveAcesso_key" ON "NotaFiscalServico"("chaveAcesso");
CREATE INDEX "NotaFiscalServico_dataEmissao_idx" ON "NotaFiscalServico"("dataEmissao");
CREATE INDEX "NotaFiscalServico_prestadorCnpj_idx" ON "NotaFiscalServico"("prestadorCnpj");
CREATE INDEX "NotaFiscalServico_status_idx" ON "NotaFiscalServico"("status");
CREATE INDEX "NotaFiscalServico_nsu_idx" ON "NotaFiscalServico"("nsu");
ALTER TABLE "NotaFiscalServico" ADD CONSTRAINT "NotaFiscalServico_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "EventoNfse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "notaFiscalId" TEXT,
  "identificador" TEXT NOT NULL,
  "chaveAcesso" TEXT,
  "nsu" TEXT,
  "tipo" TEXT,
  "xml" TEXT,
  "criadoPorNome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "EventoNfse_identificador_key" ON "EventoNfse"("identificador");
CREATE INDEX "EventoNfse_chaveAcesso_idx" ON "EventoNfse"("chaveAcesso");
CREATE INDEX "EventoNfse_notaFiscalId_idx" ON "EventoNfse"("notaFiscalId");
ALTER TABLE "EventoNfse" ADD CONSTRAINT "EventoNfse_notaFiscalId_fkey" FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscalServico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NotaFiscalServicoLancamento" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "notaFiscalServicoId" TEXT NOT NULL,
  "lancamentoFinanceiroId" TEXT NOT NULL,
  "criadoPorId" TEXT,
  "criadoPorNome" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "NotaFiscalServicoLancamento_notaFiscalServicoId_key" ON "NotaFiscalServicoLancamento"("notaFiscalServicoId");
CREATE UNIQUE INDEX "NotaFiscalServicoLancamento_lancamentoFinanceiroId_key" ON "NotaFiscalServicoLancamento"("lancamentoFinanceiroId");
ALTER TABLE "NotaFiscalServicoLancamento" ADD CONSTRAINT "NotaFiscalServicoLancamento_notaFiscalServicoId_fkey" FOREIGN KEY ("notaFiscalServicoId") REFERENCES "NotaFiscalServico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NotaFiscalServicoLancamento" ADD CONSTRAINT "NotaFiscalServicoLancamento_lancamentoFinanceiroId_fkey" FOREIGN KEY ("lancamentoFinanceiroId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NfseDistribuicaoEstado" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cnpj" TEXT NOT NULL,
  "nsuConsulta" TEXT NOT NULL DEFAULT '0',
  "ultimaExecucaoEm" TIMESTAMP(3),
  "proximaBuscaEm" TIMESTAMP(3),
  "emConsulta" BOOLEAN NOT NULL DEFAULT false,
  "ultimoStatus" TEXT,
  "ultimoMotivo" TEXT,
  "resultadoExecucao" TEXT,
  "ultimaRespostaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "NfseDistribuicaoEstado_cnpj_key" ON "NfseDistribuicaoEstado"("cnpj");

UPDATE "PerfilAcesso"
SET "permissoes" = jsonb_set("permissoes", '{financeiro.nfse}', '["visualizar", "adicionar", "editar"]'::jsonb, true)
WHERE "id" = 'perfil-equipe';
