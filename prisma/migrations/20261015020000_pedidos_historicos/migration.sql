-- Histórico comercial segregado: não modifica pedidos, cadastros ou saldos existentes.
-- As whitelists anteriores permanecem completas. A troca dos CHECKs é atômica.
BEGIN;

ALTER TABLE "IdentidadeExternaVenda" DROP CONSTRAINT "IdentidadeExternaVenda_entidade_check";
ALTER TABLE "IdentidadeExternaVenda" ADD CONSTRAINT "IdentidadeExternaVenda_entidade_check"
  CHECK ("entidade" IN ('CATEGORIA','GRUPO','OPCAO','PRODUTO','CLIENTE_HISTORICO','PRODUTO_HISTORICO','PEDIDO_HISTORICO'));
ALTER TABLE "IdentidadeExternaVenda" ADD CONSTRAINT "IdentidadeExternaVenda_historico_origem_check"
  CHECK ("entidade" NOT IN ('CLIENTE_HISTORICO','PRODUTO_HISTORICO','PEDIDO_HISTORICO') OR
    ("origem" = 'grazing-legado-orders' AND "loja" = 'grazing-hub'));

ALTER TABLE "PedidoVenda" DROP CONSTRAINT "PedidoVenda_status_check";
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_status_check"
  CHECK ("status" IN ('RASCUNHO','CONFIRMADO','CANCELADO','DECLINADO','ESTORNADO','RECEBIDO_EXTERNO','HISTORICO','HISTORICO_REVERTIDO'));
ALTER TABLE "PedidoVenda" DROP CONSTRAINT "PedidoVenda_statusOperacional_check";
ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_statusOperacional_check"
  CHECK ("statusOperacional" IN ('PENDENTE','EM_PREPARO','PRONTO','EM_ENTREGA','ENTREGUE','INTERROMPIDO','HISTORICO','HISTORICO_REVERTIDO'));

ALTER TABLE "PedidoVenda" ADD CONSTRAINT "PedidoVenda_historico_consistente_check" CHECK (
  CASE WHEN "origem" = 'HISTORICO_LEGADO' OR "referenciaOrigem" = 'grazing-legado-orders'
      OR "status" IN ('HISTORICO','HISTORICO_REVERTIDO') OR "statusOperacional" IN ('HISTORICO','HISTORICO_REVERTIDO') THEN
    "origem" = 'HISTORICO_LEGADO'
    AND "referenciaOrigem" IS NOT DISTINCT FROM 'grazing-legado-orders'
    AND "referenciaEstabelecimento" IS NOT DISTINCT FROM 'grazing-hub'
    AND "referenciaPedido" IS NOT NULL AND "referenciaPedido" ~ '^[0-9]+$'
    AND "numero" < 0 AND "numero"::numeric = -"referenciaPedido"::numeric
    AND "modoFinanceiro" = 'EXTERNO' AND "versaoFinanceiro" = 0
    AND "status" IN ('HISTORICO','HISTORICO_REVERTIDO') AND "statusOperacional" = "status"
    AND "confirmadoEm" IS NULL AND "entregueEm" IS NULL AND "canceladoEm" IS NULL
    AND "atendimento" IS NULL AND "prazo" IS NULL AND "previsaoData" IS NULL AND "previsaoJanela" IS NULL
    AND "enderecoSnapshot" IS NULL AND "pagamentoInformadoSnapshot" IS NULL
    AND "custoEntregaEstimado" IS NULL AND "custoEntregaEfetivo" IS NULL AND "prestadorEntregaId" IS NULL
  ELSE true END
);

CREATE FUNCTION impedir_conversao_pedido_historico() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE antigo_historico boolean; novo_historico boolean;
BEGIN
  antigo_historico := OLD."origem" = 'HISTORICO_LEGADO' OR OLD."referenciaOrigem" IS NOT DISTINCT FROM 'grazing-legado-orders';
  novo_historico := NEW."origem" = 'HISTORICO_LEGADO' OR NEW."referenciaOrigem" IS NOT DISTINCT FROM 'grazing-legado-orders';
  IF antigo_historico IS DISTINCT FROM novo_historico OR antigo_historico AND (
      OLD."numero" IS DISTINCT FROM NEW."numero" OR OLD."referenciaOrigem" IS DISTINCT FROM NEW."referenciaOrigem"
      OR OLD."referenciaEstabelecimento" IS DISTINCT FROM NEW."referenciaEstabelecimento"
      OR OLD."referenciaPedido" IS DISTINCT FROM NEW."referenciaPedido") THEN
    RAISE EXCEPTION 'HISTORICO_IDENTIDADE_IMUTAVEL' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "PedidoVenda_historico_identidade" BEFORE UPDATE ON "PedidoVenda"
  FOR EACH ROW EXECUTE FUNCTION impedir_conversao_pedido_historico();

-- Defesa de relações: nenhum título, recebimento, reserva ou documento operacional
-- pode ser anexado ao histórico. A fonte de pagamento permanece somente no JSON.
CREATE FUNCTION impedir_efeito_pedido_historico() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE referencia text; pedido_id text;
BEGIN
  referencia := to_jsonb(NEW)->>TG_ARGV[0];
  pedido_id := referencia;
  IF TG_NARGS > 1 AND TG_ARGV[1] = 'ITEM' THEN
    SELECT "pedidoId" INTO pedido_id FROM "ItemPedidoVenda" WHERE "id" = referencia;
  ELSIF TG_NARGS > 1 AND TG_ARGV[1] = 'PAGAMENTO' THEN
    SELECT "pedidoId" INTO pedido_id FROM "PagamentoExternoPedido" WHERE "id" = referencia;
  END IF;
  IF pedido_id IS NOT NULL AND EXISTS (SELECT 1 FROM "PedidoVenda"
      WHERE "id" = pedido_id AND ("origem" = 'HISTORICO_LEGADO' OR "referenciaOrigem" = 'grazing-legado-orders')) THEN
    RAISE EXCEPTION 'HISTORICO_EFEITO_OPERACIONAL_BLOQUEADO' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LancamentoFinanceiro_historico_bloqueado" BEFORE INSERT OR UPDATE ON "LancamentoFinanceiro"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('pedidoVendaId');
CREATE TRIGGER "PagamentoExternoPedido_historico_bloqueado" BEFORE INSERT OR UPDATE ON "PagamentoExternoPedido"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('pedidoId');
CREATE TRIGGER "RepassePagamentoPedido_historico_bloqueado" BEFORE INSERT OR UPDATE ON "RepassePagamentoPedido"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('pagamentoId','PAGAMENTO');
CREATE TRIGGER "HistoricoFinanceiroPedido_historico_bloqueado" BEFORE INSERT OR UPDATE ON "HistoricoFinanceiroPedido"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('pedidoId');
CREATE TRIGGER "TratamentoFinanceiroPedido_historico_bloqueado" BEFORE INSERT OR UPDATE ON "TratamentoFinanceiroPedido"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('pedidoId');
CREATE TRIGGER "CreditoClienteMovimento_historico_bloqueado" BEFORE INSERT OR UPDATE ON "CreditoClienteMovimento"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('pedidoAplicacaoId');
CREATE TRIGGER "ReservaPedido_historico_bloqueado" BEFORE INSERT OR UPDATE ON "ReservaPedido"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('itemId','ITEM');
CREATE TRIGGER "DocumentoFiscalSaida_historico_bloqueado" BEFORE INSERT OR UPDATE ON "DocumentoFiscalSaida"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('pedidoId');
CREATE TRIGGER "VinculoCustoEntrega_historico_bloqueado" BEFORE INSERT OR UPDATE ON "VinculoCustoEntrega"
  FOR EACH ROW EXECUTE FUNCTION impedir_efeito_pedido_historico('pedidoId');

COMMIT;
