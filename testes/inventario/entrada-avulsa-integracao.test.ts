import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PrismaClient } from "@/generated/prisma/client";

const simulacao = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return simulacao.prisma; } }));
vi.mock("@/lib/session", () => ({ getSession: async () => ({ userId: "usuario-entrada", nome: "Usuário de teste" }) }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("server-only", () => ({}));

import { registrarEntradaAvulsaAction, type EntradaAvulsaInput } from "@/app/(protegido)/inventario/entrada-avulsa/actions";
import { excluirEntradaAvulsa, corrigirEntradaAvulsa, consultarEntrada } from "@/lib/estoque/entrada-avulsa-servidor";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { consultarExtratoIndividual } from "@/lib/estoque/extrato-individual";
import { listarEntradas } from "@/lib/estoque/consultar-entradas";
import { prepararCancelamentoCompra } from "@/lib/financeiro/cancelamento-compra";
import type { SessaoAtual } from "@/lib/session";
import type { CorrecaoEntradaInput } from "@/lib/inventario/entrada-avulsa-historico";
const sessao: SessaoAtual = { userId: "usuario-entrada", nome: "Usuário de teste", email: "entrada@example.invalid", admin: true, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "Teste" };

const esquema = "teste_entrada_avulsa_" + randomUUID().replaceAll("-", "");
let conexao: Client | undefined;
let esquemaCriado = false;

describe.skipIf(process.env.ENTRADA_AVULSA_BANCO_TESTE !== "1")("compra sem nota no PostgreSQL isolado", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada.");
    const endereco = new URL(process.env.DATABASE_URL);
    if (!["localhost", "127.0.0.1"].includes(endereco.hostname)) {
      throw new Error("Este teste só pode executar no PostgreSQL local.");
    }

    conexao = new Client({ connectionString: endereco.toString() });
    await conexao.connect();
    await conexao.query(`CREATE SCHEMA "${esquema}"`);
    esquemaCriado = true;
    await conexao.query(`SET search_path TO "${esquema}"`);

    const migracoes = (await readdir("prisma/migrations", { withFileTypes: true }))
      .filter(pasta => pasta.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const migracao of migracoes) {
      await conexao.query(prepararSqlMigrationFiscal(migracao.name, await readFile(`prisma/migrations/${migracao.name}/migration.sql`, "utf8")));
    }

    simulacao.prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: endereco.toString(),
        options: `-c search_path=${esquema}`,
      }, { schema: esquema }),
    });
    expect(await simulacao.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);

    const perfil = await simulacao.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    await simulacao.prisma.usuario.create({
      data: { id: "usuario-entrada", perfilAcessoId: perfil.id, nome: "Usuário de teste", email: "entrada@example.invalid", senhaHash: "sem-login" },
    });
    await simulacao.prisma.localEstoque.create({ data: { id: "local", nome: "Cozinha" } });
    await simulacao.prisma.fornecedor.create({
      data: { id: "fornecedor", nome: "FORNECEDOR TESTE", cnpj: "11111111000191" },
    });
    await simulacao.prisma.categoriaFinanceira.create({
      data: { id: "cmv", nome: "Compras de insumos", grupo: "CMV" },
    });
    await simulacao.prisma.contaBancaria.create({
      data: { id: "conta", nome: "Conta de teste", saldoInicial: 0 },
    });
    await simulacao.prisma.insumo.createMany({
      data: [
        { id: "queijo", nome: "Queijo", unidade: "KG", custoMedio: 0 },
        { id: "presunto", nome: "Presunto", unidade: "KG", custoMedio: 0 },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await simulacao.prisma?.$disconnect();
    if (!conexao) return;
    if (esquemaCriado) {
      if (!/^teste_entrada_avulsa_[a-f0-9]{32}$/.test(esquema)) throw new Error("Schema de teste inválido.");
      await conexao.query(`DROP SCHEMA "${esquema}" CASCADE`);
    }
    await conexao.end();
  });

  it("grava cabeçalho, estoque, custo médio e uma despesa baixada com o mesmo total", async () => {
    const resultado = await registrarEntradaAvulsaAction({
      chave: "teste-compra-multiplos-itens-001",
      tipo: "COMPRA_SIMPLES",
      itens: [
        { insumoId: "queijo", localId: "local", quantidade: 10, valorProdutos: 100 },
        { insumoId: "presunto", localId: "local", quantidade: 30, valorProdutos: 300 },
      ],
      fornecedorId: "fornecedor",
      frete: 40,
      desconto: 20,
      custosAdicionais: [{ descricao: "Descarga", valor: 25 }],
      data: "2026-09-11",
      dataVencimento: "2026-09-20",
      pago: true,
      dataPagamento: "2026-09-12",
      contaBancariaId: "conta",
      observacao: "Compra no balcão",
    });

    expect(resultado).toMatchObject({ ok: true });
    const compra = await simulacao.prisma.entradaAvulsaCompra.findFirstOrThrow({
      include: { movimentacoes: { orderBy: { insumoId: "asc" } }, lancamentoFinanceiro: true },
    });
    expect({
      fornecedorId: compra.fornecedorId,
      valorProdutos: Number(compra.valorProdutos),
      frete: Number(compra.frete),
      desconto: Number(compra.desconto),
      valorOutrosCustos: Number(compra.valorOutrosCustos),
      valorTotal: Number(compra.valorTotal),
      outrosCustos: compra.outrosCustos,
      pago: compra.pago,
    }).toEqual({
      fornecedorId: "fornecedor",
      valorProdutos: 400,
      frete: 40,
      desconto: 20,
      valorOutrosCustos: 25,
      valorTotal: 445,
      outrosCustos: [{ descricao: "Descarga", valor: 25 }],
      pago: true,
    });
    expect(compra.movimentacoes.map(movimento => ({
      entradaAvulsaCompraId: movimento.entradaAvulsaCompraId,
      valorTotal: Number(movimento.valorTotal),
      quantidade: Number(movimento.quantidade),
    })).sort((a, b) => a.valorTotal - b.valorTotal)).toEqual([
      { entradaAvulsaCompraId: compra.id, valorTotal: 111.25, quantidade: 10 },
      { entradaAvulsaCompraId: compra.id, valorTotal: 333.75, quantidade: 30 },
    ]);
    expect((await simulacao.prisma.saldoEstoque.findMany({ orderBy: { insumoId: "asc" } }))
      .map(saldo => ({ insumoId: saldo.insumoId, quantidade: Number(saldo.quantidadeAtual) }))).toEqual([
        { insumoId: "presunto", quantidade: 30 },
        { insumoId: "queijo", quantidade: 10 },
      ]);
    expect((await simulacao.prisma.insumo.findMany({ orderBy: { id: "asc" } }))
      .map(insumo => Number(insumo.custoMedio))).toEqual([11.125, 11.125]);

    expect(compra.lancamentoFinanceiro).toMatchObject({
      tipo: "DESPESA",
      descricao: "COMPRA SEM NOTA — FORNECEDOR TESTE",
      status: "BAIXADO",
      fornecedorId: "fornecedor",
      contaBancariaId: "conta",
      origemEntradaAvulsaCompraId: compra.id,
    });
    expect(Number(compra.lancamentoFinanceiro?.valor)).toBe(445);
    const movimentoBancario = await simulacao.prisma.movimentacaoBancaria.findFirstOrThrow();
    expect({
      tipo: movimentoBancario.tipo,
      valor: Number(movimentoBancario.valor),
      lancamentoId: movimentoBancario.lancamentoId,
    }).toEqual({
      tipo: "SAIDA",
      valor: 445,
      lancamentoId: compra.lancamentoFinanceiro?.id,
    });
    const atividadesEstoque = await simulacao.prisma.atividadeUsuario.findMany({
      where: { fonteTabela: "MovimentacaoEstoque", fonteId: { in: compra.movimentacoes.map(movimento => movimento.id) } },
    });
    expect(atividadesEstoque).toHaveLength(2);
    expect(atividadesEstoque).toEqual(expect.arrayContaining(compra.movimentacoes.map(movimento => expect.objectContaining({
      autorId: "usuario-entrada", autorNome: "Usuário de teste", atorTipo: "USUARIO", origem: "INTERFACE",
      acao: "ENTRADA_COMPRA", fonteId: movimento.id, antes: null, depois: null, correlacaoId: compra.id,
    }))));
    expect(await simulacao.prisma.atividadeUsuario.findMany({
      where: { entidade: "LancamentoFinanceiro", entidadeId: compra.lancamentoFinanceiro!.id, acao: "BAIXA" },
    })).toEqual([expect.objectContaining({ autorId: "usuario-entrada", resultado: "SUCESSO" })]);
  });

  async function entradaIsolada(quantidade = 10, valor = 0, custoMedio = 0) {
    const insumoId = randomUUID();
    await simulacao.prisma.insumo.create({ data: { id: insumoId, nome: "Produto fictício", unidade: "KG", custoMedio } });
    const input: EntradaAvulsaInput = { chave: randomUUID(), tipo: "OUTRO_MOTIVO", itens: [{ insumoId, localId: "local", quantidade, valorProdutos: valor }], fornecedorId: null,
      frete: 0, desconto: 0, custosAdicionais: [], data: "2026-10-10", dataVencimento: null, pago: false, dataPagamento: null, contaBancariaId: null, observacao: "Entrada fictícia isolada" };
    const r = await registrarEntradaAvulsaAction(input);
    if ("erro" in r) throw new Error(r.erro);
    return { insumoId, input, id: r.registroId };
  }
  async function correcao(id: string, itens?: CorrecaoEntradaInput["itens"]) {
    const d = await simulacao.prisma.$transaction(tx => consultarEntrada(tx, id));
    if (!d) throw new Error("Entrada de teste ausente.");
    return { id: d.id, versao: d.versao, chave: randomUUID(), itens: itens ?? d.snapshot.itens, observacao: "Correção fictícia", frete: d.snapshot.frete, desconto: d.snapshot.desconto, custosAdicionais: d.snapshot.custosAdicionais };
  }
  async function saldo(insumoId: string) { return (await simulacao.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId, localId: "local" } } })).quantidadeAtual.toString(); }

  it("repete a inclusão sem duplicar operação, movimento ou saldo e rejeita chave com outros dados", async () => {
    const e = await entradaIsolada();
    const r = await registrarEntradaAvulsaAction(e.input);
    expect(r).toMatchObject({ ok: true, registroId: e.id }); expect(await saldo(e.insumoId)).toBe("10");
    const v = await simulacao.prisma.entradaAvulsaVersao.findFirstOrThrow({ where: { registroId: e.id, versao: 1 } });
    expect(r).toHaveProperty("movimentacaoId", (v.ajustes as { movimentoId: string }[])[0].movimentoId);
    expect(await simulacao.prisma.movimentacaoEstoque.count({ where: { insumoId: e.insumoId } })).toBe(1);
    expect(await registrarEntradaAvulsaAction({ ...e.input, observacao: "Outros dados" })).toMatchObject({ erro: expect.stringContaining("já foi usada") });
  });
  it("reduz entrada parcialmente consumida por delta, conserva consumo e custo consumido", async () => {
    const e = await entradaIsolada(10, 120);
    const saida = await registrarMovimentacao({ insumoId: e.insumoId, localId: "local", tipo: "SAIDA_CONSUMO", quantidade: 6, criadoPorId: sessao.userId });
    const comando = await correcao(e.id, [{ ...e.input.itens[0], quantidade: 8 }]);
    await corrigirEntradaAvulsa(comando, sessao);
    expect(await saldo(e.insumoId)).toBe("2");
    expect((await simulacao.prisma.insumo.findUniqueOrThrow({ where: { id: e.insumoId } })).custoMedio.toString()).toBe("24");
    expect((await simulacao.prisma.movimentacaoEstoque.findUniqueOrThrow({ where: { id: saida.movimentacaoId } })).quantidade.toString()).toBe("6");
    const d = await simulacao.prisma.$transaction(tx => consultarEntrada(tx, e.id));
    expect(d?.versao).toBe(2); expect(d?.versoes[0].diferencas).toEqual(expect.arrayContaining([expect.objectContaining({ anterior: "10", novo: "8" })]));
    await corrigirEntradaAvulsa(comando, sessao); expect(await saldo(e.insumoId)).toBe("2");
    expect(await simulacao.prisma.movimentacaoEstoque.count({ where: { insumoId: e.insumoId } })).toBe(3);
  });
  it("bloqueia redução além do saldo livre com rollback integral", async () => {
    const e = await entradaIsolada();
    await registrarMovimentacao({ insumoId: e.insumoId, localId: "local", tipo: "SAIDA_CONSUMO", quantidade: 8, criadoPorId: sessao.userId });
    await expect(corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 1 }]), sessao)).rejects.toThrow("Saldo disponível insuficiente");
    expect(await saldo(e.insumoId)).toBe("2"); expect((await simulacao.prisma.entradaAvulsaRegistro.findUniqueOrThrow({ where: { id: e.id } })).versao).toBe(1);
  });
  it("preserva movimentos posteriores e permite aumentar quantidade mesmo após consumo", async () => {
    const e = await entradaIsolada();
    await registrarMovimentacao({ insumoId: e.insumoId, localId: "local", tipo: "SAIDA_CONSUMO", quantidade: 9, criadoPorId: sessao.userId });
    await registrarMovimentacao({ insumoId: e.insumoId, localId: "local", tipo: "AJUSTE_ENTRADA", quantidade: 3, criadoPorId: sessao.userId });
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 12 }]), sessao);
    expect(await saldo(e.insumoId)).toBe("6");
    const movimentos = await simulacao.prisma.movimentacaoEstoque.findMany({ where: { insumoId: e.insumoId } });
    expect(movimentos).toHaveLength(4); expect(movimentos.map(m => m.quantidade.toString()).sort()).toEqual(["10", "2", "3", "9"]);
  });
  it("adiciona, remove e troca produtos, locais, unidades comerciais e conversões", async () => {
    const e = await entradaIsolada(); const outro = await entradaIsolada(1);
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 2, fatorConversao: 5, unidadeEntrada: "caixa" }, { ...outro.input.itens[0], quantidade: 4 }]), sessao);
    expect(await saldo(e.insumoId)).toBe("10"); expect(await saldo(outro.insumoId)).toBe("5");
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...outro.input.itens[0], quantidade: 7 }]), sessao);
    expect(await saldo(e.insumoId)).toBe("0"); expect(await saldo(outro.insumoId)).toBe("8");
    const d = await simulacao.prisma.$transaction(tx => consultarEntrada(tx, e.id)); expect(d?.snapshot.itens).toHaveLength(1);
    expect(d?.versoes).toHaveLength(3);
  });
  it("resolve duas correções simultâneas por versão sem perder saldo", async () => {
    const e = await entradaIsolada(); const a = await correcao(e.id, [{ ...e.input.itens[0], quantidade: 11 }]); const b = { ...a, chave: randomUUID(), itens: [{ ...e.input.itens[0], quantidade: 12 }] };
    const resultados = await Promise.allSettled([corrigirEntradaAvulsa(a, sessao), corrigirEntradaAvulsa(b, sessao)]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
    expect(["11", "12"]).toContain(await saldo(e.insumoId)); expect(await simulacao.prisma.entradaAvulsaVersao.count({ where: { registroId: e.id } })).toBe(2);
  });
  it("revalida sessão na transação e protege versões contra alterações destrutivas", async () => {
    const e = await entradaIsolada(); const comando = await correcao(e.id);
    await expect(corrigirEntradaAvulsa(comando, { ...sessao, versao: 999 })).rejects.toThrow("sessão expirou");
    const v = await simulacao.prisma.entradaAvulsaVersao.findFirstOrThrow({ where: { registroId: e.id } });
    await expect(simulacao.prisma.entradaAvulsaVersao.delete({ where: { id: v.id } })).rejects.toThrow("imutáveis");
    await expect(simulacao.prisma.entradaAvulsaVersao.update({ where: { id: v.id }, data: { autorNome: "Outra pessoa" } })).rejects.toThrow("imutáveis");
  });
  it("consulta operação por produto/identificador/responsável/período e pagina extrato antes dos filtros", async () => {
    const e = await entradaIsolada();
    for (let n = 0; n < 26; n++) await registrarMovimentacao({ insumoId: e.insumoId, localId: "local", tipo: "AJUSTE_ENTRADA", quantidade: 1, criadoPorId: sessao.userId, data: new Date(`2026-10-11T${String(n % 24).padStart(2, "0")}:00:00-03:00`) });
    await simulacao.prisma.entradaAvulsaRegistro.update({ where: { id: e.id }, data: { createdAt: new Date("2026-10-10T15:00:00Z") } });
    const lista = await listarEntradas({ busca: e.id, insumoId: e.insumoId, responsavel: sessao.nome, de: "2026-10-10", ate: "2026-10-10" }); expect(lista.total).toBe(1); expect(lista.linhas[0].totalItens).toBe(1);
    const extrato = await consultarExtratoIndividual({ insumoId: e.insumoId, de: "2026-10-10", ate: "2026-10-10", tipo: "AJUSTE_ENTRADA", ordem: "asc", pagina: 1 });
    expect(extrato.total).toBe(1); expect(extrato.linhas[0]).toMatchObject({ quantidade: "10", saldoAnterior: "0", saldoPosterior: "10", origem: "Entrada avulsa", href: `/inventario/entradas/${e.id}` });
    const segunda = await consultarExtratoIndividual({ insumoId: e.insumoId, de: "", ate: "", tipo: "", ordem: "desc", pagina: 2 }); expect(segunda.total).toBe(27); expect(segunda.linhas).toHaveLength(2);
  });
  it("recusa alteração do total financeiro sem tocar na despesa", async () => {
    const compra = await simulacao.prisma.entradaAvulsaCompra.findFirstOrThrow({ include: { registro: true, lancamentoFinanceiro: true } });
    const comando = await correcao(compra.registro!.id); comando.itens = comando.itens.map((i, n) => n === 0 ? { ...i, valorProdutos: i.valorProdutos + 1 } : i);
    await expect(corrigirEntradaAvulsa(comando, sessao)).rejects.toThrow("total deve permanecer");
    expect((await simulacao.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: compra.lancamentoFinanceiro!.id } })).valor.toString()).toBe("445");
  });
  it("protege reservas de pedidos sem ativar a integração automática", async () => {
    const e = await entradaIsolada();
    const politicaAntes = await simulacao.prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } });
    const p = await simulacao.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "teste", criadoPorId: sessao.userId, status: "CONFIRMADO" } });
    const item = await simulacao.prisma.itemPedidoVenda.create({ data: { pedidoId: p.id, versaoPedido: 1, ordem: 0, quantidade: 1, unidadeSnapshot: "UN", produtoSnapshot: {}, escolhasSnapshot: {}, estadoComposicao: "TESTE", precoOriginal: 0, precoAplicado: 0, acrescimos: 0, totalLinha: 0 } });
    await simulacao.prisma.reservaPedido.create({ data: { itemId: item.id, insumoId: e.insumoId, localId: "local", loteExecucao: randomUUID(), quantidadeItem: 1, quantidade: 8, reservada: 8, snapshot: {} } });
    await expect(corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 7 }]), sessao)).rejects.toThrow("Saldo disponível insuficiente");
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 9 }]), sessao);
    expect(await saldo(e.insumoId)).toBe("9");
    expect(await simulacao.prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { pedidosLiberacao: true } })).toEqual(politicaAntes);
  });
  it("corrige ajuste sem valor estimado conservando a base de custo existente", async () => {
    const e = await entradaIsolada(10, 0, 12);
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 8 }]), sessao);
    expect(await saldo(e.insumoId)).toBe("8");
    expect((await simulacao.prisma.insumo.findUniqueOrThrow({ where: { id: e.insumoId } })).custoMedio.toString()).toBe("12");
  });
  it("permite aumentar uma entrada sem custo apurado para cobrir déficit posterior", async () => {
    const e = await entradaIsolada(10, 0, 12);
    await registrarMovimentacao({ insumoId: e.insumoId, localId: "local", tipo: "SAIDA_CONSUMO", quantidade: 12, criadoPorId: sessao.userId });
    expect(await saldo(e.insumoId)).toBe("-2");
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 15 }]), sessao);
    expect(await saldo(e.insumoId)).toBe("3");
    expect((await simulacao.prisma.insumo.findUniqueOrThrow({ where: { id: e.insumoId } })).custoMedio.toString()).toBe("12");
  });
  it("remove um item inteiro sem bloquear por arredondamento de custo médio", async () => {
    const e = await entradaIsolada(3, 100); const outro = await entradaIsolada(1);
    expect((await simulacao.prisma.insumo.findUniqueOrThrow({ where: { id: e.insumoId } })).custoMedio.toString()).toBe("33.3333");
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...outro.input.itens[0], quantidade: 2, valorProdutos: 100 }]), sessao);
    expect(await saldo(e.insumoId)).toBe("0"); expect(await saldo(outro.insumoId)).toBe("3");
  });
  it("mantém uma fração pequena ao corrigir quantidade grande sem arredondar o delta", async () => {
    const e = await entradaIsolada(999999999);
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 0.000001, fatorConversao: 0.001 }]), sessao);
    expect(await saldo(e.insumoId)).toBe("1e-9");
    const ajuste = await simulacao.prisma.movimentacaoEstoque.findFirstOrThrow({ where: { entradaAvulsaRegistroId: e.id, tipo: "AJUSTE_SAIDA" } });
    expect(ajuste.quantidade.toFixed()).toBe("999999998.999999999");
    await corrigirEntradaAvulsa(await correcao(e.id), sessao);
    expect(await saldo(e.insumoId)).toBe("1e-9");
  });
  it("explica e bloqueia custo fora da precisão sem aplicar movimentos parciais", async () => {
    const e = await entradaIsolada(1, 1);
    await expect(corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 0.000001, fatorConversao: 0.001 }]), sessao)).rejects.toThrow("limite do cadastro");
    expect(await saldo(e.insumoId)).toBe("1");
    expect(await simulacao.prisma.movimentacaoEstoque.count({ where: { insumoId: e.insumoId } })).toBe(1);
  });
  it("adota uma compra antiga na primeira correção e conserva campos originais", async () => {
    const e = await entradaIsolada(1);
    const compra = await simulacao.prisma.entradaAvulsaCompra.create({ data: { fornecedorId: "fornecedor", dataEntrada: new Date("2026-09-01T12:00:00-03:00"), valorProdutos: 90, frete: 10, valorTotal: 100, outrosCustos: [], criadoPorId: sessao.userId } });
    const movimento = await registrarMovimentacao({ insumoId: e.insumoId, localId: "local", tipo: "ENTRADA_COMPRA", quantidade: 10, custoUnitario: 10, valorTotal: 100, entradaAvulsaCompraId: compra.id, criadoPorId: sessao.userId });
    const legadoId = `compra:${compra.id}`;
    const antes = await simulacao.prisma.$transaction(tx => consultarEntrada(tx, legadoId));
    expect(antes?.snapshot.reconstruida).toBe(true); expect(antes?.snapshot.dadosOriginais?.frete).toBe("10");
    const comando = await correcao(legadoId, [{ ...antes!.snapshot.itens[0], quantidade: 9 }]);
    const novoId = await corrigirEntradaAvulsa(comando, sessao);
    const depois = await simulacao.prisma.$transaction(tx => consultarEntrada(tx, legadoId)); expect(depois?.id).toBe(novoId); expect(depois?.versao).toBe(2); expect(depois?.identificador).toBe(antes?.identificador);
    expect((await simulacao.prisma.movimentacaoEstoque.findUniqueOrThrow({ where: { id: movimento.movimentacaoId } })).quantidade.toString()).toBe("10");
    expect(await saldo(e.insumoId)).toBe("10");
    await expect(simulacao.prisma.$transaction(tx => prepararCancelamentoCompra(tx, { tipo: "AVULSA", id: compra.id }, sessao))).rejects.toThrow("correções de estoque");
  });
  const comandoExclusao = (id: string, versao = 1) => ({ id, versao, chave: randomUUID(), motivo: "Entrada duplicada identificada na conferência." });
  it("exclui por compensação atual, preserva versões e não duplica o estorno", async () => {
    const e = await entradaIsolada();
    const input = comandoExclusao(e.id);
    await Promise.all([excluirEntradaAvulsa(input, sessao), excluirEntradaAvulsa(input, sessao)]);
    expect(await saldo(e.insumoId)).toBe("0");
    const movimentos = await simulacao.prisma.movimentacaoEstoque.findMany({ where: { insumoId: e.insumoId }, orderBy: { createdAt: "asc" } });
    expect(movimentos).toHaveLength(2); expect(movimentos[0].tipo).toBe("AJUSTE_ENTRADA"); expect(movimentos[0].quantidade.toString()).toBe("10");
    expect(movimentos[1].tipo).toBe("AJUSTE_SAIDA"); expect(movimentos[1].createdAt.getTime()).toBeGreaterThan(movimentos[0].createdAt.getTime());
    const d = await simulacao.prisma.$transaction(tx => consultarEntrada(tx, e.id));
    expect(d?.bloqueio).toMatch(/excluída/); expect(d?.versoes).toHaveLength(2);
    expect(d?.versoes[0].diferencas).toContainEqual({ campo: "Status", anterior: "Registrada", novo: "Excluída por estorno" });
    const lista = await listarEntradas({ busca: d!.identificador });
    expect(lista.linhas.find(r => r.id === e.id)).toMatchObject({ situacao: "Excluída", totalItens: 1 });
    await expect(corrigirEntradaAvulsa(await correcao(e.id, e.input.itens), sessao)).rejects.toThrow(/excluída/);
  });
  it("bloqueia exclusão com consumo e saldo insuficiente sem alterar histórico", async () => {
    const e = await entradaIsolada();
    await simulacao.prisma.$transaction(tx => registrarMovimentacao({ tx, insumoId: e.insumoId, localId: "local", tipo: "SAIDA_CONSUMO", quantidade: 2, criadoPorId: sessao.userId }));
    await expect(excluirEntradaAvulsa(comandoExclusao(e.id), sessao)).rejects.toThrow(/Saldo disponível insuficiente/);
    expect(await saldo(e.insumoId)).toBe("8");
    expect(await simulacao.prisma.entradaAvulsaVersao.count({ where: { registroId: e.id } })).toBe(1);
  });
  it("rejeita confirmação desatualizada e estorna a versão corrigida", async () => {
    const e = await entradaIsolada();
    await corrigirEntradaAvulsa(await correcao(e.id, [{ ...e.input.itens[0], quantidade: 7 }]), sessao);
    await expect(excluirEntradaAvulsa(comandoExclusao(e.id), sessao)).rejects.toThrow(/outra pessoa/);
    await excluirEntradaAvulsa(comandoExclusao(e.id, 2), sessao);
    expect(await saldo(e.insumoId)).toBe("0");
    expect(await simulacao.prisma.entradaAvulsaVersao.count({ where: { registroId: e.id } })).toBe(3);
  });
  async function compraIsolada(pago = false) {
    const e = await entradaIsolada();
    const r = await registrarEntradaAvulsaAction({ ...e.input, chave: randomUUID(), tipo: "COMPRA_SIMPLES", fornecedorId: "fornecedor", itens: [{ ...e.input.itens[0], valorProdutos: 100 }], dataVencimento: "2026-10-20", pago, contaBancariaId: pago ? "conta" : null, dataPagamento: pago ? "2026-10-10" : null });
    if ("erro" in r) throw new Error(r.erro);
    const registro = await simulacao.prisma.entradaAvulsaRegistro.findUniqueOrThrow({ where: { id: r.registroId } });
    return { id: r.registroId, compraId: registro.compraId!, insumoId: e.insumoId };
  }
  it("cancela título pendente e estorna quantidade corrigida na mesma transação", async () => {
    const e = await compraIsolada();
    const d = await correcao(e.id); d.itens[0].quantidade = 8;
    await corrigirEntradaAvulsa(d, sessao);
    const antes = await saldo(e.insumoId);
    await excluirEntradaAvulsa(comandoExclusao(e.id, 2), sessao);
    expect(Number(antes) - Number(await saldo(e.insumoId))).toBe(8);
    expect(await simulacao.prisma.lancamentoFinanceiro.findFirst({ where: { origemEntradaAvulsaCompraId: e.compraId } })).toMatchObject({ status: "CANCELADO" });
    expect(await simulacao.prisma.cancelamentoCompra.count({ where: { chaveOrigem: "AVULSA:" + e.compraId } })).toBe(1);
  });
  it("preserva pagamento e estoque quando a compra já foi paga", async () => {
    const e = await compraIsolada(true); const antes = await saldo(e.insumoId);
    await expect(excluirEntradaAvulsa(comandoExclusao(e.id), sessao)).rejects.toThrow(/pagamento ou vínculo/);
    expect(await saldo(e.insumoId)).toBe(antes);
    expect(await simulacao.prisma.lancamentoFinanceiro.findFirst({ where: { origemEntradaAvulsaCompraId: e.compraId } })).toMatchObject({ status: "BAIXADO" });
    expect(await simulacao.prisma.cancelamentoCompra.count({ where: { chaveOrigem: "AVULSA:" + e.compraId } })).toBe(0);
  });
  it("mantém números e ordem por registro mesmo após filtrar e corrigir", async () => {
    const e = await entradaIsolada();
    const r = await simulacao.prisma.entradaAvulsaRegistro.findUniqueOrThrow({ where: { id: e.id } });
    const lista = await listarEntradas({});
    expect(lista.linhas.every(l => /^[0-9]+$/.test(l.identificador))).toBe(true);
    expect(lista.linhas.map(l => l.criadoEm)).toEqual(lista.linhas.map(l => l.criadoEm).sort().reverse());
    expect((await listarEntradas({ busca: String(r.numero) })).linhas.find(l => l.id === e.id)?.identificador).toBe(String(r.numero));
    await corrigirEntradaAvulsa(await correcao(e.id), sessao);
    expect((await simulacao.prisma.$transaction(tx => consultarEntrada(tx, e.id)))?.identificador).toBe(String(r.numero));
  });

  it("reverte o cancelamento financeiro se o estoque não permite excluir", async () => {
    const e = await compraIsolada();
    await simulacao.prisma.$transaction(tx => registrarMovimentacao({ tx, insumoId: e.insumoId, localId: "local", tipo: "SAIDA_CONSUMO", quantidade: 15, criadoPorId: sessao.userId }));
    await expect(excluirEntradaAvulsa(comandoExclusao(e.id), sessao)).rejects.toThrow(/Saldo disponível insuficiente/);
    expect(await saldo(e.insumoId)).toBe("5");
    expect(await simulacao.prisma.lancamentoFinanceiro.findFirst({ where: { origemEntradaAvulsaCompraId: e.compraId } })).toMatchObject({ status: "PENDENTE" });
    expect(await simulacao.prisma.cancelamentoCompra.count({ where: { chaveOrigem: "AVULSA:" + e.compraId } })).toBe(0);
    expect(await simulacao.prisma.entradaAvulsaVersao.count({ where: { registroId: e.id } })).toBe(1);
  });

  it("preserva número e endereço do ajuste manual após adotar o legado", async () => {
    const e = await entradaIsolada();
    const m = await registrarMovimentacao({ insumoId: e.insumoId, localId: "local", tipo: "AJUSTE_ENTRADA", quantidade: 5, criadoPorId: sessao.userId, observacao: "Inclusão manual fictícia conferida" });
    const id = "movimento:" + m.movimentacaoId;
    const antes = await simulacao.prisma.$transaction(tx => consultarEntrada(tx, id));
    expect(antes?.identificador).toMatch(/^[0-9]+$/);
    const novoId = await corrigirEntradaAvulsa(await correcao(id, [{ ...antes!.snapshot.itens[0], quantidade: 3 }]), sessao);
    const depois = await simulacao.prisma.$transaction(tx => consultarEntrada(tx, id));
    expect(depois?.id).toBe(novoId); expect(depois?.identificador).toBe(antes?.identificador);
    expect(await saldo(e.insumoId)).toBe("13");
  });

  it("busca qualquer conteúdo por termos combinados sem acentos antes de paginar", async () => {
    const e = await compraIsolada();
    const r = await simulacao.prisma.entradaAvulsaRegistro.findUniqueOrThrow({ where: { id: e.id } });
    const termos = ["FORNECEDOR TESTE", "Produto ficticio", "Usuario de teste", "Cozinha", "Entrada ficticia isolada", "100,00", "fornecedor produto usuario"];
    for (const busca of termos) {
      const lista = await listarEntradas({ busca, pagina: "1" });
      expect(lista.linhas.some(l => l.id === e.id), busca).toBe(true);
    }
    expect((await listarEntradas({ busca: `${r.numero} termo inexistente` })).total).toBe(0);
  });

});
