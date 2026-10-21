-- Ampliação aditiva de estados; não altera documentos ou migrations aplicadas.
-- Aplicar somente no banco local isolado até autorização de uma entrega produtiva.
BEGIN;
ALTER TABLE "DocumentoFiscalSaida" ADD CONSTRAINT "DocumentoFiscalSaida_estado_v2_check"
 CHECK ("status" IN ('SEM_EMISSOR','PREPARADO','PROCESSANDO','INCERTO','PENDENTE_CONFERENCIA','AUTORIZADO','REJEITADO','CANCELADO','DENEGADO'));
ALTER TABLE "DocumentoFiscalSaida" DROP CONSTRAINT "DocumentoFiscalSaida_estado_check";
COMMIT;
