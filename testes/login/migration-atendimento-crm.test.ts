import { expect, it } from "vitest";
import { Client } from "pg";
import { readFile } from "node:fs/promises";

it.skipIf(process.env.LOGIN_BANCO_TESTE !== "1")("view reconhece crm, preserva decisões específicas e grants", async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw Error("Somente banco local.");
  const banco = new Client({ connectionString: url.toString() });
  const schema = `teste_crm_${Date.now()}`;
  const integracao = `${schema}_integracao`;
  const papel = `${schema}_leitor`;
  await banco.connect();
  try {
    await banco.query("BEGIN");
    await banco.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
      CREATE TABLE "PerfilAcesso" (id text PRIMARY KEY, sistema text, permissoes jsonb);
      CREATE TABLE "Usuario" (id text PRIMARY KEY,nome text,email text,"senhaHash" text,ativo boolean,"excluidoEm" timestamp,"sessaoVersao" integer,"perfilAcessoId" text,"permissoesPersonalizadas" jsonb,"senhaDefinida" boolean,"emailVerificadoEm" timestamp);
      INSERT INTO "PerfilAcesso" VALUES ('crm',NULL,'{"crm":["visualizar"]}'),
        ('especifico',NULL,'{"crm.atendimento":["visualizar"]}'),
        ('especifico-negado',NULL,'{"crm":["visualizar"],"crm.atendimento":[]}'),
        ('ausente',NULL,'{}'),('admin','ADMINISTRADOR','{}');
      CREATE SCHEMA ${integracao}; CREATE ROLE ${papel};
      CREATE VIEW ${integracao}.identidade WITH (security_barrier=true) AS
        SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",p.permissoes,u."permissoesPersonalizadas" AS excecoes,u."senhaDefinida",u."emailVerificadoEm"
        FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" WHERE false;
      REVOKE ALL ON ${integracao}.identidade FROM PUBLIC;
      GRANT SELECT ON ${integracao}.identidade TO ${papel};`);
    const casos: [string, string, Record<string, Record<string, boolean>>, boolean, boolean][] = [
      ["historico", "crm", {}, false, true],
      ["especifico", "especifico", {}, false, true],
      ["bloqueio-especifico", "crm", { "crm.atendimento": { visualizar: false } }, false, false],
      ["perfil-especifico-negado", "especifico-negado", {}, false, false],
      ["excecao-especifica", "ausente", { "crm.atendimento": { visualizar: true } }, false, true],
      ["excecao-historica", "ausente", { crm: { visualizar: true } }, false, true],
      ["bloqueio-historico", "crm", { crm: { visualizar: false } }, false, false],
      ["decisao-especifica", "especifico", { crm: { visualizar: false } }, false, true],
      ["ausente", "ausente", {}, false, false],
      ["excluido", "crm", {}, true, false],
      ["admin", "admin", { "crm.atendimento": { visualizar: false } }, false, true],
      ["editar-sem-visualizar", "crm", { "crm.atendimento": { editar: false } }, false, true],
    ];
    for (const [id, perfil, excecoes, excluido] of casos) {
      await banco.query('INSERT INTO "Usuario" VALUES ($1,\'Pessoa\',$2,\'hash-ficticio\',true,$3,0,$4,$5,true,now())',
        [id, `${id}@example.invalid`, excluido ? new Date() : null, perfil, JSON.stringify(excecoes)]);
    }
    const migration = (await readFile("prisma/migrations/20261013150000_atendimento_permissao_crm/migration.sql", "utf8")).replaceAll("atendimento_integracao", integracao);
    await banco.query(migration);
    const esperados = casos.filter((c) => c[4]).map((c) => ({ id: c[0] })).sort((a, b) => a.id.localeCompare(b.id));
    expect((await banco.query(`SELECT id FROM ${integracao}.identidade ORDER BY id`)).rows).toEqual(esperados);
    await banco.query(migration);
    expect((await banco.query(`SELECT count(*)::int AS total FROM ${integracao}.identidade`)).rows[0].total).toBe(esperados.length);
    expect((await banco.query(`SELECT has_table_privilege('${papel}','${integracao}.identidade','SELECT') AS permitido`)).rows[0].permitido).toBe(true);
    expect((await banco.query(`SELECT reloptions FROM pg_class WHERE oid='${integracao}.identidade'::regclass`)).rows[0].reloptions).toContain("security_barrier=true");
    await banco.query(`DROP VIEW ${integracao}.identidade`);
    await banco.query(migration);
    expect((await banco.query(`SELECT to_regclass('${integracao}.identidade') AS view`)).rows[0].view).toBeNull();
  } finally { await banco.query("ROLLBACK"); await banco.end(); }
}, 20_000);
