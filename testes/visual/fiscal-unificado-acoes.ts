import { fichaKitUnificada, fichaUnificada } from "./fiscal-unificado-dados";
import type { DadosVersaoFiscal, SalvarVersaoFiscalEntrada, VersaoFiscalDto } from "@/lib/tributacao/tipos";
const versoes: VersaoFiscalDto[] = structuredClone([...new Map(fichaKitUnificada.painel.versoes.map(v => [v.id, v] as const)).values()]);
export async function consultarFichaFiscalAction(id?: string) { const ficha = id === fichaKitUnificada.produto.id ? fichaKitUnificada : fichaUnificada; return { ok: true as const, dados: { ...structuredClone(ficha), dia: new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()), painel: { ...structuredClone(ficha.painel), versoes: structuredClone(versoes) } } }; }
export async function salvarManutencaoFiscalAction(dados: SalvarVersaoFiscalEntrada[]) {
  const novas = dados.map(e => ({ id: `ficticio-${crypto.randomUUID()}`, tipo: e.tipo, chave: e.chave, versao: e.versaoBase + 1, status: "RASCUNHO" as const, vigenciaInicio: e.vigenciaInicio, dados: structuredClone(e.dados) as DadosVersaoFiscal, justificativa: e.justificativa, fontes: e.fontes, criadoPorNome: "Equipe fictícia", createdAt: new Date().toISOString(), hash: "hash-exclusivamente-sintetico" }));
  versoes.push(...novas);
  return { ok: true as const, ids: novas.map(v => v.id) };
}
export async function revisarManutencaoFiscalAction(ids: string[]) { return { ok: true as const, hash: "hash-sintetico", impactos: ids.map(id => ({ id, hash: "hash-sintetico", produtosAfetados: 1, documentosPreservados: 12, resumo: ["Uma configuração será aplicada na vigência informada.", "Doze documentos fictícios serão preservados."], produtos: [] })) }; }
export async function aplicarManutencaoFiscalAction(ids: string[]) { for (const v of versoes) if (ids.includes(v.id)) v.status = "ATIVO"; return { ok: true as const, ids }; }
export async function simularConciliacaoFiscalAction() { return { ok: true as const, dados: [] }; }

export async function consultarHistoricoFiscalLegadoAction() { return { ok: true as const, registros: [] }; }
