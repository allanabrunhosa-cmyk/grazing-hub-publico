import type { RevisaoConsolidadaFiscal, VersaoFiscalDto } from "./tipos";
import { ErroEstruturaFiscal } from "./validacao";
import { hashDeclaracaoFci } from "./declaracao-fci";
export type VersaoSelecionadaRevisaoFiscal = { id: string; hash: string };
export function hashRevisaoConsolidadaGrazing1(versoes: VersaoSelecionadaRevisaoFiscal[]): string {
  if (!Array.isArray(versoes) || !versoes.length || versoes.length > 2 || versoes.some(v => !v || typeof v.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(v.id) || typeof v.hash !== "string" || !/^[a-f0-9]{64}$/.test(v.hash)) || new Set(versoes.map(v => v.id)).size !== versoes.length) throw new ErroEstruturaFiscal("Seleção de revisão consolidada inválida.");
  return hashDeclaracaoFci({ tipo: "REVISAO_CONSOLIDADA_GRAZING1", versoes: versoes.map(v => ({ id: v.id, hash: v.hash })).sort((a, b) => a.id.localeCompare(b.id)) });
}
/** Sobreposição efêmera para revisão. Nunca grava/ativa versões ou remove pendências. */
export function selecionarVersoesRevisaoConsolidada(versoes: VersaoFiscalDto[], selecionadas: VersaoSelecionadaRevisaoFiscal[], data: string, ambiente: "HOMOLOGACAO" | "PRODUCAO") {
  const falha = (): never => { throw new ErroEstruturaFiscal("A revisão consolidada exige versões atuais, hashes íntegros e vigência compatível. Atualize e revise novamente."); };
  if (!Array.isArray(selecionadas) || selecionadas.length > 500 || !["HOMOLOGACAO", "PRODUCAO"].includes(ambiente)) return falha();
  const ids = new Set<string>(), chaves = new Set<string>();
  const escolhidas = selecionadas.map(s => {
    if (!s || typeof s !== "object" || Object.keys(s).some(k => !["id", "hash"].includes(k)) || typeof s.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(s.id) || typeof s.hash !== "string" || !/^[a-f0-9]{64}$/.test(s.hash) || ids.has(s.id)) return falha();
    const v = versoes.find(v => v.id === s.id);
    if (!v || !["CLASSIFICACAO", "REGRA"].includes(v.tipo) || !["ATIVO", "RASCUNHO"].includes(v.status) || v.hash !== s.hash || hashDeclaracaoFci(v.dados) !== v.hash || v.vigenciaInicio > data || versoes.some(n => n.tipo === v.tipo && n.chave === v.chave && n.vigenciaInicio <= data && n.versao > v.versao)) return falha();
    const chave = `${v.tipo}:${v.chave}`; if (chaves.has(chave)) return falha(); ids.add(v.id); chaves.add(chave); return v;
  });
  const revisao: RevisaoConsolidadaFiscal = { tipo: "PROPOSTAS_PARA_REVISAO", versao: 1, ambiente, aprovacaoInterna: false, versoes: escolhidas.map(v => ({ id: v.id, hash: v.hash, versao: v.versao, tipo: v.tipo, chave: v.chave, statusOriginal: v.status })) };
  return { versoes: [...versoes.filter(v => !chaves.has(`${v.tipo}:${v.chave}`)), ...escolhidas.map(v => ({ ...v, status: "ATIVO" as const }))], revisao };
}
