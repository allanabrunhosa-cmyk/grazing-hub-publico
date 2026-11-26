/** Tipos de complemento definidos pelo responsável em 25/11/2026.
 * O tipo define o tratamento na nota, não o cardápio:
 * - Composição: o cliente escolhe mais de um item; nome e NCM do produto.
 * - Opção: o cliente escolhe um único item; nome do produto + opção e NCM da opção.
 * - Adicional: produto ou ingrediente a mais; nome e NCM do próprio adicional.
 * EXTRAS (grupo padrão, opcional e ilimitado) e COMPLEMENTAR são os dois valores gravados
 * do tipo Adicional. Detalhes: docs/features/complementos-tipos-fiscais/SPEC.md. */
export const TIPOS_GRUPO = ["COMPOSICAO", "OPCAO", "COMPLEMENTAR", "EXTRAS"] as const;
export type TipoGrupo = typeof TIPOS_GRUPO[number];
export type TipoComplemento = "COMPOSICAO" | "OPCAO" | "ADICIONAL";

export const ROTULO_TIPO_COMPLEMENTO: Record<TipoComplemento, string> = { COMPOSICAO: "Composição", OPCAO: "Opção", ADICIONAL: "Adicional" };
export const AJUDA_TIPO_COMPLEMENTO: Record<TipoComplemento, string> = {
  COMPOSICAO: "O cliente escolhe mais de um item. Na nota vale o nome e o NCM do produto.",
  OPCAO: "O cliente escolhe apenas um item. Na nota vale o nome do produto com a opção e o NCM da opção.",
  ADICIONAL: "Produto ou ingrediente a mais. Na nota sai com o nome e o NCM do próprio adicional.",
};
export const ORDEM_TIPO_COMPLEMENTO: TipoComplemento[] = ["COMPOSICAO", "OPCAO", "ADICIONAL"];

export const ehTipoGrupo = (tipo: unknown): tipo is TipoGrupo => TIPOS_GRUPO.includes(tipo as TipoGrupo);
export function tipoComplemento(tipo: string): TipoComplemento {
  return tipo === "OPCAO" ? "OPCAO" : tipo === "COMPLEMENTAR" || tipo === "EXTRAS" ? "ADICIONAL" : "COMPOSICAO";
}
/** Composição e Opção são escolhas internas do produto: consomem a receita da escolha. */
export const ehEscolhaInterna = (tipo: string) => tipo === "COMPOSICAO" || tipo === "OPCAO";
/** Opção aceita no máximo uma escolha, seja qual for o limite gravado no vínculo. */
export const limitarPorTipo = <T extends { minimo: number; maximo: number | null }>(tipo: string, limites: T): T =>
  tipo === "OPCAO" ? { ...limites, minimo: Math.min(limites.minimo, 1), maximo: 1 } : limites;
