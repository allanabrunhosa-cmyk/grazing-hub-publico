-- Conferência somente leitura. Retorna hashes e totais; nunca retorna identidades,
-- permissões individuais, senha, e-mail, nome ou outros dados pessoais.
-- Mesmo arquivo antes e depois da migration; capabilities/sessões/outros módulos
-- devem conservar seus hashes. A estrutura da view muda de forma deliberada.
WITH
estrutura AS (
 SELECT pg_get_viewdef(to_regclass('atendimento_integracao.identidade'),true) AS definicao
), prontidao AS (
 SELECT COALESCE(definicao ~ ',[[:space:]]*true[[:space:]]+AS[[:space:]]+"permissoesGranulares"',false) AS granular,
   COALESCE(definicao ~ ',[[:space:]]*true[[:space:]]+AS[[:space:]]+"permissoesHierarquia"',false) AS hierarquia FROM estrutura
), antigas(capacidade,recurso,acao,origem) AS (VALUES
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
 ('equipe.visualizar','crm.atendimento.equipe','visualizar','consultar')
), novas(capacidade,recurso,acao,origens,ordem) AS (VALUES
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
 ('atividades.equipe.visualizar','crm.atendimento.atividades.equipe','visualizar',ARRAY['consultar','configurar'],19)
), pessoas AS (
 SELECT u.id,u.ativo,u."excluidoEm",u."senhaDefinida",u."sessaoVersao",u."perfilAcessoId",
   COALESCE(p.permissoes,'{}'::jsonb) AS b,COALESCE(u."permissoesPersonalizadas",'{}'::jsonb) AS e,
   p.sistema='ADMINISTRADOR' AS admin,prontidao.* FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" CROSS JOIN prontidao
), recursos AS (
 SELECT pessoas.*,
   CASE WHEN NOT hierarquia AND (b ? 'crm.atendimento' OR (e->'crm.atendimento') ? 'visualizar') THEN 'crm.atendimento' ELSE 'crm' END AS consulta,
   CASE WHEN NOT hierarquia AND (b ? 'crm.atendimento' OR (e->'crm.atendimento') ? 'visualizar' OR (e->'crm.atendimento') ? 'editar') THEN 'crm.atendimento' ELSE 'crm' END AS atendimento
 FROM pessoas
), legadas AS (
 SELECT recursos.*,
   COALESCE((e->consulta->>'visualizar')::boolean,(b->consulta) ? 'visualizar',false) AS consultar,
   COALESCE((e->atendimento->>'visualizar')::boolean,(b->atendimento) ? 'visualizar',false)
     AND COALESCE((e->atendimento->>'editar')::boolean,(b->atendimento) ? 'editar',false) AS atender,
   COALESCE((e->'crm.atendimento.configuracoes'->>'visualizar')::boolean,(b->'crm.atendimento.configuracoes') ? 'visualizar',false)
     AND COALESCE((e->'crm.atendimento.configuracoes'->>'editar')::boolean,(b->'crm.atendimento.configuracoes') ? 'editar',false) AS configurar
 FROM recursos
), valores_antigos AS (
 SELECT l.id,a.capacidade,COALESCE(l.admin,false) OR (l.consultar AND
   CASE WHEN a.capacidade='consultar' THEN true WHEN a.capacidade='atender' THEN l.atender WHEN a.capacidade='configurar' THEN l.configurar
   WHEN l.granular OR l.b ? a.recurso OR (l.e->a.recurso) ? 'visualizar' OR (l.e->a.recurso) ? a.acao THEN
     COALESCE((l.e->a.recurso->>'visualizar')::boolean,(l.b->a.recurso) ? 'visualizar',false)
       AND COALESCE((l.e->a.recurso->>a.acao)::boolean,(l.b->a.recurso) ? a.acao,false)
   WHEN a.origem='consultar' THEN l.consultar WHEN a.origem='atender' THEN l.atender ELSE l.configurar END) AS permitido
 FROM legadas l CROSS JOIN antigas a
), conjuntos_antigos AS (
 SELECT id,jsonb_object_agg(capacidade,permitido) AS capacidades FROM valores_antigos GROUP BY id
), valores_novos AS (
 SELECT l.id,n.capacidade,COALESCE(l.admin,false) OR (l.consultar AND CASE WHEN l.hierarquia THEN
   COALESCE((l.e->n.recurso->>'visualizar')::boolean,(l.b->n.recurso) ? 'visualizar',false)
     AND COALESCE((l.e->n.recurso->>n.acao)::boolean,(l.b->n.recurso) ? n.acao,false)
   ELSE (SELECT bool_and((c.capacidades->>origem)::boolean) FROM unnest(n.origens) origem) END) AS permitido
 FROM legadas l JOIN conjuntos_antigos c USING(id) CROSS JOIN novas n
), capacidades AS (
 SELECT id,jsonb_object_agg(capacidade,permitido) AS conjunto FROM (
   SELECT * FROM valores_antigos UNION ALL SELECT * FROM valores_novos
 ) todos GROUP BY id
), outros_perfis AS (
 SELECT p.id,COALESCE((SELECT jsonb_object_agg(chave,valor) FROM jsonb_each(p.permissoes) par(chave,valor)
   WHERE chave<>'crm' AND chave<>'crm.atendimento' AND chave NOT LIKE 'crm.atendimento.%'),'{}'::jsonb) AS permissoes FROM "PerfilAcesso" p
), outras_excecoes AS (
 SELECT p.id,COALESCE((SELECT jsonb_object_agg(chave,valor) FROM jsonb_each(p.e) par(chave,valor)
   WHERE chave<>'crm' AND chave<>'crm.atendimento' AND chave NOT LIKE 'crm.atendimento.%'),'{}'::jsonb) AS excecoes FROM pessoas p
), hashes AS (
 SELECT
   (SELECT encode(sha256(convert_to(COALESCE(string_agg(id||'|'||conjunto::text,E'\n' ORDER BY id),''),'UTF8')),'hex') FROM capacidades) AS capacidades_sha256,
   (SELECT encode(sha256(convert_to(COALESCE(string_agg(id||'|'||"sessaoVersao"::text,E'\n' ORDER BY id),''),'UTF8')),'hex') FROM pessoas) AS sessoes_sha256,
   (SELECT encode(sha256(convert_to(COALESCE(string_agg(id||'|'||ativo::text||'|'||("excluidoEm" IS NOT NULL)::text||'|'||"senhaDefinida"::text||'|'||COALESCE("perfilAcessoId",''),E'\n' ORDER BY id),''),'UTF8')),'hex') FROM pessoas) AS identidades_sha256,
   (SELECT encode(sha256(convert_to(COALESCE(string_agg(id||'|'||permissoes::text,E'\n' ORDER BY id),''),'UTF8')),'hex') FROM outros_perfis) AS outros_modulos_perfis_sha256,
   (SELECT encode(sha256(convert_to(COALESCE(string_agg(id||'|'||excecoes::text,E'\n' ORDER BY id),''),'UTF8')),'hex') FROM outras_excecoes) AS outros_modulos_excecoes_sha256,
   (SELECT encode(sha256(convert_to(COALESCE(string_agg(relowner::text||'|'||COALESCE(relacl::text,'')||'|'||COALESCE(reloptions::text,''),''),''),'UTF8')),'hex')
     FROM pg_class WHERE oid=to_regclass('atendimento_integracao.identidade')) AS view_autoridade_sha256
)
SELECT hashes.*,prontidao.*,(SELECT count(*) FROM pessoas) AS identidades_total,(SELECT count(*) FROM "PerfilAcesso") AS perfis_total,
 (SELECT count(*) FROM antigas)+(SELECT count(*) FROM novas) AS capacidades_por_identidade,
 (SELECT count(*) FROM "McpEvento" WHERE id='atendimento-permissoes-hierarquia-20261021') AS marcador_total
FROM hashes CROSS JOIN prontidao;
