/** Validação do formato/dígito não comprova identidade, embalagem nem cadastro CCG. */
export function gtinValido(v: unknown): v is string {
  if (v === "SEM GTIN") return true;
  if (typeof v !== "string" || !/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(v) || /^0+$/.test(v)) return false;
  const digitos = [...v.slice(0, -1)].reverse();
  const soma = digitos.reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - soma % 10) % 10 === Number(v.at(-1));
}
