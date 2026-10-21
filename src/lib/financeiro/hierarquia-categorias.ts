import type { GrupoDre } from "@/generated/prisma/client";

export type NoCategoriaFinanceira = {
  id: string;
  paiId?: string | null;
  grupo: GrupoDre;
};

export function idsDoRamoCategoria(categoriaId: string, categorias: NoCategoriaFinanceira[]): Set<string> {
  const ids = new Set([categoriaId]);
  let encontrou = true;
  while (encontrou) {
    encontrou = false;
    for (const categoria of categorias) {
      if (categoria.paiId && ids.has(categoria.paiId) && !ids.has(categoria.id)) {
        ids.add(categoria.id);
        encontrou = true;
      }
    }
  }
  return ids;
}

export function nivelDaCategoria(categoriaId: string, categorias: NoCategoriaFinanceira[]): number | null {
  const porId = new Map(categorias.map((categoria) => [categoria.id, categoria]));
  const visitados = new Set<string>();
  let atual = porId.get(categoriaId);
  let nivel = 0;
  while (atual?.paiId) {
    if (visitados.has(atual.id)) return null;
    visitados.add(atual.id);
    atual = porId.get(atual.paiId);
    if (!atual) return null;
    nivel += 1;
  }
  return atual ? nivel : null;
}

export function alturaDoRamoCategoria(categoriaId: string, categorias: NoCategoriaFinanceira[]): number | null {
  const filhos = new Map<string, string[]>();
  for (const categoria of categorias) {
    if (!categoria.paiId) continue;
    filhos.set(categoria.paiId, [...(filhos.get(categoria.paiId) ?? []), categoria.id]);
  }
  function calcular(id: string, visitados: Set<string>): number | null {
    if (visitados.has(id)) return null;
    const proximos = filhos.get(id) ?? [];
    if (proximos.length === 0) return 0;
    const novosVisitados = new Set(visitados).add(id);
    const alturas = proximos.map((filhoId) => calcular(filhoId, novosVisitados));
    if (alturas.some((altura) => altura === null)) return null;
    return 1 + Math.max(...alturas as number[]);
  }
  return calcular(categoriaId, new Set());
}

export function cabeNoLimiteDeTresNiveis(
  categoriaId: string,
  novoPaiId: string | null,
  categorias: NoCategoriaFinanceira[],
): boolean {
  const altura = alturaDoRamoCategoria(categoriaId, categorias);
  if (altura === null) return false;
  if (!novoPaiId) return altura <= 2;
  const ramo = idsDoRamoCategoria(categoriaId, categorias);
  if (ramo.has(novoPaiId)) return false;
  const nivelPai = nivelDaCategoria(novoPaiId, categorias);
  return nivelPai !== null && nivelPai + 1 + altura <= 2;
}
