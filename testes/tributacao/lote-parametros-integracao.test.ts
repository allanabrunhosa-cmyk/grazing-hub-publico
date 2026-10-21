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
import { aplicarParametrosFiscais, simularParametrosFiscais, type LoteParametrosFiscais } from "@/lib/tributacao/lote-parametros";
import { hashFiscal } from "@/lib/tributacao/servico";
import { hojeFiscal } from "@/lib/tributacao/validacao";
import type { SessaoAtual } from "@/lib/session";

const schema = `teste_parametros_${randomUUID().replaceAll("-", "")}`;
let banco: Client, prisma: PrismaClient, sessao: SessaoAtual, entrada: LoteParametrosFiscais, criado = false;
describe.skipIf(process.env.PARAMETROS_FISCAIS_BANCO_TESTE !== "1")("Parâmetros fiscais no banco sintético isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/teste_estrutura_fiscal") throw new Error("Somente banco local sintético.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    if (!["127.0.0.1", "::1"].includes((await banco.query("SELECT host(inet_server_addr()) AS host")).rows[0].host)) throw new Error("Servidor não local.");
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name));
    for (const p of pastas) await banco.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    const perfil = await prisma.perfilAcesso.upsert({ where: { sistema: "ADMINISTRADOR" }, create: { nome: "Admin sintético", sistema: "ADMINISTRADOR" }, update: {} });
    const u = await prisma.usuario.create({ data: { nome: "Fiscal sintético", email: "fiscal-parametros@example.invalid", senhaHash: "sintetico", perfilAcessoId: perfil.id } });
    sessao = { userId: u.id, nome: u.nome, email: u.email, versao: 0, admin: true, permissoes: {}, excecoes: {}, perfilNome: perfil.nome };
    const dados = { estabelecimento: "singleton", uf: "SP", regime: "SIMPLES_NACIONAL", confirmado: true, crt: 1 };
    await prisma.versaoEstruturaFiscal.create({ data: { tipo: "PERFIL", chave: "singleton", versao: 1, vigenciaInicio: new Date(`${hojeFiscal()}T00:00:00Z`), status: "ATIVO", dados, hash: hashFiscal(dados), justificativa: "Perfil exclusivamente sintético.", fontes: [], criadoPorId: u.id, criadoPorNome: u.nome, chaveOperacao: "perfil-sintetico", hashOperacao: "a".repeat(64) } });
    const g = await prisma.grupoFiscalVenda.upsert({ where: { codigo: "GF05" }, create: { nome: "Grupo sintético", codigo: "GF05", fiscal: {} }, update: {} });
    const p = await prisma.produtoVenda.create({ data: { nome: "Produto sintético", preco: "17.35", unidade: "UN", grupoFiscalId: g.id, fiscal: { ncm: "04061010", metadadoLegado: "preservar" } } });
    entrada = { loteId: "lote-sintetico", vigenciaInicio: hojeFiscal(), perfilHash: hashFiscal(dados), grupos: [{ id: g.id, versao: 1, fiscal: { cfop: "5102", csosn: "102", pis: "99", cofins: "99", unidadeTributavel: "UN" }, justificativa: "Política do grupo sintético sem propagação para cadastros históricos." }], produtos: [{ id: p.id, versao: 1, fiscal: { origem: "0", cfop: "5102", csosn: "102", pis: "99", cofins: "99", unidadeTributavel: "UN", ean: "SEM GTIN" }, justificativa: "Mercadoria sintética vendida em porção própria sem GTIN atribuído." }], versoes: [] };
    entrada.produtos[0].revisado = true;
    entrada.versoes.push({ tipo: "CLASSIFICACAO", chave: p.id, versaoBase: 0, vigenciaInicio: hojeFiscal(), chaveOperacao: "classe-parametros-sintetica", justificativa: "Classificação exclusivamente sintética para validar sincronização transacional.", fontes: ["documento-sintetico"], dados: { produtoId: p.id, grupo: "GF05", natureza: "FRACIONADO", tratamento: "NORMAL", ncm: "04061010", origem: "0", cest: null, unidade: "UN", estado: "CONFIRMADO", evidencias: ["Documento exclusivamente sintético"], pendencias: [], ncmAplicabilidade: "APLICAVEL", analiseNcm: { fundamento: "DOCUMENTAL", confianca: "ALTA", descricaoNcm: "Descrição exclusivamente sintética", dataAnalise: hojeFiscal(), justificativa: "Identidade da apresentação exclusivamente sintética documentada para o teste.", fontes: ["documento-sintetico"], pendenciasNcm: [] } } });
  }, 120000);
  afterAll(async () => { await prisma?.$disconnect(); if (criado) await banco.query(`DROP SCHEMA "${schema}" CASCADE`); await banco?.end(); });
  it("simula sem persistir e aplica de forma auditada e idempotente", async () => {
    const previa = await simularParametrosFiscais(entrada, sessao, prisma);
    expect(await prisma.historicoCadastroVenda.count()).toBe(0);
    expect((await prisma.produtoVenda.findUniqueOrThrow({ where: { id: entrada.produtos[0].id } })).versao).toBe(1);
    const aplicado = await aplicarParametrosFiscais(entrada, previa.hashPlano, sessao, prisma);
    expect(aplicado).toMatchObject({ aplicadoAnteriormente: false, grupos: 1, produtos: 1 });
    const p = await prisma.produtoVenda.findUniqueOrThrow({ where: { id: entrada.produtos[0].id } });
    expect(p.fiscal).toMatchObject({ ncm: "04061010", origem: "0", metadadoLegado: "preservar" });
    expect(p.preco.toString()).toBe("17.35"); expect(p.fiscalRevisado).toBe(true); expect(p.versao).toBe(3);
    expect(await prisma.eventoEstruturaFiscal.count()).toBe(3);
    const recibo = await prisma.historicoCadastroVenda.findFirstOrThrow({ where: { entidade: "FISCAL", registroId: entrada.loteId } });
    expect((await prisma.atividadeUsuario.findUniqueOrThrow({ where: { fonteTabela_fonteId: { fonteTabela: "HistoricoCadastroVenda", fonteId: recibo.id } } })).recurso).toBe("vendas.fiscal");
    expect(await aplicarParametrosFiscais(entrada, previa.hashPlano, sessao, prisma)).toMatchObject({ aplicadoAnteriormente: true, produtos: 0 });
    expect(await prisma.documentoFiscalSaida.count()).toBe(0); expect(await prisma.movimentacaoEstoque.count()).toBe(0); expect(await prisma.lancamentoFinanceiro.count()).toBe(0);
  });
  it("reverte o lote inteiro quando o NCM individual seria sobrescrito", async () => {
    const e = structuredClone(entrada); e.loteId = "lote-rejeitado";
    e.versoes = [];
    const p = await prisma.produtoVenda.findUniqueOrThrow({ where: { id: e.produtos[0].id } });
    e.produtos[0].versao = p.versao; e.produtos[0].fiscal.ncm = "04061090";
    e.grupos[0].versao = 2; e.grupos[0].fiscal.observacoes = "Não persistir esta alteração.";
    await expect(simularParametrosFiscais(e, sessao, prisma)).rejects.toThrow("Preserve o NCM");
    expect((await prisma.grupoFiscalVenda.findUniqueOrThrow({ where: { id: e.grupos[0].id } })).versao).toBe(2);
  });
  it("não concede autorização pela flag admin e detecta alteração concorrente no replay", async () => {
    await expect(simularParametrosFiscais(entrada, { ...sessao, userId: "inexistente" }, prisma)).rejects.toThrow("sessão");
    await prisma.produtoVenda.update({ where: { id: entrada.produtos[0].id }, data: { versao: { increment: 1 } } });
    await expect(simularParametrosFiscais(entrada, sessao, prisma)).rejects.toThrow("estado divergente");
  });
  it("preserva a projeção de Validades ao restaurar os eventos fiscais", async () => {
    const registro = { id: "baixa-sintetica", usuarioId: sessao.userId, usuarioNome: sessao.nome, createdAt: new Date().toISOString(), entidade: "TrabalhoEtiqueta", entidadeId: "trabalho-sintetico", acao: "ETIQUETA_BAIXADA" };
    await banco.query("SELECT grazing_projetar_atividade('EventoAuditoriaEtiqueta',$1::jsonb)", [JSON.stringify(registro)]);
    expect((await prisma.atividadeUsuario.findUniqueOrThrow({ where: { fonteTabela_fonteId: { fonteTabela: "EventoAuditoriaEtiqueta", fonteId: registro.id } } })).recurso).toBe("producao.validades");
  });
});
