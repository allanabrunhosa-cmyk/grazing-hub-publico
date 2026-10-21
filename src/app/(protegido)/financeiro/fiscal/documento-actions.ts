"use server";
import { consultarDocumentoDashboard } from "@/lib/fiscal-dashboard/documento";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import type { TipoDocumentoDashboardFiscal } from "@/lib/fiscal-dashboard/tipos";
export async function consultarDocumentoDashboardAction(tipo: TipoDocumentoDashboardFiscal, id: string) {
  await exigirPermissao("financeiro.fiscal.painel");
  return consultarDocumentoDashboard(tipo, id);
}
