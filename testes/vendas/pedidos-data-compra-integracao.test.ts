import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
import type { PedidoEntrada } from "@/lib/vendas/pedidos-dominio";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
import { confirmarPedido, criarRascunhoPedido, listarPedidos, obterPedido, registrarCapturaCartaoPedido, revisarPedido, salvarRascunhoPedido } from "@/lib/vendas/pedidos";
import { consultarBiVendas, exportarConsultaBiCsv } from "@/lib/vendas/bi-consultas";
import { consultarGestaoPedidos } from "@/lib/vendas/pedidos-gestao";
import { consultarClientesVenda, consultarHistoricoPedidosCliente } from "@/lib/vendas/clientes-consulta";

const schema = `teste_data_compra_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined, criado = false, sessao: SessaoAtual;
let clienteId: string, canalId: string, produtoId: string, cartaoId: string, categoriaId: string;
const chave = () => randomUUID();
const entrada = (dataCompra?: string): PedidoEntrada => ({ ...(dataCompra ? { dataCompra } : {}), clienteId, canalId, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatario: null, endereco: null, observacoes: "Pedido sintético", desconto: "0", frete: "0", itens: [{ produtoId, quantidade: "1", escolhas: {}, precoManual: null }], pagamentoInformado: { formaId: cartaoId, parcelas: 1, vencimentos: [] } });
const novo = (data = "2026-02-01", modo: "HUB" | "EXTERNO" = "HUB") => criarRascunhoPedido(entrada(data), chave(), sessao, modo, modo === "HUB" ? 1 : 0);
const pedido = (id: string) => sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id } });

describe.skipIf(process.env.PEDIDOS_BANCO_TESTE !== "1")("Data da compra em PostgreSQL isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/teste_[a-z0-9_]+$/.test(url.pathname) || process.env.PEDIDOS_AMBIENTE_ISOLADO !== "1") throw new Error("Exige banco sintético local explícito.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true; await banco.query(`SET search_path TO "${schema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) {
      if (pasta.name === "20261020220000_pedidos_data_compra") {
        await banco.query(`INSERT INTO "Usuario" (id,nome,email,"senhaHash","updatedAt") VALUES ('autor-data-legado','Pessoa sintética','data-legado@example.invalid','inutil',now()); INSERT INTO "PedidoVenda" (id,"chaveCriacao","hashCriacao","criadoPorId",status,"createdAt","updatedAt","confirmadoEm",total) VALUES ('pedido-data-legado','data-legado','hash','autor-data-legado','CONFIRMADO','2025-01-02 02:30:00','2025-01-02 02:30:00','2025-01-02 02:30:00',19.90)`);
      }
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS schema`).toEqual([{ schema }]);
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Operador sintético", email: "data-compra@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    sessao = { userId: usuario.id, nome: usuario.nome, versao: 0, admin: true, permissoes: {}, excecoes: {} } as SessaoAtual;
    clienteId = (await sim.prisma.clienteVenda.create({ data: { nome: "Pessoa compradora sintética", tipo: "PF", limiteCreditoAberto: null } })).id;
    categoriaId = (await sim.prisma.categoriaFinanceira.create({ data: { nome: "Receita sintética", grupo: "RECEITA_BRUTA" } })).id;
    canalId = (await sim.prisma.canalVenda.create({ data: { nome: "Canal sintético", categoriaReceitaId: categoriaId } })).id;
    produtoId = (await sim.prisma.produtoVenda.create({ data: { nome: "Produto sintético", unidade: "UN", preco: "100.00" } })).id;
    cartaoId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Cartão sintético", tipo: "CARTAO_CREDITO", prazoDias: 10, inicioPrazo: "VENDA", contagemPrazo: "CORRIDOS" } })).id;
  }, 120000);
  afterAll(async () => {
    vi.useRealTimers(); await sim.prisma?.$disconnect(); if (!banco) return;
    if (criado && /^teste_data_compra_[a-f0-9]{32}$/.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`);
    await banco.end();
  });

  it("migration conserva o pedido anterior sem backfill ou mudança de instantes", async () => {
    const p = await pedido("pedido-data-legado");
    expect(p.dataCompra).toBeNull(); expect(p.createdAt.toISOString()).toBe("2025-01-02T02:30:00.000Z");
    expect(p.confirmadoEm?.toISOString()).toBe("2025-01-02T02:30:00.000Z"); expect(p.total.toFixed(2)).toBe("19.90");
  });
  it("cria hoje no fuso da loja e conserva o mesmo dia no replay após meia-noite", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-01T01:30:00Z"));
      const k = chave(), r = await criarRascunhoPedido(entrada(), k, sessao, "EXTERNO");
      expect((await pedido(r.id)).dataCompra?.toISOString()).toBe("2026-10-31T00:00:00.000Z");
      vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
      expect((await criarRascunhoPedido(entrada(), k, sessao, "EXTERNO")).id).toBe(r.id);
      expect((await pedido(r.id)).dataCompra?.toISOString().slice(0, 10)).toBe("2026-10-31");
    } finally { vi.useRealTimers(); }
  });
  it("edita orçamento manual EXTERNO, preserva data omitida e createdAt real", async () => {
    const r = await novo("2026-03-01", "EXTERNO"), antes = await pedido(r.id);
    const salvo = await salvarRascunhoPedido(r.id, 1, entrada("2026-02-15"), chave(), sessao);
    await salvarRascunhoPedido(r.id, salvo.versao, entrada(), chave(), sessao);
    const p = await pedido(r.id); expect(p.dataCompra?.toISOString().slice(0, 10)).toBe("2026-02-15"); expect(p.createdAt).toEqual(antes.createdAt);
    expect(p.rascunho).toMatchObject({ dataCompra: "2026-02-15" });
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: r.id, tipo: "RASCUNHO_EDITADO" } })).toBe(2);
  });
  it("competência e prazo configurado de cartão usam a compra anterior ao cadastro", async () => {
    const r = await novo(); await confirmarPedido(r.id, 1, chave(), sessao);
    const p = await pedido(r.id), titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: r.id } });
    expect(p.dataCompra?.toISOString().slice(0, 10)).toBe("2026-02-01"); expect(p.createdAt.getTime()).toBeGreaterThan(p.dataCompra!.getTime());
    expect(titulo.dataCompetencia.toISOString().slice(0, 10)).toBe("2026-02-01"); expect(titulo.dataVencimento.toISOString().slice(0, 10)).toBe("2026-02-11");
    expect(titulo.pedidoFormaSnapshot).toMatchObject({ dataCompra: "2026-02-01", prazoDias: 10, inicioPrazo: "VENDA", contagemPrazo: "CORRIDOS" });
    expect(await sim.prisma.pagamentoExternoPedido.count({ where: { pedidoId: r.id } })).toBe(0);
  });
  it("mantém vencimentos explicitamente informados e muda apenas a base da competência", async () => {
    const r = await novo(); await confirmarPedido(r.id, 1, chave(), sessao, { categoriaId, dataCompetencia: "2026-10-20", parcelas: [{ formaPagamentoVendaId: cartaoId, valor: "100", vencimento: "2026-04-20" }] });
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: r.id } });
    expect(titulo.dataCompetencia.toISOString().slice(0, 10)).toBe("2026-02-01"); expect(titulo.dataVencimento.toISOString().slice(0, 10)).toBe("2026-04-20");
  });
  it("base PAGAMENTO só projeta após captura real e conserva previsão explícita", async () => {
    const formaId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Débito sintético", tipo: "CARTAO_DEBITO", prazoDias: 2, inicioPrazo: "PAGAMENTO", contagemPrazo: "CORRIDOS" } })).id;
    const d = { ...entrada("2026-02-01"), pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    for (const explicita of [null, "2026-02-21"]) {
      const r = await criarRascunhoPedido(d, chave(), sessao, "HUB", 1); await confirmarPedido(r.id, 1, chave(), sessao);
      const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: r.id } });
      await registrarCapturaCartaoPedido(r.id, titulo.id, `transacao-${r.id}`, "comprovante-sintetico", "2026-02-10", null, explicita, chave(), sessao);
      const captura = await sim.prisma.pagamentoExternoPedido.findFirstOrThrow({ where: { pedidoId: r.id } });
      expect(captura.confirmadoEm?.toISOString().slice(0, 10)).toBe("2026-02-10"); expect(captura.previsaoRepasse?.toISOString().slice(0, 10)).toBe(explicita ?? "2026-02-12");
    }
  });
  it("recusa redatação de confirmado no serviço e no banco, sem alterar os títulos", async () => {
    const r = await novo(); await confirmarPedido(r.id, 1, chave(), sessao);
    const antes = await pedido(r.id), titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: r.id } });
    await expect(salvarRascunhoPedido(r.id, 2, entrada("2026-01-01"), chave(), sessao)).rejects.toThrow("data da compra");
    await expect(revisarPedido(r.id, 2, entrada("2026-01-01"), chave(), sessao)).rejects.toThrow("cancele o pedido");
    await expect(sim.prisma.pedidoVenda.update({ where: { id: r.id }, data: { dataCompra: new Date("2026-01-01") } })).rejects.toThrow("PEDIDO_DATA_COMPRA_BLOQUEADA");
    expect(await pedido(r.id)).toEqual(antes); expect(await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: r.id } })).toEqual(titulos);
  });
  it("recusa integração externa e calendário inválido antes de gravar", async () => {
    const r = await novo(); await sim.prisma.pedidoVenda.update({ where: { id: r.id }, data: { origem: "INTEGRACAO" } });
    await expect(salvarRascunhoPedido(r.id, 1, entrada("2026-01-01"), chave(), sessao)).rejects.toThrow("orçamento manual");
    await expect(sim.prisma.pedidoVenda.update({ where: { id: r.id }, data: { dataCompra: new Date("2026-01-01") } })).rejects.toThrow("PEDIDO_DATA_COMPRA_BLOQUEADA");
    const quantidade = await sim.prisma.pedidoVenda.count();
    await expect(criarRascunhoPedido(entrada("2026-02-30"), chave(), sessao)).rejects.toThrow("Data da compra");
    expect(await sim.prisma.pedidoVenda.count()).toBe(quantidade);
  });
  it("consulta, BI e CSV usam compra mesmo quando cadastro ocorreu depois do período", async () => {
    const r = await novo("2026-01-12"); await confirmarPedido(r.id, 1, chave(), sessao);
    const filtro = { de: "2026-01-12", ate: "2026-01-12", clienteId };
    expect((await listarPedidos(filtro)).pedidos.map(p => p.id)).toContain(r.id);
    expect((await consultarGestaoPedidos(filtro)).linhas.map(p => p.id)).toContain(r.id);
    expect(await obterPedido(r.id)).toMatchObject({ dataCompra: "2026-01-12" });
    expect((await consultarHistoricoPedidosCliente(clienteId)).pedidos.find(p => p.id === r.id)).toMatchObject({ dataPedido: "2026-01-12", baseDataPedido: "COMPRA" });
    expect((await consultarClientesVenda({ verPedidos: true, verCredito: false })).clientes.find(c => c.id === clienteId)?.resumoPedidos?.ultimoPedido).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const permissoes = { contatos: true, custos: true, exportar: true }, filtros = { ...filtro, cliente: clienteId };
    const bi = await consultarBiVendas(filtros, permissoes);
    expect(bi.pedidos.linhas.map(p => p.id)).toContain(r.id); expect(bi.indicadores.vendas).toBe(100);
    const csv = await exportarConsultaBiCsv(filtros, permissoes); expect(csv).toContain('"2026-01-12"');
    expect((await listarPedidos({ ...filtro, de: "2026-01-13", ate: "2026-01-13" })).pedidos.map(p => p.id)).not.toContain(r.id);
  });
});
