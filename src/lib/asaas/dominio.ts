import { Prisma } from "@/generated/prisma/client";

export class ErroAsaas extends Error {}
export type AmbienteAsaas = "SANDBOX" | "PRODUCAO";
export type FormaCobranca = "PIX" | "BOLETO" | "CARTAO_CREDITO" | "INDEFINIDA";
export type SituacaoCobranca = "AGUARDANDO" | "PAGA" | "VENCIDA" | "ESTORNADA" | "CONTESTADA" | "REMOVIDA";

export function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroAsaas("Resposta do Asaas fora do contrato.");
  return v as Record<string, unknown>;
}
export const texto = (v: unknown, max = 500) => typeof v === "string" ? v.slice(0, max) : "";

/** O Asaas envia valores como número JSON; nunca aceitar arredondamento silencioso. */
export function moeda(v: unknown) {
  if ((typeof v !== "string" && typeof v !== "number") || !/^\d{1,12}(\.\d{1,2})?$/.test(String(v))) throw new ErroAsaas("Valor monetário do Asaas inválido.");
  return new Prisma.Decimal(String(v));
}
export function dataCivil(v: unknown): Date | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ErroAsaas("Data do Asaas inválida.");
  const d = new Date(`${v}T00:00:00.000Z`);
  if (d.toISOString().slice(0, 10) !== v) throw new ErroAsaas("Data do Asaas inválida.");
  return d;
}
/** "YYYY-MM-DD HH:mm:ss" sem fuso: o Asaas opera no horário de Brasília (UTC-3, sem horário de verão). */
export function instante(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}-03:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}
export function idPagamento(v: unknown): string {
  if (typeof v !== "string" || !/^pay_[A-Za-z0-9_-]{4,80}$/.test(v)) throw new ErroAsaas("Identificador de cobrança do Asaas inválido.");
  return v;
}
export function idCliente(v: unknown): string {
  if (typeof v !== "string" || !/^cus_[A-Za-z0-9_-]{4,80}$/.test(v)) throw new ErroAsaas("Identificador de cliente do Asaas inválido.");
  return v;
}
/** Somente páginas do próprio Asaas são oferecidas como link de pagamento. */
export function linkAsaas(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password && /(^|\.)asaas\.com$/.test(u.hostname) ? u.toString() : null;
  } catch { return null; }
}

const TIPOS: Record<FormaCobranca, string> = { PIX: "PIX", BOLETO: "BOLETO", CARTAO_CREDITO: "CREDIT_CARD", INDEFINIDA: "UNDEFINED" };
export const tipoCobranca = (forma: FormaCobranca) => TIPOS[forma];
export function formaDoTipo(tipo: unknown): FormaCobranca {
  return tipo === "PIX" ? "PIX" : tipo === "BOLETO" ? "BOLETO" : tipo === "CREDIT_CARD" ? "CARTAO_CREDITO" : "INDEFINIDA";
}

const SITUACOES: Record<string, SituacaoCobranca> = {
  PENDING: "AGUARDANDO", AWAITING_RISK_ANALYSIS: "AGUARDANDO",
  RECEIVED: "PAGA", CONFIRMED: "PAGA", RECEIVED_IN_CASH: "PAGA", DUNNING_RECEIVED: "PAGA",
  OVERDUE: "VENCIDA", DUNNING_REQUESTED: "VENCIDA",
  REFUNDED: "ESTORNADA", REFUND_REQUESTED: "ESTORNADA", REFUND_IN_PROGRESS: "ESTORNADA",
  CHARGEBACK_REQUESTED: "CONTESTADA", CHARGEBACK_DISPUTE: "CONTESTADA", AWAITING_CHARGEBACK_REVERSAL: "CONTESTADA",
};
/** Status desconhecido devolve null: o fato é preservado sem inventar situação. */
export function situacaoDoStatus(status: string, removida: boolean): SituacaoCobranca | null {
  return removida ? "REMOVIDA" : SITUACOES[status] ?? null;
}
const PESO: Record<SituacaoCobranca, number> = { AGUARDANDO: 0, VENCIDA: 1, PAGA: 2, ESTORNADA: 3, CONTESTADA: 3, REMOVIDA: 3 };
/** Webhooks não garantem ordem: evento mais antigo não desfaz o estado mais recente. */
export function aplicaSituacao(atual: { situacao: string; ultimoEventoEm: Date | null }, nova: SituacaoCobranca, ocorridoEm: Date | null) {
  if (!atual.ultimoEventoEm || !ocorridoEm) return PESO[nova] >= (PESO[atual.situacao as SituacaoCobranca] ?? 0) || !atual.ultimoEventoEm;
  if (ocorridoEm.getTime() > atual.ultimoEventoEm.getTime()) return true;
  if (ocorridoEm.getTime() < atual.ultimoEventoEm.getTime()) return false;
  return PESO[nova] >= (PESO[atual.situacao as SituacaoCobranca] ?? 0);
}

export function lerPagamento(v: unknown) {
  const p = objeto(v), status = texto(p.status, 60), removida = p.deleted === true;
  return {
    id: idPagamento(p.id), status, removida, situacao: situacaoDoStatus(status, removida),
    cliente: typeof p.customer === "string" && /^cus_/.test(p.customer) ? idCliente(p.customer) : null,
    forma: formaDoTipo(p.billingType), valor: moeda(p.value),
    liquido: p.netValue == null ? null : moeda(p.netValue),
    vencimento: dataCivil(p.dueDate), referencia: texto(p.externalReference, 200) || null,
    link: linkAsaas(p.invoiceUrl), boleto: linkAsaas(p.bankSlipUrl),
    pagoEm: dataCivil(p.clientPaymentDate ?? p.paymentDate ?? p.confirmedDate ?? null),
    creditoPrevisto: dataCivil(p.creditDate ?? p.estimatedCreditDate ?? null),
  };
}
export type PagamentoAsaas = ReturnType<typeof lerPagamento>;

/** Campos novos são tolerados: lançar exceção aqui interromperia a fila do Asaas. */
export function lerEvento(v: unknown) {
  const e = objeto(v), id = texto(e.id, 200), tipo = texto(e.event, 80);
  if (!id || !/^[A-Z_]{3,80}$/.test(tipo)) throw new ErroAsaas("Evento do Asaas fora do contrato.");
  const pagamento = e.payment && typeof e.payment === "object" && !Array.isArray(e.payment) ? e.payment as Record<string, unknown> : null;
  return { id, tipo, ocorridoEm: instante(e.dateCreated), pagamento, pagamentoId: pagamento && typeof pagamento.id === "string" && /^pay_[A-Za-z0-9_-]{4,80}$/.test(pagamento.id) ? pagamento.id : null };
}

/** Referência gravada na cobrança criada pelo HUB; também recupera envios de resposta incerta. */
export const referenciaHub = (numeroPedido: number, cobrancaId: string) => `hub:${numeroPedido}:${cobrancaId}`;
export function lerReferenciaHub(v: string | null) {
  const m = v ? /^hub:(\d{1,10}):([a-z0-9]{10,40})$/.exec(v) : null;
  return m ? { numero: Number(m[1]), cobrancaId: m[2] } : null;
}

const FORMAS: FormaCobranca[] = ["PIX", "BOLETO", "CARTAO_CREDITO", "INDEFINIDA"];
export function validarEntradaCobranca(valor: unknown, hoje: string) {
  const e = valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
  if (!FORMAS.includes(e.forma as FormaCobranca)) throw new ErroAsaas("Escolha Pix, boleto, cartão de crédito ou deixe o cliente escolher.");
  if (typeof e.vencimento !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.vencimento) || !dataCivil(e.vencimento)) throw new ErroAsaas("Informe um vencimento válido.");
  const limite = new Date(Date.parse(`${hoje}T12:00:00Z`) + 365 * 86400000).toISOString().slice(0, 10);
  if (e.vencimento < hoje) throw new ErroAsaas("O vencimento não pode estar no passado.");
  if (e.vencimento > limite) throw new ErroAsaas("O vencimento não pode passar de um ano.");
  return { forma: e.forma as FormaCobranca, vencimento: e.vencimento };
}

const registro = (v: unknown) => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const digitos = (v: unknown) => typeof v === "string" ? v.replace(/\D/g, "") : "";
/** Titular da cobrança: a cobrança escolhida no pedido prevalece sobre o comprador. */
export function titularCobranca(pedido: { compradorSnapshot: unknown; cobrancaSnapshot: unknown }) {
  const comprador = registro(pedido.compradorSnapshot), cobranca = registro(pedido.cobrancaSnapshot);
  const fiscal = cobranca.tipo === "PF" || cobranca.tipo === "PJ";
  const nome = (fiscal ? texto(cobranca.tipo === "PF" ? cobranca.nomeCompleto : cobranca.razaoSocial, 200) : "") || texto(comprador.nome, 200);
  const documento = digitos(fiscal ? cobranca.documento : "") || digitos(comprador.documento);
  if (!nome.trim()) throw new ErroAsaas("O pedido não tem o nome do titular da cobrança.");
  if (documento.length !== 11 && documento.length !== 14) throw new ErroAsaas("Informe o CPF ou CNPJ do titular da cobrança no pedido antes de cobrar pelo Asaas.");
  const email = texto(comprador.email, 200).trim(), telefone = digitos(fiscal && cobranca.telefone ? cobranca.telefone : comprador.telefone);
  return {
    name: nome.trim(), cpfCnpj: documento,
    ...(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? { email } : {}),
    ...(telefone.length >= 10 && telefone.length <= 11 ? { mobilePhone: telefone } : {}),
  };
}
