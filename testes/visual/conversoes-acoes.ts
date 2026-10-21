export async function saveInsumoAction() { return { error: null, insumoId: "acucar" }; }
export async function createCategoriaAction(nome: string) { return { id: "categoria-simulada", nome }; }
export async function createCentroCustoAction(nome: string) { return { id: "centro-simulado", nome }; }

export async function deleteInsumoAction() { return { error: null }; }
