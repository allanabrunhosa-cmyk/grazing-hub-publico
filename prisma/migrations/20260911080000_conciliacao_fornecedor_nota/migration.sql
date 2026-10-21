CREATE TABLE "FornecedorNotaVinculo" (
  "cnpj" TEXT NOT NULL,
  "fornecedorId" TEXT NOT NULL,
  "notaOrigemId" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "atualizacao" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FornecedorNotaVinculo_pkey" PRIMARY KEY ("cnpj"),
  CONSTRAINT "FornecedorNotaVinculo_fornecedorId_fkey" FOREIGN KEY ("fornecedorId")
    REFERENCES "Fornecedor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FornecedorNotaVinculo_fornecedorId_idx" ON "FornecedorNotaVinculo"("fornecedorId");
