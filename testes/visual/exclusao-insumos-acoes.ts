import type { VinculosExclusaoInsumo } from "@/lib/insumos/exclusao";
export async function consultarExclusaoInsumoAction(id: string) {
  const vinculos: VinculosExclusaoInsumo = id === "vinculado" ? {
    preparacoes: [{ id: "massa", nome: "Massa de pão fictícia" }],
    complementos: [{ id: "crouton", nome: "Croutons fictícios" }],
    produtos: [{ id: "pao", nome: "Pão artesanal fictício" }], outrosVinculos: false,
  } : { preparacoes: [], complementos: [], produtos: [], outrosVinculos: false };
  return { error: null, vinculos: { ...vinculos, revisao: "revisao-ficticia" } };
}
export async function deleteInsumoAction() { return { error: "Prévia isolada: nenhuma exclusão real é executada." }; }
