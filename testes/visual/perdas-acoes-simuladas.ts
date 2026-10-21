export async function registrarPerdaAction() {
  if (new URLSearchParams(window.location.search).has("erro")) return { erro: "Falha simulada ao registrar perda." };
  return { perdaId: "simulada", movimentacaoId: "movimento-simulado" };
}
export async function excluirPerdaAction() {
  if (new URLSearchParams(window.location.search).has("erro")) return { erro: "Falha simulada ao excluir perda." };
  return { ok: true as const };
}
