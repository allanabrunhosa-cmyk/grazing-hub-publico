-- Preparar trabalhos e imprimir eram a mesma capacidade. Preservar a semântica
-- anterior, distinguindo-as centralmente para concessões e reduções posteriores.
UPDATE "PerfilAcesso" SET "permissoes" = "permissoes" || jsonb_build_object('producao.imprimir', "permissoes" -> 'producao'), "updatedAt" = CURRENT_TIMESTAMP
WHERE "permissoes" ? 'producao' AND NOT ("permissoes" ? 'producao.imprimir');
UPDATE "Usuario" SET "permissoesPersonalizadas" = "permissoesPersonalizadas" || jsonb_build_object('producao.imprimir', "permissoesPersonalizadas" -> 'producao')
WHERE "permissoesPersonalizadas" ? 'producao' AND NOT ("permissoesPersonalizadas" ? 'producao.imprimir');
INSERT INTO "McpEvento" ("id", "correlacao", "acao", "resultado", "duracaoMs", "registros") VALUES ('migracao-central-impressao-20261008', 'migracao-20261008013000', 'MIGRACAO_EQUIVALENCIA_IMPRESSAO', 'OK', 0, ARRAY[]::TEXT[]);
