const PADRAO_DECIMAL = /^\d{1,9}(?:[.,]\d{1,3})?$/;

export function normalizarQuantidade(valor: string) {
  const limpo = valor.trim();
  if (!limpo) return null;
  if (!PADRAO_DECIMAL.test(limpo)) {
    throw new Error("Informe uma quantidade positiva, com até 3 casas decimais.");
  }
  const normalizado = limpo.replace(",", ".");
  if (Number(normalizado) <= 0) {
    throw new Error("A quantidade precisa ser maior que zero.");
  }
  return normalizado;
}

export function validarTextoObrigatorio(valor: string, campo: string, maximo: number) {
  const limpo = valor.trim().replace(/\s+/g, " ");
  if (!limpo) throw new Error(`${campo} é obrigatório.`);
  if (limpo.length > maximo) throw new Error(`${campo} deve ter no máximo ${maximo} caracteres.`);
  return limpo;
}

export function validarTextoOpcional(valor: string, campo: string, maximo: number) {
  const limpo = valor.trim().replace(/\s+/g, " ");
  if (!limpo) return null;
  if (limpo.length > maximo) throw new Error(`${campo} deve ter no máximo ${maximo} caracteres.`);
  return limpo;
}

export function validarChaveIdempotencia(valor: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
    throw new Error("Não foi possível identificar esta solicitação. Atualize a página e tente novamente.");
  }
  return valor.toLowerCase();
}

