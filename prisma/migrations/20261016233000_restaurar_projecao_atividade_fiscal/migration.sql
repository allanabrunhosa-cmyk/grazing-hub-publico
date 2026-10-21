-- Preserva integralmente o projetor de Validades de 16/10 e restaura a extensão
-- fiscal de 11/10. Sem backfill, exclusão ou cópia de payloads para atividades.
ALTER FUNCTION grazing_projetar_atividade(TEXT, JSONB)
  RENAME TO grazing_projetar_atividade_validades_20261016;

CREATE FUNCTION grazing_projetar_atividade(fonte TEXT, registro JSONB)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_id TEXT := nullif(registro->>'id', '');
  v_autor TEXT := nullif(registro->>'usuarioId', '');
  v_nome TEXT := nullif(registro->>'usuarioNome', '');
  v_versao TEXT := nullif(registro->>'versaoId', '');
  v_tipo TEXT := registro->>'tipo';
  v_acao TEXT; v_resumo TEXT; v_novo TEXT;
  v_origem TEXT := 'NAO_IDENTIFICADA'; v_contexto JSONB := '{}';
  v_data TIMESTAMPTZ;
BEGIN
  IF fonte IS DISTINCT FROM 'EventoEstruturaFiscal' THEN
    RETURN grazing_projetar_atividade_validades_20261016(fonte, registro);
  END IF;
  IF v_id IS NULL OR v_autor IS NULL OR v_nome IS NULL OR v_versao IS NULL
    OR registro->>'createdAt' IS NULL OR length(v_id) > 160 OR length(v_versao) > 160
    OR v_tipo IS NULL OR v_tipo NOT IN ('RASCUNHO', 'IMPACTO', 'ATIVACAO') THEN
    RAISE EXCEPTION 'Evento de estrutura fiscal sem identidade ou tipo comprovado.' USING ERRCODE = '22023';
  END IF;
  v_data := (registro->>'createdAt')::timestamp AT TIME ZONE 'UTC';
  BEGIN
    v_contexto := coalesce(nullif(current_setting('grazing.atividade', true), '')::jsonb, '{}'::jsonb);
  EXCEPTION WHEN invalid_text_representation THEN v_contexto := '{}'; END;
  IF v_contexto->>'origem' IN ('INTERFACE', 'API', 'MCP', 'AUTOMACAO') THEN
    v_origem := v_contexto->>'origem';
  END IF;
  v_acao := CASE v_tipo WHEN 'RASCUNHO' THEN 'VERSAO_FISCAL_CRIADA'
    WHEN 'IMPACTO' THEN 'IMPACTO_FISCAL_ANALISADO' ELSE 'VERSAO_FISCAL_ATIVADA' END;
  v_resumo := CASE v_tipo WHEN 'RASCUNHO' THEN 'Rascunho de versão fiscal criado.'
    WHEN 'IMPACTO' THEN 'Impacto da alteração fiscal analisado.'
    ELSE 'Versão fiscal ativada por vigência, sem transmissão de documento.' END;
  INSERT INTO "AtividadeUsuario" ("ocorridoEm", "autorId", "autorNome", "atorTipo", "origem",
    "modulo", "recurso", "acao", "entidade", "entidadeId", "resumo", "resultado", "categoria",
    "correlacaoId", "fonteTabela", "fonteId")
  VALUES (v_data, v_autor, left(regexp_replace(v_nome, '[[:cntrl:]]', ' ', 'g'), 120), 'USUARIO', v_origem,
    'cadastros', 'vendas.fiscal', v_acao, 'VersaoEstruturaFiscal', v_versao, v_resumo, 'SUCESSO', 'CRITICA',
    left(coalesce(nullif(v_contexto->>'correlacaoId', ''), registro->>'chaveOperacao'), 160), fonte, v_id)
  ON CONFLICT ("fonteTabela", "fonteId") DO NOTHING RETURNING "id" INTO v_novo;
  IF v_novo IS NULL THEN
    SELECT "id" INTO v_novo FROM "AtividadeUsuario" WHERE "fonteTabela" = fonte AND "fonteId" = v_id;
  END IF;
  RETURN v_novo;
END;
$$;

CREATE OR REPLACE FUNCTION grazing_atividade_apos_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM grazing_projetar_atividade(TG_TABLE_NAME, to_jsonb(NEW));
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION grazing_projetar_atividade(TEXT, JSONB) IS
  'Restaura projeção fiscal validada e delega demais fontes ao projetor de Validades de 16/10/2026. Sem backfill ou conteúdo fiscal na atividade.';
