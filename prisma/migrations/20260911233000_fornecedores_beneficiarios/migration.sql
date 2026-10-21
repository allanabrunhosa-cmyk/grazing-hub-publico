-- Beneficiários compartilham a mesma contraparte dos lançamentos financeiros,
-- mas são separados dos fornecedores usados em compras e insumos.
CREATE TYPE "TipoCadastroFornecedor" AS ENUM ('FORNECEDOR', 'BENEFICIARIO');

ALTER TABLE "Fornecedor"
ADD COLUMN "tipoCadastro" "TipoCadastroFornecedor" NOT NULL DEFAULT 'FORNECEDOR',
ADD COLUMN "cpf" TEXT;

CREATE UNIQUE INDEX "Fornecedor_cpf_key" ON "Fornecedor"("cpf");
