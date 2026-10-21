-- Executar na transação do executor de migrations aprovado. Sem COMMIT interno.
-- Lote autorizado: clientes-email-20261019. Nenhum snapshot fiscal/comercial é refeito.
SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'));
LOCK TABLE "ClienteVenda", "PedidoVenda" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "CreditoClienteMovimento" IN SHARE MODE;
DO $$ BEGIN PERFORM id FROM "ClienteVenda" ORDER BY id FOR UPDATE; END $$;
DROP TABLE IF EXISTS pg_temp._clientes_email_pedidos,pg_temp._clientes_email_alvos,pg_temp._clientes_email_regras,pg_temp._clientes_email_enderecos,
  pg_temp._clientes_email_grupos,pg_temp._clientes_email_mapa,pg_temp._clientes_email_raizes,
  pg_temp._clientes_email_componentes,pg_temp._clientes_email_arestas,pg_temp._clientes_email_base;

CREATE OR REPLACE FUNCTION grazing_cliente_email_chave(valor text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path FROM CURRENT AS $$
  SELECT nullif(lower(btrim(valor)), '');
$$;
CREATE OR REPLACE FUNCTION grazing_cliente_documento_chave(valor text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path FROM CURRENT AS $$
  SELECT nullif(regexp_replace(coalesce(valor, ''), '[^0-9]', '', 'g'), '');
$$;
CREATE OR REPLACE FUNCTION grazing_cliente_documento_efetivo(tipo text, documento text, enderecos jsonb) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path FROM CURRENT AS $$
  SELECT coalesce(grazing_cliente_documento_chave(documento),
    CASE WHEN enderecos->0->>'tipo' = tipo THEN grazing_cliente_documento_chave(enderecos->0->>'documento') END);
$$;

-- Infraestrutura SQL dos triggers; não é um cadastro de negócio nem uma carteira.
-- A escrita real na linha detecta snapshots REPEATABLE READ anteriores à espera.
CREATE TABLE IF NOT EXISTS "ClienteIdentidadeSerializacao" (
  id integer PRIMARY KEY CHECK (id = 1),
  versao bigint NOT NULL DEFAULT 0
);
INSERT INTO "ClienteIdentidadeSerializacao" (id) VALUES (1) ON CONFLICT DO NOTHING;
UPDATE "ClienteIdentidadeSerializacao" SET versao = versao + 1 WHERE id = 1;
COMMENT ON TABLE "ClienteIdentidadeSerializacao" IS 'Infraestrutura pertencente à migration clientes_identidade_email: serialização de reservas de identidade inclusive em REPEATABLE READ. Sem dados pessoais.';

DROP TRIGGER IF EXISTS cliente_identidade_trava ON "ClienteVenda";
DROP TRIGGER IF EXISTS cliente_identidade_validar ON "ClienteVenda";
DROP TRIGGER IF EXISTS pedido_cliente_canonico ON "PedidoVenda";
DROP TRIGGER IF EXISTS pedido_cliente_trava ON "PedidoVenda";

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ClienteVenda" WHERE tipo NOT IN ('PF', 'PJ') OR jsonb_typeof(enderecos) <> 'array') THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_FORMATO_ORIGEM_INVALIDO';
  END IF;
  IF EXISTS (SELECT 1 FROM "ClienteVenda" c CROSS JOIN LATERAL jsonb_array_elements(c.enderecos) e WHERE jsonb_typeof(e.value)<>'object') THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_ENDERECO_ORIGEM_INVALIDO';
  END IF;
  IF EXISTS (SELECT 1 FROM "ClienteVenda" WHERE grazing_cliente_email_chave(email) IS NOT NULL
    AND (length(grazing_cliente_email_chave(email))>254 OR grazing_cliente_email_chave(email)!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_EMAIL_ORIGEM_INVALIDO';
  END IF;
  IF EXISTS (
    WITH RECURSIVE caminho AS (
      SELECT id AS origem, id AS atual, "unificadoEmId" AS proximo, ARRAY[id] AS visitados, false AS ciclo FROM "ClienteVenda"
      UNION ALL
      SELECT c.origem, a.id, a."unificadoEmId", c.visitados || a.id, a.id = ANY(c.visitados)
      FROM caminho c JOIN "ClienteVenda" a ON a.id = c.proximo WHERE NOT c.ciclo
    ) SELECT 1 FROM caminho WHERE ciclo
  ) THEN RAISE EXCEPTION 'CLIENTES_EMAIL_CICLO_ALIAS'; END IF;
  IF EXISTS (SELECT 1 FROM "ClienteVenda" c LEFT JOIN "ClienteVenda" a ON a.id = c."unificadoEmId" WHERE c."unificadoEmId" IS NOT NULL AND a.id IS NULL) THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_ALIAS_SEM_DESTINO';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ClienteVenda" c
    WHERE coalesce(nullif(btrim(c.documento),''),CASE WHEN c.enderecos->0->>'tipo'=c.tipo THEN c.enderecos->0->>'documento' END) ~ '[^0-9./[:space:]\-]'
       OR (grazing_cliente_documento_efetivo(c.tipo,c.documento,c.enderecos) IS NOT NULL
           AND length(grazing_cliente_documento_efetivo(c.tipo,c.documento,c.enderecos)) <> CASE WHEN c.tipo='PF' THEN 11 ELSE 14 END)
  ) THEN RAISE EXCEPTION 'CLIENTES_EMAIL_DOCUMENTO_ORIGEM_INVALIDO'; END IF;
END $$;

CREATE TEMP TABLE _clientes_email_base ON COMMIT DROP AS
WITH RECURSIVE caminho AS (
  SELECT id AS origem, id AS atual, "unificadoEmId" AS proximo FROM "ClienteVenda"
  UNION ALL
  SELECT c.origem,a.id,a."unificadoEmId" FROM caminho c JOIN "ClienteVenda" a ON a.id=c.proximo
)
SELECT c.*, r.atual AS raiz_original, grazing_cliente_email_chave(c.email) AS email_chave,
       grazing_cliente_documento_efetivo(c.tipo,c.documento,c.enderecos) AS documento_chave,
       to_jsonb(c) AS antes
FROM "ClienteVenda" c JOIN caminho r ON r.origem=c.id AND r.proximo IS NULL;
CREATE UNIQUE INDEX ON _clientes_email_base(id);
CREATE TEMP TABLE _clientes_email_arestas ON COMMIT DROP AS
SELECT DISTINCT a.raiz_original AS a,b.raiz_original AS b
FROM _clientes_email_base a JOIN _clientes_email_base b ON a.raiz_original<>b.raiz_original
 AND ((a.email_chave IS NOT NULL AND a.email_chave=b.email_chave)
   OR (a.documento_chave IS NOT NULL AND a.documento_chave=b.documento_chave));
CREATE INDEX ON _clientes_email_arestas(a);
CREATE TEMP TABLE _clientes_email_componentes ON COMMIT DROP AS
WITH RECURSIVE alcances(raiz,membro) AS (
  SELECT DISTINCT raiz_original,raiz_original FROM _clientes_email_base
  UNION
  SELECT a.raiz,e.b FROM alcances a JOIN _clientes_email_arestas e ON e.a=a.membro
)
SELECT membro AS raiz_original,min(raiz) AS componente FROM alcances GROUP BY membro;
CREATE TEMP TABLE _clientes_email_raizes ON COMMIT DROP AS
WITH candidatos AS (
  SELECT b.id,c.componente,
    row_number() OVER (PARTITION BY c.componente ORDER BY
      (b.tipo='PJ' AND b.documento_chave IS NOT NULL) DESC,
      (SELECT count(*) FROM "PedidoVenda" p JOIN _clientes_email_base s ON s.id=p."clienteId"
       WHERE s.raiz_original=b.id AND p.status NOT IN ('HISTORICO','HISTORICO_REVERTIDO')) DESC,
      (SELECT count(*) FROM jsonb_each(b.antes) j WHERE j.key IN ('nome','email','telefone','documento','razaoSocial','inscricaoEstadual','contato','dataNascimento')
       AND j.value NOT IN ('null'::jsonb,'""'::jsonb)) + jsonb_array_length(b.enderecos) DESC,
      b."createdAt",b.id) AS posicao
  FROM _clientes_email_base b JOIN _clientes_email_componentes c ON c.raiz_original=b.id
  WHERE b.id=b.raiz_original
)
SELECT componente,id AS canonico FROM candidatos WHERE posicao=1;
CREATE TEMP TABLE _clientes_email_mapa ON COMMIT DROP AS
SELECT b.id,b.raiz_original,c.componente,r.canonico FROM _clientes_email_base b
JOIN _clientes_email_componentes c USING(raiz_original) JOIN _clientes_email_raizes r USING(componente);
CREATE UNIQUE INDEX ON _clientes_email_mapa(id);
CREATE TEMP TABLE _clientes_email_grupos ON COMMIT DROP AS
SELECT canonico,count(DISTINCT m.raiz_original)>1 OR bool_or(b."unificadoEmId" IS NOT NULL AND b."unificadoEmId"<>m.canonico) AS consolidar
FROM _clientes_email_mapa m JOIN _clientes_email_base b USING(id) GROUP BY canonico;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM _clientes_email_base b JOIN _clientes_email_mapa m USING(id) JOIN _clientes_email_grupos g USING(canonico)
    WHERE g.consolidar AND b."formasPagamentoHabilitadas" IS NOT NULL AND b."formasPagamentoHabilitadas"<>'null'::jsonb
    AND jsonb_typeof(b."formasPagamentoHabilitadas")<>'array') THEN RAISE EXCEPTION 'CLIENTES_EMAIL_REGRAS_PAGAMENTO_INVALIDAS'; END IF;
  IF EXISTS (SELECT 1 FROM _clientes_email_base b JOIN _clientes_email_mapa m USING(id) JOIN _clientes_email_grupos g USING(canonico)
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN g.consolidar THEN coalesce(nullif(b."formasPagamentoHabilitadas",'null'::jsonb),'[]'::jsonb) ELSE '[]'::jsonb END) f
    WHERE jsonb_typeof(f.value)<>'string' OR nullif(f.value#>>'{}','') IS NULL OR NOT EXISTS(SELECT 1 FROM "FormaPagamentoVenda" p WHERE p.id=f.value#>>'{}')) THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_FORMA_PAGAMENTO_SEM_MAPEAMENTO';
  END IF;
  IF EXISTS (SELECT 1 FROM _clientes_email_base b JOIN _clientes_email_mapa m USING(id) JOIN _clientes_email_grupos g USING(canonico)
    WHERE g.consolidar AND ("limiteCreditoAberto"<0 OR "boletoDiasAposEntrega"<0)) THEN RAISE EXCEPTION 'CLIENTES_EMAIL_REGRAS_PAGAMENTO_INVALIDAS'; END IF;
END $$;
CREATE TEMP TABLE _clientes_email_regras ON COMMIT DROP AS
SELECT m.canonico,bool_or(b.ativo) AS ativo,min(b."limiteCreditoAberto") AS limite,min(b."boletoDiasAposEntrega") AS prazo,
  CASE WHEN count(*) FILTER(WHERE b."formasPagamentoHabilitadas" IS NOT NULL AND b."formasPagamentoHabilitadas"<>'null'::jsonb)=0 THEN NULL
  ELSE (SELECT coalesce(jsonb_agg(to_jsonb(chave) ORDER BY chave),'[]'::jsonb) FROM (
    SELECT DISTINCT f.value#>>'{}' AS chave FROM _clientes_email_mapa mx JOIN _clientes_email_base bx ON bx.id=mx.id
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(nullif(bx."formasPagamentoHabilitadas",'null'::jsonb),'[]'::jsonb)) f
    WHERE mx.canonico=m.canonico AND NOT EXISTS(
      SELECT 1 FROM _clientes_email_mapa my JOIN _clientes_email_base byy ON byy.id=my.id WHERE my.canonico=m.canonico
        AND byy."formasPagamentoHabilitadas" IS NOT NULL AND byy."formasPagamentoHabilitadas"<>'null'::jsonb
        AND NOT (byy."formasPagamentoHabilitadas" ? (f.value#>>'{}')))
  ) intersecao) END AS formas
FROM _clientes_email_mapa m JOIN _clientes_email_base b USING(id) JOIN _clientes_email_grupos g USING(canonico) WHERE g.consolidar GROUP BY m.canonico;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "CreditoClienteMovimento" c JOIN _clientes_email_mapa m ON m.id=c."clienteId"
      JOIN _clientes_email_grupos g USING(canonico) WHERE g.consolidar) THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_CREDITO_EXISTENTE';
  END IF;
  IF EXISTS (SELECT 1 FROM "PedidoVenda" p LEFT JOIN _clientes_email_mapa r ON r.id=p.rascunho->>'clienteId'
    WHERE jsonb_typeof(p.rascunho)='object' AND nullif(p.rascunho->>'clienteId','') IS NOT NULL AND r.id IS NULL) THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_RASCUNHO_CLIENTE_DESCONHECIDO';
  END IF;
  IF EXISTS (SELECT 1 FROM "PedidoVenda" p JOIN _clientes_email_mapa a ON a.id=p."clienteId"
    JOIN _clientes_email_mapa b ON b.id=p.rascunho->>'clienteId' WHERE a.canonico<>b.canonico) THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_RASCUNHO_RAIZES_DIVERGENTES';
  END IF;
  -- Mantém documento_key global. Não transfere nem apaga a reserva de aliases.
  IF EXISTS (SELECT 1 FROM _clientes_email_raizes r JOIN _clientes_email_base b ON b.id=r.canonico
    JOIN _clientes_email_base outro ON outro.id<>b.id AND outro.documento=b.documento_chave
    WHERE b.documento_chave IS NOT NULL) THEN
    RAISE EXCEPTION 'CLIENTES_EMAIL_DOCUMENTO_GLOBAL_COLISAO_ALIAS';
  END IF;
END $$;

CREATE TEMP TABLE _clientes_email_enderecos(canonico text PRIMARY KEY,enderecos jsonb NOT NULL) ON COMMIT DROP;
DO $$
DECLARE raiz record; origem record; endereco record; principal jsonb; identidade jsonb; candidato jsonb; lista jsonb; modelo jsonb;
BEGIN
  modelo := jsonb_build_object('nome','Principal','destinatario','','pais','Brasil','cep','','logradouro','','numero','','complemento','','bairro','','cidade','','uf','');
  FOR raiz IN SELECT b.*,g.consolidar FROM _clientes_email_raizes r JOIN _clientes_email_base b ON b.id=r.canonico JOIN _clientes_email_grupos g ON g.canonico=r.canonico ORDER BY b.id LOOP
    IF NOT raiz.consolidar THEN
      INSERT INTO _clientes_email_enderecos VALUES(raiz.id,raiz.enderecos); CONTINUE;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM _clientes_email_mapa m JOIN _clientes_email_base b USING(id) WHERE m.canonico=raiz.id AND jsonb_array_length(b.enderecos)>0) THEN
      INSERT INTO _clientes_email_enderecos VALUES(raiz.id,'[]'); CONTINUE;
    END IF;
    principal := coalesce(raiz.enderecos->0,'{}'::jsonb);
    identidade := jsonb_build_object('tipo',raiz.tipo,'nomeCompleto',CASE WHEN raiz.tipo='PF' THEN raiz.nome ELSE '' END,'documento',coalesce(raiz.documento_chave,''),
      'razaoSocial',CASE WHEN raiz.tipo='PJ' THEN coalesce(nullif(raiz."razaoSocial",''),CASE WHEN principal->>'tipo'=raiz.tipo THEN principal->>'razaoSocial' END,'') ELSE '' END,
      'inscricaoEstadual',CASE WHEN raiz.tipo='PJ' THEN coalesce(nullif(raiz."inscricaoEstadual",''),CASE WHEN principal->>'tipo'=raiz.tipo THEN principal->>'inscricaoEstadual' END,'') ELSE '' END,
      'inscricaoMunicipal',CASE WHEN raiz.tipo='PJ' AND principal->>'tipo'=raiz.tipo THEN coalesce(principal->>'inscricaoMunicipal','') ELSE '' END);
    lista := jsonb_build_array(modelo || principal || identidade || jsonb_build_object('nome','Principal'));
    FOR origem IN SELECT b.* FROM _clientes_email_mapa m JOIN _clientes_email_base b USING(id) WHERE m.canonico=raiz.id ORDER BY (b.id=raiz.id) DESC,b."createdAt",b.id LOOP
      FOR endereco IN SELECT value,ordinality FROM jsonb_array_elements(origem.enderecos) WITH ORDINALITY LOOP
        IF jsonb_typeof(endereco.value)<>'object' THEN RAISE EXCEPTION 'CLIENTES_EMAIL_ENDERECO_ORIGEM_INVALIDO'; END IF;
        IF endereco.value->>'tipo' IN ('PF','PJ') AND NOT (endereco.ordinality=1 AND endereco.value->>'tipo'=origem.tipo) THEN
          candidato := modelo || endereco.value;
        ELSE
          candidato := modelo || endereco.value || jsonb_build_object('tipo',origem.tipo,'nomeCompleto',CASE WHEN origem.tipo='PF' THEN origem.nome ELSE '' END,
            'documento',coalesce(origem.documento_chave,''),'razaoSocial',CASE WHEN origem.tipo='PJ' THEN coalesce(nullif(origem."razaoSocial",''),endereco.value->>'razaoSocial','') ELSE '' END,
            'inscricaoEstadual',CASE WHEN origem.tipo='PJ' THEN coalesce(nullif(origem."inscricaoEstadual",''),endereco.value->>'inscricaoEstadual','') ELSE '' END,
            'inscricaoMunicipal',CASE WHEN origem.tipo='PJ' THEN coalesce(endereco.value->>'inscricaoMunicipal','') ELSE '' END);
        END IF;
        -- Campos vazios explícitos permitem comparar a identidade sem perder destinatário.
        candidato := jsonb_build_object('nomeCompleto','','documento','','razaoSocial','','inscricaoEstadual','','inscricaoMunicipal','') || candidato;
        IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(lista) e WHERE e.value-'nome'=candidato-'nome') THEN
          IF jsonb_array_length(lista)>=20 THEN RAISE EXCEPTION 'CLIENTES_EMAIL_LIMITE_COBRANCAS'; END IF;
          lista := lista || jsonb_build_array(candidato || jsonb_build_object('nome','Cobrança '||(jsonb_array_length(lista)+1)));
        END IF;
      END LOOP;
    END LOOP;
    INSERT INTO _clientes_email_enderecos VALUES(raiz.id,lista);
  END LOOP;
END $$;

SELECT set_config('grazing.atividade','{"origem":"AUTOMACAO","atorTipo":"SISTEMA","atorReferencia":"sistema:clientes-email-20261019","correlacaoId":"clientes-email-20261019"}',true);
CREATE TEMP TABLE _clientes_email_alvos ON COMMIT DROP AS
SELECT b.id,b.antes,m.canonico,
  CASE WHEN b.id=m.canonico THEN coalesce(b.email_chave,(SELECT s.email_chave FROM _clientes_email_mapa x JOIN _clientes_email_base s USING(id) WHERE x.canonico=m.canonico AND s.email_chave IS NOT NULL ORDER BY s."createdAt",s.id LIMIT 1)) ELSE b.email_chave END AS email,
  CASE WHEN b.id=m.canonico THEN b.documento_chave ELSE b.documento END AS documento,
  CASE WHEN b.id=m.canonico THEN e.enderecos ELSE b.enderecos END AS enderecos,
  CASE WHEN b.id=m.canonico THEN NULL ELSE m.canonico END AS unificado,
  CASE WHEN g.consolidar THEN CASE WHEN b.id=m.canonico THEN r.ativo ELSE false END ELSE b.ativo END AS ativo,
  CASE WHEN b.id=m.canonico AND g.consolidar THEN r.limite ELSE b."limiteCreditoAberto" END AS limite,
  CASE WHEN b.id=m.canonico AND g.consolidar THEN r.prazo ELSE b."boletoDiasAposEntrega" END AS prazo,
  CASE WHEN b.id=m.canonico AND g.consolidar THEN r.formas ELSE b."formasPagamentoHabilitadas" END AS formas
FROM _clientes_email_base b JOIN _clientes_email_mapa m USING(id) JOIN _clientes_email_enderecos e ON e.canonico=m.canonico
JOIN _clientes_email_grupos g ON g.canonico=m.canonico LEFT JOIN _clientes_email_regras r ON r.canonico=m.canonico;
WITH alterados AS (
  UPDATE "ClienteVenda" c SET email=a.email,documento=a.documento,enderecos=a.enderecos,"unificadoEmId"=a.unificado,ativo=a.ativo,
    "limiteCreditoAberto"=a.limite,"boletoDiasAposEntrega"=a.prazo,"formasPagamentoHabilitadas"=a.formas,versao=c.versao+1,"updatedAt"=CURRENT_TIMESTAMP
  FROM _clientes_email_alvos a WHERE c.id=a.id AND
    ROW(c.email,c.documento,c.enderecos,c."unificadoEmId",c.ativo,c."limiteCreditoAberto",c."boletoDiasAposEntrega",c."formasPagamentoHabilitadas")
      IS DISTINCT FROM ROW(a.email,a.documento,a.enderecos,a.unificado,a.ativo,a.limite,a.prazo,a.formas)
  RETURNING c.*
)
INSERT INTO "HistoricoCadastroVenda"(id,entidade,"registroId","usuarioId","usuarioNome",antes,depois,"createdAt")
SELECT 'clientes-email-20261019:cliente:'||c.id,'CLIENTE',c.id,'sistema:clientes-email-20261019','Automação autorizada',a.antes,to_jsonb(c),CURRENT_TIMESTAMP
FROM alterados c JOIN _clientes_email_alvos a USING(id);

CREATE TEMP TABLE _clientes_email_pedidos ON COMMIT DROP AS
SELECT p.id,to_jsonb(p) AS antes,a.canonico AS cliente,
  CASE WHEN jsonb_typeof(p.rascunho)='object' AND r.canonico IS NOT NULL AND p.rascunho->>'clienteId' IS DISTINCT FROM r.canonico
    THEN jsonb_set(p.rascunho,'{clienteId}',to_jsonb(r.canonico),false) ELSE p.rascunho END AS rascunho
FROM "PedidoVenda" p LEFT JOIN _clientes_email_mapa a ON a.id=p."clienteId" LEFT JOIN _clientes_email_mapa r ON r.id=p.rascunho->>'clienteId';
WITH alterados AS (
  UPDATE "PedidoVenda" p SET "clienteId"=a.cliente,rascunho=a.rascunho,versao=p.versao+1,"updatedAt"=CURRENT_TIMESTAMP
  FROM _clientes_email_pedidos a WHERE p.id=a.id AND ROW(p."clienteId",p.rascunho) IS DISTINCT FROM ROW(a.cliente,a.rascunho)
  RETURNING p.*
)
INSERT INTO "HistoricoCadastroVenda"(id,entidade,"registroId","usuarioId","usuarioNome",antes,depois,"createdAt")
SELECT 'clientes-email-20261019:pedido:'||p.id,'PEDIDO_IDENTIDADE_CLIENTE',p.id,'sistema:clientes-email-20261019','Automação autorizada',a.antes,to_jsonb(p),CURRENT_TIMESTAMP
FROM alterados p JOIN _clientes_email_pedidos a USING(id);

CREATE UNIQUE INDEX IF NOT EXISTS "ClienteVenda_email_canonico_key" ON "ClienteVenda"(grazing_cliente_email_chave(email))
  WHERE "unificadoEmId" IS NULL AND grazing_cliente_email_chave(email) IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ClienteVenda_documento_efetivo_canonico_key" ON "ClienteVenda"(grazing_cliente_documento_efetivo(tipo,documento,enderecos))
  WHERE "unificadoEmId" IS NULL AND grazing_cliente_documento_efetivo(tipo,documento,enderecos) IS NOT NULL;

CREATE OR REPLACE FUNCTION grazing_cliente_identidade_trava() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$ BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('vendas-cadastros'));
  UPDATE "ClienteIdentidadeSerializacao" SET versao=versao+1 WHERE id=1;
  IF NOT FOUND THEN RAISE EXCEPTION 'CLIENTE_IDENTIDADE_TRAVA_AUSENTE'; END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION grazing_cliente_identidade_validar() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE raiz text; destino text; doc text;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CLIENTE_EXCLUSAO_NAO_PERMITIDA'; END IF;
  IF NEW.tipo NOT IN ('PF','PJ') OR jsonb_typeof(NEW.enderecos)<>'array' THEN RAISE EXCEPTION 'CLIENTE_IDENTIDADE_INVALIDA'; END IF;
  NEW.email := grazing_cliente_email_chave(NEW.email);
  IF NEW.email IS NOT NULL AND (length(NEW.email)>254 OR NEW.email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'CLIENTE_EMAIL_INVALIDO'; END IF;
  doc := grazing_cliente_documento_efetivo(NEW.tipo,NEW.documento,NEW.enderecos);
  IF coalesce(nullif(btrim(NEW.documento),''),CASE WHEN NEW.enderecos->0->>'tipo'=NEW.tipo THEN NEW.enderecos->0->>'documento' END) ~ '[^0-9./[:space:]\-]'
    OR (doc IS NOT NULL AND length(doc)<>CASE WHEN NEW.tipo='PF' THEN 11 ELSE 14 END) THEN RAISE EXCEPTION 'CLIENTE_DOCUMENTO_INVALIDO'; END IF;
  raiz := coalesce(NEW."unificadoEmId",NEW.id);
  IF NEW."unificadoEmId" IS NOT NULL THEN
    IF NEW.ativo THEN RAISE EXCEPTION 'CLIENTE_ALIAS_NAO_PODE_SER_ATIVADO'; END IF;
    IF NEW.id=NEW."unificadoEmId" THEN RAISE EXCEPTION 'CLIENTE_ALIAS_CICLO'; END IF;
    SELECT c."unificadoEmId" INTO destino FROM "ClienteVenda" c WHERE c.id=NEW."unificadoEmId";
    IF NOT FOUND OR destino IS NOT NULL THEN RAISE EXCEPTION 'CLIENTE_ALIAS_DESTINO_NAO_CANONICO'; END IF;
    IF EXISTS(SELECT 1 FROM "ClienteVenda" c WHERE c."unificadoEmId"=NEW.id) THEN RAISE EXCEPTION 'CLIENTE_RAIZ_COM_ALIASES'; END IF;
  ELSE NEW.documento := doc;
  END IF;
  IF TG_OP='UPDATE' AND OLD."unificadoEmId" IS NOT NULL AND NEW.ativo THEN RAISE EXCEPTION 'CLIENTE_ALIAS_NAO_PODE_SER_ATIVADO'; END IF;
  IF EXISTS(SELECT 1 FROM "ClienteVenda" c WHERE c.id<>NEW.id AND coalesce(c."unificadoEmId",c.id)<>raiz
    AND ((NEW.email IS NOT NULL AND grazing_cliente_email_chave(c.email)=NEW.email)
      OR (doc IS NOT NULL AND grazing_cliente_documento_efetivo(c.tipo,c.documento,c.enderecos)=doc))) THEN
    RAISE EXCEPTION 'CLIENTE_IDENTIDADE_RESERVADA_OUTRO_CADASTRO' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cliente_identidade_trava BEFORE INSERT OR UPDATE OR DELETE ON "ClienteVenda" FOR EACH STATEMENT EXECUTE FUNCTION grazing_cliente_identidade_trava();
CREATE TRIGGER cliente_identidade_validar BEFORE INSERT OR UPDATE OR DELETE ON "ClienteVenda" FOR EACH ROW EXECUTE FUNCTION grazing_cliente_identidade_validar();

CREATE OR REPLACE FUNCTION grazing_pedido_cliente_canonico() RETURNS trigger
LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE raiz text; raiz_rascunho text; cliente_rascunho text;
BEGIN
  IF NEW."clienteId" IS NOT NULL THEN
    SELECT coalesce(c."unificadoEmId",c.id) INTO raiz FROM "ClienteVenda" c WHERE c.id=NEW."clienteId";
    IF NOT FOUND THEN RAISE EXCEPTION 'PEDIDO_CLIENTE_DESCONHECIDO'; END IF;
    NEW."clienteId" := raiz;
  END IF;
  IF jsonb_typeof(NEW.rascunho)='object' THEN
    cliente_rascunho := nullif(NEW.rascunho->>'clienteId','');
    IF cliente_rascunho IS NOT NULL THEN
      SELECT coalesce(c."unificadoEmId",c.id) INTO raiz_rascunho FROM "ClienteVenda" c WHERE c.id=cliente_rascunho;
      IF NOT FOUND THEN RAISE EXCEPTION 'PEDIDO_RASCUNHO_CLIENTE_DESCONHECIDO'; END IF;
      IF raiz IS NOT NULL AND raiz<>raiz_rascunho THEN RAISE EXCEPTION 'PEDIDO_RASCUNHO_RAIZES_DIVERGENTES'; END IF;
      NEW.rascunho := jsonb_set(NEW.rascunho,'{clienteId}',to_jsonb(raiz_rascunho),false);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pedido_cliente_trava BEFORE INSERT OR UPDATE OF "clienteId",rascunho ON "PedidoVenda" FOR EACH STATEMENT EXECUTE FUNCTION grazing_cliente_identidade_trava();
CREATE TRIGGER pedido_cliente_canonico BEFORE INSERT OR UPDATE OF "clienteId",rascunho ON "PedidoVenda" FOR EACH ROW EXECUTE FUNCTION grazing_pedido_cliente_canonico();
