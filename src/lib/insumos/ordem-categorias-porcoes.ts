import { identificadorPorcaoValido } from "./porcoes";

export type CategoriaPorcoesOption = { id: string; nome: string; ordem: number; versao: number };
export type OrdemCategoriaPorcoesInput = { id: string; versao: number };

export function validarOrdemCategoriasPorcoes(entrada: unknown): OrdemCategoriaPorcoesInput[] | { erro: string } {
  if (!Array.isArray(entrada) || !entrada.length || entrada.length > 1000) return { erro: "Informe a ordem completa das categorias." };
  const ids = new Set<string>();
  const itens: OrdemCategoriaPorcoesInput[] = [];
  for (const item of entrada) {
    if (!item || typeof item !== "object" || !identificadorPorcaoValido(item.id) || !Number.isSafeInteger(item.versao) || item.versao < 1 || ids.has(item.id)) return { erro: "A ordem das categorias é inválida. Atualize a página." };
    ids.add(item.id); itens.push({ id: item.id, versao: item.versao });
  }
  return itens;
}
