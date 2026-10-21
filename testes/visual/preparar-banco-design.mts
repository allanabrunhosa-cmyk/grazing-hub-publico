/** Exclusivo para o cluster descartável desta execução. Não lê .env operacional. */
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { readFile, readdir } from "node:fs/promises";
import { hash } from "bcryptjs";

const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
if (url.hostname !== "127.0.0.1" || url.port !== "55439" || url.pathname !== "/design_system_teste" || url.username !== "design_teste") throw new Error("Destino não autorizado para a demonstração.");
const banco = new Client({ connectionString: url.toString() });
await banco.connect();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
try {
  const identidade = await banco.query("SELECT current_database() AS banco, inet_server_port() AS porta");
  if (identidade.rows[0].banco !== "design_system_teste" || identidade.rows[0].porta !== 55439) throw new Error("Servidor inesperado.");
  const tabelas = await banco.query("SELECT count(*)::int AS total FROM information_schema.tables WHERE table_schema = 'public'");
  if (tabelas.rows[0].total !== 0) throw new Error("Banco não vazio: preservado. Não há reset automático.");
  await banco.query("BEGIN");
  for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await banco.query(await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8"));
  }
  await banco.query("COMMIT");
  const perfil = await prisma.perfilAcesso.findFirstOrThrow({ where: { sistema: "ADMINISTRADOR" } });
  await prisma.usuario.create({ data: { id: "design-demo-admin", nome: "Teste local de design", email: "design@example.invalid", senhaHash: await hash("SomenteTesteLocal2026!", 10), admin: true, perfilAcessoId: perfil.id } });
  await prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  const categoria = await prisma.categoriaVenda.create({ data: { nome: "Categoria sintética de design" } });
  await prisma.canalVenda.upsert({ where: { nome: "DIRETO" }, create: { nome: "DIRETO" }, update: {} });
  const grupo = await prisma.grupoComplementoVenda.create({ data: { nome: "Grupo sintético de montagem", opcoes: { create: [{ nome: "Opção sintética A", preco: 10 }, { nome: "Opção sintética B", preco: 20, ordem: 1 }] } } });
  for (const [ordem, nome] of ["Produto sintético A", "Produto sintético B"].entries()) {
    await prisma.produtoVenda.create({ data: { nome, categorias: { create: { categoriaId: categoria.id, ordem } }, preco: 100, grupos: { create: { grupoId: grupo.id, minimo: 0, maximo: null } } } });
  }
  console.log("Banco exclusivo preparado com cadastros sintéticos. Sem conexão externa.");
} finally { await prisma.$disconnect(); await banco.end(); }
