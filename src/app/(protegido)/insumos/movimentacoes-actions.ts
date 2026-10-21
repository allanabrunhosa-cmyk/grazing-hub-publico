"use server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarExtratoIndividual, type FiltroExtratoIndividual, type ExtratoIndividualDTO } from "@/lib/estoque/extrato-individual";
import { ErroCorrecaoEntrada } from "@/lib/inventario/entrada-avulsa-historico";
export async function consultarMovimentacoesItemAction(filtros: FiltroExtratoIndividual): Promise<{ dados: ExtratoIndividualDTO } | { erro: string }> {
  await exigirPermissao("insumos");
  await exigirPermissao("inventario");
  try { return { dados: await consultarExtratoIndividual(filtros) }; }
  catch (erro) { return { erro: erro instanceof ErroCorrecaoEntrada ? erro.message : "Não foi possível consultar. Tente novamente." }; }
}
