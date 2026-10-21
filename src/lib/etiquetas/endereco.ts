/** Separa o texto já salvo no cadastro/snapshot sem alterar ou descartar seus dados. */
export function enderecoDaEtiqueta(valor: string) {
  const cepEncontrado = valor.match(/\b(?:CEP\s*:?\s*)?(\d{5})-?(\d{3})\b/i);
  const cep = cepEncontrado ? `CEP: ${cepEncontrado[1]}-${cepEncontrado[2]}` : "";
  const semCep = cepEncontrado ? valor.replace(cepEncontrado[0], "") : valor;
  const partes = semCep
    .replace(/\bavenida\b\.?/gi, "Av.")
    .split(",")
    .map((parte) => parte.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  const pais = /^brasil$/i.test(partes.at(-1) ?? "") ? partes.pop() : undefined;
  const cidadeComUf = partes.at(-1)?.match(/^(.+?)\s*-\s*([A-Za-z]{2})$/);
  let cidadeUf = "";
  if (cidadeComUf) {
    partes.pop();
    cidadeUf = `${cidadeComUf[1].trim()} - ${cidadeComUf[2].toUpperCase()}`;
  } else if (partes.length > 2 && /^[A-Za-z]{2}$/.test(partes.at(-1)!)) {
    const uf = partes.pop()!;
    cidadeUf = `${partes.pop()} - ${uf.toUpperCase()}`;
  }
  if (pais) {
    if (cidadeUf) cidadeUf += `, ${pais}`;
    else partes.push(pais);
  }
  return { cep, endereco: partes.join(", "), cidadeUf };
}
