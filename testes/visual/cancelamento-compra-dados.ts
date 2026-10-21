import type { ResumoCancelamentoCompra } from "@/lib/financeiro/cancelamento-compra-tipos";
export const compraFicticia: ResumoCancelamentoCompra = {
  chaveOrigem: "NOTA:compra-ficticia", descricao: "NF-e nº 12345 — Fornecedor de teste",
  token: "a".repeat(64), quantidadeLancamentos: 8, valor: "449.68", cancelada: false,
  itens: ["Detergente", "Sabão", "Desinfetante", "Esponja", "Luva", "Pano", "Saco", "Álcool"].map((nome, i) => ({
    id: "insumo-" + i, descricao: nome + " de teste", quantidade: String(i + 1), unidade: "UN",
    local: "Estoque principal", data: "2026-09-17T15:00:00Z", movimentoId: "entrada-" + i,
  })),
};
