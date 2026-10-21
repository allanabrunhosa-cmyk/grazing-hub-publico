import { prepararDependenciaAtendimento } from "./dependencia-atendimento";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
import { salvarCategoria, salvarGrupo, salvarProduto } from "@/lib/vendas/persistencia";
import { consultarProdutos } from "@/lib/vendas/consultas";
import { resolverConfiguracao } from "@/lib/vendas/configuracao";
import { selecionarPorcao } from "@/lib/insumos/porcoes";
import type { ProdutoEntrada } from "@/lib/vendas/dominio";
const esquema = `teste_categorias_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined;
const autor = { userId: "autor-ficticio", nome: "Autor fictício" };
const base: ProdutoEntrada = { id: "", versao: 0, nome: "Produto sintético", tipo: "PADRAO", classificacoes: ["PRINCIPAL"], ativo: true, categorias: [], grupos: [], preco: "100", componentes: [], especificacao: null, descricao: null, codigo: null, unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: null };
describe.skipIf(process.env.VENDAS_BANCO_TESTE !== "1")("categorias e complementos em PostgreSQL sintético", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
      if (pasta.name === "20261021210000_categorias_complementos") {
        await banco.query(`INSERT INTO "CategoriaVenda" (id,nome,ordem,ativo) VALUES ('cat-antiga','Categoria sintética compartilhada',7,false);
          INSERT INTO "ProdutoVenda" (id,nome,"updatedAt",classificacao,classificacoes) VALUES
          ('antigo-produto','Produto antigo',now(),'PRINCIPAL',ARRAY['PRINCIPAL']),
          ('antigo-complemento','Complemento antigo',now(),'COMPLEMENTO',ARRAY['COMPLEMENTO']),
          ('antiga-opcao','Opção antiga',now(),'OPCAO',ARRAY['OPCAO']),
          ('antigo-multiplo','Produto com papel antigo',now(),'PRINCIPAL',ARRAY['PRINCIPAL','COMPLEMENTO']);
          INSERT INTO "ProdutoCategoriaVenda" ("produtoId","categoriaId",ordem) VALUES
          ('antigo-produto','cat-antiga',0),('antigo-complemento','cat-antiga',3),('antiga-opcao','cat-antiga',4),('antigo-multiplo','cat-antiga',5);`);
      }
      const sql = await prepararDependenciaAtendimento(banco, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8"));
      await banco.query(prepararSqlMigrationFiscal(pasta.name, sql));
    }
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
  }, 90000);
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (banco) { await banco.query("ROLLBACK"); if (/^teste_categorias_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA IF EXISTS "${esquema}" CASCADE`); await banco.end(); }
  });
  it("migra categorias por classificação e preserva nomes, ordem e produtos", async () => {
    const categorias = await sim.prisma.categoriaVenda.findMany({ where: { nome: "Categoria sintética compartilhada" }, orderBy: { escopo: "asc" } });
    expect(categorias.map(c => [c.escopo,c.ordem,c.ativo])).toEqual([["COMPLEMENTO",7,false],["PRODUTO",7,false]]);
    expect(categorias.map(c => c.versao)).toEqual([1,2]);
    await expect(salvarCategoria({ id: "cat-antiga", versao: 1, nome: "Nome antigo enviado por formulário", ativo: false, escopo: "PRODUTO" }, autor)).rejects.toThrow("outra tela");
    for (const id of ["antigo-complemento", "antiga-opcao"]) {
      const p = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id }, include: { categorias: true } });
      expect(p.versao).toBe(2); expect(p.categorias[0].categoriaId).toBe(categorias[0].id);
    }
    for (const id of ["antigo-produto", "antigo-multiplo"]) expect((await sim.prisma.produtoCategoriaVenda.findFirstOrThrow({ where: { produtoId: id } })).categoriaId).toBe("cat-antiga");
    expect((await sim.prisma.produtoCategoriaVenda.findFirstOrThrow({ where: { produtoId: "antigo-complemento" } })).ordem).toBe(3);
    const leitura = await consultarProdutos();
    expect(leitura.produtos.find(p => p.id === "antiga-opcao")?.classificacoes).toEqual(["COMPLEMENTO"]);
    expect(leitura.produtos.find(p => p.id === "antigo-multiplo")?.classificacoes).toEqual(["PRINCIPAL"]);
  });
  it("isola categorias opcionais por escopo, mantém cores e recusa conflito", async () => {
    const categoria = { id: "", versao: 0, nome: "Mesma categoria sintética", ativo: true };
    const site = await salvarCategoria({ ...categoria, escopo: "PRODUTO" }, autor);
    const complemento = await salvarCategoria({ ...categoria, escopo: "COMPLEMENTO", cor: "verde" }, autor);
    await expect(salvarProduto({ ...base, categorias: [complemento] }, autor)).rejects.toThrow("classificação");
    await expect(salvarProduto({ ...base, classificacoes: ["COMPLEMENTO"], categorias: [site] }, autor)).rejects.toThrow("classificação");
    const id = await salvarProduto({ ...base, classificacoes: ["COMPLEMENTO"], categorias: [complemento] }, autor);
    await salvarProduto({ ...base, classificacoes: ["COMPLEMENTO"], id, versao: 1, categorias: [] }, autor);
    expect(await sim.prisma.produtoCategoriaVenda.count({ where: { produtoId: id } })).toBe(0);
    await salvarCategoria({ ...categoria, id: complemento, versao: 1, cor: "amarelo", escopo: "COMPLEMENTO" }, autor);
    await expect(salvarCategoria({ ...categoria, id: complemento, versao: 1, cor: "vermelho" }, autor)).rejects.toThrow("outra tela");
    await expect(salvarCategoria({ ...categoria, id: complemento, versao: 2, escopo: "PRODUTO" }, autor)).rejects.toThrow("escopo");
    expect((await sim.prisma.categoriaVenda.findUniqueOrThrow({ where: { id: complemento } })).cor).toBe("amarelo");
  });
  it("herda uma porção e aplica meia porção somente no produto escolhido", async () => {
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Copa fictícia", unidade: "KG", custoMedio: "50" } });
    const porcao = selecionarPorcao({ id: "porcao-ficticia", insumoId: insumo.id, nome: "1 porção", quantidade: "0.1", unidade: "KG", versao: 1 });
    const copa = await salvarProduto({ ...base, nome: "Copa", classificacoes: ["COMPLEMENTO"], componentes: [{ insumoId: insumo.id, unidade: "KG", quantidade: "0.1", porcao }] }, autor);
    const produtoEscolha = await salvarProduto({ ...base, nome: "Produto também é escolha", componentes: [{ insumoId: insumo.id, unidade: "KG", quantidade: "0.2" }] }, autor);
    const gid = await salvarGrupo({ id: "", versao: 0, nome: "Grupo sintético compartilhado", tipo: "COMPOSICAO", ativo: true, minimo: 0, maximo: 2, repetir: true, opcoes: [copa, produtoEscolha].map((produtoId,i) => ({ id: "", nome: `Escolha ${i}`, produtoId, preco: "0", quantidade: "1", ativo: true, usarPrecoPadrao: true })) }, autor);
    const opcao = await sim.prisma.opcaoComplementoVenda.findFirstOrThrow({ where: { grupoId: gid, produtoId: copa } });
    const grupos = [{ grupoId: gid, usarPadrao: false, minimo: 0, maximo: 2 }];
    const a = await salvarProduto({ ...base, tipo: "PERSONALIZADO", nome: "Grazing inteira", grupos }, autor);
    const b = await salvarProduto({ ...base, tipo: "PERSONALIZADO", nome: "Grazing meia", grupos: [{ ...grupos[0], ajustesOpcoes: [{ opcaoId: opcao.id, composicao: [{ insumoId: insumo.id, unidade: "KG", quantidade: "0.05", porcao: { ...porcao, numeroPorcoes: "0.5" } }] }] }] }, autor);
    const dados = await consultarProdutos();
    expect(resolverConfiguracao(dados.produtos.find(p => p.id === a)!, dados, { [opcao.id]: 1 }).componentes[0].quantidade).toBe("0.1");
    expect(resolverConfiguracao(dados.produtos.find(p => p.id === b)!, dados, { [opcao.id]: 1 }).componentes[0].quantidade).toBe("0.05");
    expect(resolverConfiguracao(dados.produtos.find(p => p.id === a)!, dados, { [opcao.id]: 1 })).toMatchObject({ custo: 5, pendencias: [] });
    expect(resolverConfiguracao(dados.produtos.find(p => p.id === b)!, dados, { [opcao.id]: 1 })).toMatchObject({ custo: 2.5, pendencias: [] });
    const escolhaProduto = dados.grupos.find(g => g.id === gid)!.opcoes.find(o => o.produtoId === produtoEscolha)!;
    expect(resolverConfiguracao(dados.produtos.find(p => p.id === a)!, dados, { [escolhaProduto.id]: 1 })).toMatchObject({ custo: 10, componentes: [{ quantidade: "0.2" }], pendencias: [] });
    expect(dados.produtos.find(p => p.id === produtoEscolha)?.classificacoes).toEqual(["PRINCIPAL"]);
    expect(dados.produtos.find(p => p.id === copa)?.componentes[0].porcao?.numeroPorcoes).toBe("1");
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: b, entidade: "PRODUTO" } })).toBe(1);
  });
});
