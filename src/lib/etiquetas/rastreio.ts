/** A emissão vem de uma sequência atômica do banco; o sufixo identifica a cópia. */
export function codigoInicialEtiqueta(numero: string) {
  const sequencia = BigInt(numero);
  if (sequencia < BigInt(1) || sequencia > BigInt(2_176_782_335)) throw new Error("Sequência de etiquetas indisponível.");
  return `ET${sequencia.toString(36).toUpperCase().padStart(6, "0")}-001`;
}

export function codigoSerializado(codigo: string | undefined): codigo is string {
  return typeof codigo === "string" && /^ET[A-Z0-9]{6}-001$/.test(codigo);
}

export function codigoCopiaEtiqueta(inicial: string, copia: number) {
  if (!Number.isInteger(copia) || copia < 1 || copia > 999) throw new Error("Cópia de etiqueta inválida.");
  return codigoSerializado(inicial) ? `${inicial.slice(0, -3)}${String(copia).padStart(3, "0")}` : inicial;
}

export function faixaCodigosEtiqueta(inicial: string | undefined, copias: number) {
  if (!inicial) return "Não informado";
  return codigoSerializado(inicial) && copias > 1 ? `${inicial} a ${codigoCopiaEtiqueta(inicial, copias)}` : inicial;
}

export function correspondeCodigoEtiqueta(inicial: string | undefined, copias: number, busca: string) {
  const termo = busca.trim().replace(/^#/, "").toUpperCase();
  if (!inicial || !termo) return false;
  if (inicial.toUpperCase().includes(termo)) return true;
  if (!codigoSerializado(inicial)) return false;
  const encontrado = /^(ET[A-Z0-9]{6}-)(\d{3})$/.exec(termo);
  return !!encontrado && encontrado[1] === inicial.slice(0, -3) && Number(encontrado[2]) >= 1 && Number(encontrado[2]) <= copias;
}
