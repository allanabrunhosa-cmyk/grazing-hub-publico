import type { ImpactoFiscal, SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";
export async function salvarVersaoFiscalAction(entrada: SalvarVersaoFiscalEntrada) { void entrada; return { ok: true, id: "rascunho-sintetico" } as const; }
export async function registrarDeclaracaoGrazing1Action() { return { erro: "Prévia exclusivamente sintética: nenhuma declaração real foi registrada." }; }
export async function analisarImpactoFiscalAction(id: string) { void id; return { ok: true, impacto: { hash: "hash-sintetico", produtosAfetados: 2, documentosPreservados: 18, resumo: ["Duas classificações serão avaliadas na nova vigência.", "Nenhum documento histórico será recalculado."], produtos: [{ id: "t1", nome: "Tábua demonstrativa", motivos: ["Regra de alimentação preparada"] }] } as ImpactoFiscal } as const; }
export async function ativarVersaoFiscalAction(id: string, hash: string, chave: string) { void id; void hash; void chave; return { ok: true } as const; }
