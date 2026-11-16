/** Interpreta somente uma quantia completa; não extrai números de nomes ou documentos. */
export function valorDaBusca(termo: string) {
  let numero = termo.trim().replace(/^([+-]?)\s*R\$\s*/i, "$1").replace(/\s/g, "");
  const sinal = numero.startsWith("-") ? -1 : numero.startsWith("+") ? 1 : null;
  numero = numero.replace(/^[+-]/, "");
  // Vírgula é decimal; ponto pode ser decimal ou separador de milhares completo.
  if (/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(numero)) numero = numero.replaceAll(".", "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(numero)) numero = numero.replaceAll(".", "");
  else if (!/^\d+(?:\.\d{1,2})?$/.test(numero)) return null;
  const [inteiros, fracao = ""] = numero.split(".");
  const centavos = Number(inteiros) * 100 + Number(fracao.padEnd(2, "0"));
  return Number.isSafeInteger(centavos) ? { centavos, sinal } : null;
}

/** Os valores recebidos estão em reais. Sem sinal explícito, encontra entrada ou saída. */
export function correspondeBuscaValor(termo: string, ...valores: number[]): boolean {
  const valor = valorDaBusca(termo);
  return !!valor && valores.some(numero => Number.isFinite(numero)
    && Math.abs(Math.round(numero * 100)) === valor.centavos
    && (valor.sinal === null || Math.sign(numero) === valor.sinal || numero === 0));
}

/** Strings exatas para filtros Decimal no banco, antes de paginação/limites. */
export function valoresDecimaisDaBusca(termo: string): string[] {
  const valor = valorDaBusca(termo);
  if (!valor) return [];
  const decimal = `${Math.floor(valor.centavos / 100)}.${String(valor.centavos % 100).padStart(2, "0")}`;
  if (valor.centavos === 0) return [decimal];
  return valor.sinal === -1 ? [`-${decimal}`] : valor.sinal === 1 ? [decimal] : [decimal, `-${decimal}`];
}
