-- Acrescenta a trilha técnica de reconciliação. Não altera registros existentes.
-- Preserva integralmente as entidades e as guardas históricas anteriores.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TABLE "IdentidadeExternaVenda" DROP CONSTRAINT "IdentidadeExternaVenda_entidade_check";
ALTER TABLE "IdentidadeExternaVenda" ADD CONSTRAINT "IdentidadeExternaVenda_entidade_check"
  CHECK ("entidade" IN ('CATEGORIA','GRUPO','OPCAO','PRODUTO','CLIENTE_HISTORICO','PRODUTO_HISTORICO','PEDIDO_HISTORICO','RECONCILIACAO_COBRANCAS'));
ALTER TABLE "IdentidadeExternaVenda" ADD CONSTRAINT "IdentidadeExternaVenda_reconciliacao_origem_check"
  CHECK ("entidade" <> 'RECONCILIACAO_COBRANCAS' OR
    ("origem" = 'MANUTENCAO_CLIENTES_V1' AND "loja" = 'grazing-hub'));

COMMIT;
