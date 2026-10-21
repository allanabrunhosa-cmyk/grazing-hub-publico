/**
 * Formato e dígito verificador módulo 10 GS1, sem conversão numérica do código.
 * Não comprova atribuição pela GS1 nem identidade da unidade comercial.
 * SEM GTIN é uma declaração explícita; ausência nunca vira essa declaração.
 */
export function gtinFiscalBrasilNfeValido(valor: unknown): valor is string {
  if (valor === "SEM GTIN") return true;
  if (typeof valor !== "string" || !/^(?:\d{8}|\d{12,14})$/.test(valor) || /^0+$/.test(valor)) return false;
  let soma = 0;
  for (let i = valor.length - 2, peso = 3; i >= 0; i--, peso = peso === 3 ? 1 : 3) soma += (valor.charCodeAt(i) - 48) * peso;
  return (10 - soma % 10) % 10 === valor.charCodeAt(valor.length - 1) - 48;
}

/** Permite somente a edição parcial de dígitos ou da declaração SEM GTIN. */
export function aceitaEdicaoGtinFiscalBrasilNfe(valor: string): boolean {
  return /^\d{0,14}$/.test(valor) || "SEM GTIN".startsWith(valor);
}
