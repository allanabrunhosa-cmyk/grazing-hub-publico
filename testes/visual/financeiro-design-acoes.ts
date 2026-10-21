// Ações sintéticas exclusivas da prévia; não acessam contas ou bancos reais.
export async function criarContaBancariaAction() { return { erro: "Prévia: conta não criada." }; }
export async function editarSaldoInicialAction() { return { erro: "Prévia: saldo não alterado." }; }
export async function alternarAtivoContaBancariaAction() { return { ok: true as const }; }
export async function salvarCartaoAction() { return { erro: "Prévia: cartão não salvo." }; }
export async function alternarCartaoAction() { return { ok: true as const }; }
