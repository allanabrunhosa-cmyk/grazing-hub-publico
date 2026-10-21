import { sanitizarMetadadosErroBrasilNfe } from "./diagnostico-http";
import type { NumeracaoFiscalBrasilNfeDto, RegistroNumeracaoBrasilNfe } from "./numeracao-dto";

const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const instante = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null;
export function restaurarRegistroNumeracaoBrasilNfe(valor: unknown): RegistroNumeracaoBrasilNfe | null {
  const r = objeto(valor), data = instante(r.consultadoEm);
  if (r.esquema !== "grazing.brasilnfe.numeracao" || r.versao !== 1 || !Number.isSafeInteger(r.versaoConfiguracao) || (r.versaoConfiguracao as number) < 1 || typeof r.emitenteHash !== "string" || !/^[a-f0-9]{64}$/.test(r.emitenteHash) || !data) return null;
  const falha = sanitizarMetadadosErroBrasilNfe(r.falha);
  let resultado: RegistroNumeracaoBrasilNfe["resultado"] = null;
  if (r.resultado !== null) {
    const dado = objeto(r.resultado);
    if (!Array.isArray(dado.numeracoes) || dado.numeracoes.length > 1000 || typeof dado.avisosPresentes !== "boolean" || falha) return null;
    if (dado.itensForaEscopo !== undefined && (typeof dado.itensForaEscopo !== "number" || !Number.isSafeInteger(dado.itensForaEscopo) || dado.itensForaEscopo < 1 || dado.itensForaEscopo > 1000 || dado.itensForaEscopo + dado.numeracoes.length > 1000)) return null;
    const chaves = new Set<string>(), padroes = new Set<string>();
    const linhas: NonNullable<RegistroNumeracaoBrasilNfe["resultado"]>["numeracoes"] = [];
    for (const bruto of dado.numeracoes) {
      const item = objeto(bruto);
      if (![1, 2].includes(item.ambiente as number) || ![55, 65].includes(item.modelo as number) || typeof item.serie !== "string" || !/^\d{1,3}$/.test(item.serie)
        || typeof item.numero !== "string" || !/^[1-9]\d{0,8}$/.test(item.numero) || typeof item.padrao !== "boolean") return null;
      const contexto = `${item.ambiente}:${item.modelo}`, chave = `${contexto}:${Number(item.serie)}`;
      if (chaves.has(chave) || item.padrao && padroes.has(contexto)) return null;
      chaves.add(chave); if (item.padrao) padroes.add(contexto);
      linhas.push({ ambiente: item.ambiente as 1 | 2, modelo: item.modelo as 55 | 65, serie: item.serie, numero: item.numero, padrao: item.padrao });
    }
    resultado = { numeracoes: linhas, avisosPresentes: dado.avisosPresentes, ...(typeof dado.itensForaEscopo === "number" ? { itensForaEscopo: dado.itensForaEscopo } : {}) };
  } else if (!falha) return null;
  return { esquema: "grazing.brasilnfe.numeracao", versao: 1, versaoConfiguracao: r.versaoConfiguracao as number, emitenteHash: r.emitenteHash, consultadoEm: data, resultado, falha };
}

export type AutorizacaoLocalNumeracao = { id: string; ambiente: string; modeloDocumento: number | null; chaveFiscal: string | null; numero: string | null; serie: string | null; protocolo: string | null; eventos: { createdAt: Date }[] };
export function projetarNumeracaoFiscalBrasilNfe(entrada: { versao: number; emitenteHash: string; emitente: NumeracaoFiscalBrasilNfeDto["emitente"]; registro: unknown; autorizacoes: AutorizacaoLocalNumeracao[]; historicoLimitado?: boolean }): NumeracaoFiscalBrasilNfeDto {
  const registro = restaurarRegistroNumeracaoBrasilNfe(entrada.registro), vigente = registro?.versaoConfiguracao === entrada.versao && registro.emitenteHash === entrada.emitenteHash;
  const consulta: NumeracaoFiscalBrasilNfeDto["consulta"] = { situacao: !registro ? "NAO_CONSULTADA" : !vigente ? "OBSOLETA" : registro.falha ? "FALHOU" : "CONCLUIDA", consultadoEm: vigente ? registro!.consultadoEm : null, httpStatus: vigente ? registro!.falha?.httpStatus ?? 200 : null, falha: vigente ? registro!.falha : null, avisosPresentes: vigente ? registro!.resultado?.avisosPresentes ?? false : false,
    ...(vigente && registro!.resultado?.itensForaEscopo ? { itensForaEscopo: registro!.resultado.itensForaEscopo } : {}) };
  const cnpj = entrada.emitente.cnpj?.replace(/[.\/-]/g, "") ?? "";
  const linhas: NumeracaoFiscalBrasilNfeDto["linhas"] = vigente ? (registro!.resultado?.numeracoes ?? []).map(n => {
    const locais = entrada.autorizacoes.filter(d => d.modeloDocumento === n.modelo && d.ambiente === (n.ambiente === 1 ? "PRODUCAO" : "HOMOLOGACAO")
      && d.numero && /^[1-9]\d{0,8}$/.test(d.numero) && d.serie && /^\d{1,3}$/.test(d.serie) && Number(d.serie) === Number(n.serie)
      && d.chaveFiscal && /^\d{44}$/.test(d.chaveFiscal) && d.chaveFiscal.slice(6, 20) === cnpj && Number(d.chaveFiscal.slice(20, 22)) === n.modelo
      && Number(d.chaveFiscal.slice(22, 25)) === Number(n.serie) && Number(d.chaveFiscal.slice(25, 34)) === Number(d.numero)
      && d.protocolo && /^\d{1,30}$/.test(d.protocolo));
    const ultimo = locais.reduce<AutorizacaoLocalNumeracao | null>((atual, d) => !atual || Number(d.numero) > Number(atual.numero) ? d : atual, null);
    return { modelo: n.modelo, ambiente: n.ambiente, serie: n.serie, padrao: n.padrao, proximoNumero: n.numero,
      ultimaAutorizadaLocal: ultimo ? { documentoId: ultimo.id, numero: ultimo.numero!, autorizadaEm: ultimo.eventos[0]?.createdAt.toISOString() ?? null } : null,
      divergencia: ultimo && Number(n.numero) <= Number(ultimo.numero) ? "CONTADOR_NAO_SUPERA_AUTORIZADA_LOCAL" : null };
  }) : [];
  const pendencias = ["Próximo número informativo, não reservado. Outros emissores podem consumir a mesma sequência após a consulta.", "O HUB não presume a última autorização de outros emissores. A comparação abaixo usa somente documentos locais comprovados."];
  if (consulta.situacao === "OBSOLETA") pendencias.unshift("Configuração ou emitente mudou. O resultado anterior não é reutilizado; consulte a versão atual.");
  if (entrada.historicoLimitado) pendencias.push("Histórico local excede o limite da leitura. A comparação não comprova o último número de toda a série.");
  if (linhas.some(l => l.divergencia)) pendencias.unshift("O contador do fornecedor não supera uma autorização local conhecida. Conferência manual necessária; nenhum contador será alterado.");
  return { versaoConfiguracao: entrada.versao, emitente: entrada.emitente, consulta, linhas, pendencias };
}
