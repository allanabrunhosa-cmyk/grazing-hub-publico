UPDATE "Fornecedor"
SET
  "nome" = UPPER(TRIM("nome")),
  "razaoSocial" = NULLIF(UPPER(TRIM("razaoSocial")), '');

UPDATE "LancamentoFinanceiro"
SET
  "descricao" = UPPER(TRIM("descricao")),
  "contraparteNome" = NULLIF(UPPER(TRIM("contraparteNome")), '');
