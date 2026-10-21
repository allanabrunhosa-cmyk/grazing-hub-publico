BEGIN;

ALTER TABLE "ProdutoVenda" ADD COLUMN "preco" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ProdutoVenda" ADD CONSTRAINT "ProdutoVenda_preco_nao_negativo" CHECK ("preco" >= 0);

-- Decisão do usuário: Site vigente (inclusive desconto), depois valor disponível.
-- Site zero é um valor explícito: não substituir por outro canal.
CREATE TEMP TABLE precos_consolidados ON COMMIT DROP AS
SELECT p.id, p.versao,
       COALESCE(site.valor, p."precoComplemento", outro.valor, 0)::DECIMAL(12,2) AS valor,
       CASE WHEN site.valor IS NOT NULL THEN 'SITE'
            WHEN p."precoComplemento" IS NOT NULL THEN 'COMPLEMENTO_LEGADO'
            WHEN outro.valor IS NOT NULL THEN outro.canal ELSE 'SEM_PRECO' END AS fonte,
       jsonb_build_object('precoComplemento', p."precoComplemento", 'precos',
         COALESCE((SELECT jsonb_agg(to_jsonb(v) ORDER BY v.canal) FROM "PrecoProdutoVenda" v WHERE v."produtoId" = p.id), '[]'::jsonb)) AS antes
FROM "ProdutoVenda" p
LEFT JOIN LATERAL (
  SELECT COALESCE(v."precoPromocional", v.preco) AS valor
  FROM "PrecoProdutoVenda" v
  WHERE v."produtoId" = p.id AND upper(trim(v.canal)) = 'SITE'
  ORDER BY v.canal LIMIT 1
) site ON true
LEFT JOIN LATERAL (
  SELECT v.canal, COALESCE(v."precoPromocional", v.preco) AS valor
  FROM "PrecoProdutoVenda" v WHERE v."produtoId" = p.id
  ORDER BY CASE WHEN upper(trim(v.canal)) = 'IFOOD' THEN 0 ELSE 1 END, v.ativo DESC, v.canal
  LIMIT 1
) outro ON true;

INSERT INTO "HistoricoCadastroVenda" (id, entidade, "registroId", "usuarioId", "usuarioNome", antes, depois, "createdAt")
SELECT 'preco-unico-20261005-' || id, 'PRECO_UNICO_MIGRACAO', id, 'migration:20261005120000', 'Sistema', antes,
       jsonb_build_object('preco', valor::text, 'fonte', fonte, 'versao', versao + 1), CURRENT_TIMESTAMP
FROM precos_consolidados;

UPDATE "ProdutoVenda" p SET preco = c.valor, versao = p.versao + 1, "updatedAt" = CURRENT_TIMESTAMP
FROM precos_consolidados c WHERE c.id = p.id;

-- Tabelas legadas, opções incluídas e snapshots de pedidos são preservados.
COMMIT;
