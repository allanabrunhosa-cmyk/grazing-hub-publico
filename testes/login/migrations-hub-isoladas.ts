import type { Client } from "pg";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";

const integracoesCriadas = new Set<string>();
function schemaIntegracao(esquema: string) {
  if (process.env.NODE_ENV !== "test" || !/^teste_[a-z0-9_]{1,50}$/.test(esquema)) throw new Error("Somente schema isolado de testes.");
  return `${esquema}_atend`;
}

/** Reproduz a view oficial em namespace próprio, como a prova de hierarquia do Atendimento. */
export async function prepararMigrationHubIsolada(banco: Client, esquema: string, nome: string, sql: string) {
  const integracao = schemaIntegracao(esquema);
  if (nome === "20261021120000_atendimento_permissoes_hierarquia") {
    const atual = await banco.query<{ esquema: string }>("SELECT current_schema() AS esquema");
    if (atual.rows[0]?.esquema !== esquema) throw new Error("Search path da fixture não corresponde ao schema isolado.");
    await banco.query(`CREATE SCHEMA "${integracao}"`);
    integracoesCriadas.add(integracao);
    await banco.query(`CREATE VIEW "${integracao}".identidade WITH(security_barrier=true) AS
      SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,
        u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",p.permissoes,
        u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm",false AS "permissoesGranulares"
      FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId"
      WHERE u."excluidoEm" IS NULL AND (p.sistema='ADMINISTRADOR' OR
        CASE WHEN (p.permissoes ? 'crm.atendimento') OR ((u."permissoesPersonalizadas"->'crm.atendimento') ? 'visualizar')
          THEN COALESCE((u."permissoesPersonalizadas"->'crm.atendimento'->>'visualizar')::boolean,(p.permissoes->'crm.atendimento') ? 'visualizar',false)
          ELSE COALESCE((u."permissoesPersonalizadas"->'crm'->>'visualizar')::boolean,(p.permissoes->'crm') ? 'visualizar',false) END)`);
    // Só a cópia executada pela fixture recebe o namespace; o SQL versionado fica intacto.
    sql = sql.replaceAll("atendimento_integracao", integracao);
  }
  return prepararSqlMigrationFiscal(nome, sql);
}

export async function limparIntegracaoHubIsolada(banco: Client, esquema: string) {
  const integracao = schemaIntegracao(esquema);
  await banco.query("ROLLBACK");
  if (integracoesCriadas.has(integracao)) {
    await banco.query(`DROP SCHEMA "${integracao}" CASCADE`);
    integracoesCriadas.delete(integracao);
  }
}
