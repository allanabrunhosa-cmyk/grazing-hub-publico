import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readdir, readFile } from "node:fs/promises";
const s = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, enviar: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return s.prisma; } }));
vi.mock("@/lib/recuperacao-senha/email", () => ({ enviarEmailRecuperacao: s.enviar }));
import { prepararRecuperacao, concluirRecuperacao, linkRecuperacaoValido, reservarSolicitacao } from "@/lib/recuperacao-senha/servico";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ERRO_LINK } from "@/lib/recuperacao-senha/validacao";

describe.skipIf(process.env.LOGIN_BANCO_TESTE !== "1")("recuperação no PostgreSQL isolado", () => {
  let admin: Client;
  const schema = `teste_login_${Date.now()}`;
  beforeAll(async () => {
    config({ quiet: true });
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Teste permitido somente no banco local.");
    url.searchParams.delete("schema");
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`); await admin.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await admin.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    s.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
  }, 60000);
  afterAll(async () => {
    await s.prisma?.$disconnect();
    if (admin) { if (!/^teste_login_\d+$/.test(schema)) throw new Error("Schema inválido"); await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); }
  });
  beforeEach(async () => {
    await admin.query('TRUNCATE "Usuario", "HistoricoAcesso", "LimiteAutenticacao" CASCADE');
    s.enviar.mockReset().mockResolvedValue(undefined);
    await s.prisma.usuario.create({ data: { id: "pessoa", nome: "Pessoa de teste", email: "pessoa@example.invalid", senhaHash: await hashPassword("SenhaAnterior123"), perfilAcessoId: "perfil-equipe" } });
  });
  async function solicitar() { await prepararRecuperacao("pessoa@example.invalid"); return s.enviar.mock.calls.at(-1)![1] as string; }
  it("emite segredo aleatório, armazena só hash e nunca muda senha na solicitação", async () => {
    const token = await solicitar(); expect(token).toMatch(/^[\w-]{43}$/);
    const registro = await s.prisma.recuperacaoSenha.findFirstOrThrow();
    expect(registro.tokenHash).not.toBe(token); expect(JSON.stringify(registro)).not.toContain(token);
    expect(registro.expiraEm.getTime() - registro.criadaEm.getTime()).toBeGreaterThan(1799000);
    expect(await verifyPassword("SenhaAnterior123", (await s.prisma.usuario.findFirstOrThrow()).senhaHash)).toBe(true);
    expect(await linkRecuperacaoValido(token)).toBe(true);
  });
  it("redefine, revoga sessões e preserva auditoria sem segredos; reuso é rejeitado", async () => {
    const token = await solicitar();
    expect(await concluirRecuperacao(token, "NovaSenhaSegura123!", "NovaSenhaSegura123!")).toHaveProperty("ok", true);
    const usuario = await s.prisma.usuario.findFirstOrThrow(); expect(usuario.sessaoVersao).toBe(1);
    expect(await verifyPassword("NovaSenhaSegura123!", usuario.senhaHash)).toBe(true);
    expect(await verifyPassword("SenhaAnterior123", usuario.senhaHash)).toBe(false);
    expect(await concluirRecuperacao(token, "OutraSenhaSegura123!", "OutraSenhaSegura123!")).toEqual({ erro: ERRO_LINK });
    const auditoria = JSON.stringify(await s.prisma.historicoAcesso.findMany());
    expect(auditoria).not.toContain(token); expect(auditoria).not.toContain("NovaSenhaSegura123!"); expect(auditoria).not.toContain(usuario.senhaHash);
  });
  it("dois usos simultâneos permitem exatamente uma redefinição", async () => {
    const token = await solicitar();
    const resultados = await Promise.all([1, 2].map(i => concluirRecuperacao(token, `NovaSenhaSegura${i}!`, `NovaSenhaSegura${i}!`)));
    expect(resultados.filter(r => "ok" in r)).toHaveLength(1);
    expect((await s.prisma.usuario.findFirstOrThrow()).sessaoVersao).toBe(1);
    expect(await s.prisma.historicoAcesso.count()).toBe(1);
  });
  it.each(["expirado", "inativo", "excluido", "email", "versao"])("rejeita link %s sem alterar a senha", async (caso) => {
    const token = await solicitar();
    if (caso === "expirado") await s.prisma.recuperacaoSenha.updateMany({ data: { expiraEm: new Date(0) } });
    else await s.prisma.usuario.update({ where: { id: "pessoa" }, data: caso === "inativo" ? { ativo: false } : caso === "excluido" ? { excluidoEm: new Date() } : caso === "email" ? { email: "outro@example.invalid" } : { sessaoVersao: 1 } });
    expect(await linkRecuperacaoValido(token)).toBe(false);
    expect(await concluirRecuperacao(token, "NovaSenhaSegura123!", "NovaSenhaSegura123!")).toEqual({ erro: ERRO_LINK });
    expect(await verifyPassword("SenhaAnterior123", (await s.prisma.usuario.findFirstOrThrow()).senhaHash)).toBe(true);
  });
  it("novo pedido substitui o link antigo; desconhecido e inativo não recebem e-mail", async () => {
    const antigo = await solicitar(); const novo = await solicitar(); expect(novo).not.toBe(antigo);
    expect(await linkRecuperacaoValido(antigo)).toBe(false); expect(await linkRecuperacaoValido(novo)).toBe(true);
    s.enviar.mockClear(); await prepararRecuperacao("ausente@example.invalid");
    await s.prisma.usuario.update({ where: { id: "pessoa" }, data: { ativo: false } }); await prepararRecuperacao("pessoa@example.invalid");
    expect(s.enviar).not.toHaveBeenCalled();
  });
  it("falha no envio não deixa link utilizável", async () => {
    s.enviar.mockRejectedValueOnce(new Error("SMTP indisponível"));
    await expect(solicitar()).rejects.toThrow("Falha no envio"); expect(await s.prisma.recuperacaoSenha.count()).toBe(0);
  });
  it("limita pedidos concorrentes, inclusive para e-mail desconhecido, sem guardar endereço", async () => {
    const resultados = await Promise.all([1, 2, 3].map(() => reservarSolicitacao("ausente@example.invalid")));
    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(JSON.stringify(await s.prisma.limiteAutenticacao.findMany())).not.toContain("ausente@example.invalid");
  });
  it("erro na auditoria desfaz senha e consumo do link", async () => {
    const token = await solicitar();
    await admin.query(`CREATE FUNCTION falhar_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha de teste'; END $$`);
    await admin.query('CREATE TRIGGER falha_auditoria BEFORE INSERT ON "HistoricoAcesso" FOR EACH ROW EXECUTE FUNCTION falhar_auditoria()');
    try { await expect(concluirRecuperacao(token, "NovaSenhaSegura123!", "NovaSenhaSegura123!")).rejects.toThrow(); }
    finally { await admin.query('DROP TRIGGER falha_auditoria ON "HistoricoAcesso"'); }
    expect(await linkRecuperacaoValido(token)).toBe(true); expect((await s.prisma.usuario.findFirstOrThrow()).sessaoVersao).toBe(0);
  });
});
