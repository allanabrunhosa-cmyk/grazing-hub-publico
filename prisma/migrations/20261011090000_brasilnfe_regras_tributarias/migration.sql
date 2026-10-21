-- Aditiva/manual. Não aplicar em produção neste marco. Complementos, não uma nova fila.
CREATE TABLE "RegraFiscalBrasilNfe" (
  "id" TEXT NOT NULL, "lojaId" TEXT NOT NULL DEFAULT 'singleton',
  "modelo" INTEGER NOT NULL, "operacao" TEXT NOT NULL, "alvo" TEXT NOT NULL,
  "produtoId" TEXT, "grupoId" TEXT, "revisao" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RegraFiscalBrasilNfe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegraFiscalBrasilNfe_escopo_check" CHECK (
    "lojaId" = 'singleton' AND "revisao" >= 0 AND
    (("modelo" = 55 AND "operacao" = 'NF_E_VENDA') OR ("modelo" = 65 AND "operacao" = 'NFC_E_VENDA')) AND
    (("alvo" IN ('EMPRESA', 'OPERACAO') AND "produtoId" IS NULL AND "grupoId" IS NULL) OR
     ("alvo" = 'PRODUTO' AND "produtoId" IS NOT NULL AND "grupoId" IS NULL) OR
     ("alvo" = 'GRUPO' AND "grupoId" IS NOT NULL AND "produtoId" IS NULL))
  ),
  CONSTRAINT "RegraFiscalBrasilNfe_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "ConfiguracaoLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RegraFiscalBrasilNfe_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "ProdutoVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RegraFiscalBrasilNfe_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoFiscalVenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "RegraFiscalBrasilNfe_lojaId_modelo_operacao_alvo_idx" ON "RegraFiscalBrasilNfe"("lojaId", "modelo", "operacao", "alvo");
CREATE UNIQUE INDEX "RegraFiscalBrasilNfe_escopo_key" ON "RegraFiscalBrasilNfe"("lojaId", "modelo", "operacao", "alvo", COALESCE("produtoId", ''), COALESCE("grupoId", ''));

CREATE TABLE "VersaoRegraFiscalBrasilNfe" (
  "id" TEXT NOT NULL, "regraId" TEXT NOT NULL, "revisao" INTEGER NOT NULL,
  "estado" TEXT NOT NULL, "referenciaConfirp" TEXT NOT NULL,
  "vigenteDesde" VARCHAR(10) NOT NULL, "vigenteAte" VARCHAR(10),
  "responsavelId" TEXT NOT NULL, "emitenteHash" TEXT NOT NULL,
  "versaoCadastro" INTEGER, "fiscalCadastroHash" TEXT,
  "conteudo" JSONB NOT NULL, "conteudoHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VersaoRegraFiscalBrasilNfe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VersaoRegraFiscalBrasilNfe_estado_check" CHECK (
    "estado" IN ('RASCUNHO', 'APROVADA', 'INATIVA') AND "revisao" > 0 AND
    length("referenciaConfirp") BETWEEN 1 AND 100 AND
    "vigenteDesde" ~ '^\d{4}-\d{2}-\d{2}$' AND
    ("vigenteAte" IS NULL OR ("vigenteAte" ~ '^\d{4}-\d{2}-\d{2}$' AND "vigenteAte" >= "vigenteDesde")) AND
    ("versaoCadastro" IS NULL OR "versaoCadastro" > 0) AND
    "emitenteHash" ~ '^[a-f0-9]{64}$' AND "conteudoHash" ~ '^[a-f0-9]{64}$' AND
    ("fiscalCadastroHash" IS NULL OR "fiscalCadastroHash" ~ '^[a-f0-9]{64}$') AND jsonb_typeof("conteudo") = 'object'
  ),
  CONSTRAINT "VersaoRegraFiscalBrasilNfe_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "RegraFiscalBrasilNfe"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "VersaoRegraFiscalBrasilNfe_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "VersaoRegraFiscalBrasilNfe_regraId_revisao_key" ON "VersaoRegraFiscalBrasilNfe"("regraId", "revisao");
CREATE INDEX "VersaoRegraFiscalBrasilNfe_regraId_estado_vigenteDesde_idx" ON "VersaoRegraFiscalBrasilNfe"("regraId", "estado", "vigenteDesde");

CREATE TABLE "PlanoFiscalBrasilNfe" (
  "id" TEXT NOT NULL, "documentoId" TEXT NOT NULL, "modelo" INTEGER NOT NULL,
  "ambiente" TEXT NOT NULL DEFAULT 'HOMOLOGACAO', "hashPayload" TEXT NOT NULL,
  "revisaoPedido" INTEGER NOT NULL, "emitenteHash" TEXT NOT NULL,
  "parametros" JSONB NOT NULL, "parametrosHash" TEXT NOT NULL,
  "verificadoEm" VARCHAR(10) NOT NULL, "responsavelId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanoFiscalBrasilNfe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanoFiscalBrasilNfe_local_check" CHECK (
    "ambiente" = 'HOMOLOGACAO' AND "modelo" IN (55, 65) AND "revisaoPedido" > 0 AND
    "hashPayload" ~ '^[a-f0-9]{64}$' AND "parametrosHash" ~ '^[a-f0-9]{64}$' AND
    "emitenteHash" ~ '^[a-f0-9]{64}$' AND "verificadoEm" ~ '^\d{4}-\d{2}-\d{2}$' AND jsonb_typeof("parametros") = 'object'
  ),
  CONSTRAINT "PlanoFiscalBrasilNfe_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoFiscalSaida"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PlanoFiscalBrasilNfe_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlanoFiscalBrasilNfe_documentoId_key" ON "PlanoFiscalBrasilNfe"("documentoId");
CREATE TABLE "ItemPlanoFiscalBrasilNfe" (
  "id" TEXT NOT NULL, "planoId" TEXT NOT NULL, "papel" TEXT NOT NULL, "versaoId" TEXT NOT NULL,
  CONSTRAINT "ItemPlanoFiscalBrasilNfe_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ItemPlanoFiscalBrasilNfe_planoId_fkey" FOREIGN KEY ("planoId") REFERENCES "PlanoFiscalBrasilNfe"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemPlanoFiscalBrasilNfe_versaoId_fkey" FOREIGN KEY ("versaoId") REFERENCES "VersaoRegraFiscalBrasilNfe"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ItemPlanoFiscalBrasilNfe_planoId_papel_key" ON "ItemPlanoFiscalBrasilNfe"("planoId", "papel");

-- Histórico e complementos ligados a uma fotografia não podem ser reescritos/excluídos.
CREATE FUNCTION "bloquear_mutacao_complemento_brasilnfe"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Complemento fiscal Brasil NFe imutavel; registre uma nova versao.';
END;
$$;
CREATE TRIGGER "VersaoRegraFiscalBrasilNfe_imutavel" BEFORE UPDATE OR DELETE ON "VersaoRegraFiscalBrasilNfe" FOR EACH ROW EXECUTE FUNCTION "bloquear_mutacao_complemento_brasilnfe"();
CREATE TRIGGER "PlanoFiscalBrasilNfe_imutavel" BEFORE UPDATE OR DELETE ON "PlanoFiscalBrasilNfe" FOR EACH ROW EXECUTE FUNCTION "bloquear_mutacao_complemento_brasilnfe"();
CREATE TRIGGER "ItemPlanoFiscalBrasilNfe_imutavel" BEFORE UPDATE OR DELETE ON "ItemPlanoFiscalBrasilNfe" FOR EACH ROW EXECUTE FUNCTION "bloquear_mutacao_complemento_brasilnfe"();
