-- Separação de capacidades já existentes, preservando base e exceções pontualmente.
-- Edição de compra incluía cancelar; recebimento incluía reabrir. Perfis novos negam.
-- Custo já era apresentado no cadastro de insumos. Escopos OAuth permanecem intactos.
WITH recursos(novo, antigo) AS (VALUES
  ('compras.cancelar', 'compras'), ('compras.reabrir', 'compras.receber'),
  ('financeiro.custos', 'insumos'))
UPDATE "PerfilAcesso" p SET "permissoes" = p."permissoes" || COALESCE((
  SELECT jsonb_object_agg(novo, CASE WHEN novo = 'financeiro.custos' THEN
    CASE WHEN (p."permissoes" -> antigo) ? 'visualizar' THEN '["visualizar"]'::jsonb ELSE '[]'::jsonb END
    ELSE COALESCE((SELECT jsonb_agg(a) FROM jsonb_array_elements_text(p."permissoes" -> antigo) a WHERE a IN ('visualizar', 'editar')), '[]'::jsonb) END)
  FROM recursos WHERE p."permissoes" ? antigo AND NOT (p."permissoes" ? novo)
), '{}'::jsonb), "updatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM recursos WHERE p."permissoes" ? antigo AND NOT (p."permissoes" ? novo));
WITH recursos(novo, antigo) AS (VALUES
  ('compras.cancelar', 'compras'), ('compras.reabrir', 'compras.receber'),
  ('financeiro.custos', 'insumos'))
UPDATE "Usuario" u SET "permissoesPersonalizadas" = u."permissoesPersonalizadas" || COALESCE((
  SELECT jsonb_object_agg(novo, CASE WHEN novo = 'financeiro.custos'
    THEN CASE WHEN (u."permissoesPersonalizadas" -> antigo) ? 'visualizar' THEN jsonb_build_object('visualizar', u."permissoesPersonalizadas" -> antigo -> 'visualizar') ELSE '{}'::jsonb END
    ELSE COALESCE((SELECT jsonb_object_agg(k, v) FROM jsonb_each(u."permissoesPersonalizadas" -> antigo) kv(k,v) WHERE k IN ('visualizar', 'editar')), '{}'::jsonb) END)
  FROM recursos WHERE u."permissoesPersonalizadas" ? antigo AND NOT (u."permissoesPersonalizadas" ? novo)
), '{}'::jsonb)
WHERE EXISTS (SELECT 1 FROM recursos WHERE u."permissoesPersonalizadas" ? antigo AND NOT (u."permissoesPersonalizadas" ? novo));
INSERT INTO "McpEvento" ("id", "correlacao", "acao", "resultado", "duracaoMs", "registros")
VALUES ('migracao-central-compras-20261008', 'migracao-20261008012000', 'MIGRACAO_EQUIVALENCIA_COMPRAS_CUSTOS', 'OK', 0, ARRAY[]::TEXT[]);
