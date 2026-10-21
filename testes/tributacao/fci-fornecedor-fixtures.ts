import type { ClassificacaoFiscal, DecisaoFciFiscal } from "@/lib/tributacao/tipos";
import { hashTecnico } from "@/lib/tributacao/fotografia-tecnica";

/** Identificadores, documentos e controles exclusivamente sintéticos. */
export const materiaisRepasse = { algoritmo: "grazing.material-fiscal.v1" as const, insumos: [{ insumoId: "insumo-ficticio", hash: "b".repeat(64), transitiva: false }] };
export const fotografiaRepasse: NonNullable<ClassificacaoFiscal["fotografiaTecnica"]> = { algoritmo: "grazing.classificacao-fiscal.v1", principalHash: "c".repeat(64), materiais: materiaisRepasse };
export function fciRepasseFicticia(): DecisaoFciFiscal {
  return { situacao: "EXIGIDA", numero: "ABCDEF12-3456-7890-ABCD-1234567890AB", periodoApuracao: null, conteudoImportacao: null, valorParcelaImportada: null, valorSaidaReferencia: null, apuracaoCompleta: false, justificativa: "Transcrição exclusivamente sintética da FCI de entrada, sem nova industrialização.", fontes: ["https://legislacao.fazenda.sp.gov.br/Paginas/pcat642013.aspx"], evidencias: ["ITEM-FICTICIO-CONCILIADO"], repasseFornecedor: { insumoId: "insumo-ficticio", registro: { algoritmo: "grazing.fci-fornecedor.v1", natureza: "FRACIONADO", ncm: "19059090", origem: "5", materiaisHash: hashTecnico(materiaisRepasse), documentos: [{ itemId: "item-ficticio", numeroItem: 1, xmlHash: "a".repeat(64), dataEmissao: "2026-10-01" }] } } };
}
export const contextoRepasse = { data: "2026-10-11", ufEmitente: "SP", ufDestino: "SP", modelo: "55" as const, natureza: "FRACIONADO" as const, ncm: "19059090", materiaisHash: hashTecnico(materiaisRepasse), classificacaoVersaoId: "classificacao-ficticia", classificacaoVersaoNumero: 1 };
