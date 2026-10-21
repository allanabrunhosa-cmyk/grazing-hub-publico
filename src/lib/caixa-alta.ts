export function paraCaixaAlta(valor: string) {
  return valor.trim().toLocaleUpperCase("pt-BR");
}

export function paraCaixaAltaOpcional(valor: string | null | undefined) {
  const normalizado = paraCaixaAlta(valor ?? "");
  return normalizado || null;
}

export function aplicarCaixaAltaNoCampo(campo: HTMLInputElement | HTMLTextAreaElement) {
  campo.value = campo.value.toLocaleUpperCase("pt-BR");
}
