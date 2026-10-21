import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
import type { RegrasPagamentoCliente } from "@/lib/vendas/dominio";

const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/vendas/cnpj", () => ({ consultarCnpjVenda: async () => ({ cadastro: { razaoSocial: "Empresa jurídica fictícia", endereco: { pais: "Brasil", cep: "00000000", logradouro: "Rua fictícia", numero: "1", complemento: "Sala", bairro: "Centro", cidade: "Cidade fictícia", uf: "SP" } } }) }));
import { salvarCliente } from "@/lib/vendas/persistencia";
import { validarClienteCadastro } from "@/lib/vendas/cliente-pedido";
import { ajustarVencimentoPedido, confirmarPedido, criarRascunhoPedido, executarOperacaoPedido, registrarCapturaCartaoPedido, registrarEmissaoBoletoPedido, revisarPedido, type CondicaoFinanceiraPedido } from "@/lib/vendas/pedidos";

const esquema = `teste_clientes_regras_${randomUUID().replaceAll("-", "")}`;
const chave = () => randomUUID();
let banco: Client | undefined, criado = false;
let admin: SessaoAtual, restrito: SessaoAtual;
let canalId: string, produtoId: string, categoriaId: string, pixId: string, boletoId: string, cartaoId: string;
const clienteEntrada = (nome: string) => ({ id: "", versao: 0, nome, tipo: "PF", documento: null, email: `cliente-${chave()}@example.invalid`, telefone: null, contato: null, observacoes: null, enderecos: [{ nome: "Principal", destinatario: "", pais: "Brasil", cep: "00000000", logradouro: "Rua fictícia", numero: "1", complemento: "", bairro: "Centro", cidade: "Cidade fictícia", uf: "SP" }], ativo: true });
const entradaPedido = (clienteId: string, data = "2026-10-10", desconto = "0") => ({ clienteId, canalId, atendimento: "ENTREGA", prazo: "AGENDADO", previsaoData: data, previsaoJanela: "12:00", destinatario: { nome: "Destinatário sintético", contato: "" }, endereco: { pais: "Brasil", cep: "00000000", logradouro: "Rua fictícia", numero: "1", complemento: "", bairro: "Centro", cidade: "Cidade sintética", uf: "SP" }, observacoes: "Teste fictício", desconto, frete: "0", itens: [{ produtoId, quantidade: "1", escolhas: {}, precoManual: null }] });
const condicao = (formaId: string, vencimento = "2026-10-10", valor = "100"): CondicaoFinanceiraPedido => ({ categoriaId, dataCompetencia: "2026-10-01", parcelas: [{ valor, vencimento, formaPagamentoVendaId: formaId }] });
async function novoCliente(regras: Partial<RegrasPagamentoCliente> = {}) {
  return salvarCliente({ ...clienteEntrada(`Cliente sintético ${chave()}`), regrasPagamento: { formasPagamentoIds: null, boletoDiasAposEntrega: null, limiteCreditoAberto: null, ...regras } }, { userId: admin.userId, nome: admin.nome });
}
const rascunho = (clienteId: string) => criarRascunhoPedido(entradaPedido(clienteId), chave(), admin, "HUB");

describe.skipIf(process.env.PEDIDOS_BANCO_TESTE !== "1")("Regras de clientes no PostgreSQL fictício isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/teste_[a-z0-9_]+$/.test(url.pathname) || process.env.PEDIDOS_AMBIENTE_ISOLADO !== "1") throw new Error("Somente base de teste local explícita.");
    banco = new Client({ connectionString: url.toString() });
    await banco.connect(); await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Admin sintético", email: "regras-admin@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const perfilRestrito = await sim.prisma.perfilAcesso.create({ data: { nome: "Perfil sintético restrito", permissoes: { "vendas.pedidos": ["visualizar"] } } });
    const leitor = await sim.prisma.usuario.create({ data: { nome: "Leitor sintético", email: "regras-leitor@example.invalid", senhaHash: "inutil", perfilAcessoId: perfilRestrito.id } });
    const base = { email: "", admin: true, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "" } as SessaoAtual;
    admin = { ...base, userId: usuario.id, nome: usuario.nome }; restrito = { ...base, userId: leitor.id, nome: leitor.nome, admin: false };
    canalId = (await sim.prisma.canalVenda.create({ data: { nome: "Canal sintético" } })).id;
    produtoId = (await sim.prisma.produtoVenda.create({ data: { nome: "Produto fictício", unidade: "UN", preco: "100" } })).id;
    categoriaId = (await sim.prisma.categoriaFinanceira.create({ data: { nome: "Receita fictícia", grupo: "RECEITA_BRUTA" } })).id;
    pixId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Pix fictício", tipo: "PIX" } })).id;
    boletoId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Boleto fictício", tipo: "BOLETO" } })).id;
    cartaoId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Cartão fictício", tipo: "CARTAO_CREDITO" } })).id;
  }, 120000);
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (!banco) return;
    if (criado && /^teste_clientes_regras_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  });

  it("persiste regras, preserva edição legada e impede sobrescrita concorrente", async () => {
    const clienteId = await novoCliente({ formasPagamentoIds: [pixId], boletoDiasAposEntrega: 14, limiteCreditoAberto: "100.01" });
    await salvarCliente({ ...clienteEntrada("Nome revisado sintético"), id: clienteId, versao: 1 }, { userId: admin.userId, nome: admin.nome });
    let cliente = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } });
    expect(cliente.formasPagamentoHabilitadas).toEqual([pixId]); expect(cliente.boletoDiasAposEntrega).toBe(14); expect(cliente.limiteCreditoAberto?.toFixed(2)).toBe("100.01");
    const concorrentes = await Promise.allSettled(["A", "B"].map(nome => salvarCliente({ ...clienteEntrada(`Concorrente sintético ${nome}`), id: clienteId, versao: 2 }, { userId: admin.userId, nome: admin.nome })));
    expect(concorrentes.filter(c => c.status === "fulfilled")).toHaveLength(1);
    cliente = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } });
    expect(cliente.versao).toBe(3); expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: clienteId } })).toBe(3);
  });
  it("preserva o cadastro inline de Pedidos e suas regras na mesma transação", async () => {
    const clienteNovo = { ...clienteEntrada("Cliente Fictício"), primeiroNome: "Cliente", sobrenome: "Fictício", inscricaoEstadual: "ISENTO", dataNascimento: "1990-01-01", telefone: "+5511999999999",
      enderecos: [{ nome: "Cobrança", destinatario: "", pais: "Brasil", cep: "00000000", logradouro: "Rua fictícia", numero: "1", complemento: "Sala 2", bairro: "Centro", cidade: "Cidade fictícia", uf: "SP" }],
      regrasPagamento: { formasPagamentoIds: [pixId], boletoDiasAposEntrega: 14, limiteCreditoAberto: "100" } };
    const pedido = await criarRascunhoPedido({ ...entradaPedido(""), clienteId: null, clienteNovo }, chave(), admin, "HUB");
    expect(pedido.clienteId).toBeTruthy();
    const cliente = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: pedido.clienteId! } });
    expect(cliente).toMatchObject({ primeiroNome: "Cliente", sobrenome: "Fictício", inscricaoEstadual: "ISENTO", formasPagamentoHabilitadas: [pixId] });
    expect(cliente.dataNascimento?.toISOString().slice(0, 10)).toBe("1990-01-01");
    await confirmarPedido(pedido.id, 1, chave(), admin, condicao(pixId));
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: cliente.id } })).toBe(1);
  });
  it("confere forma e prazo no EXTERNO sem gerar efeitos financeiros no HUB", async () => {
    const clienteId = await novoCliente({ formasPagamentoIds: [], boletoDiasAposEntrega: 0, limiteCreditoAberto: "0" });
    const pedido = await criarRascunhoPedido({ ...entradaPedido(clienteId), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null,
      formaPagamentoInformada: "BOLETO", pagamentoInformado: { formaId: boletoId, parcelas: 1, vencimentos: ["2030-01-01"] } }, chave(), admin, "EXTERNO");
    await expect(confirmarPedido(pedido.id, 1, chave(), admin)).rejects.toThrow("não está habilitada");
    await sim.prisma.clienteVenda.update({ where: { id: clienteId }, data: { formasPagamentoHabilitadas: [boletoId] } });
    await expect(confirmarPedido(pedido.id, 1, chave(), admin)).rejects.toThrow("prazo máximo");
    await sim.prisma.clienteVenda.update({ where: { id: clienteId }, data: { boletoDiasAposEntrega: null } });
    await confirmarPedido(pedido.id, 1, chave(), admin);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).status).toBe("CONFIRMADO");
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: pedido.id } })).toBe(0);
  });
  it("persiste nome fantasia e contato composto nos dois fluxos, sem reescrever identidade legada", async () => {
    const pj = { ...clienteEntrada("Fantasia Sintética"), tipo: "PJ" as const, documento: "11222333000181", razaoSocial: "Empresa jurídica fictícia", nomeContato: "Maria Clara", sobrenomeContato: "Fictícia Silva", contato: "Maria Clara Fictícia Silva", telefone: "+5511999990000", enderecos: [{ nome: "Cobrança", destinatario: "", pais: "Brasil", cep: "00000000", logradouro: "Rua fictícia", numero: "1", complemento: "Sala", bairro: "Centro", cidade: "Cidade fictícia", uf: "SP" }] };
    const clienteId = await salvarCliente(validarClienteCadastro(pj), { userId: admin.userId, nome: admin.nome });
    const salvo = await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } });
    expect(salvo).toMatchObject({ nome: pj.nome, nomeContato: "Maria Clara", sobrenomeContato: "Fictícia Silva", primeiroNome: null, sobrenome: null });
    await salvarCliente({ ...clienteEntrada(pj.nome), tipo: "PJ", documento: pj.documento, razaoSocial: pj.razaoSocial, id: clienteId, versao: salvo.versao }, { userId: admin.userId, nome: admin.nome });
    expect(await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: clienteId } })).toMatchObject({ nomeContato: "Maria Clara", sobrenomeContato: "Fictícia Silva" });
    const pedido = await criarRascunhoPedido({ ...entradaPedido(""), prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, clienteId: null, pagamentoInformado: { formaId: pixId, parcelas: 1, vencimentos: [] }, clienteNovo: { ...pj, nome: "Fantasia no Pedido", email: `pedido-${chave()}@example.invalid`, documento: "11444777000161" } }, chave(), admin, "EXTERNO");
    expect(await sim.prisma.clienteVenda.findUniqueOrThrow({ where: { id: pedido.clienteId! } })).toMatchObject({ nome: "Fantasia no Pedido", nomeContato: "Maria Clara", sobrenomeContato: "Fictícia Silva" });
    await confirmarPedido(pedido.id, 1, chave(), admin);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).compradorSnapshot).toMatchObject({ nome: "Fantasia no Pedido", contato: "Maria Clara Fictícia Silva" });
  });
  it("recusa forma desabilitada e confirmação sem condição, sem títulos nem alteração de versão", async () => {
    const clienteId = await novoCliente({ formasPagamentoIds: [pixId] });
    const pedido = await rascunho(clienteId);
    await expect(confirmarPedido(pedido.id, 1, chave(), admin, condicao(boletoId))).rejects.toThrow("não está habilitada");
    await expect(confirmarPedido(pedido.id, 1, chave(), admin)).rejects.toThrow("informações de pagamento");
    await expect(confirmarPedido(pedido.id, 1, chave(), restrito, condicao(pixId))).rejects.toThrow("acesso");
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: pedido.id } })).toBe(0);
    const operacao = chave();
    await confirmarPedido(pedido.id, 1, operacao, admin, condicao(pixId));
    await confirmarPedido(pedido.id, 1, operacao, admin, condicao(pixId));
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: pedido.id } })).toBe(1);
  });
  it("serializa dívida de dois pedidos concorrentes sem ultrapassar o limite total", async () => {
    const clienteId = await novoCliente({ limiteCreditoAberto: "100" });
    const pedidos = await Promise.all([rascunho(clienteId), rascunho(clienteId)]);
    const concorrentes = await Promise.allSettled(pedidos.map(p => confirmarPedido(p.id, 1, chave(), admin, condicao(pixId))));
    expect(concorrentes.filter(c => c.status === "fulfilled")).toHaveLength(1);
    expect(concorrentes.find(c => c.status === "rejected")).toMatchObject({ reason: { message: expect.stringContaining("limite total") } });
    const saldo = await sim.prisma.lancamentoFinanceiro.aggregate({ where: { pedidoVenda: { clienteId }, status: "PENDENTE" }, _sum: { valor: true } });
    expect(saldo._sum.valor?.toFixed(2)).toBe("100.00");
  });
  it("relê regras e autorização alteradas depois da criação do rascunho", async () => {
    const clienteId = await novoCliente({ limiteCreditoAberto: "100" });
    const pedido = await rascunho(clienteId);
    await salvarCliente({ ...clienteEntrada("Regra revisada sintética"), id: clienteId, versao: 1, regrasPagamento: { formasPagamentoIds: null, boletoDiasAposEntrega: null, limiteCreditoAberto: "0" } }, { userId: admin.userId, nome: admin.nome });
    await expect(confirmarPedido(pedido.id, 1, chave(), admin, condicao(pixId))).rejects.toThrow("limite total");
    await salvarCliente({ ...clienteEntrada("Regra revisada sintética"), id: clienteId, versao: 2, regrasPagamento: { formasPagamentoIds: null, boletoDiasAposEntrega: null, limiteCreditoAberto: "100" } }, { userId: admin.userId, nome: admin.nome });
    await sim.prisma.usuario.update({ where: { id: admin.userId }, data: { sessaoVersao: 1 } });
    try { await expect(confirmarPedido(pedido.id, 1, chave(), admin, condicao(pixId))).rejects.toThrow("sessão foi encerrada"); }
    finally { await sim.prisma.usuario.update({ where: { id: admin.userId }, data: { sessaoVersao: 0 } }); }
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: pedido.id } })).toBe(0);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).versao).toBe(1);
    await confirmarPedido(pedido.id, 1, chave(), admin, condicao(pixId));
  });
  it("crédito zero bloqueia nova dívida e revisão de valores preserva a obrigação antiga", async () => {
    const clienteId = await novoCliente({ limiteCreditoAberto: "100" });
    const pedido = await rascunho(clienteId); await confirmarPedido(pedido.id, 1, chave(), admin, condicao(pixId));
    await salvarCliente({ ...clienteEntrada("Limite revisto sintético"), id: clienteId, versao: 1, regrasPagamento: { formasPagamentoIds: null, boletoDiasAposEntrega: null, limiteCreditoAberto: "0" } }, { userId: admin.userId, nome: admin.nome });
    const novo = await rascunho(clienteId);
    await expect(confirmarPedido(novo.id, 1, chave(), admin, condicao(pixId))).rejects.toThrow("limite total");
    await expect(revisarPedido(pedido.id, 2, entradaPedido(clienteId, "2026-10-10", "50"), chave(), admin)).rejects.toThrow("cancele o pedido e crie um novo");
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).versao).toBe(2);
    expect((await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } })).valor.toFixed(2)).toBe("100.00");
  });
  it("revalida prazo na confirmação, ajuste, emissão, revisão e reagendamento", async () => {
    const clienteId = await novoCliente({ boletoDiasAposEntrega: 14 });
    const pedido = await rascunho(clienteId);
    await expect(confirmarPedido(pedido.id, 1, chave(), admin, condicao(boletoId, "2026-10-25"))).rejects.toThrow("prazo máximo");
    await confirmarPedido(pedido.id, 1, chave(), admin, condicao(boletoId, "2026-10-24"));
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    await expect(ajustarVencimentoPedido(pedido.id, titulo.id, "2026-10-25", chave(), admin)).rejects.toThrow("prazo máximo");
    await ajustarVencimentoPedido(pedido.id, titulo.id, "2026-10-24", chave(), admin);
    await expect(registrarEmissaoBoletoPedido(pedido.id, titulo.id, "emissao-invalida", "doc-ficticio", "2026-10-25", "evidencia-ficticia", chave(), admin)).rejects.toThrow("prazo máximo");
    await registrarEmissaoBoletoPedido(pedido.id, titulo.id, "emissao-valida", "doc-ficticio", "2026-10-24", "evidencia-ficticia", chave(), admin);
    await expect(revisarPedido(pedido.id, 2, entradaPedido(clienteId, "2026-10-09"), chave(), admin)).rejects.toThrow("prazo máximo");
    await expect(executarOperacaoPedido(pedido.id, 2, { tipo: "REAGENDAR", data: "2026-10-09", janela: "12:00", motivo: "Antecipação fictícia" }, chave(), admin)).rejects.toThrow("prazo máximo");
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).versao).toBe(2);
    expect(await sim.prisma.pagamentoExternoPedido.count({ where: { pedidoId: pedido.id } })).toBe(1);
  });
  it("captura quitada pelo cliente libera limite mesmo antes do repasse do cartão", async () => {
    const clienteId = await novoCliente({ limiteCreditoAberto: "100" });
    const pedido = await rascunho(clienteId); await confirmarPedido(pedido.id, 1, chave(), admin, condicao(cartaoId));
    const novo = await rascunho(clienteId);
    await expect(confirmarPedido(novo.id, 1, chave(), admin, condicao(pixId))).rejects.toThrow("limite total");
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    await registrarCapturaCartaoPedido(pedido.id, titulo.id, "captura-ficticia", "evidencia-ficticia", "2026-10-10", null, null, chave(), admin);
    await confirmarPedido(novo.id, 1, chave(), admin, condicao(pixId));
    expect(await sim.prisma.repassePagamentoPedido.count({ where: { pagamento: { pedidoId: pedido.id } } })).toBe(0);
  });
});
