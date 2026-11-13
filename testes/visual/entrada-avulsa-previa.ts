import type { CartaoOption } from "@/lib/financeiro/cartoes";

export const cartoes: CartaoOption[] = [{
  id: "cartao-ficticio", nome: "Cartão fictício com identificação extensa", contaBancariaId: "conta-ficticia",
  contaBancariaNome: "Conta bancária de exemplo", diaFechamento: 20, diaVencimento: 28, ativo: true,
}];
export const contas = [{ id: "conta-ficticia", nome: "Conta bancária de exemplo" }];
export type ChamadaEntradaSimulada = { acao: "CRIAR" | "CORRIGIR"; entrada: unknown };

export function registrarChamadaEntrada(acao: ChamadaEntradaSimulada["acao"], entrada: unknown) {
  const chamada: ChamadaEntradaSimulada = { acao, entrada: structuredClone(entrada) };
  window.dispatchEvent(new CustomEvent("entrada-avulsa-simulada", { detail: chamada }));
}
