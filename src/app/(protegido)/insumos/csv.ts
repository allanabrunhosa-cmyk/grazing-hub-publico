// Colunas do CSV do catálogo global — usadas no modelo pra baixar, na importação e na exportação.
// A composição (receita) de uma Preparação não entra na CSV — é montada na tela.
export const INSUMO_CSV_COLUMNS = [
  "nome",
  "especificacao",
  "tipo",
  "categoria",
  "unidade",
  "centroCusto",
  "marca",
  "marcasHomologadas",
  "codigoEan",
  "perecivel",
  "validadePadraoDias",
  "estoqueMinimo",
  "estoqueMaximo",
  "custoMedio",
  "fornecedorPrincipal",
  "status",
] as const;

export const INSUMO_CSV_EXEMPLO = {
  nome: "Filé Mignon Suíno",
  especificacao: "Resfriado, sem tempero",
  tipo: "insumo",
  categoria: "Carnes",
  unidade: "KG",
  centroCusto: "Insumos — Matéria-prima e alimentos",
  marca: "",
  marcasHomologadas: "[]",
  codigoEan: "",
  perecivel: "sim",
  validadePadraoDias: "5",
  estoqueMinimo: "10",
  estoqueMaximo: "50",
  custoMedio: "32.90",
  fornecedorPrincipal: "",
  status: "ativo",
};

export function downloadCsv(filename: string, rows: Record<string, string>[]) {
  const header = INSUMO_CSV_COLUMNS.join(",");
  const body = rows
    .map((row) =>
      INSUMO_CSV_COLUMNS.map((col) => {
        const value = row[col] ?? "";
        return value.includes(",") || value.includes('"') || value.includes("\n")
          ? `"${value.replace(/"/g, '""')}"`
          : value;
      }).join(",")
    )
    .join("\n");
  const csvContent = `${header}\n${body}`;

  const blob = new Blob([`﻿${csvContent}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
