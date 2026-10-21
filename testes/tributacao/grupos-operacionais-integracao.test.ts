import "dotenv/config";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { aplicarGruposOperacionais, simularGruposOperacionais, type LoteGruposOperacionais } from "@/lib/tributacao/lote-grupos-operacionais";
import { GRUPOS_OPERACIONAIS, type GrupoOperacional } from "@/lib/tributacao/grupos-operacionais";
import { hojeFiscal } from "@/lib/tributacao/validacao";
import type { SessaoAtual } from "@/lib/session";
import { hashFiscal } from "@/lib/tributacao/servico";

const schema = `teste_grupos_${randomUUID().replaceAll("-", "")}`;
let banco: Client, prisma: PrismaClient, sessao: SessaoAtual, entrada: LoteGruposOperacionais, criado = false;
describe.skipIf(process.env.PARAMETROS_FISCAIS_BANCO_TESTE !== "1")("Quatro grupos em banco sintético isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/teste_estrutura_fiscal") throw new Error("Somente banco local sintético.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    if (!["127.0.0.1", "::1"].includes((await banco.query("SELECT host(inet_server_addr()) AS host")).rows[0].host)) throw new Error("Servidor não local.");
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const p of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await prisma.perfilAcesso.upsert({ where: { sistema: "ADMINISTRADOR" }, create: { nome: "Admin sintético", sistema: "ADMINISTRADOR" }, update: {} });
    const u = await prisma.usuario.create({ data: { nome: "Fiscal sintético", email: "grupos@example.invalid", senhaHash: "sintetico", perfilAcessoId: perfil.id } });
    sessao = { userId: u.id, nome: u.nome, email: u.email, versao: 0, admin: true, permissoes: {}, excecoes: {}, perfilNome: perfil.nome };
    entrada = { politicaGrupos: "QUATRO_GRUPOS", loteId: "quatro-grupos-teste", vigenciaInicio: hojeFiscal(), referencias: {} as LoteGruposOperacionais["referencias"], produtos: [] };
    for (const [i,chave] of (Object.keys(GRUPOS_OPERACIONAIS) as GrupoOperacional[]).entries()) {
      const p = await prisma.produtoVenda.create({ data: { nome: chave, preco: "17.35", fiscal: { ncm: i === 2 ? "22030000" : "04061010", origem: "0", cfop: i === 2 ? "5405" : "5102", csosn: i === 2 ? "500" : "102", pis: "49", cofins: "49", unidadeTributavel: "UN", metadadoLegado: "preservar" } } });
      entrada.referencias[chave] = { id: p.id, versao: p.versao }; entrada.produtos.push({ id: p.id, versao: p.versao, grupo: chave });
    }
    const p = await prisma.produtoVenda.create({ data: { nome: "Inativo sem NCM", ativo: false, preco: "7.20", fiscal: {} } });
    entrada.produtos.push({ id: p.id, versao: p.versao, grupo: "PREPARACOES" });
    const id = entrada.referencias.PREPARACOES.id;
    const dados = { produtoId: id, grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL", ncm: "04061010", origem: "0", cest: null, unidade: "UN", estado: "CONFIRMADO", evidencias: ["Documento exclusivamente sintético"], pendencias: [], ncmAplicabilidade: "APLICAVEL", analiseNcm: { fundamento: "DOCUMENTAL", confianca: "ALTA", descricaoNcm: "Descrição exclusivamente sintética", dataAnalise: hojeFiscal(), justificativa: "Identidade da apresentação sintética documentada para o teste.", fontes: ["documento-sintetico"], pendenciasNcm: [] } };
    await prisma.versaoEstruturaFiscal.create({ data: { tipo: "CLASSIFICACAO", chave: id, versao: 1, vigenciaInicio: new Date(`${hojeFiscal()}T00:00:00Z`), status: "ATIVO", dados, hash: hashFiscal(dados), justificativa: "Classificação sintética anterior ao agrupamento.", fontes: [], criadoPorId: u.id, criadoPorNome: u.nome, chaveOperacao: "classe-sintetica", hashOperacao: "a".repeat(64) } });
  }, 120000);
  afterAll(async () => { await prisma?.$disconnect(); if (criado) await banco.query(`DROP SCHEMA "${schema}" CASCADE`); await banco?.end(); });
  it("simula sem gravar, exige catálogo completo e detecta concorrência", async () => {
    const antes = await prisma.produtoVenda.findMany();
    const previa = await simularGruposOperacionais(entrada, sessao, prisma);
    expect(previa.produtos).toBe(5); expect(previa.classificacoesGtin).toBe(1); expect(await prisma.produtoVenda.findMany()).toEqual(antes);
    expect(await prisma.historicoCadastroVenda.count()).toBe(0);
    await expect(simularGruposOperacionais({ ...entrada, produtos: entrada.produtos.slice(1) }, sessao, prisma)).rejects.toThrow("todos os produtos");
    await expect(aplicarGruposOperacionais(entrada, "0".repeat(64), sessao, prisma)).rejects.toThrow("mudaram");
    await expect(simularGruposOperacionais(entrada, { ...sessao, userId: "inexistente" }, prisma)).rejects.toThrow("sessão");
  });
  it("aplica exatamente quatro opções, preserva NCM/negócio e repete sem duplicar", async () => {
    const antes = await prisma.produtoVenda.findMany();
    const previa = await simularGruposOperacionais(entrada, sessao, prisma);
    await aplicarGruposOperacionais(entrada, previa.hashPlano, sessao, prisma);
    const grupos = await prisma.grupoFiscalVenda.findMany({ where: { ativo: true } });
    expect(grupos.map(g => g.nome).sort()).toEqual(Object.values(GRUPOS_OPERACIONAIS).sort());
    const depois = await prisma.produtoVenda.findMany();
    for (const p of depois) {
      const a = antes.find(a => a.id === p.id)!;
      expect((p.fiscal as Record<string, unknown>).ncm).toBe((a.fiscal as Record<string, unknown>).ncm);
      expect(p.grupoFiscalId).toBeTruthy(); expect(p.ativo).toBe(a.ativo); expect(p.preco.toString()).toBe(a.preco.toString());
      expect(p.fiscal).toMatchObject({ ean: "SEM GTIN" });
    }
    expect(await aplicarGruposOperacionais(entrada, previa.hashPlano, sessao, prisma)).toMatchObject({ aplicadoAnteriormente: true, produtos: 0 });
    const versao = await prisma.versaoEstruturaFiscal.findFirstOrThrow({ where: { chave: entrada.referencias.PREPARACOES.id }, orderBy: { versao: "desc" } });
    expect(versao.dados).toMatchObject({ gtin: "SEM GTIN", ncm: "04061010", grupo: "GF05" });
    expect(depois.find(p => p.id === entrada.referencias.PREPARACOES.id)?.grupoFiscalId).toBe(grupos.find(g => g.nome === "Preparações")?.id);
    expect(await prisma.documentoFiscalSaida.count()).toBe(0); expect(await prisma.movimentacaoEstoque.count()).toBe(0); expect(await prisma.lancamentoFinanceiro.count()).toBe(0);
  });
});
