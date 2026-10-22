"use server";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { aplicarManutencaoFiscal, consultarFichaFiscal, revisarManutencaoFiscal, salvarManutencaoFiscal, simularConciliacaoFiscal } from "@/lib/tributacao/manutencao";
import { ErroEstruturaFiscal } from "@/lib/tributacao/validacao";
import type { SalvarVersaoFiscalEntrada } from "@/lib/tributacao/tipos";
import { listarRegrasTributariasBrasilNfe, obterHistoricoRegraTributariaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias";
const mensagem = (e: unknown) => e instanceof ErroEstruturaFiscal ? e.message : "A operação fiscal não foi confirmada. Atualize a ficha e consulte o histórico antes de repetir.";
export async function consultarFichaFiscalAction(id: string) {
  const s = await exigirPermissao("vendas.fiscal");
  try { return { ok: true as const, dados: await consultarFichaFiscal(id, s) }; } catch (e) { return { erro: mensagem(e) }; }
}
export async function salvarManutencaoFiscalAction(entradas: SalvarVersaoFiscalEntrada[]) {
  const s = await exigirPermissao("vendas.fiscal", "editar");
  try { return { ok: true as const, ...await salvarManutencaoFiscal(entradas, s) }; } catch (e) { return { erro: mensagem(e) }; }
}
export async function revisarManutencaoFiscalAction(ids: string[]) {
  const s = await exigirPermissao("vendas.fiscal", "editar");
  try { return { ok: true as const, ...await revisarManutencaoFiscal(ids, s) }; } catch (e) { return { erro: mensagem(e) }; }
}
export async function aplicarManutencaoFiscalAction(ids: string[], hash: string) {
  const s = await exigirPermissao("vendas.fiscal", "editar");
  try {
    const r = await aplicarManutencaoFiscal(ids, hash, s);
    revalidatePath("/vendas", "layout"); revalidatePath("/financeiro/fiscal", "layout");
    return { ok: true as const, ...r };
  } catch (e) { return { erro: mensagem(e) }; }
}
export async function simularConciliacaoFiscalAction() {
  const s = await exigirPermissao("vendas.fiscal", "editar");
  try { return { ok: true as const, dados: await simularConciliacaoFiscal(s) }; } catch (e) { return { erro: mensagem(e) }; }
}
export async function consultarHistoricoFiscalLegadoAction(id?: string) {
  const s = await exigirPermissao("vendas.fiscal");
  try {
    if (id) {
      const h = await obterHistoricoRegraTributariaBrasilNfe(id, s);
      return { ok: true as const, registros: h.versoes.map(v => ({ id: v.id, consultaId: h.id, titulo: `Modelo ${h.modelo} · revisão ${v.revisao}`, detalhe: JSON.stringify(v) })) };
    }
    const r = await listarRegrasTributariasBrasilNfe(s);
    return { ok: true as const, registros: r.map(v => ({ id: v.id, consultaId: v.id, titulo: `${v.produtoNome ?? v.grupoNome ?? v.alvo} · modelo ${v.modelo}`, detalhe: `Revisão ${v.revisao}` })) };
  } catch { return { erro: "Não foi possível consultar o histórico anterior. Nenhuma regra foi alterada." }; }
}
