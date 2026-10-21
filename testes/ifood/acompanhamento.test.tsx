import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
import { merchant, pedidoRemoto } from "./fixtures";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, sessao: null as unknown as SessaoAtual, emitir: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/contexto-interface", () => ({ identidadeDaInterface: async () => "hub" }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: async () => sim.sessao, podeAcessar: async () => true, ErroPermissao: class extends Error {} }));
vi.mock("@/lib/fiscal-saida/provedor", () => ({ obterAdaptadorFiscalSaida: () => ({ id: "emissor-sintetico", ambiente: "HOMOLOGACAO", enviar: sim.emitir, cancelar: sim.emitir, consultar: sim.emitir }) }));
import { prepararAcompanhamento, ativarLoja } from "@/lib/ifood/configuracao";
import { coletarEventos } from "@/lib/ifood/coletor";
import { persistirEventos, processarEvento } from "@/lib/ifood/processamento";
import { cifrarIfood, requisicaoAutorizada } from "@/lib/ifood/tokens";
import { consultarPedidoIfood, solicitarAcao, enviarAcao } from "@/lib/ifood/acoes";
import { solicitarMerchant, processarMerchant } from "@/lib/ifood/merchant";
import { conferirAcesso, executarOperacaoInterfacePedido } from "@/lib/vendas/pedidos";
import { projetarFinanceiro, gerarTitulosIfood } from "@/lib/ifood/financeiro";
import { adaptarPedido } from "@/lib/ifood/adaptador";
import { baixarLancamento } from "@/lib/financeiro/baixarLancamento";
import { salvarCustoEntrega } from "@/lib/vendas/entregas-custos";
import { prepararFiscalSaida, processarFiscalSaida } from "@/lib/fiscal-saida/servico";
import { acaoPedidoIfoodAction } from "@/app/(protegido)/vendas/pedidos/ifood/actions";
import { ConteudoComanda } from "@/app/(protegido)/vendas/pedidos/[id]/comanda/conteudo";
import OperacaoPage from "@/app/(protegido)/vendas/pedidos/[id]/operacao/page";
import { ADAPTADORES_CANAIS_FISCAL } from "@/lib/mcp/canais-fiscal";
import type { AdaptadorMcp } from "@/lib/mcp/negocio";
import { ESTADOS, type EventoRemoto } from "@/lib/ifood/dominio";
const schema = "teste_ifood_piloto_" + randomUUID().replaceAll("-", "");
const clientId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", principal = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const remoto = { ...pedidoRemoto(), isTest: false, displayId: "PILOTO-SINTETICO", createdAt: new Date(Date.now() - 30000).toISOString() };
let pg: Client, lojaId: string, integracaoId: string, canalId: string, categoriaId: string;
let lote: EventoRemoto[] = [], ackFalha = false;
const chamadas: { path: string; metodo: string; token: string | null }[] = [];
const evento = (code: keyof typeof ESTADOS, offset = 0): EventoRemoto => ({ id: randomUUID(), orderId: remoto.id, merchantId: merchant, code, fullCode: ESTADOS[code], createdAt: new Date(Date.now() + offset), metadata: {} });
const pedido = () => sim.prisma.pedidoIfood.findUniqueOrThrow({ where: { lojaId_externoId: { lojaId, externoId: remoto.id } }, include: { pedido: true } });
const entrada = () => ({ principalClientId: principal, enquadramento: "SUPORTE-SINTETICO-ENQUADRAMENTO", presenca: "SUPORTE-SINTETICO-PRESENCA", minutos: 10, chave: randomUUID() });
async function semEfeitos() {
  expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
  expect(await sim.prisma.movimentacaoBancaria.count()).toBe(0);
  expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  expect(await sim.prisma.reservaPedido.count()).toBe(0);
  expect(await sim.prisma.historicoPedidoVenda.count({ where: { tipo: { startsWith: "OPERACAO_" } } })).toBe(0);
}
describe.skipIf(process.env.IFOOD_BANCO_TESTE !== "1")("Acompanhamento Takeat em PostgreSQL isolado; HTTP sintético", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_teste")) throw Error("Somente banco local de teste.");
    pg = new Client({ connectionString: url.toString() }); await pg.connect();
    await pg.query(`CREATE SCHEMA "${schema}"`); await pg.query(`SET search_path TO "${schema}"`);
    for (const p of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) await pg.query(await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8"));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: "-c search_path=" + schema }, { schema }) });
    vi.stubEnv("AUTH_SECRET", "segredo-exclusivamente-sintetico-piloto-isolado"); vi.stubEnv("IFOOD_ATIVO", "1"); vi.stubEnv("IFOOD_PRODUCAO_AUTORIZADA", "0"); vi.stubEnv("IFOOD_ACOMPANHAMENTO_PRODUCAO_AUTORIZADO", "0");
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Administrador sintético", email: "piloto@example.invalid", senhaHash: "sem-login", perfilAcessoId: perfil.id } }); sim.sessao = { userId: u.id, nome: u.nome, versao: 0 } as SessaoAtual;
    categoriaId = (await sim.prisma.categoriaFinanceira.findFirstOrThrow({ where: { grupo: "RECEITA_BRUTA", ativo: true } })).id;
    canalId = (await sim.prisma.canalVenda.create({ data: { nome: "Canal sintético", categoriaReceitaId: categoriaId } })).id;
    integracaoId = (await sim.prisma.integracaoIfood.create({ data: { ambiente: "PRODUCAO", modalidade: "CENTRALIZADO", clientId, ativo: true, criadoPorId: u.id, tokenCifrado: cifrarIfood("token-hub-sintetico-independente"), tokenExpiraEm: new Date(Date.now() + 3600000) } })).id;
    lojaId = (await sim.prisma.lojaIfood.create({ data: { integracaoId, ambiente: "PRODUCAO", merchantId: merchant, canalId, nome: "Loja sintética de acompanhamento", autorizada: true, ultimaAutorizacao: new Date() } })).id;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname, metodo = init?.method ?? "GET";
      chamadas.push({ path, metodo, token: new Headers(init?.headers).get("Authorization") });
      if (path.endsWith("events:polling")) return Response.json(lote.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })));
      if (path.endsWith("acknowledgment")) {
        const ids = JSON.parse(String(init?.body)).map((e: { id: string }) => e.id);
        expect(await sim.prisma.eventoIfood.count({ where: { lojaId, externoId: { in: ids } } })).toBe(ids.length);
        return ackFalha ? Response.json({}, { status: 503 }) : new Response(null, { status: 202 });
      }
      if (path === `/order/v1.0/orders/${remoto.id}` && metodo === "GET") return Response.json(remoto);
      throw Error("Rede ou comando inesperado no teste: " + metodo + " " + path);
    }));
  }, 90000);
  afterAll(async () => { await sim.prisma?.$disconnect(); if (pg) { await pg.query(`DROP SCHEMA "${schema}" CASCADE`); await pg.end(); } vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("prepara pausado, rejeita credencial do principal e impede ativação por admin com produção bloqueada", async () => {
    await expect(prepararAcompanhamento(lojaId, { ...entrada(), principalClientId: clientId }, sim.sessao)).rejects.toThrow("diferente");
    const e = entrada(); await prepararAcompanhamento(lojaId, e, sim.sessao); await prepararAcompanhamento(lojaId, e, sim.sessao);
    expect(await sim.prisma.historicoCadastroVenda.count({ where: { id: e.chave } })).toBe(1);
    await expect(ativarLoja(lojaId, true, sim.sessao)).rejects.toThrow("liberação"); expect(chamadas).toEqual([]);
  });
  it("valida de 1 a 120 minutos inteiros no servidor e calcula o prazo sem relógio do cliente", async () => {
    for (const minutos of [0, -1, 1.5, 121, Number.NaN, Number.POSITIVE_INFINITY, "1"]) await expect(prepararAcompanhamento(lojaId, { ...entrada(), minutos: minutos as number }, sim.sessao)).rejects.toThrow("1 a 120");
    for (const minutos of [1, 120]) {
      const antes = Date.now(); await prepararAcompanhamento(lojaId, { ...entrada(), minutos }, sim.sessao); const depois = Date.now();
      const l = await sim.prisma.lojaIfood.findUniqueOrThrow({ where: { id: lojaId } });
      expect(l.pilotoAte!.getTime()).toBeGreaterThanOrEqual(antes + minutos * 60000); expect(l.pilotoAte!.getTime()).toBeLessThanOrEqual(depois + minutos * 60000); expect(l.ativa).toBe(false);
    }
    await prepararAcompanhamento(lojaId, entrada(), sim.sessao); expect(chamadas).toEqual([]);
  });
  it("retry conserva prazo após expiração; nova chave prepara nova janela auditada", async () => {
    const e = { ...entrada(), minutos: 1 }; await prepararAcompanhamento(lojaId, e, sim.sessao);
    const original = (await sim.prisma.lojaIfood.findUniqueOrThrow({ where: { id: lojaId } })).pilotoAte!;
    const relogio = vi.spyOn(Date, "now").mockReturnValue(original.getTime() + 60000);
    try {
      await prepararAcompanhamento(lojaId, e, sim.sessao);
      expect((await sim.prisma.lojaIfood.findUniqueOrThrow({ where: { id: lojaId } })).pilotoAte).toEqual(original);
      expect(await sim.prisma.historicoCadastroVenda.count({ where: { id: e.chave } })).toBe(1);
      await expect(prepararAcompanhamento(lojaId, { ...e, minutos: 2 }, sim.sessao)).rejects.toThrow("outros dados");
      const nova = { ...e, chave: randomUUID() }; await prepararAcompanhamento(lojaId, nova, sim.sessao);
      const l = await sim.prisma.lojaIfood.findUniqueOrThrow({ where: { id: lojaId } });
      expect(l.pilotoAte!.getTime()).toBe(original.getTime() + 120000); expect(l.ativa).toBe(false);
      expect(await sim.prisma.historicoCadastroVenda.count({ where: { id: { in: [e.chave, nova.chave] } } })).toBe(2);
    } finally { relogio.mockRestore(); }
    await prepararAcompanhamento(lojaId, entrada(), sim.sessao); expect(chamadas).toEqual([]);
  });
  it("recebe somente com autorização de dados separada; persiste antes do ACK e recupera ACK falho", async () => {
    vi.stubEnv("IFOOD_ACOMPANHAMENTO_PRODUCAO_AUTORIZADO", "1");
    vi.stubEnv("IFOOD_ACOMPANHAMENTO_MERCHANT_ID", randomUUID()); await expect(ativarLoja(lojaId, true, sim.sessao)).rejects.toThrow("liberação");
    vi.stubEnv("IFOOD_ACOMPANHAMENTO_MERCHANT_ID", merchant); // Só este schema sintético. Nunca o servidor operacional.
    await ativarLoja(lojaId, true, sim.sessao); lote = [evento("PLC")]; ackFalha = true;
    await coletarEventos(); expect(await sim.prisma.eventoIfood.count({ where: { ackEm: null } })).toBe(1);
    ackFalha = false; await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { proximoPolling: new Date(0) } });
    await coletarEventos(); expect(await sim.prisma.eventoIfood.count()).toBe(1); expect(await sim.prisma.eventoIfood.count({ where: { ackEm: { not: null } } })).toBe(1);
    await Promise.all([processarEvento(), processarEvento()]);
    const p = await pedido(); expect(p.acompanhamento).toBe(true); expect(p.pedido.modoFinanceiro).toBe("EXTERNO"); expect(p.pedido.canalNomeSnapshot).toBe("Acompanhamento — Takeat"); expect(p.lojaId).toBe(lojaId);
    expect((await consultarPedidoIfood(p.pedidoId, sim.sessao))?.ambiente).toBe("PRODUCAO");
    expect(chamadas.every(c => c.token === "Bearer token-hub-sintetico-independente")).toBe(true); await semEfeitos();
  });
  it("reflete confirmação/preparo por outro sistema sem criar outbox; eventos paralelos convergem", async () => {
    const cfm = evento("CFM"), prs = evento("PRS", 100);
    await Promise.all([persistirEventos(lojaId, [cfm, prs]), persistirEventos(lojaId, [cfm, prs])]);
    await Promise.all([processarEvento(), processarEvento()]); await processarEvento();
    expect((await pedido()).estadoRemoto).toBe("PREPARATION_STARTED"); expect(await sim.prisma.pedidoVenda.count()).toBe(1); expect(await sim.prisma.acaoIfood.count()).toBe(0);
    const leitura = await consultarPedidoIfood((await pedido()).pedidoId, sim.sessao); expect(leitura?.acoesPermitidas).toEqual([]); expect(leitura?.acompanhamento).toBe(true); await semEfeitos();
  });
  it("mantém pendência parcial do sistema principal quando OPA ainda não mudou os detalhes", async () => {
    const disputaId = randomUUID(), antes = await pedido();
    const hsd: EventoRemoto = { ...evento("CFM", 200), code: "HSD", fullCode: "HANDSHAKE_DISPUTE", metadata: { id: disputaId, action: "PARTIAL_CANCELLATION", handshakeType: "AFTER_DELIVERY_PARTIALLY", expiresAt: new Date(Date.now() + 60000).toISOString(), metadata: { items: [{ id: remoto.items[0].id, uniqueId: randomUUID(), index: 0, quantity: 1, amount: { value: "1100", currency: "BRL" } }], acceptCancellationReasons: ["PRODUCT_QUALITY"] } } };
    await persistirEventos(lojaId, [hsd]); await processarEvento();
    await persistirEventos(lojaId, [{ ...evento("CFM", 300), code: "HSS", fullCode: "HANDSHAKE_SETTLEMENT", metadata: { disputeId: disputaId, status: "ACCEPTED" } }]); await processarEvento();
    expect((await pedido()).revisaoPendente).toBe(true);
    await persistirEventos(lojaId, [{ ...evento("CFM", 400), code: "OPA", fullCode: "ORDER_PATCHED" }]); await processarEvento();
    const p = await pedido(); expect(p.revisaoPendente).toBe(true); expect(p.financeiroPendente).toBe(false); expect(p.pendencia).toContain("Cancelamento parcial no sistema principal");
    expect(p.pedido.total.toFixed(2)).toBe(antes.pedido.total.toFixed(2)); expect(p.estadoRemoto).toBe(antes.estadoRemoto);
    expect(await sim.prisma.acaoIfood.count()).toBe(0); await semEfeitos();
  });
  it("rejeita polling sem filtro ou com identidade operacional apontando ao merchant de acompanhamento", async () => {
    const normal = await sim.prisma.lojaIfood.create({ data: { integracaoId, ambiente: "PRODUCAO", merchantId: randomUUID(), nome: "Vínculo operacional sintético", canalId, autorizada: true } });
    const antes = chamadas.length, rota = "/events/v1.0/events:polling";
    await expect(requisicaoAutorizada(integracaoId, rota, { lojaId: normal.id, merchant })).rejects.toThrow("filtro único");
    await expect(requisicaoAutorizada(integracaoId, rota, { lojaId })).rejects.toThrow("filtro único");
    await expect(requisicaoAutorizada(integracaoId, rota, { merchant })).rejects.toThrow("filtro único");
    expect(chamadas.length).toBe(antes); await semEfeitos();
  });
  it("bloqueia comandos diretos, API e MCP mesmo para administrador e mesmo com chave comercial ligada", async () => {
    vi.stubEnv("IFOOD_PRODUCAO_AUTORIZADA", "1"); const p = await pedido();
    for (const a of ["confirm", "startPreparation", "readyToPickup", "dispatch", "requestCancellation", "verifyDeliveryCode", "acceptDispute", "rejectDispute", "alternativeDispute"] as const) await expect(solicitarAcao(p.pedidoId, p.pedido.versao, a, {}, randomUUID(), sim.sessao)).rejects.toThrow("Acompanhamento");
    expect(await acaoPedidoIfoodAction(p.pedidoId, p.pedido.versao, "confirm", {}, randomUUID())).toMatchObject({ erro: expect.stringContaining("Acompanhamento") });
    const contexto = { sessao: sim.sessao, operacaoId: randomUUID(), acesso: { restricoes: { contas: null, lancamentos: null } } } as Parameters<AdaptadorMcp>[1];
    await expect(ADAPTADORES_CANAIS_FISCAL.ifood_confirmar({ id: p.pedidoId, versao: p.pedido.versao }, contexto)).rejects.toThrow("Acompanhamento");
    await expect(solicitarMerchant(lojaId, "CRIAR_PAUSA", {}, randomUUID(), sim.sessao)).rejects.toThrow("Acompanhamento");
    for (const rota of [`/order/v1.0/orders/${remoto.id}/confirm`, `/merchant/v1.0/merchants/${merchant}/interruptions`, "/rota-desconhecida"]) await expect(requisicaoAutorizada(integracaoId, rota, { metodo: "POST" })).rejects.toThrow("Acompanhamento");
    vi.stubEnv("IFOOD_PRODUCAO_AUTORIZADA", "0"); expect(await sim.prisma.acaoIfood.count()).toBe(0);
  });
  it("worker recusa ação indevidamente enfileirada antes de enviar; Merchant também não escreve", async () => {
    const p = await pedido(); const a = await sim.prisma.acaoIfood.create({ data: { pedidoIfoodId: p.id, acao: "confirm", revisao: p.pedido.versao, chave: randomUUID(), hash: "sintetico", sessaoVersao: 0, autorId: sim.sessao.userId } });
    await enviarAcao(); expect((await sim.prisma.acaoIfood.findUniqueOrThrow({ where: { id: a.id } })).estado).toBe("RECUSADA");
    const m = await sim.prisma.acaoMerchantIfood.create({ data: { lojaId, acao: "CRIAR_PAUSA", chave: randomUUID(), hash: "sintetico", corpo: {}, antes: {}, sessaoVersao: 0, autorId: sim.sessao.userId } });
    await processarMerchant(); expect((await sim.prisma.acaoMerchantIfood.findUniqueOrThrow({ where: { id: m.id } })).estado).toBe("RECUSADA");
    expect(chamadas.filter(c => c.metodo !== "GET" && !c.path.endsWith("acknowledgment"))).toEqual([]);
  });
  it("bloqueia produção local, financeiro, baixa, fiscal e comanda; não cria efeitos", async () => {
    const p = await pedido(), adaptado = adaptarPedido(remoto, merchant, "PRODUCAO", "America/Sao_Paulo");
    for (const capacidade of ["receber", "estornar", "condicao", "estoque", "fiscal", "operar"] as const) await expect(sim.prisma.$transaction(tx => conferirAcesso(tx, sim.sessao, [capacidade], p.pedidoId))).rejects.toThrow("Acompanhamento");
    await expect(executarOperacaoInterfacePedido(p.pedidoId, p.pedido.versao, { tipo: "AVANCAR" }, randomUUID(), sim.sessao)).rejects.toThrow("Acompanhamento");
    await expect(salvarCustoEntrega(p.pedidoId, p.pedido.versao, "1.00", null, null, "Justificativa sintética", randomUUID(), sim.sessao)).rejects.toThrow("Acompanhamento");
    expect(await sim.prisma.$transaction(tx => projetarFinanceiro(tx, p.pedidoId, adaptado, false))).toBeNull();
    await expect(sim.prisma.$transaction(tx => gerarTitulosIfood(tx, p.pedidoId, adaptado, new Date(), { id: sim.sessao.userId, nome: sim.sessao.nome }, {}))).rejects.toThrow("Acompanhamento");
    const forma = await sim.prisma.formaPagamentoVenda.create({ data: { nome: "Forma sintética", tipo: "OUTRO" } });
    const titulo = await sim.prisma.lancamentoFinanceiro.create({ data: { descricao: "Título indevido sintético", tipo: "RECEITA", categoriaId, valor: "25.70", dataCompetencia: new Date(), dataVencimento: new Date(), pedidoVendaId: p.pedidoId, pedidoEfeitoChave: "ifood:sintetico", pedidoParcelaRaiz: "sintetica", pedidoValorOriginal: "25.70", formaPagamentoVendaId: forma.id, pedidoFormaSnapshot: { tipo: "OUTRO" } } });
    await expect(baixarLancamento({ lancamentoId: titulo.id, contaBancariaId: "sem-conta", origemPedido: true })).rejects.toThrow("Acompanhamento"); await sim.prisma.lancamentoFinanceiro.delete({ where: { id: titulo.id } });
    await expect(prepararFiscalSaida(p.pedidoId, p.pedido.versao, sim.sessao)).rejects.toThrow("Acompanhamento");
    const fiscal = await sim.prisma.documentoFiscalSaida.create({ data: { pedidoId: p.pedidoId, versaoPedido: p.pedido.versao, payload: {}, hashPayload: "sintetico", criadoPorId: sim.sessao.userId, criadoPorNome: sim.sessao.nome, provedor: "emissor-sintetico", ambiente: "HOMOLOGACAO", acao: "ENVIAR", proximaTentativa: new Date(0) } });
    await processarFiscalSaida(); expect(sim.emitir).not.toHaveBeenCalled(); expect((await sim.prisma.documentoFiscalSaida.findUniqueOrThrow({ where: { id: fiscal.id } })).acao).toBeNull();
    const tela = await ConteudoComanda({ params: Promise.resolve({ id: p.pedidoId }) }); expect(tela.props.titulo).toBe("Acompanhamento — Takeat"); await semEfeitos();
    const alternativa = await OperacaoPage({ params: Promise.resolve({ id: p.pedidoId }) }); expect(alternativa.props.titulo).toBe("Acompanhamento — Takeat");
  });
  it("eventos atrasados não reabrem cancelado; projeção financeira de cancelamento também não opera", async () => {
    await persistirEventos(lojaId, [evento("CAN", 1000)]); await processarEvento(); await persistirEventos(lojaId, [evento("PLC", -10000)]); await processarEvento();
    expect((await pedido()).pedido.status).toBe("CANCELADO");
    const p = await pedido(); expect(await sim.prisma.$transaction(tx => projetarFinanceiro(tx, p.pedidoId, adaptarPedido(remoto, merchant, "PRODUCAO", "America/Sao_Paulo"), true))).toBeNull(); await semEfeitos();
  });
  it("expiração pausa polling sem mudar Takeat, ACK fora do inbox é bloqueado e histórico permanece protegido", async () => {
    await expect(requisicaoAutorizada(integracaoId, "/events/v1.0/events/acknowledgment", { metodo: "POST", corpo: [{ id: randomUUID() }] })).rejects.toThrow("persistidos");
    await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { pilotoAte: new Date(0), proximoPolling: new Date(0) } }); const antes = chamadas.length;
    expect(await coletarEventos()).toBe(false); expect(chamadas.length).toBe(antes); expect((await sim.prisma.lojaIfood.findUniqueOrThrow({ where: { id: lojaId } })).ativa).toBe(false);
    await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { modoOperacao: "OPERACAO" } });
    const p = await pedido(); await expect(solicitarAcao(p.pedidoId, p.pedido.versao, "confirm", {}, randomUUID(), sim.sessao)).rejects.toThrow("Acompanhamento"); expect(await sim.prisma.pedidoVenda.count()).toBe(1);
  });
  it("uma loja de acompanhamento sem liberação não bloqueia o coletor da loja de teste operacional", async () => {
    await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { modoOperacao: "ACOMPANHAMENTO", ativa: true, pilotoAte: new Date(Date.now() + 600000), pilotoPresencaReferencia: null, proximoPolling: new Date(0) } });
    const i = await sim.prisma.integracaoIfood.create({ data: { ambiente: "TESTE", modalidade: "CENTRALIZADO", clientId: randomUUID(), ativo: true, criadoPorId: sim.sessao.userId, tokenCifrado: cifrarIfood("token-teste-sintetico"), tokenExpiraEm: new Date(Date.now() + 3600000) } });
    const l = await sim.prisma.lojaIfood.create({ data: { integracaoId: i.id, ambiente: "TESTE", merchantId: randomUUID(), nome: "Operação sintética preservada", canalId, autorizada: true, ativa: true, ultimaAutorizacao: new Date(), proximoPolling: new Date(0) } });
    lote = []; expect(await coletarEventos()).toBe(true);
    expect((await sim.prisma.lojaIfood.findUniqueOrThrow({ where: { id: l.id } })).ultimoPolling).not.toBeNull(); await semEfeitos();
  });
});
