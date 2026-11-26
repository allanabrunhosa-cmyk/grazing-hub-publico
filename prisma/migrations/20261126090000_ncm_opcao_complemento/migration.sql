-- Tipos de complemento do responsável (25/11/2026). Aditiva.
-- 1) O tipo Opção passa a ser aceito pelo banco: a lista de 22/09/2026 só previa três tipos.
ALTER TABLE "GrupoComplementoVenda" DROP CONSTRAINT "GrupoComplementoVenda_tipo_check";
ALTER TABLE "GrupoComplementoVenda" ADD CONSTRAINT "GrupoComplementoVenda_tipo_check"
  CHECK ("tipo" IN ('COMPOSICAO','OPCAO','EXTRAS','COMPLEMENTAR'));
-- 2) NCM do item quando o complemento é do tipo Opção: coluna opcional, sem reescrever linhas.
ALTER TABLE "OpcaoComplementoVenda" ADD COLUMN "ncm" TEXT;
