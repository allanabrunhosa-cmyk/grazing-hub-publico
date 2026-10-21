import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { VALORES_FABRICA } from "@/lib/design-system/registro";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("server-only", () => ({}));
import { obterDadosCentralDesign, obterTemaPublicado, publicarRascunhoDesign, restaurarVersaoDesign, salvarRascunhoDesign } from "@/lib/design-system/servico";

const esquema = `teste_design_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined; let criado = false;
const admin = "design-admin-sintetico";
let perfilAdmin: string;
const motivo = "Teste isolado da Central";
const publicar = (revisao = 1, chaveIdempotencia = randomUUID()) => publicarRascunhoDesign({ revisao, motivo, chaveIdempotencia, autorId: admin });
const salvar = (valores: unknown, revisao = 0, versaoBase = 0) => salvarRascunhoDesign({ valores, revisao, versaoBase, autorId: admin });

describe.skipIf(process.env.DESIGN_BANCO_TESTE !== "1")("Design — PostgreSQL exclusivo e sintético", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DESIGN_DATABASE_URL ?? process.env.DATABASE_URL!);
    const portaIsolada = url.port === "55439" || (process.env.DESIGN_DATABASE_URL && url.port === "55432");
    if (url.hostname !== "127.0.0.1" || !portaIsolada || url.pathname !== "/design_system_teste" || url.username !== "design_teste") throw new Error("Este teste exige o banco e usuário exclusivos documentados em EXECUCAO.md.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    const destino = await banco.query("SELECT current_database() AS banco, inet_server_port() AS porta");
    expect(destino.rows).toEqual([{ banco: "design_system_teste", porta: Number(url.port) }]);
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const p of pastas) await banco.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    perfilAdmin = (await sim.prisma.perfilAcesso.findFirstOrThrow({ where: { sistema: "ADMINISTRADOR" } })).id;
    await sim.prisma.usuario.createMany({ data: [
      { id: admin, nome: "Admin sintético", email: "design-admin@example.invalid", senhaHash: "sem-login-real", admin: false, perfilAcessoId: perfilAdmin },
      { id: "design-leitor", nome: "Leitor sintético", email: "design-leitor@example.invalid", senhaHash: "sem-login-real", admin: true },
    ] });
  }, 90_000);
  beforeEach(async () => {
    await sim.prisma.configuracaoDesign.updateMany({ data: { versaoPublicadaId: null, revisaoPublicada: 0 } });
    await sim.prisma.rascunhoDesign.deleteMany(); await sim.prisma.eventoDesign.deleteMany(); await sim.prisma.versaoDesign.deleteMany();
    await sim.prisma.usuario.update({ where: { id: admin }, data: { admin: false, ativo: true, perfilAcessoId: perfilAdmin } });
  });
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (banco) { if (criado && /^teste_design_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`); await banco.end(); }
  });
  it("salva sem afetar publicado, publica, herda ajustes e restaura nova versão auditável", async () => {
    await salvar({ "botao.raio": "1rem" });
    expect((await obterTemaPublicado()).valores["botao.raio"]).toBe(VALORES_FABRICA["botao.raio"]);
    const primeira = await publicar();
    await salvar({ "menu.largura": "17rem" }, 0, 1); await publicar();
    const tema = await obterTemaPublicado(); expect(tema.revisao).toBe(2);
    expect(tema.valores).toMatchObject({ "botao.raio": "1rem", "menu.largura": "17rem" });
    const restaura = await restaurarVersaoDesign({ versaoId: primeira.versao.id, versaoBase: 2, motivo, chaveIdempotencia: randomUUID(), autorId: admin });
    expect(restaura.versao.numero).toBe(3); expect(restaura.versao.versaoOrigemNumero).toBe(1);
    expect((await obterTemaPublicado()).valores["menu.largura"]).toBe(VALORES_FABRICA["menu.largura"]);
    const dados = await obterDadosCentralDesign(); expect(dados.versoes).toHaveLength(3); expect(dados.eventos).toHaveLength(5);
    expect(dados.publicada?.autor).toBe("Admin sintético");
  });
  it("concorrência de rascunho tem apenas um vencedor e não perde edição", async () => {
    const resultados = await Promise.allSettled([salvar({ "botao.raio": "1rem" }), salvar({ "botao.raio": "0.5rem" })]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await sim.prisma.rascunhoDesign.count()).toBe(1);
    await expect(salvar({}, 9)).rejects.toThrow("atualizado");
  });
  it("publicação repetida é única e a chave não aceita outro pedido", async () => {
    await salvar({}); const chave = randomUUID();
    const resultados = await Promise.all([publicar(1, chave), publicar(1, chave)]);
    expect(resultados.map(r => r.versao.numero)).toEqual([1, 1]);
    expect(resultados.filter(r => r.repetida)).toHaveLength(1);
    expect(await sim.prisma.versaoDesign.count()).toBe(1);
    await expect(publicarRascunhoDesign({ revisao: 1, motivo: "Outro motivo", chaveIdempotencia: chave, autorId: admin })).rejects.toThrow("outro pedido");
    await expect(publicar(2, chave)).rejects.toThrow("outro pedido");
  });
  it("revalida administrador ativo no serviço, inclusive repetição", async () => {
    await expect(salvarRascunhoDesign({ valores: {}, revisao: 0, versaoBase: 0, autorId: "design-leitor" })).rejects.toThrow("acesso");
    await salvar({}); const chave = randomUUID(); await publicar(1, chave);
    await sim.prisma.usuario.update({ where: { id: admin }, data: { perfilAcessoId: null } });
    await expect(publicar(1, chave)).rejects.toThrow("acesso");
    expect(await sim.prisma.versaoDesign.count()).toBe(1);
  });
  it("recusa base antiga e permite revisão explícita de rascunho após restauração", async () => {
    await salvar({}); const primeira = await publicar(); await salvar({ "menu.largura": "18rem" }, 0, 1);
    await restaurarVersaoDesign({ versaoId: primeira.versao.id, versaoBase: 1, motivo, chaveIdempotencia: randomUUID(), autorId: admin });
    await expect(publicar()).rejects.toThrow("operacional mudou");
    await expect(salvar({}, 1, 1)).rejects.toThrow("operacional mudou");
    await salvar({ "menu.largura": "18rem" }, 1, 2); await publicar(2);
    expect((await obterTemaPublicado()).valores["menu.largura"]).toBe("18rem");
  });
  it("rejeita CSS, contraste e combinações, sem gravar rascunho inválido", async () => {
    await expect(salvar({ css: "body{display:none}" })).rejects.toThrow("compatíveis");
    await expect(salvar({ "cor.hub.primariaClara": "#1a75e8" })).rejects.toThrow("Contraste");
    await expect(salvar({ "vidro.desfoque": "0px", "vidro.opacidade": "0.7" })).rejects.toThrow("opacidade");
    expect(await sim.prisma.rascunhoDesign.count()).toBe(0);
  });
  it("schema incompatível cai no tema seguro e não pode ser restaurado", async () => {
    await salvar({}); const primeira = await publicar();
    await sim.prisma.versaoDesign.update({ where: { id: primeira.versao.id }, data: { schemaVersao: 999 } });
    expect(await obterTemaPublicado()).toEqual({ revisao: 0, valores: VALORES_FABRICA });
    await expect(restaurarVersaoDesign({ versaoId: primeira.versao.id, versaoBase: 1, motivo, chaveIdempotencia: randomUUID(), autorId: admin })).rejects.toThrow("outra versão");
  });
});
