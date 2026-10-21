import type { PreviaFornecedorNota, CampoFornecedor } from "@/lib/notas-fiscais/dados-fornecedor";
let salvo = false;
export async function prepararConciliacaoFornecedorAction(_notaId: string, fornecedorId?: string | null): Promise<PreviaFornecedorNota> {
  return {
    fornecedorId: fornecedorId === undefined ? "fornecedor-visual" : fornecedorId,
    fornecedores: [{ id: "fornecedor-visual", nome: "Laticínios Serra" }, { id: "armazem", nome: "Armazém Central" }],
    atual: { nome: "Laticínios Serra", razaoSocial: "Razão social antiga", cnpj: null, telefone: null },
    nota: { nome: "Laticínios Serra", razaoSocial: "Laticínios Serra Comércio de Alimentos Ltda.", cnpj: "00000000000000", telefone: "1100000000" },
    campos: salvo ? [] : ["razaoSocial", "cnpj", "telefone"], versao: "previa-simulada", vinculoAnterior: salvo ? "fornecedor-visual" : null,
  };
}
export async function conciliarFornecedorNotaAction(entrada: { notaId: string; fornecedorId: string; versao: string; campos: CampoFornecedor[] }) {
  salvo = true;
  return { fornecedor: { id: entrada.fornecedorId, nome: entrada.fornecedorId === "armazem" ? "Armazém Central" : "Laticínios Serra", memorizado: true as const } };
}
