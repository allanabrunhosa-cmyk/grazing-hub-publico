export function normalizarChaveAcesso(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const chave = valor.replace(/\s/g, "");
  if (!/^\d{44}$/.test(chave) || chave.slice(20,22) !== "55") return null;
  let soma = 0, peso = 2;
  for (let i = 42; i >= 0; i--) { soma += Number(chave[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  const resto = soma % 11;
  return Number(chave[43]) === (resto < 2 ? 0 : 11 - resto) ? chave : null;
}
