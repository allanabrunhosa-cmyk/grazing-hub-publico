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
import { ajustarVencimentoPedido, cancelarPedido, concederCreditoPedido, concluirDevolucaoPedido, confirmarPedido, confirmarPagamentoBoletoPedido, consultarCreditoCliente, criarRascunhoPedido as criarRascunhoBase, liberarCreditoAplicadoPedido, mudarEstadoDevolucaoPedido, registrarCapturaCartaoPedido, registrarEmissaoBoletoPedido, registrarRecebimentoPedido, registrarRepasseCartaoPedido, revisarPedido, solicitarDevolucaoPedido, type CondicaoFinanceiraPedido } from "@/lib/vendas/pedidos";
import { baixarLancamento, estornarBaixaLancamento } from "@/lib/financeiro/baixarLancamento";
import { corrigirRecebimentoPedido, registrarCancelamentoBoletoPedido, registrarEntradaTardiaBoletoPedido } from "@/lib/vendas/pedidos";
import { conciliarExtrato } from "@/lib/financeiro/conciliacao/servico";
import { calcularDre } from "@/lib/financeiro/calcularDre";
import { valoresCompetenciaPedidos } from "@/lib/financeiro/competencia-pedidos";
import { calcularPlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { executarFisicoPedido } from "@/lib/vendas/pedidos-fisico";
import { registrarMovimentacao } from "@/lib/estoque/registrarMovimentacao";
import { consultarGestaoPedidos } from "@/lib/vendas/pedidos-gestao";
import { salvarCanalVenda } from "@/lib/vendas/canais";
import { executarOperacaoPedido, mudarStatusGestorPedido, obterPedido, retomarDevolucaoPedido, concluirDevolucaoContextual, listarPedidos } from "@/lib/vendas/pedidos";

const criarRascunhoPedido = (v: unknown, c: unknown, a: SessaoAtual) => criarRascunhoBase(v, c, a, "HUB");
const esquema = `teste_pedidos_m2_${randomUUID().replaceAll("-", "")}`;
const chave = () => randomUUID();
let banco: Client | undefined;
let criado = false;
let admin: SessaoAtual, restrito: SessaoAtual;
let clienteId: string, canalId: string, produto300: string, produto100: string, categoriaId: string, formaId: string, contaId: string;
let creditoId: string, debitoId: string, boletoId: string, produto400: string, produto450: string, categoriaTaxaId: string, categoriaDevolucaoId: string;
const entrada = (produtoId: string, frete = "0.00") => ({ dataCompra: "2026-09-20", clienteId, canalId, atendimento: "ENTREGA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null,
  destinatario: { nome: "Destinatário sintético", contato: "" }, endereco: { cep: "00000000", logradouro: "Rua sintética", numero: "1", complemento: "", bairro: "", cidade: "Cidade sintética", uf: "SP" }, observacoes: "Teste M2", desconto: "0.00", frete,
  itens: [{ produtoId, quantidade: "1", escolhas: {}, precoManual: null }] });
const condicao = (valores: string[]): CondicaoFinanceiraPedido => ({ categoriaId, dataCompetencia: "2026-09-20", parcelas: valores.map((valor, n) => ({ valor, vencimento: n ? "2026-10-10" : "2026-09-24", formaPagamentoVendaId: formaId })) });
async function novoConfirmado(produtoId: string, valores: string[]) {
  const rascunho = await criarRascunhoPedido(entrada(produtoId), chave(), admin);
  const operacao = chave();
  const confirmado = await confirmarPedido(rascunho.id, 1, operacao, admin, condicao(valores));
  return { ...confirmado, operacao };
}

async function fotografiaComercialFinanceira(pedidoId: string) {
  const [pedido, itens, titulos, movimentos, pagamentos, historico, financeiro, reservas, estoque] = await Promise.all([
    sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId } }),
    sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId }, orderBy: { id: "asc" } }),
    sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedidoId }, orderBy: { id: "asc" } }),
    sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: pedidoId } }, orderBy: { id: "asc" } }),
    sim.prisma.pagamentoExternoPedido.findMany({ where: { pedidoId }, orderBy: { id: "asc" } }),
    sim.prisma.historicoPedidoVenda.findMany({ where: { pedidoId }, orderBy: { id: "asc" } }),
    sim.prisma.historicoFinanceiroPedido.findMany({ where: { pedidoId }, orderBy: { id: "asc" } }),
    sim.prisma.reservaPedido.findMany({ orderBy: { id: "asc" } }),
    sim.prisma.movimentacaoEstoque.findMany({ orderBy: { id: "asc" } }),
  ]);
  return { pedido, itens, titulos, movimentos, pagamentos, historico, financeiro, reservas, estoque };
}

/** A recusa comercial precisa preservar o pedido, dinheiro, execução e auditoria. */
async function recusarRevisaoComercial(pedidoId: string, versao: number, revisao: unknown, operacao = chave()) {
  const antes = await fotografiaComercialFinanceira(pedidoId);
  await expect(revisarPedido(pedidoId, versao, revisao, operacao, admin)).rejects.toThrow("cancele o pedido e crie um novo");
  expect(await fotografiaComercialFinanceira(pedidoId)).toEqual(antes);
}

describe.skipIf(process.env.PEDIDOS_BANCO_TESTE !== "1")("Pedidos M2 financeiro no PostgreSQL isolado", () => {
  beforeAll(async () => {
    config({ quiet: true });
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Somente PostgreSQL local.");
    banco = new Client({ connectionString: url.toString() });
    await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    const pastas = (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const pasta of pastas) await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    expect(await sim.prisma.$queryRaw`SELECT current_schema() AS esquema`).toEqual([{ esquema }]);
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Admin M2 sintético", email: "pedidos-m2-admin@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const perfilRestrito = await sim.prisma.perfilAcesso.create({ data: { nome: "Restrito M2 sintético", permissoes: { "vendas.pedidos": ["visualizar"] } } });
    const leitor = await sim.prisma.usuario.create({ data: { nome: "Leitor M2 sintético", email: "pedidos-m2-leitor@example.invalid", senhaHash: "inutil", perfilAcessoId: perfilRestrito.id } });
    const base = { email: "", admin: true, versao: 0, permissoes: {}, excecoes: {}, perfilNome: "" } as SessaoAtual;
    admin = { ...base, userId: usuario.id, nome: usuario.nome };
    sim.sessao = admin;
    restrito = { ...base, admin: false, userId: leitor.id, nome: leitor.nome };
    clienteId = (await sim.prisma.clienteVenda.create({ data: { nome: "Comprador M2 sintético", tipo: "PF" } })).id;
    const canal = await sim.prisma.canalVenda.create({ data: { nome: "INTERNO" } }); canalId = canal.id;
    produto300 = (await sim.prisma.produtoVenda.create({ data: { nome: "Caixa R$ 300 sintética", unidade: "UN", preco: "300.00" } })).id;
    produto100 = (await sim.prisma.produtoVenda.create({ data: { nome: "Caixa R$ 100 sintética", unidade: "UN", preco: "100.00" } })).id;
    produto400 = (await sim.prisma.produtoVenda.create({ data: { nome: "Caixa R$ 400 sintética", unidade: "UN", preco: "400.00" } })).id;
    produto450 = (await sim.prisma.produtoVenda.create({ data: { nome: "Caixa R$ 450 sintética", unidade: "UN", preco: "450.00" } })).id;
    categoriaId = (await sim.prisma.categoriaFinanceira.create({ data: { nome: "Receita sintética de Pedidos", grupo: "RECEITA_BRUTA" } })).id;
    categoriaTaxaId = (await sim.prisma.categoriaFinanceira.create({ data: { nome: "Taxa sintética de cartão", grupo: "DESPESAS_FINANCEIRAS" } })).id;
    // Pedidos novos usam a categoria de receita do canal.
    await sim.prisma.canalVenda.update({ where: { id: canalId }, data: { categoriaReceitaId: categoriaId } });
    categoriaDevolucaoId = (await sim.prisma.categoriaFinanceira.create({ data: { nome: "Dedução sintética de devolução", grupo: "DEDUCOES_RECEITA" } })).id;
    await sim.prisma.canalVenda.update({ where: { id: canalId }, data: { categoriaDevolucaoId } });
    formaId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Pix sintético sem taxa", tipo: "PIX" } })).id;
    creditoId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Cartão on-line crédito sintético", tipo: "CARTAO_CREDITO", permiteParcelamento: true, maximoParcelas: 4 } })).id;
    debitoId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Cartão on-line débito sintético", tipo: "CARTAO_DEBITO" } })).id;
    boletoId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Boleto sintético", tipo: "BOLETO" } })).id;
    contaId = (await sim.prisma.contaBancaria.create({ data: { nome: "Conta sintética de Pedidos" } })).id;
  }, 120000);
  afterAll(async () => {
    await sim.prisma?.$disconnect(); if (!banco) return;
    if (criado && /^teste_pedidos_m2_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  });

  it("configura origem com auditoria, concorrência e sessão revalidada", async () => {
    const dados = { nome: "Canal fictício longo", categoriaReceitaId: categoriaId, chave: chave() };
    await expect(salvarCanalVenda(dados, restrito)).rejects.toThrow("acesso");
    const r = await salvarCanalVenda(dados, admin);
    expect(await salvarCanalVenda(dados, admin)).toEqual(r);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { registroId: r.id, entidade: "CANAL_VENDA" } })).toBe(1);
    expect((await sim.prisma.canalVenda.findUniqueOrThrow({ where: { id: r.id } })).categoriaReceitaId).toBe(categoriaId);
    await expect(salvarCanalVenda({ ...dados, categoriaReceitaId: categoriaTaxaId, chave: chave() }, admin)).rejects.toThrow("receita bruta");
    await expect(salvarCanalVenda({ nome: dados.nome, chave: chave() } as typeof dados, admin)).rejects.toThrow("Selecione a categoria");
    const atualizacao = { ...dados, nome: "Origem atualizada", id: r.id, versao: 1, chave: chave() };
    const concorrentes = await Promise.allSettled([salvarCanalVenda(atualizacao, admin), salvarCanalVenda({ ...atualizacao, chave: chave() }, admin)]);
    expect(concorrentes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    await expect(salvarCanalVenda({ ...dados, chave: chave() }, { ...admin, versao: 99 })).rejects.toThrow("sessão");
  });

  it("novo corte usa a categoria do canal e a compra civil sem alterar os instantes", async () => {
    const canal = await sim.prisma.canalVenda.create({ data: { nome: "Canal política fictícia" } });
    const dados = { ...entrada(produto300), canalId, pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    const semCategoria = await criarRascunhoBase({ ...dados, canalId: canal.id }, chave(), admin, "HUB", 1);
    await expect(confirmarPedido(semCategoria.id, 1, chave(), admin)).rejects.toThrow("Defina a categoria de receita do canal");
    const novo = await criarRascunhoBase(dados, chave(), admin, "HUB", 1);
    await expect(confirmarPedido(novo.id, 1, chave(), admin, { categoriaId: categoriaTaxaId, dataCompetencia: "", parcelas: [] })).rejects.toThrow("vem do canal");
    const flag = process.env.PEDIDOS_AMBIENTE_ISOLADO;
    delete process.env.PEDIDOS_AMBIENTE_ISOLADO;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T01:30:00Z"));
    try {
      const op = chave();
      await confirmarPedido(novo.id, 1, op, admin);
      await confirmarPedido(novo.id, 1, op, admin);
      const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: novo.id } });
      expect(titulos).toHaveLength(1);
      expect(titulos[0].categoriaId).toBe(categoriaId);
      expect(titulos[0].dataCompetencia.toISOString().slice(0, 10)).toBe(dados.dataCompra);
      expect(titulos[0].valor.toString()).toBe("300");
      const outraReceita = (await sim.prisma.categoriaFinanceira.create({ data: { nome: "Outra receita sintética", grupo: "RECEITA_BRUTA" } })).id;
      await salvarCanalVenda({ id: canalId, versao: 1, nome: "INTERNO RENOMEADO", categoriaReceitaId: outraReceita, chave: chave() }, admin);
      expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulos[0].id } })).categoriaId).toBe(categoriaId);
      await sim.prisma.canalVenda.update({ where: { id: canalId }, data: { categoriaReceitaId: categoriaId } });
      const antigo = await criarRascunhoBase(dados, chave(), admin, "EXTERNO");
      await confirmarPedido(antigo.id, 1, chave(), admin);
      expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: antigo.id } })).toBe(0);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: antigo.id } })).versaoFinanceiro).toBe(0);
      expect(canal.categoriaReceitaId).toBeNull();
    } finally { vi.useRealTimers(); process.env.PEDIDOS_AMBIENTE_ISOLADO = flag; }
  });


  it("recusa troca de canal, embalagem e cobranças sem alterar snapshots, competência ou pagamentos", async () => {
    const canal = await sim.prisma.canalVenda.create({ data: { nome: "REVISADO SINTÉTICO" } });
    const dados = { ...entrada(produto300), pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    const p = await criarRascunhoBase(dados, chave(), admin, "HUB", 1);
    await confirmarPedido(p.id, 1, chave(), admin, { categoriaId, dataCompetencia: "", parcelas: [] });
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id } });
    await registrarRecebimentoPedido(p.id, titulo.id, "90", contaId, "2026-10-02", chave(), admin);
    const antes = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, orderBy: { id: "asc" } });
    const itensAntes = await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id, vigente: true } });
    const bancoAntes = await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: p.id } } });
    const precoAnterior = (await sim.prisma.produtoVenda.findUniqueOrThrow({ where: { id: produto300 } })).preco;
    try {
      await sim.prisma.produtoVenda.update({ where: { id: produto300 }, data: { preco: "450" } });
      const revisao = { ...dados, canalId: canal.id };
      const operacao = chave();
      await recusarRevisaoComercial(p.id, 2, revisao, operacao);
      await recusarRevisaoComercial(p.id, 2, revisao, operacao);
      expect(await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, orderBy: { id: "asc" } })).toEqual(antes);
      expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).total.toString()).toBe("300");
      const itensDepois = await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id, vigente: true } });
      expect(itensDepois.map(i => [i.precoOriginal.toString(), i.precoAplicado.toString(), i.totalLinha.toString(), i.produtoSnapshot])).toEqual(itensAntes.map(i => [i.precoOriginal.toString(), i.precoAplicado.toString(), i.totalLinha.toString(), i.produtoSnapshot]));
      expect(await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: p.id } } })).toEqual(bancoAntes);
      expect(await sim.prisma.historicoFinanceiroPedido.count({ where: { pedidoId: p.id, tipo: "CATEGORIA_REVISADA" } })).toBe(0);
      const embalagem = await sim.prisma.tipoEmbalagemVenda.create({ data: { nome: "Embalagem histórica sintética" } });
      const revisaoEmbalagem = { ...dados, itens: dados.itens.map(i => ({ ...i, tipoEmbalagemId: embalagem.id })) };
      await recusarRevisaoComercial(p.id, 2, revisaoEmbalagem);
      expect(await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: p.id, vigente: true } })).toEqual(itensAntes);
      expect(await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, orderBy: { id: "asc" } })).toEqual(antes);
      await sim.prisma.tipoEmbalagemVenda.update({ where: { id: embalagem.id }, data: { ativo: false } });
      await recusarRevisaoComercial(p.id, 2, { ...dados, itens: dados.itens.map(i => ({ ...i, tipoEmbalagemId: embalagem.id + "-invalida" })) });
      await recusarRevisaoComercial(p.id, 2, { ...dados, outrosCustos: "50" });
      expect((await obterPedido(p.id)).financeiro).toMatchObject({ recebido: "90.00", saldoCliente: "210.00" });
      expect((await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id } })).every(t => t.categoriaId === categoriaId)).toBe(true);
    } finally {
      await sim.prisma.produtoVenda.update({ where: { id: produto300 }, data: { preco: precoAnterior } });
    }
  });

  it("recusa novas alterações de preço e preserva tratamento concorrente de excedente histórico sem apagar caixa", async () => {
    const clienteTeste = await sim.prisma.clienteVenda.create({ data: { nome: "Comprador exclusivo de revisão", tipo: "PF" } });
    const dados = { ...entrada(produto300), clienteId: clienteTeste.id, pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    const p = await criarRascunhoBase(dados, chave(), admin, "HUB", 1);
    await confirmarPedido(p.id, 1, chave(), admin, condicao(["90.00", "100.00", "110.00"]));
    const pago = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id, valor: "90" } });
    await registrarRecebimentoPedido(p.id, pago.id, "90", contaId, "2026-10-02", chave(), admin);
    await recusarRevisaoComercial(p.id, 2, { ...dados, outrosCustos: "50" });
    const saldos = await sim.prisma.lancamentoFinanceiro.aggregate({ where: { pedidoVendaId: p.id, status: "PENDENTE" }, _sum: { valor: true } });
    expect(saldos._sum.valor?.toFixed(2)).toBe("210.00");
    await recusarRevisaoComercial(p.id, 2, { ...dados, desconto: "250" });
    // Fixture de pedido legado já reduzido antes da política cancelar/recriar.
    // Apenas prepara o estado histórico para regredir o pós-venda; não autoriza edição atual.
    await sim.prisma.$transaction([
      sim.prisma.pedidoVenda.update({ where: { id: p.id }, data: { total: "50", desconto: "250" } }),
      sim.prisma.itemPedidoVenda.updateMany({ where: { pedidoId: p.id, vigente: true }, data: { desconto: "250", totalLinha: "50" } }),
      sim.prisma.lancamentoFinanceiro.updateMany({ where: { pedidoVendaId: p.id, status: "PENDENTE" }, data: { status: "CANCELADO" } }),
    ]);
    expect((await obterPedido(p.id))?.financeiro).toMatchObject({ elegivel: "40.00" });
    const tentativas = await Promise.allSettled([solicitarDevolucaoPedido(p.id, "30", "0", "Redução aprovada", "", "", chave(), admin), concederCreditoPedido(p.id, "30", "2026-10-02", "Escolha fictícia", chave(), admin)]);
    expect(tentativas.filter(t => t.status === "fulfilled")).toHaveLength(1);
    expect((await obterPedido(p.id))?.financeiro).toMatchObject({ elegivel: "10.00" });
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, include: { pedidoVenda: { include: { tratamentosFinanceiros: true, movimentosCreditoAplicado: true } } } });
    const valores = valoresCompetenciaPedidos(titulos);
    expect([...valores.values()].reduce((s, v) => s + v, 0)).toBe(50);
    const original = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: pago.id }, include: { movimentacaoBancaria: true } });
    expect(original.valor.toFixed(2)).toBe("90.00"); expect(original.status).toBe("BAIXADO");
    expect(original.movimentacaoBancaria?.valor.toFixed(2)).toBe("90.00");
  });

  it("troca de pagamento exige novo pedido mesmo com forma habilitada e preserva saldo e sinal", async () => {
    const boletoRevisaoId = (await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Boleto parcelado fictício", tipo: "BOLETO", permiteParcelamento: true, maximoParcelas: 2 } })).id;
    const cliente = await sim.prisma.clienteVenda.create({ data: { nome: "Comprador de revisão financeira", tipo: "PF", formasPagamentoHabilitadas: [formaId], limiteCreditoAberto: "300" } });
    const dados = { ...entrada(produto300), clienteId: cliente.id, pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    const p = await criarRascunhoBase(dados, chave(), admin, "HUB", 1); await confirmarPedido(p.id, 1, chave(), admin, { categoriaId, dataCompetencia: "", parcelas: [] });
    const t = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id } });
    await registrarRecebimentoPedido(p.id, t.id, "90", contaId, "2026-10-02", chave(), admin);
    const revisao = { ...dados, pagamentoInformado: { formaId: boletoRevisaoId, parcelas: 2, vencimentos: ["2026-11-10", "2026-12-10"] } };
    await recusarRevisaoComercial(p.id, 2, revisao);
    await sim.prisma.clienteVenda.update({ where: { id: cliente.id }, data: { formasPagamentoHabilitadas: [formaId, boletoRevisaoId] } });
    await recusarRevisaoComercial(p.id, 2, revisao);
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id, status: "PENDENTE" }, orderBy: { dataVencimento: "asc" } });
    expect(titulos.map(t => [t.valor.toFixed(2), t.formaPagamentoVendaId])).toEqual([["210.00", formaId]]);
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: t.id } })).valor.toFixed(2)).toBe("90.00");
    await recusarRevisaoComercial(p.id, 2, { ...revisao, outrosCustos: "100" });
    expect((await obterPedido(p.id)).financeiro).toMatchObject({ saldoCliente: "210.00", recebido: "90.00" });
  });

  it("pedido integralmente pago por crédito recusa cobrança adicional e conserva crédito e caixa", async () => {
    const cliente = await sim.prisma.clienteVenda.create({ data: { nome: "Comprador crédito integral", tipo: "PF" } });
    const dados = { ...entrada(produto300), clienteId: cliente.id, pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    const origem = await criarRascunhoBase(dados, chave(), admin, "HUB", 1); await confirmarPedido(origem.id, 1, chave(), admin, { categoriaId, dataCompetencia: "", parcelas: [] });
    const t = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: origem.id } });
    await registrarRecebimentoPedido(origem.id, t.id, "300", contaId, "2026-10-02", chave(), admin);
    await cancelarPedido(origem.id, 2, "Crédito solicitado", chave(), admin, { destino: "CREDITO", dataEscolha: "2026-10-02", comunicacao: "Escolha fictícia do cliente" });
    const p = await criarRascunhoBase(dados, chave(), admin, "HUB", 1); await confirmarPedido(p.id, 1, chave(), admin, { ...condicao([]), creditoUtilizado: "300" });
    await recusarRevisaoComercial(p.id, 2, { ...dados, outrosCustos: "50" });
    const f = (await obterPedido(p.id)).financeiro; expect(f).toMatchObject({ creditoAplicado: "300.00", saldoCliente: "0.00", recebido: "0.00" });
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.id } } })).toBe(0);
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: p.id, status: "PENDENTE" } })).toBe(0);
  });

  it("cancela boleto somente com evidência e trata entrada tardia sem reabrir venda", async () => {
    const dados = { ...entrada(produto300), pagamentoInformado: { formaId: boletoId, parcelas: 1, vencimentos: ["2026-10-10"] } };
    const p = await criarRascunhoBase(dados, chave(), admin, "HUB", 1); await confirmarPedido(p.id, 1, chave(), admin, { categoriaId, dataCompetencia: "", parcelas: [] });
    const t = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id } });
    await registrarEmissaoBoletoPedido(p.id, t.id, "boleto fictício exclusivo", null, "2026-10-10", "Emissão comprovada fictícia", chave(), admin);
    const boleto = await sim.prisma.pagamentoExternoPedido.findFirstOrThrow({ where: { pedidoId: p.id } });
    await recusarRevisaoComercial(p.id, 2, { ...dados, desconto: "50" });
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: t.id } })).valor.toFixed(2)).toBe("300.00");
    await expect(registrarCancelamentoBoletoPedido(p.id, boleto.id, "", chave(), admin)).rejects.toThrow("Evidência");
    const op = chave(); await registrarCancelamentoBoletoPedido(p.id, boleto.id, "Confirmação fictícia do emissor", op, admin); await registrarCancelamentoBoletoPedido(p.id, boleto.id, "Confirmação fictícia do emissor", op, admin);
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: t.id } })).valor.toFixed(2)).toBe("300.00");
    await cancelarPedido(p.id, 2, "Venda cancelada fictícia", chave(), admin);
    const receber = chave(); await registrarEntradaTardiaBoletoPedido(p.id, boleto.id, contaId, "2026-11-01", "Entrada tardia comprovada fictícia", receber, admin); await registrarEntradaTardiaBoletoPedido(p.id, boleto.id, contaId, "2026-11-01", "Entrada tardia comprovada fictícia", receber, admin);
    expect((await obterPedido(p.id)).financeiro).toMatchObject({ recebido: "300.00", elegivel: "0.00", saldoCliente: "0.00" });
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("CANCELADO");
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.id } } })).toBe(1);
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, include: { pedidoVenda: { include: { tratamentosFinanceiros: true, movimentosCreditoAplicado: true } } } });
    expect([...valoresCompetenciaPedidos(titulos).values()].reduce((s, v) => s + v, 0)).toBe(0);
    await expect(registrarEntradaTardiaBoletoPedido(p.id, boleto.id, contaId, "2026-11-01", "Repetição diversa", chave(), admin)).rejects.toThrow("já registrada");
    const dev = await sim.prisma.tratamentoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "DEVOLUCAO" } }); expect(dev.valor.toFixed(2)).toBe("300.00");
  });

  it("corrige recebimento equivocado com fotografia, concorrência e nova entrada distinta", async () => {
    const dados = { ...entrada(produto300), outrosCustos: "50", pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    const p = await criarRascunhoBase(dados, chave(), admin, "HUB", 1);
    await confirmarPedido(p.id, 1, chave(), admin, { categoriaId, dataCompetencia: "", parcelas: [] });
    const t = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id } });
    await registrarRecebimentoPedido(p.id, t.id, "90", contaId, "2026-10-02", chave(), admin);
    const pago = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: t.id }, include: { movimentacaoBancaria: true } });
    const args = [p.id, t.id, pago.updatedAt.toISOString(), "Conta informada por engano"] as const;
    await expect(corrigirRecebimentoPedido(...args, chave(), restrito)).rejects.toThrow("acesso");
    await expect(corrigirRecebimentoPedido(...args, chave(), { ...admin, versao: 99 })).rejects.toThrow("sessão");
    const op = chave();
    const r = await Promise.allSettled([corrigirRecebimentoPedido(...args, op, admin), corrigirRecebimentoPedido(...args, chave(), admin)]);
    expect(r.filter(v => v.status === "fulfilled")).toHaveLength(1);
    const historico = await sim.prisma.historicoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: p.id, tipo: "RECEBIMENTO_CORRIGIDO" } });
    await corrigirRecebimentoPedido(...args, historico.chaveOperacao, admin);
    expect(historico.detalhes).toMatchObject({ motivo: args[3], devolucaoDinheiro: false, movimentoAnterior: { id: pago.movimentacaoBancaria!.id, valor: "90" } });
    expect((await obterPedido(p.id)).financeiro).toMatchObject({ recebido: "0.00", saldoCliente: "350.00" });
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.id } } })).toBe(0);
    const reaberto = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: t.id } });
    await registrarRecebimentoPedido(p.id, t.id, reaberto.valor.toFixed(2), contaId, "2026-11-01", chave(), admin);
    await expect(corrigirRecebimentoPedido(...args, chave(), admin)).rejects.toThrow("alterado");
    expect(await sim.prisma.historicoFinanceiroPedido.count({ where: { pedidoId: p.id, tipo: "RECEBIMENTO" } })).toBe(2);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.id } } })).toBe(1);
  });

  it("correção não apaga recebimento alocado em devolução", async () => {
    const p = await novoConfirmado(produto300, ["300"]);
    const t = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id } });
    await registrarRecebimentoPedido(p.id, t.id, "300", contaId, "2026-10-02", chave(), admin);
    await cancelarPedido(p.id, 2, "Cancelamento fictício", chave(), admin);
    expect(await sim.prisma.tratamentoFinanceiroPedido.count({ where: { pedidoId: p.id, tipo: "DEVOLUCAO" } })).toBe(1);
    const pago = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: t.id } });
    await expect(corrigirRecebimentoPedido(p.id, t.id, pago.updatedAt.toISOString(), "Correção indevida", chave(), admin)).rejects.toThrow("devolução ou crédito");
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamentoId: t.id } })).toBe(1);
  });

  it("pós-venda permite devolver e converter em crédito preservando primeira entrega e competência", async () => {
    const clienteTeste = await sim.prisma.clienteVenda.create({ data: { nome: "Comprador exclusivo de pós-venda", tipo: "PF" } });
    const dados = { ...entrada(produto300), clienteId: clienteTeste.id, atendimento: "RETIRADA", pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    const p = await criarRascunhoBase(dados, chave(), admin, "HUB", 1);
    await confirmarPedido(p.id, 1, chave(), admin, { categoriaId, dataCompetencia: "", parcelas: [] });
    const t = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id } });
    await registrarRecebimentoPedido(p.id, t.id, "300", contaId, "2026-10-02", chave(), admin);
    await mudarStatusGestorPedido(p.id, 2, "avancar", chave(), admin);
    await mudarStatusGestorPedido(p.id, 3, "avancar", chave(), admin);
    await mudarStatusGestorPedido(p.id, 4, "avancar", chave(), admin);
    const antes = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    const dev = await solicitarDevolucaoPedido(p.id, "90", "0", "Devolução parcial sintética", "", "", chave(), admin);
    expect(dev.reduzVenda).toBe(true);
    await mudarEstadoDevolucaoPedido(p.id, dev.id, "PROCESSANDO", "", chave(), admin);
    await concluirDevolucaoPedido(p.id, dev.id, contaId, "2026-11-01", categoriaDevolucaoId, "2026-11-01", "Comprovante sintético", chave(), admin);
    await concederCreditoPedido(p.id, "60", "2026-10-02", "Escolha sintética", chave(), admin);
    const depois = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(depois.entregueEm).toEqual(antes.entregueEm); expect(depois.status).toBe("CONFIRMADO");
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, include: { pedidoVenda: { include: { tratamentosFinanceiros: true, movimentosCreditoAplicado: true } } } });
    expect([...valoresCompetenciaPedidos(titulos).values()].reduce((s, v) => s + v, 0)).toBe(150);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.id } } })).toBe(2);
  });

  it("gera 90+210 uma vez, recebe e concilia 90, recusando alteração de frete ou itens após confirmação", async () => {
    const pedido = await novoConfirmado(produto300, ["90.00", "210.00"]);
    const repetido = await confirmarPedido(pedido.id, 1, pedido.operacao, admin, condicao(["90.00", "210.00"]));
    expect(repetido.id).toBe(pedido.id);
    let titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedido.id }, orderBy: { valor: "asc" } });
    expect(titulos.map(t => t.valor.toString())).toEqual(["90", "210"]);
    expect(titulos.every(t => t.dataCompetencia.toISOString().slice(0, 10) === "2026-09-20")).toBe(true);
    const importacao = await sim.prisma.importacaoExtrato.create({ data: { contaBancariaId: contaId, nomeArquivo: "sintetico.ofx", hashArquivo: chave(), formato: "OFX", autorId: admin.userId, autorNome: admin.nome } });
    const transacao = await sim.prisma.transacaoExtrato.create({ data: { contaBancariaId: contaId, importacaoId: importacao.id, chave: chave(), impressao: chave(), data: new Date("2026-09-24T00:00:00Z"), descricao: "Entrada sintética", valor: "90.00" } });
    await expect(conciliarExtrato({ transacaoId: transacao.id, lancamentos: [{ id: titulos[0].id, versao: titulos[0].updatedAt.toISOString() }] }, admin)).rejects.toThrow("Registre primeiro o recebimento no Pedido");
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamentoId: titulos[0].id } })).toBe(0);
    const operacaoReceber = chave();
    const recebido = await registrarRecebimentoPedido(pedido.id, titulos[0].id, "90.00", contaId, "2026-09-24", operacaoReceber, admin);
    expect(recebido.recebido).toBe("90.00"); expect(recebido.saldo).toBe("210.00");
    await registrarRecebimentoPedido(pedido.id, titulos[0].id, "90.00", contaId, "2026-09-24", operacaoReceber, admin);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamentoId: titulos[0].id } })).toBe(1);
    await expect(baixarLancamento({ lancamentoId: titulos[1].id, contaBancariaId: contaId })).rejects.toThrow("próprio pedido");
    await expect(estornarBaixaLancamento({ lancamentoId: titulos[0].id })).rejects.toThrow("Pedido");

    titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedido.id }, orderBy: { valor: "asc" } });
    await conciliarExtrato({ transacaoId: transacao.id, lancamentos: [{ id: titulos[0].id, versao: titulos[0].updatedAt.toISOString() }] }, admin);
    const conciliado = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulos[0].id } });
    await expect(corrigirRecebimentoPedido(pedido.id, conciliado.id, conciliado.updatedAt.toISOString(), "Correção fictícia conciliada", chave(), admin)).rejects.toThrow("Desfaça a conciliação");
    expect(await sim.prisma.vinculoExtrato.count({ where: { transacaoId: transacao.id } })).toBe(1);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamentoId: titulos[0].id } })).toBe(1);
    await recusarRevisaoComercial(pedido.id, pedido.versao, entrada(produto300, "50.00"));
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).versao).toBe(pedido.versao);
    const apos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedido.id, status: "PENDENTE" } });
    expect(apos.map(t => t.valor.toString())).toEqual(["210"]);
    await recusarRevisaoComercial(pedido.id, pedido.versao, { ...entrada(produto100), desconto: "20.00" });
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).total.toString()).toBe("300");

    const lancamentos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedido.id }, include: { categoria: true } });
    const paraDre = lancamentos.map(l => ({ valor: Number(l.valor), status: l.status, dataCompetencia: l.dataCompetencia.toISOString(), dataPagamento: l.dataPagamento?.toISOString() ?? null, categoriaId: l.categoriaId, categoriaNome: l.categoria.nome, categoriaGrupo: l.categoria.grupo }));
    const periodo = { de: new Date("2026-09-01T00:00:00Z"), ate: new Date("2026-10-31T23:59:59Z") };
    expect(calcularDre(paraDre, periodo, "COMPETENCIA").faturamentoBruto).toBe(300);
    expect(calcularDre(paraDre, periodo, "CAIXA").faturamentoBruto).toBe(90);
    const fluxo = calcularPlanilhaFluxoCaixa(0, lancamentos.map(l => ({ id: l.id, tipo: l.tipo, status: l.status, valor: Number(l.valor), categoriaId: l.categoriaId, categoriaNome: l.categoria.nome, categoriaGrupo: l.categoria.grupo, dataVencimento: l.dataVencimento.toISOString(), dataPagamento: l.dataPagamento?.toISOString() ?? null, contaBancariaId: l.contaBancariaId })), { de: "2026-09-01", ate: "2026-10-31" });
    expect(fluxo.totalReceitasGeral).toBe(300);
  });

  it("desdobra baixa parcial 40/60 e protege competência, saldo e permissões", async () => {
    const pedido = await novoConfirmado(produto100, ["100.00"]);
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    await expect(registrarRecebimentoPedido(pedido.id, titulo.id, "40.00", contaId, "2026-09-24", chave(), restrito)).rejects.toThrow("acesso");
    await expect(ajustarVencimentoPedido(pedido.id, titulo.id, "2026-10-20", chave(), restrito)).rejects.toThrow("acesso");
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamentoId: titulo.id } })).toBe(0);
    const resumo = await registrarRecebimentoPedido(pedido.id, titulo.id, "40.00", contaId, "2026-09-24", chave(), admin);
    expect(resumo.recebido).toBe("40.00"); expect(resumo.saldo).toBe("60.00");
    const fragmentos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedido.id }, orderBy: { valor: "asc" } });
    expect(fragmentos.map(t => t.valor.toString())).toEqual(["40", "60"]);
    expect(fragmentos.map(t => t.pedidoValorOriginal?.toString())).toEqual(["100", "100"]);
    expect(fragmentos.map(t => t.status)).toEqual(["BAIXADO", "PENDENTE"]);
    expect(fragmentos[0].dataCompetencia.toISOString()).toBe(fragmentos[1].dataCompetencia.toISOString());
    await ajustarVencimentoPedido(pedido.id, fragmentos[1].id, "2026-10-20", chave(), admin);
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: fragmentos[0].id } })).dataVencimento.toISOString()).toBe(fragmentos[0].dataVencimento.toISOString());
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    expect(await sim.prisma.notaFiscalRecebida.count()).toBe(0);
  });

  it("cancela apenas saldo não recebido, sem apagar histórico", async () => {
    const pedido = await novoConfirmado(produto100, ["100.00"]);
    await cancelarPedido(pedido.id, pedido.versao, "Desistência sintética", chave(), admin);
    expect((await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } })).status).toBe("CANCELADO");
    expect(await sim.prisma.historicoFinanceiroPedido.count({ where: { pedidoId: pedido.id } })).toBe(2);
    expect(await sim.prisma.tratamentoFinanceiroPedido.count({ where: { pedidoId: pedido.id } })).toBe(0);
    const cancelados = await listarPedidos({ status: "CANCELADO", ordem: "data-asc" });
    expect(cancelados.pedidos.every(p => p.status === "CANCELADO")).toBe(true);
    const datas = cancelados.pedidos.map(p => p.criadoEm); expect(datas).toEqual([...datas].sort());
    expect((await listarPedidos({ excluirCancelados: true })).pedidos.some(p => p.status === "CANCELADO")).toBe(false);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: pedido.id } } })).toBe(0);
  });

  it("cartão 1x/4x, captura sem nova receita nem caixa e débito sem parcelas", async () => {
    const configurar = (formaPagamentoVendaId: string, parcelasCliente: number): CondicaoFinanceiraPedido => ({ categoriaId, dataCompetencia: "2026-09-20", parcelas: [{ valor: "400.00", vencimento: "2026-09-24", formaPagamentoVendaId, parcelasCliente }] });
    const em1x = await criarRascunhoPedido(entrada(produto400), chave(), admin);
    await confirmarPedido(em1x.id, 1, chave(), admin, configurar(creditoId, 1));
    const em4x = await criarRascunhoPedido(entrada(produto400), chave(), admin);
    await confirmarPedido(em4x.id, 1, chave(), admin, configurar(creditoId, 4));
    const em5x = await criarRascunhoPedido(entrada(produto400), chave(), admin);
    await expect(confirmarPedido(em5x.id, 1, chave(), admin, configurar(creditoId, 5))).rejects.toThrow("Parcelamento");
    const debito = await criarRascunhoPedido(entrada(produto400), chave(), admin);
    await expect(confirmarPedido(debito.id, 1, chave(), admin, configurar(debitoId, 2))).rejects.toThrow("Parcelamento");
    await confirmarPedido(debito.id, 1, chave(), admin, configurar(debitoId, 1));
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: em4x.id } });
    const operacao = chave();
    const resumo = await registrarCapturaCartaoPedido(em4x.id, titulo.id, "captura-sintetica-400", "comprovante-sintetico", "2026-09-24", "12.00", "2026-09-27", operacao, admin);
    expect(resumo.capturado).toBe("400.00"); expect(resumo.saldoCliente).toBe("0.00"); expect(resumo.recebido).toBe("0.00");
    expect(resumo.externos[0]).toMatchObject({ parcelasCliente: 4, taxa: "12.00", valorLiquido: "388.00", repassadoEm: null });
    await registrarCapturaCartaoPedido(em4x.id, titulo.id, "captura-sintetica-400", "comprovante-sintetico", "2026-09-24", "12.00", "2026-09-27", operacao, admin);
    await expect(registrarRecebimentoPedido(em4x.id, titulo.id, "400.00", contaId, "2026-09-24", chave(), admin)).rejects.toThrow("confirmação externa");
    await expect(registrarCapturaCartaoPedido(em1x.id, (await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: em1x.id } })).id, "outra-captura", "evidencia", "2026-09-24", null, null, chave(), restrito)).rejects.toThrow("acesso");
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: em4x.id } })).toBe(1);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: em4x.id } } })).toBe(0);
    const pagamento = await sim.prisma.pagamentoExternoPedido.findFirstOrThrow({ where: { pedidoId: em4x.id } });
    const repasse = await registrarRepasseCartaoPedido(em4x.id, pagamento.id, "400.00", "12.00", contaId, "2026-09-27", categoriaTaxaId, "2026-09-27", "extrato-sintetico-388", chave(), admin);
    expect(repasse.saldoCliente).toBe("0.00"); expect(repasse.repassado).toBe("400.00");
    expect(repasse.repasses).toHaveLength(1); expect(repasse.repasses[0]).toMatchObject({ valorBruto: "400.00", taxa: "12.00", valorLiquido: "388.00" });
    const titulosFinais = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: em4x.id } });
    expect(titulosFinais.filter(t => t.tipo === "RECEITA").map(t => t.valor.toFixed(2))).toEqual(["400.00"]);
    expect(titulosFinais.filter(t => t.tipo === "DESPESA").map(t => t.valor.toFixed(2))).toEqual(["12.00"]);
    const caixa = await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: em4x.id } } });
    expect(caixa.reduce((s, m) => s + (m.tipo === "ENTRADA" ? Number(m.valor) : -Number(m.valor)), 0)).toBe(388);
  });

  it("boleto mantém vencimento externo e interno separados e só baixa com pagamento evidenciado", async () => {
    const rascunho = await criarRascunhoPedido(entrada(produto300), chave(), admin);
    const pedido = await confirmarPedido(rascunho.id, 1, chave(), admin, { categoriaId, dataCompetencia: "2026-09-20", parcelas: [{ valor: "90.00", vencimento: "2026-10-10", formaPagamentoVendaId: boletoId }, { valor: "210.00", vencimento: "2026-11-10", formaPagamentoVendaId: boletoId }] });
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedido.id }, orderBy: { valor: "asc" } });
    const emitido = await registrarEmissaoBoletoPedido(pedido.id, titulos[0].id, "emissor-90", "documento-90", "2026-10-10", "registro-emissao-90", chave(), admin);
    expect(emitido.recebido).toBe("0.00"); expect(emitido.externos[0].status).toBe("EMITIDO");
    await ajustarVencimentoPedido(pedido.id, titulos[0].id, "2026-10-20", chave(), admin);
    const externo = await sim.prisma.pagamentoExternoPedido.findFirstOrThrow({ where: { pedidoId: pedido.id } });
    expect(externo.vencimentoExterno?.toISOString().slice(0, 10)).toBe("2026-10-10");
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulos[1].id } })).dataVencimento.toISOString().slice(0, 10)).toBe("2026-11-10");
    const pago = await confirmarPagamentoBoletoPedido(pedido.id, externo.id, contaId, "2026-10-21", "comprovante-pagamento-90", chave(), admin);
    expect(pago.recebido).toBe("90.00"); expect(pago.externos[0].status).toBe("PAGO");
  });

  it("pagamento tardio de boleto cancelado fica como exceção sem reativar pedido", async () => {
    const rascunho = await criarRascunhoPedido(entrada(produto100), chave(), admin);
    const pedido = await confirmarPedido(rascunho.id, 1, chave(), admin, { categoriaId, dataCompetencia: "2026-09-20", parcelas: [{ valor: "100.00", vencimento: "2026-10-10", formaPagamentoVendaId: boletoId }] });
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    const emitido = await registrarEmissaoBoletoPedido(pedido.id, titulo.id, "boleto-tardio", null, "2026-10-10", "emissao-registrada", chave(), admin);
    await cancelarPedido(pedido.id, pedido.versao, "Cancelamento com boleto emitido", chave(), admin);
    const excecao = await confirmarPagamentoBoletoPedido(pedido.id, emitido.externos[0].id, contaId, "2026-10-11", "pagamento-tardio", chave(), admin);
    expect(excecao.externos[0].status).toBe("EXCECAO_PAGAMENTO_TARDIO");
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).status).toBe("CANCELADO");
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: pedido.id } } })).toBe(0);
  });

  it("reserva só o pago elegível, não conclui pendência e devolve com evidência sem apagar entrada", async () => {
    const pedido = await novoConfirmado(produto300, ["90.00", "210.00"]);
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id, valor: "90.00" } });
    await registrarRecebimentoPedido(pedido.id, titulo.id, "90.00", contaId, "2026-09-24", chave(), admin);
    expect((await obterPedido(pedido.id)).financeiro).toMatchObject({ elegivelCancelamento: "90.00" });
    const cancelamento = chave();
    const antesCancelamento = await fotografiaComercialFinanceira(pedido.id);
    await expect(cancelarPedido(pedido.id, pedido.versao, "Cancelamento sintético", chave(), admin, {}, "")).rejects.toThrow("nome do responsável");
    await expect(cancelarPedido(pedido.id, pedido.versao, "Cancelamento sintético", chave(), restrito, {}, "Administrador informado")).rejects.toThrow("acesso");
    expect(await fotografiaComercialFinanceira(pedido.id)).toEqual(antesCancelamento);
    await cancelarPedido(pedido.id, pedido.versao, "Cancelamento sintético", cancelamento, admin, {}, "Responsável informado sintético");
    await cancelarPedido(pedido.id, pedido.versao, "Cancelamento sintético", cancelamento, admin, {}, "Responsável informado sintético");
    await expect(cancelarPedido(pedido.id, pedido.versao, "Cancelamento sintético", cancelamento, admin, {}, "Outra pessoa sintética")).rejects.toThrow("outros dados");
    const registroCancelamento = await sim.prisma.historicoPedidoVenda.findUniqueOrThrow({ where: { chaveOperacao: cancelamento } });
    expect(registroCancelamento).toMatchObject({ usuarioId: admin.userId, usuarioNome: admin.nome, tipo: "CANCELADO" });
    expect(registroCancelamento.depois).toMatchObject({ responsavelInformado: "Responsável informado sintético" });
    await expect(solicitarDevolucaoPedido(pedido.id, "100.00", "0.00", "", "", "", chave(), admin)).rejects.toThrow("excedem");
    await expect(solicitarDevolucaoPedido(pedido.id, "90.00", "0.00", "", "", "", chave(), restrito)).rejects.toThrow("acesso");
    const tratamento = await sim.prisma.tratamentoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: pedido.id, tipo: "DEVOLUCAO" } });
    expect(await sim.prisma.tratamentoFinanceiroPedido.count({ where: { pedidoId: pedido.id } })).toBe(1);
    expect(tratamento.status).toBe("SOLICITADA");
    await expect(solicitarDevolucaoPedido(pedido.id, "1.00", "0.00", "", "", "", chave(), admin)).rejects.toThrow("excedem");
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: pedido.id } } })).toBe(1);
    await mudarEstadoDevolucaoPedido(pedido.id, tratamento.id, "PROCESSANDO", "", chave(), admin);
    const concluida = await concluirDevolucaoPedido(pedido.id, tratamento.id, contaId, "2026-09-25", categoriaDevolucaoId, "2026-09-25", "comprovante-devolucao-90", chave(), admin);
    expect(concluida.status).toBe("CONCLUIDA");
    const movimentos = await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: pedido.id } } });
    expect(movimentos.map(m => [m.tipo, m.valor.toFixed(2)])).toEqual(expect.arrayContaining([["ENTRADA", "90.00"], ["SAIDA", "90.00"]]));
  });

  it("devolução parcial preserva R$ 300 recebido e registra R$ 240 devolvido e R$ 60 retido", async () => {
    const pedido = await novoConfirmado(produto300, ["300.00"]);
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    await registrarRecebimentoPedido(pedido.id, titulo.id, "300.00", contaId, "2026-09-24", chave(), admin);
    await expect(cancelarPedido(pedido.id, pedido.versao, "Cancelamento parcial sintético", chave(), admin, { reter: "60" })).rejects.toThrow("Retenção");
    expect((await obterPedido(pedido.id)).status).toBe("CONFIRMADO");
    await cancelarPedido(pedido.id, pedido.versao, "Prejuízo sintético", chave(), admin, { reter: "60", politica: "Política comunicada sintética", comunicacao: "Conversa sintética" });
    const tratamento = await sim.prisma.tratamentoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: pedido.id, tipo: "DEVOLUCAO" } });
    expect(tratamento.status).toBe("SOLICITADA");
    await mudarEstadoDevolucaoPedido(pedido.id, tratamento.id, "PROCESSANDO", "", chave(), admin);
    await expect(concluirDevolucaoPedido(pedido.id, tratamento.id, contaId, "2026-09-25", categoriaDevolucaoId, "2026-09-25", "evidencia", chave(), restrito)).rejects.toThrow("acesso");
    await concluirDevolucaoPedido(pedido.id, tratamento.id, contaId, "2026-09-25", categoriaDevolucaoId, "2026-09-25", "comprovante-devolucao-240", chave(), admin);
    expect((await sim.prisma.tratamentoFinanceiroPedido.findUniqueOrThrow({ where: { id: tratamento.id } })).retido.toFixed(2)).toBe("60.00");
    const movimentos = await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: pedido.id } } });
    expect(movimentos.map(m => [m.tipo, m.valor.toFixed(2)])).toEqual(expect.arrayContaining([["ENTRADA", "300.00"], ["SAIDA", "240.00"]]));
  });

  it("devolve integralmente R$ 300 pagos sem duplicar nem apagar a entrada", async () => {
    const pedido = await novoConfirmado(produto300, ["300.00"]);
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    await registrarRecebimentoPedido(pedido.id, titulo.id, "300.00", contaId, "2026-09-24", chave(), admin);
    await cancelarPedido(pedido.id, pedido.versao, "Cancelamento integral sintético", chave(), admin);
    const tratamento = await sim.prisma.tratamentoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: pedido.id, tipo: "DEVOLUCAO" } });
    await mudarEstadoDevolucaoPedido(pedido.id, tratamento.id, "PROCESSANDO", "", chave(), admin);
    await mudarEstadoDevolucaoPedido(pedido.id, tratamento.id, "FALHA", "Falha externa comprovada", chave(), admin);
    const recuperar = chave();
    await retomarDevolucaoPedido(pedido.id, tratamento.id, recuperar, admin);
    await retomarDevolucaoPedido(pedido.id, tratamento.id, recuperar, admin);
    expect(await sim.prisma.tratamentoFinanceiroPedido.count({ where: { pedidoId: pedido.id } })).toBe(1);
    await mudarEstadoDevolucaoPedido(pedido.id, tratamento.id, "PROCESSANDO", "", chave(), admin);
    const operacao = chave();
    await concluirDevolucaoContextual(pedido.id, tratamento.id, contaId, "2026-09-25", "comprovante-300", operacao, admin);
    await concluirDevolucaoContextual(pedido.id, tratamento.id, contaId, "2026-09-25", "comprovante-300", operacao, admin);
    const movimentos = await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: pedido.id } } });
    expect(movimentos.map(m => [m.tipo, m.valor.toFixed(2)])).toEqual(expect.arrayContaining([["ENTRADA", "300.00"], ["SAIDA", "300.00"]]));
    expect(movimentos).toHaveLength(2);
  });

  it("converte R$ 300 pagos em crédito, aplica R$ 300 em pedido de R$ 450 e recebe só R$ 150", async () => {
    const origem = await novoConfirmado(produto300, ["300.00"]);
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: origem.id } });
    await registrarRecebimentoPedido(origem.id, titulo.id, "300.00", contaId, "2026-09-24", chave(), admin);
    const operacao = chave();
    await cancelarPedido(origem.id, origem.versao, "Cancelamento com opção por crédito", operacao, admin, { destino: "CREDITO", dataEscolha: "2026-09-24", comunicacao: "escolha-sintetica" });
    const antes = await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: origem.id } } });
    await expect(concederCreditoPedido(origem.id, "300.00", "2026-09-24", "escolha-sintetica", chave(), restrito)).rejects.toThrow("acesso");
    await cancelarPedido(origem.id, origem.versao, "Cancelamento com opção por crédito", operacao, admin, { destino: "CREDITO", dataEscolha: "2026-09-24", comunicacao: "escolha-sintetica" });
    expect(await sim.prisma.tratamentoFinanceiroPedido.count({ where: { pedidoId: origem.id, tipo: "CREDITO" } })).toBe(1);
    expect((await consultarCreditoCliente(clienteId)).saldo).toBe("300.00");
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: origem.id } } })).toBe(antes);
    await expect(solicitarDevolucaoPedido(origem.id, "1.00", "0.00", "", "", "", chave(), admin)).rejects.toThrow("excedem");
    const novo = await criarRascunhoPedido(entrada(produto450), chave(), admin);
    const confirmado = await confirmarPedido(novo.id, 1, chave(), admin, { categoriaId, dataCompetencia: "2026-09-24", creditoUtilizado: "300.00", parcelas: [{ valor: "150.00", vencimento: "2026-09-24", formaPagamentoVendaId: formaId }] });
    expect((await consultarCreditoCliente(clienteId)).saldo).toBe("0.00");
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: confirmado.id, tipo: "RECEITA" } });
    expect(titulos.map(t => [t.valor.toFixed(2), t.pedidoQuitadoCredito])).toEqual(expect.arrayContaining([["300.00", true], ["150.00", false]]));
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: confirmado.id } } })).toBe(0);
    await registrarRecebimentoPedido(confirmado.id, titulos.find(t => !t.pedidoQuitadoCredito)!.id, "150.00", contaId, "2026-09-24", chave(), admin);
    const movimentos = await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: confirmado.id } } });
    expect(movimentos.map(m => m.valor.toFixed(2))).toEqual(["150.00"]);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: confirmado.id } })).total.toFixed(2)).toBe("450.00");
    const paraDre = (await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: confirmado.id }, include: { categoria: true } })).map(l => ({ valor: Number(l.valor), status: l.status, dataCompetencia: l.dataCompetencia.toISOString(), dataPagamento: l.dataPagamento?.toISOString() ?? null, pedidoQuitadoCredito: l.pedidoQuitadoCredito, categoriaId: l.categoriaId, categoriaNome: l.categoria.nome, categoriaGrupo: l.categoria.grupo }));
    const periodo = { de: new Date("2026-09-01T00:00:00Z"), ate: new Date("2026-09-30T23:59:59Z") };
    expect(calcularDre(paraDre, periodo, "COMPETENCIA").faturamentoBruto).toBe(450);
    expect(calcularDre(paraDre, periodo, "CAIXA").faturamentoBruto).toBe(150);
    const fluxo = calcularPlanilhaFluxoCaixa(0, paraDre.map((l, i) => ({ ...l, id: String(i), tipo: "RECEITA" as const, dataVencimento: "2026-09-24", contaBancariaId: contaId })), { de: "2026-09-24", ate: "2026-09-24" });
    expect(fluxo.totalReceitasPorDia["2026-09-24"]).toBe(150);
  });

  it("restaura crédito após retorno da entrega sem gasto duplo, caixa ou rejeição de chave interna numérica", async () => {
    const origem = await novoConfirmado(produto300, ["300.00"]);
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: origem.id } });
    await registrarRecebimentoPedido(origem.id, titulo.id, "300.00", contaId, "2026-09-24", chave(), admin);
    await cancelarPedido(origem.id, origem.versao, "Cancelamento sintético", chave(), admin, { destino: "CREDITO", dataEscolha: "2026-09-24", comunicacao: "escolha-2" });
    const novo = await criarRascunhoPedido(entrada(produto300), chave(), admin);
    let confirmado = await confirmarPedido(novo.id, 1, chave(), admin, { categoriaId, dataCompetencia: "2026-09-24", creditoUtilizado: "200.00", parcelas: [{ valor: "100.00", vencimento: "2026-09-24", formaPagamentoVendaId: formaId }] });
    expect((await consultarCreditoCliente(clienteId)).saldo).toBe("100.00");
    const disputa = await criarRascunhoPedido(entrada(produto300), chave(), admin);
    await expect(confirmarPedido(disputa.id, 1, chave(), admin, { categoriaId, dataCompetencia: "2026-09-24", creditoUtilizado: "200.00", parcelas: [{ valor: "100.00", vencimento: "2026-09-24", formaPagamentoVendaId: formaId }] })).rejects.toThrow("Crédito disponível");
    for (let n = 0; n < 4; n++) confirmado = await mudarStatusGestorPedido(confirmado.id, confirmado.versao, "avancar", chave(), admin);
    const primeiraEntrega = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: confirmado.id } })).entregueEm;
    expect(primeiraEntrega).not.toBeNull();
    confirmado = await mudarStatusGestorPedido(confirmado.id, confirmado.versao, "voltar", chave(), admin);
    // Chave técnica válida que a referência antiga confundia com números de cartão.
    const cancelarCredito = "12345678-9012-3456-7890-123456789012";
    await cancelarPedido(confirmado.id, confirmado.versao, "Cancelar pedido com crédito", cancelarCredito, admin);
    await cancelarPedido(confirmado.id, confirmado.versao, "Cancelar pedido com crédito", cancelarCredito, admin);
    expect((await consultarCreditoCliente(clienteId)).saldo).toBe("300.00");
    expect((await obterPedido(confirmado.id)).financeiro).toMatchObject({ creditoAplicado: "200.00", creditoRestauravel: "0.00", creditoRestaurado: "200.00" });
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: confirmado.id } })).entregueEm).toEqual(primeiraEntrega);
    expect(await sim.prisma.creditoClienteMovimento.count({ where: { pedidoAplicacaoId: confirmado.id, tipo: "LIBERACAO" } })).toBe(1);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: confirmado.id } } })).toBe(0);
    await expect(liberarCreditoAplicadoPedido(confirmado.id, "1.00", "Excedente", "decisao-sintetica-2", chave(), admin)).rejects.toThrow("excede");
  });

  it("revalida saldo na confirmação concorrente e aceita pedido integralmente quitado com crédito", async () => {
    const clienteConcorrente = (await sim.prisma.clienteVenda.create({ data: { nome: "Comprador concorrente sintético" } })).id;
    const origemRascunho = await criarRascunhoPedido({ ...entrada(produto300), clienteId: clienteConcorrente }, chave(), admin);
    const origem = await confirmarPedido(origemRascunho.id, 1, chave(), admin, condicao(["300.00"]));
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: origem.id } });
    await registrarRecebimentoPedido(origem.id, titulo.id, "300.00", contaId, "2026-09-24", chave(), admin);
    await cancelarPedido(origem.id, origem.versao, "Crédito de teste concorrente", chave(), admin, { destino: "CREDITO", dataEscolha: "2026-09-24", comunicacao: "escolha-concorrente" });
    const [rascunhoA, rascunhoB] = await Promise.all([criarRascunhoPedido({ ...entrada(produto300), clienteId: clienteConcorrente }, chave(), admin), criarRascunhoPedido({ ...entrada(produto300), clienteId: clienteConcorrente }, chave(), admin)]);
    const usando200: CondicaoFinanceiraPedido = { categoriaId, dataCompetencia: "2026-09-24", creditoUtilizado: "200.00", parcelas: [{ valor: "100.00", vencimento: "2026-09-24", formaPagamentoVendaId: formaId }] };
    const disputas = await Promise.allSettled([confirmarPedido(rascunhoA.id, 1, chave(), admin, usando200), confirmarPedido(rascunhoB.id, 1, chave(), admin, usando200)]);
    expect(disputas.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(disputas.filter(r => r.status === "rejected")).toHaveLength(1);
    expect((await consultarCreditoCliente(clienteConcorrente)).saldo).toBe("100.00");
    const totalmenteCredito = await criarRascunhoPedido({ ...entrada(produto100), clienteId: clienteConcorrente }, chave(), admin);
    const confirmado = await confirmarPedido(totalmenteCredito.id, 1, chave(), admin, { categoriaId, dataCompetencia: "2026-09-24", creditoUtilizado: "100.00", parcelas: [] });
    expect((await consultarCreditoCliente(clienteConcorrente)).saldo).toBe("0.00");
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: confirmado.id } } })).toBe(0);
    expect((await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: confirmado.id } })).pedidoQuitadoCredito).toBe(true);
  });

  it("agenda, sinal, preparação, entrega e conciliação preservam títulos e não acionam estoque por hipótese", async () => {
    const r = await criarRascunhoPedido({ ...entrada(produto300), prazo: "AGENDADO", previsaoData: "2026-10-01", previsaoJanela: "manhã" }, chave(), admin);
    let p = await confirmarPedido(r.id, 1, chave(), admin, condicao(["90", "210"]));
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, orderBy: { valor: "asc" } });
    await registrarRecebimentoPedido(p.id, titulos[0].id, "90", contaId, "2026-09-24", chave(), admin);
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: p.id, vigente: true } });
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "INICIAR" }, chave(), admin);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "REAGENDAR", data: "2026-10-02", janela: "tarde", motivo: "Solicitação fictícia" }, chave(), admin);
    expect((await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulos[1].id } })).dataVencimento).toEqual(titulos[1].dataVencimento);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, chave(), admin);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "PRONTO" }, chave(), admin);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "EXPEDIR", itemId: item.id, quantidade: "1" }, chave(), admin);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "SAIR" }, chave(), admin);
    p = await executarOperacaoPedido(p.id, p.versao, { tipo: "ENTREGAR" }, chave(), admin);
    const importacao = await sim.prisma.importacaoExtrato.create({ data: { contaBancariaId: contaId, nomeArquivo: "sinal-ficticio.ofx", hashArquivo: chave(), formato: "OFX", autorId: admin.userId, autorNome: admin.nome } });
    const transacao = await sim.prisma.transacaoExtrato.create({ data: { contaBancariaId: contaId, importacaoId: importacao.id, chave: chave(), impressao: chave(), data: new Date("2026-09-24T00:00:00Z"), descricao: "Sinal fictício", valor: "90" } });
    const titulo = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulos[0].id } });
    await conciliarExtrato({ transacaoId: transacao.id, lancamentos: [{ id: titulo.id, versao: titulo.updatedAt.toISOString() }] }, admin);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.id } } })).toBe(1);
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
    const primeiraEntrega = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm;
    const financeiroAntes = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, orderBy: { id: "asc" } });
    const caixaAntes = await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: p.id } }, orderBy: { id: "asc" } });
    const vinculosAntes = await sim.prisma.vinculoExtrato.findMany({ where: { transacaoId: transacao.id } });
    p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), admin);
    await recusarRevisaoComercial(p.id, p.versao, entrada(produto300, "50"));
    p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), admin);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(primeiraEntrega);
    expect(await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, orderBy: { id: "asc" } })).toEqual(financeiroAntes);
    expect(await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: p.id } }, orderBy: { id: "asc" } })).toEqual(caixaAntes);
    expect(await sim.prisma.vinculoExtrato.findMany({ where: { transacaoId: transacao.id } })).toEqual(vinculosAntes);
    const consulta = await consultarGestaoPedidos({ de: "2026-10-02", ate: "2026-10-02", base: "entrega" });
    expect(consulta.linhas.find(l => l.id === p.id)).toMatchObject({ recebidoBruto: "90.00", aReceber: "210.00", operacional: "ENTREGUE", comercial: "300.00", custoEstimado: null });
    await expect(cancelarPedido(p.id, p.versao, "Cancelamento ainda entregue", chave(), admin)).rejects.toThrow("Pedido entregue não pode ser cancelado");
    p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), admin);
    const cancelamento = chave(), versaoCancelamento = p.versao;
    p = await cancelarPedido(p.id, versaoCancelamento, "Cancelamento após retorno sintético", cancelamento, admin, {}, "Responsável informado sintético");
    expect(await cancelarPedido(p.id, versaoCancelamento, "Cancelamento após retorno sintético", cancelamento, admin, {}, "Responsável informado sintético")).toEqual(p);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(primeiraEntrega);
    expect(await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulos[0].id } })).toEqual(financeiroAntes.find(t => t.id === titulos[0].id));
    expect(await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulos[1].id } })).toMatchObject({ status: "CANCELADO", valor: titulos[1].valor, pedidoParcelaRaiz: titulos[1].pedidoParcelaRaiz });
    expect(await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: p.id } }, orderBy: { id: "asc" } })).toEqual(caixaAntes);
    expect(await sim.prisma.vinculoExtrato.findMany({ where: { transacaoId: transacao.id } })).toEqual(vinculosAntes);
    const tratamentos = await sim.prisma.tratamentoFinanceiroPedido.findMany({ where: { pedidoId: p.id } });
    expect(tratamentos).toHaveLength(1);
    expect(tratamentos[0]).toMatchObject({ tipo: "DEVOLUCAO", status: "SOLICITADA", valor: new Prisma.Decimal(90), retido: new Prisma.Decimal(0) });
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });

  it.each(["DEVOLUCAO", "CREDITO"] as const)("cancelamento após retorno preserva pagamentos e pós-venda prévio, destinando somente saldo elegível a %s", async destino => {
    const cliente = await sim.prisma.clienteVenda.create({ data: { nome: `Comprador sintético de retorno ${destino}`, tipo: "PF" } });
    const dados = { ...entrada(produto300), clienteId: cliente.id, atendimento: "RETIRADA", pagamentoInformado: { formaId, parcelas: 1, vencimentos: [] } };
    const r = await criarRascunhoBase(dados, chave(), admin, "HUB", 1);
    let p = await confirmarPedido(r.id, r.versao, chave(), admin, { categoriaId, dataCompetencia: "", parcelas: [] });
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id } });
    await registrarRecebimentoPedido(p.id, titulo.id, "300", contaId, "2026-10-02", chave(), admin);
    for (let n = 0; n < 3; n++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), admin);
    const primeiraEntrega = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm;
    expect(primeiraEntrega).not.toBeNull();
    const anterior = await solicitarDevolucaoPedido(p.id, "90", "0", "Pós-venda parcial sintético anterior", "", "", chave(), admin);
    const caixa = await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: p.id } }, orderBy: { id: "asc" } });
    const pago = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } });
    p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), admin);
    const antes = await fotografiaComercialFinanceira(p.id);
    await expect(cancelarPedido(p.id, p.versao, "Cancelamento após retorno sintético", chave(), restrito, {}, "Administrador informado")).rejects.toThrow("acesso");
    await expect(cancelarPedido(p.id, p.versao, "Cancelamento após retorno sintético", chave(), admin, {}, "")).rejects.toThrow("nome do responsável");
    expect(await fotografiaComercialFinanceira(p.id)).toEqual(antes);
    const tratamento = destino === "CREDITO" ? { destino, dataEscolha: "2026-10-02", comunicacao: "Escolha documentada sintética" } : {};
    const operacao = chave(), versao = p.versao;
    p = await cancelarPedido(p.id, versao, "Cancelamento após retorno sintético", operacao, admin, tratamento, "Pessoa responsável sintética");
    expect(await cancelarPedido(p.id, versao, "Cancelamento após retorno sintético", operacao, admin, tratamento, "Pessoa responsável sintética")).toEqual(p);
    const atual = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } });
    expect(atual).toMatchObject({ status: "CANCELADO", statusOperacional: "INTERROMPIDO", entregueEm: primeiraEntrega });
    expect(await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } })).toEqual(pago);
    expect(await sim.prisma.movimentacaoBancaria.findMany({ where: { lancamento: { pedidoVendaId: p.id } }, orderBy: { id: "asc" } })).toEqual(caixa);
    expect(await sim.prisma.tratamentoFinanceiroPedido.findUniqueOrThrow({ where: { id: anterior.id } })).toEqual(anterior);
    const tratamentos = await sim.prisma.tratamentoFinanceiroPedido.findMany({ where: { pedidoId: p.id }, orderBy: { id: "asc" } });
    expect(tratamentos).toHaveLength(2);
    expect(tratamentos.find(t => t.id !== anterior.id)).toMatchObject({ tipo: destino, status: destino === "CREDITO" ? "CONCLUIDA" : "SOLICITADA", valor: new Prisma.Decimal(210), retido: new Prisma.Decimal(0), reduzVenda: true });
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: p.id }, include: { pedidoVenda: { include: { tratamentosFinanceiros: true, movimentosCreditoAplicado: true } } } });
    expect([...valoresCompetenciaPedidos(titulos).values()].reduce((s, v) => s + v, 0)).toBe(0);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "CANCELADO" } })).toBe(1);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.id }, tipo: "SAIDA" } })).toBe(0);
    expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  });

  it("cancelamento após retorno preserva captura sem repasse, sem cancelar título capturado ou criar caixa", async () => {
    const r = await criarRascunhoPedido(entrada(produto400), chave(), admin);
    let p = await confirmarPedido(r.id, r.versao, chave(), admin, { categoriaId, dataCompetencia: "2026-09-20", parcelas: [{ valor: "400", vencimento: "2026-09-24", formaPagamentoVendaId: creditoId, parcelasCliente: 1 }] });
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: p.id } });
    await registrarCapturaCartaoPedido(p.id, titulo.id, "captura-retorno-sintetica-sem-repasse", "Evidência sintética de captura", "2026-09-24", null, null, chave(), admin);
    for (let n = 0; n < 4; n++) p = await mudarStatusGestorPedido(p.id, p.versao, "avancar", chave(), admin);
    const primeiraEntrega = (await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm;
    const capturas = await sim.prisma.pagamentoExternoPedido.findMany({ where: { pedidoId: p.id } });
    const capturado = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } });
    p = await mudarStatusGestorPedido(p.id, p.versao, "voltar", chave(), admin);
    const operacao = chave(), versao = p.versao;
    p = await cancelarPedido(p.id, versao, "Cancelamento de captura após retorno sintético", operacao, admin);
    expect(await cancelarPedido(p.id, versao, "Cancelamento de captura após retorno sintético", operacao, admin)).toEqual(p);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: p.id } })).entregueEm).toEqual(primeiraEntrega);
    expect(await sim.prisma.pagamentoExternoPedido.findMany({ where: { pedidoId: p.id } })).toEqual(capturas);
    expect(await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } })).toEqual(capturado);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: p.id } } })).toBe(0);
    const tratamentos = await sim.prisma.tratamentoFinanceiroPedido.findMany({ where: { pedidoId: p.id } });
    expect(tratamentos).toHaveLength(1);
    expect(tratamentos[0]).toMatchObject({ tipo: "DEVOLUCAO", status: "SOLICITADA", valor: new Prisma.Decimal(400) });
    expect(tratamentos[0].concluidoEm).toBeNull();
  });

  it("gestão reconcilia cada pedido com títulos, repasses, devoluções e agrupamentos sem somar revisões", async () => {
    const r = await consultarGestaoPedidos();
    expect(r.total).toBe(r.linhas.length);
    for (const linha of r.linhas) {
      const detalhe = await obterPedido(linha.id);
      if (detalhe.modoFinanceiro === "EXTERNO") {
        expect(detalhe.financeiro).toBeNull();
        expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: linha.id } })).toBe(0);
        expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: linha.id } } })).toBe(0);
        continue;
      }
      const f = detalhe.financeiro as { recebido: string; saldoCliente: string; creditoAplicado: string; entradaLiquida: string; capturado: string; repassado: string; tratamentos: { tipo: string; status: string; valor: string }[] };
      expect(linha).toMatchObject({ recebidoBruto: f.recebido, aReceber: f.saldoCliente, creditoAplicado: f.creditoAplicado, entradaLiquida: f.entradaLiquida, capturado: f.capturado, repassado: f.repassado });
      expect(linha.devolvido).toBe(f.tratamentos.filter(t => t.tipo === "DEVOLUCAO" && t.status === "CONCLUIDA").reduce((s, t) => s.plus(t.valor), new Prisma.Decimal(0)).toFixed(2));
    }
    const ativos = await sim.prisma.pedidoVenda.findMany({ where: { status: "CONFIRMADO" } });
    const esperado = ativos.reduce((s, p) => s.plus(p.total).minus(p.frete).minus(p.outrosCustos), new Prisma.Decimal(0));
    expect(r.produtos.reduce((s, p) => s.plus(p.valor), new Prisma.Decimal(0)).toFixed(2)).toBe(esperado.toFixed(2));
    expect(r.valorItensAtivos).toBe(esperado.toFixed(2));
    expect(new Prisma.Decimal(r.valorItensAtivos).plus(ativos.reduce((s, p) => s.plus(p.frete).plus(p.outrosCustos), new Prisma.Decimal(0))).toFixed(2)).toBe(ativos.reduce((s, p) => s.plus(p.total), new Prisma.Decimal(0)).toFixed(2));
    const outraPagina = await consultarGestaoPedidos({ pagina: 2 });
    expect(outraPagina.produtos).toEqual(r.produtos);
    expect(outraPagina.valorItensAtivos).toBe(r.valorItensAtivos);
    expect(await sim.prisma.notaFiscalRecebida.count()).toBe(0);
  });
  it("F5/T02: recusa revisão de frete após preparo, preservando item, sinal 90 e saldo 210", async () => {
    const pedido = await novoConfirmado(produto300, ["300"]);
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: pedido.id } });
    await registrarRecebimentoPedido(pedido.id, titulo.id, "90", contaId, "2026-09-24", chave(), admin);
    const antes = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } });
    await executarOperacaoPedido(pedido.id, antes.versao, { tipo: "INICIAR" }, chave(), admin);
    const itens = await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: pedido.id } });
    const v = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } });
    await recusarRevisaoComercial(pedido.id, v.versao, entrada(produto300, "50"));
    const atual = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(atual.total.toString()).toBe("300");
    expect(atual.versao).toBe(v.versao);
    expect(await sim.prisma.itemPedidoVenda.findMany({ where: { pedidoId: pedido.id } })).toEqual(itens);
    const titulos = await sim.prisma.lancamentoFinanceiro.findMany({ where: { pedidoVendaId: pedido.id } });
    expect(titulos.find(t => t.status === "BAIXADO")?.valor.toString()).toBe("90");
    expect(titulos.find(t => t.status === "PENDENTE")?.valor.toString()).toBe("210");
  });

  it("F5: recusa acrescentar item após preparo e conserva execução, etapa pronta e receita", async () => {
    const pedido = await novoConfirmado(produto300, ["300"]);
    await executarOperacaoPedido(pedido.id, 2, { tipo: "INICIAR" }, chave(), admin);
    const antigo = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: pedido.id } });
    await executarOperacaoPedido(pedido.id, 3, { tipo: "PREPARAR", itemId: antigo.id, quantidade: "1" }, chave(), admin);
    await executarOperacaoPedido(pedido.id, 4, { tipo: "PRONTO" }, chave(), admin);
    const d = entrada(produto300); d.itens.push({ produtoId: produto100, quantidade: "1", escolhas: {}, precoManual: null });
    await recusarRevisaoComercial(pedido.id, 5, d);
    expect(await sim.prisma.itemPedidoVenda.findUniqueOrThrow({ where: { id: antigo.id } })).toEqual(antigo);
    expect(await sim.prisma.itemPedidoVenda.count({ where: { pedidoId: pedido.id, vigente: true } })).toBe(1);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedido.id } })).statusOperacional).toBe("PRONTO");
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: pedido.id } })).toBe(1);
    const gestao = await consultarGestaoPedidos(); expect(gestao.linhas.find(p => p.id === pedido.id)?.custoEstimado).toBeNull();
  });

  it("T11: crédito 300 + Pix 150 financiam pedido 450 com consumo físico inteiro", async () => {
    const origem = await novoConfirmado(produto300, ["300"]);
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: origem.id } });
    await registrarRecebimentoPedido(origem.id, titulo.id, "300", contaId, "2026-09-24", chave(), admin);
    await cancelarPedido(origem.id, origem.versao, "Crédito escolhido T11", chave(), admin, { destino: "CREDITO", dataEscolha: "2026-09-24", comunicacao: "Escolha fictícia T11" });
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local fictício T11" } });
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: { id: "singleton", pedidosLiberacao: { locais: [local.id] } }, update: { pedidosLiberacao: { locais: [local.id] } } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Material T11", unidade: "KG", custoMedio: 10 } });
    await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 10 });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Pedido integral T11", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 3, unidade: "KG" } }, preco: 450 } });
    const novo = await criarRascunhoPedido(entrada(produto.id), chave(), admin);
    const antes = await sim.prisma.movimentacaoBancaria.count();
    await confirmarPedido(novo.id, 1, chave(), admin, { categoriaId, dataCompetencia: "2026-09-24", creditoUtilizado: "300", parcelas: [{ valor: "150", vencimento: "2026-09-24", formaPagamentoVendaId: formaId }] });
    expect(await sim.prisma.movimentacaoBancaria.count()).toBe(antes);
    const complementar = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: novo.id, status: "PENDENTE" } });
    await registrarRecebimentoPedido(novo.id, complementar.id, "150", contaId, "2026-09-24", chave(), admin);
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: novo.id } });
    await executarFisicoPedido(novo.id, 2, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "1" }, chave(), admin);
    await executarOperacaoPedido(novo.id, 3, { tipo: "INICIAR" }, chave(), admin);
    const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
    await executarFisicoPedido(novo.id, 4, { tipo: "CONSUMIR", reservaId: reserva.id, quantidade: "3", motivo: "Consumo integral T11" }, chave(), admin);
    expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("7");
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: novo.id } })).total.toString()).toBe("450");
    expect(await sim.prisma.movimentacaoBancaria.count()).toBe(antes + 1);
    expect((await sim.prisma.movimentacaoBancaria.findFirstOrThrow({ where: { lancamentoId: complementar.id } })).valor.toString()).toBe("150");
  });

  it("T01: sinal 90/saldo210, reserva, consumo e preparo parciais, entrega e conciliação únicos", async () => {
    const local = await sim.prisma.localEstoque.create({ data: { nome: "Local fictício T01" } });
    await sim.prisma.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id] } } });
    const insumo = await sim.prisma.insumo.create({ data: { nome: "Material T01", unidade: "KG", custoMedio: 10 } });
    await registrarMovimentacao({ insumoId: insumo.id, localId: local.id, tipo: "AJUSTE_ENTRADA", quantidade: 10 });
    const produto = await sim.prisma.produtoVenda.create({ data: { nome: "Encomenda T01", unidade: "UN", componentes: { create: { insumoId: insumo.id, quantidade: 1, unidade: "KG" } }, preco: 150 } });
    const d = entrada(produto.id); d.itens[0].quantidade = "2";
    const r = await criarRascunhoPedido({ ...d, prazo: "AGENDADO", previsaoData: "2026-10-10", previsaoJanela: "manhã" }, chave(), admin);
    await confirmarPedido(r.id, 1, chave(), admin, condicao(["90", "210"]));
    const titulo = await sim.prisma.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: r.id, valor: 90 } });
    await registrarRecebimentoPedido(r.id, titulo.id, "90", contaId, "2026-09-24", chave(), admin);
    const item = await sim.prisma.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: r.id } });
    let versao = (await executarFisicoPedido(r.id, 2, { tipo: "RESERVAR", itemId: item.id, localId: local.id, quantidade: "2" }, chave(), admin)).versao;
    versao = (await executarOperacaoPedido(r.id, versao, { tipo: "INICIAR" }, chave(), admin)).versao;
    const reserva = await sim.prisma.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
    for (let n = 0; n < 2; n++) {
      versao = (await executarFisicoPedido(r.id, versao, { tipo: "CONSUMIR", reservaId: reserva.id, quantidade: "1", motivo: "Apontamento parcial T01" }, chave(), admin)).versao;
      versao = (await executarOperacaoPedido(r.id, versao, { tipo: "PREPARAR", itemId: item.id, quantidade: "1" }, chave(), admin)).versao;
    }
    versao = (await executarOperacaoPedido(r.id, versao, { tipo: "PRONTO" }, chave(), admin)).versao;
    versao = (await executarOperacaoPedido(r.id, versao, { tipo: "EXPEDIR", itemId: item.id, quantidade: "2" }, chave(), admin)).versao;
    versao = (await executarOperacaoPedido(r.id, versao, { tipo: "SAIR" }, chave(), admin)).versao;
    await executarOperacaoPedido(r.id, versao, { tipo: "ENTREGAR" }, chave(), admin);
    const importacao = await sim.prisma.importacaoExtrato.create({ data: { contaBancariaId: contaId, nomeArquivo: "T01-ficticio.ofx", hashArquivo: chave(), formato: "OFX", autorId: admin.userId, autorNome: admin.nome } });
    const transacao = await sim.prisma.transacaoExtrato.create({ data: { contaBancariaId: contaId, importacaoId: importacao.id, chave: chave(), impressao: chave(), data: new Date("2026-09-24T00:00:00Z"), descricao: "Sinal T01", valor: 90 } });
    const pago = await sim.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } });
    await conciliarExtrato({ transacaoId: transacao.id, lancamentos: [{ id: pago.id, versao: pago.updatedAt.toISOString() }] }, admin);
    expect(await sim.prisma.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: r.id } } })).toBe(1);
    expect((await sim.prisma.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("8");
    expect((await consultarGestaoPedidos()).linhas.find(l => l.id === r.id)).toMatchObject({ comercial: "300.00", recebidoBruto: "90.00", aReceber: "210.00", operacional: "ENTREGUE", custoEstimado: "20.00" });
  });

});
