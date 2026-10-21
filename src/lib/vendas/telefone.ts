/** Telefone brasileiro em campo único: DDI fixo +55, DDD e número de oito ou nove dígitos. */
export const TAMANHO_CAMPO_TELEFONE = 20;

/** DDD + número digitados. Mais de onze dígitos iniciados por 55 indicam DDI colado. */
export function digitosNacionaisTelefone(valor: string | null | undefined) {
  const texto = (valor ?? "").trim();
  if (texto.startsWith("+55")) return texto.slice(3).replace(/\D/g, "").slice(0, 11);
  const digitos = texto.replace(/\D/g, "");
  return (digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos).slice(0, 11);
}

/** Máscara progressiva: +55 (11) 3456-7890 ou +55 (11) 97658-6412. */
export function formatarTelefone(valor: string | null | undefined) {
  const d = digitosNacionaisTelefone(valor);
  if (!d) return "";
  if (d.length <= 2) return `+55 (${d}`;
  const numero = d.slice(2), corte = numero.length > 8 ? 5 : 4;
  return `+55 (${d.slice(0, 2)}) ${numero.length > 4 ? `${numero.slice(0, corte)}-${numero.slice(corte)}` : numero}`;
}

/** Valor persistido: +55 seguido de DDD e número, ou vazio. */
export function telefoneArmazenado(valor: string | null | undefined) {
  const d = digitosNacionaisTelefone(valor);
  return d ? `+55${d}` : "";
}

export function telefoneCompleto(valor: string | null | undefined) {
  const texto = (valor ?? "").trim();
  if (!/^[+\d\s().-]+$/.test(texto) || (texto.startsWith("+") && !texto.startsWith("+55"))) return false;
  const digitos = texto.replace(/\D/g, "");
  const nacionais = texto.startsWith("+55") || (digitos.length > 11 && digitos.startsWith("55")) ? digitos.slice(2) : digitos;
  // A máscara limita a digitação; o servidor não pode aceitar um número truncado.
  return /^\d{10,11}$/.test(nacionais);
}

/** Telefone opcional: vazio continua vazio; preenchido precisa estar completo (`null` = inválido). */
export function telefoneOpcionalArmazenado(valor: string | null | undefined) {
  if (!(valor ?? "").trim()) return "";
  return telefoneCompleto(valor) ? telefoneArmazenado(valor) : null;
}

/** Apagar um separador da máscara apaga também o dígito anterior a ele. */
export function editarTelefone(anterior: string | null | undefined, digitado: string) {
  const antes = digitosNacionaisTelefone(anterior), depois = digitosNacionaisTelefone(digitado);
  return telefoneArmazenado(digitado.length < formatarTelefone(anterior).length && depois === antes ? antes.slice(0, -1) : depois);
}

/** Exibição tolerante: valores antigos fora do padrão aparecem como foram gravados. */
export function exibirTelefone(valor: string | null | undefined) {
  return telefoneCompleto(valor) ? formatarTelefone(valor) : valor ?? "";
}
