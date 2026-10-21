-- Novos usuários exigem habilitação manual em Validades.
-- Preserva todas as escolhas já gravadas nos usuários existentes.
ALTER TABLE "Usuario" ALTER COLUMN "responsavelEtiquetaHabilitado" SET DEFAULT false;
