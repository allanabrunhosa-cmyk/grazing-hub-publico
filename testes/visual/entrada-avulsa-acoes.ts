import { registrarChamadaEntrada } from "./entrada-avulsa-previa";

export async function registrarEntradaAvulsaAction(entrada: unknown) {
  registrarChamadaEntrada("CRIAR", entrada);
  if (new URLSearchParams(location.search).get("erro") === "1") return { erro: "Simulação: o registro não foi confirmado. Revise os dados e tente novamente." };
  return { ok: true as const, movimentacaoId: "movimento-simulado", entradaAvulsaCompraId: "compra-simulada" };
}
