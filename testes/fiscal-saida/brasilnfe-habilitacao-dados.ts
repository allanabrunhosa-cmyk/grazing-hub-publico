import type { ControleEmissaoBrasilNfeDto } from "@/lib/fiscal-saida/brasilnfe/operacional";
/** Dados sintéticos. Não representam autorização ou cadastro real. */
export function controleEmissaoFicticio(): ControleEmissaoBrasilNfeDto {
  return { homologacao: null, producao: null, correspondentes: { homologacao: false, producao: false }, documentosHomologados: [], automatica: false, callback: false, liberacaoTransmissao: { liberada: false, motivo: "Emissão ainda não liberada." },
    requisitos: [55, 65].flatMap(modelo => [{ ambiente: "HOMOLOGACAO" as const, modelo: modelo as 55 | 65, pendencias: modelo === 65 ? ["Conferir CSC de homologação."] : [] }, { ambiente: "PRODUCAO" as const, modelo: modelo as 55 | 65, pendencias: [`Modelo ${modelo}: homologação ainda não comprovada.`] }]) };
}
