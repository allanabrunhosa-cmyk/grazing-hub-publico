-- Separar uma capacidade já existente na permissão central "Baixas e estornos".
-- Equivalência pontual: conservar exatamente permissões e exceções anteriores.
-- Perfis novos não recebem esta permissão por padrão. Nenhum escopo OAuth muda.
UPDATE "PerfilAcesso" SET "permissoes" = "permissoes" || jsonb_build_object(
  'financeiro.estornos', "permissoes" -> 'financeiro.baixas'
), "updatedAt" = CURRENT_TIMESTAMP
WHERE "permissoes" ? 'financeiro.baixas' AND NOT "permissoes" ? 'financeiro.estornos';
UPDATE "Usuario" SET "permissoesPersonalizadas" = "permissoesPersonalizadas" || jsonb_build_object(
  'financeiro.estornos', "permissoesPersonalizadas" -> 'financeiro.baixas'
)
WHERE "permissoesPersonalizadas" ? 'financeiro.baixas' AND NOT "permissoesPersonalizadas" ? 'financeiro.estornos';
INSERT INTO "McpEvento" ("id", "correlacao", "acao", "resultado", "duracaoMs", "registros")
VALUES ('migracao-central-estornos-20261008', 'migracao-20261008011000', 'MIGRACAO_EQUIVALENCIA_ESTORNOS', 'OK', 0, ARRAY[]::TEXT[]);
