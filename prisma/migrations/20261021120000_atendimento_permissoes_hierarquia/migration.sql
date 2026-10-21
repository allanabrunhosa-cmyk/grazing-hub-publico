-- Materializa a hierarquia do Atendimento sem ampliar direitos ou encerrar sessões.
-- SQL manual aditivo. Backup privado verificado antes da aplicação produtiva.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'));

-- Estende a projeção mais recente e delega as demais fontes sem mudar suas regras.
DO $projecao$ BEGIN
 IF to_regprocedure('grazing_projetar_atividade(text,jsonb)') IS NOT NULL AND
   to_regprocedure('grazing_projetar_atividade_antes_hierarquia_20261021(text,jsonb)') IS NULL THEN
   ALTER FUNCTION grazing_projetar_atividade(text,jsonb) RENAME TO grazing_projetar_atividade_antes_hierarquia_20261021;
   EXECUTE $funcao$ CREATE FUNCTION grazing_projetar_atividade(fonte text,registro jsonb)
   RETURNS text LANGUAGE plpgsql AS $corpo$
   DECLARE novo text;
   BEGIN
    IF fonte='HistoricoAcesso' AND registro->>'autorId'='migration:atendimento' AND registro->>'acao'='HIERARQUIZAR_PERMISSOES_ATENDIMENTO' THEN
      INSERT INTO "AtividadeUsuario"("ocorridoEm","autorId","autorNome","atorTipo","atorReferencia",origem,modulo,recurso,acao,entidade,"entidadeId","usuarioAfetadoId",resumo,resultado,categoria,"correlacaoId","fonteTabela","fonteId")
      VALUES((registro->>'createdAt')::timestamp AT TIME ZONE 'UTC',NULL,NULL,'SISTEMA','MIGRACAO_ATENDIMENTO','AUTOMACAO','acessos','configuracoes.usuarios',
        'HIERARQUIZAR_PERMISSOES_ATENDIMENTO',registro->>'entidade',registro->>'entidadeId',CASE WHEN registro->>'entidade'='Usuário' THEN registro->>'entidadeId' END,
        'Permissões do Atendimento organizadas por seção e ação.','SUCESSO','ACESSO','migration:atendimento',fonte,registro->>'id')
      ON CONFLICT("fonteTabela","fonteId") DO NOTHING RETURNING id INTO novo;
      IF novo IS NULL THEN SELECT id INTO novo FROM "AtividadeUsuario" WHERE "fonteTabela"=fonte AND "fonteId"=registro->>'id'; END IF;
      RETURN novo;
    END IF;
    RETURN grazing_projetar_atividade_antes_hierarquia_20261021(fonte,registro);
   END $corpo$; $funcao$;
   EXECUTE $trigger$ CREATE OR REPLACE FUNCTION grazing_atividade_apos_auditoria() RETURNS trigger LANGUAGE plpgsql AS $corpo$
     BEGIN PERFORM grazing_projetar_atividade(TG_TABLE_NAME,to_jsonb(NEW)); RETURN NEW; END $corpo$; $trigger$;
 END IF;
END $projecao$;

CREATE TEMP TABLE IF NOT EXISTS atendimento_hierarquia_estado (granulares boolean NOT NULL) ON COMMIT DROP;
TRUNCATE pg_temp.atendimento_hierarquia_estado;
DO $readiness$
DECLARE definicao text; sinal boolean := false; tem_coluna boolean; hierarquia boolean; esperado text; filtro text;
BEGIN
  IF to_regclass('atendimento_integracao.identidade') IS NOT NULL THEN
    SELECT pg_get_viewdef('atendimento_integracao.identidade'::regclass,true) INTO definicao;
    SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='atendimento_integracao.identidade'::regclass
      AND attname='permissoesGranulares' AND NOT attisdropped) INTO tem_coluna;
    IF tem_coluna THEN
      IF definicao ~ ',[[:space:]]*true[[:space:]]+AS[[:space:]]+"permissoesGranulares"'
        AND definicao !~ ',[[:space:]]*false[[:space:]]+AS[[:space:]]+"permissoesGranulares"' THEN sinal := true;
      ELSIF definicao ~ ',[[:space:]]*false[[:space:]]+AS[[:space:]]+"permissoesGranulares"'
        AND definicao !~ ',[[:space:]]*true[[:space:]]+AS[[:space:]]+"permissoesGranulares"' THEN sinal := false;
      ELSE RAISE EXCEPTION 'ATENDIMENTO_READINESS_ESTRUTURA_NAO_RECONHECIDA'; END IF;
    END IF;
    SELECT EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='atendimento_integracao.identidade'::regclass
      AND attname='permissoesHierarquia' AND NOT attisdropped) INTO hierarquia;
    IF hierarquia IS DISTINCT FROM EXISTS(SELECT 1 FROM "McpEvento" WHERE id='atendimento-permissoes-hierarquia-20261021') THEN
      RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_READINESS_INCONSISTENTE';
    END IF;
    filtro := CASE WHEN hierarquia THEN
      'COALESCE((u."permissoesPersonalizadas"->''crm''->>''visualizar'')::boolean,(p.permissoes->''crm'') ? ''visualizar'',false)'
      ELSE 'CASE WHEN (p.permissoes ? ''crm.atendimento'') OR ((u."permissoesPersonalizadas"->''crm.atendimento'') ? ''visualizar'')
        THEN COALESCE((u."permissoesPersonalizadas"->''crm.atendimento''->>''visualizar'')::boolean,(p.permissoes->''crm.atendimento'') ? ''visualizar'',false)
        ELSE COALESCE((u."permissoesPersonalizadas"->''crm''->>''visualizar'')::boolean,(p.permissoes->''crm'') ? ''visualizar'',false) END' END;
    -- O parser do PostgreSQL normaliza o SQL oficial antes da comparação. Uma view
    -- customizada exige revisão; a migração não descarta silenciosamente seus filtros.
    esperado := 'SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",p.permissoes,u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm"'
      ||CASE WHEN tem_coluna THEN ','||sinal::text||' AS "permissoesGranulares"' ELSE '' END
      ||CASE WHEN hierarquia THEN ',true AS "permissoesHierarquia"' ELSE '' END
      ||' FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" WHERE u."excluidoEm" IS NULL AND (p.sistema=''ADMINISTRADOR'' OR '||filtro||')';
    EXECUTE 'CREATE OR REPLACE TEMP VIEW atendimento_hierarquia_view_esperada AS '||esperado;
    IF definicao IS DISTINCT FROM pg_get_viewdef('pg_temp.atendimento_hierarquia_view_esperada'::regclass,true) THEN
      RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_VIEW_ESTRUTURA_NAO_RECONHECIDA';
    END IF;
  END IF;
  INSERT INTO atendimento_hierarquia_estado VALUES(sinal);
END $readiness$;

CREATE TEMP TABLE IF NOT EXISTS atendimento_hierarquia_antigas(capacidade text PRIMARY KEY,recurso text,acao text,origem text) ON COMMIT DROP;
TRUNCATE pg_temp.atendimento_hierarquia_antigas;
INSERT INTO atendimento_hierarquia_antigas VALUES
 ('consultar','crm','visualizar','consultar'),('atender','crm','editar','atender'),
 ('mensagens.visualizar','crm.atendimento.mensagens','visualizar','consultar'),
 ('mensagens.adicionar','crm.atendimento.mensagens','adicionar','atender'),
 ('notas.visualizar','crm.atendimento.notas','visualizar','consultar'),
 ('notas.adicionar','crm.atendimento.notas','adicionar','atender'),
 ('etiquetas.visualizar','crm.atendimento.etiquetas','visualizar','consultar'),
 ('etiquetas.editar','crm.atendimento.etiquetas','editar','atender'),
 ('contatos.visualizar','crm.atendimento.contatos','visualizar','consultar'),
 ('agenda.visualizar','crm.atendimento.agenda','visualizar','consultar'),
 ('agenda.adicionar','crm.atendimento.agenda','adicionar','atender'),
 ('agenda.editar','crm.atendimento.agenda','editar','atender'),
 ('pipeline.visualizar','crm.atendimento.pipeline','visualizar','consultar'),
 ('pipeline.adicionar','crm.atendimento.pipeline','adicionar','atender'),
 ('pipeline.editar','crm.atendimento.pipeline','editar','atender'),
 ('duvidas.visualizar','crm.atendimento.duvidas','visualizar','consultar'),
 ('duvidas.adicionar','crm.atendimento.duvidas','adicionar','atender'),
 ('duvidas.editar','crm.atendimento.duvidas','editar','atender'),
 ('conhecimento.visualizar','crm.atendimento.conhecimento','visualizar','consultar'),
 ('conhecimento.adicionar','crm.atendimento.conhecimento','adicionar','conhecimento'),
 ('conhecimento.editar','crm.atendimento.conhecimento','editar','conhecimento'),
 ('conhecimento.excluir','crm.atendimento.conhecimento','excluir','conhecimento'),
 ('ia.visualizar','crm.atendimento.ia','visualizar','consultar'),
 ('ia.editar','crm.atendimento.ia','editar','configurar'),
 ('skills.visualizar','crm.atendimento.skills','visualizar','consultar'),
 ('skills.adicionar','crm.atendimento.skills','adicionar','configurar'),
 ('skills.editar','crm.atendimento.skills','editar','configurar'),
 ('skills.excluir','crm.atendimento.skills','excluir','configurar'),
 ('tom.visualizar','crm.atendimento.tom','visualizar','consultar'),
 ('tom.editar','crm.atendimento.tom','editar','configurar'),
 ('followup.visualizar','crm.atendimento.followup','visualizar','consultar'),
 ('followup.editar','crm.atendimento.followup','editar','configurar'),
 ('configuracao.visualizar','crm.atendimento.configuracoes','visualizar','consultar'),
 ('configurar','crm.atendimento.configuracoes','editar','configurar'),
 ('modelos.visualizar','crm.atendimento.modelos','visualizar','consultar'),
 ('automacoes.visualizar','crm.atendimento.automacoes','visualizar','consultar'),
 ('canais.visualizar','crm.atendimento.canais','visualizar','consultar'),
 ('equipe.visualizar','crm.atendimento.equipe','visualizar','consultar');

CREATE TEMP TABLE IF NOT EXISTS atendimento_hierarquia_novas(capacidade text PRIMARY KEY,recurso text,acao text,origens text[],ordem integer) ON COMMIT DROP;
TRUNCATE pg_temp.atendimento_hierarquia_novas;
INSERT INTO atendimento_hierarquia_novas VALUES
 ('conversas.visualizar','crm.atendimento.conversas','visualizar',ARRAY['consultar','contatos.visualizar'],1),
 ('conversas.adicionar','crm.atendimento.conversas','adicionar',ARRAY['consultar','contatos.visualizar','atender','mensagens.visualizar','mensagens.adicionar'],2),
 ('contatos.adicionar','crm.atendimento.contatos','adicionar',ARRAY['consultar','contatos.visualizar','atender'],3),
 ('contatos.editar','crm.atendimento.contatos','editar',ARRAY['consultar','contatos.visualizar','atender'],4),
 ('atalhos.visualizar','crm.atendimento.atalhos','visualizar',ARRAY['consultar'],5),
 ('atalhos.adicionar','crm.atendimento.atalhos','adicionar',ARRAY['consultar','atender'],6),
 ('atalhos.editar','crm.atendimento.atalhos','editar',ARRAY['consultar','atender'],7),
 ('atalhos.excluir','crm.atendimento.atalhos','excluir',ARRAY['consultar','atender'],8),
 ('lembretes.visualizar','crm.atendimento.lembretes','visualizar',ARRAY['consultar'],9),
 ('lembretes.adicionar','crm.atendimento.lembretes','adicionar',ARRAY['consultar','atender'],10),
 ('lembretes.editar','crm.atendimento.lembretes','editar',ARRAY['consultar','atender'],11),
 ('lembretes.excluir','crm.atendimento.lembretes','excluir',ARRAY['consultar','atender'],12),
 ('modelos.adicionar','crm.atendimento.modelos','adicionar',ARRAY['consultar','modelos.visualizar','configurar'],13),
 ('modelos.editar','crm.atendimento.modelos','editar',ARRAY['consultar','modelos.visualizar','configurar'],14),
 ('modelos.excluir','crm.atendimento.modelos','excluir',ARRAY['consultar','modelos.visualizar','configurar'],15),
 ('modelos.sincronizacao.visualizar','crm.atendimento.modelos.sincronizacao','visualizar',ARRAY['consultar','modelos.visualizar'],16),
 ('modelos.sincronizar','crm.atendimento.modelos.sincronizacao','editar',ARRAY['consultar','modelos.visualizar','configurar'],17),
 ('atividades.visualizar','crm.atendimento.atividades','visualizar',ARRAY['consultar'],18),
 ('atividades.equipe.visualizar','crm.atendimento.atividades.equipe','visualizar',ARRAY['consultar','configurar'],19);

CREATE OR REPLACE FUNCTION pg_temp.atendimento_h_valor(b jsonb,e jsonb,r text,a text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 SELECT COALESCE((e->r->>'visualizar')::boolean,(b->r) ? 'visualizar',false)
   AND COALESCE((e->r->>a)::boolean,(b->r) ? a,false)
$$;
CREATE OR REPLACE FUNCTION pg_temp.atendimento_h_legado(b jsonb,e jsonb,a text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE consulta text; operacao text;
BEGIN
 consulta := CASE WHEN b ? 'crm.atendimento' OR (e->'crm.atendimento') ? 'visualizar' THEN 'crm.atendimento' ELSE 'crm' END;
 operacao := CASE WHEN consulta='crm.atendimento' OR (e->'crm.atendimento') ? 'editar' THEN 'crm.atendimento' ELSE 'crm' END;
 RETURN pg_temp.atendimento_h_valor(b,e,CASE WHEN a='consultar' THEN consulta WHEN a='atender' THEN operacao ELSE 'crm.atendimento.configuracoes' END,
   CASE WHEN a='consultar' THEN 'visualizar' ELSE 'editar' END);
END $$;
CREATE OR REPLACE FUNCTION pg_temp.atendimento_h_antiga(b jsonb,e jsonb,g boolean,c text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE m record;
BEGIN
 IF NOT pg_temp.atendimento_h_legado(b,e,'consultar') THEN RETURN false; END IF;
 IF c IN('consultar','atender','configurar') THEN RETURN pg_temp.atendimento_h_legado(b,e,c); END IF;
 SELECT * INTO STRICT m FROM atendimento_hierarquia_antigas WHERE capacidade=c;
 IF g OR b ? m.recurso OR (e->m.recurso) ? 'visualizar' OR (e->m.recurso) ? m.acao THEN
   RETURN pg_temp.atendimento_h_valor(b,e,m.recurso,m.acao);
 END IF;
 RETURN pg_temp.atendimento_h_legado(b,e,m.origem);
END $$;
CREATE OR REPLACE FUNCTION pg_temp.atendimento_h_veto(b jsonb,e jsonb,g boolean,c text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE m record; consulta text; operacao text; r text; a text;
BEGIN
 consulta := CASE WHEN b ? 'crm.atendimento' OR (e->'crm.atendimento') ? 'visualizar' THEN 'crm.atendimento' ELSE 'crm' END;
 operacao := CASE WHEN consulta='crm.atendimento' OR (e->'crm.atendimento') ? 'editar' THEN 'crm.atendimento' ELSE 'crm' END;
 IF e->consulta->>'visualizar'='false' THEN RETURN true; END IF;
 SELECT * INTO STRICT m FROM atendimento_hierarquia_antigas WHERE capacidade=c;
 IF c IN('consultar','atender','configurar') OR NOT(g OR b ? m.recurso OR (e->m.recurso) ? 'visualizar' OR (e->m.recurso) ? m.acao) THEN
   r := CASE WHEN m.origem='consultar' THEN consulta WHEN m.origem='atender' THEN operacao ELSE 'crm.atendimento.configuracoes' END;
   a := CASE WHEN m.origem='consultar' THEN 'visualizar' ELSE 'editar' END;
 ELSE r := m.recurso; a := m.acao; END IF;
 RETURN COALESCE(e->r->>'visualizar'='false',false) OR COALESCE(e->r->>a='false',false);
END $$;
CREATE OR REPLACE FUNCTION pg_temp.atendimento_h_nova(b jsonb,e jsonb,g boolean,origens text[])
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT bool_and(pg_temp.atendimento_h_antiga(b,e,g,o)) FROM unnest(origens) o
$$;
CREATE OR REPLACE FUNCTION pg_temp.atendimento_h_depois(b jsonb,e jsonb,g boolean,c text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE m record;
BEGIN
 IF NOT pg_temp.atendimento_h_valor(b,e,'crm','visualizar') THEN RETURN false; END IF;
 IF c='consultar' THEN RETURN true; END IF;
 IF c='atender' THEN RETURN pg_temp.atendimento_h_valor(b,e,'crm','editar'); END IF;
 IF c='configurar' THEN RETURN pg_temp.atendimento_h_valor(b,e,'crm.atendimento.configuracoes','editar'); END IF;
 SELECT * INTO STRICT m FROM atendimento_hierarquia_antigas WHERE capacidade=c;
 IF g OR b ? m.recurso OR (e->m.recurso) ? 'visualizar' OR (e->m.recurso) ? m.acao THEN
   RETURN pg_temp.atendimento_h_valor(b,e,m.recurso,m.acao);
 END IF;
 RETURN pg_temp.atendimento_h_valor(b,e,CASE WHEN m.origem IN('consultar','atender') THEN 'crm' ELSE 'crm.atendimento.configuracoes' END,
   CASE WHEN m.origem='consultar' THEN 'visualizar' ELSE 'editar' END);
END $$;

DO $planejar$
DECLARE p record; u record; n record; a record; base jsonb; personalizada jsonb; esperado boolean; atual boolean; veto boolean;
 granulares boolean; contrato text; marcador text := 'atendimento-permissoes-hierarquia-20261021';
BEGIN
 -- Hash estrutural sem IDs de usuários. Uma reexecução com mapa diferente deve falhar.
 SELECT encode(sha256(convert_to('hierarquia-v1-canonico-crm'||E'\n'||string_agg(capacidade||'|'||recurso||'|'||acao||'|'||array_to_string(origens,','),E'\n' ORDER BY ordem),'UTF8')),'hex') INTO contrato FROM atendimento_hierarquia_novas;
 IF EXISTS(SELECT 1 FROM "McpEvento" WHERE id=marcador) THEN
   IF NOT EXISTS(SELECT 1 FROM "McpEvento" WHERE id=marcador AND ('contrato-sha256:'||contrato)=ANY(registros)) THEN
     RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_CONTRATO_DIVERGENTE';
   END IF;
   RETURN;
 END IF;
 SELECT estado.granulares INTO granulares FROM atendimento_hierarquia_estado estado;
 PERFORM id FROM "PerfilAcesso" ORDER BY id FOR UPDATE;
 PERFORM id FROM "Usuario" ORDER BY id FOR UPDATE;
 CREATE TEMP TABLE atendimento_hierarquia_perfis ON COMMIT DROP AS
   SELECT id,sistema,COALESCE(permissoes,'{}'::jsonb) AS antes,COALESCE(permissoes,'{}'::jsonb) AS depois FROM "PerfilAcesso";
 CREATE TEMP TABLE atendimento_hierarquia_usuarios ON COMMIT DROP AS
   SELECT id,COALESCE("permissoesPersonalizadas",'{}'::jsonb) AS antes,COALESCE("permissoesPersonalizadas",'{}'::jsonb) AS depois FROM "Usuario";

 FOR p IN SELECT * FROM atendimento_hierarquia_perfis WHERE sistema IS DISTINCT FROM 'ADMINISTRADOR' ORDER BY id LOOP
   base := p.antes;
   -- crm é a chave canônica da matriz/rota. O alias histórico fica intacto.
   base := base || jsonb_build_object('crm',
     (SELECT COALESCE(jsonb_agg(v),'[]'::jsonb) FROM jsonb_array_elements(COALESCE(base->'crm','[]'::jsonb)) v WHERE v NOT IN('"visualizar"'::jsonb,'"editar"'::jsonb))
     ||CASE WHEN pg_temp.atendimento_h_antiga(p.antes,'{}',granulares,'consultar') THEN '["visualizar"]'::jsonb ELSE '[]'::jsonb END
     ||CASE WHEN pg_temp.atendimento_h_antiga(p.antes,'{}',granulares,'atender') THEN '["editar"]'::jsonb ELSE '[]'::jsonb END);
   -- Preserva a leitura antiga ao materializar ações dentro de recursos históricos.
   FOR a IN SELECT * FROM atendimento_hierarquia_antigas WHERE capacidade IN('contatos.visualizar','modelos.visualizar') LOOP
     IF NOT(base ? a.recurso) THEN
       base := base || jsonb_build_object(a.recurso,CASE WHEN pg_temp.atendimento_h_antiga(p.antes,'{}',granulares,a.capacidade) THEN '["visualizar"]'::jsonb ELSE '[]'::jsonb END);
     END IF;
   END LOOP;
   FOR n IN SELECT * FROM atendimento_hierarquia_novas ORDER BY ordem LOOP
     esperado := pg_temp.atendimento_h_nova(p.antes,'{}',granulares,n.origens);
     IF (p.antes ? n.recurso AND NOT EXISTS(SELECT 1 FROM atendimento_hierarquia_antigas WHERE recurso=n.recurso))
       OR COALESCE((p.antes->n.recurso) ? n.acao,false) THEN
       IF pg_temp.atendimento_h_valor(p.antes,'{}',n.recurso,n.acao) IS DISTINCT FROM esperado THEN
         RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_DECISAO_FORWARD_CONFLITANTE: perfil, recurso %, acao %',n.recurso,n.acao;
       END IF;
     END IF;
     IF esperado AND NOT COALESCE((base->n.recurso) ? n.acao,false) THEN
       base := base || jsonb_build_object(n.recurso,COALESCE(base->n.recurso,'[]'::jsonb)||to_jsonb(n.acao));
     ELSIF NOT(base ? n.recurso) THEN base := base || jsonb_build_object(n.recurso,'[]'::jsonb); END IF;
   END LOOP;
   FOR a IN SELECT * FROM atendimento_hierarquia_antigas LOOP
     IF pg_temp.atendimento_h_antiga(p.antes,'{}',granulares,a.capacidade) IS DISTINCT FROM pg_temp.atendimento_h_depois(base,'{}',granulares,a.capacidade) THEN
       RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_EQUIVALENCIA_PERFIL_FALHOU: %',a.capacidade;
     END IF;
   END LOOP;
   FOR n IN SELECT * FROM atendimento_hierarquia_novas LOOP
     esperado := pg_temp.atendimento_h_nova(p.antes,'{}',granulares,n.origens);
     IF esperado IS DISTINCT FROM (pg_temp.atendimento_h_valor(base,'{}','crm','visualizar') AND pg_temp.atendimento_h_valor(base,'{}',n.recurso,n.acao)) THEN
       RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_EQUIVALENCIA_PERFIL_NOVO_FALHOU: %',n.capacidade;
     END IF;
   END LOOP;
   UPDATE atendimento_hierarquia_perfis SET depois=base WHERE id=p.id;
 END LOOP;

 FOR u IN SELECT usuarios.id,usuarios.antes,COALESCE(perfil_plano.antes,'{}'::jsonb) AS base_antes,COALESCE(perfil_plano.depois,'{}'::jsonb) AS base_depois,perfil_plano.sistema
   FROM atendimento_hierarquia_usuarios usuarios JOIN "Usuario" usuario ON usuario.id=usuarios.id
   LEFT JOIN atendimento_hierarquia_perfis perfil_plano ON perfil_plano.id=usuario."perfilAcessoId" ORDER BY usuarios.id LOOP
   IF u.sistema='ADMINISTRADOR' THEN CONTINUE; END IF;
   personalizada := u.antes - 'crm';
   IF ((u.antes->'crm') - 'visualizar' - 'editar') <> '{}'::jsonb THEN
     personalizada := personalizada || jsonb_build_object('crm',(u.antes->'crm') - 'visualizar' - 'editar');
   END IF;
   FOR a IN SELECT * FROM atendimento_hierarquia_antigas WHERE capacidade IN('consultar','atender') LOOP
     esperado := pg_temp.atendimento_h_antiga(u.base_antes,u.antes,granulares,a.capacidade);
     IF esperado IS DISTINCT FROM COALESCE((u.base_depois->'crm') ? a.acao,false)
       OR (NOT esperado AND pg_temp.atendimento_h_veto(u.base_antes,u.antes,granulares,a.capacidade)) THEN
       personalizada := personalizada || jsonb_build_object('crm',COALESCE(personalizada->'crm','{}'::jsonb)||jsonb_build_object(a.acao,esperado));
     END IF;
   END LOOP;
   FOR a IN SELECT * FROM atendimento_hierarquia_antigas WHERE capacidade IN('contatos.visualizar','modelos.visualizar') LOOP
     esperado := pg_temp.atendimento_h_antiga(u.base_antes,u.antes,granulares,a.capacidade);
     IF pg_temp.atendimento_h_valor(u.base_depois,personalizada,a.recurso,a.acao) IS DISTINCT FROM esperado THEN
       personalizada := personalizada || jsonb_build_object(a.recurso,COALESCE(personalizada->a.recurso,'{}'::jsonb)||jsonb_build_object(a.acao,esperado));
     END IF;
   END LOOP;
   FOR n IN SELECT * FROM atendimento_hierarquia_novas ORDER BY ordem LOOP
     esperado := pg_temp.atendimento_h_nova(u.base_antes,u.antes,granulares,n.origens);
     IF (u.antes->n.recurso) ? n.acao AND (u.antes->n.recurso->>n.acao)::boolean IS DISTINCT FROM esperado THEN
       RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_DECISAO_FORWARD_CONFLITANTE: excecao, recurso %, acao %',n.recurso,n.acao;
     END IF;
     atual := pg_temp.atendimento_h_valor(u.base_depois,personalizada,'crm','visualizar') AND pg_temp.atendimento_h_valor(u.base_depois,personalizada,n.recurso,n.acao);
     SELECT bool_or(pg_temp.atendimento_h_veto(u.base_antes,u.antes,granulares,o)) INTO veto FROM unnest(n.origens) o;
     IF atual IS DISTINCT FROM esperado OR (NOT esperado AND veto) THEN
       personalizada := personalizada || jsonb_build_object(n.recurso,COALESCE(personalizada->n.recurso,'{}'::jsonb)||jsonb_build_object(n.acao,esperado));
     END IF;
   END LOOP;
   -- O plano precisa manter todas as decisões anteriores e as conjunções novas.
   FOR a IN SELECT * FROM atendimento_hierarquia_antigas LOOP
     IF pg_temp.atendimento_h_antiga(u.base_antes,u.antes,granulares,a.capacidade) IS DISTINCT FROM pg_temp.atendimento_h_depois(u.base_depois,personalizada,granulares,a.capacidade) THEN
       RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_EQUIVALENCIA_ANTIGA_FALHOU: %',a.capacidade;
     END IF;
   END LOOP;
   FOR n IN SELECT * FROM atendimento_hierarquia_novas LOOP
     esperado := pg_temp.atendimento_h_nova(u.base_antes,u.antes,granulares,n.origens);
     IF esperado IS DISTINCT FROM (pg_temp.atendimento_h_valor(u.base_depois,personalizada,'crm','visualizar') AND pg_temp.atendimento_h_valor(u.base_depois,personalizada,n.recurso,n.acao)) THEN
       RAISE EXCEPTION 'ATENDIMENTO_HIERARQUIA_EQUIVALENCIA_NOVA_FALHOU: %',n.capacidade;
     END IF;
   END LOOP;
   UPDATE atendimento_hierarquia_usuarios SET depois=personalizada WHERE id=u.id;
 END LOOP;

 -- Nenhuma gravação de perfil/usuário ocorre antes de validar o plano completo.
 UPDATE "PerfilAcesso" perfil SET permissoes=plano.depois,"updatedAt"=clock_timestamp()
   FROM atendimento_hierarquia_perfis plano WHERE perfil.id=plano.id AND plano.antes IS DISTINCT FROM plano.depois;
 UPDATE "Usuario" usuario SET "permissoesPersonalizadas"=plano.depois,"updatedAt"=clock_timestamp()
   FROM atendimento_hierarquia_usuarios plano WHERE usuario.id=plano.id AND plano.antes IS DISTINCT FROM plano.depois;
 INSERT INTO "HistoricoAcesso"(id,"autorId",entidade,"entidadeId",acao,antes,depois)
   SELECT 'atendimento-hierarquia-perfil-'||md5(id),'migration:atendimento','Perfil',id,'HIERARQUIZAR_PERMISSOES_ATENDIMENTO',
     jsonb_build_object('permissoes',antes),jsonb_build_object('permissoes',depois)
   FROM atendimento_hierarquia_perfis WHERE antes IS DISTINCT FROM depois;
 INSERT INTO "HistoricoAcesso"(id,"autorId",entidade,"entidadeId",acao,antes,depois)
   SELECT 'atendimento-hierarquia-usuario-'||md5(id),'migration:atendimento','Usuário',id,'HIERARQUIZAR_PERMISSOES_ATENDIMENTO',
     jsonb_build_object('permissoesPersonalizadas',antes),jsonb_build_object('permissoesPersonalizadas',depois)
   FROM atendimento_hierarquia_usuarios WHERE antes IS DISTINCT FROM depois;
 INSERT INTO "McpEvento"(id,correlacao,acao,resultado,"duracaoMs",registros)
   VALUES(marcador,'migration:atendimento','HIERARQUIZAR_PERMISSOES_ATENDIMENTO','OK',0,ARRAY['contrato-sha256:'||contrato,'sessoes-preservadas']);
END $planejar$;

-- O filtro passa a usar a chave canônica já materializada. A comparação estrutural
-- inicial impede substituir filtros desconhecidos. Owner, grants e colunas ficam.
DO $view$
DECLARE definicao text; fim text; opcoes text;
BEGIN
 IF to_regclass('atendimento_integracao.identidade') IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM pg_attribute WHERE attrelid='atendimento_integracao.identidade'::regclass AND attname='permissoesHierarquia' AND NOT attisdropped) THEN
   SELECT regexp_replace(pg_get_viewdef('pg_temp.atendimento_hierarquia_view_esperada'::regclass,true),';[[:space:]]*$','') INTO definicao;
   -- O SELECT oficial tem um único WHERE. Conserva a projeção e troca somente a
   -- expressão de acesso, após validar igualdade com a definição conhecida.
   fim := ' WHERE u."excluidoEm" IS NULL AND (p.sistema=''ADMINISTRADOR'' OR COALESCE((u."permissoesPersonalizadas"->''crm''->>''visualizar'')::boolean,(p.permissoes->''crm'') ? ''visualizar'',false))';
   definicao := regexp_replace(definicao,'[[:space:]]+WHERE[[:space:]].*$','','s');
   definicao := regexp_replace(definicao,'[[:space:]]+FROM[[:space:]]',',true AS "permissoesHierarquia" FROM ','');
   SELECT array_to_string(reloptions,',') INTO opcoes FROM pg_class WHERE oid='atendimento_integracao.identidade'::regclass;
   EXECUTE 'CREATE OR REPLACE VIEW atendimento_integracao.identidade'
     ||CASE WHEN opcoes IS NOT NULL THEN ' WITH ('||opcoes||')' ELSE '' END||' AS '||definicao||fim;
 END IF;
END $view$;
COMMIT;
