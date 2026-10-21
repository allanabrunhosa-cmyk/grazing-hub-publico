/** Código municipal IBGE: sete dígitos, com os dois iniciais identificando a UF.
 * Valida formato/UF; não substitui a tabela oficial de municípios vigentes.
 * Fonte: https://biblioteca.ibge.gov.br/visualizacao/livros/liv101639.pdf */
export const CODIGOS_UF_IBGE: Readonly<Record<string, string>> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53",
};

export function codigoMunicipioCompativel(codigo: unknown, uf: string, pais = "Brasil"): codigo is string {
  return typeof codigo === "string" && /^\d{7}$/.test(codigo) && pais.trim().toLocaleLowerCase("pt-BR") === "brasil"
    && codigo.slice(0, 2) === CODIGOS_UF_IBGE[uf.toUpperCase()];
}

/** Ausência permanece opcional para cadastros/orçamentos antigos. */
export function preservarCodigoMunicipio(codigo: unknown, uf: string, pais: string, criarErro: (mensagem: string) => Error): { codigoMunicipio?: string } {
  if (codigo == null || codigo === "") return {};
  if (!codigoMunicipioCompativel(codigo, uf, pais)) throw criarErro("Código IBGE do município: informe sete dígitos compatíveis com a UF brasileira do endereço.");
  return { codigoMunicipio: codigo };
}
