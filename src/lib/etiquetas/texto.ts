export function sanitizarTextoZpl(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[\^~\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ").trim().replace(/[^\x20-\x7E]/g, "?");
}
