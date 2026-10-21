import type { Client } from "pg";
/** Isola a dependência privada no próprio schema fictício. Os arquivos de SQL
 * históricos permanecem intactos. Somente o nome externo da view é substituído
 * nesta fixture; nenhuma view ou schema compartilhado é criado ou sobrescrito.
 */
export async function prepararDependenciaAtendimento(banco: Client, migration: string, sql: string) {
  if (migration !== "20261021120000_atendimento_permissoes_hierarquia") return sql;
  const esquema = (await banco.query("SELECT current_schema() AS nome")).rows[0].nome as string;
  if (!/^teste_[a-z0-9_]+$/.test(esquema)) throw Error("Dependência permitida somente em schema sintético.");
  await banco.query(`CREATE VIEW identidade WITH (security_barrier=true) AS
    SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,
      u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",
      p.permissoes,u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm",
      true AS "permissoesGranulares"
    FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId"
    WHERE u."excluidoEm" IS NULL AND (p.sistema='ADMINISTRADOR' OR
      CASE WHEN (p.permissoes ? 'crm.atendimento') OR ((u."permissoesPersonalizadas"->'crm.atendimento') ? 'visualizar')
      THEN COALESCE((u."permissoesPersonalizadas"->'crm.atendimento'->>'visualizar')::boolean,(p.permissoes->'crm.atendimento') ? 'visualizar',false)
      ELSE COALESCE((u."permissoesPersonalizadas"->'crm'->>'visualizar')::boolean,(p.permissoes->'crm') ? 'visualizar',false) END)`);
  return sql.replaceAll("atendimento_integracao.identidade", `"${esquema}".identidade`);
}
