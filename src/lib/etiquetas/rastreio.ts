/** Formato sequencial histórico. Etiquetas novas guardam um código aleatório por cópia. */
export function codigoInicialEtiqueta(numero: string) {
  const sequencia = BigInt(numero);
  if (sequencia < BigInt(1) || sequencia > BigInt(2_176_782_335)) throw new Error("Sequência de etiquetas indisponível.");
  return `ET${sequencia.toString(36).toUpperCase().padStart(6, "0")}-001`;
}

export function codigoSerializado(codigo: string | undefined): codigo is string {
  return typeof codigo === "string" && /^ET[A-Z0-9]{6}-001$/.test(codigo);
}

export function codigoCopiaEtiqueta(inicial: string, copia: number, codigos?: string[]) {
  if (!Number.isInteger(copia) || copia < 1 || copia > 999) throw new Error("Cópia de etiqueta inválida.");
  if (codigos?.length) {
    if (!codigos[copia - 1]) throw new Error("Código da cópia não informado.");
    return codigos[copia - 1];
  }
  return codigoSerializado(inicial) ? `${inicial.slice(0, -3)}${String(copia).padStart(3, "0")}` : inicial;
}

export function faixaCodigosEtiqueta(inicial: string | undefined, copias: number, codigos?: string[]) {
  if (!inicial) return "Não informado";
  if (codigos?.length) return copias > 1 ? `${codigos[0]} · ${copias} códigos` : codigos[0];
  return codigoSerializado(inicial) && copias > 1 ? `${inicial} a ${codigoCopiaEtiqueta(inicial, copias)}` : inicial;
}

export function correspondeCodigoEtiqueta(inicial: string | undefined, copias: number, busca: string, codigos?: string[]) {
  const termo = busca.trim().replace(/^#/, "").toUpperCase();
  if (!inicial || !termo) return false;
  if (codigos?.length) return codigos.some(codigo => codigo.includes(termo));
  if (inicial.toUpperCase().includes(termo)) return true;
  if (!codigoSerializado(inicial)) return false;
  const encontrado = /^(ET[A-Z0-9]{6}-)(\d{3})$/.exec(termo);
  return !!encontrado && encontrado[1] === inicial.slice(0, -3) && Number(encontrado[2]) >= 1 && Number(encontrado[2]) <= copias;
}
