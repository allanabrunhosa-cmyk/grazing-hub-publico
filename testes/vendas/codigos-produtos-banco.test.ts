import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { prepararDependenciaAtendimento } from "./dependencia-atendimento";
import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
import { organizarCodigosProdutos } from "@/lib/vendas/codigos-produtos";
import { salvarProduto } from "@/lib/vendas/persistencia";

const esquema = `teste_codigos_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined;
let criado = false;
let admin: SessaoAtual;
let leitor: SessaoAtual;
let cestaId: string;
let outraCestaId: string;
let tabuaId: string;
let complementoId: string;
let semCategoriaId: string;
let categoriaId: string;
const consultas: string[] = [];
const codigoLegado = "6ce67b33-e3fe-40dd-9252-9cc14b32b9d0";

async function criarProduto(nome: string, codigo: string | null, categoria?: string, complemento = false) {
  return sim.prisma.produtoVenda.create({ data: {
    nome, codigo, preco: "139.00", unidade: "UN", classificacao: complemento ? "COMPLEMENTO" : "PRINCIPAL",
    classificacoes: [complemento ? "COMPLEMENTO" : "PRINCIPAL"],
    fiscal: { observacoes: "Configuração exclusivamente sintética preservada" },
    ...(categoria ? { categorias: { create: { categoriaId: categoria, ordem: 0 } } } : {}),
  } });
}

async function fotografiaProtegida() {
  return JSON.stringify({
    pedidos: await sim.prisma.pedidoVenda.findMany({ orderBy: { id: "asc" } }),
    itens: await sim.prisma.itemPedidoVenda.findMany({ orderBy: { id: "asc" } }),
    documentos: await sim.prisma.documentoFiscalSaida.findMany({ orderBy: { id: "asc" } }),
    eventos: await sim.prisma.eventoFiscalSaida.findMany({ orderBy: { id: "asc" } }),
    estoque: await sim.prisma.movimentacaoEstoque.count(),
    financeiro: await sim.prisma.lancamentoFinanceiro.count(),
    recebidas: await sim.prisma.notaFiscalRecebida.count(),
  });
}

function escritasProtegidas() {
  return consultas.filter(q => /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:"[^"]+"\.)?"(?:PedidoVenda|ItemPedidoVenda|DocumentoFiscalSaida|EventoFiscalSaida|MovimentacaoEstoque|LancamentoFinanceiro|NotaFiscalRecebida)"/i.test(q));
}

describe.skipIf(process.env.VENDAS_BANCO_TESTE !== "1")("Códigos dos produtos em PostgreSQL sintético", () => {
  beforeAll(async () => {
    const destino = new URL(process.env.DATABASE_URL!);
    if (process.env.NODE_ENV !== "test" || !["127.0.0.1", "localhost"].includes(destino.hostname) || !/^\/teste_[a-z0-9_]+$/.test(destino.pathname)) {
      throw Error("Exige PostgreSQL local e banco sintético teste_.");
    }
    banco = new Client({ connectionString: destino.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      const sql = await prepararDependenciaAtendimento(banco, pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8"));
      await banco.query(prepararSqlMigrationFiscal(pasta.name, sql));
    }
    const cliente = new PrismaClient({ adapter: new PrismaPg({ connectionString: destino.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }), log: [{ emit: "event", level: "query" }] });
    cliente.$on("query", e => consultas.push(e.query));
    sim.prisma = cliente;
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const pessoa = await sim.prisma.usuario.create({ data: { nome: "Administrador sintético dos códigos", email: "codigos-admin@example.invalid", senhaHash: "hash-inutil", perfilAcessoId: perfil.id } });
    const perfilLeitor = await sim.prisma.perfilAcesso.create({ data: { nome: "Leitor sintético dos códigos", permissoes: { "vendas.produtos": ["visualizar"] } } });
    const pessoaLeitora = await sim.prisma.usuario.create({ data: { nome: "Leitor sintético dos códigos", email: "codigos-leitor@example.invalid", senhaHash: "hash-inutil", perfilAcessoId: perfilLeitor.id } });
    admin = { userId: pessoa.id, nome: pessoa.nome, email: pessoa.email, versao: pessoa.sessaoVersao, admin: true, permissoes: {}, excecoes: {}, perfilNome: perfil.nome };
    leitor = { ...admin, userId: pessoaLeitora.id, nome: pessoaLeitora.nome, email: pessoaLeitora.email, admin: false, perfilNome: perfilLeitor.nome };
    const categoria = await sim.prisma.categoriaVenda.create({ data: { nome: "Cestas sintéticas", escopo: "PRODUTO", ordem: 0 } }); categoriaId = categoria.id;
    const tabuas = await sim.prisma.categoriaVenda.create({ data: { nome: "Tábuas sintéticas", escopo: "PRODUTO", ordem: 1 } });
    const complementos = await sim.prisma.categoriaVenda.create({ data: { nome: "Pães sintéticos", escopo: "COMPLEMENTO", ordem: 0 } });
    cestaId = (await criarProduto("Cesta sintética A", codigoLegado, categoria.id)).id;
    outraCestaId = (await criarProduto("Cesta sintética B", null, categoria.id)).id;
    tabuaId = (await criarProduto("Tábua sintética", "CODIGOANTIGOENORME", tabuas.id)).id;
    complementoId = (await criarProduto("Complemento sintético", null, complementos.id, true)).id;
    semCategoriaId = (await criarProduto("Produto sintético sem categoria", null)).id;
    const pedido = await sim.prisma.pedidoVenda.create({ data: {
      chaveCriacao: randomUUID(), hashCriacao: "hash-comercial-sintetico", criadoPorId: pessoa.id,
      status: "CONFIRMADO", total: "165", subtotal: "139", frete: "26", modoFinanceiro: "EXTERNO",
      compradorSnapshot: { nome: "Comprador sintético" }, pagamentoInformadoSnapshot: { tipo: "PIX", origem: "SINTETICA" },
      itens: { create: { produtoId: cestaId, versaoPedido: 1, ordem: 0, quantidade: "1", unidadeSnapshot: "UN",
        produtoSnapshot: { id: cestaId, nome: "Nome histórico sintético", codigo: codigoLegado }, escolhasSnapshot: [],
        estadoComposicao: "SEM_MOVIMENTO", precoOriginal: "139", precoAplicado: "139", acrescimos: "0", totalLinha: "139" } },
    } });
    const payload = { schema: "fotografia-sintetica-imutavel", itens: [{ produtoId: cestaId, codigo: codigoLegado }], total: "165.00" };
    await sim.prisma.documentoFiscalSaida.create({ data: { pedidoId: pedido.id, versaoPedido: 1, payload,
      hashPayload: createHash("sha256").update(JSON.stringify(payload)).digest("hex"), criadoPorId: pessoa.id,
      criadoPorNome: pessoa.nome, status: "AUTORIZADO", modeloDocumento: 55, ambiente: "PRODUCAO", numero: "1", serie: "6",
      eventos: { create: { chave: `autorizado-sintetico:${randomUUID()}`, tipo: "AUTORIZADO_SINTETICO", dados: { somenteTeste: true } } } } });
    consultas.length = 0;
  }, 90000);

  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (!banco) return;
    await banco.query("ROLLBACK");
    if (criado && /^teste_codigos_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  });

  it("revalida permissão e sessão sem confiar no indicador administrativo recebido", async () => {
    const antes = await sim.prisma.produtoVenda.findMany({ orderBy: { id: "asc" } });
    const historicos = await sim.prisma.historicoCadastroVenda.count();
    await expect(organizarCodigosProdutos({ ...leitor, admin: true })).rejects.toThrow(/acesso|permiss/i);
    await expect(organizarCodigosProdutos({ ...admin, versao: admin.versao! + 1 })).rejects.toThrow(/acesso|sessão|permiss/i);
    expect(await sim.prisma.produtoVenda.findMany({ orderBy: { id: "asc" } })).toEqual(antes);
    expect(await sim.prisma.historicoCadastroVenda.count()).toBe(historicos);
  });

  it("organiza hierarquia sem alterar o pedido, documentos autorizados, tributos, preços ou outros módulos", async () => {
    const protegido = await fotografiaProtegida();
    const produtosAntes = await sim.prisma.produtoVenda.findMany({ orderBy: { id: "asc" } });
    consultas.length = 0;
    const resultado = await organizarCodigosProdutos(admin);
    expect(resultado.atualizados).toBe(5);
    const produtos = await sim.prisma.produtoVenda.findMany({ orderBy: { id: "asc" } });
    const codigos = produtos.map(p => p.codigo!);
    expect(codigos.every(c => /^[PC]\d{7}$/.test(c))).toBe(true);
    expect(new Set(codigos).size).toBe(codigos.length);
    const codigo = (id: string) => produtos.find(p => p.id === id)!.codigo!;
    expect(codigo(cestaId).slice(0, 3)).toBe(codigo(outraCestaId).slice(0, 3));
    expect(codigo(cestaId).slice(0, 3)).not.toBe(codigo(tabuaId).slice(0, 3));
    expect(codigo(complementoId)).toMatch(/^C\d{7}$/);
    expect(codigo(semCategoriaId)).toMatch(/^P00\d{5}$/);
    for (const antes of produtosAntes) {
      const depois = produtos.find(p => p.id === antes.id)!;
      expect(depois).toMatchObject({ id: antes.id, nome: antes.nome, preco: antes.preco, fiscal: antes.fiscal, classificacao: antes.classificacao, versao: antes.versao + 1 });
    }
    expect(await fotografiaProtegida()).toBe(protegido);
    expect(escritasProtegidas()).toEqual([]);
  });

  it("reexecução é idempotente e concorrência não duplica código ou revisão", async () => {
    const atuais = await sim.prisma.produtoVenda.findMany({ orderBy: { id: "asc" } });
    const historicos = await sim.prisma.historicoCadastroVenda.count();
    expect((await organizarCodigosProdutos(admin)).atualizados).toBe(0);
    expect(await sim.prisma.produtoVenda.findMany({ orderBy: { id: "asc" } })).toEqual(atuais);
    expect(await sim.prisma.historicoCadastroVenda.count()).toBe(historicos);
    const novos = await Promise.all(["Concorrente sintético A", "Concorrente sintético B"].map(nome => criarProduto(nome, null, categoriaId)));
    const resultados = await Promise.all(Array.from({ length: 4 }, () => organizarCodigosProdutos(admin)));
    expect(resultados.reduce((soma, r) => soma + r.atualizados, 0)).toBe(2);
    const salvos = await sim.prisma.produtoVenda.findMany({ where: { id: { in: novos.map(n => n.id) } } });
    expect(salvos.every(p => /^[PC]\d{7}$/.test(p.codigo!) && p.versao === 2)).toBe(true);
    expect(new Set(salvos.map(p => p.codigo)).size).toBe(2);
    expect(escritasProtegidas()).toEqual([]);
  });

  it("preserva código curto existente e a família após renomear ou reordenar categoria", async () => {
    const legado = await criarProduto("Código curto sintético preservado", "CURTO1", categoriaId);
    const referencia = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: cestaId } });
    await sim.prisma.categoriaVenda.update({ where: { id: categoriaId }, data: { nome: "Categoria sintética renomeada", ordem: 99, versao: { increment: 1 } } });
    const novo = await criarProduto("Produto sintético após renomear", null, categoriaId);
    expect((await organizarCodigosProdutos(admin)).atualizados).toBe(1);
    expect(await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: legado.id } })).toEqual(legado);
    const salvo = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: novo.id } });
    expect(salvo.codigo!.slice(0, 3)).toBe(referencia.codigo!.slice(0, 3));
  });

  it("não reutiliza o último código após excluir um produto sem histórico comercial", async () => {
    const anterior = await sim.prisma.produtoVenda.findFirstOrThrow({ where: { nome: "Produto sintético após renomear" } });
    await sim.prisma.produtoCategoriaVenda.deleteMany({ where: { produtoId: anterior.id } });
    await sim.prisma.produtoVenda.delete({ where: { id: anterior.id } });
    const novo = await criarProduto("Produto sintético após exclusão", null, categoriaId);
    expect((await organizarCodigosProdutos(admin)).atualizados).toBe(1);
    const salvo = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: novo.id } });
    expect(salvo.codigo!.slice(0, 3)).toBe(anterior.codigo!.slice(0, 3));
    expect(Number(salvo.codigo!.slice(3))).toBeGreaterThan(Number(anterior.codigo!.slice(3)));
    expect(escritasProtegidas()).toEqual([]);
  });

  it("cadastro normal gera código automaticamente e a edição preserva o código com revisão", async () => {
    const entrada = { id: "", versao: 0, nome: "Produto normal sintético", especificacao: null, descricao: null,
      tipo: "PADRAO", classificacoes: ["PRINCIPAL"], codigo: null, unidade: "UN", fotoUrl: null,
      observacoes: null, modoPreparo: null, ativo: true, categorias: [categoriaId], grupos: [], preco: "139", componentes: [] };
    const autor = { userId: admin.userId, nome: admin.nome, versao: admin.versao };
    const id = await salvarProduto(entrada, autor);
    const criado = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id } });
    expect(criado.codigo).toMatch(/^P\d{7}$/);
    expect(criado.versao).toBe(1);
    await salvarProduto({ ...entrada, id, versao: criado.versao, codigo: criado.codigo, nome: "Produto normal sintético editado" }, autor);
    const depois = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id } });
    expect(depois).toMatchObject({ codigo: criado.codigo, nome: "Produto normal sintético editado", versao: criado.versao + 1 });
    expect(escritasProtegidas()).toEqual([]);
  });

  it("recusa código forjado na criação ou na edição sem alterar o cadastro", async () => {
    const entrada = { id: "", versao: 0, nome: "Produto forjado sintético", especificacao: null, descricao: null,
      tipo: "PADRAO", classificacoes: ["PRINCIPAL"], codigo: "FRAUDE1", unidade: "UN", fotoUrl: null,
      observacoes: null, modoPreparo: null, ativo: true, categorias: [categoriaId], grupos: [], preco: "139", componentes: [] };
    const autor = { userId: admin.userId, nome: admin.nome, versao: admin.versao };
    const antes = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: cestaId } });
    const historicos = await sim.prisma.historicoCadastroVenda.count();
    await expect(salvarProduto(entrada, autor)).rejects.toThrow(/gerado|código/i);
    await expect(salvarProduto({ ...entrada, id: cestaId, versao: antes.versao, codigo: "NOVO0001" }, autor)).rejects.toThrow(/gerado|código/i);
    expect(await sim.prisma.produtoVenda.count({ where: { nome: entrada.nome } })).toBe(0);
    expect(await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: cestaId } })).toEqual(antes);
    expect(await sim.prisma.historicoCadastroVenda.count()).toBe(historicos);
    expect(escritasProtegidas()).toEqual([]);
  });
});
