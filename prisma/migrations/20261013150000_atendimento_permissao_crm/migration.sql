-- Alinha a consulta dedicada com a permissão histórica crm do HUB.
-- Decisão explícita em crm.atendimento prevalece sobre a permissão histórica.
-- CREATE OR REPLACE conserva o proprietário e os grants da integração privada.
DO $$ BEGIN
  IF to_regclass('atendimento_integracao.identidade') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW atendimento_integracao.identidade WITH (security_barrier=true) AS
      SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,
        u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",
        p.permissoes,u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm"
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
