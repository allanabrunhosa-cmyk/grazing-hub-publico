-- Limites comerciais opcionais. NULL preserva o comportamento dos cadastros anteriores.
ALTER TABLE "ClienteVenda"
  ADD COLUMN "formasPagamentoHabilitadas" JSONB,
  ADD COLUMN "boletoDiasAposEntrega" INTEGER,
  ADD COLUMN "limiteCreditoAberto" DECIMAL(12,2),
  ADD CONSTRAINT "ClienteVenda_boletoDiasAposEntrega_check" CHECK ("boletoDiasAposEntrega" BETWEEN 0 AND 3650),
  ADD CONSTRAINT "ClienteVenda_limiteCreditoAberto_check" CHECK ("limiteCreditoAberto" >= 0),
  ADD CONSTRAINT "ClienteVenda_formasPagamentoHabilitadas_check" CHECK (jsonb_typeof("formasPagamentoHabilitadas") = 'array');
