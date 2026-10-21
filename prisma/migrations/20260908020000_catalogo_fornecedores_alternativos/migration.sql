-- Novos valores de UnidadeMedida usados na planilha de importação
ALTER TYPE "UnidadeMedida" ADD VALUE 'ROLO';
ALTER TYPE "UnidadeMedida" ADD VALUE 'MACO';
ALTER TYPE "UnidadeMedida" ADD VALUE 'CACHO';
ALTER TYPE "UnidadeMedida" ADD VALUE 'PORCAO';
ALTER TYPE "UnidadeMedida" ADD VALUE 'METADE';

-- Tipo de estoque (Seco/Refrigerado/Congelado) do Insumo
CREATE TYPE "TipoEstoque" AS ENUM ('SECO', 'REFRIGERADO', 'CONGELADO');

-- Fornecedor: razaoSocial e cnpj deixam de ser obrigatórios (muitos
-- fornecedores reais não têm CNPJ cadastrado no sistema ainda)
ALTER TABLE "Fornecedor" ALTER COLUMN "razaoSocial" DROP NOT NULL;
ALTER TABLE "Fornecedor" ALTER COLUMN "cnpj" DROP NOT NULL;

-- Insumo: tipo de estoque + observações livres
ALTER TABLE "Insumo" ADD COLUMN "tipoEstoque" "TipoEstoque";
ALTER TABLE "Insumo" ADD COLUMN "observacoes" TEXT;

-- Fornecedores homologados (alternativos) de um Insumo, além do principal
CREATE TABLE "InsumoFornecedor" (
    "id" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "fornecedorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsumoFornecedor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InsumoFornecedor_insumoId_fornecedorId_key" ON "InsumoFornecedor"("insumoId", "fornecedorId");
CREATE INDEX "InsumoFornecedor_fornecedorId_idx" ON "InsumoFornecedor"("fornecedorId");

ALTER TABLE "InsumoFornecedor" ADD CONSTRAINT "InsumoFornecedor_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsumoFornecedor" ADD CONSTRAINT "InsumoFornecedor_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
