BEGIN;

-- Decisão do usuário em 05/10/2026: todo cliente tem R$ 50.000,00 de crédito total
-- permitido em aberto, inclusive os que tinham limite manual ou nenhum limite.
-- Cadastros novos nascem com o mesmo valor; alterações posteriores seguem o cadastro.
ALTER TABLE "ClienteVenda" ALTER COLUMN "limiteCreditoAberto" SET DEFAULT 50000.00;

INSERT INTO "HistoricoCadastroVenda" (id, entidade, "registroId", "usuarioId", "usuarioNome", antes, depois, "createdAt")
SELECT 'limite-credito-20261005-' || id, 'CLIENTE_LIMITE_CREDITO_MIGRACAO', id, 'migration:20261005210000', 'Sistema',
       jsonb_build_object('limiteCreditoAberto', "limiteCreditoAberto"::text, 'versao', versao),
       jsonb_build_object('limiteCreditoAberto', '50000.00', 'versao', versao + 1), CURRENT_TIMESTAMP
FROM "ClienteVenda" WHERE "limiteCreditoAberto" IS DISTINCT FROM 50000.00;

-- A versão incrementada recusa edições abertas antes da migration.
UPDATE "ClienteVenda" SET "limiteCreditoAberto" = 50000.00, versao = versao + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE "limiteCreditoAberto" IS DISTINCT FROM 50000.00;

-- Títulos, pedidos e saldos existentes não são alterados.
COMMIT;
