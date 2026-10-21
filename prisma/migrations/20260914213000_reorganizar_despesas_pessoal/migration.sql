BEGIN;

-- O grupo 05 passa a concentrar todas as despesas com pessoal. A operação bloqueia
-- as tabelas vinculadas para que nenhum lançamento seja criado no meio da reorganização.
LOCK TABLE "CategoriaFinanceira" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "LancamentoFinanceiro" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "NotaFiscalItem" IN SHARE ROW EXCLUSIVE MODE;

DO $reorganizar$
DECLARE
  categoria_pessoal_id TEXT := 'takeat-conta-3';
  origem RECORD;
  destino_id TEXT;
  categoria_redundante RECORD;
  instante TIMESTAMP(3) := CURRENT_TIMESTAMP;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "CategoriaFinanceira"
    WHERE id = categoria_pessoal_id
      AND grupo = 'DESPESAS_OPERACIONAIS'::"GrupoDre"
      AND "excluidoEm" IS NULL
  ) THEN
    RAISE EXCEPTION 'Categoria Despesas com pessoal de origem não encontrada.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "LancamentoFinanceiro" WHERE "categoriaId" = categoria_pessoal_id
    UNION ALL
    SELECT 1 FROM "NotaFiscalItem" WHERE "categoriaFinanceiraId" = categoria_pessoal_id
  ) THEN
    RAISE EXCEPTION 'A categoria agrupadora Despesas com pessoal possui vínculos diretos.';
  END IF;

  -- Cada subcategoria mantém seu próprio ID. Quando já existe a mesma categoria no
  -- grupo 05, somente os vínculos são reunidos no cadastro canônico e a duplicata é excluída.
  FOR origem IN
    SELECT id, nome
    FROM "CategoriaFinanceira"
    WHERE "paiId" = categoria_pessoal_id
      AND "excluidoEm" IS NULL
    ORDER BY id
    FOR UPDATE
  LOOP
    destino_id := NULL;

    IF origem.nome = 'Pró Labore' THEN
      SELECT id INTO destino_id
      FROM "CategoriaFinanceira"
      WHERE nome = 'Pró-labore'
        AND grupo = 'FOLHA_PAGAMENTO'::"GrupoDre"
        AND "paiId" IS NULL
        AND "excluidoEm" IS NULL
      LIMIT 1;
    ELSE
      SELECT id INTO destino_id
      FROM "CategoriaFinanceira"
      WHERE nome = origem.nome
        AND grupo = 'FOLHA_PAGAMENTO'::"GrupoDre"
        AND "paiId" IS NULL
        AND "excluidoEm" IS NULL
      LIMIT 1;
    END IF;

    IF destino_id IS NULL THEN
      UPDATE "CategoriaFinanceira"
      SET grupo = 'FOLHA_PAGAMENTO'::"GrupoDre", "paiId" = NULL
      WHERE id = origem.id;
    ELSE
      UPDATE "LancamentoFinanceiro"
      SET "categoriaId" = destino_id
      WHERE "categoriaId" = origem.id;

      UPDATE "NotaFiscalItem"
      SET "categoriaFinanceiraId" = destino_id
      WHERE "categoriaFinanceiraId" = origem.id;

      UPDATE "CategoriaFinanceira"
      SET ativo = false, "excluidoEm" = instante
      WHERE id = origem.id;
    END IF;
  END LOOP;

  UPDATE "CategoriaFinanceira"
  SET ativo = false, "excluidoEm" = instante
  WHERE id = categoria_pessoal_id;

  -- Os cadastros agregados ficam redundantes após a entrada das categorias detalhadas
  -- de FGTS, INSS, Vale Alimentação e Vale Transporte. O deploy é interrompido se algum
  -- vínculo surgir neles, evitando classificar automaticamente uma despesa ambígua.
  FOR categoria_redundante IN
    SELECT id, nome
    FROM "CategoriaFinanceira"
    WHERE grupo = 'FOLHA_PAGAMENTO'::"GrupoDre"
      AND "paiId" IS NULL
      AND "excluidoEm" IS NULL
      AND nome IN ('Encargos (INSS/FGTS)', 'Vale Transporte/Alimentação')
    FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1 FROM "LancamentoFinanceiro" WHERE "categoriaId" = categoria_redundante.id
      UNION ALL
      SELECT 1 FROM "NotaFiscalItem" WHERE "categoriaFinanceiraId" = categoria_redundante.id
    ) THEN
      RAISE EXCEPTION 'A categoria redundante % possui vínculos e precisa de revisão manual.', categoria_redundante.nome;
    END IF;

    UPDATE "CategoriaFinanceira"
    SET ativo = false, "excluidoEm" = instante
    WHERE id = categoria_redundante.id;
  END LOOP;
END $reorganizar$;

COMMIT;
