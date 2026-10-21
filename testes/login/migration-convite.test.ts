import { expect, it } from "vitest";
import { Client } from "pg";
import { readFile } from "node:fs/promises";

it.skipIf(process.env.LOGIN_BANCO_TESTE !== "1")("migration preserva contas e grants e amplia a view só para usuários permitidos", async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw Error("Somente banco local.");
  const banco = new Client({ connectionString: url.toString() });
  const schema = `teste_convite_${Date.now()}`;
  const integracao = `${schema}_integracao`;
  const papel = `${schema}_leitor`;
  await banco.connect();
  try {
    await banco.query("BEGIN");
    await banco.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path TO ${schema};
      CREATE TABLE "PerfilAcesso" (id text PRIMARY KEY, sistema text, permissoes jsonb);
      CREATE TABLE "Usuario" (id text PRIMARY KEY,nome text,email text,"senhaHash" text,ativo boolean,"excluidoEm" timestamp,"sessaoVersao" integer,"perfilAcessoId" text,"permissoesPersonalizadas" jsonb);
      INSERT INTO "PerfilAcesso" VALUES ('equipe',NULL,'{"crm.atendimento":["visualizar"]}'),('sem-acesso',NULL,'{}');
      INSERT INTO "Usuario" VALUES ('antigo','Pessoa','antigo@example.invalid','hash-preservado',true,NULL,0,'equipe','{}'),
        ('novo','Pessoa','novo@example.invalid','hash-ficticio',true,NULL,0,'equipe','{}'),
        ('negado','Pessoa','negado@example.invalid','hash-ficticio',true,NULL,0,'equipe','{"crm.atendimento":{"visualizar":false}}'),
        ('ausente','Pessoa','ausente@example.invalid','hash-ficticio',true,NULL,0,'sem-acesso','{}');
      CREATE SCHEMA ${integracao}; CREATE ROLE ${papel};
      CREATE VIEW ${integracao}.identidade WITH (security_barrier=true) AS
        SELECT u.id,u.nome,u.email,u."senhaHash",u.ativo,(u."excluidoEm" IS NOT NULL) AS excluido,u."sessaoVersao",u."perfilAcessoId" AS "perfilId",p.sistema AS "perfilSistema",p.permissoes,u."permissoesPersonalizadas" AS excecoes
        FROM "Usuario" u LEFT JOIN "PerfilAcesso" p ON p.id=u."perfilAcessoId" WHERE u.id='antigo';
      REVOKE ALL ON ${integracao}.identidade FROM PUBLIC;
      GRANT SELECT ON ${integracao}.identidade TO ${papel};`);
    const migration = await readFile("prisma/migrations/20261013140000_convite_usuarios/migration.sql", "utf8");
    await banco.query(migration.replaceAll("atendimento_integracao", integracao));
    expect((await banco.query(`SELECT id FROM ${integracao}.identidade ORDER BY id`)).rows).toEqual([{ id: "antigo" }, { id: "novo" }]);
    expect((await banco.query('SELECT "senhaHash","senhaDefinida","emailVerificadoEm" FROM "Usuario" WHERE id=\'antigo\'')).rows[0]).toEqual({ senhaHash: "hash-preservado", senhaDefinida: true, emailVerificadoEm: null });
    expect((await banco.query(`SELECT has_table_privilege('${papel}','${integracao}.identidade','SELECT') AS permitido`)).rows[0].permitido).toBe(true);
  } finally { await banco.query("ROLLBACK"); await banco.end(); }
}, 20_000);
