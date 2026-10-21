import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";

export const executarBanco = process.env.ATIVIDADES_BANCO_TESTE === "1";
export function enderecoBancoTeste() {
  const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1"
    || url.port !== "55441" || url.pathname !== "/teste_atividades_usuarios" || url.username !== "atividades_teste") {
    throw new Error("Atividades exige o PostgreSQL sintético exclusivo documentado; nenhum .env operacional é carregado.");
  }
  return url;
}
export async function criarBancoTeste(rotulo: string) {
  if (!/^[a-z]{1,20}$/.test(rotulo)) throw new Error("Rótulo inválido.");
  const esquema = `teste_atividades_${rotulo}_${randomUUID().replaceAll("-", "")}`;
  const url = enderecoBancoTeste();
  const banco = new Client({ connectionString: url.toString(), application_name: `atividades-teste-${rotulo}`, connectionTimeoutMillis: 10_000 });
  await banco.connect();
  const identidade = await banco.query("SELECT current_database() AS banco, inet_server_port() AS porta, current_user AS usuario");
  if (identidade.rows[0].banco !== "teste_atividades_usuarios" || identidade.rows[0].porta !== 55441 || identidade.rows[0].usuario !== "atividades_teste") {
    await banco.end(); throw new Error("Identidade do servidor sintético inesperada.");
  }
  await banco.query(`CREATE SCHEMA "${esquema}"`);
  await banco.query(`SET search_path TO "${esquema}"`);
  await banco.query("SET timezone TO 'UTC'");
  for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
  }
  return { banco, esquema, url };
}
export async function encerrarBancoTeste(ambiente: { banco: Client; esquema: string } | undefined) {
  if (!ambiente) return;
  try {
    if (!/^teste_atividades_[a-z]{1,20}_[a-f0-9]{32}$/.test(ambiente.esquema)) throw new Error("Cleanup recusado fora do schema sintético exclusivo.");
    await ambiente.banco.query(`DROP SCHEMA "${ambiente.esquema}" CASCADE`);
  } finally { await ambiente.banco.end(); }
}
