import type { ConfiguracaoBrasilNfeDto, EstadoServicoEmissaoBrasilNfe } from "./configuracao-dto";
export class ErroConfiguracaoBrasilNfe extends Error {}
export const LIMITE_CREDENCIAL_BRASILNFE = 512;
export type SubstituicaoBrasilNfe = { versao: number; tokenSubstituicao?: string; userTokenSubstituicao?: string };
export function validarSubstituicaoBrasilNfe(entrada: unknown): SubstituicaoBrasilNfe {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) throw new ErroConfiguracaoBrasilNfe("Configuração inválida.");
  const e = entrada as Record<string, unknown>;
  if (Object.keys(e).some(k => !["versao", "tokenSubstituicao", "userTokenSubstituicao"].includes(k))) throw new ErroConfiguracaoBrasilNfe("Somente substituição de credenciais de homologação é permitida neste marco.");
  validarVersaoBrasilNfe(e.versao);
  for (const k of ["tokenSubstituicao", "userTokenSubstituicao"] as const) {
    if (e[k] !== undefined && (typeof e[k] !== "string" || e[k].length > LIMITE_CREDENCIAL_BRASILNFE || !/^[\x21-\x7e]*$/.test(e[k]))) throw new ErroConfiguracaoBrasilNfe("Credenciais devem conter até 512 caracteres, sem espaços ou caracteres de controle.");
  }
  return { versao: e.versao as number, ...(e.tokenSubstituicao ? { tokenSubstituicao: e.tokenSubstituicao as string } : {}), ...(e.userTokenSubstituicao ? { userTokenSubstituicao: e.userTokenSubstituicao as string } : {}) };
}
export function validarVersaoBrasilNfe(versao: unknown): asserts versao is number {
  if (!Number.isSafeInteger(versao) || (versao as number) < 0) throw new ErroConfiguracaoBrasilNfe("Versão de configuração inválida.");
}
export const CONSULTAS_EMPRESA_BRASILNFE = ["BuscarEmpresa", "ConsultarServicos"] as const;
export const PENDENCIAS_FISCAIS_BRASILNFE = [
  "Verificação do certificado externo pendente: contrato do fornecedor precisa ser confirmado; nenhum certificado será alterado.",
  "Revisão fiscal: confirmar CRT, IE e fundamentação por operação/produto, com aprovação interna para NF-e e NFC-e.",
  "Brasil NFe: confirmar idempotência, consistência da consulta após timeout e ordenação dos resultados.",
  "Homologação fiscal pendente. Transmissão, cancelamento, inutilização, callback e produção permanecem bloqueados.",
];
export type DiagnosticoBrasilNfe = ConfiguracaoBrasilNfeDto["validacaoExterna"];

/** Catálogo de emissão apenas; distribuição de notas recebidas pertence à SEFAZ existente. */
export function classificarServicosEmissaoBrasilNfe(servicos: readonly { nome: string; ativo: boolean }[]): Pick<DiagnosticoBrasilNfe["servicosEmissao"], "nfe" | "nfce"> {
  const estado = (nomeModelo: "NF-E" | "NFC-E"): EstadoServicoEmissaoBrasilNfe => {
    const pertinentes = servicos.filter(s => ["NF-E/NFC-E", nomeModelo].includes(s.nome.trim().toUpperCase()));
    if (!pertinentes.length || pertinentes.some(s => s.ativo !== pertinentes[0].ativo)) return "NAO_CONFIRMADO";
    return pertinentes[0].ativo ? "ATIVO" : "INATIVO";
  };
  return { nfe: estado("NF-E"), nfce: estado("NFC-E") };
}

export function diagnosticoBrasilNfeVazio(): DiagnosticoBrasilNfe {
  return {
    situacao: "NAO_REALIZADA", verificadaEm: null, acessoAutenticado: false,
    emitenteCorrespondente: null, empresaVerificadaEm: null,
    servicosEmissao: { nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO", verificadosEm: null },
    consultas: CONSULTAS_EMPRESA_BRASILNFE.map(consulta => ({ consulta, situacao: "NAO_REALIZADA", verificadaEm: null, falha: null })),
    preRequisitosConferidos: false, pendencias: [...PENDENCIAS_FISCAIS_BRASILNFE], consultasIndisponiveis: [],
  };
}
