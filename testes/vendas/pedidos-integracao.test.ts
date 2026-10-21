import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, sessao: null as SessaoAtual | null }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
// Simula somente a fronteira HTTP; os serviços continuam revalidando o usuário real no schema.
vi.mock("@/lib/session", () => ({ getSession: async () => sim.sessao }));
vi.mock("server-only", () => ({}));
import { calcularPedido, editarInformacoesPedido, encerrarPedidoManual, cancelarPedido, confirmarPedido, criarRascunhoPedido as criarRascunhoBase, listarPedidos, registrarEntregaPedido, revisarPedido, salvarRascunhoPedido } from "@/lib/vendas/pedidos";
import { registrarProducaoPreparacao, corrigirProducaoPreparacao } from "@/lib/estoque/producao-preparacao";
import { salvarCustoEntrega, buscarDespesasEntrega, vincularDespesaEntrega, desvincularDespesaEntrega } from "@/lib/vendas/entregas-custos";
import { exigirDespesaSemCustoEntrega } from "@/lib/financeiro/custos-entrega";
import { baixarLancamento } from "@/lib/financeiro/baixarLancamento";
import { validarEntradaPedido } from "@/lib/vendas/pedidos-dominio";
import { coberturaComposicaoPedido } from "@/lib/vendas/pedidos-composicao";
import { consultarProdutos } from "@/lib/vendas/consultas";
import { excluirCadastroVenda, salvarCliente } from "@/lib/vendas/persistencia";
import { executarOperacaoPedido, executarOperacaoInterfacePedido, mudarStatusGestorPedido, obterPedido, consultarMovimentacaoEstoqueGestorPedidos, salvarMovimentacaoEstoqueGestorPedidos } from "@/lib/vendas/pedidos";
import type { CoberturaPedido } from "@/lib/vendas/pedidos-composicao";

import { vincularDocumentoExternoPedido } from "@/lib/vendas/pedidos-documento-externo";
import { consultarProntidaoProdutos } from "@/lib/vendas/pedidos-prontidao";
import { executarFisicoPedido } from "@/lib/vendas/pedidos-fisico";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";

const criarRascunhoPedido = (v: unknown, c: unknown, a: SessaoAtual) => criarRascunhoBase(v, c, a, "HUB");
import { consultarHorariosPedidos, salvarHorariosPedidos } from "@/lib/vendas/pedidos-horarios";
import { horariosVazios, janelasDoDia } from "@/lib/vendas/pedidos-horarios-dominio";
import { horariosEntregaVazios } from "@/lib/vendas/horarios-entrega-dominio";
import { consultarGestorPedidos } from "@/lib/vendas/pedidos-gestor";
import { diaNoFuso, somarDias } from "@/lib/vendas/pedidos-agenda-dominio";
const esquema = `teste_pedidos_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined;
let criado = false;
let sessao: SessaoAtual;
let bloqueado: SessaoAtual;
let formaComercialId: string;
let clienteId: string, canalId: string, produtoId: string, zeroId: string, grupoId: string, opcaoId: string, opcaoGratisId: string;
const chave = () => randomUUID();
const entrada = () => ({
  clienteId, canalId, atendimento: "ENTREGA", prazo: "AGENDADO", previsaoData: "2026-10-10", previsaoJanela: "manhã",
  destinatario: { nome: "Pessoa destinatária sintética", contato: "+55(11)90000-0000" },
  endereco: { cep: "00000000", logradouro: "Rua Sintética", numero: "1", complemento: "", bairro: "Centro", cidade: "São Paulo", uf: "SP" },
  pagamentoInformado: { formaId: formaComercialId, parcelas: 1, vencimentos: [] },
  observacoes: "Encomenda de teste", desconto: "10.00", frete: "15.00",
  itens: [{ produtoId, quantidade: "2", escolhas: {}, precoManual: null }],

});

describe.skipIf(process.env.PEDIDOS_BANCO_TESTE !== "1")("Pedidos M1 no PostgreSQL isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: url.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) {
      if (pasta.name === "20260926090000_pedidos_operacao_externa") {
        await banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt") VALUES ('legado-fixture','Legado fictício','legado@example.invalid','inutil',now())`);
        await banco.query(`INSERT INTO "PedidoVenda" (id,"chaveCriacao","hashCriacao","criadoPorId","updatedAt",total) VALUES ('legado-fixture','legado-fixture','hash-ficticio','legado-fixture',now(),123)`);
      }
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
      if (pasta.name === "20260926090000_pedidos_operacao_externa") {
        expect((await banco.query(`SELECT "modoFinanceiro", total::text FROM "PedidoVenda" WHERE id='legado-fixture'`)).rows).toEqual([{ modoFinanceiro: "HUB", total: "123.00" }]);
        await banco.query(`DELETE FROM "PedidoVenda" WHERE id='legado-fixture'`);
        await banco.query(`DELETE FROM "Usuario" WHERE id='legado-fixture'`);
      }
    }
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const admin = await sim.prisma.usuario.create({ data: { nome: "Operador sintético", email: "pedidos-admin@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const restrito = await sim.prisma.perfilAcesso.create({ data: { nome: "Leitura sintética", permissoes: { "vendas.pedidos": ["visualizar"] } } });
    const leitor = await sim.prisma.usuario.create({ data: { nome: "Leitor sintético", email: "pedidos-leitor@example.invalid", senhaHash: "inutil", perfilAcessoId: restrito.id } });
    const base = { email: "", admin: true, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "" } as SessaoAtual;
    sessao = { ...base, userId: admin.id, nome: admin.nome };
    sim.sessao = sessao;
    bloqueado = { ...base, admin: false, userId: leitor.id, nome: leitor.nome };
    formaComercialId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "PIX comercial fictício", tipo: "PIX" } })).id;
    // Contrato M1 sem regras de pagamento: limite padrão de R$ 50.000 retirado explicitamente.
    const cliente = await sim.prisma.clienteVenda.create({ data: { nome: "Comprador sintético", tipo: "PF", limiteCreditoAberto: null } }); clienteId = cliente.id;
    const canal = await sim.prisma.canalVenda.create({ data: { nome: "INTERNO" } }); canalId = canal.id;
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Caixa sintética", unidade: "UN", preco: "100.00" } }); produtoId = produto.id;
    const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: "Escolha obrigatória sintética", minimo: 1, maximo: 1, repetir: false, opcoes: { create: [{ nome: "Opção paga", preco: "30.00" }, { nome: "Opção gratuita", preco: "0.00" }] } }, include: { opcoes: true } }); grupoId = grupo.id; opcaoId = grupo.opcoes.find(o => o.nome === "Opção paga")!.id; opcaoGratisId = grupo.opcoes.find(o => o.nome === "Opção gratuita")!.id;
    const zero = await sim.prisma.produtoVenda.create({ data: { nome: "Caixa configurável sintética", unidade: "UN", grupos: { create: { grupoId, minimo: 1, maximo: 1, usarPadrao: true } }, preco: "0.00" } }); zeroId = zero.id;
  }, 90000);
  afterAll(async () => {
    await sim.prisma?.$disconnect(); if (!banco) return;
    if (criado && /^teste_pedidos_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  });

  it("salva orçamento sem pagamento, mas bloqueia confirmação sem efeitos financeiros ou mudança de versão", async () => {
    const d = { ...entrada(), atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, pagamentoInformado: null };
    const r = await criarRascunhoBase(d, chave(), sessao, "EXTERNO");
    const financeiros = await sim.prisma.lancamentoFinanceiro.count();
    await expect(confirmarPedido(r.id, r.versao, chave(), sessao)).rejects.toThrow(/informações de pagamento/);
    expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "RASCUNHO", versao: r.versao });
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(financeiros);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: r.id, tipo: "CONFIRMADO" } })).toBe(0);
    const salvo = await salvarRascunhoPedido(r.id, r.versao, { ...d, pagamentoInformado: entrada().pagamentoInformado }, chave(), sessao);
    expect((await confirmarPedido(r.id, salvo.versao, chave(), sessao)).status).toBe("CONFIRMADO");
    await expect(revisarPedido(r.id, salvo.versao + 1, d, chave(), sessao)).rejects.toThrow("cancele o pedido e crie um novo");
    await sim.prisma.pedidoVenda.update({ where: { id: r.id }, data: { status: "CANCELADO" } });
  });

  it("grava a aba de cobrança escolhida e conserva a lista após confirmar, sem alterar o cadastro", async () => {
    const enderecos = ["101", "202"].map(numero => ({ pais: "Brasil", cep: "01001000", logradouro: "Rua fictícia", numero, complemento: "Sala fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" }));
    const cadastro = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } });
    Object.assign(enderecos[0], { tipo: "PF", nomeCompleto: "Pessoa sintética compradora", documento: "12345678901" });
    Object.assign(enderecos[1], { tipo: "PJ", razaoSocial: "Terceira sintética Ltda", documento: "12345678000190", inscricaoEstadual: "ISENTO", inscricaoMunicipal: "123456" });
    const d = { ...entrada(), atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, enderecosCobranca: enderecos, cobrancaSelecionada: 1, cobranca: enderecos[0] };
    const r = await criarRascunhoBase(d, chave(), sessao, "EXTERNO");
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id } })).rascunho).toMatchObject({ cobranca: { numero: "202" }, cobrancaSelecionada: 1 });
    await confirmarPedido(r.id, r.versao, chave(), sessao);
    const pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id } });
    const principal = { ...enderecos[0], tipo: cadastro.tipo, nomeCompleto: cadastro.nome, documento: cadastro.documento ?? "", razaoSocial: "", inscricaoEstadual: "", inscricaoMunicipal: "" };
    expect(pedido.cobrancaSnapshot).toMatchObject({ numero: "202", tipo: "PJ", razaoSocial: "Terceira sintética Ltda", documento: "12345678000190", inscricaoMunicipal: "123456", enderecos: [principal, enderecos[1]], selecionado: 1 });
    expect((await obterPedido(r.id)).cobrancaSnapshot).toMatchObject({ documento: "12345678000190", selecionado: 1 });
    await editarInformacoesPedido(r.id, pedido.versao, { cobranca: { ...enderecos[1], tipo: undefined, numero: "303" }, motivo: "Corrigir só endereço por consumidor anterior" }, chave(), sessao);
    expect((await obterPedido(r.id)).cobrancaSnapshot).toMatchObject({ numero: "303", tipo: "PJ", documento: "12345678000190", inscricaoMunicipal: "123456", selecionado: 1 });
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } })).enderecos).toEqual(cadastro.enderecos);
    await sim.prisma.pedidoVenda.update({ where: { id: r.id }, data: { status: "CANCELADO" } });
  });

  it("salva, reabre e confirma pedido com preço, desconto e frete do servidor; não produz efeitos de outros marcos", async () => {
    const d = entrada();
    const rascunho = await criarRascunhoPedido(d, chave(), sessao);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: rascunho.id } })).rascunho).toMatchObject({ observacoes: d.observacoes });
    const salvo = await salvarRascunhoPedido(rascunho.id, 1, { ...d, observacoes: "Ajuste sintético" }, chave(), sessao);
    const confirmado = await confirmarPedido(rascunho.id, salvo.versao, chave(), sessao);
    expect(confirmado.status).toBe("CONFIRMADO");
    const pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: rascunho.id }, include: { itens: true, historico: true } });
    expect(pedido.subtotal.toString()).toBe("200"); expect(pedido.desconto.toString()).toBe("10"); expect(pedido.frete.toString()).toBe("15"); expect(pedido.total.toString()).toBe("205");
    expect(pedido.itens).toHaveLength(1); expect(pedido.itens[0].estadoComposicao).toBe("PENDENTE");
    expect(pedido.historico.map(h => h.tipo)).toEqual(expect.arrayContaining(["CRIADO", "RASCUNHO_EDITADO", "CONFIRMADO"]));
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    expect(await sim.prisma.notaFiscalRecebida.count()).toBe(0);
    expect((await listarPedidos()).carteira).toEqual({ quantidade: 1, valor: "205" });
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { nome: "Novo nome sintético" } });
    await sim.prisma.produtoVenda.update({ where: { id: produtoId }, data: { preco: "120.00" } });
    const historico = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: rascunho.id } });
    expect(historico.produtoSnapshot).toMatchObject({ nome: "Caixa sintética" }); expect(historico.precoOriginal.toString()).toBe("100");
    const produtoUsado = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId } });
    await expect(excluirCadastroVenda("PRODUTO", produtoId, produtoUsado.versao, { userId: sessao.userId, nome: sessao.nome })).rejects.toThrow("integra pedidos");
  });

  it("preserva cobrança, observação por produto, forma informada e outros custos no total comercial", async () => {
    const cobranca = { nome: "Cobrança", destinatario: "Comprador fictício", pais: "Brasil", cep: "01001000", logradouro: "Praça Fictícia", numero: "10", complemento: "Sala fictícia", bairro: "Centro", cidade: "São Paulo", uf: "SP" };
    const cliente = await sim.prisma.clienteVenda.create({ data: { nome: "Comprador fictício", primeiroNome: "Comprador", sobrenome: "fictício", enderecos: [cobranca], limiteCreditoAberto: null } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Caixa do novo formulário", unidade: "UN", preco: "100.00" } });
    const d = { ...entrada(), clienteId: cliente.id, cobranca: { ...cobranca, numero: "11" }, endereco: { ...cobranca, numero: "12" }, desconto: "0", frete: "15.00", outrosCustos: "5.00", formaPagamentoInformada: "PIX", itens: [{ produtoId: produto.id, quantidade: "1", observacoes: "Embalagem separada", escolhas: {}, precoManual: null }] };
    const r = await criarRascunhoPedido(d, chave(), sessao);
    await confirmarPedido(r.id, r.versao, chave(), sessao);
    const pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id }, include: { itens: true } });
    expect(pedido.total.toString()).toBe("120");
    expect(pedido.outrosCustos.toString()).toBe("5");
    expect(pedido.formaPagamentoInformada).toBe("PIX");
    expect(pedido.cobrancaSnapshot).toMatchObject({ nome: "Cobrança", pais: "Brasil", logradouro: "Praça Fictícia", numero: "11" });
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: cliente.id } })).enderecos).toMatchObject([cobranca]);
    expect(pedido.itens[0].observacoes).toBe("Embalagem separada");
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: r.id } })).toBe(0);
  });

  it("aceita base zero com opção obrigatória e rejeita escolha incompleta", async () => {
    const catalogo = await consultarProdutos();
    expect(catalogo.produtos.find(p => p.id === zeroId)?.preco).toBe("0");
    const incompleto = await criarRascunhoPedido({ ...entrada(), desconto: "0", frete: "0", itens: [{ produtoId: zeroId, quantidade: "1", escolhas: {}, precoManual: null }] }, chave(), sessao);
    await expect(confirmarPedido(incompleto.id, 1, chave(), sessao)).rejects.toThrow("escolha");
    const gratuito = await salvarRascunhoPedido(incompleto.id, 1, { ...entrada(), desconto: "0", frete: "0", itens: [{ produtoId: zeroId, quantidade: "1", escolhas: { [opcaoGratisId]: 1 }, precoManual: null }] }, chave(), sessao);
    await expect(confirmarPedido(incompleto.id, gratuito.versao, chave(), sessao)).rejects.toThrow("positivo");
    const completo = await salvarRascunhoPedido(incompleto.id, gratuito.versao, { ...entrada(), desconto: "0", frete: "0", itens: [{ produtoId: zeroId, quantidade: "1", escolhas: { [opcaoId]: 1 }, precoManual: null }] }, chave(), sessao);
    await confirmarPedido(incompleto.id, completo.versao, chave(), sessao);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: incompleto.id } })).total.toString()).toBe("30");
  });

  it("exige previsão para agendado, ignora total enviado e respeita quantidade comercial", async () => {
    const base = entrada();
    const semPrevisao = await criarRascunhoPedido({ ...base, previsaoData: null, previsaoJanela: null }, chave(), sessao);
    await expect(confirmarPedido(semPrevisao.id, 1, chave(), sessao)).rejects.toThrow("data e horário ou janela");
    const fracionado = await criarRascunhoPedido({ ...base, itens: [{ produtoId, quantidade: "1.5", escolhas: {}, precoManual: null }] }, chave(), sessao);
    await expect(confirmarPedido(fracionado.id, 1, chave(), sessao)).rejects.toThrow("quantidade inteira");
    const precoVigente = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId } });
    const valido = await criarRascunhoPedido({ ...base, subtotal: "0", total: "0", desconto: "5.00", frete: "2.00" }, chave(), sessao);
    await confirmarPedido(valido.id, 1, chave(), sessao);
    const pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: valido.id } });
    expect(pedido.subtotal.toString()).toBe(precoVigente.preco.mul(2).toString());
    expect(pedido.total.toString()).toBe(precoVigente.preco.mul(2).minus(3).toString());
  });

  it("bloqueia concessão de desconto e preço manual por capacidade no servidor", async () => {
    const perfil = await sim.prisma.perfilAcesso.create({ data: { nome: "Pedidos comuns sintético", permissoes: { "vendas.pedidos": ["visualizar", "adicionar"], "vendas.pedidos.confirmar": ["visualizar", "editar"] } } });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Atendimento sintético", email: "pedidos-comum@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const comum = { ...sessao, admin: false, userId: usuario.id, nome: usuario.nome };
    await expect(criarRascunhoPedido(entrada(), chave(), comum)).rejects.toThrow("acesso");
    const semDesconto = { ...entrada(), desconto: "0" };
    const criado = await criarRascunhoPedido(semDesconto, chave(), comum);
    await confirmarPedido(criado.id, 1, chave(), comum);
    await expect(criarRascunhoPedido({ ...semDesconto, itens: [{ produtoId, quantidade: "1", escolhas: {}, precoManual: "80" }] }, chave(), comum)).rejects.toThrow("acesso");
  });

  it("preserva revisões, recusa concorrência/reenvio divergente e impede cancelamento na etapa entregue", async () => {
    const criadoKey = chave(), d = entrada();
    const criadoPedido = await criarRascunhoPedido(d, criadoKey, sessao);
    expect((await criarRascunhoPedido(d, criadoKey, sessao)).id).toBe(criadoPedido.id);
    await expect(criarRascunhoPedido({ ...d, frete: "20" }, criadoKey, sessao)).rejects.toThrow("outros dados");
    const confirmarKey = chave();
    const confirmado = await confirmarPedido(criadoPedido.id, 1, confirmarKey, sessao);
    expect((await confirmarPedido(criadoPedido.id, 1, confirmarKey, sessao)).versao).toBe(confirmado.versao);
    await expect(confirmarPedido(criadoPedido.id, 1, confirmarKey, bloqueado)).rejects.toThrow("acesso");
    const pedidoAntes = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: criadoPedido.id } });
    const carteiraAntes = (await listarPedidos()).carteira.quantidade;
    const resultados = await Promise.allSettled([
      revisarPedido(criadoPedido.id, confirmado.versao, { ...d, previsaoData: "2026-10-12" }, chave(), sessao),
      revisarPedido(criadoPedido.id, confirmado.versao, { ...d, previsaoData: "2026-10-13" }, chave(), sessao),
    ]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const atual = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: criadoPedido.id } });
    expect(await sim.prisma.itemPedidoVenda.count({ where: { pedidoId: criadoPedido.id, vigente: true } })).toBe(1);
    expect(await sim.prisma.itemPedidoVenda.count({ where: { pedidoId: criadoPedido.id } })).toBe(1);
    expect((await listarPedidos()).carteira.quantidade).toBe(carteiraAntes);
    const revisao = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: criadoPedido.id, tipo: "REVISADO" } });
    expect(revisao.usuarioId).toBe(sessao.userId);
    expect(revisao.antes).toMatchObject({ previsaoData: pedidoAntes.previsaoData!.toISOString() });
    expect(revisao.depois).toMatchObject({ previsaoData: atual.previsaoData!.toISOString() });
    expect(atual.total).toEqual(pedidoAntes.total);
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    let op = await executarOperacaoPedido(criadoPedido.id, atual.versao, { tipo: "INICIAR" }, chave(), sessao);
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: criadoPedido.id, vigente: true } });
    op = await executarOperacaoPedido(op.id, op.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: item.quantidade.toString() }, chave(), sessao);
    op = await executarOperacaoPedido(op.id, op.versao, { tipo: "PRONTO" }, chave(), sessao);
    op = await executarOperacaoPedido(op.id, op.versao, { tipo: "EXPEDIR", itemId: item.id, quantidade: item.quantidade.toString() }, chave(), sessao);
    op = await executarOperacaoPedido(op.id, op.versao, { tipo: "SAIR" }, chave(), sessao);
    const entregue = await registrarEntregaPedido(criadoPedido.id, op.versao, chave(), sessao);
    const antesCancelamento = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: entregue.id } });
    const historicoAntes = await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: entregue.id } });
    await expect(cancelarPedido(criadoPedido.id, entregue.versao, "Teste", chave(), sessao)).rejects.toThrow("Pedido entregue não pode ser cancelado");
    expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: entregue.id } })).toEqual(antesCancelamento);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: entregue.id } })).toBe(historicoAntes);
  });

  it("cancela antes da entrega com motivo e sem apagar histórico; bloqueia acesso revogado", async () => {
    const d = entrada();
    await expect(criarRascunhoPedido(d, chave(), bloqueado)).rejects.toThrow("acesso");
    const rascunho = await criarRascunhoPedido(d, chave(), sessao);
    const confirmado = await confirmarPedido(rascunho.id, 1, chave(), sessao);
    const antes = (await listarPedidos()).carteira.quantidade;
    const cancelado = await cancelarPedido(rascunho.id, confirmado.versao, "Cliente desistiu (sintético)", chave(), sessao);
    expect(cancelado.status).toBe("CANCELADO");
    expect((await listarPedidos()).carteira.quantidade).toBe(antes - 1);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: rascunho.id, tipo: "CANCELADO" } })).toBe(1);
    expect(await sim.prisma.itemPedidoVenda.count({ where: { pedidoId: rascunho.id } })).toBe(1);
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });

  it("cancelamento valida nome/motivo, separa ator real do nome informado e protege o reenvio", async () => {
    const r = await criarRascunhoPedido(entrada(), chave(), sessao);
    const p = await confirmarPedido(r.id, r.versao, chave(), sessao);
    const antes = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id }, include: { itens: true, historico: true } });
    for (const nome of ["", "123", "N".repeat(121), "Pessoa\u0000oculta"]) {
      await expect(cancelarPedido(p.id, p.versao, "Cliente desistiu", chave(), sessao, {}, nome)).rejects.toThrow("nome do responsável");
    }
    for (const motivo of ["", "M".repeat(1001), "motivo\u0000oculto"]) {
      await expect(cancelarPedido(p.id, p.versao, motivo, chave(), sessao, {}, "Pessoa sintética")).rejects.toThrow("motivo");
    }
    await expect(cancelarPedido(p.id, p.versao, "Cliente desistiu", chave(), bloqueado, {}, "Administrador sintético")).rejects.toThrow("acesso");
    expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id }, include: { itens: true, historico: true } })).toEqual(antes);
    const operacao = chave();
    const resultado = await cancelarPedido(p.id, p.versao, "Cliente desistiu", operacao, { ...sessao, nome: "Nome enviado fora do cadastro" }, {}, "  Pessoa   responsável sintética ");
    expect(resultado.status).toBe("CANCELADO");
    const registro = await sim.prisma.historicoPedidoVenda.findUniqueOrThrow({ where: { chaveOperacao: operacao } });
    expect(registro).toMatchObject({ tipo: "CANCELADO", usuarioId: sessao.userId, usuarioNome: sessao.nome, motivo: "Cliente desistiu" });
    expect(registro.depois).toMatchObject({ responsavelInformado: "Pessoa responsável sintética", status: "CANCELADO", total: antes.total.toString(), compradorSnapshot: antes.compradorSnapshot, destinatarioSnapshot: antes.destinatarioSnapshot });
    expect(await cancelarPedido(p.id, p.versao, "Cliente desistiu", operacao, sessao, {}, "Pessoa responsável sintética")).toEqual(resultado);
    await expect(cancelarPedido(p.id, p.versao, "Cliente desistiu", operacao, sessao, {}, "Outra pessoa sintética")).rejects.toThrow("outros dados");
    await expect(cancelarPedido(p.id, p.versao, "Cliente desistiu", chave(), sessao, {}, "Pessoa responsável sintética")).rejects.toThrow("mudou");
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "CANCELADO" } })).toBe(1);
    expect(await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id } })).toEqual(antes.itens);
  });

  it("protege quantidades parciais, instruções, permissões, reagendamento e ocorrências após entrega", async () => {
    const d = entrada();
    const r = await criarRascunhoPedido(d, chave(), sessao);
    let p = await confirmarPedido(r.id, 1, chave(), sessao);
    await expect(registrarEntregaPedido(p.id, p.versao, chave(), sessao)).rejects.toThrow("etapa");
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), bloqueado)).rejects.toThrow("acesso");
    const key = chave(), versao = p.versao;
    p = await executarOperacaoPedido(p.id, versao, { tipo: "INICIAR" }, key, sessao);
    expect((await executarOperacaoPedido(p.id, versao, { tipo: "INICIAR" }, key, sessao)).versao).toBe(p.versao);
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
    const pares = await Promise.allSettled([1, 2].map(() => executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, chave(), sessao)));
    expect(pares.filter(r => r.status === "fulfilled")).toHaveLength(1);
    p = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    await expect(revisarPedido(p.id, p.versao, { ...d, observacoes: "Instrução alterada após início" }, chave(), sessao)).rejects.toThrow("cancele o pedido e crie um novo");
    expect(await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({ vigente: true });
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).observacoes).toBe(d.observacoes);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "REVISADO" } })).toBe(0);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_PREPARAR" } })).toBe(1);
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "PRONTO" }, chave(), sessao)).rejects.toThrow("quantidades");
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "2" }, chave(), sessao)).rejects.toThrow("restante");
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "REAGENDAR", data: "2026-10-12", janela: "tarde", motivo: "Solicitação sintética" }, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PRONTO" }, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "EXPEDIR", itemId: item.id, quantidade: "2" }, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "SAIR" }, chave(), sessao);
    p = await registrarEntregaPedido(p.id, p.versao, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "OCORRENCIA", motivo: "Divergência sintética após entrega" }, chave(), sessao);
    const ocorrencia = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: ocorrencia.id, motivo: "Comunicação registrada" }, chave(), sessao);
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: ocorrencia.id, motivo: "Repetida" }, chave(), sessao)).rejects.toThrow("resolvida");
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).statusOperacional).toBe("ENTREGUE");
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });

  it("gestor avança com guardas reais e retorna etapas sem reabrir financeiro/estoque da primeira entrega", async () => {
    const d = entrada(), r = await criarRascunhoPedido(d, chave(), sessao);
    let p: { id: string; numero: number; versao: number; status: string; statusOperacional?: string } = await confirmarPedido(r.id, 1, chave(), sessao);
    const perfil = await sim.prisma.perfilAcesso.create({ data: { nome: "Produção do gestor fictícia", permissoes: { "vendas.pedidos": ["visualizar"], "vendas.pedidos.producao": ["visualizar", "editar"] } } });
    const operador = await sim.prisma.usuario.create({ data: { nome: "Produção fictícia", email: "gestor-producao@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const producao = { ...bloqueado, userId: operador.id, nome: operador.nome };
    const antes = { estoque: await sim.prisma.movimentacaoEstoque.count(), financeiro: await sim.prisma.lancamentoFinanceiro.count(), banco: await sim.prisma.movimentacaoBancaria.count() };
    await expect(mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao)).rejects.toThrow("etapa anterior");
    await expect(mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), bloqueado)).rejects.toThrow("acesso");
    const iniciarChave = chave(), iniciarVersao = p.versao;
    p = await mudarStatusGestorPedido(p.id, iniciarVersao, "avancar", iniciarChave, producao);
    expect(p.statusOperacional).toBe("EM_PREPARO");
    expect((await mudarStatusGestorPedido(p.id, iniciarVersao, "avancar", iniciarChave, producao)).versao).toBe(p.versao);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_INICIAR" } })).toBe(1);
    await expect(mudarStatusGestorPedido(p.id, iniciarVersao, "voltar", iniciarChave, sessao)).rejects.toThrow("chave");
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "PRONTO" }, chave(), producao)).rejects.toThrow("quantidades");
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "2" }, chave(), sessao);
    p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), producao);
    expect(p.statusOperacional).toBe("PRONTO");
    await expect(mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), producao)).rejects.toThrow("acesso");
    await expect(mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), producao)).rejects.toThrow("acesso");
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "SAIR" }, chave(), sessao)).rejects.toThrow("quantidades");
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "EXPEDIR", itemId: item.id, quantidade: "2" }, chave(), sessao);
    const concorrentes = await Promise.allSettled([1, 2].map(() => mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao)));
    expect(concorrentes.filter(c => c.status === "fulfilled")).toHaveLength(1);
    p = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(p.statusOperacional).toBe("EM_ENTREGA");
    p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
    const primeiraEntrega = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(primeiraEntrega.entregueEm).not.toBeNull();
    const retornoChave = chave(), retornoVersao = p.versao;
    p = await mudarStatusGestorPedido(p.id, retornoVersao, "voltar", retornoChave, sessao);
    expect(p.statusOperacional).toBe("EM_ENTREGA");
    expect((await mudarStatusGestorPedido(p.id, retornoVersao, "voltar", retornoChave, sessao)).versao).toBe(p.versao);
    const retorno = await sim.prisma.historicoPedidoVenda.findUniqueOrThrow({ where: { chaveOperacao: retornoChave } });
    expect(retorno).toMatchObject({ tipo: "OPERACAO_VOLTAR", usuarioId: sessao.userId, versaoAnterior: retornoVersao, versaoNova: retornoVersao + 1 });
    expect(retorno.antes).toMatchObject({ statusOperacional: "ENTREGUE", entregueEm: primeiraEntrega.entregueEm!.toISOString() });
    expect(retorno.depois).toMatchObject({ statusOperacional: "EM_ENTREGA", entregueEm: primeiraEntrega.entregueEm!.toISOString() });
    await expect(mudarStatusGestorPedido(p.id, retornoVersao, "voltar", chave(), sessao)).rejects.toThrow("mudou");
    p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
    p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
    expect(p.statusOperacional).toBe("EM_PREPARO");
    await expect(mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao)).rejects.toThrow("etapa anterior");
    p = await editarInformacoesPedido(p.id, p.versao, { previsaoData: "2026-10-12", previsaoJanela: "tarde", motivo: "Agenda atualizada após a primeira entrega" }, chave(), sessao);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(primeiraEntrega.entregueEm);
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, chave(), sessao)).rejects.toThrow("encerrada");
    for (const estado of ["PRONTO", "EM_ENTREGA", "ENTREGUE"]) {
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      expect(p.statusOperacional).toBe(estado);
    }
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(primeiraEntrega.entregueEm);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_PREPARAR" } })).toBe(1);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_EXPEDIR" } })).toBe(1);
    expect({ estoque: await sim.prisma.movimentacaoEstoque.count(), financeiro: await sim.prisma.lancamentoFinanceiro.count(), banco: await sim.prisma.movimentacaoBancaria.count() }).toEqual(antes);
    await sim.prisma.perfilAcesso.update({ where: { id: perfil.id }, data: { permissoes: { "vendas.pedidos": ["visualizar"] } } });
    await expect(mudarStatusGestorPedido(p.id, iniciarVersao, "avancar", iniciarChave, producao)).rejects.toThrow("acesso");
    const dto = (await listarPedidos({ busca: String(p.numero), etapaGestor: "entregues" })).pedidos.find(x => x.id === p.id)!;
    expect(dto).toMatchObject({ versao: p.versao, operacional: "ENTREGUE", itensDetalhes: [{ preparado: "2", expedido: "2" }] });
  });

  it.each(["EM_ENTREGA", "PRONTO", "EM_PREPARO"])("cancela após voltar para %s, preservando primeira entrega, execução e autoria", async etapa => {
    const r = await criarRascunhoPedido(entrada(), chave(), sessao);
    let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
    for (let n = 0; n < 4; n++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
    const entregue = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    const itens = await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id }, orderBy: { id: "asc" } });
    const execucoes = await sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId: p.id, tipo: { in: ["OPERACAO_PREPARAR", "OPERACAO_EXPEDIR"] } }, orderBy: { id: "asc" } });
    expect(entregue.statusOperacional).toBe("ENTREGUE");
    expect(entregue.entregueEm).not.toBeNull();
    for (const estado of ["EM_ENTREGA", "PRONTO", "EM_PREPARO"]) {
      p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      if (estado === etapa) break;
    }
    const antes = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(antes.statusOperacional).toBe(etapa);
    const movimentos = { estoque: await sim.prisma.movimentacaoEstoque.count(), financeiro: await sim.prisma.lancamentoFinanceiro.count(), banco: await sim.prisma.movimentacaoBancaria.count() };
    await expect(cancelarPedido(p.id, p.versao, "Cancelamento sintético após retorno", chave(), bloqueado, {}, "Administrador informado")).rejects.toThrow("acesso");
    await expect(cancelarPedido(p.id, entregue.versao, "Cancelamento sintético após retorno", chave(), sessao)).rejects.toThrow("mudou");
    expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).toEqual(antes);
    const operacao = chave();
    const resultado = await cancelarPedido(p.id, p.versao, "Cancelamento sintético após retorno", operacao, { ...sessao, nome: "Autor enviado fora do cadastro" }, {}, "Pessoa responsável sintética");
    expect(await cancelarPedido(p.id, p.versao, "Cancelamento sintético após retorno", operacao, sessao, {}, "Pessoa responsável sintética")).toEqual(resultado);
    const cancelado = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(cancelado).toMatchObject({ status: "CANCELADO", statusOperacional: "INTERROMPIDO", versao: p.versao + 1, entregueEm: entregue.entregueEm, total: entregue.total, compradorSnapshot: entregue.compradorSnapshot });
    expect(cancelado.canceladoEm).not.toBeNull();
    expect(await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id }, orderBy: { id: "asc" } })).toEqual(itens);
    expect(await sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId: p.id, tipo: { in: ["OPERACAO_PREPARAR", "OPERACAO_EXPEDIR"] } }, orderBy: { id: "asc" } })).toEqual(execucoes);
    const auditoria = await sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId: p.id, tipo: "CANCELADO" } });
    expect(auditoria).toHaveLength(1);
    expect(auditoria[0]).toMatchObject({ usuarioId: sessao.userId, usuarioNome: sessao.nome, versaoAnterior: p.versao, versaoNova: p.versao + 1 });
    expect(auditoria[0].antes).toMatchObject({ statusOperacional: etapa, entregueEm: entregue.entregueEm!.toISOString() });
    expect(auditoria[0].depois).toMatchObject({ status: "CANCELADO", entregueEm: entregue.entregueEm!.toISOString(), responsavelInformado: "Pessoa responsável sintética" });
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } })).toBe(1);
    expect({ estoque: await sim.prisma.movimentacaoEstoque.count(), financeiro: await sim.prisma.lancamentoFinanceiro.count(), banco: await sim.prisma.movimentacaoBancaria.count() }).toEqual(movimentos);
  });

  it("rejeita cancelamento na etapa entregue mesmo sem data histórica e serializa nova entrega contra cancelamento", async () => {
    const r = await criarRascunhoPedido(entrada(), chave(), sessao);
    let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
    // Estado legado incompleto: a etapa atual, independentemente do timestamp, é a autoridade.
    await sim.prisma.pedidoVenda.update({ where: { id: p.id }, data: { statusOperacional: "ENTREGUE" } });
    const incompleto = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    await expect(cancelarPedido(p.id, p.versao, "Tentativa sintética em etapa entregue", chave(), sessao)).rejects.toThrow("Pedido entregue não pode ser cancelado");
    expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).toEqual(incompleto);
    await sim.prisma.pedidoVenda.update({ where: { id: p.id }, data: { statusOperacional: "PENDENTE" } });
    for (let n = 0; n < 4; n++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
    const primeiraEntrega = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm;
    p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
    const resultados = await Promise.allSettled([
      mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao),
      cancelarPedido(p.id, p.versao, "Cancelamento concorrente sintético", chave(), sessao),
    ]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.filter(r => r.status === "rejected")).toHaveLength(1);
    const atual = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(atual.versao).toBe(p.versao + 1);
    expect(atual.entregueEm).toEqual(primeiraEntrega);
    if (resultados[0].status === "fulfilled") {
      expect(atual).toMatchObject({ status: "CONFIRMADO", statusOperacional: "ENTREGUE", canceladoEm: null });
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "CANCELADO" } })).toBe(0);
    } else {
      expect(atual).toMatchObject({ status: "CANCELADO", statusOperacional: "INTERROMPIDO" });
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "CANCELADO" } })).toBe(1);
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_ENTREGAR" } })).toBe(1);
    }
  });

  it("gestor confirma somente os restantes, audita uma revisão e preserva retorno/idempotência", async () => {
    const fracionado = await sim.prisma.produtoVenda.create({ data: { nome: "Produto fracionado integral fictício", unidade: "KG", preco: "100" } });
    const r = await criarRascunhoPedido({ ...entrada(), itens: [{ produtoId: fracionado.id, quantidade: "0.375", escolhas: {}, precoManual: null }, { produtoId, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao);
    let p = await confirmarPedido(r.id, 1, chave(), sessao);
    p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
    const itens = await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id, vigente: true }, orderBy: { ordem: "asc" } });
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: itens[0].id, quantidade: "0.125" }, chave(), sessao);
    const perfil = await sim.prisma.perfilAcesso.create({ data: { nome: "Confirmação integral produção fictícia", permissoes: { "vendas.pedidos": ["visualizar"], "vendas.pedidos.producao": ["visualizar", "editar"] } } });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Produção integral fictícia", email: "producao-integral@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const producao = { ...bloqueado, userId: usuario.id, nome: usuario.nome };
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "PRONTO" }, chave(), producao)).rejects.toThrow("quantidades");
    const v = p.versao, k = chave();
    const antes = { estoque: await sim.prisma.movimentacaoEstoque.count(), financeiro: await sim.prisma.lancamentoFinanceiro.count(), banco: await sim.prisma.movimentacaoBancaria.count() };
    p = await mudarStatusGestorPedido(p.id, v, "avancar", k, producao);
    expect(p.versao).toBe(v + 1);
    const apontados = await sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId: p.id, tipo: "OPERACAO_PREPARAR", versaoAnterior: v } });
    expect(apontados).toHaveLength(2);
    for (const evento of apontados) {
      expect(evento).toMatchObject({ usuarioId: usuario.id, versaoAnterior: v, versaoNova: v + 1 });
      expect(evento.chaveOperacao).toMatch(/^[a-f0-9]{64}$/);
      expect(evento.depois).toMatchObject({ chavePai: k, origem: "GESTOR_CONFIRMACAO_INTEGRAL" });
    }
    expect(apontados.map(e => e.depois)).toEqual(expect.arrayContaining([
      expect.objectContaining({ comando: { tipo: "PREPARAR", itemId: itens[0].id, quantidade: "0.25" } }),
      expect.objectContaining({ comando: { tipo: "PREPARAR", itemId: itens[1].id, quantidade: "2" } }),
    ]));
    expect((await sim.prisma.historicoPedidoVenda.findUniqueOrThrow({ where: { chaveOperacao: k } })).depois).toMatchObject({ comando: { tipo: "PRONTO" }, solicitacao: { tipo: "AVANCAR", confirmarIntegralmente: true } });
    const contagem = await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id } });
    expect((await mudarStatusGestorPedido(p.id, v, "avancar", k, producao)).versao).toBe(p.versao);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id } })).toBe(contagem);
    await expect(executarOperacaoPedido(p.id, v, { tipo: "AVANCAR" }, k, sessao)).rejects.toThrow("chave");
    await expect(mudarStatusGestorPedido(p.id, v, "avancar", chave(), sessao)).rejects.toThrow("mudou");
    await expect(mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), producao)).rejects.toThrow("acesso");
    await sim.prisma.perfilAcesso.update({ where: { id: perfil.id }, data: { permissoes: { "vendas.pedidos": ["visualizar"] } } });
    await expect(mudarStatusGestorPedido(p.id, v, "avancar", k, producao)).rejects.toThrow("acesso");
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "EXPEDIR", itemId: itens[0].id, quantidade: "0.1" }, chave(), sessao);
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "SAIR" }, chave(), sessao)).rejects.toThrow("quantidades");
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "OCORRENCIA", motivo: "Entrega sintética pendente" }, chave(), sessao);
    const versaoBloqueada = p.versao;
    await expect(mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao)).rejects.toThrow("ocorrências");
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).versao).toBe(versaoBloqueada);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_EXPEDIR" } })).toBe(1);
    const ocorrencia = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: ocorrencia.id, motivo: "Pendência fictícia resolvida" }, chave(), sessao);
    const disputas = await Promise.allSettled([1, 2].map(() => mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao)));
    expect(disputas.filter(d => d.status === "fulfilled")).toHaveLength(1);
    p = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(p).toMatchObject({ statusOperacional: "EM_ENTREGA" });
    expect((await listarPedidos({ busca: String(p.numero) })).pedidos.find(d => d.id === p.id)?.itensDetalhes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: itens[0].id, preparado: "0.375", expedido: "0.375" }),
      expect.objectContaining({ id: itens[1].id, preparado: "2", expedido: "2" }),
    ]));
    p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
    const primeiraEntrega = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm;
    for (let i = 0; i < 3; i++) p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
    for (let i = 0; i < 3; i++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(primeiraEntrega);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_PREPARAR" } })).toBe(3);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_EXPEDIR" } })).toBe(3);
    expect({ estoque: await sim.prisma.movimentacaoEstoque.count(), financeiro: await sim.prisma.lancamentoFinanceiro.count(), banco: await sim.prisma.movimentacaoBancaria.count() }).toEqual(antes);
  });

  it("calendário pagina a data efetiva por pedido e conserva somente os realmente sem dia", async () => {
    const prefixo = "coorte-gestor-ficticia-";
    const criar = async (prazo: string | null, data: string | null, fuso: string, instante: string, confirmar: boolean) => {
      const d = { ...entrada(), prazo, previsaoData: data, previsaoJanela: data ? "manhã" : null, referenciaOrigem: "GESTOR_TESTE", referenciaEstabelecimento: "FICTICIO", referenciaPedido: `${prefixo}${chave()}` };
      let p = await criarRascunhoPedido(d, chave(), sessao);
      if (confirmar) p = await confirmarPedido(p.id, p.versao, chave(), sessao);
      await sim.prisma.pedidoVenda.update({ where: { id: p.id }, data: { fusoHorario: fuso, createdAt: new Date(instante), confirmadoEm: confirmar ? new Date(instante) : null } });
      return p.id;
    };
    const imediatoManaus = await criar("IMEDIATO", null, "America/Manaus", "2026-10-02T02:00:00Z", true);
    const imediatoUtc = await criar("IMEDIATO", null, "UTC", "2026-10-02T02:00:00Z", true);
    const imediatoFora = await criar("IMEDIATO", null, "America/Manaus", "2026-10-05T12:00:00Z", true);
    const agendado = await criar("AGENDADO", "2026-10-01", "UTC", "2026-09-30T12:00:00Z", true);
    const rascunhoAgendado = await criar("AGENDADO", "2026-10-01", "UTC", "2026-09-30T12:00:00Z", false);
    const rascunhoFora = await criar("AGENDADO", "2026-10-06", "UTC", "2026-09-30T12:00:00Z", false);
    const semDia = await criar(null, null, "UTC", "2026-09-30T12:00:00Z", false);
    const filtro = { busca: prefixo, baseData: "entrega", de: "2026-10-01", ate: "2026-10-01" };
    const calendario = await listarPedidos({ ...filtro, incluirSemData: true, pagina: 100 });
    expect(calendario.quantidadeTotal).toBe(4);
    expect(calendario.pagina).toBe(1);
    expect(calendario.pedidos.map(p => p.id).sort()).toEqual([imediatoManaus, agendado, rascunhoAgendado, semDia].sort());
    expect(calendario.pedidos.find(p => p.id === imediatoManaus)).toMatchObject({ previsaoData: null, dataGestor: "2026-10-01", fusoHorario: "America/Manaus" });
    expect(calendario.pedidos.find(p => p.id === rascunhoAgendado)).toMatchObject({ dataGestor: "2026-10-01", itens: 1, atendimento: "ENTREGA", enderecoSnapshot: { logradouro: "Rua Sintética" } });
    expect(calendario.pedidos.find(p => p.id === semDia)?.dataGestor).toBeNull();
    expect(calendario.pedidos.some(p => [imediatoUtc, imediatoFora, rascunhoFora].includes(p.id))).toBe(false);
    expect((await listarPedidos(filtro)).quantidadeTotal).toBe(3);
  });

  it("gestor conserva as informações do novo formulário no rascunho e na venda fotografada", async () => {
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Produto da projeção sintética do gestor", unidade: "UN", preco: "100" } });
    const base = { ...entrada(), itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] };
    const dados = { ...base, outrosCustos: "7.30", formaPagamentoInformada: "PIX", cobranca: { ...base.endereco, pais: "Brasil", logradouro: "Rua de cobrança sintética", complemento: "Portaria" }, endereco: { ...base.endereco, pais: "Brasil", complemento: "Portaria" }, destinatario: { ...base.destinatario, primeiroNome: "Pessoa", sobrenome: "Sintética" }, itens: base.itens.map(i => ({ ...i, observacoes: "Instrução específica do produto sintético" })) };
    const r = await criarRascunhoPedido(dados, chave(), sessao);
    const rascunho = (await listarPedidos({ busca: String(r.numero) })).pedidos.find(p => p.id === r.id)!;
    expect(rascunho).toMatchObject({ outrosCustos: "7.30", formaPagamentoInformada: "PIX", cobrancaSnapshot: { pais: "Brasil", logradouro: "Rua de cobrança sintética" }, enderecoSnapshot: { pais: "Brasil" }, itensDetalhes: [{ observacoes: "Instrução específica do produto sintético" }] });
    const p = await confirmarPedido(r.id, r.versao, chave(), sessao);
    const fotografado = (await listarPedidos({ busca: String(p.numero) })).pedidos.find(x => x.id === p.id)!;
    expect(fotografado).toMatchObject({ subtotal: "200", total: "212.3", frete: "15", desconto: "10", outrosCustos: "7.3", formaPagamentoInformada: "PIX", cobrancaSnapshot: { nome: "Cobrança", pais: "Brasil", logradouro: "Rua de cobrança sintética" }, destinatarioSnapshot: { primeiroNome: "Pessoa", sobrenome: "Sintética" }, itensDetalhes: [{ observacoes: "Instrução específica do produto sintético" }] });
    const boletoComercial = await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Boleto da projeção sintética", tipo: "BOLETO" } });
    const alterado = { ...dados, pagamentoInformado: { formaId: boletoComercial.id, parcelas: 1, vencimentos: ["2026-10-10"] }, cobranca: { ...dados.cobranca, logradouro: "Rua de cobrança revisada sintética" }, outrosCustos: "2.10", formaPagamentoInformada: "BOLETO", itens: dados.itens.map(i => ({ ...i, observacoes: "Instrução do produto após revisão" })) };
    await expect(revisarPedido(p.id, p.versao, alterado, chave(), sessao)).rejects.toThrow("cancele o pedido e crie um novo");
    const revisado = await editarInformacoesPedido(p.id, p.versao, { cobranca: alterado.cobranca, motivo: "Cobrança revisada sem efeito comercial" }, chave(), sessao);
    const atual = (await listarPedidos({ busca: String(revisado.numero) })).pedidos.find(x => x.id === p.id)!;
    expect(atual).toMatchObject({ total: "212.3", outrosCustos: "7.3", formaPagamentoInformada: "PIX", cobrancaSnapshot: { logradouro: "Rua de cobrança revisada sintética" }, itensDetalhes: [{ observacoes: "Instrução específica do produto sintético" }] });
    expect(atual.itens).toBe(1);
    expect(await sim.prisma.itemPedidoVenda.count({ where: { pedidoId: p.id, vigente: false } })).toBe(0);
  });

  it("fotografa custo e conversão, mantém intermediário separado e não inventa custo ou estoque sem composição", async () => {
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Ingrediente sintético", unidade: "KG", custoMedio: "10" } });
    const intermediario = await sim.prisma.insumo.create({ data: { nome: "Preparação sintética", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: "2", rendimentoUnidade: "KG", componentes: { create: { componenteId: insumo.id, quantidade: "1" } } } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Produto com ficha sintética", unidade: "UN", componentes: { create: { insumoId: intermediario.id, quantidade: "1", unidade: "KG" } }, preco: "50" } });
    const r = await criarRascunhoPedido({ ...entrada(), itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao);
    let p = await confirmarPedido(r.id, 1, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), sessao);
    const cobertura = (await obterPedido(p.id)).cobertura as CoberturaPedido;
    expect(cobertura.itens[0].custoEstimado).toBe("10.00");
    expect(cobertura.itens[0].necessidades).toHaveLength(1);
    expect(cobertura.itens[0].necessidades[0]).toMatchObject({ insumoId: intermediario.id, quantidade: "2", tipo: "PRODUTO_INTERMEDIARIO" });
    await sim.prisma.insumo.update({ where: { id: insumo.id }, data: { custoMedio: "90" } });
    await sim.prisma.componenteProdutoVenda.updateMany({ where: { produtoId: produto.id }, data: { quantidade: "5" } });
    expect((await obterPedido(p.id)).cobertura).toEqual(cobertura);
    const sem = await criarRascunhoPedido(entrada(), chave(), sessao);
    await confirmarPedido(sem.id, 1, chave(), sessao);
    expect(((await obterPedido(sem.id)).cobertura as CoberturaPedido).itens[0]).toMatchObject({ custoEstimado: null, custoApurado: null, disponibilidade: null });
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    expect(await sim.prisma.notaFiscalRecebida.count()).toBe(0);
  });
  it("operação manual valida todo o lote contra reservas e consumo sem criar baixa nem apontamento parcial", async () => {
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local integral fictício" } });
    const configuracaoAnterior = await sim.prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", pedidosLiberacao: { locais: [local.id] } }, update: { pedidosLiberacao: { locais: [local.id] } } });
    try {
      const insumo = await sim.prisma.insumo.create({ data: { nome: "Material integral fictício", unidade: "KG" } });
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 10 });
      const produtos = await Promise.all([1, 2].map(n => sim.prisma.produtoVenda.create({ data: { nome: `Kit integral fictício ${n}`, unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "KG" } }, preco: 100 } })));
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: produtos.map(produto => ({ produtoId: produto.id, quantidade: "1", escolhas: {}, precoManual: null })) }, chave(), sessao);
      let p = await confirmarPedido(r.id, 1, chave(), sessao);
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao);
      const itens = await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id, vigente: true }, orderBy: { ordem: "asc" } });
      await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao)).rejects.toThrow("sem reserva");
      for (const item of itens) p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "1" }, chave(), sessao) };
      const reservas = await Promise.all(itens.map(item => sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } })));
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "CONSUMIR", reservaId: reservas[0].id, quantidade: "1", motivo: "Uso integral fictício" }, chave(), sessao) };
      const v = p.versao;
      await expect(executarOperacaoPedido(p.id, v, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao)).rejects.toThrow("consumo");
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_PREPARAR" } })).toBe(0);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } }))).toMatchObject({ versao: v, statusOperacional: "EM_PREPARO" });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "CONSUMIR", reservaId: reservas[1].id, quantidade: "1", motivo: "Uso integral fictício" }, chave(), sessao) };
      const antes = await sim.prisma.movimentacaoEstoque.count();
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao);
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao);
      expect(await sim.prisma.movimentacaoEstoque.count()).toBe(antes);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } }))).toMatchObject({ statusOperacional: "EM_ENTREGA" });
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_PREPARAR" } })).toBe(2);
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_EXPEDIR" } })).toBe(2);
    } finally {
      if (configuracaoAnterior) await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: configuracaoAnterior.pedidosLiberacao === null ? Prisma.DbNull : configuracaoAnterior.pedidosLiberacao } });
      else await sim.prisma.configuracaoLoja.delete({ where: { id: "singleton" } });
    }
  });

  it("operação manual mantém revenda reservada no preparo e exige saída física antes de Em rota", async () => {
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local revenda integral fictício" } });
    const configuracaoAnterior = await sim.prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", pedidosLiberacao: { locais: [local.id] } }, update: { pedidosLiberacao: { locais: [local.id] } } });
    try {
      const insumo = await sim.prisma.insumo.create({ data: { nome: "Revenda integral fictícia", unidade: "UN" } });
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 3 });
      const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Revenda do gestor fictícia", tipo: "REVENDA", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "UN" } }, preco: 100 } });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao);
      let p = await confirmarPedido(r.id, 1, chave(), sessao);
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "2" }, chave(), sessao) };
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao);
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao);
      const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
      expect(reserva.consumida.toString()).toBe("0");
      await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao)).rejects.toThrow("consumo/saída");
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_EXPEDIR" } })).toBe(0);
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "EXPEDIR_REVENDA", reservaId: reserva.id, quantidade: "2", motivo: "Revenda expedida no ensaio fictício" }, chave(), sessao) };
      const antes = await sim.prisma.movimentacaoEstoque.count();
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "AVANCAR", confirmarIntegralmente: true }, chave(), sessao);
      expect(await sim.prisma.movimentacaoEstoque.count()).toBe(antes);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).statusOperacional).toBe("EM_ENTREGA");
    } finally {
      if (configuracaoAnterior) await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: configuracaoAnterior.pedidosLiberacao === null ? Prisma.DbNull : configuracaoAnterior.pedidosLiberacao } });
      else await sim.prisma.configuracaoLoja.delete({ where: { id: "singleton" } });
    }
  });

  it("F1/T03/T05: reserva concorrente, consumo idempotente, perda sem segunda saída e cancelamento libera", async () => {
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local físico fictício" } });
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", pedidosLiberacao: { locais: [local.id] } }, update: { pedidosLiberacao: { locais: [local.id] } } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Material físico fictício", unidade: "KG", custoMedio: 10 } });
    await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 3 });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Montagem física fictícia", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "KG" } }, preco: 150 } });
    const criar = async () => {
      const p = await criarRascunhoPedido({ ...entrada(), frete: "0", desconto: "0", itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao);
      await confirmarPedido(p.id, 1, chave(), sessao);
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      return { ...p, item };
    };
    const a = await criar(), b = await criar();
    const comando = (itemId: string) => ({ tipo: "RESERVAR" as const, itemId, localId: local.id, quantidade: "2" });
    const disputa = await Promise.allSettled([executarFisicoPedido(a.id, 2, comando(a.item.id), chave(), sessao), executarFisicoPedido(b.id, 2, comando(b.item.id), chave(), sessao)]);
    expect(disputa.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const vencedor = disputa[0].status === "fulfilled" ? a : b;
    const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: vencedor.item.id } });
    await expect(registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "SAIDA_PERDA", quantidade: 2 })).rejects.toThrow("reservada");
    await executarOperacaoPedido(vencedor.id, 3, { tipo: "INICIAR" }, chave(), sessao);
    const consumir = { tipo: "CONSUMIR" as const, reservaId: reserva.id, quantidade: "1", motivo: "Uso fictício apontado" };
    const key = chave();
    await executarFisicoPedido(vencedor.id, 4, consumir, key, sessao);
    await executarFisicoPedido(vencedor.id, 4, consumir, key, sessao);
    expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("2");
    await expect(executarFisicoPedido(vencedor.id, 5, { tipo: "PERDA", reservaId: reserva.id, quantidade: "1", motivo: "Dano fictício" }, chave(), bloqueado)).rejects.toThrow("acesso");
    const movimentos = await sim.prisma.movimentacaoEstoque.count();
    await executarFisicoPedido(vencedor.id, 5, { tipo: "PERDA", reservaId: reserva.id, quantidade: "1", motivo: "Dano fictício" }, chave(), sessao);
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(movimentos);
    await cancelarPedido(vencedor.id, 6, "Cancelamento fictício", chave(), sessao);
    const final = await sim.prisma.reservaPedido.findUniqueOrThrow({ where: { id: reserva.id } });
    expect(final.reservada.toString()).toBe("0"); expect(final.liberada.toString()).toBe("1"); expect(final.perdida.toString()).toBe("1");
  });

  it("F2/T06: prontidão mantém base zero configurável e distingue composição e custo", async () => {
    const linhas = await consultarProntidaoProdutos();
    expect(linhas.find(p => p.id === zeroId)?.vendavel).toBe(true);
    expect(linhas.find(p => p.id === zeroId)?.composicaoValidada).toBe(false);
    expect(linhas.find(p => p.id === zeroId)?.custoPorMovimentos).toBeNull();
    expect(linhas.find(p => p.id === zeroId)?.problemas.length).toBeGreaterThan(0);
  });
  it("F3/T14: gestão HUB dispensa flag fictícia e mantém autorização real", async () => {
    const antes = await sim.prisma.pedidoVenda.count();
    const flag = process.env.PEDIDOS_AMBIENTE_ISOLADO;
    try {
      delete process.env.PEDIDOS_AMBIENTE_ISOLADO;
      await expect(criarRascunhoPedido(entrada(), chave(), bloqueado)).rejects.toThrow("acesso");
      const criado = await criarRascunhoPedido(entrada(), chave(), sessao);
      expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: criado.id } })).toBe(0);
    }
    finally { process.env.PEDIDOS_AMBIENTE_ISOLADO = flag; }
    expect(await sim.prisma.pedidoVenda.count()).toBe(antes + 1);
  });

  it("T16: referência fiscal externa é única, autorizada e não gera receita ou emissão", async () => {
    const pedidos = await sim.prisma.pedidoVenda.findMany({ where: { status: "CONFIRMADO" }, take: 2 });
    const financeiro = await sim.prisma.lancamentoFinanceiro.count();
    const fiscal = await sim.prisma.notaFiscalRecebida.count();
    await expect(vincularDocumentoExternoPedido(pedidos[0].id, "Emissor fictício", "Documento fictício T16", "Evidência sintética", bloqueado)).rejects.toThrow("acesso");
    await vincularDocumentoExternoPedido(pedidos[0].id, "Emissor fictício", "Documento fictício T16", "Evidência sintética", sessao);
    await vincularDocumentoExternoPedido(pedidos[0].id, "Emissor fictício", "Documento fictício T16", "Evidência sintética", sessao);
    await expect(vincularDocumentoExternoPedido(pedidos[1].id, "Emissor fictício", "Documento fictício T16", "Evidência sintética", sessao)).rejects.toThrow("outro pedido");
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { tipo: "DOCUMENTO_FISCAL_EXTERNO" } })).toBe(1);
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(financeiro); expect(await sim.prisma.notaFiscalRecebida.count()).toBe(fiscal);
  });

  it("T04: preparação já estocada sai sem consumir novamente os ingredientes", async () => {
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Cozinha fictícia T04" } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id] } } });
    const ingrediente = await sim.prisma.insumo.create({ data: { nome: "Ingrediente T04", unidade: "KG", custoMedio: 10 } });
    const preparo = await sim.prisma.insumo.create({ data: { nome: "Preparação T04", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: 1, rendimentoUnidade: "KG", componentes: { create: { componenteId: ingrediente.id, quantidade: 1 } } } });
    await registrarMovimentacao({ insumoId: ingrediente.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 5 });
    // Fronteira de produção já realizada: usa o livro existente, não emissão de etiqueta.
    await sim.prisma.$transaction(async tx => {
      await registrarMovimentacao({ tx, insumoId: ingrediente.id, localId: local.id, tipo: "SAIDA_CONSUMO", quantidade: 1 });
      await registrarMovimentacao({ tx, insumoId: preparo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 1 });
    });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Pedido T04", unidade: "UN", componentes: { create: { insumoId: preparo.id, quantidade: 1, unidade: "KG" } }, preco: 100 } });
    const p = await criarRascunhoPedido({ ...entrada(), itens: [{ produtoId: produto.id, quantidade: "1", escolhas: {}, precoManual: null }] }, chave(), sessao);
    await confirmarPedido(p.id, 1, chave(), sessao);
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
    await executarFisicoPedido(p.id, 2, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "1" }, chave(), sessao);
    await executarOperacaoPedido(p.id, 3, { tipo: "INICIAR" }, chave(), sessao);
    const r = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
    await executarFisicoPedido(p.id, 4, { tipo: "CONSUMIR", reservaId: r.id, quantidade: "1", motivo: "Uso da preparação produzida" }, chave(), sessao);
    expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: ingrediente.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("4");
    expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: preparo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("0");
    expect(await sim.prisma.movimentacaoEstoque.count({ where: { insumoId: ingrediente.id, tipo: "SAIDA_CONSUMO" } })).toBe(1);
    const retorno = { tipo: "RETORNAR" as const, reservaId: r.id, quantidade: "1", motivo: "Preparação original recuperada, sem transformação, condição conferida no ensaio" };
    const key = chave(); await executarFisicoPedido(p.id, 5, retorno, key, sessao); await executarFisicoPedido(p.id, 5, retorno, key, sessao);
    expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: preparo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("1");
    expect(await sim.prisma.movimentacaoEstoque.count({ where: { insumoId: ingrediente.id, tipo: "SAIDA_CONSUMO" } })).toBe(1);
    await expect(executarFisicoPedido(p.id, 6, { tipo: "PERDA", reservaId: r.id, quantidade: "1", motivo: "Duplo destino recusado" }, chave(), sessao)).rejects.toThrow("já destinado");
  });

  it("modo externo: confirmação/revisão/cancelamento sem financeiro, referência única e guardas diretas", async () => {
    const { registrarRecebimentoPedido, concederCreditoPedido } = await import("@/lib/vendas/pedidos");
    const dados = { ...entrada(), previsaoJanela: "14:00–15:00", referenciaOrigem: "TAKEAT", referenciaEstabelecimento: "loja-ficticia", referenciaPedido: "externo-001" };
    const contagens = async () => Promise.all([sim.prisma.lancamentoFinanceiro.count(), sim.prisma.movimentacaoBancaria.count(), sim.prisma.pagamentoExternoPedido.count(), sim.prisma.tratamentoFinanceiroPedido.count(), sim.prisma.creditoClienteMovimento.count(), sim.prisma.notaFiscalRecebida.count()]);
    const antes = await contagens(), criacao = chave();
    let p = await criarRascunhoBase(dados, criacao, sessao);
    expect((await criarRascunhoBase(dados, criacao, sessao)).id).toBe(p.id);
    await expect(criarRascunhoBase(dados, chave(), sessao)).rejects.toThrow("referência externa");
    expect((await criarRascunhoBase({ ...dados, referenciaEstabelecimento: "outra-loja" }, chave(), sessao)).id).not.toBe(p.id);
    await expect(confirmarPedido(p.id, p.versao, chave(), sessao, { categoriaId: "sintetica", dataCompetencia: "2026-09-26", parcelas: [] })).rejects.toThrow("externamente");
    const flag = process.env.PEDIDOS_AMBIENTE_ISOLADO;
    try { delete process.env.PEDIDOS_AMBIENTE_ISOLADO; p = await confirmarPedido(p.id, p.versao, chave(), sessao); }
    finally { process.env.PEDIDOS_AMBIENTE_ISOLADO = flag; }
    expect((await obterPedido(p.id)).financeiro).toBeNull();
    expect((await obterPedido(p.id)).modoFinanceiro).toBe("EXTERNO");
    expect((await listarPedidos({ busca: "externo-001" })).pedidos.some(x => x.id === p.id)).toBe(true);
    await expect(registrarRecebimentoPedido(p.id, "titulo-falso", "1", "conta-falsa", "2026-09-26", chave(), sessao)).rejects.toThrow("externamente");
    await expect(concederCreditoPedido(p.id, "1", "2026-09-26", "Escolha fictícia", chave(), sessao)).rejects.toThrow("externamente");
    await expect(revisarPedido(p.id, p.versao, dados, chave(), bloqueado)).rejects.toThrow("acesso");
    await expect(revisarPedido(p.id, p.versao, { ...dados, frete: "20" }, chave(), sessao)).rejects.toThrow("cancele o pedido e crie um novo");
    const disputa = await Promise.allSettled(["Primeiro", "Segundo"].map(nome => editarInformacoesPedido(p.id, p.versao, { destinatario: { ...dados.destinatario, nome }, motivo: "Destinatário ajustado" }, chave(), sessao)));
    expect(disputa.filter(x => x.status === "fulfilled")).toHaveLength(1);
    const atual = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    await cancelarPedido(p.id, atual.versao, "Cancelamento externo fictício", chave(), sessao);
    expect(await contagens()).toEqual(antes);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).referenciaPedido).toBe("externo-001");
  });
  it("modo externo: ciclo físico parcial, reagendamento, comanda e entrega sem títulos", async () => {
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Operação externa fictícia" } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id] }, fusoHorario: "America/Manaus" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Material externo fictício", unidade: "KG", custoMedio: 10 } });
    await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 10 });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Kit externo fictício", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "KG" } }, preco: 150 } });
    const dados = { ...entrada(), previsaoJanela: "14:00–15:00", previsaoData: diaNoFuso(new Date(), "America/Manaus"), itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] };
    let p = await criarRascunhoBase(dados, chave(), sessao);
    p = await confirmarPedido(p.id, p.versao, chave(), sessao);
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
    p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "2" }, chave(), sessao) };
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), sessao);
    const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
    for (let n = 0; n < 2; n++) {
      const k = chave(), v = p.versao, comando = { tipo: "CONSUMIR" as const, reservaId: reserva.id, quantidade: "1", motivo: "Uso efetivo fictício" };
      p = { ...p, ...await executarFisicoPedido(p.id, v, comando, k, sessao) };
      await executarFisicoPedido(p.id, v, comando, k, sessao);
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, chave(), sessao);
    }
    await expect(revisarPedido(p.id, p.versao, { ...dados, observacoes: "mudar instrução executada" }, chave(), sessao)).rejects.toThrow("cancele o pedido e crie um novo");
    expect((await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: item.id } })).vigente).toBe(true);
    expect((await sim.prisma.reservaPedido.findUniqueOrThrow({ where: { id: reserva.id } })).consumida.toString()).toBe("2");
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "REAGENDAR", data: "2026-10-12", janela: "14:00–15:00", motivo: "Cliente fictício solicitou" }, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PRONTO" }, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "EXPEDIR", itemId: item.id, quantidade: "2" }, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "SAIR" }, chave(), sessao);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "ENTREGAR" }, chave(), sessao);
    const final = await obterPedido(p.id);
    expect(final).toMatchObject({ statusOperacional: "ENTREGUE", modoFinanceiro: "EXTERNO", fusoHorario: "America/Manaus", financeiro: null });
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: p.id } })).toBe(0);
    expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("8");
  });

  it("gestor: declínio/estorno autorizado, idempotente, histórico e sem efeitos financeiros", async () => {
    const contagens = async () => Promise.all([sim.prisma.lancamentoFinanceiro.count(), sim.prisma.movimentacaoBancaria.count(), sim.prisma.pagamentoExternoPedido.count(), sim.prisma.tratamentoFinanceiroPedido.count(), sim.prisma.creditoClienteMovimento.count(), sim.prisma.notaFiscalRecebida.count()]);
    const antes = await contagens();
    const d = await criarRascunhoBase({ ...entrada(), previsaoJanela: "14:00–15:00" }, chave(), sessao);
    await expect(encerrarPedidoManual(d.id, d.versao, "DECLINADO", "Não aprovado", "", chave(), bloqueado)).rejects.toThrow("acesso");
    const k = chave();
    const resultados = await Promise.all([encerrarPedidoManual(d.id, d.versao, "DECLINADO", "Não aprovado", "", k, sessao), encerrarPedidoManual(d.id, d.versao, "DECLINADO", "Não aprovado", "", k, sessao)]);
    expect(resultados[0]).toEqual(resultados[1]);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: d.id, tipo: "DECLINADO" } })).toBe(1);
    let p = await criarRascunhoBase({ ...entrada(), previsaoJanela: "14:00–15:00" }, chave(), sessao); p = await confirmarPedido(p.id, p.versao, chave(), sessao);
    await expect(encerrarPedidoManual(p.id, p.versao, "ESTORNADO", "Devolvido", "", chave(), sessao)).rejects.toThrow("referência");
    await expect(encerrarPedidoManual(p.id, p.versao, "ESTORNADO", "Devolvido", "comprovante fictício", chave(), bloqueado)).rejects.toThrow("acesso");
    const foto = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    const e = await encerrarPedidoManual(p.id, p.versao, "ESTORNADO", "Devolvido externamente", "comprovante fictício", chave(), sessao);
    expect(e.status).toBe("ESTORNADO");
    const salvo = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(salvo.total.toString()).toBe(foto.total.toString()); expect(salvo.compradorSnapshot).toEqual(foto.compradorSnapshot);
    expect((await consultarGestorPedidos()).pedidos.some(x => [p.id, d.id].includes(x.id))).toBe(false);
    expect(await contagens()).toEqual(antes);
  });
  it("gestor: limite de preparo e horário validado no servidor; configuração concorrente e permissões", async () => {
    const hoje = diaNoFuso(new Date(), "America/Manaus");
    const futuro = { ...entrada(), previsaoJanela: "14:00–15:00", previsaoData: somarDias(hoje, 3) };
    let p = await criarRascunhoBase(futuro, chave(), sessao); p = await confirmarPedido(p.id, p.versao, chave(), sessao);
    await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), sessao)).rejects.toThrow("dois dias");
    const lojaEstoque = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { ...(lojaEstoque.pedidosLiberacao as object), movimentarEstoque: true } } });
    try { await expect(mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao)).rejects.toThrow("dois dias"); }
    finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: lojaEstoque.pedidosLiberacao ?? Prisma.DbNull } }); }
    const offFuturo = await criarRascunhoBase(futuro, chave(), sessao);
    const offConfirmado = await confirmarPedido(offFuturo.id, offFuturo.versao, chave(), sessao);
    await expect(mudarStatusGestorPedido(offConfirmado.id, offConfirmado.versao, "avancar", chave(), sessao)).resolves.toHaveProperty("statusOperacional", "EM_PREPARO");
    const doisDias = { ...futuro, previsaoData: somarDias(hoje, 2) };
    p = await revisarPedido(p.id, p.versao, doisDias, chave(), sessao);
    await executarOperacaoPedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), sessao);
    const h = horariosVazios(); h.dias = h.dias.map(() => ({ intervalos: [{ inicio: "08:00", fim: "10:00" }] }));
    await expect(salvarHorariosPedidos(h, 0, bloqueado)).rejects.toThrow("acesso");
    const disputa = await Promise.allSettled([salvarHorariosPedidos(h, 0, sessao), salvarHorariosPedidos(h, 0, sessao)]);
    expect(disputa.filter(x => x.status === "fulfilled")).toHaveLength(1);
    const d = await criarRascunhoBase({ ...entrada(), previsaoData: hoje, previsaoJanela: "07:00–08:00" }, chave(), sessao);
    await expect(confirmarPedido(d.id, d.versao, chave(), sessao)).rejects.toThrow("Escolha uma janela nos horários de entrega.");
    const ok = await salvarRascunhoPedido(d.id, d.versao, { ...entrada(), previsaoData: hoje, previsaoJanela: "08:00–09:00" }, chave(), sessao);
    const confirmado = await confirmarPedido(ok.id, ok.versao, chave(), sessao);
    await executarOperacaoPedido(confirmado.id, confirmado.versao, { tipo: "INICIAR" }, chave(), sessao);
    const gestor = await consultarGestorPedidos();
    expect(gestor.dias).toHaveLength(4); expect(gestor.pedidos.find(p => p.id === d.id)?.etapa).toBe("EM_PREPARO");
  });

  it("agenda com texto, exceções por data, idempotência e preservação do pedido confirmado", async () => {
    const c = horariosEntregaVazios();
    c.semana[0] = { fechado: false, horarios: [{ inicio: "", fim: "", texto: "Manhã" }, { inicio: "", fim: "", texto: "Tarde" }] };
    c.semana[1] = { fechado: false, copiadoDe: 0, horarios: [...c.semana[0].horarios].reverse() };
    c.especiais = [{ data: "2026-10-10", horarios: [{ inicio: "09:05", fim: "12:30", texto: "Manhã especial" }] }];
    c.desativadas = ["2026-10-11"];
    const base = (await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } })).versaoHorariosPedidos;
    const k = chave();
    const resultados = await Promise.all([salvarHorariosPedidos(c, base, sessao, k), salvarHorariosPedidos(c, base, sessao, k)]);
    expect(resultados[0]).toEqual(resultados[1]);
    const consultado = await consultarHorariosPedidos();
    expect(consultado.horarios).toMatchObject({ semana: c.semana });
    expect(janelasDoDia("2026-10-06", consultado.horarios)).toEqual(["Tarde", "Manhã"]);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { id: `horarios-pedidos:${k}` } })).toBe(1);
    await expect(salvarHorariosPedidos(c, base, sessao, chave())).rejects.toThrow("outra tela");
    await expect(salvarHorariosPedidos({ ...c, desativadas: [] }, base, sessao, k)).rejects.toThrow("outros dados");
    await expect(salvarHorariosPedidos(c, base + 1, bloqueado, chave())).rejects.toThrow("acesso");
    const dados = { ...entrada(), previsaoJanela: "Manhã especial" };
    const rascunho = await criarRascunhoBase(dados, chave(), sessao);
    const p = await confirmarPedido(rascunho.id, rascunho.versao, chave(), sessao);
    const fechado = await criarRascunhoBase({ ...dados, previsaoData: "2026-10-11" }, chave(), sessao);
    await expect(confirmarPedido(fechado.id, fechado.versao, chave(), sessao)).rejects.toThrow("Escolha uma janela nos horários de entrega.");
    const invalido = await criarRascunhoBase({ ...dados, previsaoJanela: "09:05–12:30" }, chave(), sessao);
    await expect(confirmarPedido(invalido.id, invalido.versao, chave(), sessao)).rejects.toThrow("Escolha uma janela nos horários de entrega.");
    await salvarHorariosPedidos(horariosEntregaVazios(), base + 1, sessao, chave());
    await expect(editarInformacoesPedido(p.id, p.versao, { destinatario: { ...dados.destinatario, nome: "Pessoa fictícia atualizada" }, motivo: "Atualizar contato sem mudar agenda histórica" }, chave(), sessao)).resolves.toHaveProperty("status", "CONFIRMADO");
    const atualizado = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    await expect(executarOperacaoPedido(p.id, atualizado.versao, { tipo: "REAGENDAR", data: "2026-10-11", janela: "Manhã especial", motivo: "Solicitação fictícia" }, chave(), sessao)).rejects.toThrow("Escolha uma janela nos horários de entrega.");
    const total = await sim.prisma.historicoCadastroVenda.count({ where: { entidade: "HORARIOS_PEDIDOS" } });
    await sim.prisma.usuario.update({ where: { id: sessao.userId }, data: { sessaoVersao: { increment: 1 } } });
    try { await expect(salvarHorariosPedidos(c, base + 2, sessao, chave())).rejects.toThrow("sessão"); }
    finally { await sim.prisma.usuario.update({ where: { id: sessao.userId }, data: { sessaoVersao: sessao.versao ?? 0 } }); }
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { entidade: "HORARIOS_PEDIDOS" } })).toBe(total);
  });

  const clienteNovo = () => ({ versao: 0, nome: "Novo Fictício", primeiroNome: "Novo", sobrenome: "Fictício", tipo: "PF", documento: "12345678901", telefone: "+5511999990000", email: `novo-${chave()}@example.invalid`, enderecos: [{ nome: "Cobrança", destinatario: "", pais: "Brasil", cep: "01001000", logradouro: "Rua Fictícia", numero: "10", complemento: "Casa", bairro: "Centro", cidade: "São Paulo", uf: "SP" }], ativo: true });
  it("salva cliente junto do orçamento atomicamente, com idempotência e auditoria", async () => {
    const antes = await sim.prisma.clienteVenda.count();
    const d = { ...entrada(), clienteId: null, clienteNovo: clienteNovo() }, k = chave();
    const [a, b] = await Promise.all([criarRascunhoPedido(d, k, sessao), criarRascunhoPedido(d, k, sessao)]);
    expect(a).toEqual(b); expect(a.clienteId).toBeTruthy();
    expect(await sim.prisma.clienteVenda.count()).toBe(antes + 1);
    const pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: a.id } });
    expect(pedido.rascunho).toMatchObject({ clienteId: a.clienteId });
    expect(pedido.rascunho).not.toHaveProperty("clienteNovo");
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: a.clienteId! } })).toBe(1);
    const c = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: a.clienteId! } });
    expect(c.telefone).toBe("+5511999990000"); expect(c.enderecos).toMatchObject([{ nome: "Cobrança", numero: "10" }]);
    await expect(salvarRascunhoPedido(a.id, 0, d, chave(), sessao)).rejects.toThrow();
    expect(await sim.prisma.clienteVenda.count()).toBe(antes + 1);
    const salvo = await salvarRascunhoPedido(a.id, a.versao, { ...entrada(), clienteId: a.clienteId }, chave(), sessao);
    expect(salvo.clienteId).toBe(a.clienteId); expect(await sim.prisma.clienteVenda.count()).toBe(antes + 1);
  });
  it("permissão de pedido não autoriza criar cliente; falha de referência desfaz o cadastro", async () => {
    const perfil = await sim.prisma.perfilAcesso.create({ data: { nome: "Pedido sem cadastro", permissoes: { "vendas.pedidos": ["visualizar", "adicionar"] } } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Operador fictício", email: "sem-clientes@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const s = { ...sessao, userId: u.id, admin: false };
    const antes = await sim.prisma.clienteVenda.count();
    const d = { ...entrada(), desconto: "0", clienteId: null, clienteNovo: { ...clienteNovo(), documento: "98765432100" } };
    await expect(criarRascunhoPedido(d, chave(), s)).rejects.toThrow("acesso");
    const ref = { referenciaOrigem: "SINTETICA", referenciaEstabelecimento: "FICTICIO", referenciaPedido: "duplicidade-cliente" };
    await criarRascunhoPedido({ ...entrada(), ...ref }, chave(), sessao);
    await expect(criarRascunhoPedido({ ...d, ...ref }, chave(), sessao)).rejects.toThrow("referência externa");
    expect(await sim.prisma.clienteVenda.count()).toBe(antes);
    await expect(criarRascunhoPedido({ ...d, clienteNovo: { ...d.clienteNovo, documento: "CPFcomletra" } }, chave(), sessao)).rejects.toThrow("CPF");
  });
  async function clienteParaAtualizar() {
    const dados = { ...clienteNovo(), versao: 1, documento: null };
    const c = await sim.prisma.clienteVenda.create({ data: { ...dados, observacoes: "Nota cadastral preservada", boletoDiasAposEntrega: 5, limiteCreditoAberto: "5000", formasPagamentoHabilitadas: [] } });
    return { c, atualizacao: { ...dados, id: c.id, versao: c.versao, primeiroNome: "Atualizado", nome: "Atualizado Fictício" } };
  }
  it("recusa um cadastro unificado em novos orçamentos, confirmação e edição cadastral", async () => {
    const { c, atualizacao } = await clienteParaAtualizar();
    await sim.prisma.clienteVenda.update({ where: { id: c.id }, data: { unificadoEmId: clienteId, ativo: false } });
    const total = await sim.prisma.pedidoVenda.count();
    await expect(criarRascunhoPedido({ ...entrada(), clienteId: c.id }, chave(), sessao)).rejects.toThrow(/unificado/);
    await expect(calcularPedido(sim.prisma, validarEntradaPedido({ ...entrada(), clienteId: c.id }))).rejects.toThrow(/cliente ativo/);
    await expect(salvarCliente(atualizacao, { userId: sessao.userId, nome: sessao.nome })).rejects.toThrow(/unificado/);
    expect(await sim.prisma.pedidoVenda.count()).toBe(total);
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: c.id } })).versao).toBe(c.versao);
  });
  it("atualiza cliente no orçamento com auditoria/idempotência e preserva regras não expostas", async () => {
    const { c, atualizacao } = await clienteParaAtualizar();
    const enderecos = [{ ...atualizacao.enderecos[0], numero: "42" }, { ...atualizacao.enderecos[0], nome: "Endereço 2", numero: "43" }];
    const entregaPadrao = { destinatario: { nome: "Destinatária atualizada", contato: "11999990001" }, endereco: enderecos[1] };
    const d = { ...entrada(), pagamentoInformado: null, clienteId: c.id, clienteAtualizacao: { ...atualizacao, enderecos, entregaPadrao, ativo: false, observacoes: "Não sobrescrever", regrasPagamento: { formasPagamentoIds: null } } }, k = chave();
    const a = await criarRascunhoPedido(d, k, sessao), b = await criarRascunhoPedido(d, k, sessao);
    expect(a).toEqual(b); expect(a.clienteVersao).toBe(c.versao + 1);
    const depois = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: c.id } });
    expect(depois).toMatchObject({ nome: "Atualizado Fictício", email: c.email, ativo: true, observacoes: c.observacoes, boletoDiasAposEntrega: 5, formasPagamentoHabilitadas: [], enderecos, entregaPadrao: { destinatario: { ...entregaPadrao.destinatario, contato: "+5511999990001" }, endereco: { numero: "43" } } });
    expect(depois.limiteCreditoAberto?.toFixed(2)).toBe("5000.00");
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: c.id } })).toBe(1);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: a.id } })).rascunho).not.toHaveProperty("clienteAtualizacao");
    const salvo = await salvarRascunhoPedido(a.id, a.versao, { ...d, clienteAtualizacao: { ...atualizacao, enderecos: undefined, versao: a.clienteVersao, sobrenome: "Revisado" } }, chave(), sessao);
    expect(salvo.clienteVersao).toBe(c.versao + 2);
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: c.id } })).enderecos).toEqual(enderecos);
    const trocado = await salvarRascunhoPedido(salvo.id, salvo.versao, { ...entrada(), clienteId, pagamentoInformado: null }, chave(), sessao);
    expect(trocado.clienteId).toBe(clienteId);
    expect(await criarRascunhoPedido(d, k, sessao)).toEqual(a);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: a.id } })).clienteId).toBe(clienteId);
  });
  it("protege o e-mail, exige editar Clientes e recusa revisão cadastral concorrente sem salvar o pedido", async () => {
    const { c, atualizacao } = await clienteParaAtualizar();
    const d = { ...entrada(), clienteId: c.id, clienteAtualizacao: atualizacao };
    const totalPedidos = await sim.prisma.pedidoVenda.count();
    await expect(criarRascunhoPedido({ ...d, clienteAtualizacao: { ...atualizacao, email: "troca@example.invalid" } }, chave(), sessao)).rejects.toThrow(/e-mail/);
    const perfil = await sim.prisma.perfilAcesso.create({ data: { nome: "Pedido sem editar cliente", permissoes: { "vendas.pedidos": ["visualizar", "adicionar"], "vendas.clientes": ["visualizar", "adicionar"] } } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Operador de pedido sintético", email: "sem-editar-cliente@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    await expect(criarRascunhoPedido({ ...d, desconto: "0" }, chave(), { ...sessao, userId: u.id, admin: false })).rejects.toThrow(/acesso/);
    await sim.prisma.clienteVenda.update({ where: { id: c.id }, data: { versao: { increment: 1 } } });
    await expect(criarRascunhoPedido(d, chave(), sessao)).rejects.toThrow(/outra tela/);
    expect(await sim.prisma.pedidoVenda.count()).toBe(totalPedidos);
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: c.id } })).nome).toBe(c.nome);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: c.id } })).toBe(0);
  });
  it("falha de salvamento desfaz atualização cadastral e a confirmação usa os novos dados sem reescrever vendas anteriores", async () => {
    const { c, atualizacao } = await clienteParaAtualizar();
    await sim.prisma.clienteVenda.update({ where: { id: c.id }, data: { formasPagamentoHabilitadas: Prisma.DbNull } });
    const d = { ...entrada(), clienteId: c.id, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null };
    const antigo = await criarRascunhoBase(d, chave(), sessao, "EXTERNO");
    await confirmarPedido(antigo.id, antigo.versao, chave(), sessao);
    const snapshot = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: antigo.id } })).compradorSnapshot;
    const r = await criarRascunhoBase(d, chave(), sessao, "EXTERNO");
    await expect(salvarRascunhoPedido(r.id, r.versao + 1, { ...d, clienteAtualizacao: atualizacao }, chave(), sessao)).rejects.toThrow(/outra tela/);
    expect((await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: c.id } })).versao).toBe(c.versao);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: c.id } })).toBe(0);
    const salvo = await salvarRascunhoPedido(r.id, r.versao, { ...d, clienteAtualizacao: atualizacao }, chave(), sessao);
    await confirmarPedido(salvo.id, salvo.versao, chave(), sessao);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: salvo.id } })).compradorSnapshot).toMatchObject({ nome: "Atualizado Fictício", email: c.email });
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: antigo.id } })).compradorSnapshot).toEqual(snapshot);
  });
  it("preserva cadastro e condições comerciais de boleto na confirmação e revisão, sem efeitos financeiros", async () => {
    const f = await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Boleto comercial fictício", tipo: "BOLETO", permiteParcelamento: true, maximoParcelas: 2 } });
    const pagamentoInformado = { formaId: f.id, parcelas: 2, vencimentos: ["2026-10-09", "2026-11-13"] };
    const d = { ...entrada(), formaPagamentoInformada: "BOLETO", pagamentoInformado };
    await expect(criarRascunhoPedido({ ...d, pagamentoInformado: { ...pagamentoInformado, parcelas: 3 } }, chave(), sessao)).rejects.toThrow("Parcelamento");
    const r = await criarRascunhoPedido(d, chave(), sessao);
    expect((await obterPedido(r.id)).rascunho).toMatchObject({ pagamentoInformado });
    const p = await confirmarPedido(r.id, r.versao, chave(), sessao);
    const original = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(original.pagamentoInformadoSnapshot).toMatchObject({ ...pagamentoInformado, nome: f.nome, versao: f.versao });
    await sim.prisma.formaPagamentoVenda.update({ where: { id: f.id }, data: { ativo: false, nome: "Boleto renomeado", versao: { increment: 1 } } });
    const revisado = await revisarPedido(p.id, p.versao, { ...d, previsaoData: "2026-10-12" }, chave(), sessao);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: revisado.id } })).pagamentoInformadoSnapshot).toEqual(original.pagamentoInformadoSnapshot);
    await expect(criarRascunhoPedido(d, chave(), sessao)).rejects.toThrow("ativa");
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: p.id } })).toBe(0);
    expect(await sim.prisma.pagamentoExternoPedido.count({ where: { pedidoId: p.id } })).toBe(0);
  });
  it.each(["RASCUNHO", "DECLINADO", "CONFIRMADO", "CANCELADO", "ESTORNADO"])("edita agenda/cobrança em %s sem alterar itens, valores ou primeira entrega e revalida autor/reenvio", async status => {
    const d = { ...entrada(), atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null };
    const r = await criarRascunhoPedido(d, chave(), sessao);
    if (!["RASCUNHO", "DECLINADO"].includes(status)) await confirmarPedido(r.id, r.versao, chave(), sessao);
    const primeiraEntrega = new Date("2026-10-09T12:00:00Z");
    const antes = await sim.prisma.pedidoVenda.update({ where: { id: r.id }, data: { status, statusOperacional: "ENTREGUE", entregueEm: primeiraEntrega }, include: { itens: true } });
    const movimentos = await sim.prisma.movimentacaoEstoque.count();
    const cobranca = { ...entrada().endereco, pais: "Brasil", numero: "99" };
    const informacoes = { previsaoData: "2026-10-12", previsaoJanela: "tarde", cobranca, motivo: "Correção de agenda e faturamento fictícios" };
    const operacao = chave();
    await expect(editarInformacoesPedido(r.id, antes.versao, informacoes, operacao, bloqueado)).rejects.toThrow("acesso");
    const atualizado = await editarInformacoesPedido(r.id, antes.versao, informacoes, operacao, sessao);
    expect(await editarInformacoesPedido(r.id, antes.versao, informacoes, operacao, sessao)).toEqual(atualizado);
    await expect(editarInformacoesPedido(r.id, antes.versao, { ...informacoes, motivo: "Dados divergentes" }, operacao, sessao)).rejects.toThrow("outros dados");
    await expect(editarInformacoesPedido(r.id, antes.versao, informacoes, chave(), sessao)).rejects.toThrow("outra tela");
    const depois = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id }, include: { itens: true } });
    expect(depois).toMatchObject({ status, statusOperacional: "ENTREGUE", entregueEm: primeiraEntrega, previsaoJanela: "tarde", cobrancaSnapshot: { numero: "99" } });
    expect(depois.previsaoData?.toISOString().slice(0, 10)).toBe("2026-10-12");
    for (const campo of ["subtotal", "total", "frete", "desconto", "outrosCustos", "pagamentoInformadoSnapshot", "enderecoSnapshot", "itens"] as const) expect(depois[campo]).toEqual(antes[campo]);
    if (["RASCUNHO", "DECLINADO"].includes(status)) expect(depois.rascunho).toMatchObject({ previsaoData: "2026-10-12", previsaoJanela: "tarde", cobranca: { numero: "99" }, itens: d.itens });
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(movimentos);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: r.id, tipo: "INFORMACOES_ATUALIZADAS" } })).toBe(1);
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: r.id } })).toBe(0);
    await expect(editarInformacoesPedido(r.id, atualizado.versao, informacoes, chave(), { ...sessao, versao: 99 })).rejects.toThrow("sessão");
    await expect(executarOperacaoPedido(r.id, atualizado.versao, { tipo: "REAGENDAR", data: "2026-10-13", janela: "tarde", motivo: "Agenda fictícia", itemId: "item-injetado" }, chave(), sessao)).rejects.toThrow("Ação de agenda inválida");
    const reagendado = await executarOperacaoPedido(r.id, atualizado.versao, { tipo: "REAGENDAR", data: "2026-10-13", janela: "tarde", motivo: "Reagendamento após encerramento comercial" }, chave(), sessao);
    expect(reagendado).toMatchObject({ status, statusOperacional: "ENTREGUE" });
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id } })).entregueEm).toEqual(primeiraEntrega);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: r.id, tipo: "OPERACAO_REAGENDAR" } })).toBe(1);
  });
  it("vincula e rateia despesa de entrega sem repetir caixa, protege saldo e permite desvinculação auditada", async () => {
    const categoria = await sim.prisma.categoriaFinanceira.create({ data: { nome: "Entrega fictícia para rateio", grupo: "DESPESAS_VARIAVEIS" } });
    const conta = await sim.prisma.contaBancaria.create({ data: { nome: "Conta despesa fictícia" } });
    const l = await sim.prisma.lancamentoFinanceiro.create({ data: { tipo: "DESPESA", descricao: "Transporte fictício rateado", valor: 50, categoriaId: categoria.id, dataCompetencia: new Date("2026-09-30T15:00:00Z"), dataVencimento: new Date("2026-10-02T15:00:00Z") } });
    const criar = () => sim.prisma.pedidoVenda.create({ data: { chaveCriacao: chave(), hashCriacao: "fixture", criadoPorId: sessao.userId, modoFinanceiro: "HUB", versaoFinanceiro: 1, status: "CONFIRMADO", atendimento: "ENTREGA", custoEntregaEfetivo: 40 } });
    const [a, b] = await Promise.all([criar(), criar()]);
    const qtdLancamentos = await sim.prisma.lancamentoFinanceiro.count();
    const d = { pedidoId: a.id, versao: a.versao, lancamentoId: l.id, revisao: l.updatedAt.toISOString(), valor: "20", motivo: "Rateio real fictício de duas entregas", chave: chave() };
    await expect(vincularDespesaEntrega(d, { ...sessao, versao: 99 })).rejects.toThrow("sessão");
    await Promise.all([vincularDespesaEntrega(d, sessao), vincularDespesaEntrega(d, sessao)]);
    const concorrentes = await Promise.allSettled([vincularDespesaEntrega({ ...d, pedidoId: b.id, versao: b.versao, valor: "40", chave: chave() }, sessao), vincularDespesaEntrega({ ...d, pedidoId: b.id, versao: b.versao, valor: "30", chave: chave() }, sessao)]);
    expect(concorrentes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await sim.prisma.vinculoCustoEntrega.aggregate({ where: { lancamentoId: l.id, desvinculadoEm: null }, _sum: { valor: true } }))._sum.valor?.toString()).toBe("50");
    await expect(salvarCustoEntrega(a.id, 2, null, "10", null, "Redução fictícia sem desfazer vínculo", chave(), sessao)).rejects.toThrow("Desvincule");
    await expect(sim.prisma.$transaction(tx => exigirDespesaSemCustoEntrega(tx, { id: l.id }))).rejects.toThrow("Desvincule");
    await baixarLancamento({ lancamentoId: l.id, contaBancariaId: conta.id, dataPagamento: new Date("2026-10-02T16:00:00Z") });
    expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(qtdLancamentos);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamentoId: l.id } })).toBe(1);
    expect((await buscarDespesasEntrega("Transporte fictício rateado", sessao))[0]).toMatchObject({ disponivel: "0", status: "BAIXADO" });
    const vinculos = await sim.prisma.vinculoCustoEntrega.findMany({ where: { lancamentoId: l.id } });
    for (const v of vinculos) { const k = chave(); await desvincularDespesaEntrega(v.id, "Correção auditada do rateio fictício", k, sessao); await desvincularDespesaEntrega(v.id, "Correção auditada do rateio fictício", k, sessao); }
    await sim.prisma.$transaction(tx => exigirDespesaSemCustoEntrega(tx, { id: l.id }));
    expect(await sim.prisma.vinculoCustoEntrega.count({ where: { lancamentoId: l.id } })).toBe(2);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamentoId: l.id } })).toBe(1);
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: l.id } })).valor.toString()).toBe("50");
  });
  it("produz preparação com consumo real, corrige erro auditado e vende sem consumir ingredientes novamente", async () => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local preparação produzida fictícia" } });
    const ingrediente = await sim.prisma.insumo.create({ data: { nome: "Ingrediente preparação produzida fictícia", unidade: "KG", custoMedio: "12.50" } });
    const prep = await sim.prisma.insumo.create({ data: { nome: "Preparação produzida fictícia", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: "1", rendimentoUnidade: "KG", componentes: { create: { componenteId: ingrediente.id, quantidade: "2" } } } });
    const dados = { preparacaoId: prep.id, revisao: prep.updatedAt.toISOString(), localId: local.id, quantidade: "1", data: "2026-10-02", motivo: "Lote real fictício", ingredientes: [{ insumoId: ingrediente.id, quantidade: "2.000001" }], chave: chave() };
    const financeirosAntes = await sim.prisma.lancamentoFinanceiro.count();
    await registrarMovimentacao({ insumoId: ingrediente.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 10 });
    await expect(registrarProducaoPreparacao({ ...dados, ingredientes: [{ insumoId: ingrediente.id, quantidade: "20" }], chave: chave() }, sessao)).rejects.toThrow("Estoque disponível insuficiente");
    expect(await sim.prisma.producaoPreparacao.count({ where: { preparacaoId: prep.id } })).toBe(0);
    expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: ingrediente.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("10");
    await expect(registrarProducaoPreparacao(dados, { ...sessao, versao: 99 })).rejects.toThrow("sessão");
    const [p1, p2] = await Promise.all([registrarProducaoPreparacao(dados, sessao), registrarProducaoPreparacao(dados, sessao)]);
    expect(p1.id).toBe(p2.id);
    expect(await sim.prisma.movimentacaoEstoque.count({ where: { producaoPreparacaoId: p1.id } })).toBe(2);
    expect(p1.snapshot).toMatchObject({ custoApurado: null, ingredientes: [expect.objectContaining({ custoCadastroObservado: "12.5", quantidadeConsumida: "2.000001" })] });
    const correcao = chave();
    await corrigirProducaoPreparacao(p1.id, "Apontamento duplicado fictício", correcao, sessao);
    await corrigirProducaoPreparacao(p1.id, "Apontamento duplicado fictício", correcao, sessao);
    expect(await sim.prisma.movimentacaoEstoque.count({ where: { producaoPreparacaoId: p1.id } })).toBe(4);
    const producao = await registrarProducaoPreparacao({ ...dados, chave: chave() }, sessao);
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { movimentarEstoque: true, localMovimentarEstoqueId: local.id } } });
      const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Montagem preparação produzida fictícia", unidade: "UN", componentes: { create: { insumoId: prep.id, quantidade: "1", unidade: "KG" } }, preco: "100" } });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: [{ produtoId: produto.id, quantidade: "1", escolhas: {}, precoManual: null }] }, chave(), sessao);
      let p = await confirmarPedido(r.id, 1, chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const saldo = async (id: string) => (await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: id, localId: local.id } } })).quantidadeAtual.toString();
      expect(await saldo(prep.id)).toBe("0"); expect(await saldo(ingrediente.id)).toBe("7.999999");
      await expect(corrigirProducaoPreparacao(producao.id, "Correção após consumo", chave(), sessao)).rejects.toThrow("já foi utilizada");
      expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(financeirosAntes);
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it("apontamento parcial da interface respeita OFF e ON sem consumir etapa anterior retroativamente", async () => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local parcial fictício" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Ingrediente parcial fictício", unidade: "KG" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Montagem parcial fictícia", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: "0.5", unidade: "KG" } }, preco: "100" } });
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { movimentarEstoque: false } } });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao);
      let p = await confirmarPedido(r.id, 1, chave(), sessao);
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      p = await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), sessao);
      p = await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, chave(), sessao);
      expect(await sim.prisma.reservaPedido.count({ where: { itemId: item.id } })).toBe(0);
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { movimentarEstoque: true, localMovimentarEstoqueId: local.id } } });
      const k = chave(), versao = p.versao;
      p = await executarOperacaoInterfacePedido(p.id, versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, k, sessao);
      await executarOperacaoInterfacePedido(p.id, versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, k, sessao);
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("-0.5");
      expect(await sim.prisma.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(1);
      await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "PRONTO" }, chave(), sessao);
      expect(await sim.prisma.movimentacaoEstoque.count({ where: { insumoId: insumo.id } })).toBe(1);
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it("retirada conclui em Pronto sem transporte e reenvio não repete expedição", async () => {
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", pedidosLiberacao: { movimentarEstoque: false } }, update: { pedidosLiberacao: { movimentarEstoque: false } } });
    const r = await criarRascunhoPedido({ ...entrada(), atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, endereco: null, frete: "0" }, chave(), sessao);
    await confirmarPedido(r.id, 1, chave(), sessao);
    let p = await mudarStatusGestorPedido(r.id, 2, "avancar", chave(), sessao);
    p = await mudarStatusGestorPedido(r.id, p.versao, "avancar", chave(), sessao);
    expect(p.statusOperacional).toBe("PRONTO");
    await expect(executarOperacaoPedido(r.id, p.versao, { tipo: "SAIR" }, chave(), sessao)).rejects.toThrow("retirada");
    const op = chave(), versao = p.versao;
    p = await mudarStatusGestorPedido(r.id, versao, "avancar", op, sessao);
    expect(p.statusOperacional).toBe("ENTREGUE");
    await mudarStatusGestorPedido(r.id, versao, "avancar", op, sessao);
    const primeiro = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id } });
    p = await mudarStatusGestorPedido(r.id, p.versao, "voltar", chave(), sessao);
    expect(p.statusOperacional).toBe("PRONTO");
    await mudarStatusGestorPedido(r.id, p.versao, "avancar", chave(), sessao);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id } })).entregueEm).toEqual(primeiro.entregueEm);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: r.id, tipo: "OPERACAO_SAIR" } })).toBe(0);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: r.id, tipo: "OPERACAO_EXPEDIR" } })).toBe(1);
    expect(await sim.prisma.reservaPedido.count({ where: { item: { pedidoId: r.id } } })).toBe(0);
  });

  it("estoque do Gestor inicia OFF e somente ADMIN real salva local/política com versão, auditoria e idempotência", async () => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local explícito da configuração fictícia" } });
    const fora = await sim.prisma.localEstoque.create({ data: { nome: "Local fora do escopo fictício" } });
    const perfil = await sim.prisma.perfilAcesso.create({ data: { nome: "Produção sem admin para configuração fictícia", permissoes: { "vendas.pedidos": ["visualizar"], "vendas.pedidos.producao": ["editar"] } } });
    const user = await sim.prisma.usuario.create({ data: { nome: "Configuração não admin fictícia", email: "toggle-admin-forjado@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const forjada = { ...sessao, userId: user.id, admin: true };
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { ativa: true, locais: [local.id], outraPolitica: { preservar: "literal" } } } });
      expect(await consultarMovimentacaoEstoqueGestorPedidos(forjada)).toEqual({ movimentarEstoque: false, versao: 0, podeAlterar: false, localMovimentarEstoqueId: null, locais: [{ id: local.id, nome: local.nome }] });
      await expect(salvarMovimentacaoEstoqueGestorPedidos(true, 0, chave(), forjada, local.id)).rejects.toThrow("administrador");
      await expect(salvarMovimentacaoEstoqueGestorPedidos(true, 0, chave(), sessao)).rejects.toThrow("Escolha um local");
      await expect(salvarMovimentacaoEstoqueGestorPedidos(true, 0, chave(), sessao, fora.id)).rejects.toThrow("autorizado");
      const k = chave();
      const [a, b] = await Promise.all([1, 2].map(() => salvarMovimentacaoEstoqueGestorPedidos(true, 0, k, sessao, local.id)));
      expect(a).toEqual(b); expect(a).toMatchObject({ movimentarEstoque: true, versao: 1, localMovimentarEstoqueId: local.id });
      expect(await sim.prisma.historicoCadastroVenda.count({ where: { id: `gestor-estoque:${k}` } })).toBe(1);
      expect((await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } })).pedidosLiberacao).toMatchObject({ ativa: true, locais: [local.id], outraPolitica: { preservar: "literal" }, movimentarEstoque: true, versaoMovimentarEstoque: 1 });
      await expect(salvarMovimentacaoEstoqueGestorPedidos(false, 0, k, sessao, local.id)).rejects.toThrow("outros dados");
      await expect(salvarMovimentacaoEstoqueGestorPedidos(false, 0, chave(), sessao, local.id)).rejects.toThrow("outra tela");
      await sim.prisma.localEstoque.update({ where: { id: local.id }, data: { ativo: false } });
      expect((await consultarMovimentacaoEstoqueGestorPedidos(sessao)).locais).toEqual([]);
      await expect(salvarMovimentacaoEstoqueGestorPedidos(true, 1, chave(), sessao, local.id)).rejects.toThrow("ativo");
      expect(await salvarMovimentacaoEstoqueGestorPedidos(false, 1, chave(), sessao, null)).toMatchObject({ movimentarEstoque: false, versao: 2, localMovimentarEstoqueId: null });
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it.each(["EXTERNO", "HUB"])("OFF %s permite etapas sem ficha/reserva e não autoriza operação física manual", async modo => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { movimentarEstoque: false, locais: [] } } });
    try {
      const antes = { estoque: await sim.prisma.movimentacaoEstoque.count(), banco: await sim.prisma.movimentacaoBancaria.count() };
      const dados = { ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, frete: "0", desconto: "0" };
      const r = await criarRascunhoBase(dados, chave(), sessao, modo as "HUB" | "EXTERNO");
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      const financeiro = await sim.prisma.lancamentoFinanceiro.count();
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const preparo = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "OPERACAO_PREPARAR" } });
      expect(preparo.depois).toMatchObject({ validacaoFisica: false, politicaEstoque: { movimentarEstoque: false } });
      if (modo === "EXTERNO") {
        p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
        await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "PRONTO" }, chave(), sessao)).rejects.toThrow("sem reserva");
        p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      }
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      for (let i = 0; i < 3; i++) p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      for (let i = 0; i < 3; i++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      expect(p).toMatchObject({ statusOperacional: "ENTREGUE" });
      expect(await sim.prisma.reservaPedido.count({ where: { item: { pedidoId: p.id } } })).toBe(0);
      expect({ estoque: await sim.prisma.movimentacaoEstoque.count(), banco: await sim.prisma.movimentacaoBancaria.count() }).toEqual(antes);
      expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(financeiro);
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it("ON prepara com baixa Decimal, saldo negativo e reserva alheia preservada; operador da etapa não precisa inventário", async () => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local negativo automático fictício" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Intermediário consumido sem explosão fictício", tipo: "PRODUTO_INTERMEDIARIO", unidade: "KG", rendimentoQuantidade: "1", rendimentoUnidade: "KG", conversoes: { create: { unidade: "G", fator: "0.001" } } } });
    const componente = await sim.prisma.insumo.create({ data: { nome: "Ingrediente não explodido fictício", unidade: "KG" } });
    await sim.prisma.composicaoInsumo.create({ data: { produtoId: insumo.id, componenteId: componente.id, quantidade: "1" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Montagem Decimal do automático fictícia", unidade: "KG", componentes: { create: { insumoId: insumo.id, quantidade: "250", unidade: "G" } }, preco: "100" } });
    const perfil = await sim.prisma.perfilAcesso.create({ data: { nome: "Etapa automática sem inventário fictícia", permissoes: { "vendas.pedidos": ["visualizar"], "vendas.pedidos.producao": ["visualizar", "editar"] } } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Produção automática fictícia", email: "automatico-sem-inventario@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const producao = { ...bloqueado, userId: u.id, nome: u.nome };
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id], movimentarEstoque: true, localMovimentarEstoqueId: local.id } } });
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 1 });
      const criar = async (q: string) => {
        const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, frete: "0", desconto: "0", itens: [{ produtoId: produto.id, quantidade: q, escolhas: {}, precoManual: null }] }, chave(), sessao);
        return confirmarPedido(r.id, r.versao, chave(), sessao);
      };
      const outro = await criar("1");
      const itemOutro = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: outro.id, vigente: true } });
      await executarFisicoPedido(outro.id, outro.versao, { tipo: "RESERVAR", itemId: itemOutro.id, localId: local.id, quantidade: "1" }, chave(), sessao);
      const reservaOutro = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: itemOutro.id } });
      await sim.prisma.saldoEstoque.update({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } }, data: { quantidadeAtual: "0" } });
      await expect(registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_SAIDA", quantidade: 0.01 })).rejects.toThrow("reservada");
      let p = await criar("0.375");
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), producao);
      const v = p.versao, k = chave();
      p = await mudarStatusGestorPedido(p.id, v, "avancar", k, producao);
      expect(p).toMatchObject({ versao: v + 1, statusOperacional: "PRONTO" });
      const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { item: { pedidoId: p.id } } });
      expect([reserva.quantidade.toString(), reserva.reservada.toString(), reserva.consumida.toString()]).toEqual(["0.09375", "0", "0.09375"]);
      const mov = await sim.prisma.movimentacaoEstoque.findFirstOrThrow({ where: { tipo: "SAIDA_CONSUMO", insumoId: insumo.id } });
      expect(mov.quantidade.toString()).toBe("0.09375");
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("-0.09375");
      expect(await sim.prisma.saldoEstoque.count({ where: { insumoId: componente.id } })).toBe(0);
      expect((await sim.prisma.reservaPedido.findUniqueOrThrow({ where: { id: reservaOutro.id } })).reservada.toString()).toBe("0.25");
      const ev = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "FISICO_CONSUMIR" } });
      expect(ev).toMatchObject({ versaoAnterior: v, versaoNova: v + 1, usuarioId: u.id });
      expect(ev.depois).toMatchObject({ origem: "GESTOR_AUTOMATICO", chavePai: k, detalhe: { quantidadeMovimentada: "0.09375", saldoAnterior: "0", saldoNovo: "-0.09375", reservasOutrosPedidos: "0.25", permitirSaldoNegativo: true, custoApurado: null } });
      expect((await mudarStatusGestorPedido(p.id, v, "avancar", k, producao)).versao).toBe(p.versao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), producao);
      expect(await sim.prisma.movimentacaoEstoque.count({ where: { tipo: "SAIDA_CONSUMO", insumoId: insumo.id } })).toBe(1);
      await sim.prisma.perfilAcesso.update({ where: { id: perfil.id }, data: { permissoes: { "vendas.pedidos": ["visualizar"] } } });
      await expect(mudarStatusGestorPedido(p.id, v, "avancar", k, producao)).rejects.toThrow("acesso");
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it("ON só baixa revenda em Em rota, não retroage montagem OFF nem duplica após voltar", async () => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local revenda automático fictício" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Revenda automática sem saldo fictícia", unidade: "UN" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Revenda ON fictícia", tipo: "REVENDA", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: "1", unidade: "UN" } }, preco: "100" } });
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id], movimentarEstoque: false } } });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, frete: "0", desconto: "0", itens: [{ produtoId, quantidade: "2", escolhas: {}, precoManual: null }, { produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao);
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      expect(await sim.prisma.reservaPedido.count({ where: { item: { pedidoId: p.id } } })).toBe(0);
      await salvarMovimentacaoEstoqueGestorPedidos(true, 0, chave(), sessao, local.id);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const reservas = await sim.prisma.reservaPedido.findMany({ where: { item: { pedidoId: p.id } }, include: { item: true } });
      expect(reservas).toHaveLength(1); expect(reservas[0].item.produtoId).toBe(produto.id); expect(reservas[0].consumida.toString()).toBe("2");
      const antes = await sim.prisma.movimentacaoEstoque.count();
      p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      expect(await sim.prisma.movimentacaoEstoque.count()).toBe(antes);
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it("ON preserva local/fotografia e consumo parcial anterior, usando novo local somente para demanda nova", async () => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const locais = await Promise.all(["reserva anterior", "demanda nova"].map(n => sim.prisma.localEstoque.create({ data: { nome: `Local automático ${n} fictício` } })));
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Material parcial automático fictício", unidade: "KG" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Montagem parcial automática fictícia", unidade: "KG", componentes: { create: { insumoId: insumo.id, quantidade: "1", unidade: "KG" } }, preco: "100" } });
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: locais.map(l => l.id), movimentarEstoque: true, localMovimentarEstoqueId: locais[1].id } } });
      await registrarMovimentacao({ insumoId: insumo.id, localId: locais[0].id, tipo: "AJUSTE_ENTRADA", quantidade: 2 });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, frete: "0", desconto: "0", itens: [{ produtoId: produto.id, quantidade: "1", escolhas: {}, precoManual: null }] }, chave(), sessao);
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RESERVAR", itemId: item.id, localId: locais[0].id, quantidade: "0.5" }, chave(), sessao) };
      const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "CONSUMIR", reservaId: reserva.id, quantidade: "0.25", motivo: "Uso prévio fictício" }, chave(), sessao) };
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "0.25" }, chave(), sessao);
      await sim.prisma.componenteProdutoVenda.updateMany({ where: { produtoId: produto.id }, data: { quantidade: "9" } });
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      expect((await sim.prisma.reservaPedido.findUniqueOrThrow({ where: { id: reserva.id } })).consumida.toString()).toBe("0.5");
      const nova = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id, localId: locais[1].id } });
      expect(nova.consumida.toString()).toBe("0.5");
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: locais[1].id } } })).quantidadeAtual.toString()).toBe("-0.5");
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it.each(["0.5", "1"])("ON completa componente liberado %s sem repetir componente já consumido", async (liberada) => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: `Local liberação ${liberada} fictício` } });
    const materiais = await Promise.all(["A", "B"].map(nome => sim.prisma.insumo.create({ data: { nome: `Material ${nome} liberação ${liberada} fictício`, unidade: "KG" } })));
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: `Montagem liberação ${liberada} fictícia`, unidade: "UN", componentes: { create: materiais.map(i => ({ insumoId: i.id, quantidade: "1", unidade: "KG" })) }, preco: "100" } });
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id], movimentarEstoque: true, localMovimentarEstoqueId: local.id } } });
      for (const i of materiais) await registrarMovimentacao({ insumoId: i.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 2 });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, frete: "0", desconto: "0", itens: [{ produtoId: produto.id, quantidade: "1", escolhas: {}, precoManual: null }] }, chave(), sessao);
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "1" }, chave(), sessao) };
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), sessao);
      const reservas = await sim.prisma.reservaPedido.findMany({ where: { itemId: item.id } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "CONSUMIR", reservaId: reservas.find(r => r.insumoId === materiais[0].id)!.id, quantidade: "1", motivo: "Consumo parcial fictício" }, chave(), sessao) };
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "LIBERAR", reservaId: reservas.find(r => r.insumoId === materiais[1].id)!.id, quantidade: liberada, motivo: "Liberação fictícia" }, chave(), sessao) };
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      expect(p).toMatchObject({ statusOperacional: "PRONTO" });
      for (const i of materiais) {
        const movimentos = await sim.prisma.movimentacaoEstoque.findMany({ where: { insumoId: i.id, tipo: "SAIDA_CONSUMO" } });
        expect(movimentos.reduce((s, m) => s.plus(m.quantidade), new Prisma.Decimal(0)).toString()).toBe("1");
        expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: i.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("1");
      }
      expect(await sim.prisma.movimentacaoEstoque.count({ where: { insumoId: materiais[0].id, tipo: "SAIDA_CONSUMO" } })).toBe(1);
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it("montagem preparada OFF e expedida ON não serve de prova física à operação manual", async () => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local alternância fictício" } });
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { movimentarEstoque: false, locais: [] } } });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, frete: "0", desconto: "0", itens: [{ produtoId, quantidade: "1", escolhas: {}, precoManual: null }] }, chave(), sessao);
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      await salvarMovimentacaoEstoqueGestorPedidos(true, 0, chave(), sessao, local.id);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const expedicao = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "OPERACAO_EXPEDIR" } });
      expect(expedicao.depois).toMatchObject({ validacaoFisica: false, politicaEstoque: { movimentarEstoque: true } });
      p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      await expect(executarOperacaoPedido(p.id, p.versao, { tipo: "SAIR" }, chave(), sessao)).rejects.toThrow("sem reserva/execução física");
      expect(await sim.prisma.reservaPedido.count({ where: { item: { pedidoId: p.id } } })).toBe(0);
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });

  it("ON pré-valida lote inteiro, sem inventar ficha/conversão nem gravar efeitos parciais", async () => {
    const anterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local lote automático fictício" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Material lote automático fictício", unidade: "KG" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Primeiro item físico válido fictício", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: "1", unidade: "KG" } }, preco: "100" } });
    try {
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id], movimentarEstoque: true, localMovimentarEstoqueId: local.id } } });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, frete: "0", desconto: "0", itens: [{ produtoId: produto.id, quantidade: "1", escolhas: {}, precoManual: null }, { produtoId, quantidade: "1", escolhas: {}, precoManual: null }] }, chave(), sessao);
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const antes = { movimento: await sim.prisma.movimentacaoEstoque.count(), historico: await sim.prisma.historicoPedidoVenda.count(), reserva: await sim.prisma.reservaPedido.count() };
      await expect(mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao)).rejects.toThrow("Composição/conversão incompleta");
      expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ versao: p.versao, statusOperacional: "EM_PREPARO" });
      expect({ movimento: await sim.prisma.movimentacaoEstoque.count(), historico: await sim.prisma.historicoPedidoVenda.count(), reserva: await sim.prisma.reservaPedido.count() }).toEqual(antes);
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: anterior.pedidosLiberacao === null ? Prisma.DbNull : anterior.pedidosLiberacao } }); }
  });
  async function catalogoAvulso() {
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Insumo porção sintética", unidade: "KG", custoMedio: "10" } });
    const complemento = await sim.prisma.produtoVenda.create({ data: { nome: "Queijo para porções sintéticas", unidade: "KG", classificacoes: ["COMPLEMENTO"], classificacao: "COMPLEMENTO", componentes: { create: { insumoId: insumo.id, quantidade: "1", unidade: "KG" } }, preco: "50" } });
    const grupo = await sim.prisma.grupoComplementoVenda.create({ data: { nome: `Porções opcionais sintéticas ${chave()}`, tipo: "COMPLEMENTAR", minimo: 1, maximo: 2, repetir: false, opcoes: { create: [{ nome: "Porção sintética", produtoId: complemento.id, preco: "7.25", quantidade: "0.3" }, { nome: "Porção sintética", produtoId: complemento.id, preco: "3.20", quantidade: "0.1" }] } }, include: { opcoes: { orderBy: { preco: "desc" } } } });
    const principal = await sim.prisma.produtoVenda.create({ data: { nome: "Kit com opcionais sintéticos", unidade: "UN", grupos: { create: { grupoId: grupo.id, usarPadrao: false, minimo: 0, maximo: 2 } }, preco: "30" } });
    const item = (indice = 0) => ({ produtoId: complemento.id, quantidade: "2", escolhas: {}, precoManual: null, complementoAvulso: { produtoOrigemId: principal.id, grupoId: grupo.id, opcaoId: grupo.opcoes[indice].id } });
    const dados = () => validarEntradaPedido({ ...entrada(), atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, frete: "0", desconto: "0", itens: [item()] });
    return { insumo, complemento, grupo, principal, item, dados };
  }

  it("calcula o mesmo preço em todos os canais, preserva escolha grátis e resolve ingredientes sem produto auxiliar", async () => {
    const c = await catalogoAvulso();
    const comprador = await sim.prisma.clienteVenda.create({ data: { nome: "Comprador sintético das tabelas", tipo: "PF", limiteCreditoAberto: null } });
    await sim.prisma.produtoVenda.update({ where: { id: c.principal.id }, data: { tipo: "PERSONALIZADO" } });
    const opcao = c.grupo.opcoes[0];
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: opcao.id }, data: { usarPrecoPadrao: true } });
    for (const nome of ["SITE", "IFOOD", "OUTRO"]) {
      const canal = await sim.prisma.canalVenda.upsert({ where: { nome }, create: { nome }, update: {} });
      const r = await sim.prisma.$transaction(tx => calcularPedido(tx, { ...c.dados(), canalId: canal.id, clienteId: comprador.id, itens: [{ produtoId: c.principal.id, quantidade: "1", escolhas: { [opcao.id]: 1 }, precoManual: null }] }));
      expect(r.total).toBe("80.00");
      expect(r.itens[0].escolhasSnapshot).toMatchObject([{ preco: "50" }]);
    }
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: opcao.id }, data: { produtoId: null, usarPrecoPadrao: false, preco: "0", quantidade: "40", composicao: [{ insumoId: c.insumo.id, unidade: "KG", quantidade: "0.2" }] } });
    const direto = await sim.prisma.$transaction(tx => calcularPedido(tx, { ...c.dados(), clienteId: comprador.id, itens: [{ produtoId: c.principal.id, quantidade: "1", escolhas: { [opcao.id]: 1 }, precoManual: null }] }));
    expect(direto.itens[0]).toMatchObject({ estadoComposicao: "CONHECIDA", composicaoSnapshot: [{ quantidade: "0.2" }] });
    expect(direto.total).toBe("30.00");
  });
  it("registra complementos dentro do produto com preço/composição específicos e conserva snapshots", async () => {
    const c = await catalogoAvulso();
    const comprador = await sim.prisma.clienteVenda.create({ data: { nome: "Comprador sintético de complementos", tipo: "PF", limiteCreditoAberto: null } });
    await sim.prisma.produtoVenda.update({ where: { id: c.principal.id }, data: { tipo: "PERSONALIZADO" } });
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: c.grupo.opcoes[0].id }, data: { composicao: [{ insumoId: c.insumo.id, unidade: "KG", quantidade: "0.1" }] } });
    await sim.prisma.produtoGrupoVenda.update({ where: { produtoId_grupoId: { produtoId: c.principal.id, grupoId: c.grupo.id } }, data: { ajustesOpcoes: [{ opcaoId: c.grupo.opcoes[0].id, preco: "0", composicao: [{ insumoId: c.insumo.id, unidade: "KG", quantidade: "0.2" }] }] } });
    const dados = { ...c.dados(), clienteId: comprador.id, itens: [{ produtoId: c.principal.id, quantidade: "2", escolhas: { [c.grupo.opcoes[0].id]: 1 }, precoManual: null }] };
    const antes = { titulos: await sim.prisma.lancamentoFinanceiro.count(), movimentos: await sim.prisma.movimentacaoEstoque.count() };
    const r = await criarRascunhoBase(dados, chave(), sessao);
    const p = await confirmarPedido(r.id, r.versao, chave(), sessao);
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
    expect(item.totalLinha.toFixed(2)).toBe("60.00");
    expect(item.escolhasSnapshot).toMatchObject([{ preco: "0", multiplicador: "1", composicao: [{ quantidade: "0.2" }] }]);
    expect(item.composicaoSnapshot).toEqual([{ insumoId: c.insumo.id, nome: c.insumo.nome, unidade: "KG", quantidade: "0.2", origem: c.grupo.opcoes[0].id }]);
    expect(item.estadoComposicao).toBe("CONHECIDA");
    expect((await coberturaComposicaoPedido(sim.prisma, [item])).itens[0]).toMatchObject({ custoEstimado: "4.00", necessidades: [{ insumoId: c.insumo.id, quantidade: "0.4" }] });
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: c.grupo.opcoes[0].id }, data: { preco: "99", quantidade: "9", nome: "Novo padrão futuro" } });
    expect((await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: item.id } })).composicaoSnapshot).toEqual(item.composicaoSnapshot);
    expect({ titulos: await sim.prisma.lancamentoFinanceiro.count(), movimentos: await sim.prisma.movimentacaoEstoque.count() }).toEqual(antes);
    await expect(sim.prisma.$transaction(tx => calcularPedido(tx, { ...c.dados(), itens: [{ produtoId: c.complemento.id, quantidade: "1", escolhas: {}, precoManual: null }] }))).rejects.toThrow("dentro de um produto");
    await expect(sim.prisma.$transaction(tx => calcularPedido(tx, c.dados()))).rejects.toThrow("dentro de um produto");
  });
  it("alias inativo só configura composição própria em COMPOSICAO, sem permitir mercadoria avulsa ou herança inativa", async () => {
    const c = await catalogoAvulso();
    await sim.prisma.produtoVenda.update({ where: { id: c.principal.id }, data: { tipo: "PERSONALIZADO" } });
    await sim.prisma.produtoVenda.update({ where: { id: c.complemento.id }, data: { ativo: false } });
    await sim.prisma.grupoComplementoVenda.update({ where: { id: c.grupo.id }, data: { tipo: "COMPOSICAO", repetir: true } });
    const o = c.grupo.opcoes[0]; await sim.prisma.opcaoComplementoVenda.update({ where: { id: o.id }, data: { composicao: [{ insumoId: c.insumo.id, unidade: "KG", quantidade: "0.2" }] } });
    const dados = { ...c.dados(), itens: [{ produtoId: c.principal.id, quantidade: "1", escolhas: { [o.id]: 2 }, precoManual: null }] };
    const antes = await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: c.complemento.id } });
    const r = await sim.prisma.$transaction(tx => calcularPedido(tx, dados));
    expect(r.itens[0]).toMatchObject({ estadoComposicao: "CONHECIDA", composicaoSnapshot: [{ quantidade: "0.4", origem: o.id }] });
    expect(r.itens[0].escolhasSnapshot).toMatchObject([{ produtoId: c.complemento.id, grupoTipo: "COMPOSICAO", multiplicador: "1", quantidade: 2 }]);
    expect(await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: c.complemento.id } })).toEqual(antes);
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: o.id }, data: { composicao: Prisma.DbNull } });
    await expect(sim.prisma.$transaction(tx => calcularPedido(tx, dados))).rejects.toThrow("Complemento vinculado indisponível");
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: o.id }, data: { composicao: [{ insumoId: c.insumo.id, unidade: "KG", quantidade: "0.2" }] } });
    await sim.prisma.grupoComplementoVenda.update({ where: { id: c.grupo.id }, data: { tipo: "COMPLEMENTAR" } });
    await expect(sim.prisma.$transaction(tx => calcularPedido(tx, dados))).rejects.toThrow("Complemento vinculado indisponível");
    await expect(sim.prisma.$transaction(tx => calcularPedido(tx, { ...c.dados(), itens: [{ produtoId: c.complemento.id, quantidade: "1", escolhas: {}, precoManual: null }] }))).rejects.toThrow();
  });

  it("preserva validação das porções avulsas legadas e recusa novas confirmações avulsas", async () => {
    const c = await catalogoAvulso();
    const calcular = (dados = c.dados()) => sim.prisma.$transaction(tx => calcularPedido(tx, dados, undefined, [{ produtoId: c.complemento.id, quantidade: "2", precoOriginal: "7.25", precoAplicado: "7.25", acrescimos: "0", escolhasSnapshot: [], unidadeSnapshot: "UN", estadoComposicao: "CONHECIDA", composicaoSnapshot: null, produtoSnapshot: { complementoAvulso: c.item().complementoAvulso } }]));
    expect((await calcular()).total).toBe("14.50");
    await expect(calcular({ ...c.dados(), itens: [{ ...c.item(), quantidade: "0.5" }] })).rejects.toThrow("UN exige quantidade inteira");
    await expect(calcular({ ...c.dados(), itens: [{ ...c.item(), produtoId }] })).rejects.toThrow("dentro de um produto");
    await sim.prisma.produtoGrupoVenda.update({ where: { produtoId_grupoId: { produtoId: c.principal.id, grupoId: c.grupo.id } }, data: { usarPadrao: true } });
    await expect(calcular()).rejects.toThrow("Complemento opcional indisponível");
    await sim.prisma.produtoGrupoVenda.update({ where: { produtoId_grupoId: { produtoId: c.principal.id, grupoId: c.grupo.id } }, data: { usarPadrao: false, opcoesExcluidas: [c.grupo.opcoes[0].id] } });
    await expect(calcular()).rejects.toThrow("Complemento opcional indisponível");
    await sim.prisma.produtoGrupoVenda.update({ where: { produtoId_grupoId: { produtoId: c.principal.id, grupoId: c.grupo.id } }, data: { opcoesExcluidas: [], maximo: 0 } });
    await expect(calcular()).rejects.toThrow("Complemento opcional indisponível");
    await sim.prisma.produtoGrupoVenda.update({ where: { produtoId_grupoId: { produtoId: c.principal.id, grupoId: c.grupo.id } }, data: { maximo: 2 } });
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: c.grupo.opcoes[0].id }, data: { ativo: false } });
    await expect(calcular()).rejects.toThrow("Complemento opcional indisponível");
    await sim.prisma.opcaoComplementoVenda.update({ where: { id: c.grupo.opcoes[0].id }, data: { ativo: true } });
    await sim.prisma.produtoVenda.update({ where: { id: c.principal.id }, data: { preco: "0" } });
    await expect(calcular()).rejects.toThrow("Grupo de complementos indisponível");
    await sim.prisma.produtoGrupoVenda.create({ data: { produtoId: c.principal.id, grupoId, usarPadrao: true, minimo: 1, maximo: 1 } });
    expect((await calcular()).total).toBe("14.50");
    const r = await criarRascunhoBase(c.dados(), chave(), sessao);
    await sim.prisma.grupoComplementoVenda.update({ where: { id: c.grupo.id }, data: { ativo: false } });
    const antes = await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: r.id } });
    await expect(confirmarPedido(r.id, r.versao, chave(), sessao)).rejects.toThrow("dentro de um produto");
    expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "RASCUNHO", versao: r.versao });
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: r.id } })).toBe(antes);
    expect(await sim.prisma.itemPedidoVenda.count({ where: { pedidoId: r.id } })).toBe(0);
  });
  it("cancelamento separa material retirado de produto preparado; preparo de outro item não bloqueia retorno do material íntegro", async () => {
    const configAnterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Cancelamento misto fictício" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Material íntegro ou preparado fictício", unidade: "UN" } });
    const produtos = await Promise.all(["A", "B"].map(n => sim.prisma.produtoVenda.create({ data: { nome: `Montagem ${n} para cancelamento`, unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "UN" } }, preco: 100 } })));
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id], movimentarEstoque: true, localMovimentarEstoqueId: local.id } } });
    try {
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 5 });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: produtos.map(p => ({ produtoId: p.id, quantidade: "1", escolhas: {}, precoManual: null })) }, chave(), sessao, "EXTERNO");
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const itens = await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id, vigente: true }, orderBy: { ordem: "asc" } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RESERVAR", itemId: itens[0].id, localId: local.id, quantidade: "1" }, chave(), sessao) };
      const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: itens[0].id } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "CONSUMIR", reservaId: reserva.id, quantidade: "1", motivo: "Retirado, preparo ainda não realizado" }, chave(), sessao) };
      p = await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "PREPARAR", itemId: itens[1].id, quantidade: "1" }, chave(), sessao);
      p = await cancelarPedido(p.id, p.versao, "Cancelamento misto fictício", chave(), sessao);
      const pendencias = await sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
      expect(pendencias).toHaveLength(2);
      const materia = pendencias.find(f => (f.depois as { destinoFisico: { reservaId?: string } }).destinoFisico.reservaId === reserva.id)!;
      const preparado = pendencias.find(f => f.id !== materia.id)!;
      const resolverMateria = { tipo: "RESOLVER" as const, ocorrenciaId: materia.id, recuperavel: "1", perda: "0", motivo: "Material intacto devolvido" };
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, resolverMateria, chave(), sessao)).rejects.toThrow("Materiais");
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RETORNAR", reservaId: reserva.id, quantidade: "1", motivo: "Material intacto não preparado, comprovado pelo operador" }, chave(), sessao) };
      p = await executarOperacaoInterfacePedido(p.id, p.versao, resolverMateria, chave(), sessao);
      const reservaPreparada = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: itens[1].id } });
      await expect(executarFisicoPedido(p.id, p.versao, { tipo: "RETORNAR", reservaId: reservaPreparada.id, quantidade: "1", motivo: "Tentativa de recuperar ingrediente de produto pronto" }, chave(), sessao)).rejects.toThrow("Já houve preparo");
      const movimentos = await sim.prisma.movimentacaoEstoque.count();
      await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: preparado.id, recuperavel: "0", perda: "1", motivo: "Produto preparado descartado pelo operador fictício" }, chave(), sessao);
      expect(await sim.prisma.movimentacaoEstoque.count()).toBe(movimentos);
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("4");
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: configAnterior.pedidosLiberacao ?? Prisma.DbNull } }); }
  });

  it("cancelamento após retorno da entrega conserva saída física real e exige destinação da revenda", async () => {
    const configAnterior = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Retorno e cancelamento sintético" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Revenda sintética já expedida", unidade: "UN" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Revenda para cancelamento após retorno", tipo: "REVENDA", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "UN" } }, preco: 100 } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id], movimentarEstoque: true, localMovimentarEstoqueId: local.id } } });
    try {
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 5 });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao, "EXTERNO");
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      for (let n = 0; n < 4; n++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const entregue = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
      expect(reserva.consumida.toString()).toBe("2");
      const movimentos = await sim.prisma.movimentacaoEstoque.findMany({ where: { insumoId: insumo.id, localId: local.id }, orderBy: { id: "asc" } });
      const saldo = await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } });
      expect(saldo.quantidadeAtual.toString()).toBe("3");
      p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      await expect(executarFisicoPedido(p.id, p.versao, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "1" }, chave(), sessao)).rejects.toThrow("encerrado");
      p = await cancelarPedido(p.id, p.versao, "Cancelamento após retorno de etapa sintético", chave(), sessao);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(entregue.entregueEm);
      expect(await sim.prisma.reservaPedido.findUniqueOrThrow({ where: { id: reserva.id } })).toEqual(reserva);
      expect(await sim.prisma.movimentacaoEstoque.findMany({ where: { insumoId: insumo.id, localId: local.id }, orderBy: { id: "asc" } })).toEqual(movimentos);
      expect(await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).toEqual(saldo);
      const pendencias = await sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
      expect(pendencias).toHaveLength(1);
      expect(pendencias[0].depois).toMatchObject({ destinoFisico: { origem: "CANCELAMENTO", itemId: item.id, quantidade: "2", materiais: [{ reservaId: reserva.id, quantidade: "2" }] } });
      const resolucao = { tipo: "RESOLVER" as const, ocorrenciaId: pendencias[0].id, recuperavel: "0", perda: "2", motivo: "Revenda descartada pelo operador sintético" };
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, resolucao, chave(), sessao)).rejects.toThrow("Materiais");
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "PERDA", reservaId: reserva.id, quantidade: "2", motivo: "Destinação comprovada após cancelamento" }, chave(), sessao) };
      await executarOperacaoInterfacePedido(p.id, p.versao, resolucao, chave(), sessao);
      expect(await sim.prisma.movimentacaoEstoque.findMany({ where: { insumoId: insumo.id, localId: local.id }, orderBy: { id: "asc" } })).toEqual(movimentos);
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("3");
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: configAnterior.pedidosLiberacao ?? Prisma.DbNull } }); }
  });

  it("cancelamento depois de preparo OFF abre destino obrigatório, aceita divisão e não gera estoque ou caixa", async () => {
    const configAnterior = await sim.prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", pedidosLiberacao: { movimentarEstoque: false } }, update: { pedidosLiberacao: { movimentarEstoque: false } } });
    try {
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null }, chave(), sessao, "EXTERNO");
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const estoque = await sim.prisma.movimentacaoEstoque.count(), banco = await sim.prisma.movimentacaoBancaria.count();
      const versaoCancelada = p.versao, k = chave();
      p = await cancelarPedido(p.id, versaoCancelada, "Cancelamento fictício após preparo", k, sessao);
      await cancelarPedido(p.id, versaoCancelada, "Cancelamento fictício após preparo", k, sessao);
      const pendencias = await sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
      expect(pendencias).toHaveLength(1);
      expect(pendencias[0].depois).toMatchObject({ destinoFisico: { quantidade: "2", origem: "CANCELAMENTO", materiais: [] } });
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: pendencias[0].id, motivo: "Texto não substitui destino" }, chave(), sessao)).rejects.toThrow(/Quantidade|quantidade/);
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: pendencias[0].id, recuperavel: "1", perda: "0", motivo: "Destino incompleto" }, chave(), sessao)).rejects.toThrow("fechar exatamente");
      const comando = { tipo: "RESOLVER" as const, ocorrenciaId: pendencias[0].id, recuperavel: "1", perda: "1", motivo: "Uma caixa sob guarda da cozinha, uma descartada pelo operador fictício" };
      const rk = chave();
      const resolucoes = await Promise.all([1, 2].map(() => executarOperacaoInterfacePedido(p.id, p.versao, comando, rk, sessao)));
      expect(resolucoes[0]).toEqual(resolucoes[1]);
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "OPERACAO_RESOLVER" } })).toBe(1);
      expect(await sim.prisma.movimentacaoEstoque.count()).toBe(estoque);
      expect(await sim.prisma.movimentacaoBancaria.count()).toBe(banco);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("CANCELADO");
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, comando, rk, bloqueado)).rejects.toThrow("acesso");
    } finally { if (configAnterior) await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: configAnterior.pedidosLiberacao ?? Prisma.DbNull } }); else await sim.prisma.configuracaoLoja.delete({ where: { id: "singleton" } }); }
  });

  it("devolução parcial de revenda ON exige retorno comprovado e continua tratável após OFF, preservando a entrega", async () => {
    const configAnterior = await sim.prisma.configuracaoLoja.findUnique({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Devolução parcial fictícia" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Revenda para retorno parcial", unidade: "UN" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Revenda devolvida", tipo: "REVENDA", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "UN" } }, preco: 100 } });
    const configuracao = { locais: [local.id], movimentarEstoque: true, localMovimentarEstoqueId: local.id };
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", pedidosLiberacao: configuracao }, update: { pedidosLiberacao: configuracao } });
    try {
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 5 });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao, "EXTERNO");
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      for (let i = 0; i < 4; i++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const entregueEm = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm;
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
      p = await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "OCORRENCIA", natureza: "DEVOLUCAO", itemId: item.id, quantidade: "1", motivo: "Devolução parcial fictícia" }, chave(), sessao);
      const ocorrencia = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
      expect(ocorrencia.depois).toMatchObject({ destinoFisico: { quantidade: "1", materiais: [{ reservaId: reserva.id, quantidade: "1", acumulada: "1" }] } });
      const comando = { tipo: "RESOLVER" as const, ocorrenciaId: ocorrencia.id, recuperavel: "1", perda: "0", motivo: "Unidade íntegra devolvida ao local de origem pelo operador fictício" };
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, comando, chave(), sessao)).rejects.toThrow("Materiais");
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { ...configuracao, movimentarEstoque: false } } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RETORNAR", reservaId: reserva.id, quantidade: "1", motivo: "Retorno físico parcial comprovado" }, chave(), sessao) };
      p = await executarOperacaoInterfacePedido(p.id, p.versao, comando, chave(), sessao);
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("4");
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(entregueEm);
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "OCORRENCIA", natureza: "DEVOLUCAO", itemId: item.id, quantidade: "2", motivo: "Não pode devolver novamente além do executado" }, chave(), sessao)).rejects.toThrow("superior ao executado");
      expect((await sim.prisma.reservaPedido.findUniqueOrThrow({ where: { id: reserva.id } })).consumida.toString()).toBe("2");
    } finally { if (configAnterior) await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: configAnterior.pedidosLiberacao ?? Prisma.DbNull } }); else await sim.prisma.configuracaoLoja.delete({ where: { id: "singleton" } }); }
  });

  it.each([[false, false], [true, true], [false, true], [true, false]])("alterar produção com estoque %s → %s exige cancelamento e novo pedido, preservando execução anterior", async (movimentarEstoque, estoqueDepois) => {
    const config = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: `Cancelamento e nova produção fictícia ${movimentarEstoque}-${estoqueDepois}` } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Ingrediente de revisão", unidade: "UN" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Montagem preservada", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "UN" } }, preco: 100 } });
    const d = { ...entrada(), atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] };
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { movimentarEstoque, locais: [local.id], localMovimentarEstoqueId: local.id } } });
    try {
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 5 });
      const r = await criarRascunhoBase(d, chave(), sessao, "EXTERNO");
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      const alterado = { ...d, itens: [{ ...d.itens[0], itemOrigemId: item.id, quantidade: "1", precoManual: "110.00" }] };
      const antes = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
      const reservas = await sim.prisma.reservaPedido.findMany({ where: { itemId: item.id } });
      await expect(revisarPedido(p.id, p.versao, alterado, chave(), sessao)).rejects.toThrow("cancele o pedido e crie um novo");
      expect(await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).toEqual(antes);
      expect(await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: item.id } })).toEqual(item);
      expect(await sim.prisma.reservaPedido.findMany({ where: { itemId: item.id } })).toEqual(reservas);
      await cancelarPedido(p.id, p.versao, "Cliente solicitou nova composição", chave(), sessao);
      const destino = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
      expect(destino.depois).toMatchObject({ destinoFisico: { origem: "CANCELAMENTO", quantidade: "2" } });
      await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { movimentarEstoque: estoqueDepois, locais: [local.id], localMovimentarEstoqueId: local.id } } });
      const novo = await criarRascunhoBase(alterado, chave(), sessao, "EXTERNO");
      p = await confirmarPedido(novo.id, novo.versao, chave(), sessao);
      expect(p.id).not.toBe(antes.id);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).statusOperacional).toBe("ENTREGUE");
      expect((await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: item.id } })).quantidade.toString()).toBe("2");
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe(String(5 - (movimentarEstoque ? 2 : 0) - (estoqueDepois ? 1 : 0)));
      expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: antes.id, tipo: "OPERACAO_PREPARAR" } })).toBe(1);
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: config.pedidosLiberacao ?? Prisma.DbNull } }); }
  });  it("cancelamento após preparo parcial distingue o produto pronto do material íntegro excedente do mesmo item", async () => {
    const config = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Cancelamento parcial mesmo item" } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Material parcial fictício", unidade: "UN" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Montagem parcial", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "UN" } }, preco: 100 } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id] } } });
    try {
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 5 });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao, "EXTERNO");
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), sessao);
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "2" }, chave(), sessao) };
      const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "CONSUMIR", reservaId: reserva.id, quantidade: "2", motivo: "Material retirado para dois produtos" }, chave(), sessao) };
      p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, chave(), sessao);
      p = await cancelarPedido(p.id, p.versao, "Cancelamento antes do segundo preparo", chave(), sessao);
      const fatos = await sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
      expect(fatos).toHaveLength(2);
      const materia = fatos.find(f => (f.depois as { destinoFisico: { reservaId?: string } }).destinoFisico.reservaId)!;
      expect(materia.depois).toMatchObject({ destinoFisico: { quantidade: "1", reservaId: reserva.id } });
      await expect(executarFisicoPedido(p.id, p.versao, { tipo: "RETORNAR", reservaId: reserva.id, quantidade: "2", motivo: "Não devolver ingrediente preparado" }, chave(), sessao)).rejects.toThrow("Já houve preparo");
      p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RETORNAR", reservaId: reserva.id, quantidade: "1", motivo: "Material íntegro, sem preparo, conferido" }, chave(), sessao) };
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: materia.id, recuperavel: "0", perda: "1", motivo: "Não pode declarar perda de material devolvido" }, chave(), sessao)).rejects.toThrow("Materiais");
      p = await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: materia.id, recuperavel: "1", perda: "0", motivo: "Material íntegro retornado" }, chave(), sessao);
      await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: fatos.find(f => f.id !== materia.id)!.id, recuperavel: "0", perda: "1", motivo: "Produto preparado descartado" }, chave(), sessao);
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("4");
    } finally { await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: config.pedidosLiberacao ?? Prisma.DbNull } }); }
  });
  it.each([false, true])("falha e nova tentativa preservam saídas, primeira entrega e permissões; retorno ao estoque=%s", async devolver => {
    const config = await sim.prisma.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } });
    const local = await sim.prisma.localEstoque.create({ data: { nome: `Nova tentativa fictícia ${devolver}` } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Revenda para nova tentativa", unidade: "UN" } });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Revenda reenviada", tipo: "REVENDA", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "UN" } }, preco: 100 } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { movimentarEstoque: true, locais: [local.id], localMovimentarEstoqueId: local.id } } });
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-31T20:00:00Z"));
    try {
      await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 5 });
      const r = await criarRascunhoBase({ ...entrada(), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }] }, chave(), sessao, "EXTERNO");
      let p = await confirmarPedido(r.id, r.versao, chave(), sessao);
      for (let n = 0; n < 3; n++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
      const bancoAntes = await sim.prisma.movimentacaoBancaria.count(), movimentosAntes = await sim.prisma.movimentacaoEstoque.count();
      const falha = { tipo: "OCORRENCIA" as const, natureza: "FALHA_ENTREGA" as const, motivo: "Destinatário ausente; produtos íntegros sob guarda do operador fictício" };
      const v = p.versao, k = chave();
      p = await executarOperacaoInterfacePedido(p.id, v, falha, k, sessao);
      expect(await executarOperacaoInterfacePedido(p.id, v, falha, k, sessao)).toEqual(p);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).statusOperacional).toBe("PRONTO");
      const ocorrencia = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA" } });
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: ocorrencia.id, motivo: "Não basta apagar a falha" }, chave(), sessao)).rejects.toThrow("nova tentativa");
      await expect(mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao)).rejects.toThrow("pendentes");
      if (devolver) {
        p = await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "OCORRENCIA", natureza: "DEVOLUCAO", itemId: item.id, quantidade: "2", motivo: "Mercadoria retornou ao depósito fictício" }, chave(), sessao);
        const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
        const retorno = await sim.prisma.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "OPERACAO_OCORRENCIA", depois: { path: ["destinoFisico", "origem"], equals: "DEVOLUCAO" } } });
        p = { ...p, ...await executarFisicoPedido(p.id, p.versao, { tipo: "RETORNAR", reservaId: reserva.id, quantidade: "2", motivo: "Conferência íntegra no depósito" }, chave(), sessao) };
        p = await executarOperacaoInterfacePedido(p.id, p.versao, { tipo: "RESOLVER", ocorrenciaId: retorno.id, recuperavel: "2", perda: "0", motivo: "Mercadoria íntegra armazenada" }, chave(), sessao);
        p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      }
      const tentativa = { tipo: "NOVA_TENTATIVA" as const, ocorrenciaId: ocorrencia.id, motivo: "Nova saída real, mercadoria íntegra conferida pelo operador", confirmarIntegralmente: true, conferenciaMaterial: true };
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, { ...tentativa, conferenciaMaterial: false }, chave(), sessao)).rejects.toThrow("integridade");
      const tv = p.versao, tk = chave();
      const paralelo = await Promise.all([1, 2].map(() => executarOperacaoInterfacePedido(p.id, tv, tentativa, tk, sessao)));
      p = paralelo[0]; expect(paralelo[1]).toEqual(p);
      await expect(executarOperacaoInterfacePedido(p.id, tv, tentativa, tk, bloqueado)).rejects.toThrow("acesso");
      expect(await sim.prisma.movimentacaoEstoque.count()).toBe(movimentosAntes + (devolver ? 2 : 0));
      expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("3");
      vi.setSystemTime(new Date("2026-11-01T03:05:00Z"));
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      const primeira = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm;
      expect(primeira).toEqual(new Date("2026-11-01T03:05:00Z"));
      vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
      p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), sessao);
      await expect(executarOperacaoInterfacePedido(p.id, p.versao, falha, chave(), sessao)).rejects.toThrow("ainda não concluída");
      p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), sessao);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(primeira);
      expect(await sim.prisma.movimentacaoBancaria.count()).toBe(bancoAntes);
    } finally { vi.useRealTimers(); await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: config.pedidosLiberacao ?? Prisma.DbNull } }); }
  });
  it("conta clientes e canais de Gestão antes da paginação e sem o próprio filtro", async () => {
    const { consultarGestaoPedidos } = await import("@/lib/vendas/pedidos-gestao");
    const r = await criarRascunhoPedido(entrada(), chave(), sessao);
    await confirmarPedido(r.id, r.versao, chave(), sessao);
    const resultado = await consultarGestaoPedidos({ clienteId, canalId, pagina: 2 });
    expect(resultado.total).toBeGreaterThan(0);
    expect(resultado.contagensClientes[""]).toBeGreaterThanOrEqual(resultado.total);
    expect(resultado.contagensCanais[""]).toBeGreaterThanOrEqual(resultado.total);
    expect(resultado.contagensClientes[clienteId] ?? 0).toBe(resultado.total);
    expect(resultado.contagensCanais[canalId] ?? 0).toBe(resultado.total);
  });
});
