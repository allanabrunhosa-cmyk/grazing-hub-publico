-- Aditiva: nenhum saldo, custo ou movimento histórico é reescrito.
CREATE TABLE "EntradaAvulsaRegistro" (
  "id" TEXT PRIMARY KEY,
  "numero" SERIAL NOT NULL UNIQUE,
  "compraId" TEXT UNIQUE REFERENCES "EntradaAvulsaCompra"("id") ON DELETE RESTRICT,
  "movimentoLegadoId" TEXT UNIQUE REFERENCES "MovimentacaoEstoque"("id") ON DELETE RESTRICT,
  "tipo" TEXT NOT NULL CHECK ("tipo" IN ('COMPRA_SIMPLES','OUTRO_MOTIVO')),
  "dataEntrada" TIMESTAMP(3) NOT NULL,
  "criadoPorId" TEXT NOT NULL,
  "criadoPorNome" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "versao" INTEGER NOT NULL DEFAULT 1 CHECK ("versao" > 0),
  "chaveOperacao" TEXT NOT NULL UNIQUE,
  "hashOperacao" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "EntradaAvulsaVersao" (
  "id" TEXT PRIMARY KEY,
  "registroId" TEXT NOT NULL REFERENCES "EntradaAvulsaRegistro"("id") ON DELETE RESTRICT,
  "versao" INTEGER NOT NULL,
  "autorId" TEXT NOT NULL,
  "autorNome" TEXT NOT NULL,
  "antes" JSONB,
  "depois" JSONB NOT NULL,
  "diferencas" JSONB NOT NULL,
  "ajustes" JSONB NOT NULL,
  "chaveOperacao" TEXT NOT NULL UNIQUE,
  "hashOperacao" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("registroId", "versao")
);
ALTER TABLE "MovimentacaoEstoque" ADD COLUMN "entradaAvulsaRegistroId" TEXT REFERENCES "EntradaAvulsaRegistro"("id") ON DELETE RESTRICT;
CREATE INDEX "MovimentacaoEstoque_entradaAvulsaRegistroId_idx" ON "MovimentacaoEstoque"("entradaAvulsaRegistroId");
CREATE INDEX "EntradaAvulsaRegistro_dataEntrada_idx" ON "EntradaAvulsaRegistro"("dataEntrada");
CREATE INDEX "EntradaAvulsaRegistro_criadoPorId_idx" ON "EntradaAvulsaRegistro"("criadoPorId");
-- Versões constituem trilha permanente, inclusive contra exclusão acidental.
CREATE FUNCTION proteger_versao_entrada_avulsa() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Versões de entrada avulsa são imutáveis'; END;
$$;
CREATE TRIGGER "EntradaAvulsaVersao_imutavel" BEFORE UPDATE OR DELETE ON "EntradaAvulsaVersao"
FOR EACH ROW EXECUTE FUNCTION proteger_versao_entrada_avulsa();
