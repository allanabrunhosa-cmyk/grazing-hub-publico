export function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

export function formatarCpfCnpj(valor: string) {
  const numeros = somenteDigitos(valor).slice(0, 14);
  if (numeros.length <= 11) {
    return numeros
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return numeros
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\/\d{4})(\d)/, "$1-$2");
}

export function documentoValidoOuVazio(valor: string) {
  const tamanho = somenteDigitos(valor).length;
  return tamanho === 0 || tamanho === 11 || tamanho === 14;
}
