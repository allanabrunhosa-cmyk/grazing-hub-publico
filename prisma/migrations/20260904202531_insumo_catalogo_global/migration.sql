/*
  Warnings:

  - You are about to drop the column `categoria` on the `Insumo` table. All the data in the column will be lost.
  - You are about to drop the column `fatorConversao` on the `Insumo` table. All the data in the column will be lost.
  - You are about to drop the column `unidadeCompra` on the `Insumo` table. All the data in the column will be lost.
  - You are about to drop the column `unidadeUso` on the `Insumo` table. All the data in the column will be lost.
  - Added the required column `unidade` to the `Insumo` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoProdutoGlobal" AS ENUM ('INSUMO', 'PRODUTO_INTERMEDIARIO');

-- DropIndex
DROP INDEX "Insumo_categoria_idx";

-- AlterTable
ALTER TABLE "Insumo" DROP COLUMN "categoria",
DROP COLUMN "fatorConversao",
DROP COLUMN "unidadeCompra",
DROP COLUMN "unidadeUso",
ADD COLUMN     "categoriaId" TEXT,
ADD COLUMN     "centroCustoId" TEXT,
ADD COLUMN     "codigoEan" TEXT,
ADD COLUMN     "fotoData" BYTEA,
ADD COLUMN     "fotoMimeType" TEXT,
ADD COLUMN     "marca" TEXT,
ADD COLUMN     "rendimentoQuantidade" DECIMAL(12,3),
ADD COLUMN     "rendimentoUnidade" "UnidadeMedida",
ADD COLUMN     "tipo" "TipoProdutoGlobal" NOT NULL DEFAULT 'INSUMO',
ADD COLUMN     "unidade" "UnidadeMedida" NOT NULL;

-- DropEnum
DROP TYPE "CategoriaInsumo";

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCusto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CentroCusto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComposicaoInsumo" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "componenteId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComposicaoInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_key" ON "Categoria"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "CentroCusto_nome_key" ON "CentroCusto"("nome");

-- CreateIndex
CREATE INDEX "ComposicaoInsumo_produtoId_idx" ON "ComposicaoInsumo"("produtoId");

-- CreateIndex
CREATE INDEX "ComposicaoInsumo_componenteId_idx" ON "ComposicaoInsumo"("componenteId");

-- CreateIndex
CREATE UNIQUE INDEX "ComposicaoInsumo_produtoId_componenteId_key" ON "ComposicaoInsumo"("produtoId", "componenteId");

-- CreateIndex
CREATE INDEX "Insumo_tipo_idx" ON "Insumo"("tipo");

-- CreateIndex
CREATE INDEX "Insumo_categoriaId_idx" ON "Insumo"("categoriaId");

-- CreateIndex
CREATE INDEX "Insumo_centroCustoId_idx" ON "Insumo"("centroCustoId");

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoInsumo" ADD CONSTRAINT "ComposicaoInsumo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComposicaoInsumo" ADD CONSTRAINT "ComposicaoInsumo_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
