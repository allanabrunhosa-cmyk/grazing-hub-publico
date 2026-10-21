import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { randomBytes } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import type { SalvarPorcaoInput } from "@/lib/insumos/porcoes";

const estado = vi.hoisted(() => ({ banco: null as unknown as PrismaClient, sessao: null as SessaoAtual | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: new Proxy({}, { get: (_objeto, chave) => {
  const valor = Reflect.get(estado.banco, chave);
  return typeof valor === "function" ? valor.bind(estado.banco) : valor;
} }) }));
vi.mock("@/lib/session", () => ({ getSession: async () => estado.sessao }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (destino: string) => { throw new Error(`REDIRECT:${destino}`); } }));

import { listarPorcoesAction, removerPorcaoAction, salvarPorcaoAction, reordenarCategoriasPorcoesAction } from "@/app/(protegido)/porcoes/actions";
import { GET as consultarEndpointPorcoes } from "@/app/api/insumos/[id]/porcoes/route";
import { saveInsumoAction } from "@/app/(protegido)/insumos/actions";
import { selecionarPorcao } from "@/lib/insumos/porcoes";

const permissoes = { "suprimentos.porcoes": ["visualizar", "adicionar", "editar", "excluir"] };
const entrada = (nome = "8 fatias"): SalvarPorcaoInput => ({ insumoId: "insumo-ficticio", nome, quantidade: "0.123456789", unidade: "KG" });

describe.skipIf(process.env.PORCOES_BANCO_TESTE !== "1")("porções em PostgreSQL descartável", () => {
  let pool: Pool;
  let schema: string;

  beforeAll(async () => {
    const valor = process.env.PORCOES_DATABASE_URL;
    if (!valor) throw new Error("Informe PORCOES_DATABASE_URL exclusiva do banco descartável porcoes_teste.");
    const url = new URL(valor);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      || url.pathname !== "/porcoes_teste" || [...url.searchParams].length) throw new Error("Integração exige banco local porcoes_teste sem opções adicionais.");
    schema = `porcoes_teste_${randomBytes(8).toString("hex")}`;
    url.searchParams.set("options", `-c search_path=${schema}`);
    pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 10000 });
    await pool.query(`CREATE SCHEMA "${schema}"`);
    estado.banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema }) });
    const migrations = (await readdir("prisma/migrations", { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const nome of migrations.filter((nome) => nome !== "20261002120000_tabela_porcoes" && nome !== "20261002230000_porcoes_multiplicaveis")) {
      await pool.query(prepararSqlMigrationFiscal(nome, await readFile(path.join("prisma/migrations", nome, "migration.sql"), "utf8")));
    }
    await estado.banco.perfilAcesso.create({ data: { id: "perfil-ficticio", nome: "Equipe fictícia", permissoes } });
    await estado.banco.usuario.create({ data: { id: "usuario-ficticio", nome: "Autor fictício", email: "porcoes@example.invalid", senhaHash: "sem-login", perfilAcessoId: "perfil-ficticio" } });
    await estado.banco.insumo.createMany({ data: [
      { id: "insumo-ficticio", nome: "Queijo fictício", unidade: "KG" },
      { id: "insumo-un", nome: "Biscoito fictício", unidade: "UN" },
      { id: "preparacao-ficticia", nome: "Preparação fictícia", unidade: "UN", tipo: "PRODUTO_INTERMEDIARIO" },
    ] });
    await pool.query(`INSERT INTO "ComposicaoInsumo" (id, "produtoId", "componenteId", quantidade, "observacaoPorcao") VALUES ('composicao-legada', 'preparacao-ficticia', 'insumo-un', 123456789.123, 'Porção anterior')`);
    await pool.query(await readFile("prisma/migrations/20261002120000_tabela_porcoes/migration.sql", "utf8"));
    await pool.query(`INSERT INTO "PorcaoInsumo" (id, "insumoId", nome, "nomeNormalizado", quantidade, unidade, "updatedAt") VALUES ('legada-medida', 'insumo-un', '8 fatias padrão', '8 fatias padrão', 0.1, 'UN', now())`);
    await pool.query(await readFile("prisma/migrations/20261002230000_porcoes_multiplicaveis/migration.sql", "utf8"));
    const legada = await estado.banco.porcaoInsumo.findUniqueOrThrow({ where: { id: "legada-medida" } });
    expect(legada.quantidadeMedida?.toFixed()).toBe("8");
    expect(legada.unidadeMedida).toBe("fatias padrão");
    expect(legada.quantidade.toFixed()).toBe("0.1");
  }, 60000);

  beforeEach(async () => {
    await estado.banco.historicoPorcaoInsumo.deleteMany();
    await estado.banco.historicoOrdemCategoriasPorcoes.deleteMany();
    await estado.banco.categoria.deleteMany();
    await estado.banco.porcaoInsumo.deleteMany();
    await estado.banco.composicaoInsumo.deleteMany({ where: { id: { not: "composicao-legada" } } });
    await estado.banco.perfilAcesso.update({ where: { id: "perfil-ficticio" }, data: { permissoes } });
    await estado.banco.usuario.update({ where: { id: "usuario-ficticio" }, data: { sessaoVersao: 0, ativo: true, admin: false, permissoesPersonalizadas: {} } });
    await estado.banco.insumo.update({ where: { id: "insumo-ficticio" }, data: { unidade: "KG", ativo: true } });
    estado.sessao = { userId: "usuario-ficticio", nome: "Autor fictício", email: "porcoes@example.invalid", admin: false, versao: 0, perfilNome: "Equipe fictícia", permissoes: { "suprimentos.porcoes": ["visualizar", "adicionar", "editar", "excluir"] }, excecoes: {} };
  });

  afterAll(async () => {
    if (estado.banco) await estado.banco.$disconnect();
    if (pool && /^porcoes_teste_[a-f0-9]{16}$/.test(schema)) await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    if (pool) await pool.end();
  });

  async function criar(nome?: string) {
    const resultado = await salvarPorcaoAction(entrada(nome));
    if ("erro" in resultado) throw new Error(resultado.erro);
    return resultado.porcao;
  }

  async function categorias() {
    await estado.banco.categoria.createMany({ data: [{ id: "cat-a", nome: "A" }, { id: "cat-b", nome: "B" }, { id: "cat-c", nome: "C" }] });
    await estado.banco.insumo.createMany({ data: ["a", "b", "c"].map(id => ({ id: `categoria-insumo-${id}`, nome: `Insumo ${id}`, categoriaId: `cat-${id}`, unidade: "UN" as const })) , skipDuplicates: true });
    for (const id of ["a", "b", "c"]) {
      await estado.banco.insumo.update({ where: { id: `categoria-insumo-${id}` }, data: { categoriaId: `cat-${id}` } });
      await estado.banco.porcaoInsumo.create({ data: { insumoId: `categoria-insumo-${id}`, nome: "1 un", nomeNormalizado: "1 un", unidade: "UN", quantidade: "1" } });
    }
    return [{ id: "cat-a", versao: 1 }, { id: "cat-b", versao: 1 }, { id: "cat-c", versao: 1 }];
  }

  it("ordem de categorias persiste, audita e é idempotente sem alterar nomes", async () => {
    const itens = await categorias();
    expect((await estado.banco.categoria.findUniqueOrThrow({ where: { id: "cat-a" } })).ordemPorcoes).toBe(2147483647);
    const ordem = [itens[2], itens[0], itens[1]];
    const resultado = await reordenarCategoriasPorcoesAction(ordem);
    expect(resultado).toMatchObject({ categorias: [{ id: "cat-c", nome: "C", ordem: 0, versao: 2 }, { id: "cat-a", ordem: 1 }, { id: "cat-b", ordem: 2 }] });
    expect(await reordenarCategoriasPorcoesAction(ordem)).toEqual(resultado);
    expect(await estado.banco.historicoOrdemCategoriasPorcoes.count()).toBe(1);
    expect(await estado.banco.historicoOrdemCategoriasPorcoes.findFirstOrThrow()).toMatchObject({ autorId: "usuario-ficticio", antes: expect.any(Array), depois: expect.any(Array) });
  });

  it("ordenação rejeita conjuntos adulterados e versões antigas sem gravação parcial", async () => {
    const itens = await categorias();
    for (const entrada of [[itens[0], itens[0], itens[2]], itens.slice(1), [itens[2], itens[1], { id: "ausente", versao: 1 }], [{ ...itens[2], versao: 9 }, itens[0], itens[1]]]) {
      expect(await reordenarCategoriasPorcoesAction(entrada)).toHaveProperty("erro");
    }
    expect(await estado.banco.historicoOrdemCategoriasPorcoes.count()).toBe(0);
    expect(await estado.banco.categoria.count({ where: { versaoOrdemPorcoes: 1, ordemPorcoes: 2147483647 } })).toBe(3);
  });

  it("ordenação confere a permissão atual no servidor", async () => {
    const itens = await categorias();
    await estado.banco.perfilAcesso.update({ where: { id: "perfil-ficticio" }, data: { permissoes: { "suprimentos.porcoes": ["visualizar"] } } });
    expect(await reordenarCategoriasPorcoesAction([...itens].reverse())).toHaveProperty("erro", expect.stringContaining("acesso"));
    expect(await estado.banco.historicoOrdemCategoriasPorcoes.count()).toBe(0);
  });

  it("ordenações concorrentes não sobrescrevem uma sequência mais recente", async () => {
    const itens = await categorias();
    const resultados = await Promise.all([reordenarCategoriasPorcoesAction([itens[1], itens[0], itens[2]]), reordenarCategoriasPorcoesAction([itens[2], itens[0], itens[1]])]);
    expect(resultados.filter(r => "categorias" in r)).toHaveLength(1);
    expect(resultados.filter(r => "erro" in r)).toHaveLength(1);
    expect(await estado.banco.historicoOrdemCategoriasPorcoes.count()).toBe(1);
  });

  it("preserva categorias sem porções e ignora porções removidas no conjunto ordenável", async () => {
    const itens = await categorias();
    await estado.banco.categoria.create({ data: { id: "cat-vazia", nome: "Sem porções", ordemPorcoes: 50, versaoOrdemPorcoes: 7 } });
    await estado.banco.porcaoInsumo.updateMany({ where: { insumoId: "categoria-insumo-c" }, data: { excluidoEm: new Date() } });
    const removida = await estado.banco.categoria.findUniqueOrThrow({ where: { id: "cat-c" } });
    expect(await reordenarCategoriasPorcoesAction([...itens].reverse())).toHaveProperty("erro");
    const resultado = await reordenarCategoriasPorcoesAction([itens[1], itens[0]]);
    expect(resultado).toMatchObject({ categorias: expect.arrayContaining([{ id: "cat-vazia", nome: "Sem porções", ordem: 50, versao: 7 }, expect.objectContaining({ id: "cat-b", ordem: 0 }), expect.objectContaining({ id: "cat-a", ordem: 1 })]) });
    expect(await estado.banco.categoria.findUniqueOrThrow({ where: { id: "cat-c" } })).toEqual(removida);
    expect(await estado.banco.historicoOrdemCategoriasPorcoes.findFirstOrThrow()).toMatchObject({ antes: [expect.objectContaining({ id: "cat-a" }), expect.objectContaining({ id: "cat-b" })], depois: [expect.objectContaining({ id: "cat-b" }), expect.objectContaining({ id: "cat-a" })] });
  });

  it("recusa uma ordem aberta antes de outra categoria receber sua primeira porção", async () => {
    const itens = await categorias();
    await estado.banco.porcaoInsumo.deleteMany({ where: { insumoId: "categoria-insumo-c" } });
    const ordemAntiga = [itens[1], itens[0]];
    await estado.banco.porcaoInsumo.create({ data: { insumoId: "categoria-insumo-c", nome: "2 un", nomeNormalizado: "2 un", unidade: "UN", quantidade: "2" } });
    expect(await reordenarCategoriasPorcoesAction(ordemAntiga)).toHaveProperty("erro", expect.stringContaining("categorias com porções"));
    expect(await estado.banco.historicoOrdemCategoriasPorcoes.count()).toBe(0);
  });

  it("preparação salva medida e multiplicador, rejeitando consumo adulterado e unidade divergente", async () => {
    estado.sessao!.permissoes.insumos = ["adicionar", "editar", "visualizar"];
    const referencia = selecionarPorcao(await criar());
    const porcao = { ...referencia, quantidadeInsumo: "0.1", numeroPorcoes: "0,5" };
    const form = (quantidade: number, unidadeInsumo = "KG") => {
      const dados = new FormData(); dados.set("nome", "Preparação sintética porcionada"); dados.set("unidade", "UN"); dados.set("tipo", "PRODUTO_INTERMEDIARIO");
      dados.set("componentes", JSON.stringify({ componenteId: "insumo-ficticio", quantidade, porcao: { ...porcao, unidadeInsumo } }));
      dados.set("rendimentoQuantidade", ",5"); dados.set("rendimentoUnidade", "UN"); dados.set("estoqueMinimo", ",5"); dados.set("estoqueMaximo", "0,5");
      return dados;
    };
    const resultado = await saveInsumoAction({ error: null }, form(0.05));
    expect(resultado.error).toBeNull();
    const preparacao = await estado.banco.insumo.findUniqueOrThrow({ where: { id: resultado.insumoId } });
    expect(preparacao.rendimentoQuantidade?.toFixed()).toBe("0.5");
    expect(preparacao.estoqueMinimo.toFixed()).toBe("0.5");
    expect(preparacao.estoqueMaximo?.toFixed()).toBe("0.5");
    const composicao = await estado.banco.composicaoInsumo.findFirstOrThrow({ where: { produtoId: resultado.insumoId } });
    expect(composicao.quantidade.toFixed()).toBe("0.05");
    expect(composicao.observacaoPorcao).toBe("4 fatias");
    expect(composicao.porcao).toMatchObject({ numeroPorcoes: "0.5", quantidadeMedida: "8", quantidadeInsumo: "0.1" });
    expect((await saveInsumoAction({ error: null }, form(0.1))).error).toContain("não corresponde");
    expect((await saveInsumoAction({ error: null }, form(0.05, "G"))).error).toContain("unidade");
    expect(await estado.banco.movimentacaoEstoque.count()).toBe(0);
  });

  it("mantém a primeira medida cadastrada como base mesmo com novos nomes anteriores alfabeticamente", async () => {
    const primeira = await criar("8 fatias");
    await estado.banco.porcaoInsumo.update({ where: { id: primeira.id }, data: { createdAt: new Date("2026-01-01T00:00:00Z") } });
    const segunda = await criar("1 fatia");
    const resultado = await listarPorcoesAction("insumo-ficticio");
    expect(resultado).toMatchObject({ porcoes: [expect.objectContaining({ id: primeira.id }), expect.objectContaining({ id: segunda.id })] });
  });

  it("migration preserva quantidade antiga e nova precisão de nove casas", async () => {
    expect((await estado.banco.composicaoInsumo.findUniqueOrThrow({ where: { id: "composicao-legada" } })).quantidade.toString()).toBe("123456789.123");
    const porcao = await criar();
    expect(porcao.quantidade).toBe("0.123456789");
    const ficha = await estado.banco.composicaoInsumo.create({ data: { produtoId: "preparacao-ficticia", componenteId: "insumo-ficticio", quantidade: porcao.quantidade, observacaoPorcao: porcao.nome } });
    expect(ficha.quantidade.toString()).toBe("0.123456789");
    expect(await estado.banco.historicoPorcaoInsumo.count()).toBe(1);
  });

  it("retorna o mínimo como decimal simples compatível com o campo de quantidade", async () => {
    expect(await salvarPorcaoAction({ ...entrada(), quantidade: "0.000000001" })).toMatchObject({ sucesso: true, porcao: { quantidade: "0.000000001" } });
    expect(await listarPorcoesAction("insumo-ficticio")).toMatchObject({ porcoes: [expect.objectContaining({ quantidade: "0.000000001" })] });
  });

  it("cadastro concorrente normaliza nome e é idempotente sem duplicar auditoria", async () => {
    const resultados = await Promise.all([salvarPorcaoAction(entrada("  8   FATIAS  ")), salvarPorcaoAction(entrada("8 fatias"))]);
    expect(resultados.every((r) => "sucesso" in r)).toBe(true);
    expect(await estado.banco.porcaoInsumo.count()).toBe(1);
    expect(await estado.banco.historicoPorcaoInsumo.count()).toBe(1);
    const conflito = await salvarPorcaoAction({ ...entrada("8 fatias"), quantidade: "1" });
    expect(conflito).toHaveProperty("erro", expect.stringContaining("Já existe"));
    expect((await estado.banco.porcaoInsumo.findFirstOrThrow()).quantidade.toString()).toBe("0.123456789");
  });

  it("editores concorrentes não sobrescrevem uma versão mais nova", async () => {
    const porcao = await criar();
    const resultados = await Promise.all([
      salvarPorcaoAction({ ...entrada(), id: porcao.id, versao: 1, quantidade: "1" }),
      salvarPorcaoAction({ ...entrada(), id: porcao.id, versao: 1, quantidade: "2" }),
    ]);
    expect(resultados.filter((r) => "sucesso" in r)).toHaveLength(1);
    expect(resultados.filter((r) => "erro" in r)).toHaveLength(1);
    expect(await estado.banco.historicoPorcaoInsumo.count()).toBe(2);
  });

  it("remoção repetida é idempotente e conserva snapshots da ficha", async () => {
    const porcao = await criar();
    const ficha = await estado.banco.composicaoInsumo.create({ data: { produtoId: "preparacao-ficticia", componenteId: "insumo-ficticio", quantidade: porcao.quantidade, observacaoPorcao: porcao.nome } });
    expect(await removerPorcaoAction(porcao)).toEqual({ sucesso: true });
    expect(await removerPorcaoAction(porcao)).toEqual({ sucesso: true });
    expect((await listarPorcoesAction("insumo-ficticio"))).toMatchObject({ porcoes: [] });
    expect(await estado.banco.composicaoInsumo.findUnique({ where: { id: ficha.id } })).toEqual(ficha);
    expect(await estado.banco.historicoPorcaoInsumo.count()).toBe(2);
    const recadastrada = await criar();
    expect(recadastrada).toMatchObject({ id: porcao.id, versao: 3 });
    expect(await removerPorcaoAction(porcao)).toHaveProperty("erro");
  });

  it("troca de unidade oculta porções antigas e rejeita gravar com unidade anterior", async () => {
    await criar();
    await estado.banco.insumo.update({ where: { id: "insumo-ficticio" }, data: { unidade: "G" } });
    expect(await listarPorcoesAction("insumo-ficticio")).toMatchObject({ porcoes: [] });
    expect(await salvarPorcaoAction(entrada("Outra"))).toHaveProperty("erro", expect.stringContaining("unidade"));
    expect(await estado.banco.porcaoInsumo.count()).toBe(1);
  });

  it("edição muda insumo e valida a nova unidade", async () => {
    const porcao = await criar();
    expect(await salvarPorcaoAction({ ...entrada(), ...porcao, insumoId: "insumo-un", unidade: "UN", quantidade: "2" })).toMatchObject({ sucesso: true, porcao: { insumoId: "insumo-un", unidade: "UN", quantidade: "2", versao: 2 } });
    expect(await listarPorcoesAction("insumo-ficticio")).toMatchObject({ porcoes: [] });
  });

  it.each(["insumos", "vendas.produtos"])("leitura via %s não concede cadastro de porções", async (recurso) => {
    await criar();
    await estado.banco.perfilAcesso.update({ where: { id: "perfil-ficticio" }, data: { permissoes: { [recurso]: ["visualizar"] } } });
    estado.sessao!.permissoes = { [recurso]: ["visualizar"] };
    expect(await listarPorcoesAction("insumo-ficticio")).toMatchObject({ porcoes: [expect.objectContaining({ nome: "8 fatias" })], podeCadastrar: false });
    await expect(salvarPorcaoAction(entrada())).rejects.toThrow("REDIRECT:/sem-acesso");
  });

  it("revogação dentro da transação prevalece sobre sessão carregada", async () => {
    await estado.banco.perfilAcesso.update({ where: { id: "perfil-ficticio" }, data: { permissoes: {} } });
    await estado.banco.usuario.update({ where: { id: "usuario-ficticio" }, data: { admin: true } });
    expect(await salvarPorcaoAction(entrada())).toHaveProperty("erro", expect.stringContaining("acesso"));
    expect(await estado.banco.porcaoInsumo.count()).toBe(0);
    expect(await estado.banco.historicoPorcaoInsumo.count()).toBe(0);
  });

  it("versão de sessão revogada bloqueia criação e consulta", async () => {
    await estado.banco.usuario.update({ where: { id: "usuario-ficticio" }, data: { sessaoVersao: 1 } });
    expect(await salvarPorcaoAction(entrada())).toHaveProperty("erro", expect.stringContaining("sessão expirou"));
    expect(await listarPorcoesAction("insumo-ficticio")).toHaveProperty("erro", expect.stringContaining("sessão expirou"));
  });

  it("falha ao auditar reverte o cadastro completo", async () => {
    await pool.query('ALTER TABLE "HistoricoPorcaoInsumo" ADD CONSTRAINT "falha_auditoria_teste" CHECK ("acao" <> \'CRIAR\')');
    try {
      expect(await salvarPorcaoAction(entrada())).toHaveProperty("erro");
      expect(await estado.banco.porcaoInsumo.count()).toBe(0);
    } finally { await pool.query('ALTER TABLE "HistoricoPorcaoInsumo" DROP CONSTRAINT "falha_auditoria_teste"'); }
  });

  it("não cadastra nem lista porções de insumo inativo", async () => {
    await estado.banco.insumo.update({ where: { id: "insumo-ficticio" }, data: { ativo: false } });
    expect(await salvarPorcaoAction(entrada())).toHaveProperty("erro");
    expect(await listarPorcoesAction("insumo-ficticio")).toHaveProperty("erro");
    expect(await estado.banco.porcaoInsumo.count()).toBe(0);
  });
  it("endpoint estável consulta dados reais do schema fictício e bloqueia sessão revogada", async () => {
    await salvarPorcaoAction(entrada());
    const req = new Request("http://localhost/api/insumos/insumo-ficticio/porcoes");
    const contexto = { params: Promise.resolve({ id: "insumo-ficticio" }) };
    const resposta = await consultarEndpointPorcoes(req, contexto);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ porcoes: [expect.objectContaining({ quantidade: "0.123456789" })] });
    expect(await estado.banco.historicoPorcaoInsumo.count()).toBe(1);
    expect(await estado.banco.movimentacaoEstoque.count()).toBe(0);
    await estado.banco.usuario.update({ where: { id: "usuario-ficticio" }, data: { sessaoVersao: 1 } });
    const revogada = await consultarEndpointPorcoes(req, contexto);
    expect(revogada.status).toBe(400);
    expect(await revogada.json()).toHaveProperty("erro", expect.stringContaining("sessão expirou"));
  });

});
