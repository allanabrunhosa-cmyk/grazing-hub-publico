-- Preserva o acesso das contas existentes. Novos convites declaram senhaDefinida=false.
ALTER TABLE "Usuario" ADD COLUMN "senhaDefinida" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Usuario" ADD COLUMN "emailVerificadoEm" TIMESTAMP(3);

-- A integração já existente passa a consultar as identidades permitidas pelo HUB.
-- Não cria papéis, não copia senhas e não concede acesso às tabelas centrais.
DO $$ BEGIN
  IF to_regclass('atendimento_integracao.identidade') IS NOT NULL THEN
    EXECUTE 'CREATE OR REPLACE VIEW atendimento_integracao.identidade WITH (security_barrier=true) AS
      SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,
        u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",
        p.permissoes,u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm"
      FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId"
      WHERE u."excluidoEm" IS NULL AND (p.sistema=''ADMINISTRADOR'' OR
        COALESCE((u."permissoesPersonalizadas"->''crm.atendimento''->>''visualizar'')::boolean,
          (p.permissoes->''crm.atendimento'') ? ''visualizar'',false))';
  END IF;
END $$;
