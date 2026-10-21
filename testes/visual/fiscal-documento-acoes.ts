import type { DetalheDocumentoDashboard } from "@/lib/fiscal-dashboard/documento";
export async function consultarDocumentoDashboardAction(): Promise<DetalheDocumentoDashboard> {
  return { campos: [{ nome: "Emitente", valor: "Empresa sintética" }, { nome: "Chave de acesso", valor: "3".repeat(44) }], itens: [{ numero: 1, descricao: "Produto sintético para conferência visual", quantidade: 2, unidade: "UN", valor: 120 }], aviso: null };
}
