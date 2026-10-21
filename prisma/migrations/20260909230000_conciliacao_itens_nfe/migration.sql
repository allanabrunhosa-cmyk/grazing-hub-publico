-- Conciliação de itens de NF-e com Insumos: extrai os itens do XML sob demanda,
-- memoriza o vínculo fornecedor+código→Insumo, e liga cada item conciliado à
-- MovimentacaoEstoque que ele gerou. Nenhuma tabela existente é alterada.

CREATE TYPE "StatusConciliacaoItem" AS ENUM ('PENDENTE', 'CONCILIADO', 'IGNORADO');

CREATE TABLE "NotaFiscalItem" (
    "id" TEXT NOT NULL,
    "notaFiscalId" TEXT NOT NULL,
    "numeroItem" INTEGER NOT NULL,
    "codigoProdutoFornecedor" TEXT NOT NULL,
    "descricaoProduto" TEXT NOT NULL,
    "codigoEan" TEXT,
    "ncm" TEXT,
    "cfop" TEXT,
    "unidadeComercial" TEXT NOT NULL,
    "quantidadeComercial" DECIMAL(14,4) NOT NULL,
    "valorUnitarioComercial" DECIMAL(14,4),
    "valorTotalItem" DECIMAL(14,2) NOT NULL,
    "status" "StatusConciliacaoItem" NOT NULL DEFAULT 'PENDENTE',
    "insumoId" TEXT,
    "quantidadeConciliada" DECIMAL(12,3),
    "valorTotalConciliado" DECIMAL(14,2),
    "movimentacaoEstoqueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotaFiscalItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotaFiscalItem_notaFiscalId_numeroItem_key" ON "NotaFiscalItem"("notaFiscalId", "numeroItem");
CREATE UNIQUE INDEX "NotaFiscalItem_movimentacaoEstoqueId_key" ON "NotaFiscalItem"("movimentacaoEstoqueId");
CREATE INDEX "NotaFiscalItem_notaFiscalId_idx" ON "NotaFiscalItem"("notaFiscalId");
CREATE INDEX "NotaFiscalItem_insumoId_idx" ON "NotaFiscalItem"("insumoId");
CREATE INDEX "NotaFiscalItem_status_idx" ON "NotaFiscalItem"("status");

ALTER TABLE "NotaFiscalItem" ADD CONSTRAINT "NotaFiscalItem_notaFiscalId_fkey"
    FOREIGN KEY ("notaFiscalId") REFERENCES "NotaFiscalRecebida"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotaFiscalItem" ADD CONSTRAINT "NotaFiscalItem_insumoId_fkey"
    FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotaFiscalItem" ADD CONSTRAINT "NotaFiscalItem_movimentacaoEstoqueId_fkey"
    FOREIGN KEY ("movimentacaoEstoqueId") REFERENCES "MovimentacaoEstoque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InsumoCodigoFornecedor" (
    "id" TEXT NOT NULL,
    "fornecedorCnpj" TEXT NOT NULL,
    "codigoProduto" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsumoCodigoFornecedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InsumoCodigoFornecedor_fornecedorCnpj_codigoProduto_key" ON "InsumoCodigoFornecedor"("fornecedorCnpj", "codigoProduto");
CREATE INDEX "InsumoCodigoFornecedor_insumoId_idx" ON "InsumoCodigoFornecedor"("insumoId");

ALTER TABLE "InsumoCodigoFornecedor" ADD CONSTRAINT "InsumoCodigoFornecedor_insumoId_fkey"
    FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
