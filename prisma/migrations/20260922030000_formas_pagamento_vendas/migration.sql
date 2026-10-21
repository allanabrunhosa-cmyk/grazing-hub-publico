-- Cadastro comercial isolado: não modifica formas de fornecedores nem lançamentos financeiros.
CREATE TABLE "FormaPagamentoVenda" (
  "id" TEXT PRIMARY KEY,
  "nome" TEXT NOT NULL UNIQUE,
  "tipo" TEXT NOT NULL,
  "taxaPercentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "taxaFixa" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "prazoDias" INTEGER NOT NULL DEFAULT 0,
  "inicioPrazo" TEXT NOT NULL DEFAULT 'PAGAMENTO',
  "contagemPrazo" TEXT NOT NULL DEFAULT 'CORRIDOS',
  "vencimentoFlexivel" BOOLEAN NOT NULL DEFAULT false,
  "permiteParcelamento" BOOLEAN NOT NULL DEFAULT false,
  "maximoParcelas" INTEGER NOT NULL DEFAULT 1,
  "faixasTaxa" JSONB NOT NULL DEFAULT '[]',
  "observacoes" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "versao" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FormaPagamentoVenda_tipo_check" CHECK ("tipo" IN ('BOLETO','PIX','CARTAO_CREDITO','CARTAO_DEBITO','VOUCHER','TRANSFERENCIA','DINHEIRO','OUTRO')),
  CONSTRAINT "FormaPagamentoVenda_taxas_check" CHECK ("taxaPercentual" BETWEEN 0 AND 100 AND "taxaFixa" >= 0),
  CONSTRAINT "FormaPagamentoVenda_prazo_check" CHECK ("prazoDias" BETWEEN 0 AND 3650 AND "inicioPrazo" IN ('VENDA','PAGAMENTO') AND "contagemPrazo" IN ('CORRIDOS','UTEIS')),
  CONSTRAINT "FormaPagamentoVenda_parcelas_check" CHECK ("maximoParcelas" BETWEEN 1 AND 120 AND ("permiteParcelamento" OR "maximoParcelas" = 1)),
  CONSTRAINT "FormaPagamentoVenda_faixas_check" CHECK (jsonb_typeof("faixasTaxa") = 'array')
);
CREATE INDEX "FormaPagamentoVenda_ativo_nome_idx" ON "FormaPagamentoVenda"("ativo","nome");

-- Valores da referência fornecida pelo usuário, sem aplicar a promoção datada de 2021.
INSERT INTO "FormaPagamentoVenda" ("id","nome","tipo","taxaPercentual","taxaFixa","prazoDias","inicioPrazo","contagemPrazo","permiteParcelamento","maximoParcelas","updatedAt") VALUES
  ('venda-boleto-bancario','Boleto bancário','BOLETO',0,1.79,1,'PAGAMENTO','UTEIS',false,1,CURRENT_TIMESTAMP),
  ('venda-cartao-credito','Cartão de crédito','CARTAO_CREDITO',2.49,0.49,32,'PAGAMENTO','CORRIDOS',true,21,CURRENT_TIMESTAMP),
  ('venda-cartao-debito','Cartão de débito','CARTAO_DEBITO',1.89,0.35,3,'PAGAMENTO','CORRIDOS',false,1,CURRENT_TIMESTAMP),
  ('venda-cartao-voucher','Cartão voucher','VOUCHER',3.59,0,15,'PAGAMENTO','CORRIDOS',false,1,CURRENT_TIMESTAMP),
  ('venda-pix-dinamico','Pix dinâmico','PIX',0,0.75,0,'PAGAMENTO','CORRIDOS',false,1,CURRENT_TIMESTAMP);
