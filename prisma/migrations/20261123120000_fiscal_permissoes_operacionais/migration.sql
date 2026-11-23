-- Separa emitir, cancelar e numerar notas de venda dos cadastros fiscais e da integração.
-- SQL manual aditivo. Materializa uma única vez quem já podia executar cada operação;
-- não amplia direitos, não encerra sessões e não remove histórico. Recursos novos negam por ausência.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'));

-- Auditoria com autor técnico: a projeção não atribui a migração a um usuário inexistente.
DO $projecao$ BEGIN
 IF to_regprocedure('grazing_projetar_atividade(text,jsonb)') IS NOT NULL AND
   to_regprocedure('grazing_projetar_atividade_antes_fiscal_20261123(text,jsonb)') IS NULL THEN
   ALTER FUNCTION grazing_projetar_atividade(text,jsonb) RENAME TO grazing_projetar_atividade_antes_fiscal_20261123;
   EXECUTE $funcao$ CREATE FUNCTION grazing_projetar_atividade(fonte text,registro jsonb)
   RETURNS text LANGUAGE plpgsql AS $corpo$
   DECLARE novo text;
   BEGIN
    IF fonte='HistoricoAcesso' AND registro->>'autorId'='migration:fiscal' AND registro->>'acao'='DESMEMBRAR_PERMISSOES_FISCAIS' THEN
      INSERT INTO "AtividadeUsuario"("ocorridoEm","autorId","autorNome","atorTipo","atorReferencia",origem,modulo,recurso,acao,entidade,"entidadeId","usuarioAfetadoId",resumo,resultado,categoria,"correlacaoId","fonteTabela","fonteId")
      VALUES((registro->>'createdAt')::timestamp AT TIME ZONE 'UTC',NULL,NULL,'SISTEMA','MIGRACAO_FISCAL','AUTOMACAO','acessos','configuracoes.usuarios',
        'DESMEMBRAR_PERMISSOES_FISCAIS',registro->>'entidade',registro->>'entidadeId',CASE WHEN registro->>'entidade'='Usuário' THEN registro->>'entidadeId' END,
        'Permissões fiscais separadas em emitir, cancelar e numerar notas.','SUCESSO','ACESSO','migration:fiscal',fonte,registro->>'id')
      ON CONFLICT("fonteTabela","fonteId") DO NOTHING RETURNING id INTO novo;
      IF novo IS NULL THEN SELECT id INTO novo FROM "AtividadeUsuario" WHERE "fonteTabela"=fonte AND "fonteId"=registro->>'id'; END IF;
      RETURN novo;
    END IF;
    RETURN grazing_projetar_atividade_antes_fiscal_20261123(fonte,registro);
   END $corpo$; $funcao$;
   EXECUTE $trigger$ CREATE OR REPLACE FUNCTION grazing_atividade_apos_auditoria() RETURNS trigger LANGUAGE plpgsql AS $corpo$
     BEGIN PERFORM grazing_projetar_atividade(TG_TABLE_NAME,to_jsonb(NEW)); RETURN NEW; END $corpo$; $trigger$;
 END IF;
END $projecao$;

-- Mesma regra de `permissaoEfetiva`: a exceção prevalece e toda ação exige Visualizar.
CREATE OR REPLACE FUNCTION pg_temp.fiscal_efetiva(b jsonb,e jsonb,r text,a text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE((e->r->>'visualizar')::boolean,(b->r) ? 'visualizar',false)
    AND COALESCE((e->r->>a)::boolean,(b->r) ? a,false)
$$;
-- O que o acesso anterior permitia de fato em cada operação agora separada.
-- Emitir e cancelar exigiam, juntos, cadastros fiscais, integração e revisão de pedidos.
CREATE OR REPLACE FUNCTION pg_temp.fiscal_esperado(b jsonb,e jsonb,r text,a text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE transmitir boolean;
BEGIN
  transmitir := pg_temp.fiscal_efetiva(b,e,'vendas.fiscal','editar')
    AND pg_temp.fiscal_efetiva(b,e,'configuracoes.brasilnfe','editar')
    AND pg_temp.fiscal_efetiva(b,e,'vendas.pedidos.revisar','editar');
  IF r='financeiro.fiscal.emissao' THEN
    RETURN CASE WHEN a='visualizar' THEN pg_temp.fiscal_efetiva(b,e,'vendas.fiscal','visualizar') ELSE transmitir END;
  ELSIF r='financeiro.fiscal.cancelamento' THEN RETURN transmitir;
  END IF;
  RETURN pg_temp.fiscal_efetiva(b,e,'configuracoes.brasilnfe',a);
END $$;

DO $migration$
DECLARE p record; u record; r text; a text; nova jsonb; personalizada jsonb; acoes jsonb; esperado boolean;
  novos text[] := ARRAY['financeiro.fiscal.emissao','financeiro.fiscal.cancelamento','financeiro.fiscal.numeracao'];
BEGIN
  -- Mesma ordem de travas da gestão de acessos: perfil, depois usuário.
  PERFORM id FROM "PerfilAcesso" ORDER BY id FOR UPDATE;
  PERFORM id FROM "Usuario" ORDER BY id FOR UPDATE;
  CREATE TEMP TABLE fiscal_perfis_antes ON COMMIT DROP AS
    SELECT id,COALESCE(permissoes,'{}'::jsonb) AS permissoes FROM "PerfilAcesso";

  FOR p IN SELECT * FROM fiscal_perfis_antes ORDER BY id LOOP
    nova := p.permissoes;
    FOREACH r IN ARRAY novos LOOP
      CONTINUE WHEN nova ? r;
      acoes := '[]'::jsonb;
      IF pg_temp.fiscal_esperado(p.permissoes,'{}'::jsonb,r,'visualizar') THEN
        acoes := acoes || '"visualizar"'::jsonb;
        IF pg_temp.fiscal_esperado(p.permissoes,'{}'::jsonb,r,'editar') THEN acoes := acoes || '"editar"'::jsonb; END IF;
      END IF;
      IF jsonb_array_length(acoes)>0 THEN nova := nova || jsonb_build_object(r,acoes); END IF;
    END LOOP;
    IF nova<>p.permissoes THEN
      UPDATE "PerfilAcesso" SET permissoes=nova WHERE id=p.id;
      INSERT INTO "HistoricoAcesso"(id,"autorId",entidade,"entidadeId",acao,antes,depois)
        VALUES('fiscal-operacional-perfil-'||md5(p.id),'migration:fiscal','Perfil',p.id,
          'DESMEMBRAR_PERMISSOES_FISCAIS',jsonb_build_object('permissoes',p.permissoes),jsonb_build_object('permissoes',nova))
        ON CONFLICT(id) DO NOTHING;
    END IF;
  END LOOP;

  -- Personalizações: só registra o que difere do perfil já migrado.
  FOR u IN SELECT us.id,COALESCE(us."permissoesPersonalizadas",'{}'::jsonb) AS excecoes,
      COALESCE(antes.permissoes,'{}'::jsonb) AS antes,COALESCE(pf.permissoes,'{}'::jsonb) AS depois
    FROM "Usuario" us LEFT JOIN fiscal_perfis_antes antes ON antes.id=us."perfilAcessoId"
      LEFT JOIN "PerfilAcesso" pf ON pf.id=us."perfilAcessoId"
    WHERE COALESCE(us."permissoesPersonalizadas",'{}'::jsonb) ?| ARRAY['vendas.fiscal','configuracoes.brasilnfe','vendas.pedidos.revisar']
    ORDER BY us.id LOOP
    personalizada := u.excecoes;
    FOREACH r IN ARRAY novos LOOP
      CONTINUE WHEN personalizada ? r;
      acoes := '{}'::jsonb;
      FOREACH a IN ARRAY ARRAY['visualizar','editar'] LOOP
        esperado := pg_temp.fiscal_esperado(u.antes,u.excecoes,r,a);
        IF esperado IS DISTINCT FROM COALESCE((u.depois->r) ? a,false) THEN acoes := acoes || jsonb_build_object(a,esperado); END IF;
      END LOOP;
      IF acoes<>'{}'::jsonb THEN personalizada := personalizada || jsonb_build_object(r,acoes); END IF;
    END LOOP;
    IF personalizada<>u.excecoes THEN
      UPDATE "Usuario" SET "permissoesPersonalizadas"=personalizada WHERE id=u.id;
      INSERT INTO "HistoricoAcesso"(id,"autorId",entidade,"entidadeId",acao,antes,depois)
        VALUES('fiscal-operacional-usuario-'||md5(u.id),'migration:fiscal','Usuário',u.id,
          'DESMEMBRAR_PERMISSOES_FISCAIS',jsonb_build_object('permissoesPersonalizadas',u.excecoes),jsonb_build_object('permissoesPersonalizadas',personalizada))
        ON CONFLICT(id) DO NOTHING;
    END IF;
  END LOOP;
END $migration$;
COMMIT;
