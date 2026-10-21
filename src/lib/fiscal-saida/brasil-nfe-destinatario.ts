import { identidadeFiscalCobranca } from "@/lib/vendas/cliente-cobranca";
import type { DocumentoBrasilNfe } from "./brasil-nfe-contrato";
import { MUNICIPIOS_NFSE } from "@/lib/nfse/municipios";

type Registro = Record<string, unknown>;
const objeto = (v: unknown): Registro => v && typeof v === "object" && !Array.isArray(v) ? v as Registro : {};
const texto = (v: unknown) => typeof v === "string" ? v.trim() : "";
const UFS_IBGE: Record<string, string> = { RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17", MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29", MG: "31", ES: "32", RJ: "33", SP: "35", PR: "41", SC: "42", RS: "43", MS: "50", MT: "51", GO: "52", DF: "53" };
export type EntradaDestinatarioBrasilNfe = {
  modelo: 55 | 65;
  indicadorPresenca: number;
  comprador: unknown;
  cobranca: unknown;
  /** Decisão da operação no servidor, sem inferir que todo CNPJ é contribuinte. */
  consumidorFinal: boolean;
};
/** Traduz dados fotografados, nunca consulta/preenche cadastros atuais. Código
 * ausente pode ser resolvido na tabela oficial por cidade/UF exatas e unívocas,
 * sem inferência pelo CEP nem alteração do endereço fotografado. */
export function resolverDestinatarioBrasilNfe(entrada: EntradaDestinatarioBrasilNfe): { cliente?: DocumentoBrasilNfe["Cliente"]; pendencias: string[] } {
  const comprador = identidadeFiscalCobranca(objeto(entrada.comprador), entrada.cobranca), endereco = objeto(entrada.cobranca);
  const pendencias: string[] = [];
  const documentoBruto = texto(comprador.documento), documento = documentoBruto.replace(/[.\s/-]/g, "");
  const obrigatorio = entrada.modelo === 55 || entrada.indicadorPresenca === 4;
  if (!documentoBruto && !obrigatorio) return { pendencias };
  if (!/^(?:\d{11}|\d{14})$/.test(documento)) pendencias.push("Destinatário: informar CPF/CNPJ fiscal com 11/14 dígitos, sem letras.");
  const nome = texto(comprador.tipo === "PJ" ? comprador.razaoSocial : comprador.nome);
  if (!nome || nome.length > 60 || /[\u0000-\u001f]/.test(nome)) pendencias.push("Destinatário: nome/razão social fiscal deve conter de 1 a 60 caracteres.");
  const ie = texto(comprador.inscricaoEstadual);
  // IE preenchida comprova necessidade de indicador contribuinte; ausência não
  // transforma automaticamente empresa PJ em contribuinte ou isenta.
  const indicador = comprador.indicadorIe === 1 || comprador.indicadorIe === 2 || comprador.indicadorIe === 9 ? comprador.indicadorIe : ie && ie.toUpperCase() !== "ISENTO" ? 1 : entrada.consumidorFinal ? 9 : undefined;
  if (indicador === undefined) pendencias.push("Destinatário: confirmar indicador IE (contribuinte, isento ou não contribuinte) para a operação.");
  if (indicador === 1 && !/^\d{2,14}$/.test(ie.replace(/[.\s/-]/g, ""))) pendencias.push("Destinatário contribuinte: informar inscrição estadual fiscal válida, sem letras.");
  if (indicador === 2 && ie && ie.toUpperCase() !== "ISENTO") pendencias.push("Destinatário isento: não enviar uma inscrição estadual preenchida.");
  if (indicador === 9 && ie && ie.toUpperCase() !== "ISENTO") pendencias.push("Destinatário não contribuinte: inscrição estadual preenchida exige conferência do indicador.");
  let enderecoFiscal: Record<string, unknown> | undefined;
  if (obrigatorio) {
    const pais = texto(endereco.pais).toLocaleUpperCase("pt-BR");
    if (pais !== "BRASIL" && pais !== "BR") pendencias.push("Endereço fiscal de cobrança: confirmar país Brasil; operação exterior exige contrato fiscal próprio.");
    const cep = texto(endereco.cep).replace(/[-\s]/g, ""), uf = texto(endereco.uf).toUpperCase();
    const cidade = texto(endereco.cidade);
    const normalizarMunicipio = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim().toLocaleUpperCase("pt-BR");
    const municipios = cidade && UFS_IBGE[uf] ? MUNICIPIOS_NFSE.filter(m => m.uf === uf && normalizarMunicipio(m.nome) === normalizarMunicipio(cidade)) : [];
    const codigosInformados = [endereco.codigoMunicipio, endereco.codigoIbge].filter(v => v != null && !(typeof v === "string" && !v.trim()));
    const codigoAusente = codigosInformados.length === 0;
    const codigoMunicipio = codigoAusente ? municipios.length === 1 ? municipios[0].codigo : "" : texto(codigosInformados[0]);
    const codigosCoerentes = codigosInformados.every(v => typeof v === "string" && texto(v) === codigoMunicipio);
    if (!/^\d{8}$/.test(cep)) pendencias.push("Endereço fiscal de cobrança: CEP deve conter oito dígitos.");
    if (!UFS_IBGE[uf]) pendencias.push("Endereço fiscal de cobrança: UF brasileira ausente ou inválida.");
    if (!codigosCoerentes || !/^\d{7}$/.test(codigoMunicipio) || codigoMunicipio.slice(0, 2) !== UFS_IBGE[uf] || municipios.length === 1 && codigoMunicipio !== municipios[0].codigo) pendencias.push("Endereço fiscal de cobrança: código IBGE de sete dígitos deve estar comprovado e corresponder à cidade e à UF; não inferir pelo CEP.");
    for (const campo of ["logradouro", "numero", "bairro", "cidade"] as const) {
      const s = texto(endereco[campo]);
      if (!s || s.length > 60 || /[\u0000-\u001f]/.test(s)) pendencias.push(`Endereço fiscal de cobrança: ${campo} deve conter de 1 a 60 caracteres.`);
    }
    if (texto(endereco.complemento).length > 60) pendencias.push("Endereço fiscal de cobrança: complemento deve conter até 60 caracteres.");
    enderecoFiscal = { Cep: cep, Logradouro: texto(endereco.logradouro), Numero: texto(endereco.numero), Bairro: texto(endereco.bairro), Municipio: texto(endereco.cidade), CodMunicipio: codigoMunicipio, Uf: uf, CodPais: 1058, Pais: "BRASIL", ...(texto(endereco.complemento) ? { Complemento: texto(endereco.complemento) } : {}) };
  }
  if (pendencias.length || indicador === undefined) return { pendencias };
  return { pendencias, cliente: { CpfCnpj: documento, NmCliente: nome, IndicadorIe: indicador, ...(indicador === 1 ? { Ie: ie.replace(/[.\s/-]/g, "") } : {}), ...(enderecoFiscal ? { Endereco: enderecoFiscal } : {}) } };
}
