/** Apresentação em centavos; o total comercial permanece inalterado. */
export function resumoParcelamento(total: string, parcelas: number) {
  if (!/^\d{1,12}\.\d{2}$/.test(total) || !Number.isSafeInteger(parcelas) || parcelas < 1 || parcelas > 36) return `${parcelas}x`;
  const [inteiro, fracao] = total.split(".");
  const centavos = BigInt(inteiro) * BigInt(100) + BigInt(fracao);
  const base = centavos / BigInt(parcelas), resto = centavos % BigInt(parcelas);
  const moeda = (v: bigint) => `R$ ${(v / BigInt(100)).toLocaleString("pt-BR")},${String(v % BigInt(100)).padStart(2, "0")}`;
  return `${parcelas}x de ${moeda(base + (resto > BigInt(0) ? BigInt(1) : BigInt(0)))}${resto > BigInt(0) ? "*" : ""} · Total ${moeda(centavos)}`;
}
