import { Prisma } from "@/generated/prisma/client";
import { diaNoFuso } from "@/lib/vendas/pedidos-agenda-dominio";

export class ErroSite extends Error {}

export function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroSite("Resposta do site fora do contrato.");
  return v as Record<string, unknown>;
}
const opcional = (v: unknown) => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const lista = (v: unknown) => Array.isArray(v) ? v : [];
export const texto = (v: unknown, max = 500) => typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" && Number.isFinite(v) ? String(v) : "";
const digitos = (v: unknown) => texto(v, 60).replace(/\D/g, "");

/** O WooCommerce envia dinheiro como texto decimal; linhas podem trazer mais casas quando há imposto. */
export function moeda(v: unknown) {
  if ((typeof v !== "string" && typeof v !== "number") || !/^-?\d{1,12}(\.\d{1,6})?$/.test(String(v))) throw new ErroSite("Valor monetário do site inválido.");
  return new Prisma.Decimal(String(v)).toDecimalPlaces(2);
}
export function idExterno(v: unknown): string {
  if ((typeof v !== "number" && typeof v !== "string") || !/^[1-9]\d{0,14}$/.test(String(v))) throw new ErroSite("Identificador do pedido do site inválido.");
  return String(v);
}
/** Campos *_gmt chegam em ISO 8601 sem sufixo de fuso. */
export function instanteGmt(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(v + "Z");
  return Number.isFinite(d.getTime()) ? d : null;
}

export type ConfiguracaoAdaptadorSite = { fuso: string; metasData: string[]; metasJanela: string[] };
export const METAS_DATA_PADRAO = ["_delivery_date", "delivery_date", "_orddd_timestamp", "Data de entrega", "Data da entrega", "jckwds_date", "_billing_delivery_date", "billing_delivery_date"];
export const METAS_JANELA_PADRAO = ["_delivery_time", "delivery_time", "_orddd_time_slot", "Horário de entrega", "Horário da entrega", "jckwds_timeslot", "_billing_delivery_time", "billing_delivery_time"];

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
function meta(metas: unknown[], chaves: string[]) {
  const alvo = chaves.map(normal);
  for (const m of metas) {
    const o = opcional(m);
    if (alvo.includes(normal(texto(o.key, 200))) && (typeof o.value === "string" || typeof o.value === "number") && texto(o.value)) return texto(o.value, 200);
  }
  return "";
}
/** Aceita AAAA-MM-DD, DD/MM/AAAA e carimbo Unix; qualquer outro formato vira pendência, nunca palpite. */
export function dataEntrega(valor: string, fuso: string): string | null {
  let dia: string | null = null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor), br = /^(\d{2})[/.-](\d{2})[/.-](\d{4})/.exec(valor);
  if (iso) dia = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (br) dia = `${br[3]}-${br[2]}-${br[1]}`;
  else if (/^\d{10}$/.test(valor)) dia = diaNoFuso(new Date(Number(valor) * 1000), fuso);
  if (!dia) return null;
  const d = new Date(`${dia}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === dia ? dia : null;
}

const FORMAS: [RegExp, string][] = [[/pix/i, "PIX"], [/ticket|boleto|bank[-_ ]?slip/i, "BOLETO"], [/debit|debito/i, "CARTAO_DEBITO"], [/credit|cartao|card/i, "CARTAO_CREDITO"]];
/** Procura o identificador da cobrança do Asaas onde o plugin do site costuma gravá-lo. */
export function pagamentoAsaas(pedido: Record<string, unknown>): string | null {
  const padrao = /pay_[A-Za-z0-9]{6,80}/;
  const direto = padrao.exec(texto(pedido.transaction_id, 200));
  if (direto) return direto[0];
  for (const m of lista(pedido.meta_data)) {
    const o = opcional(m);
    if (!/asaas/i.test(texto(o.key, 200))) continue;
    const achado = padrao.exec(typeof o.value === "string" ? o.value.slice(0, 5000) : JSON.stringify(o.value ?? "").slice(0, 5000));
    if (achado) return achado[0];
  }
  return null;
}

const STATUS: Record<string, "RECEBIDO_EXTERNO" | "CONFIRMADO" | "CANCELADO"> = {
  pending: "RECEBIDO_EXTERNO", "on-hold": "RECEBIDO_EXTERNO", failed: "RECEBIDO_EXTERNO",
  processing: "CONFIRMADO", completed: "CONFIRMADO",
  cancelled: "CANCELADO", refunded: "CANCELADO", trash: "CANCELADO",
};
export const STATUS_IGNORADOS = ["checkout-draft", "auto-draft", "draft"];

export function adaptarPedidoSite(valor: unknown, cfg: ConfiguracaoAdaptadorSite) {
  const p = objeto(valor), cobranca = opcional(p.billing), entrega = opcional(p.shipping), metas = lista(p.meta_data), pendencias: string[] = [];
  const moedaPedido = texto(p.currency, 10);
  if (moedaPedido && moedaPedido !== "BRL") throw new ErroSite("Pedido do site em moeda diferente de BRL.");
  const status = texto(p.status, 60), pago = instanteGmt(p.date_paid_gmt), criadoEm = instanteGmt(p.date_created_gmt);
  if (!criadoEm) throw new ErroSite("Pedido do site sem data de criação.");
  let statusInterno = STATUS[status];
  if (!statusInterno) { statusInterno = pago ? "CONFIRMADO" : "RECEBIDO_EXTERNO"; pendencias.push(`Status do site não mapeado: ${status || "vazio"}`); }

  const itens = lista(p.line_items).map((v, ordem) => {
    const i = objeto(v), q = String(i.quantity);
    if (!/^\d{1,9}(\.\d{1,6})?$/.test(q) || new Prisma.Decimal(q).lte(0)) throw new ErroSite("Quantidade de item do site inválida.");
    const bruto = moeda(i.subtotal), liquido = moeda(i.total), quantidade = new Prisma.Decimal(q);
    if (bruto.lt(0) || liquido.lt(0)) throw new ErroSite("Valor de item do site inválido.");
    const unitario = bruto.div(quantidade).toDecimalPlaces(2);
    if (!unitario.mul(quantidade).eq(bruto)) pendencias.push(`Preço unitário aproximado no item ${ordem + 1}`);
    const escolhas = lista(i.meta_data).map(m => opcional(m)).filter(m => texto(m.key, 200) && !texto(m.key, 200).startsWith("_") && (typeof m.value === "string" || typeof m.value === "number"))
      .map(m => ({ grupoNome: texto(m.display_key, 300) || texto(m.key, 300), opcaoNome: texto(typeof m.display_value === "string" ? m.display_value.replace(/<[^>]*>/g, "") : m.value, 300), quantidade: 1, preco: "0.00" })).slice(0, 60);
    const variacao = Number(i.variation_id) > 0 ? texto(i.variation_id, 20) : "", produto = Number(i.product_id) > 0 ? texto(i.product_id, 20) : "";
    return { chaves: [variacao, produto].filter(Boolean), sku: texto(i.sku, 100), ordem, quantidade: q, observacoes: null as string | null, unidadeSnapshot: "UN",
      produtoSnapshot: { nome: texto(i.name, 300) || "Item do site", categorias: [], idExterno: variacao || produto, codigo: texto(i.sku, 100), origem: "SITE" },
      escolhasSnapshot: escolhas, estadoComposicao: "PENDENTE", precoOriginal: unitario.toFixed(2), precoAplicado: unitario.toFixed(2),
      acrescimos: "0.00", desconto: Prisma.Decimal.max(0, bruto.minus(liquido)).toFixed(2), totalLinha: liquido.toFixed(2) };
  });
  if (!itens.length) throw new ErroSite("Pedido do site sem itens.");

  const soma = (vs: Prisma.Decimal[]) => vs.reduce((s, v) => s.plus(v), new Prisma.Decimal(0));
  const subtotal = soma(lista(p.line_items).map(v => moeda(objeto(v).subtotal)));
  const taxas = lista(p.fee_lines).map(v => moeda(objeto(v).total));
  const desconto = moeda(p.discount_total ?? "0").plus(soma(taxas.filter(t => t.lt(0))).abs());
  const frete = moeda(p.shipping_total ?? "0"), impostos = moeda(p.total_tax ?? "0");
  const outrosCustos = soma(taxas.filter(t => t.gt(0))).plus(impostos), total = moeda(p.total);
  if (total.lt(0) || frete.lt(0)) throw new ErroSite("Totais do pedido do site inválidos.");
  if (!subtotal.minus(desconto).plus(frete).plus(outrosCustos).eq(total)) pendencias.push("Totais do site não reconciliados");

  const cpf = digitos(cobranca.cpf) || digitos(meta(metas, ["_billing_cpf", "billing_cpf"])), cnpj = digitos(cobranca.cnpj) || digitos(meta(metas, ["_billing_cnpj", "billing_cnpj"]));
  const tipoPessoa = texto(cobranca.persontype, 4) || meta(metas, ["_billing_persontype", "billing_persontype"]);
  const empresa = texto(cobranca.company, 200), pj = cnpj.length === 14 && (tipoPessoa === "J" || tipoPessoa === "2" || cpf.length !== 11);
  const nomePessoa = [texto(cobranca.first_name, 150), texto(cobranca.last_name, 150)].filter(Boolean).join(" ");
  const documento = pj ? cnpj : cpf.length === 11 ? cpf : "";
  if (!documento) pendencias.push("Cliente sem CPF/CNPJ no pedido do site");
  const telefone = digitos(cobranca.cellphone) || digitos(meta(metas, ["_billing_cellphone", "billing_cellphone"])) || digitos(cobranca.phone);
  const endereco = (o: Record<string, unknown>, prefixo: string) => texto(o.address_1, 300) || texto(o.postcode, 20) ? {
    logradouro: texto(o.address_1, 300), numero: texto(o.number, 30) || meta(metas, [`_${prefixo}_number`, `${prefixo}_number`]), complemento: texto(o.address_2, 300),
    bairro: texto(o.neighborhood, 100) || meta(metas, [`_${prefixo}_neighborhood`, `${prefixo}_neighborhood`]), cidade: texto(o.city, 100), uf: texto(o.state, 20), cep: digitos(o.postcode).slice(0, 8), referencia: "",
  } : null;
  const retirada = lista(p.shipping_lines).some(v => /local_pickup|retirada/i.test(texto(opcional(v).method_id, 100)));
  const enderecoEntrega = retirada ? null : endereco(entrega, "shipping") ?? endereco(cobranca, "billing");
  if (!retirada && !enderecoEntrega) pendencias.push("Pedido de entrega sem endereço");
  const destinatario = [texto(entrega.first_name, 150), texto(entrega.last_name, 150)].filter(Boolean).join(" ") || nomePessoa;

  const dataBruta = meta(metas, cfg.metasData), dia = dataBruta ? dataEntrega(dataBruta, cfg.fuso) : null;
  if (!dia) pendencias.push(dataBruta ? "Data de entrega do site em formato não reconhecido" : "Data de entrega não identificada no pedido do site");
  const janela = meta(metas, cfg.metasJanela).slice(0, 60) || null;

  const metodo = texto(p.payment_method, 100), titulo = texto(p.payment_method_title, 150);
  const forma = FORMAS.find(([r]) => r.test(`${metodo} ${normal(titulo)}`))?.[1] ?? null;
  const metodoFrete = lista(p.shipping_lines).map(v => texto(opcional(v).method_title, 150)).filter(Boolean).join(" · ");

  return {
    externoId: idExterno(p.id), numero: texto(p.number, 40) || idExterno(p.id), status, statusInterno, criadoEm, pagoEm: pago, modificadoEm: instanteGmt(p.date_modified_gmt),
    asaasPagamentoId: pagamentoAsaas(p), itens, pendencias,
    cliente: { documento, email: texto(cobranca.email, 200).toLowerCase(), nome: pj ? empresa || nomePessoa : nomePessoa, tipo: pj ? "PJ" as const : "PF" as const, telefone },
    dados: {
      // dataCompra é reservada pelo banco a rascunhos internos; integrações usam a criação.
      origem: "SITE", atendimento: retirada ? "RETIRADA" : "ENTREGA", prazo: "AGENDADO",
      previsaoData: dia ? new Date(`${dia}T00:00:00.000Z`) : null, previsaoJanela: janela,
      compradorSnapshot: { nome: (pj ? empresa || nomePessoa : nomePessoa) || "Cliente não informado pelo site", documento: documento || null, email: texto(cobranca.email, 200).toLowerCase() || null, telefone: telefone || null, ...(pj && nomePessoa ? { contato: nomePessoa } : {}) },
      destinatarioSnapshot: { nome: destinatario, contato: digitos(entrega.phone) || telefone },
      enderecoSnapshot: enderecoEntrega,
      observacoes: texto(p.customer_note, 2000) || null,
      formaPagamentoInformada: forma,
      pagamentoInformadoSnapshot: { origem: "SITE", nome: titulo || metodo || "Pagamento no site", metodo, parcelas: 1, pagoEm: pago?.toISOString() ?? null, frete: metodoFrete || null },
      subtotal: subtotal.toFixed(2), desconto: desconto.toFixed(2), frete: frete.toFixed(2), outrosCustos: outrosCustos.toFixed(2), total: total.toFixed(2),
    },
    // Fotografia para reconciliação: guardada cifrada, nunca enviada bruta à interface.
    snapshot: p,
  };
}
export type PedidoSiteAdaptado = ReturnType<typeof adaptarPedidoSite>;

/** Partes cuja mudança exige nova versão do pedido no HUB. Metadados técnicos do site não entram. */
export function resumoComercial(p: PedidoSiteAdaptado) {
  return { dados: { ...p.dados, previsaoData: p.dados.previsaoData?.toISOString() ?? null }, itens: p.itens.map(({ chaves, sku, ...i }) => ({ ...i, chaves, sku })) };
}
