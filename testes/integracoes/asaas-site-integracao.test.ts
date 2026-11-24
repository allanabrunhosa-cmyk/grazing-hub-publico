import { prepararMigrationHubIsolada, limparIntegracaoHubIsolada } from "../login/migrations-hub-isoladas";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type { SessaoAtual } from "@/lib/session";
import { pedidoSite } from "../site/fixtures";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("server-only", () => ({}));
import { cancelarCobrancaAsaas, gerarCobrancaAsaas, pixCobrancaAsaas, reconciliarCobrancasIncertas } from "@/lib/asaas/cobrancas";
import { processarEventoAsaas, receberEventoAsaas } from "@/lib/asaas/eventos";
import { referenciaHub } from "@/lib/asaas/dominio";
import { salvarIntegracaoSite } from "@/lib/site/configuracao";
import { coletarPedidosSite, processarEventoSite, receberAvisoSite } from "@/lib/site/processamento";

const esquema = "teste_integracoes_" + randomUUID().replaceAll("-", "");
const TOKEN = "token-sintetico-de-webhook-asaas-0000000001", SEGREDO = "segredo-sintetico-de-webhook-site-01";
let banco: Client, admin: SessaoAtual, leitor: SessaoAtual, canalId: string;
// Simulador HTTP: nenhum serviço externo é chamado.
const asaas = { clientes: 0, cobrancas: [] as Record<string, unknown>[], falhaRede: false, removidas: [] as string[] };
const site = { pedidos: new Map<string, Record<string, unknown>>(), leituras: 0 };
const resposta = (dados: unknown, status = 200, headers = {}) => new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json", ...headers } });
const hoje = () => new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

async function pedidoInterno(total: string, comprador: Record<string, string> = { nome: "Pessoa Fictícia", documento: "123.456.789-09", email: "pessoa@example.invalid" }) {
  return sim.prisma.pedidoVenda.create({ data: { status: "CONFIRMADO", origem: "INTERNO", modoFinanceiro: "EXTERNO", versaoFinanceiro: 1, total, subtotal: total, compradorSnapshot: comprador, chaveCriacao: randomUUID(), hashCriacao: "sintetico", criadoPorId: admin.userId, confirmadoEm: new Date(), canalId } });
}
const eventoAsaas = (tipo: string, pagamento: Record<string, unknown>, quando: string) => JSON.stringify({ id: "evt_" + randomUUID(), event: tipo, dateCreated: quando, payment: pagamento });
async function avisar(id: number, entrega = randomUUID()) {
  const corpo = Buffer.from(JSON.stringify({ id }));
  return receberAvisoSite(corpo, { assinatura: createHmac("sha256", SEGREDO).update(corpo).digest("base64"), topico: "order.updated", entrega });
}
async function esvaziar(processar: () => Promise<boolean>) { for (let n = 0; n < 20; n++) if (!await processar()) return; }

describe.skipIf(process.env.INTEGRACOES_BANCO_TESTE !== "1")("Asaas e Site com PostgreSQL isolado e HTTP simulado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.includes("teste")) throw new Error("Exige banco local nomeado teste.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query('CREATE SCHEMA "' + esquema + '"'); await banco.query('SET search_path TO "' + esquema + '"');
    for (const p of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await banco.query(await prepararMigrationHubIsolada(banco, esquema, p.name, await readFile("prisma/migrations/" + p.name + "/migration.sql", "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: "-c search_path=" + esquema }, { schema: esquema }) });
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Operador fictício", email: "integracoes@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    const r = await sim.prisma.perfilAcesso.create({ data: { nome: "Leitura integrações", permissoes: { "vendas.pedidos": ["visualizar"] } } });
    const v = await sim.prisma.usuario.create({ data: { nome: "Leitor fictício", email: "leitor-integracoes@example.invalid", senhaHash: "inutil", perfilAcessoId: r.id } });
    admin = { userId: u.id, nome: u.nome, versao: 0 } as SessaoAtual; leitor = { ...admin, userId: v.id };
    canalId = (await sim.prisma.canalVenda.create({ data: { nome: "Site sintético" } })).id;
    for (const [k, valor] of Object.entries({ AUTH_SECRET: "chave-exclusivamente-sintetica-para-testes-locais", ASAAS_ATIVO: "1", ASAAS_AMBIENTE: "SANDBOX", ASAAS_SANDBOX_API_KEY: "chave-sintetica", ASAAS_WEBHOOK_TOKEN: TOKEN, SITE_ATIVO: "1", SITE_URL: "https://loja.example.invalid", SITE_CONSUMER_KEY: "ck_sintetica", SITE_CONSUMER_SECRET: "cs_sintetica", SITE_WEBHOOK_SECRET: SEGREDO })) vi.stubEnv(k, valor);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const u = new URL(String(input)), metodo = init?.method ?? "GET";
      if (u.hostname === "loja.example.invalid") {
        site.leituras++;
        if (u.pathname.endsWith("/orders")) return resposta([...site.pedidos.values()], 200, { "x-wp-totalpages": "1" });
        const p = site.pedidos.get(u.pathname.split("/").pop()!);
        return p ? resposta(p) : resposta({ code: "woocommerce_rest_shop_order_invalid_id" }, 404);
      }
      if (u.hostname !== "api-sandbox.asaas.com") throw new Error("Destino inesperado: " + u.hostname);
      if (u.pathname === "/v3/customers" && metodo === "GET") return resposta({ data: [] });
      if (u.pathname === "/v3/customers") { asaas.clientes++; return resposta({ id: "cus_00000000" + asaas.clientes }); }
      if (u.pathname === "/v3/payments" && metodo === "POST") {
        const corpo = JSON.parse(String(init?.body));
        const pg = { id: "pay_sintetico" + String(asaas.cobrancas.length + 1).padStart(4, "0"), customer: corpo.customer, status: "PENDING", billingType: corpo.billingType, value: corpo.value, netValue: corpo.value, dueDate: corpo.dueDate, externalReference: corpo.externalReference, invoiceUrl: "https://sandbox.asaas.com/i/sintetico", deleted: false };
        asaas.cobrancas.push(pg);
        // A cobrança existe no Asaas, mas a resposta se perde no caminho.
        if (asaas.falhaRede) throw new Error("Rede simulada");
        return resposta(pg);
      }
      if (u.pathname === "/v3/payments") return resposta({ data: asaas.cobrancas.filter(c => c.externalReference === u.searchParams.get("externalReference")) });
      if (u.pathname.endsWith("/pixQrCode")) return resposta({ payload: "00020126sintetico", encodedImage: "aGVsbG8=", expirationDate: "2027-01-01 23:59:59" });
      if (metodo === "DELETE") { asaas.removidas.push(u.pathname.split("/").pop()!); return resposta({ deleted: true, id: u.pathname.split("/").pop() }); }
      return resposta({}, 404);
    }));
  }, 180000);
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (banco) { await limparIntegracaoHubIsolada(banco, esquema); if (/^teste_integracoes_[a-f0-9]{32}$/.test(esquema)) await banco.query('DROP SCHEMA "' + esquema + '" CASCADE'); await banco.end(); }
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });

  it("gera a cobrança do pedido uma única vez e registra no histórico", async () => {
    const p = await pedidoInterno("129.90"), operacao = randomUUID();
    const c = await gerarCobrancaAsaas(p.id, { forma: "PIX", vencimento: hoje() }, operacao, admin);
    expect(c).toMatchObject({ estado: "ATIVA", situacao: "AGUARDANDO", valor: "129.90", forma: "PIX", link: "https://sandbox.asaas.com/i/sintetico" });
    expect(asaas.cobrancas.at(-1)).toMatchObject({ value: 129.9, billingType: "PIX", externalReference: referenciaHub(p.numero, c.id) });
    const antes = asaas.cobrancas.length;
    expect((await gerarCobrancaAsaas(p.id, { forma: "PIX", vencimento: hoje() }, operacao, admin)).id).toBe(c.id);
    await expect(gerarCobrancaAsaas(p.id, { forma: "BOLETO", vencimento: hoje() }, operacao, admin)).rejects.toThrow("outros dados");
    await expect(gerarCobrancaAsaas(p.id, { forma: "BOLETO", vencimento: hoje() }, randomUUID(), admin)).rejects.toThrow("em aberto");
    expect(asaas.cobrancas.length).toBe(antes);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "ASAAS_COBRANCA_CRIADA" } })).toBe(1);
    expect(await sim.prisma.lancamentoFinanceiro.count({ where: { pedidoVendaId: p.id } })).toBe(0);
    expect(await pixCobrancaAsaas(c.id, admin)).toMatchObject({ copiaCola: "00020126sintetico", imagem: "data:image/png;base64,aGVsbG8=" });
  });

  it("recusa quem não pode confirmar pedidos, pedidos sem documento e pedidos não confirmados", async () => {
    const p = await pedidoInterno("50.00");
    await expect(gerarCobrancaAsaas(p.id, { forma: "PIX", vencimento: hoje() }, randomUUID(), leitor)).rejects.toThrow("acesso");
    const semDocumento = await pedidoInterno("50.00", { nome: "Sem Documento" });
    await expect(gerarCobrancaAsaas(semDocumento.id, { forma: "PIX", vencimento: hoje() }, randomUUID(), admin)).rejects.toThrow("CPF ou CNPJ");
    await sim.prisma.pedidoVenda.update({ where: { id: p.id }, data: { status: "RASCUNHO" } });
    await expect(gerarCobrancaAsaas(p.id, { forma: "PIX", vencimento: hoje() }, randomUUID(), admin)).rejects.toThrow("Confirme o pedido");
    expect(await sim.prisma.cobrancaAsaas.count({ where: { pedidoId: { in: [p.id, semDocumento.id] } } })).toBe(0);
  });

  it("webhook autentica, persiste uma vez e o pagamento é registrado sem regredir", async () => {
    const p = await pedidoInterno("80.00");
    const c = await gerarCobrancaAsaas(p.id, { forma: "PIX", vencimento: hoje() }, randomUUID(), admin);
    const remoto = asaas.cobrancas.at(-1)!;
    const pago = eventoAsaas("PAYMENT_RECEIVED", { ...remoto, status: "RECEIVED", netValue: 79.01, clientPaymentDate: hoje() }, "2026-11-23 16:00:00");
    const criado = eventoAsaas("PAYMENT_CREATED", remoto, "2026-11-23 15:00:00");
    expect((await receberEventoAsaas(pago, "token-errado")).status).toBe(401);
    expect((await receberEventoAsaas(pago, null)).status).toBe(401);
    expect((await receberEventoAsaas("{", TOKEN)).status).toBe(400);
    expect((await receberEventoAsaas(pago, TOKEN)).status).toBe(200);
    expect((await receberEventoAsaas(pago, TOKEN)).status).toBe(200);
    expect(await sim.prisma.eventoAsaas.count({ where: { pagamentoId: String(remoto.id) } })).toBe(1);
    await esvaziar(processarEventoAsaas);
    // Evento anterior entregue fora de ordem não desfaz o pagamento.
    expect((await receberEventoAsaas(criado, TOKEN)).status).toBe(200);
    await esvaziar(processarEventoAsaas);
    const atual = await sim.prisma.cobrancaAsaas.findUniqueOrThrow({ where: { id: c.id } });
    expect(atual.situacao).toBe("PAGA"); expect(atual.valorLiquido?.toFixed(2)).toBe("79.01"); expect(atual.pagoEm).not.toBeNull();
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "ASAAS_PAGAMENTO_CONFIRMADO" } })).toBe(1);
    expect(await sim.prisma.eventoAsaas.count({ where: { pagamentoId: String(remoto.id), estado: "PROCESSADO" } })).toBe(2);
    // O payload fica cifrado em repouso.
    expect((await sim.prisma.eventoAsaas.findFirstOrThrow({ where: { pagamentoId: String(remoto.id) } })).payloadCifrado).not.toContain("pay_");
    await expect(gerarCobrancaAsaas(p.id, { forma: "PIX", vencimento: hoje() }, randomUUID(), admin)).rejects.toThrow("já tem cobrança paga");
    await expect(cancelarCobrancaAsaas(c.id, admin)).rejects.toThrow("em aberto");
  });

  it("resposta incerta não vira segunda cobrança e é resolvida pela referência", async () => {
    const p = await pedidoInterno("60.00");
    asaas.falhaRede = true;
    const c = await gerarCobrancaAsaas(p.id, { forma: "BOLETO", vencimento: hoje() }, randomUUID(), admin);
    asaas.falhaRede = false;
    expect(c.estado).toBe("INCERTA");
    await expect(gerarCobrancaAsaas(p.id, { forma: "BOLETO", vencimento: hoje() }, randomUUID(), admin)).rejects.toThrow("em aberto");
    await reconciliarCobrancasIncertas();
    const atual = await sim.prisma.cobrancaAsaas.findUniqueOrThrow({ where: { id: c.id } });
    expect(atual.estado).toBe("ATIVA"); expect(atual.asaasId).toBe(String(asaas.cobrancas.at(-1)!.id));
    expect(asaas.cobrancas.filter(x => x.externalReference === referenciaHub(p.numero, c.id))).toHaveLength(1);
    expect((await cancelarCobrancaAsaas(c.id, admin)).situacao).toBe("REMOVIDA");
    expect(asaas.removidas).toContain(atual.asaasId);
    // Com a anterior cancelada, uma nova cobrança é permitida.
    expect((await gerarCobrancaAsaas(p.id, { forma: "PIX", vencimento: hoje() }, randomUUID(), admin)).estado).toBe("ATIVA");
  });

  it("recebe o pedido do site uma única vez, com itens, valores e canal", async () => {
    await expect(salvarIntegracaoSite({ canalId, ativa: true }, leitor)).rejects.toThrow("administradores");
    await salvarIntegracaoSite({ canalId, ativa: true }, admin);
    site.pedidos.set("4521", pedidoSite());
    const corpo = Buffer.from(JSON.stringify({ id: 4521 }));
    expect((await receberAvisoSite(corpo, { assinatura: "assinatura-invalida", topico: "order.created", entrega: "1" })).status).toBe(401);
    const entrega = randomUUID();
    expect((await avisar(4521, entrega)).status).toBe(200); expect((await avisar(4521, entrega)).status).toBe(200);
    expect(await sim.prisma.eventoSite.count()).toBe(1);
    await esvaziar(processarEventoSite);
    const externo = await sim.prisma.pedidoSite.findFirstOrThrow({ where: { externoId: "4521" }, include: { pedido: { include: { itens: true } } } });
    expect(externo.pedido).toMatchObject({ origem: "SITE", status: "CONFIRMADO", statusOperacional: "PENDENTE", modoFinanceiro: "EXTERNO", canalId, canalNomeSnapshot: "Site sintético", referenciaOrigem: "SITE", referenciaEstabelecimento: "loja.example.invalid", referenciaPedido: "4521" });
    expect(externo.pedido.total.toFixed(2)).toBe("315.00"); expect(externo.pedido.itens).toHaveLength(2); expect(externo.pedido.confirmadoEm).not.toBeNull();
    expect(externo.pendencia).toBe("2 itens sem produto vinculado no HUB"); expect(externo.asaasPagamentoId).toBe("pay_abc123def456");
    expect(externo.snapshotCifrado).not.toContain("Fictícia");
    // Novo aviso sem mudança de conteúdo não cria versão nem duplica o pedido.
    await avisar(4521); await esvaziar(processarEventoSite);
    expect(await sim.prisma.pedidoVenda.count({ where: { referenciaOrigem: "SITE", referenciaPedido: "4521" } })).toBe(1);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: externo.pedidoId } })).versao).toBe(1);
    expect(await sim.prisma.eventoSite.count({ where: { estado: "PROCESSADO" } })).toBe(2);
  });

  it("vincula ao pedido do site a cobrança criada pelo checkout", async () => {
    const pg = { id: "pay_abc123def456", customer: "cus_000000099", status: "RECEIVED", billingType: "PIX", value: 315, netValue: 311.87, dueDate: hoje(), externalReference: "4521", invoiceUrl: "https://sandbox.asaas.com/i/site", deleted: false };
    expect((await receberEventoAsaas(eventoAsaas("PAYMENT_RECEIVED", pg, "2026-11-23 22:40:00"), TOKEN)).status).toBe(200);
    await esvaziar(processarEventoAsaas);
    const externo = await sim.prisma.pedidoSite.findFirstOrThrow({ where: { externoId: "4521" } });
    const c = await sim.prisma.cobrancaAsaas.findFirstOrThrow({ where: { pedidoId: externo.pedidoId } });
    expect(c).toMatchObject({ origem: "SITE", estado: "ATIVA", situacao: "PAGA", asaasId: "pay_abc123def456" });
    // Cobrança sem pedido correspondente aguarda; não é atribuída a pedido algum.
    await receberEventoAsaas(eventoAsaas("PAYMENT_RECEIVED", { ...pg, id: "pay_desconhecido01", externalReference: "999999" }, "2026-11-23 22:41:00"), TOKEN);
    await esvaziar(processarEventoAsaas);
    expect(await sim.prisma.cobrancaAsaas.count({ where: { asaasId: "pay_desconhecido01" } })).toBe(0);
    expect((await sim.prisma.eventoAsaas.findFirstOrThrow({ where: { pagamentoId: "pay_desconhecido01" } })).estado).toBe("PENDENTE");
  });

  it("aplica alteração e cancelamento vindos do site, respeitando a produção iniciada", async () => {
    const externo = await sim.prisma.pedidoSite.findFirstOrThrow({ where: { externoId: "4521" } });
    site.pedidos.set("4521", pedidoSite({ customer_note: "Entregar no bloco B", date_modified_gmt: "2026-11-24T02:00:00" }));
    await avisar(4521); await esvaziar(processarEventoSite);
    let pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: externo.pedidoId } });
    expect(pedido.observacoes).toBe("Entregar no bloco B"); expect(pedido.versao).toBe(2);
    expect(await sim.prisma.itemPedidoVenda.count({ where: { pedidoId: pedido.id, vigente: true } })).toBe(2);
    // Produção iniciada: cancelamento do site vira pendência, não interrompe sozinho.
    await sim.prisma.pedidoVenda.update({ where: { id: pedido.id }, data: { statusOperacional: "EM_PREPARO" } });
    site.pedidos.set("4521", pedidoSite({ customer_note: "Entregar no bloco B", status: "cancelled", date_modified_gmt: "2026-11-24T03:00:00" }));
    await avisar(4521); await esvaziar(processarEventoSite);
    pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: externo.pedidoId } });
    expect(pedido.status).toBe("CONFIRMADO");
    expect((await sim.prisma.pedidoSite.findUniqueOrThrow({ where: { id: externo.id } })).pendencia).toContain("Cancelado no site com produção iniciada");
    // Sem produção iniciada o cancelamento é aplicado.
    await sim.prisma.pedidoVenda.update({ where: { id: pedido.id }, data: { statusOperacional: "PENDENTE" } });
    await avisar(4521); await esvaziar(processarEventoSite);
    pedido = await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: externo.pedidoId } });
    expect(pedido).toMatchObject({ status: "CANCELADO", statusOperacional: "INTERROMPIDO" }); expect(pedido.canceladoEm).not.toBeNull();
  });

  it("a coleta periódica recupera pedidos sem aviso e ignora rascunhos e cancelados inéditos", async () => {
    site.pedidos.set("4600", pedidoSite({ id: 4600, number: "4600", status: "on-hold", date_paid_gmt: null, transaction_id: "", meta_data: [], date_modified_gmt: "2026-11-24T04:00:00" }));
    site.pedidos.set("4601", pedidoSite({ id: 4601, number: "4601", status: "checkout-draft" }));
    site.pedidos.set("4602", pedidoSite({ id: 4602, number: "4602", status: "cancelled" }));
    await sim.prisma.integracaoSite.updateMany({ data: { proximaColeta: new Date(Date.now() - 1000) } });
    expect(await coletarPedidosSite()).toBe(true);
    await esvaziar(processarEventoSite);
    const novo = await sim.prisma.pedidoSite.findFirstOrThrow({ where: { externoId: "4600" }, include: { pedido: true } });
    expect(novo.pedido.status).toBe("RECEBIDO_EXTERNO"); expect(novo.pedido.confirmadoEm).toBeNull();
    expect(novo.pendencia).toContain("Data de entrega não identificada");
    expect(await sim.prisma.pedidoSite.count({ where: { externoId: { in: ["4601", "4602"] } } })).toBe(0);
    // O pagamento confirmado no site confirma o pedido no HUB.
    site.pedidos.set("4600", pedidoSite({ id: 4600, number: "4600", status: "processing", transaction_id: "", meta_data: [], date_modified_gmt: "2026-11-24T05:00:00" }));
    await sim.prisma.integracaoSite.updateMany({ data: { proximaColeta: new Date(Date.now() - 1000) } });
    await coletarPedidosSite(); await esvaziar(processarEventoSite);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: novo.pedidoId } })).status).toBe("CONFIRMADO");
    expect((await sim.prisma.integracaoSite.findFirstOrThrow()).ultimoErro).toBeNull();
  });

  it("integração pausada confirma o aviso sem gravar e não processa a fila", async () => {
    await salvarIntegracaoSite({ canalId, ativa: false }, admin);
    const antes = await sim.prisma.eventoSite.count();
    expect((await avisar(4521)).status).toBe(200);
    expect(await sim.prisma.eventoSite.count()).toBe(antes);
    expect(await coletarPedidosSite()).toBe(false);
  });
});
