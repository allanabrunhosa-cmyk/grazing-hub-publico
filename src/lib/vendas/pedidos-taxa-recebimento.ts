const VALOR = /^\d{1,12}(\.\d{1,2})?$/;

function centavos(valor: unknown): bigint | null {
  const texto = typeof valor === "number" ? String(valor) : valor;
  if (typeof texto !== "string" || !VALOR.test(texto)) return null;
  const [inteiro, fracao = ""] = texto.split(".");
  return BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, "0"));
}

/**
 * Taxa do Pix devida em um recebimento direto, calculada pela fotografia da
 * forma gravada no título. Percentual incide sobre o valor recebido, com
 * arredondamento comercial ao centavo; a taxa fixa soma uma vez por recebimento.
 * Outras formas, fotografias sem taxa ou valores inválidos resultam em zero.
 */
export function taxaRecebimentoPix(forma: unknown, valorRecebido: string): string {
  const f = forma as { tipo?: unknown; taxaPercentual?: unknown; taxaFixa?: unknown } | null;
  const valor = centavos(valorRecebido);
  if (!f || f.tipo !== "PIX" || valor === null || valor === BigInt(0)) return "0.00";
  const percentual = centavos(f.taxaPercentual ?? "0"), fixa = centavos(f.taxaFixa ?? "0");
  if (percentual === null || fixa === null) return "0.00";
  const total = (valor * percentual + BigInt(5000)) / BigInt(10000) + fixa;
  return `${total / BigInt(100)}.${String(total % BigInt(100)).padStart(2, "0")}`;
}
