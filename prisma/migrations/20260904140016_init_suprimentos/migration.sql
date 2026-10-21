-- CreateEnum
CREATE TYPE "CategoriaInsumo" AS ENUM ('MATERIA_PRIMA_PERECIVEL', 'EMBALAGEM', 'DESCARTAVEL', 'LIMPEZA', 'CONSUMIVEL');

-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('DINHEIRO', 'PIX', 'BOLETO', 'TRANSFERENCIA', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'CHEQUE');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('KG', 'G', 'L', 'ML', 'UN', 'CX', 'PCT', 'FD', 'DZ');

-- CreateEnum
CREATE TYPE "StatusPedidoCompra" AS ENUM ('RASCUNHO', 'ENVIADO', 'CONFIRMADO', 'RECEBIDO_PARCIAL', 'RECEBIDO_TOTAL', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoAnexoPedido" AS ENUM ('ORCAMENTO', 'NOTA_FISCAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "TipoDivergencia" AS ENUM ('FALTOU', 'VEIO_ERRADO', 'FORA_DO_PRAZO', 'QUALIDADE');

-- CreateEnum
CREATE TYPE "TipoMovimentacaoEstoque" AS ENUM ('ENTRADA_COMPRA', 'SAIDA_CONSUMO', 'SAIDA_PERDA', 'AJUSTE_MANUAL');

-- CreateEnum
CREATE TYPE "MotivoPerda" AS ENUM ('VALIDADE_VENCIDA', 'QUEBRA', 'ERRO_PRODUCAO', 'FURTO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "StatusContagem" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalEstoque" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "contatoNome" TEXT,
    "contatoTelefone" TEXT,
    "contatoEmail" TEXT,
    "categorias" "CategoriaInsumo"[],
    "formasPagamentoAceitas" "FormaPagamento"[],
    "prazoPagamentoDias" INTEGER,
    "prazoEntregaMedioDias" INTEGER,
    "pedidoMinimoValor" DECIMAL(12,2),
    "notaQualidade" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" "CategoriaInsumo" NOT NULL,
    "unidadeCompra" "UnidadeMedida" NOT NULL,
    "unidadeUso" "UnidadeMedida" NOT NULL,
    "fatorConversao" DECIMAL(12,4) NOT NULL DEFAULT 1,
    "perecivel" BOOLEAN NOT NULL DEFAULT false,
    "validadePadraoDias" INTEGER,
    "estoqueMinimo" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "estoqueMaximo" DECIMAL(12,3),
    "custoMedio" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "fornecedorPrincipalId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompra" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "dataPedido" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previsaoEntrega" TIMESTAMP(3),
    "status" "StatusPedidoCompra" NOT NULL DEFAULT 'RASCUNHO',
    "observacoes" TEXT,
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompraItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "precoUnitario" DECIMAL(12,4) NOT NULL,
    "precoTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PedidoCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoCompraAnexo" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "tipo" "TipoAnexoPedido" NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoCompraAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cotacao" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "precoUnitario" DECIMAL(12,4) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cotacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recebimento" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "dataRecebimento" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "responsavelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecebimentoItem" (
    "id" TEXT NOT NULL,
    "recebimentoId" TEXT NOT NULL,
    "pedidoItemId" TEXT NOT NULL,
    "quantidadeRecebida" DECIMAL(12,3) NOT NULL,
    "lote" TEXT,
    "validade" TIMESTAMP(3),
    "qualidadeOk" BOOLEAN NOT NULL DEFAULT true,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecebimentoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecebimentoDivergencia" (
    "id" TEXT NOT NULL,
    "recebimentoItemId" TEXT NOT NULL,
    "tipo" "TipoDivergencia" NOT NULL,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecebimentoDivergencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaldoEstoque" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "quantidadeAtual" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaldoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentacaoEstoque" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "tipo" "TipoMovimentacaoEstoque" NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "origemRecebimentoItemId" TEXT,
    "origemPerdaId" TEXT,
    "observacao" TEXT,
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentacaoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perda" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "motivo" "MotivoPerda" NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "valorEstimado" DECIMAL(12,2) NOT NULL,
    "observacao" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responsavelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Perda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventarioContagem" (
    "id" TEXT NOT NULL,
    "localId" TEXT NOT NULL,
    "dataContagem" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusContagem" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "responsavelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventarioContagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventarioItem" (
    "id" TEXT NOT NULL,
    "contagemId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidadeSistema" DECIMAL(12,3) NOT NULL,
    "quantidadeContada" DECIMAL(12,3) NOT NULL,
    "ajustado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventarioItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LocalEstoque_nome_key" ON "LocalEstoque"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "Fornecedor_cnpj_key" ON "Fornecedor"("cnpj");

-- CreateIndex
CREATE INDEX "Insumo_categoria_idx" ON "Insumo"("categoria");

-- CreateIndex
CREATE UNIQUE INDEX "PedidoCompra_numero_key" ON "PedidoCompra"("numero");

-- CreateIndex
CREATE INDEX "PedidoCompraItem_pedidoId_idx" ON "PedidoCompraItem"("pedidoId");

-- CreateIndex
CREATE INDEX "PedidoCompraItem_insumoId_idx" ON "PedidoCompraItem"("insumoId");

-- CreateIndex
CREATE INDEX "Cotacao_insumoId_idx" ON "Cotacao"("insumoId");

-- CreateIndex
CREATE INDEX "Cotacao_fornecedorId_idx" ON "Cotacao"("fornecedorId");

-- CreateIndex
CREATE INDEX "RecebimentoItem_recebimentoId_idx" ON "RecebimentoItem"("recebimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoEstoque_insumoId_localId_key" ON "SaldoEstoque"("insumoId", "localId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoEstoque_origemRecebimentoItemId_key" ON "MovimentacaoEstoque"("origemRecebimentoItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentacaoEstoque_origemPerdaId_key" ON "MovimentacaoEstoque"("origemPerdaId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_insumoId_idx" ON "MovimentacaoEstoque"("insumoId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_localId_idx" ON "MovimentacaoEstoque"("localId");

-- CreateIndex
CREATE INDEX "MovimentacaoEstoque_tipo_idx" ON "MovimentacaoEstoque"("tipo");

-- CreateIndex
CREATE INDEX "Perda_insumoId_idx" ON "Perda"("insumoId");

-- CreateIndex
CREATE INDEX "Perda_motivo_idx" ON "Perda"("motivo");

-- CreateIndex
CREATE INDEX "InventarioItem_contagemId_idx" ON "InventarioItem"("contagemId");

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_fornecedorPrincipalId_fkey" FOREIGN KEY ("fornecedorPrincipalId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompra" ADD CONSTRAINT "PedidoCompra_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompraItem" ADD CONSTRAINT "PedidoCompraItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompraItem" ADD CONSTRAINT "PedidoCompraItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoCompraAnexo" ADD CONSTRAINT "PedidoCompraAnexo_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotacao" ADD CONSTRAINT "Cotacao_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cotacao" ADD CONSTRAINT "Cotacao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "PedidoCompra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecebimentoItem" ADD CONSTRAINT "RecebimentoItem_recebimentoId_fkey" FOREIGN KEY ("recebimentoId") REFERENCES "Recebimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecebimentoItem" ADD CONSTRAINT "RecebimentoItem_pedidoItemId_fkey" FOREIGN KEY ("pedidoItemId") REFERENCES "PedidoCompraItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecebimentoDivergencia" ADD CONSTRAINT "RecebimentoDivergencia_recebimentoItemId_fkey" FOREIGN KEY ("recebimentoItemId") REFERENCES "RecebimentoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEstoque" ADD CONSTRAINT "SaldoEstoque_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEstoque" ADD CONSTRAINT "SaldoEstoque_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_origemRecebimentoItemId_fkey" FOREIGN KEY ("origemRecebimentoItemId") REFERENCES "RecebimentoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_origemPerdaId_fkey" FOREIGN KEY ("origemPerdaId") REFERENCES "Perda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentacaoEstoque" ADD CONSTRAINT "MovimentacaoEstoque_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perda" ADD CONSTRAINT "Perda_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perda" ADD CONSTRAINT "Perda_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perda" ADD CONSTRAINT "Perda_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioContagem" ADD CONSTRAINT "InventarioContagem_localId_fkey" FOREIGN KEY ("localId") REFERENCES "LocalEstoque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioContagem" ADD CONSTRAINT "InventarioContagem_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioItem" ADD CONSTRAINT "InventarioItem_contagemId_fkey" FOREIGN KEY ("contagemId") REFERENCES "InventarioContagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventarioItem" ADD CONSTRAINT "InventarioItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
