"use server";
import { consultarDocumentoDashboard } from "@/lib/fiscal-dashboard/documento";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import type { TipoDocumentoDashboardFiscal } from "@/lib/fiscal-dashboard/tipos";
import { obterDocumentosEmissaoPedidoBrasilNfeAction } from "@/app/(protegido)/vendas/pedidos/emissao-actions";
export async function consultarDocumentoDashboardAction(tipo: TipoDocumentoDashboardFiscal, id: string) {
  await exigirPermissao("financeiro.fiscal.painel");
  return consultarDocumentoDashboard(tipo, id);
}
/** Recupera somente arquivos da identidade já autorizada. Não emite nem cancela a nota. */
export async function recuperarArquivosDocumentoDashboardAction(id: string) {
  await exigirPermissao("financeiro.fiscal.painel");
  await exigirPermissao("vendas.fiscal", "editar");
  await exigirPermissao("vendas.pedidos");
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return { erro: "Documento inválido." };
  const resultado = await obterDocumentosEmissaoPedidoBrasilNfeAction(id);
  if ("erro" in resultado) return { erro: resultado.erro };
  if (resultado.documento.xmlDisponivel === false) {
    const aviso = "avisoArquivos" in resultado.documento ? resultado.documento.avisoArquivos : null;
    return { erro: typeof aviso === "string" && aviso.trim() ? aviso : "O XML da nota ainda não está disponível no HUB. Tente recuperar os arquivos novamente." };
  }
  return { ok: true as const };
}
