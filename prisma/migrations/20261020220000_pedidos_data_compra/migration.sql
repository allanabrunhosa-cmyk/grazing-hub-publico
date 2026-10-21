-- Campo civil aditivo. Não redata pedidos, títulos, pagamentos ou auditorias.
ALTER TABLE "PedidoVenda" ADD COLUMN "dataCompra" DATE;
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_dataCompra_intervalo"
  CHECK ("dataCompra" IS NULL OR "dataCompra" BETWEEN DATE '2000-01-01' AND DATE '2200-12-31');
CREATE INDEX "PedidoVenda_dataCompra_idx" ON "PedidoVenda"("dataCompra");

-- A origem de integrações e os registros já fechados não aceitam redatação local.
CREATE FUNCTION guardar_data_compra_pedido() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."dataCompra" IS NOT NULL AND (NEW.origem <> 'INTERNO' OR NEW.status <> 'RASCUNHO') THEN
      RAISE EXCEPTION 'PEDIDO_DATA_COMPRA_ORIGEM_INVALIDA' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."dataCompra" IS DISTINCT FROM OLD."dataCompra" THEN
    IF OLD.origem <> 'INTERNO' OR NEW.origem <> 'INTERNO' OR OLD.status <> 'RASCUNHO' OR NEW.status <> 'RASCUNHO' OR NEW."dataCompra" IS NULL THEN
      RAISE EXCEPTION 'PEDIDO_DATA_COMPRA_BLOQUEADA' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "PedidoVenda_guardar_data_compra"
  BEFORE INSERT OR UPDATE OF "dataCompra" ON "PedidoVenda"
  FOR EACH ROW EXECUTE FUNCTION guardar_data_compra_pedido();
