-- Categorias usavam editar perdas. Excluir perdas reverte estoque: não herdar essa ação.
UPDATE "PerfilAcesso" p SET "permissoes" = p."permissoes" || jsonb_build_object('inventario.perdas.categorias',
  (CASE WHEN p."permissoes"->'inventario.perdas' ? 'visualizar' THEN '["visualizar"]'::jsonb ELSE '[]'::jsonb END)
  || (CASE WHEN p."permissoes"->'inventario.perdas' ? 'editar' THEN '["adicionar","editar","excluir"]'::jsonb ELSE '[]'::jsonb END)), "updatedAt" = CURRENT_TIMESTAMP
WHERE p."permissoes" ? 'inventario.perdas' AND NOT (p."permissoes" ? 'inventario.perdas.categorias');
UPDATE "Usuario" u SET "permissoesPersonalizadas" = u."permissoesPersonalizadas" || jsonb_build_object('inventario.perdas.categorias',
  (CASE WHEN u."permissoesPersonalizadas"->'inventario.perdas' ? 'visualizar' THEN jsonb_build_object('visualizar',u."permissoesPersonalizadas"->'inventario.perdas'->'visualizar') ELSE '{}'::jsonb END)
  || (CASE WHEN u."permissoesPersonalizadas"->'inventario.perdas' ? 'editar' THEN jsonb_build_object('adicionar',u."permissoesPersonalizadas"->'inventario.perdas'->'editar','editar',u."permissoesPersonalizadas"->'inventario.perdas'->'editar','excluir',u."permissoesPersonalizadas"->'inventario.perdas'->'editar') ELSE '{}'::jsonb END))
WHERE u."permissoesPersonalizadas" ? 'inventario.perdas' AND NOT (u."permissoesPersonalizadas" ? 'inventario.perdas.categorias');
INSERT INTO "McpEvento" ("id","correlacao","acao","resultado","duracaoMs","registros") VALUES ('migracao-central-categorias-perdas-20261008','migracao-20261008016000','MIGRACAO_EQUIVALENCIA_CATEGORIAS_PERDAS','OK',0,ARRAY[]::TEXT[]);
