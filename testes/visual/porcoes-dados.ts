import type { PorcaoInsumoOption } from "@/lib/insumos/porcoes";
import type { InsumoPorcaoOption } from "@/app/(protegido)/porcoes/porcoes-table";
import type { CategoriaPorcoesOption } from "@/lib/insumos/ordem-categorias-porcoes";

export const categoriasPorcoes: CategoriaPorcoesOption[] = ["Charcutarias", "Frutas frescas", "Pães e crackers", "Queijos", "Categoria sem porções"].map((nome, ordem) => ({ id: `categoria-ficticia-${ordem}`, nome, ordem, versao: 1 }));

export const insumosPorcoes: InsumoPorcaoOption[] = [
  { id: "brie-ficticio", nome: "Brie", unidade: "G", categoriaNome: "Queijos", ativo: true },
  { id: "presunto-ficticio", nome: "Presunto cru Serrano", unidade: "G", categoriaNome: "Charcutarias", ativo: true },
  { id: "pao-ficticio", nome: "Pão de ervas", unidade: "UN", categoriaNome: "Pães e crackers", ativo: true },
  { id: "morango-ficticio", nome: "Morango", unidade: "G", categoriaNome: "Frutas frescas", ativo: true },
];
export const porcoesFicticias: PorcaoInsumoOption[] = [
  { id: "brie-6-ficticio", insumoId: "brie-ficticio", nome: "6 fatias padrão", quantidade: "100", unidade: "G", versao: 1 },
  { id: "brie-3-ficticio", insumoId: "brie-ficticio", nome: "3 fatias finas", quantidade: "35.5", unidade: "G", versao: 1 },
  { id: "presunto-8-ficticio", insumoId: "presunto-ficticio", nome: "8 fatias padrão", quantidade: "100", unidade: "G", versao: 1 },
  { id: "pao-2-ficticio", insumoId: "pao-ficticio", nome: "2 unidades", quantidade: "2", unidade: "UN", versao: 1 },
  { id: "morango-4-ficticio", insumoId: "morango-ficticio", nome: "4 unidades padrão", quantidade: "100", unidade: "G", versao: 1 },
];
