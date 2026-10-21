-- Embalagens informadas na revisão de insumos. Valores antigos são preservados.
ALTER TYPE "UnidadeMedida" ADD VALUE IF NOT EXISTS 'BALDE';
ALTER TYPE "UnidadeMedida" ADD VALUE IF NOT EXISTS 'GALAO';
ALTER TYPE "UnidadeMedida" ADD VALUE IF NOT EXISTS 'PECA';
ALTER TYPE "UnidadeMedida" ADD VALUE IF NOT EXISTS 'BAG';
ALTER TYPE "UnidadeMedida" ADD VALUE IF NOT EXISTS 'GARRAFA';
ALTER TYPE "UnidadeMedida" ADD VALUE IF NOT EXISTS 'LATA';
