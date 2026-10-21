// Prévia isolada: nenhuma conexão ao banco, estoque ou sessão operacional.
export async function createLocalAction(nome: string) { return { id: `ficticio-${nome}`, nome }; }
export async function renameLocalAction() { return; }
export async function deleteLocalAction() { return { error: "Prévia: exclusão não executada." }; }
export async function adicionarCategoriaPerdaAction() { return { erro: "Prévia: cadastro não executado." }; }
export async function alterarCategoriaPerdaAction() { return { ok: true as const }; }
export async function removerCategoriaPerdaAction() { return { erro: "Prévia: remoção não executada." }; }
export async function salvarItemContagemAction() { return { ok: true as const }; }
export async function finalizarContagemAction() { return { erro: "Prévia: estoque não alterado." }; }
export async function excluirContagemAction() { return { erro: "Prévia: estoque não alterado." }; }
