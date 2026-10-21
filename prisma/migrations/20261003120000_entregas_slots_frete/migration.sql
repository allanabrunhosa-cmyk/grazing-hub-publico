-- Transformação autorizada: preço atual vira Moto; Carro começa em R$24 na
-- primeira faixa e acrescenta R$3/km acima dela. Configuração anterior retida.
ALTER TABLE "ProdutoVenda" ADD COLUMN "slotsEntrega" INTEGER;
ALTER TABLE "ProdutoVenda" ADD CONSTRAINT "ProdutoVenda_slotsEntrega_check"
  CHECK ("slotsEntrega" IS NULL OR "slotsEntrega" BETWEEN 0 AND 999999);
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "entregasAntesSlots" JSONB;
ALTER TABLE "ConfiguracaoLoja" ADD COLUMN "enderecoEstruturado" JSONB;

WITH anterior AS (
  SELECT id, entregas, "versaoEntregas" FROM "ConfiguracaoLoja"
  WHERE entregas IS NOT NULL AND COALESCE(entregas->>'modelo', '') <> 'SLOTS'
), veiculos AS (
  SELECT a.*,
    COALESCE((SELECT jsonb_agg(v || jsonb_build_object('slotsMinimos', NULL, 'slotsMaximos', NULL))
      FROM jsonb_array_elements(COALESCE(a.entregas->'veiculos', '[]')) v), '[]')
    || CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(a.entregas->'veiculos', '[]')) v WHERE v->>'perfil' = 'MOTO')
      THEN '[]'::jsonb ELSE '[{"id":"entregas-slots-moto","nome":"Moto","perfil":"MOTO","ativo":true,"slotsMinimos":null,"slotsMaximos":null}]'::jsonb END
    || CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(a.entregas->'veiculos', '[]')) v WHERE v->>'perfil' = 'CARRO')
      THEN '[]'::jsonb ELSE '[{"id":"entregas-slots-carro","nome":"Carro","perfil":"CARRO","ativo":true,"slotsMinimos":null,"slotsMaximos":null}]'::jsonb END AS vs
  FROM anterior a
), candidata AS (
  SELECT a.*, jsonb_build_object('modelo', 'SLOTS', 'ativo', false,
    'origemTipo', COALESCE(a.entregas->>'origemTipo', 'LOJA'),
    'origemNome', CASE WHEN a.entregas->>'origemTipo' = 'PERSONALIZADA' THEN 'Origem personalizada' ELSE '' END,
    'origem', COALESCE(a.entregas->'origem', '{}'), 'veiculos', a.vs,
    'veiculo', NULL, 'veiculoPadraoId', NULL, 'regrasVeiculo', '[]'::jsonb,
    'excecoes', '[]'::jsonb, 'pedidoMinimo', NULL, 'freteMinimo', NULL, 'gratisAPartir', NULL,
    'maximoMetros', (SELECT max((f->>'limiteMetros')::integer) FROM jsonb_array_elements(COALESCE(a.entregas->'faixas', '[]')) f),
    'faixas', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', f->>'id', 'limiteMetros', f->'limiteMetros', 'preco', '0.00',
      'precos', (SELECT jsonb_object_agg(v->>'id', CASE WHEN v->>'perfil' = 'MOTO' THEN f->>'preco'
        ELSE to_char(24 + 3 * GREATEST(0, ((f->>'limiteMetros')::numeric - (a.entregas->'faixas'->0->>'limiteMetros')::numeric) / 1000), 'FM999999999990.00') END)
        FROM jsonb_array_elements(a.vs) v)) ORDER BY (f->>'limiteMetros')::integer)
      FROM jsonb_array_elements(COALESCE(a.entregas->'faixas', '[]')) f), '[]'::jsonb)) AS nova
  FROM veiculos a
), gravada AS (
  UPDATE "ConfiguracaoLoja" l SET "entregasAntesSlots" = c.entregas,
    entregas = c.nova, "versaoEntregas" = c."versaoEntregas" + 1, "updatedAt" = CURRENT_TIMESTAMP
  FROM candidata c WHERE l.id = c.id
  RETURNING l.id, c.entregas AS anterior, l.entregas AS nova, c."versaoEntregas" AS versao
)
INSERT INTO "HistoricoCadastroVenda" (id, entidade, "registroId", "usuarioId", "usuarioNome", antes, depois, "createdAt")
SELECT 'migration-entregas-slots-' || id, 'ENTREGAS', id, 'migration:entregas-slots', 'Sistema — alteração autorizada de Entregas',
  jsonb_build_object('config', anterior, 'versao', versao),
  jsonb_build_object('config', nova, 'versao', versao + 1, 'motivo', 'Frete por veículo e slots; capacidades e ocupações aguardam configuração'), CURRENT_TIMESTAMP
FROM gravada;
