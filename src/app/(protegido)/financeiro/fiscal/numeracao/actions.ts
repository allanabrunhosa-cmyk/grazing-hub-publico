"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarNumeracaoFiscalBrasilNfe, atualizarNumeracaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/numeracao";
import { ErroConfiguracaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dominio";
export async function consultarNumeracaoFiscalBrasilNfeAction(entrada: unknown) {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "editar");
  try {
    const dados = await consultarNumeracaoFiscalBrasilNfe(entrada, sessao);
    revalidatePath("/financeiro/fiscal/numeracao");
    revalidatePath("/financeiro/fiscal/configuracoes");
    return { ok: true as const, dados };
  } catch (erro) { return { erro: erro instanceof ErroConfiguracaoBrasilNfe ? erro.message : "A consulta de numeração não foi concluída. Nenhum contador foi alterado." }; }
}
export async function atualizarNumeracaoFiscalBrasilNfeAction(entrada: unknown) {
  const sessao = await exigirPermissao("configuracoes.brasilnfe", "editar");
  try {
    const dados = await atualizarNumeracaoFiscalBrasilNfe(entrada, sessao);
    revalidatePath("/financeiro/fiscal/numeracao");
    revalidatePath("/financeiro/fiscal/configuracoes");
    return { ok: true as const, dados };
  } catch (erro) {
    if (erro instanceof ErroConfiguracaoBrasilNfe) return { erro: erro.message };
    return { erro: "Resultado da atualização não confirmado. Consulte a numeração antes de repetir; nenhum reenvio será automático.", conferenciaNecessaria: true as const };
  }
}
