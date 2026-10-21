/*
  Warnings:

  - You are about to drop the column `categorias` on the `Fornecedor` table. All the data in the column will be lost.
  - You are about to drop the column `contatoEmail` on the `Fornecedor` table. All the data in the column will be lost.
  - You are about to drop the column `contatoTelefone` on the `Fornecedor` table. All the data in the column will be lost.
  - You are about to drop the column `formasPagamentoAceitas` on the `Fornecedor` table. All the data in the column will be lost.
  - You are about to drop the column `nomeFantasia` on the `Fornecedor` table. All the data in the column will be lost.
  - You are about to drop the column `notaQualidade` on the `Fornecedor` table. All the data in the column will be lost.
  - You are about to drop the column `pedidoMinimoValor` on the `Fornecedor` table. All the data in the column will be lost.
  - You are about to drop the column `prazoEntregaMedioDias` on the `Fornecedor` table. All the data in the column will be lost.
  - Added the required column `nome` to the `Fornecedor` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Fornecedor" DROP COLUMN "categorias",
DROP COLUMN "contatoEmail",
DROP COLUMN "contatoTelefone",
DROP COLUMN "formasPagamentoAceitas",
DROP COLUMN "nomeFantasia",
DROP COLUMN "notaQualidade",
DROP COLUMN "pedidoMinimoValor",
DROP COLUMN "prazoEntregaMedioDias",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "nome" TEXT NOT NULL,
ADD COLUMN     "observacoes" TEXT,
ADD COLUMN     "prazoEntregaDias" INTEGER,
ADD COLUMN     "site" TEXT,
ADD COLUMN     "telefone" TEXT;

-- DropEnum
DROP TYPE "FormaPagamento";

-- CreateTable
CREATE TABLE "CanalPedido" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanalPedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormaPagamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormaPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CanalPedidoToFornecedor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CanalPedidoToFornecedor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_FormaPagamentoToFornecedor" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FormaPagamentoToFornecedor_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "CanalPedido_nome_key" ON "CanalPedido"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "FormaPagamento_nome_key" ON "FormaPagamento"("nome");

-- CreateIndex
CREATE INDEX "_CanalPedidoToFornecedor_B_index" ON "_CanalPedidoToFornecedor"("B");

-- CreateIndex
CREATE INDEX "_FormaPagamentoToFornecedor_B_index" ON "_FormaPagamentoToFornecedor"("B");

-- AddForeignKey
ALTER TABLE "_CanalPedidoToFornecedor" ADD CONSTRAINT "_CanalPedidoToFornecedor_A_fkey" FOREIGN KEY ("A") REFERENCES "CanalPedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CanalPedidoToFornecedor" ADD CONSTRAINT "_CanalPedidoToFornecedor_B_fkey" FOREIGN KEY ("B") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormaPagamentoToFornecedor" ADD CONSTRAINT "_FormaPagamentoToFornecedor_A_fkey" FOREIGN KEY ("A") REFERENCES "FormaPagamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormaPagamentoToFornecedor" ADD CONSTRAINT "_FormaPagamentoToFornecedor_B_fkey" FOREIGN KEY ("B") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
