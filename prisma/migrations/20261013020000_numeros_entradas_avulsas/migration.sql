-- Identidade de apresentação do legado. Não altera quantidades, custos ou títulos.
BEGIN;
LOCK TABLE "EntradaAvulsaCompra", "MovimentacaoEstoque" IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE "NumeroEntradaAvulsaLegada" (
  "origem" TEXT PRIMARY KEY,
  "numero" INTEGER NOT NULL UNIQUE DEFAULT nextval('"EntradaAvulsaRegistro_numero_seq"')
);
INSERT INTO "NumeroEntradaAvulsaLegada" ("origem", "numero")
SELECT CASE WHEN "compraId" IS NOT NULL THEN 'compra:' || "compraId"
            ELSE 'movimento:' || "movimentoLegadoId" END, "numero"
FROM "EntradaAvulsaRegistro" WHERE "compraId" IS NOT NULL OR "movimentoLegadoId" IS NOT NULL;
INSERT INTO "NumeroEntradaAvulsaLegada" ("origem")
SELECT origem FROM (
  SELECT 'compra:' || id AS origem, "createdAt" AS data FROM "EntradaAvulsaCompra"
  UNION ALL
  SELECT 'movimento:' || id AS origem, "createdAt" AS data FROM "MovimentacaoEstoque"
  WHERE tipo = 'AJUSTE_ENTRADA' AND "entradaAvulsaCompraId" IS NULL
    AND "entradaAvulsaRegistroId" IS NULL AND "criadoPorId" IS NOT NULL
) fontes WHERE NOT EXISTS (SELECT 1 FROM "NumeroEntradaAvulsaLegada" n WHERE n.origem = fontes.origem)
ORDER BY data, origem;

-- Abrange origens ainda criadas por consumidores legados. A leitura não grava dados.
CREATE FUNCTION "numerar_origem_entrada_avulsa"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'EntradaAvulsaCompra' THEN
    INSERT INTO "NumeroEntradaAvulsaLegada" (origem) VALUES ('compra:' || NEW.id) ON CONFLICT (origem) DO NOTHING;
  ELSIF NEW.tipo = 'AJUSTE_ENTRADA' AND NEW."entradaAvulsaCompraId" IS NULL
    AND NEW."entradaAvulsaRegistroId" IS NULL AND NEW."criadoPorId" IS NOT NULL THEN
    INSERT INTO "NumeroEntradaAvulsaLegada" (origem) VALUES ('movimento:' || NEW.id) ON CONFLICT (origem) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "numero_entrada_compra" AFTER INSERT ON "EntradaAvulsaCompra"
FOR EACH ROW EXECUTE FUNCTION "numerar_origem_entrada_avulsa"();
CREATE TRIGGER "numero_entrada_manual" AFTER INSERT ON "MovimentacaoEstoque"
FOR EACH ROW EXECUTE FUNCTION "numerar_origem_entrada_avulsa"();
COMMIT;
