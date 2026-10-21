-- Aditiva: não transforma nem liquida despesas existentes. IDs gerados pela aplicação.
ALTER TABLE "CartaoCredito"
  ADD COLUMN "emissor" TEXT, ADD COLUMN "bandeira" TEXT,
  ADD COLUMN "final" VARCHAR(4), ADD COLUMN "limite" DECIMAL(14,2),
  ADD COLUMN "observacoes" TEXT, ADD COLUMN "responsavelId" TEXT,
  ADD COLUMN "toleranciaDias" INTEGER NOT NULL DEFAULT 5,
  ADD CONSTRAINT "CartaoCredito_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CartaoCredito_final_check" CHECK ("final" IS NULL OR "final" ~ '^[0-9]{4}$'),
  ADD CONSTRAINT "CartaoCredito_limite_check" CHECK ("limite" IS NULL OR "limite" >= 0),
  ADD CONSTRAINT "CartaoCredito_tolerancia_check" CHECK ("toleranciaDias" BETWEEN 0 AND 31);

CREATE TABLE "FaturaCartao" (
  "id" TEXT PRIMARY KEY, "cartaoId" TEXT NOT NULL, "competencia" VARCHAR(7) NOT NULL,
  "inicio" DATE NOT NULL, "fim" DATE NOT NULL, "fechamento" DATE NOT NULL, "vencimento" DATE NOT NULL,
  "totalInformado" DECIMAL(14,2) NOT NULL, "estado" TEXT NOT NULL DEFAULT 'REVISAO',
  "versao" INTEGER NOT NULL DEFAULT 1, "canceladaEm" TIMESTAMP(3),
  "autorId" TEXT NOT NULL, "autorNome" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FaturaCartao_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "CartaoCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK ("competencia" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), CHECK ("inicio" <= "fim"), CHECK ("versao" > 0)
);
CREATE UNIQUE INDEX "FaturaCartao_cartaoId_competencia_key" ON "FaturaCartao"("cartaoId","competencia");
CREATE INDEX "FaturaCartao_vencimento_estado_idx" ON "FaturaCartao"("vencimento","estado");

CREATE TABLE "ArquivoFaturaCartao" (
  "id" TEXT PRIMARY KEY, "faturaId" TEXT NOT NULL, "nome" TEXT NOT NULL, "hash" TEXT NOT NULL,
  "formato" TEXT NOT NULL, "dados" BYTEA NOT NULL, "autorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArquivoFaturaCartao_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "FaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ArquivoFaturaCartao_faturaId_hash_key" ON "ArquivoFaturaCartao"("faturaId","hash");

CREATE TABLE "ParcelamentoCartao" (
  "id" TEXT PRIMARY KEY, "cartaoId" TEXT NOT NULL, "chave" TEXT NOT NULL, "descricao" TEXT NOT NULL,
  "totalParcelas" INTEGER NOT NULL CHECK ("totalParcelas" BETWEEN 2 AND 120),
  "valorCompraInformado" DECIMAL(14,2), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ParcelamentoCartao_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "CartaoCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ParcelamentoCartao_cartaoId_chave_key" ON "ParcelamentoCartao"("cartaoId","chave");

CREATE TABLE "RegraCartao" (
  "id" TEXT PRIMARY KEY, "nome" TEXT NOT NULL, "texto" TEXT NOT NULL, "modo" TEXT NOT NULL DEFAULT 'EXATO',
  "prioridade" INTEGER NOT NULL DEFAULT 0, "cartaoId" TEXT, "tipo" TEXT,
  "valorMinimo" DECIMAL(14,2), "valorMaximo" DECIMAL(14,2), "fornecedorId" TEXT, "categoriaId" TEXT NOT NULL,
  "centroCustoId" TEXT, "ativa" BOOLEAN NOT NULL DEFAULT TRUE, "versao" INTEGER NOT NULL DEFAULT 1,
  "origem" TEXT NOT NULL DEFAULT 'EXPLICITA', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegraCartao_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "CartaoCredito"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RegraCartao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RegraCartao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RegraCartao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK ("modo" IN ('EXATO','CONTEM')), CHECK ("versao" > 0),
  CHECK ("valorMinimo" IS NULL OR "valorMaximo" IS NULL OR "valorMinimo" <= "valorMaximo")
);
CREATE INDEX "RegraCartao_ativa_cartaoId_prioridade_idx" ON "RegraCartao"("ativa","cartaoId","prioridade");

CREATE TABLE "ItemFaturaCartao" (
  "id" TEXT PRIMARY KEY, "faturaId" TEXT NOT NULL, "arquivoId" TEXT NOT NULL, "linha" INTEGER NOT NULL,
  "identidade" TEXT NOT NULL, "textoOriginal" TEXT NOT NULL, "descricaoOriginal" TEXT NOT NULL,
  "descricaoNormalizada" TEXT NOT NULL, "estabelecimentoOriginal" TEXT NOT NULL, "estabelecimentoNormalizado" TEXT NOT NULL,
  "valorOriginal" DECIMAL(14,2) NOT NULL, "valor" DECIMAL(14,2) NOT NULL, "moeda" TEXT NOT NULL DEFAULT 'BRL',
  "dataCompra" DATE NOT NULL, "dataApresentacao" DATE, "dataCompetencia" DATE NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'COMPRA', "parcela" INTEGER NOT NULL DEFAULT 1, "totalParcelas" INTEGER NOT NULL DEFAULT 1,
  "parcelamentoId" TEXT, "estornoDeId" TEXT, "fornecedorId" TEXT, "categoriaId" TEXT, "centroCustoId" TEXT,
  "responsavelId" TEXT, "portadorOriginal" TEXT, "documento" TEXT, "estado" TEXT NOT NULL DEFAULT 'REVISAR',
  "sugestao" JSONB, "regraId" TEXT, "observacoes" TEXT, "revisado" BOOLEAN NOT NULL DEFAULT FALSE,
  "ignoradoEm" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ItemFaturaCartao_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "FaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemFaturaCartao_arquivoId_fkey" FOREIGN KEY ("arquivoId") REFERENCES "ArquivoFaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemFaturaCartao_parcelamentoId_fkey" FOREIGN KEY ("parcelamentoId") REFERENCES "ParcelamentoCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemFaturaCartao_estornoDeId_fkey" FOREIGN KEY ("estornoDeId") REFERENCES "ItemFaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemFaturaCartao_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemFaturaCartao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "CategoriaFinanceira"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemFaturaCartao_centroCustoId_fkey" FOREIGN KEY ("centroCustoId") REFERENCES "CentroCusto"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemFaturaCartao_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ItemFaturaCartao_regraId_fkey" FOREIGN KEY ("regraId") REFERENCES "RegraCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK ("parcela" BETWEEN 1 AND "totalParcelas" AND "totalParcelas" <= 120), CHECK ("linha" > 0), CHECK ("moeda" = 'BRL'),
  CHECK ("valor" <> 0), CHECK ("estornoDeId" IS NULL OR "estornoDeId" <> "id")
);
CREATE UNIQUE INDEX "ItemFaturaCartao_faturaId_identidade_key" ON "ItemFaturaCartao"("faturaId","identidade");
CREATE UNIQUE INDEX "ItemFaturaCartao_arquivoId_linha_key" ON "ItemFaturaCartao"("arquivoId","linha");
CREATE INDEX "ItemFaturaCartao_faturaId_estado_dataCompra_idx" ON "ItemFaturaCartao"("faturaId","estado","dataCompra");
CREATE INDEX "ItemFaturaCartao_estabelecimentoNormalizado_dataCompra_idx" ON "ItemFaturaCartao"("estabelecimentoNormalizado","dataCompra");
CREATE INDEX "ItemFaturaCartao_parcelamentoId_parcela_idx" ON "ItemFaturaCartao"("parcelamentoId","parcela");
CREATE INDEX "ItemFaturaCartao_fornecedorId_idx" ON "ItemFaturaCartao"("fornecedorId");

ALTER TABLE "LancamentoFinanceiro" ADD COLUMN "itemFaturaId" TEXT,
  ADD CONSTRAINT "LancamentoFinanceiro_itemFaturaId_fkey" FOREIGN KEY ("itemFaturaId") REFERENCES "ItemFaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "LancamentoFinanceiro_itemFaturaId_idx" ON "LancamentoFinanceiro"("itemFaturaId");
CREATE INDEX "LancamentoFinanceiro_cartaoCreditoId_dataVencimento_idx" ON "LancamentoFinanceiro"("cartaoCreditoId","dataVencimento");

CREATE TABLE "PagamentoFaturaCartao" (
  "id" TEXT PRIMARY KEY, "faturaId" TEXT NOT NULL, "transacaoId" TEXT, "movimentoId" TEXT,
  "valor" DECIMAL(14,2) NOT NULL CHECK ("valor" > 0), "data" DATE NOT NULL,
  "contaIdOriginal" TEXT NOT NULL, "transacaoIdOriginal" TEXT NOT NULL,
  "autorId" TEXT NOT NULL, "autorNome" TEXT NOT NULL, "revertidoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PagamentoFaturaCartao_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "FaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PagamentoFaturaCartao_transacaoId_fkey" FOREIGN KEY ("transacaoId") REFERENCES "TransacaoExtrato"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PagamentoFaturaCartao_movimentoId_fkey" FOREIGN KEY ("movimentoId") REFERENCES "MovimentacaoBancaria"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK (("revertidoEm" IS NULL AND "transacaoId" IS NOT NULL AND "movimentoId" IS NOT NULL) OR "revertidoEm" IS NOT NULL)
);
CREATE UNIQUE INDEX "PagamentoFaturaCartao_transacaoId_key" ON "PagamentoFaturaCartao"("transacaoId");
CREATE UNIQUE INDEX "PagamentoFaturaCartao_movimentoId_key" ON "PagamentoFaturaCartao"("movimentoId");
CREATE INDEX "PagamentoFaturaCartao_faturaId_revertidoEm_data_idx" ON "PagamentoFaturaCartao"("faturaId","revertidoEm","data");
CREATE TABLE "LiquidacaoCartao" (
  "id" TEXT PRIMARY KEY, "pagamentoId" TEXT NOT NULL, "lancamentoId" TEXT NOT NULL, "valor" DECIMAL(14,2) NOT NULL,
  CONSTRAINT "LiquidacaoCartao_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "PagamentoFaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LiquidacaoCartao_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "LancamentoFinanceiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LiquidacaoCartao_pagamentoId_lancamentoId_key" ON "LiquidacaoCartao"("pagamentoId","lancamentoId");
CREATE INDEX "LiquidacaoCartao_lancamentoId_idx" ON "LiquidacaoCartao"("lancamentoId");
CREATE TABLE "HistoricoCartao" (
  "id" TEXT PRIMARY KEY, "faturaId" TEXT, "alvoId" TEXT NOT NULL, "acao" TEXT NOT NULL,
  "autorId" TEXT NOT NULL, "autorNome" TEXT NOT NULL, "motivo" TEXT, "antes" JSONB, "depois" JSONB,
  "origem" TEXT NOT NULL DEFAULT 'HUB', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricoCartao_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "FaturaCartao"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "HistoricoCartao_faturaId_createdAt_idx" ON "HistoricoCartao"("faturaId","createdAt");
CREATE INDEX "HistoricoCartao_alvoId_createdAt_idx" ON "HistoricoCartao"("alvoId","createdAt");

-- Evidência nunca é regravada, inclusive em reprocessamentos e ajustes manuais.
CREATE FUNCTION preservar_original_fatura() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."textoOriginal", NEW."descricaoOriginal", NEW."estabelecimentoOriginal", NEW."valorOriginal", NEW."arquivoId", NEW."linha", NEW."identidade")
     IS DISTINCT FROM ROW(OLD."textoOriginal", OLD."descricaoOriginal", OLD."estabelecimentoOriginal", OLD."valorOriginal", OLD."arquivoId", OLD."linha", OLD."identidade") THEN
    RAISE EXCEPTION 'A evidência original da fatura é imutável';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ItemFaturaCartao_preservar_original" BEFORE UPDATE ON "ItemFaturaCartao" FOR EACH ROW EXECUTE FUNCTION preservar_original_fatura();
