import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";
import { conferirReferenciaInterna, resolverReferenciaInterna } from "@/lib/tributacao/referencia-interna";

const schema = `teste_referencia_interna_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, prisma: PrismaClient | undefined, criado = false, insumoId: string;
function c(alteracoes: Partial<ClassificacaoFiscal> = {}): ClassificacaoFiscal {
  return { produtoId: null, referenciaInternaInsumoId: insumoId, grupo: "GF02", natureza: "PREPARADO", tratamento: "NORMAL", ncm: "19059090", origem: "0", cest: null, unidade: "UN", estado: "CONFIRMADO", gtin: "SEM GTIN", evidencias: ["Fixture fictícia: produto final assado sem GTIN"], pendencias: [], ncmAplicabilidade: "APLICAVEL", analiseNcm: { fundamento: "DOCUMENTAL", confianca: "MEDIA", descricaoNcm: "Produto acabado sintético", dataAnalise: "2026-10-12", justificativa: "Preparo exclusivamente fictício para teste; não é documentação comercial real.", fontes: ["Ficha técnica fictícia"], pendenciasNcm: [] }, conversaoUnidade: { unidadeEstoque: "KG", quantidadeEstoquePorUnidadeFiscal: "0.022", justificativa: "Quantidade22g/un declarada exclusivamente na fixture fictícia.", fontes: ["Conversão sintética de teste"] }, ...alteracoes };
}

describe.skipIf(process.env.ESTRUTURA_FISCAL_BANCO_TESTE !== "1")("Referência interna — transação PostgreSQL local e dados fictícios", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/teste_estrutura_fiscal") throw new Error("Somente PostgreSQL local teste_estrutura_fiscal é permitido.");
    banco = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 }); await banco.connect();
    if (!["127.0.0.1", "::1"].includes((await banco.query("SELECT host(inet_server_addr()) AS host")).rows[0].host)) throw new Error("Servidor de fixture precisa ser local.");
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
  }, 120000);
  beforeEach(async () => {
    insumoId = (await prisma!.insumo.create({ data: { nome: `Preparação exclusivamente fictícia ${randomUUID()}`, tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: "1", rendimentoUnidade: "KG", modoPreparo: ["Assar conforme fixture fictícia"], observacoes: "Registro sintético que deve permanecer intacto", custoMedio: "12.3456" } })).id;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
    if (!banco) return;
    if (criado && /^teste_referencia_interna_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`);
    await banco.end();
  });

  it("confere identidade real na transação sem criar ProdutoVenda ou alterar estoque/preparação", async () => {
    const antes = await prisma!.insumo.findUniqueOrThrow({ where: { id: insumoId } });
    const comerciais = await prisma!.produtoVenda.count(), movimentos = await prisma!.movimentacaoEstoque.count(), reservas = await prisma!.reservaPedido.count();
    await prisma!.$transaction(async tx => {
      await conferirReferenciaInterna(tx, c());
      const atual = await tx.insumo.findUniqueOrThrow({ where: { id: insumoId } });
      expect(resolverReferenciaInterna(c(), atual, { referenciaInternaInsumoId: insumoId, descricao: "Produto final assado fictício", unidade: "UN", quantidade: "8", pesoRateio: "1" })).toEqual({ codigo: `INSUMO:${insumoId}`, nome: "Produto final assado fictício", unidade: "UN" });
    });
    expect(await prisma!.insumo.findUniqueOrThrow({ where: { id: insumoId } })).toEqual(antes);
    expect(await prisma!.produtoVenda.count()).toBe(comerciais); expect(await prisma!.movimentacaoEstoque.count()).toBe(movimentos); expect(await prisma!.reservaPedido.count()).toBe(reservas);
  });
  it("recusa ID inexistente no banco isolado", async () => {
    await expect(prisma!.$transaction(tx => conferirReferenciaInterna(tx, c({ referenciaInternaInsumoId: "insumo_ficticio_inexistente" })))).rejects.toThrow(/não existe/);
  });
  it("recusa cadastro inativado depois da elaboração da classificação", async () => {
    await prisma!.insumo.update({ where: { id: insumoId }, data: { ativo: false } });
    await expect(prisma!.$transaction(tx => conferirReferenciaInterna(tx, c()))).rejects.toThrow(/inativo ou excluído/);
  });
  it("recusa exclusão lógica mesmo se a flag ativo divergir", async () => {
    await prisma!.insumo.update({ where: { id: insumoId }, data: { excluidoEm: new Date("2026-10-11T00:00:00Z"), ativo: true } });
    await expect(prisma!.$transaction(tx => conferirReferenciaInterna(tx, c()))).rejects.toThrow(/inativo ou excluído/);
  });
  it("recusa conversão anterior quando a unidade cadastral muda", async () => {
    await prisma!.insumo.update({ where: { id: insumoId }, data: { unidade: "L" } });
    await expect(prisma!.$transaction(tx => conferirReferenciaInterna(tx, c()))).rejects.toThrow(/diverge do cadastro/);
  });
  it("permite estudo pendente e mantém a ausência de NCM confirmado", async () => {
    const rascunho = c({ estado: "PENDENTE", ncm: null, analiseNcm: undefined, pendencias: ["Característica exclusivamente sintética ausente"] });
    await expect(prisma!.$transaction(tx => conferirReferenciaInterna(tx, rascunho))).resolves.toBeUndefined();
    expect(rascunho.ncm).toBeNull(); expect(rascunho.estado).toBe("PENDENTE");
  });
});
