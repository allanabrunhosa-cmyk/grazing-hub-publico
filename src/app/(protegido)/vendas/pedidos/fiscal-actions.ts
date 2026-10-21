"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { prepararFiscalSaida, solicitarAcaoFiscalSaida, processarFiscalSaida, obterArquivosFiscalSaida } from "@/lib/fiscal-saida/servico";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { previaFiscalPedido, type OpcoesOperacaoFiscal } from "@/lib/tributacao/pedidos";
import { ErroEstruturaFiscal } from "@/lib/tributacao/validacao";
export async function previaFiscalSaidaAction(id: string, versao: number, contexto?: { modelo: "55" | "65" } & OpcoesOperacaoFiscal) {
  const sessao = await exigirPermissao("vendas.fiscal");
  try { return { ok: true as const, previa: await previaFiscalPedido(id, versao, sessao, contexto?.modelo ?? "65", contexto) }; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda || e instanceof ErroEstruturaFiscal ? e.message : "Não foi possível calcular a prévia. Confira o pedido e as configurações." }; }
}
export async function prepararFiscalSaidaAction(id: string, versao: number, modelo: "55" | "65" = "65", opcoes?: OpcoesOperacaoFiscal) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { await prepararFiscalSaida(id, versao, sessao, modelo, opcoes); revalidatePath("/vendas/pedidos", "layout"); return { ok: true as const }; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Não foi possível preparar. Confira a revisão do pedido." }; }
}
export async function acaoFiscalSaidaAction(id: string, acao: "ENVIAR" | "CONSULTAR" | "CANCELAR" | "ARQUIVOS", motivo: string) {
  const sessao = await exigirPermissao("vendas.fiscal", "editar");
  try { if (acao === "ARQUIVOS") await obterArquivosFiscalSaida(id, sessao); else { await solicitarAcaoFiscalSaida(id, acao, motivo, sessao); await processarFiscalSaida(); } revalidatePath("/vendas/pedidos", "layout"); return { ok: true as const }; }
  catch (e) { return { erro: e instanceof ErroPedidoVenda ? e.message : "Resultado não confirmado. Consulte o histórico antes de repetir." }; }
}
