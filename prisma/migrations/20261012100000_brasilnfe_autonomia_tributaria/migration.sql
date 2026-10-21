-- Manual/aditiva. Sem reescrita de versões, sem aplicação produtiva nesta tarefa.
ALTER TABLE "VersaoRegraFiscalBrasilNfe"
  ALTER COLUMN "referenciaConfirp" DROP NOT NULL,
  ADD COLUMN "fundamentacaoFiscal" JSONB,
  ADD COLUMN "fundamentacaoHash" TEXT,
  ADD COLUMN "autorNome" TEXT,
  ADD COLUMN "aprovacaoInterna" JSONB,
  ADD COLUMN "aprovacaoHash" TEXT;

ALTER TABLE "VersaoRegraFiscalBrasilNfe" DROP CONSTRAINT "VersaoRegraFiscalBrasilNfe_estado_check";
ALTER TABLE "VersaoRegraFiscalBrasilNfe" ADD CONSTRAINT "VersaoRegraFiscalBrasilNfe_estado_check" CHECK (
  "estado" IN ('RASCUNHO', 'PROPOSTA', 'EM_REVISAO', 'APROVADA', 'BLOQUEADA', 'INATIVA') AND "revisao" > 0 AND
  ("referenciaConfirp" IS NULL OR length("referenciaConfirp") BETWEEN 1 AND 100) AND
  "vigenteDesde" ~ '^\d{4}-\d{2}-\d{2}$' AND
  ("vigenteAte" IS NULL OR ("vigenteAte" ~ '^\d{4}-\d{2}-\d{2}$' AND "vigenteAte" >= "vigenteDesde")) AND
  ("versaoCadastro" IS NULL OR "versaoCadastro" > 0) AND
  "emitenteHash" ~ '^[a-f0-9]{64}$' AND "conteudoHash" ~ '^[a-f0-9]{64}$' AND
  ("fiscalCadastroHash" IS NULL OR "fiscalCadastroHash" ~ '^[a-f0-9]{64}$') AND jsonb_typeof("conteudo") = 'object'
);
ALTER TABLE "VersaoRegraFiscalBrasilNfe" ADD CONSTRAINT "VersaoRegraFiscalBrasilNfe_fundamentacao_check" CHECK (COALESCE((
  -- Legado preservado como legado, inclusive aprovações antigas, sem falsa conversão.
  ("fundamentacaoFiscal" IS NULL AND "fundamentacaoHash" IS NULL AND "aprovacaoInterna" IS NULL AND "aprovacaoHash" IS NULL AND "referenciaConfirp" IS NOT NULL AND "estado" IN ('RASCUNHO', 'APROVADA', 'INATIVA')) OR
  ("referenciaConfirp" IS NULL AND "estado" <> 'RASCUNHO' AND "fundamentacaoFiscal" IS NOT NULL AND jsonb_typeof("fundamentacaoFiscal") = 'object' AND
   "fundamentacaoFiscal"->>'versao' = '1' AND "fundamentacaoHash" IS NOT NULL AND "fundamentacaoHash" ~ '^[a-f0-9]{64}$' AND "autorNome" IS NOT NULL AND length("autorNome") BETWEEN 1 AND 200 AND
   (("estado" = 'APROVADA' AND "aprovacaoInterna" IS NOT NULL AND jsonb_typeof("aprovacaoInterna") = 'object' AND "aprovacaoInterna"->>'tipo' = 'APROVACAO_INTERNA' AND "aprovacaoHash" IS NOT NULL AND "aprovacaoHash" ~ '^[a-f0-9]{64}$') OR
    ("estado" <> 'APROVADA' AND "aprovacaoInterna" IS NULL AND "aprovacaoHash" IS NULL)))
), FALSE));
-- Triggers de imutabilidade existentes continuam ativos. Nenhum UPDATE de dados anteriores.
