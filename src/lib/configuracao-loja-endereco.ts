import { MUNICIPIOS_NFSE } from "@/lib/nfse/municipios";
import { validarEnderecoEntrega } from "@/lib/vendas/entregas-dominio";
import { preservarCodigoMunicipio } from "@/lib/vendas/municipio";

/** Resolve somente o município já declarado. Não consulta CEP nem altera a UF. */
export function normalizarEnderecoEmpresa(entrada: unknown) {
  const endereco = validarEnderecoEntrega(entrada);
  const informado = (entrada as Record<string, unknown>).codigoMunicipio;
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");
  const municipios = (!endereco.pais || normalizar(endereco.pais) === "BRASIL")
    ? MUNICIPIOS_NFSE.filter(m => m.uf === endereco.uf && normalizar(m.nome) === normalizar(endereco.cidade)) : [];
  const codigo = informado == null || informado === "" ? municipios.length === 1 ? municipios[0].codigo : undefined : informado;
  const complemento = preservarCodigoMunicipio(codigo, endereco.uf, endereco.pais ?? "Brasil", mensagem => new Error(mensagem));
  if (complemento.codigoMunicipio && municipios.length === 1 && complemento.codigoMunicipio !== municipios[0].codigo) throw new Error("Código IBGE não corresponde ao município declarado da empresa.");
  return { ...endereco, ...complemento };
}
