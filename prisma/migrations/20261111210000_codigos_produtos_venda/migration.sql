-- Registro de famílias e últimos códigos comerciais. Não altera contadores fiscais.
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "codigosProdutos" JSONB;
