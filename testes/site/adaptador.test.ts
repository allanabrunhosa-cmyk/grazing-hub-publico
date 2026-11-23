import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { adaptarPedidoSite, dataEntrega, ErroSite, METAS_DATA_PADRAO, METAS_JANELA_PADRAO, pagamentoAsaas, resumoComercial } from "@/lib/site/adaptador";
import { baseSite, chamarSite, metasEntregaSite, segredoWebhookSite, siteAtivo } from "@/lib/site/cliente";
import { assinaturaValida } from "@/lib/site/processamento";
import { pedidoSite } from "./fixtures";

const cfg = { fuso: "America/Sao_Paulo", metasData: METAS_DATA_PADRAO, metasJanela: METAS_JANELA_PADRAO };

describe("Pedido do site (WooCommerce) no formato do HUB", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("preserva itens, descontos, frete, total e identidade do comprador", () => {
    const p = adaptarPedidoSite(pedidoSite(), cfg);
    expect(p.externoId).toBe("4521"); expect(p.statusInterno).toBe("CONFIRMADO"); expect(p.pendencias).toEqual([]);
    expect(p.dados).toMatchObject({ origem: "SITE", atendimento: "ENTREGA", subtotal: "300.00", desconto: "10.00", frete: "25.00", outrosCustos: "0.00", total: "315.00", formaPagamentoInformada: "PIX", observacoes: "Entregar na portaria" });
    expect(p.itens[0]).toMatchObject({ quantidade: "2", precoOriginal: "125.00", desconto: "10.00", totalLinha: "240.00", chaves: ["901", "900"], sku: "GT-001" });
    expect(p.itens[0].escolhasSnapshot).toEqual([{ grupoNome: "Tamanho", opcaoNome: "Grande", quantidade: 1, preco: "0.00" }]);
    expect(p.cliente).toEqual({ documento: "12345678909", email: "pessoa@example.invalid", nome: "Pessoa Fictícia", tipo: "PF", telefone: "11900000000" });
    expect(p.dados.destinatarioSnapshot).toEqual({ nome: "Destinatária Sintética", contato: "11900000000" });
    expect(p.dados.enderecoSnapshot).toMatchObject({ logradouro: "Avenida Sintética", numero: "200", bairro: "Bairro Teste", cep: "02000000" });
    expect(p.asaasPagamentoId).toBe("pay_abc123def456");
  });

  it("lê a entrega agendada e os instantes GMT do site", () => {
    const p = adaptarPedidoSite(pedidoSite(), cfg);
    expect(p.criadoEm.toISOString()).toBe("2026-11-24T01:30:00.000Z"); expect(p.pagoEm?.toISOString()).toBe("2026-11-24T01:34:00.000Z");
    expect(p.dados.previsaoData?.toISOString()).toBe("2026-11-28T00:00:00.000Z"); expect(p.dados.previsaoJanela).toBe("14:00 - 16:00");
    expect(dataEntrega("2026-11-28", cfg.fuso)).toBe("2026-11-28"); expect(dataEntrega("31/02/2026", cfg.fuso)).toBeNull(); expect(dataEntrega("sexta", cfg.fuso)).toBeNull();
  });

  it("sem data de entrega reconhecida registra pendência em vez de supor uma data", () => {
    const p = adaptarPedidoSite(pedidoSite({ meta_data: [] }), cfg);
    expect(p.dados.previsaoData).toBeNull(); expect(p.pendencias).toContain("Data de entrega não identificada no pedido do site");
    const q = adaptarPedidoSite(pedidoSite({ meta_data: [{ key: "_delivery_date", value: "semana que vem" }] }), cfg);
    expect(q.pendencias).toContain("Data de entrega do site em formato não reconhecido");
  });

  it("mapeia status, mantém os desconhecidos como pendência e identifica retirada", () => {
    expect(adaptarPedidoSite(pedidoSite({ status: "on-hold", date_paid_gmt: null }), cfg).statusInterno).toBe("RECEBIDO_EXTERNO");
    expect(adaptarPedidoSite(pedidoSite({ status: "refunded" }), cfg).statusInterno).toBe("CANCELADO");
    const custom = adaptarPedidoSite(pedidoSite({ status: "em-producao" }), cfg);
    expect(custom.statusInterno).toBe("CONFIRMADO"); expect(custom.pendencias).toContain("Status do site não mapeado: em-producao");
    const retirada = adaptarPedidoSite(pedidoSite({ shipping_lines: [{ method_title: "Retirada", method_id: "local_pickup", total: "0.00" }], shipping_total: "0.00", total: "290.00" }), cfg);
    expect(retirada.dados.atendimento).toBe("RETIRADA"); expect(retirada.dados.enderecoSnapshot).toBeNull(); expect(retirada.pendencias).toEqual([]);
  });

  it("sinaliza totais que não fecham e recusa moeda, quantidade ou valores inválidos", () => {
    expect(adaptarPedidoSite(pedidoSite({ total: "999.00" }), cfg).pendencias).toContain("Totais do site não reconciliados");
    expect(() => adaptarPedidoSite(pedidoSite({ currency: "USD" }), cfg)).toThrow(ErroSite);
    expect(() => adaptarPedidoSite(pedidoSite({ line_items: [] }), cfg)).toThrow("sem itens");
    expect(() => adaptarPedidoSite(pedidoSite({ line_items: [{ id: 1, name: "x", quantity: 0, subtotal: "1.00", total: "1.00" }] }), cfg)).toThrow(ErroSite);
    expect(() => adaptarPedidoSite(pedidoSite({ id: "4521/../1" }), cfg)).toThrow(ErroSite);
  });

  it("trata taxa negativa como desconto e taxa positiva como outro custo", () => {
    const p = adaptarPedidoSite(pedidoSite({ fee_lines: [{ name: "Desconto Pix", total: "-15.00" }, { name: "Embalagem", total: "5.00" }], total: "305.00" }), cfg);
    expect(p.dados.desconto).toBe("25.00"); expect(p.dados.outrosCustos).toBe("5.00"); expect(p.pendencias).toEqual([]);
  });

  it("identifica pessoa jurídica pelo CNPJ e conserva o contato", () => {
    const p = adaptarPedidoSite(pedidoSite({ billing: { ...pedidoSite().billing, persontype: "J", cnpj: "11.222.333/0001-81", company: "Empresa Fictícia Ltda" } }), cfg);
    expect(p.cliente).toMatchObject({ tipo: "PJ", documento: "11222333000181", nome: "Empresa Fictícia Ltda" });
    expect(p.dados.compradorSnapshot).toMatchObject({ nome: "Empresa Fictícia Ltda", contato: "Pessoa Fictícia" });
  });

  it("encontra a cobrança do Asaas no transaction_id ou nos metadados do plugin", () => {
    expect(pagamentoAsaas({ transaction_id: "pay_abc123def456" })).toBe("pay_abc123def456");
    expect(pagamentoAsaas({ transaction_id: "", meta_data: [{ key: "__ASAAS_ORDER__", value: { id: "pay_zzz999yyy888" } }] })).toBe("pay_zzz999yyy888");
    expect(pagamentoAsaas({ transaction_id: "MP-123", meta_data: [{ key: "outro", value: "pay_abc123def456" }] })).toBeNull();
  });

  it("o resumo comercial ignora metadados técnicos e muda quando o conteúdo muda", () => {
    const base = JSON.stringify(resumoComercial(adaptarPedidoSite(pedidoSite(), cfg)));
    expect(JSON.stringify(resumoComercial(adaptarPedidoSite(pedidoSite({ date_modified_gmt: "2026-11-25T10:00:00", status: "completed" }), cfg)))).toBe(base);
    expect(JSON.stringify(resumoComercial(adaptarPedidoSite(pedidoSite({ customer_note: "Outra observação" }), cfg)))).not.toBe(base);
  });

  it("assinatura do webhook confere os bytes originais", () => {
    const corpo = Buffer.from(JSON.stringify({ id: 4521 })), segredo = "segredo-sintetico-de-webhook-0001";
    const assinatura = createHmac("sha256", segredo).update(corpo).digest("base64");
    expect(assinaturaValida(corpo, assinatura, segredo)).toBe(true);
    expect(assinaturaValida(Buffer.from(JSON.stringify({ id: 4522 })), assinatura, segredo)).toBe(false);
    expect(assinaturaValida(corpo, assinatura, "outro-segredo-sintetico-000000001")).toBe(false);
    expect(assinaturaValida(corpo, null, segredo)).toBe(false); expect(assinaturaValida(corpo, "nao-base64!", segredo)).toBe(false);
  });

  it("configuração exige HTTPS, chave de leitura e permanece desligada por padrão", async () => {
    vi.stubEnv("SITE_URL", "http://loja.example.invalid"); expect(baseSite()).toBeNull();
    vi.stubEnv("SITE_URL", "https://usuario:senha@loja.example.invalid"); expect(baseSite()).toBeNull();
    vi.stubEnv("SITE_URL", "https://Loja.Example.invalid/"); expect(baseSite()).toEqual({ origem: "https://loja.example.invalid", loja: "loja.example.invalid" });
    vi.stubEnv("SITE_CONSUMER_KEY", "ck_sintetica"); vi.stubEnv("SITE_CONSUMER_SECRET", "cs_sintetica"); vi.stubEnv("SITE_ATIVO", "");
    expect(siteAtivo()).toBe(false); vi.stubEnv("SITE_ATIVO", "1"); expect(siteAtivo()).toBe(true);
    vi.stubEnv("SITE_WEBHOOK_SECRET", "curto"); expect(segredoWebhookSite()).toBeNull();
    vi.stubEnv("SITE_META_DATA_ENTREGA", " data_personalizada , outra "); expect(metasEntregaSite().metasData).toEqual(["data_personalizada", "outra"]);
    const fetchSimulado = vi.fn(async (...args: [URL | string, RequestInit?]) => (void args, new Response("[]", { status: 200, headers: { "x-wp-totalpages": "3" } })));
    vi.stubGlobal("fetch", fetchSimulado);
    expect(await chamarSite("/orders", { per_page: "1" })).toEqual({ dados: [], paginas: 3 });
    const [url, init] = fetchSimulado.mock.calls[0];
    expect(String(url)).toBe("https://loja.example.invalid/wp-json/wc/v3/orders?per_page=1"); expect(init?.method).toBe("GET"); expect(init?.redirect).toBe("error");
  });
});
