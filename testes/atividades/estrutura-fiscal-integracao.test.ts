import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessaoAtual } from "@/lib/session";
import type { SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, sessao: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("@/lib/session", () => ({ getSession: sim.sessao }));
vi.mock("@/lib/tributacao/validacao", async importar => ({ ...await importar<typeof import("@/lib/tributacao/validacao")>(), hojeFiscal: () => "2026-10-11" }));
import { consultarAtividades, consultarDetalheAtividade } from "@/lib/atividades/consulta";
import { analisarImpactoFiscal, ativarVersaoFiscal, salvarVersaoFiscal } from "@/lib/tributacao/servico";

const esquema = `teste_atividade_fiscal_${randomUUID().replaceAll("-", "")}`;
const privado = "evidencia-fiscal-privada-sintetica";
const serializar = (v: unknown) => JSON.stringify(v, (_, d) => typeof d === "bigint" ? d.toString() : d);
let banco: Client | undefined, criado = false, url: URL, adminId: string;
let sessao: SessaoAtual, produtoId: string;
function entrada(): SalvarVersaoFiscalEntrada {
  return { tipo: "CLASSIFICACAO", chave: produtoId, versaoBase: 0, vigenciaInicio: "2026-10-11",
    dados: { produtoId, grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL", ncm: "08061000",
      origem: "0", cest: null, unidade: "UN", estado: "PENDENTE", evidencias: [privado], pendencias: ["Características sintéticas pendentes"] },
    justificativa: privado, fontes: [privado], chaveOperacao: randomUUID() };
}
async function fonte(versaoId: string, tipo = "IMPACTO", alteracoes: Record<string, unknown> = {}) {
  return sim.prisma.eventoEstruturaFiscal.create({ data: { versaoId, tipo, chaveOperacao: randomUUID(),
    usuarioId: sessao.userId, usuarioNome: sessao.nome, dados: { evidencia: privado, token: privado }, ...alteracoes } });
}
async function atividade(fonteId: string) {
  return sim.prisma.atividadeUsuario.findUniqueOrThrow({ where: { fonteTabela_fonteId: { fonteTabela: "EventoEstruturaFiscal", fonteId } } });
}

describe.skipIf(process.env.ESTRUTURA_FISCAL_BANCO_TESTE !== "1")("Atividades fiscais — fonte canônica e PostgreSQL local fictício", () => {
  beforeAll(async () => {
    url = new URL(process.env.DATABASE_URL!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname)
      || url.pathname !== "/teste_estrutura_fiscal") throw new Error("Somente PostgreSQL local teste_estrutura_fiscal é permitido.");
    banco = new Client({ connectionString: url.toString(), application_name: "atividade-fiscal-teste", connectionTimeoutMillis: 10000 });
    await banco.connect();
    const identidade = await banco.query("SELECT current_database() AS banco, host(inet_server_addr()) AS endereco");
    if (identidade.rows[0].banco !== "teste_estrutura_fiscal" || !["127.0.0.1", "::1"].includes(identidade.rows[0].endereco)) throw new Error("Servidor sintético inesperado.");
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    await banco.query("SET timezone TO 'UTC'");
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      if (pasta.name === "20261011233000_atividade_estrutura_fiscal") {
        // Upgrade sobre conexão que já compilou e executou a projeção anterior.
        await banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt")
          VALUES ('autor-upgrade-ficticio','Autor de upgrade fictício','upgrade-fiscal@example.invalid','sem-login',NOW())`);
        await banco.query(`INSERT INTO "HistoricoCadastroVenda" (id,entidade,"registroId","usuarioId","usuarioNome",depois)
          VALUES ('fonte-upgrade-ficticia','PRODUTO','produto-upgrade-ficticio','autor-upgrade-ficticio','Autor de upgrade fictício','{}'::jsonb)`);
      }
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema} -c timezone=UTC` }, { schema: esquema }) });
    adminId = (await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } })).id;
  }, 120000);
  beforeEach(async () => {
    const u = await sim.prisma.usuario.create({ data: { nome: "Autor fiscal validado fictício", email: `${randomUUID()}@example.invalid`, senhaHash: "sem-login", perfilAcessoId: adminId } });
    sessao = { userId: u.id, nome: u.nome, email: u.email, admin: true, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "Administrador" };
    sim.sessao.mockResolvedValue(sessao);
    produtoId = (await sim.prisma.produtoVenda.create({ data: { nome: "Produto fiscal exclusivamente fictício", unidade: "UN" } })).id;
  });
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (!banco) return;
    try {
      if (criado && /^teste_atividade_fiscal_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    } finally { await banco.end(); }
  });

  it("serviços reais registram criação, impacto e ativação pelo autor relido, sem copiar dados", async () => {
    await sim.prisma.usuario.update({ where: { id: sessao.userId }, data: { nome: "Administrador executor atual fictício" } });
    const v = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(v.id, sessao);
    await ativarVersaoFiscal(v.id, impacto.hash, randomUUID(), sessao);
    const registros = await sim.prisma.atividadeUsuario.findMany({ where: { fonteTabela: "EventoEstruturaFiscal", entidadeId: v.id }, orderBy: { sequencia: "asc" } });
    expect(registros.map(r => r.acao)).toEqual(["VERSAO_FISCAL_CRIADA", "IMPACTO_FISCAL_ANALISADO", "VERSAO_FISCAL_ATIVADA"]);
    for (const r of registros) expect(r).toMatchObject({ autorId: sessao.userId, autorNome: "Administrador executor atual fictício", atorTipo: "USUARIO", iniciadorId: null,
      recurso: "vendas.fiscal", entidade: "VersaoEstruturaFiscal", resultado: "SUCESSO", categoria: "CRITICA", antes: null, depois: null, origem: "NAO_IDENTIFICADA" });
    expect(serializar(registros)).not.toContain(privado);
    expect(registros.at(-1)?.resumo).toContain("sem transmissão");
  });

  it("contexto técnico explícito conserva autor, origem transacional e UTC sem herdar contexto", async () => {
    const v = await salvarVersaoFiscal(entrada(), sessao);
    const e = await sim.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT set_config('grazing.atividade', ${JSON.stringify({ origem: "AUTOMACAO", correlacaoId: "bootstrap-fiscal-ficticio" })}, true)`;
      await tx.$executeRawUnsafe("SET LOCAL timezone TO 'Pacific/Auckland'");
      const id = randomUUID();
      // Conteúdo UTC literal da fonte, sem depender do serializador Date do driver.
      await tx.$executeRaw`INSERT INTO "EventoEstruturaFiscal" (id,"versaoId",tipo,"chaveOperacao","usuarioId","usuarioNome",dados,"createdAt")
        VALUES (${id},${v.id},'IMPACTO',${randomUUID()},${sessao.userId},${"Autor\nfiscal fictício"},'{}'::jsonb,TIMESTAMP '2026-10-11 03:15:00')`;
      return { id };
    });
    const a = await atividade(e.id);
    expect(a).toMatchObject({ autorId: sessao.userId, atorTipo: "USUARIO", autorNome: "Autor fiscal fictício", origem: "AUTOMACAO", correlacaoId: "bootstrap-fiscal-ficticio", iniciadorId: null });
    expect(a.ocorridoEm.toISOString()).toBe("2026-10-11T03:15:00.000Z");
    expect((await atividade((await fonte(v.id)).id)).origem).toBe("NAO_IDENTIFICADA");
  });

  it("recuperação concorrente da fonte/id cria uma referência única sem reescrever autoria", async () => {
    const v = await salvarVersaoFiscal(entrada(), sessao);
    await banco!.query('ALTER TABLE "EventoEstruturaFiscal" DISABLE TRIGGER atividades_projetar_insert');
    let e: Awaited<ReturnType<typeof fonte>>;
    try { e = await fonte(v.id); } finally { await banco!.query('ALTER TABLE "EventoEstruturaFiscal" ENABLE TRIGGER atividades_projetar_insert'); }
    const clientes = [new Client({ connectionString: url.toString() }), new Client({ connectionString: url.toString() })];
    try {
      for (const c of clientes) { await c.connect(); await c.query(`SET search_path TO "${esquema}"`); }
      const rs = await Promise.all(clientes.map(c => c.query(`SELECT grazing_projetar_atividade('EventoEstruturaFiscal', to_jsonb(e)) AS id FROM "EventoEstruturaFiscal" e WHERE id=$1`, [e!.id])));
      expect(rs[0].rows[0].id).toBe(rs[1].rows[0].id);
      expect(await sim.prisma.atividadeUsuario.count({ where: { fonteTabela: "EventoEstruturaFiscal", fonteId: e!.id } })).toBe(1);
      await sim.prisma.usuario.update({ where: { id: sessao.userId }, data: { nome: "Nome atual alterado", ativo: false } });
      await clientes[0].query(`SELECT grazing_projetar_atividade('EventoEstruturaFiscal', to_jsonb(e)) FROM "EventoEstruturaFiscal" e WHERE id=$1`, [e!.id]);
      expect((await atividade(e!.id)).autorNome).toBe(sessao.nome);
    } finally { await Promise.all(clientes.map(c => c.end())); }
  });

  it("falha na projeção reverte ativação e evento juntos, preservando o rascunho", async () => {
    const v = await salvarVersaoFiscal(entrada(), sessao), impacto = await analisarImpactoFiscal(v.id, sessao);
    await banco!.query(`ALTER TABLE "AtividadeUsuario" ADD CONSTRAINT atividade_fiscal_falha_sintetica CHECK (acao <> 'VERSAO_FISCAL_ATIVADA') NOT VALID`);
    try {
      await expect(ativarVersaoFiscal(v.id, impacto.hash, randomUUID(), sessao)).rejects.toThrow();
      expect((await sim.prisma.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id } })).status).toBe("RASCUNHO");
      expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: v.id, tipo: "ATIVACAO" } })).toBe(0);
      expect(await sim.prisma.atividadeUsuario.count({ where: { entidadeId: v.id, acao: "VERSAO_FISCAL_ATIVADA" } })).toBe(0);
    } finally { await banco!.query('ALTER TABLE "AtividadeUsuario" DROP CONSTRAINT atividade_fiscal_falha_sintetica'); }
  });

  it("lista e detalhe exigem fiscal e expõem somente metadados imutáveis da versão", async () => {
    const v = await salvarVersaoFiscal(entrada(), sessao), e = await fonte(v.id), a = await atividade(e.id);
    const f = { usuarioId: sessao.userId, de: "2026-01-01", ate: "2026-12-31" };
    const permissoes = { "configuracoes.usuarios": ["visualizar"], "configuracoes.usuarios.atividades": ["visualizar"] };
    sim.sessao.mockResolvedValue({ ...sessao, admin: false, permissoes });
    expect((await consultarAtividades(f)).eventos).toHaveLength(0);
    await expect(consultarDetalheAtividade(sessao.userId, a.id)).rejects.toMatchObject({ status: 404 });
    sim.sessao.mockResolvedValue({ ...sessao, admin: false, permissoes: { ...permissoes, "vendas.fiscal": ["visualizar"] } });
    expect((await consultarAtividades(f)).eventos.map(r => r.id)).toContain(a.id);
    const d = await consultarDetalheAtividade(sessao.userId, a.id);
    expect(d).toMatchObject({ referenciaDisponivel: true, link: "/vendas/fiscal/cobertura" });
    expect(d.alteracoes).toEqual([{ campo: "tipo", antes: "—", depois: "CLASSIFICACAO" }, { campo: "versao", antes: "—", depois: "1" }, { campo: "vigenciaInicio", antes: "—", depois: "2026-10-11" }]);
    expect(JSON.stringify(d)).not.toMatch(/evidencia-fiscal|token|fontes|justificativa|08061000|example.invalid/);
  });

  it("fonte arbitrária, evento desconhecido ou autor ausente não geram atividade fictícia", async () => {
    const v = await salvarVersaoFiscal(entrada(), sessao);
    await expect(fonte(v.id, "EMISSAO_AUTORIZADA")).rejects.toThrow();
    expect(await sim.prisma.eventoEstruturaFiscal.count({ where: { versaoId: v.id, tipo: "EMISSAO_AUTORIZADA" } })).toBe(0);
    await expect(banco!.query("SELECT grazing_projetar_atividade('Usuario', '{}'::jsonb)")).rejects.toMatchObject({ code: "22023" });
    await expect(banco!.query("SELECT grazing_projetar_atividade('EventoEstruturaFiscal', $1::jsonb)", [JSON.stringify({ id: "evento-sem-autor", versaoId: v.id, tipo: "IMPACTO", createdAt: "2026-10-11T03:00:00" })])).rejects.toMatchObject({ code: "22023" });
  });

  it("delegação preserva fonte comercial anterior e só inserção do histórico central", async () => {
    const e = await sim.prisma.historicoCadastroVenda.create({ data: { entidade: "PRODUTO", registroId: produtoId, usuarioId: sessao.userId,
      usuarioNome: sessao.nome, depois: { ativo: true, segredo: privado } } });
    const a = await sim.prisma.atividadeUsuario.findUniqueOrThrow({ where: { fonteTabela_fonteId: { fonteTabela: "HistoricoCadastroVenda", fonteId: e.id } } });
    expect(a).toMatchObject({ recurso: "vendas.produtos", autorId: sessao.userId, antes: null, depois: null });
    expect(serializar(a)).not.toContain(privado);
    const v = await salvarVersaoFiscal(entrada(), sessao), fiscal = await atividade((await fonte(v.id)).id);
    await expect(sim.prisma.atividadeUsuario.update({ where: { id: fiscal.id }, data: { resumo: "Alteração indevida" } })).rejects.toThrow();
    await expect(sim.prisma.atividadeUsuario.delete({ where: { id: fiscal.id } })).rejects.toThrow();
  });
});
