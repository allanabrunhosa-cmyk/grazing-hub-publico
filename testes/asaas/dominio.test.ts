import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { aplicaSituacao, ErroAsaas, instante, lerEvento, lerPagamento, lerReferenciaHub, linkAsaas, moeda, referenciaHub, situacaoDoStatus, titularCobranca, validarEntradaCobranca } from "@/lib/asaas/dominio";
import { chamarAsaas, FalhaHttpAsaas } from "@/lib/asaas/cliente";
import { ambienteAsaas, asaasAtivo, tokenWebhookAsaas } from "@/lib/asaas/configuracao";

const pagamento = (extra: Record<string, unknown> = {}) => ({ id: "pay_080225913252", customer: "cus_000005401844", status: "PENDING", billingType: "PIX", value: 129.9, netValue: 128.91, dueDate: "2026-12-01", externalReference: "hub:1234:ckv1abcdefghij0123456789", invoiceUrl: "https://sandbox.asaas.com/i/080225913252", bankSlipUrl: null, deleted: false, ...extra });

describe("Contrato do Asaas", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("lê a cobrança sem arredondar valores nem aceitar identificadores estranhos", () => {
    const p = lerPagamento(pagamento());
    expect(p.valor.toFixed(2)).toBe("129.90"); expect(p.liquido?.toFixed(2)).toBe("128.91");
    expect(p.situacao).toBe("AGUARDANDO"); expect(p.forma).toBe("PIX"); expect(p.vencimento?.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(() => lerPagamento(pagamento({ value: 10.999 }))).toThrow(ErroAsaas);
    expect(() => lerPagamento(pagamento({ id: "../payments" }))).toThrow(ErroAsaas);
    expect(() => moeda(-1)).toThrow(ErroAsaas);
  });

  it("mapeia status conhecidos e preserva os desconhecidos sem inventar situação", () => {
    expect(situacaoDoStatus("RECEIVED", false)).toBe("PAGA"); expect(situacaoDoStatus("CONFIRMED", false)).toBe("PAGA");
    expect(situacaoDoStatus("OVERDUE", false)).toBe("VENCIDA"); expect(situacaoDoStatus("REFUNDED", false)).toBe("ESTORNADA");
    expect(situacaoDoStatus("CHARGEBACK_REQUESTED", false)).toBe("CONTESTADA"); expect(situacaoDoStatus("PENDING", true)).toBe("REMOVIDA");
    expect(situacaoDoStatus("STATUS_FUTURO", false)).toBeNull();
  });

  it("evento antigo não desfaz pagamento mais recente", () => {
    const pago = { situacao: "PAGA", ultimoEventoEm: new Date("2026-11-23T15:00:00Z") };
    expect(aplicaSituacao(pago, "AGUARDANDO", new Date("2026-11-23T14:00:00Z"))).toBe(false);
    expect(aplicaSituacao(pago, "ESTORNADA", new Date("2026-11-23T16:00:00Z"))).toBe(true);
    expect(aplicaSituacao(pago, "VENCIDA", new Date("2026-11-23T15:00:00Z"))).toBe(false);
    expect(aplicaSituacao({ situacao: "AGUARDANDO", ultimoEventoEm: null }, "PAGA", null)).toBe(true);
  });

  it("aceita campos novos no evento e interpreta o horário de Brasília", () => {
    const e = lerEvento({ id: "evt_05b708f961d739ea7eba7e4db318f621&368604920", event: "PAYMENT_RECEIVED", dateCreated: "2026-11-23 16:45:03", campoNovo: { x: 1 }, payment: pagamento({ status: "RECEIVED" }) });
    expect(e.tipo).toBe("PAYMENT_RECEIVED"); expect(e.pagamentoId).toBe("pay_080225913252");
    expect(e.ocorridoEm?.toISOString()).toBe("2026-11-23T19:45:03.000Z");
    expect(instante("ontem")).toBeNull();
    expect(() => lerEvento({ id: "", event: "PAYMENT_RECEIVED" })).toThrow(ErroAsaas);
  });

  it("só oferece links do próprio Asaas", () => {
    expect(linkAsaas("https://www.asaas.com/i/abc")).toBe("https://www.asaas.com/i/abc");
    expect(linkAsaas("https://asaas.com.exemplo.invalid/i/abc")).toBeNull();
    expect(linkAsaas("http://www.asaas.com/i/abc")).toBeNull();
    expect(linkAsaas("javascript:alert(1)")).toBeNull();
  });

  it("referência do HUB identifica a cobrança local e recusa referências de terceiros", () => {
    expect(lerReferenciaHub(referenciaHub(1234, "ckv1abcdefghij0123456789"))).toEqual({ numero: 1234, cobrancaId: "ckv1abcdefghij0123456789" });
    expect(lerReferenciaHub("4521")).toBeNull(); expect(lerReferenciaHub(null)).toBeNull();
  });

  it("valida forma e vencimento da cobrança", () => {
    expect(validarEntradaCobranca({ forma: "PIX", vencimento: "2026-11-25" }, "2026-11-23")).toEqual({ forma: "PIX", vencimento: "2026-11-25" });
    expect(() => validarEntradaCobranca({ forma: "DINHEIRO", vencimento: "2026-11-25" }, "2026-11-23")).toThrow(ErroAsaas);
    expect(() => validarEntradaCobranca({ forma: "PIX", vencimento: "2026-11-22" }, "2026-11-23")).toThrow("passado");
    expect(() => validarEntradaCobranca({ forma: "PIX", vencimento: "2026-02-30" }, "2026-01-01")).toThrow(ErroAsaas);
    expect(() => validarEntradaCobranca({ forma: "BOLETO", vencimento: "2028-01-01" }, "2026-11-23")).toThrow("um ano");
  });

  it("titular vem da cobrança escolhida no pedido e exige CPF/CNPJ", () => {
    const comprador = { nome: "Pessoa Fictícia", documento: "123.456.789-09", email: "pessoa@example.invalid", telefone: "(11) 90000-0000" };
    expect(titularCobranca({ compradorSnapshot: comprador, cobrancaSnapshot: null })).toEqual({ name: "Pessoa Fictícia", cpfCnpj: "12345678909", email: "pessoa@example.invalid", mobilePhone: "11900000000" });
    expect(titularCobranca({ compradorSnapshot: comprador, cobrancaSnapshot: { tipo: "PJ", razaoSocial: "Empresa Fictícia Ltda", documento: "11.222.333/0001-81" } })).toMatchObject({ name: "Empresa Fictícia Ltda", cpfCnpj: "11222333000181" });
    expect(() => titularCobranca({ compradorSnapshot: { nome: "Sem Documento" }, cobrancaSnapshot: null })).toThrow("CPF ou CNPJ");
  });

  it("sem configuração explícita permanece desligado e em sandbox", () => {
    vi.stubEnv("ASAAS_ATIVO", ""); vi.stubEnv("ASAAS_AMBIENTE", ""); vi.stubEnv("ASAAS_SANDBOX_API_KEY", "chave-sintetica");
    expect(ambienteAsaas()).toBe("SANDBOX"); expect(asaasAtivo()).toBe(false);
    vi.stubEnv("ASAAS_ATIVO", "1"); expect(asaasAtivo()).toBe(true);
    vi.stubEnv("ASAAS_AMBIENTE", "PRODUCAO"); vi.stubEnv("ASAAS_PRODUCAO_API_KEY", "chave-sintetica"); expect(asaasAtivo()).toBe(false);
    vi.stubEnv("ASAAS_PRODUCAO_AUTORIZADA", "1"); expect(asaasAtivo()).toBe(true);
  });

  it("token do webhook exige tamanho mínimo e não pode ser a chave de API", () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "curto"); expect(tokenWebhookAsaas()).toBeNull();
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "$aact_" + "x".repeat(40)); expect(tokenWebhookAsaas()).toBeNull();
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "t".repeat(40)); expect(tokenWebhookAsaas()).toBe("t".repeat(40));
  });

  it("cliente HTTP usa destino fixo, não segue redirects e classifica respostas incertas", async () => {
    vi.stubEnv("ASAAS_SANDBOX_API_KEY", "chave-sintetica");
    const fetchSimulado = vi.fn(async (...args: [URL | string, RequestInit?]) => (void args, new Response(JSON.stringify({ errors: [{ code: "invalid_cpfCnpj", description: "CPF/CNPJ inválido." }] }), { status: 400 })));
    vi.stubGlobal("fetch", fetchSimulado);
    await expect(chamarAsaas("SANDBOX", "/customers", { metodo: "POST", corpo: {} })).rejects.toThrow("CPF/CNPJ inválido.");
    const [url, init] = fetchSimulado.mock.calls[0];
    expect(String(url)).toBe("https://api-sandbox.asaas.com/v3/customers"); expect(init?.redirect).toBe("error");
    expect((init?.headers as Record<string, string>).access_token).toBe("chave-sintetica");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("rede"); }));
    const erro = await chamarAsaas("SANDBOX", "/payments", { metodo: "POST", corpo: {} }).catch(e => e);
    expect(erro).toBeInstanceOf(FalhaHttpAsaas); expect((erro as FalhaHttpAsaas).incerta).toBe(true);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    expect(((await chamarAsaas("SANDBOX", "/payments").catch(e => e)) as FalhaHttpAsaas).incerta).toBe(false);
  });
});
