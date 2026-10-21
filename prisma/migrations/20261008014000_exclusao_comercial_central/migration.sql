-- Exclusão comercial era protegida por editar. Preservar a equivalência dos
-- cadastros existentes; novas concessões distinguem editar de excluir.
UPDATE "PerfilAcesso" p SET "permissoes" = p."permissoes" || (
 SELECT jsonb_object_agg(k, CASE WHEN v ? 'editar' AND NOT (v ? 'excluir') THEN v || '["excluir"]'::jsonb ELSE v END)
 FROM jsonb_each(p."permissoes") e(k,v) WHERE k IN ('vendas.produtos','vendas.catalogo','vendas.fiscal')
), "updatedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM jsonb_each(p."permissoes") e(k,v) WHERE k IN ('vendas.produtos','vendas.catalogo','vendas.fiscal'));
UPDATE "Usuario" u SET "permissoesPersonalizadas" = u."permissoesPersonalizadas" || (
 SELECT jsonb_object_agg(k, CASE WHEN v ? 'editar' AND NOT (v ? 'excluir') THEN v || jsonb_build_object('excluir',v->'editar') ELSE v END)
 FROM jsonb_each(u."permissoesPersonalizadas") e(k,v) WHERE k IN ('vendas.produtos','vendas.catalogo','vendas.fiscal')
)
WHERE EXISTS (SELECT 1 FROM jsonb_each(u."permissoesPersonalizadas") e(k,v) WHERE k IN ('vendas.produtos','vendas.catalogo','vendas.fiscal'));
INSERT INTO "McpEvento" ("id","correlacao","acao","resultado","duracaoMs","registros") VALUES ('migracao-central-exclusao-comercial-20261008','migracao-20261008014000','MIGRACAO_EQUIVALENCIA_EXCLUSAO_COMERCIAL','OK',0,ARRAY[]::TEXT[]);
