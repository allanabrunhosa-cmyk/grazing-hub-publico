export function criarIdentificadorDps(input: { cpfCnpj: string; serie: string; numero: string; municipioCodigo: string }) {
  const documento = input.cpfCnpj.replace(/\D/g, "");
  if (documento.length !== 11 && documento.length !== 14) throw new Error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
  const municipio = input.municipioCodigo.replace(/\D/g, "");
  if (municipio.length !== 7) throw new Error("O município de emissão deve ser informado pelo código IBGE de 7 dígitos.");
  const serie = input.serie.trim();
  if (!/^\d{1,5}$/.test(serie)) throw new Error("A série da DPS deve ter de 1 a 5 dígitos, somente números.");
  const numero = input.numero.trim();
  if (!/^\d{1,15}$/.test(numero)) throw new Error("O número da DPS deve ter de 1 a 15 dígitos.");
  const tipoInscricao = documento.length === 11 ? "1" : "2";
  return `DPS${municipio}${tipoInscricao}${documento.padStart(14, "0")}${serie.padStart(5, "0")}${numero.padStart(15, "0")}`;
}
