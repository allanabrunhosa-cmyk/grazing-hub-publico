-- Aditiva. Não transforma cadastros, documentos, pedidos ou saldos existentes.
ALTER TABLE "ClienteVenda" ADD COLUMN "unificadoEmId" TEXT;
ALTER TABLE "ClienteVenda" ADD CONSTRAINT "ClienteVenda_unificadoEmId_fkey"
  FOREIGN KEY ("unificadoEmId") REFERENCES "ClienteVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClienteVenda" ADD CONSTRAINT "ClienteVenda_unificadoEmId_nao_proprio"
  CHECK ("unificadoEmId" IS NULL OR "unificadoEmId" <> "id");
CREATE INDEX "ClienteVenda_unificadoEmId_idx" ON "ClienteVenda"("unificadoEmId");

CREATE TABLE "ContatoClienteVenda" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  "clienteOrigemId" TEXT,
  "nome" TEXT NOT NULL,
  "primeiroNome" TEXT,
  "sobrenome" TEXT,
  "email" TEXT,
  "telefone" TEXT,
  "origem" TEXT NOT NULL,
  "chaveOrigem" TEXT NOT NULL,
  "proveniencia" JSONB NOT NULL DEFAULT '{}',
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContatoClienteVenda_clienteId_fkey" FOREIGN KEY ("clienteId")
    REFERENCES "ClienteVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContatoClienteVenda_clienteOrigemId_fkey" FOREIGN KEY ("clienteOrigemId")
    REFERENCES "ClienteVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ContatoClienteVenda_versao_positiva" CHECK ("versao" > 0),
  CONSTRAINT "ContatoClienteVenda_nome_limites" CHECK (length("nome") BETWEEN 1 AND 160),
  CONSTRAINT "ContatoClienteVenda_campos_limites" CHECK (
    length("primeiroNome") <= 160 AND length("sobrenome") <= 160 AND
    length("email") <= 254 AND length("telefone") <= 40 AND
    length("origem") BETWEEN 1 AND 100 AND length("chaveOrigem") BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX "ContatoClienteVenda_clienteId_origem_chaveOrigem_key"
  ON "ContatoClienteVenda"("clienteId", "origem", "chaveOrigem");
CREATE INDEX "ContatoClienteVenda_clienteOrigemId_idx" ON "ContatoClienteVenda"("clienteOrigemId");
