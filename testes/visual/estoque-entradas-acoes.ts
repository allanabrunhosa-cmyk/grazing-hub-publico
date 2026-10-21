import type { FiltroExtratoIndividual, ExtratoIndividualDTO } from "@/lib/estoque/extrato-individual";
export async function corrigirEntradaAvulsaAction() {
  await new Promise(resolve => setTimeout(resolve, 400));
  return { erro: "Simulação: saldo disponível insuficiente. O rascunho foi preservado." };
}
export async function consultarMovimentacoesItemAction(f: FiltroExtratoIndividual): Promise<{ dados: ExtratoIndividualDTO }> {
  const linhas: ExtratoIndividualDTO["linhas"] = [{ id: "ajuste", data: "2026-10-11T13:15:00Z", tipo: "AJUSTE_SAIDA", quantidade: "2", entrada: false, saldoAnterior: "6", saldoPosterior: "4", origem: "Entrada avulsa", identificador: "EA-000123", href: "/inventario/entradas/entrada-ficticia", local: "Câmara fria", responsavel: "Conferente fictício", observacao: "Correção após consumo parcial" }, { id: "consumo", data: "2026-10-10T20:00:00Z", tipo: "SAIDA_CONSUMO", quantidade: "4", entrada: false, saldoAnterior: "10", saldoPosterior: "6", origem: "Produção", identificador: "produção-fictícia", href: "/inventario/producao", local: "Câmara fria", responsavel: "Operador fictício", observacao: null }, { id: "entrada", data: "2026-10-10T17:23:00Z", tipo: "ENTRADA_COMPRA", quantidade: "10", entrada: true, saldoAnterior: "0", saldoPosterior: "10", origem: "Entrada avulsa", identificador: "EA-000123", href: "/inventario/entradas/entrada-ficticia", local: "Câmara fria", responsavel: "Operador fictício", observacao: null }];
  const filtradas = linhas.filter(i => !f.tipo || i.tipo === f.tipo); if (f.ordem === "asc") filtradas.reverse();
  return { dados: { linhas: filtradas, total: filtradas.length, pagina: 1, paginas: 1 } };
}

export async function consultarEntradaAvulsaAction() {
  const { detalhe, insumos, locais } = await import("./estoque-entradas-dados");
  return { detalhe, insumos, locais };
}
export async function excluirEntradaAvulsaAction() { return { erro: "Simulação: saldo insuficiente. Nenhuma alteração foi aplicada." }; }
