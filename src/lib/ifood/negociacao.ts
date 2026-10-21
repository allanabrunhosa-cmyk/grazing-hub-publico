import { ErroIfood, objeto, texto, uuid } from "./dominio";

export type EntradaAcaoIfood = { codigo?: string; motivo?: string; alternativaId?: string; valor?: string; minutos?: string };
const listaTextos = (v: unknown) => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && /^[A-Z_]{1,100}$/.test(x)) : [];
export function valorCentavosIfood(v: unknown) {
  const a = objeto(v);
  if (a.currency !== "BRL" || typeof a.value !== "string" || !/^\d{1,14}$/.test(a.value)) throw new ErroIfood("Valor da negociação fora do contrato BRL em centavos.");
  return BigInt(a.value);
}
const reais = (centavos: bigint) => `${centavos / BigInt(100)}.${String(centavos % BigInt(100)).padStart(2, "0")}`;
export function lerNegociacaoIfood(valor: unknown) {
  const d = objeto(valor), m = d.metadata ? objeto(d.metadata) : {};
  const motivosRecebidos = m.acceptCancellationReasons ?? d.acceptCancellationReasons;
  const motivosAceite = listaTextos(motivosRecebidos);
  const motivosValidos = motivosRecebidos == null || Array.isArray(motivosRecebidos) && motivosRecebidos.length === motivosAceite.length;
  const alternativas = (Array.isArray(d.alternatives) ? d.alternatives : []).flatMap(v => {
    try {
      const a = objeto(v), am = a.metadata ? objeto(a.metadata) : {}, tipo = texto(a.type, 80);
      if (!["REFUND", "BENEFIT", "ADDITIONAL_TIME"].includes(tipo)) return [];
      const maximo = tipo === "ADDITIONAL_TIME" ? null : reais(valorCentavosIfood(am.maxAmount));
      const minutos = Array.isArray(am.allowedsAdditionalTimeInMinutes) ? am.allowedsAdditionalTimeInMinutes.filter((n): n is number => Number.isSafeInteger(n) && Number(n) > 0 && Number(n) <= 1440) : [];
      const motivos = listaTextos(am.allowedsAdditionalTimeReasons);
      if (tipo === "ADDITIONAL_TIME" && (!minutos.length || !motivos.length)) return [];
      return [{ id: uuid(a.id), tipo, maximo, minutos, motivos }];
    } catch { return []; } // Alternativa desconhecida permanece no snapshot privado, sem botão indevido.
  });
  const itens = (Array.isArray(m.items ?? m.item) ? m.items ?? m.item : []) as unknown[];
  const adicionais = Array.isArray(m.garnishItems) ? m.garnishItems : [];
  const resumir = (vs: unknown[], adicional: boolean) => vs.map(v => {
    const i = objeto(v);
    let valor: string | null = null;
    try { if (i.amount) valor = reais(valorCentavosIfood(i.amount)); } catch { /* Mostrar pendência sem inventar valor. */ }
    return { id: texto(i.uniqueId ?? i.id, 100), produtoId: texto(i.id, 100), pai: adicional ? texto(i.parentUniqueId, 100) : null, indice: Number.isSafeInteger(i.index) ? Number(i.index) : null, quantidade: typeof i.quantity === "number" && i.quantity > 0 ? i.quantity : null, valor, motivo: texto(i.reason, 1000) };
  });
  const acao = texto(d.action, 80), tipo = texto(d.handshakeType, 80);
  const resumos = resumir(itens, false), subitens = resumir(adicionais, true);
  const compativel = motivosValidos && ["CANCELLATION", "PARTIAL_CANCELLATION", "PROPOSED_AMOUNT_REFUND"].includes(acao) && ["AFTER_DELIVERY", "DELAY", "PREPARATION_TIME", "AFTER_DELIVERY_PARTIALLY"].includes(tipo)
    && (acao !== "PARTIAL_CANCELLATION" || [...resumos, ...subitens].length > 0 && [...resumos, ...subitens].every(i => !!i.id && i.quantidade !== null));
  return { acao, tipo, mensagem: texto(d.message, 1000), prazo: texto(d.expiresAt, 80), timeout: texto(d.timeoutAction, 80), compativel, motivosAceite, alternativas, itens: resumos, adicionais: subitens };
}
export function corpoNegociacaoIfood(valor: unknown, acao: string, entrada: EntradaAcaoIfood) {
  const d = objeto(valor), n = lerNegociacaoIfood(d);
  if (!n.compativel) throw new ErroIfood("Negociação fora do contrato suportado.");
  if (acao === "acceptDispute") {
    if (n.motivosAceite.length && !n.motivosAceite.includes(entrada.codigo ?? "")) throw new ErroIfood("Selecione um motivo de aceite oferecido pelo iFood.");
    if ((entrada.motivo?.length ?? 0) > 250) throw new ErroIfood("Detalhe do aceite limitado a 250 caracteres.");
    return n.motivosAceite.length ? { reason: entrada.codigo, ...(entrada.motivo?.trim() ? { detailReason: entrada.motivo.trim() } : {}) } : null;
  }
  if (acao === "rejectDispute") {
    if (!entrada.motivo?.trim() || entrada.motivo.length > 1000) throw new ErroIfood("Informe a justificativa da recusa (até 1000 caracteres).");
    return { reason: entrada.motivo.trim() };
  }
  const alternativa = n.alternativas.find(a => a.id === entrada.alternativaId);
  if (acao !== "alternativeDispute" || !alternativa) throw new ErroIfood("Selecione uma alternativa vigente oferecida pelo iFood.");
  if (alternativa.tipo === "ADDITIONAL_TIME") {
    if (!/^\d{1,4}$/.test(entrada.minutos ?? "") || !alternativa.minutos.includes(Number(entrada.minutos)) || !alternativa.motivos.includes(entrada.codigo ?? "")) throw new ErroIfood("Prazo ou motivo não oferecido pelo iFood.");
    return { type: alternativa.tipo, metadata: { additionalTimeInMinutes: Number(entrada.minutos), reason: entrada.codigo } };
  }
  if (!/^\d{1,12}(?:[.,]\d{1,2})?$/.test(entrada.valor ?? "")) throw new ErroIfood("Informe o valor em reais, com até duas casas decimais.");
  const [inteiro, fracao = ""] = entrada.valor!.replace(",", ".").split(".");
  const centavos = BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, "0"));
  const maximo = alternativa.maximo!.replace(".", "");
  if (centavos <= BigInt(0) || centavos > BigInt(maximo)) throw new ErroIfood("Proposta excede o limite oferecido pelo iFood.");
  return { type: alternativa.tipo, metadata: { amount: { value: String(centavos), currency: "BRL" } } };
}
