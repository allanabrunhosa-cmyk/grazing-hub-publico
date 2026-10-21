CREATE TABLE "EntradaAvulsaCompra" (
  "id" TEXT NOT NULL,
  "fornecedorId" TEXT NOT NULL,
  "dataEntrada" TIMESTAMP(3) NOT NULL,
  "valorProdutos" DECIMAL(14,2) NOT NULL,
  "frete" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "desconto" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "valorOutrosCustos" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "outrosCustos" JSONB NOT NULL,
  "valorTotal" DECIMAL(14,2) NOT NULL,
  "dataVencimento" TIMESTAMP(3),
  "pago" BOOLEAN NOT NULL DEFAULT false,
  "dataPagamento" TIMESTAMP(3),
  "observacao" TEXT,
  "criadoPorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EntradaAvulsaCompra_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MovimentacaoEstoque"
  ADD COLUMN "entradaAvulsaCompraId" TEXT;

ALTER TABLE "LancamentoFinanceiro"
  ADD COLUMN "origemEntradaAvulsaCompraId" TEXT;

CREATE INDEX "EntradaAvulsaCompra_fornecedorId_idx"
  ON "EntradaAvulsaCompra"("fornecedorId");

CREATE INDEX "EntradaAvulsaCompra_dataEntrada_idx"
  ON "EntradaAvulsaCompra"("dataEntrada");

CREATE INDEX "MovimentacaoEstoque_entradaAvulsaCompraId_idx"
  ON "MovimentacaoEstoque"("entradaAvulsaCompraId");

CREATE UNIQUE INDEX "LancamentoFinanceiro_origemEntradaAvulsaCompraId_key"
  ON "LancamentoFinanceiro"("origemEntradaAvulsaCompraId");

ALTER TABLE "EntradaAvulsaCompra"
  ADD CONSTRAINT "EntradaAvulsaCompra_fornecedorId_fkey"
  FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EntradaAvulsaCompra"
  ADD CONSTRAINT "EntradaAvulsaCompra_criadoPorId_fkey"
  FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MovimentacaoEstoque"
  ADD CONSTRAINT "MovimentacaoEstoque_entradaAvulsaCompraId_fkey"
  FOREIGN KEY ("entradaAvulsaCompraId") REFERENCES "EntradaAvulsaCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LancamentoFinanceiro"
  ADD CONSTRAINT "LancamentoFinanceiro_origemEntradaAvulsaCompraId_fkey"
  FOREIGN KEY ("origemEntradaAvulsaCompraId") REFERENCES "EntradaAvulsaCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
