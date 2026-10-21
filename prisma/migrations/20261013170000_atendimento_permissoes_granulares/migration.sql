-- Materializa uma única vez os acessos efetivos anteriores. Recursos novos passam
-- a negar por ausência após o commit. Nenhum histórico operacional é removido.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'));

-- A auditoria canônica usa um autor técnico. Sua projeção não atribui a migração
-- a um usuário inexistente. As demais fontes conservam a função anterior.
DO $instalar_projecao$ BEGIN
  IF to_regprocedure('grazing_projetar_atividade(text,jsonb)') IS NOT NULL AND
    to_regprocedure('grazing_projetar_atividade_antes_granular_20261013(text,jsonb)') IS NULL THEN
    ALTER FUNCTION grazing_projetar_atividade(text,jsonb) RENAME TO grazing_projetar_atividade_antes_granular_20261013;
    EXECUTE $funcao$
      CREATE FUNCTION grazing_projetar_atividade(fonte text,registro jsonb)
      RETURNS text LANGUAGE plpgsql AS $corpo$
      DECLARE novo text;
      BEGIN
        IF fonte='HistoricoAcesso' AND registro->>'autorId'='migration:atendimento'
          AND registro->>'acao'='DESMEMBRAR_PERMISSOES_ATENDIMENTO' THEN
          INSERT INTO "AtividadeUsuario"("ocorridoEm","autorId","autorNome","atorTipo","atorReferencia","origem",
            "modulo","recurso","acao","entidade","entidadeId","usuarioAfetadoId","resumo","resultado","categoria",
            "correlacaoId","fonteTabela","fonteId")
          VALUES((registro->>'createdAt')::timestamp AT TIME ZONE 'UTC',NULL,NULL,'SISTEMA','MIGRACAO_ATENDIMENTO','AUTOMACAO',
            'acessos','configuracoes.usuarios','DESMEMBRAR_PERMISSOES_ATENDIMENTO',registro->>'entidade',registro->>'entidadeId',
            CASE WHEN registro->>'entidade'='Usuário' THEN registro->>'entidadeId' END,
            'Permissões do Atendimento separadas por operação.','SUCESSO','ACESSO','migration:atendimento',fonte,registro->>'id')
          ON CONFLICT("fonteTabela","fonteId") DO NOTHING RETURNING id INTO novo;
          IF novo IS NULL THEN SELECT id INTO novo FROM "AtividadeUsuario" WHERE "fonteTabela"=fonte AND "fonteId"=registro->>'id'; END IF;
          RETURN novo;
        END IF;
        RETURN grazing_projetar_atividade_antes_granular_20261013(fonte,registro);
      END $corpo$;
    $funcao$;
    EXECUTE $trigger$
      CREATE OR REPLACE FUNCTION grazing_atividade_apos_auditoria() RETURNS trigger LANGUAGE plpgsql AS $corpo$
      BEGIN PERFORM grazing_projetar_atividade(TG_TABLE_NAME,to_jsonb(NEW)); RETURN NEW; END $corpo$;
    $trigger$;
  END IF;
END $instalar_projecao$;

CREATE OR REPLACE FUNCTION pg_temp.atendimento_valor(b jsonb,e jsonb,r text,a text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE((e->r->>a)::boolean,(b->r) ? a,false)
$$;
CREATE OR REPLACE FUNCTION pg_temp.atendimento_legado(b jsonb,e jsonb,a text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE consulta text; operacao text; consultar boolean;
BEGIN
  consulta := CASE WHEN b ? 'crm.atendimento' OR (e->'crm.atendimento') ? 'visualizar'
    THEN 'crm.atendimento' ELSE 'crm' END;
  operacao := CASE WHEN consulta='crm.atendimento' OR (e->'crm.atendimento') ? 'editar'
    THEN 'crm.atendimento' ELSE 'crm' END;
  consultar := pg_temp.atendimento_valor(b,e,consulta,'visualizar');
  IF a='consultar' THEN RETURN consultar; END IF;
  IF a='atender' THEN RETURN consultar AND
    pg_temp.atendimento_valor(b,e,operacao,'visualizar') AND pg_temp.atendimento_valor(b,e,operacao,'editar'); END IF;
  RETURN consultar AND pg_temp.atendimento_valor(b,e,'crm.atendimento.configuracoes','visualizar')
    AND pg_temp.atendimento_valor(b,e,'crm.atendimento.configuracoes','editar');
END $$;
CREATE OR REPLACE FUNCTION pg_temp.atendimento_veto(b jsonb,e jsonb,a text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE consulta text; operacao text; recurso text;
BEGIN
  consulta := CASE WHEN b ? 'crm.atendimento' OR (e->'crm.atendimento') ? 'visualizar'
    THEN 'crm.atendimento' ELSE 'crm' END;
  operacao := CASE WHEN consulta='crm.atendimento' OR (e->'crm.atendimento') ? 'editar'
    THEN 'crm.atendimento' ELSE 'crm' END;
  recurso := CASE WHEN a='consultar' THEN consulta WHEN a='atender' THEN operacao
    ELSE 'crm.atendimento.configuracoes' END;
  RETURN COALESCE((e->consulta->>'visualizar')::boolean=false,false)
    OR COALESCE((e->recurso->>'visualizar')::boolean=false,false)
    OR (a<>'consultar' AND COALESCE((e->recurso->>'editar')::boolean=false,false));
END $$;

DO $migration$
DECLARE p record; u record; r record; c record; nova jsonb; personalizada jsonb;
  acoes jsonb; esperado boolean; atual boolean; afetados integer;
BEGIN
  IF EXISTS(SELECT 1 FROM "McpEvento" WHERE id='atendimento-permissoes-granulares-20261013') THEN RETURN; END IF;
  -- Mesma ordem de travas da gestão de acessos: perfil, depois usuário.
  PERFORM id FROM "PerfilAcesso" ORDER BY id FOR UPDATE;
  PERFORM id FROM "Usuario" ORDER BY id FOR UPDATE;
  CREATE TEMP TABLE atendimento_perfis_antes ON COMMIT DROP AS
    SELECT id,sistema,COALESCE(permissoes,'{}'::jsonb) AS permissoes FROM "PerfilAcesso";
  CREATE TEMP TABLE atendimento_usuarios_afetados(id text PRIMARY KEY) ON COMMIT DROP;
  CREATE TEMP TABLE atendimento_mapa(recurso text,acao text,origem text,ordem integer) ON COMMIT DROP;
  INSERT INTO atendimento_mapa VALUES
    ('crm.atendimento.mensagens','visualizar','consultar',2),
    ('crm.atendimento.mensagens','adicionar','atender',3),
    ('crm.atendimento.notas','visualizar','consultar',4),
    ('crm.atendimento.notas','adicionar','atender',5),
    ('crm.atendimento.etiquetas','visualizar','consultar',6),
    ('crm.atendimento.etiquetas','editar','atender',7),
    ('crm.atendimento.contatos','visualizar','consultar',8),
    ('crm.atendimento.agenda','visualizar','consultar',9),
    ('crm.atendimento.agenda','adicionar','atender',10),
    ('crm.atendimento.agenda','editar','atender',11),
    ('crm.atendimento.pipeline','visualizar','consultar',12),
    ('crm.atendimento.pipeline','adicionar','atender',13),
    ('crm.atendimento.pipeline','editar','atender',14),
    ('crm.atendimento.duvidas','visualizar','consultar',15),
    ('crm.atendimento.duvidas','adicionar','atender',16),
    ('crm.atendimento.duvidas','editar','atender',17),
    ('crm.atendimento.conhecimento','visualizar','consultar',18),
    ('crm.atendimento.conhecimento','adicionar','conhecimento',19),
    ('crm.atendimento.conhecimento','editar','conhecimento',20),
    ('crm.atendimento.conhecimento','excluir','conhecimento',21),
    ('crm.atendimento.ia','visualizar','consultar',22),
    ('crm.atendimento.ia','editar','configurar',23),
    ('crm.atendimento.skills','visualizar','consultar',24),
    ('crm.atendimento.skills','adicionar','configurar',25),
    ('crm.atendimento.skills','editar','configurar',26),
    ('crm.atendimento.skills','excluir','configurar',27),
    ('crm.atendimento.tom','visualizar','consultar',28),
    ('crm.atendimento.tom','editar','configurar',29),
    ('crm.atendimento.followup','visualizar','consultar',30),
    ('crm.atendimento.followup','editar','configurar',31),
    ('crm.atendimento.configuracoes','visualizar','consultar',32),
    ('crm.atendimento.configuracoes','editar','configurar',33),
    ('crm.atendimento.modelos','visualizar','consultar',34),
    ('crm.atendimento.automacoes','visualizar','consultar',35),
    ('crm.atendimento.canais','visualizar','consultar',36),
    ('crm.atendimento.equipe','visualizar','consultar',37);

  FOR p IN SELECT * FROM atendimento_perfis_antes WHERE sistema IS DISTINCT FROM 'ADMINISTRADOR' ORDER BY id LOOP
    nova := p.permissoes;
    FOR r IN SELECT DISTINCT recurso FROM atendimento_mapa ORDER BY recurso LOOP
      IF p.permissoes ? r.recurso THEN CONTINUE; END IF;
      SELECT COALESCE(jsonb_agg(acao ORDER BY ordem) FILTER(WHERE pg_temp.atendimento_legado(p.permissoes,'{}',origem)),'[]')
        INTO acoes FROM atendimento_mapa WHERE recurso=r.recurso;
      nova := nova || jsonb_build_object(r.recurso,acoes);
    END LOOP;
    IF nova IS DISTINCT FROM p.permissoes THEN
      UPDATE "PerfilAcesso" SET permissoes=nova,"updatedAt"=now() WHERE id=p.id;
      INSERT INTO "HistoricoAcesso"(id,"autorId",entidade,"entidadeId",acao,antes,depois)
        VALUES('atendimento-granular-perfil-'||md5(p.id),'migration:atendimento','Perfil',p.id,
          'DESMEMBRAR_PERMISSOES_ATENDIMENTO',jsonb_build_object('permissoes',p.permissoes),jsonb_build_object('permissoes',nova));
      INSERT INTO atendimento_usuarios_afetados SELECT id FROM "Usuario" WHERE "perfilAcessoId"=p.id ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR u IN SELECT usuario_atual.id,usuario_atual."permissoesPersonalizadas" AS excecoes,perfil_antes.sistema,
    COALESCE(perfil_antes.permissoes,'{}'::jsonb) AS base_antes,COALESCE(perfil_depois.permissoes,'{}'::jsonb) AS base_depois
    FROM "Usuario" usuario_atual LEFT JOIN atendimento_perfis_antes perfil_antes ON perfil_antes.id=usuario_atual."perfilAcessoId"
    LEFT JOIN "PerfilAcesso" perfil_depois ON perfil_depois.id=usuario_atual."perfilAcessoId" ORDER BY usuario_atual.id LOOP
    IF u.sistema='ADMINISTRADOR' THEN CONTINUE; END IF;
    personalizada := COALESCE(u.excecoes,'{}'::jsonb);
    FOR r IN SELECT DISTINCT recurso FROM atendimento_mapa ORDER BY recurso LOOP
      -- Uma decisão granular já existente prevalece, inclusive [] e false.
      IF u.base_antes ? r.recurso THEN CONTINUE; END IF;
      IF COALESCE(u.excecoes,'{}') ? r.recurso THEN
        -- Não transformar editar=true sem visualizar em uma concessão durante a migração.
        IF NOT ((u.excecoes->r.recurso) ? 'visualizar') AND
          NOT pg_temp.atendimento_valor(u.base_antes,u.excecoes,r.recurso,'visualizar') THEN
          personalizada := personalizada || jsonb_build_object(r.recurso,
            (u.excecoes->r.recurso) || '{"visualizar":false}'::jsonb);
        END IF;
        CONTINUE;
      END IF;
      FOR c IN SELECT * FROM atendimento_mapa WHERE recurso=r.recurso ORDER BY ordem LOOP
        esperado := pg_temp.atendimento_legado(u.base_antes,COALESCE(u.excecoes,'{}'),c.origem);
        atual := pg_temp.atendimento_valor(u.base_depois,'{}',c.recurso,c.acao);
        IF esperado IS DISTINCT FROM atual OR pg_temp.atendimento_veto(u.base_antes,COALESCE(u.excecoes,'{}'),c.origem) THEN
          personalizada := personalizada || jsonb_build_object(c.recurso,
            COALESCE(personalizada->c.recurso,'{}') || jsonb_build_object(c.acao,esperado));
        END IF;
      END LOOP;
    END LOOP;
    IF personalizada IS DISTINCT FROM COALESCE(u.excecoes,'{}') THEN
      UPDATE "Usuario" SET "permissoesPersonalizadas"=personalizada,"updatedAt"=now() WHERE id=u.id;
      INSERT INTO "HistoricoAcesso"(id,"autorId",entidade,"entidadeId",acao,antes,depois)
        VALUES('atendimento-granular-usuario-'||md5(u.id),'migration:atendimento','Usuário',u.id,
          'DESMEMBRAR_PERMISSOES_ATENDIMENTO',jsonb_build_object('permissoesPersonalizadas',u.excecoes),jsonb_build_object('permissoesPersonalizadas',personalizada));
      INSERT INTO atendimento_usuarios_afetados VALUES(u.id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  UPDATE "Usuario" SET "sessaoVersao"="sessaoVersao"+1,"updatedAt"=now()
    WHERE id IN(SELECT id FROM atendimento_usuarios_afetados);
  SELECT count(*) INTO afetados FROM atendimento_usuarios_afetados;
  INSERT INTO "McpEvento"(id,correlacao,acao,resultado,"duracaoMs",registros)
    VALUES('atendimento-permissoes-granulares-20261013','migration:atendimento',
      'DESMEMBRAR_PERMISSOES_ATENDIMENTO','OK',0,ARRAY['usuarios-afetados:'||afetados::text]);
END $migration$;

-- O sinal de prontidão só fica visível junto das permissões materializadas.
-- CREATE OR REPLACE conserva owner e grants da view privada.
DO $$ BEGIN
  IF to_regclass('atendimento_integracao.identidade') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW atendimento_integracao.identidade WITH (security_barrier=true) AS
      SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,
        u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",
        p.permissoes,u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm",
        true AS "permissoesGranulares"
      FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId"
      WHERE u."excluidoEm" IS NULL AND (p.sistema=''ADMINISTRADOR'' OR
        CASE WHEN (p.permissoes ? ''crm.atendimento'') OR
          ((u."permissoesPersonalizadas"->''crm.atendimento'') ? ''visualizar'')
        THEN COALESCE((u."permissoesPersonalizadas"->''crm.atendimento''->>''visualizar'')::boolean,
          (p.permissoes->''crm.atendimento'') ? ''visualizar'',false)
        ELSE COALESCE((u."permissoesPersonalizadas"->''crm''->>''visualizar'')::boolean,
          (p.permissoes->''crm'') ? ''visualizar'',false) END)';
  END IF;
END $$;
COMMIT;
