// Colunas do CSV de fornecedores — usadas no modelo pra baixar, na importação e na exportação.
// canaisPedido/formasPagamento aceitam múltiplos valores separados por ponto e vírgula (;).
export const FORNECEDOR_CSV_COLUMNS = [
  "nome",
  "razaoSocial",
  "cnpj",
  "email",
  "site",
  "contatoNome",
  "telefone",
  "canaisPedido",
  "formasPagamento",
  "prazoPagamentoDias",
  "prazoEntregaDias",
  "status",
  "observacoes",
] as const;

export const FORNECEDOR_CSV_EXEMPLO = {
  nome: "Distribuidora Boa Mesa",
  razaoSocial: "Distribuidora Boa Mesa LTDA",
  cnpj: "12345678000199",
  email: "contato@boamesa.com.br",
  site: "https://boamesa.com.br",
  contatoNome: "Maria Souza",
  telefone: "11999998888",
  canaisPedido: "WhatsApp;E-mail",
  formasPagamento: "Pix;Boleto",
  prazoPagamentoDias: "30",
  prazoEntregaDias: "3",
  status: "ativo",
  observacoes: "Entrega às terças e quintas.",
};

export function downloadCsv(filename: string, rows: Record<string, string>[]) {
  const header = FORNECEDOR_CSV_COLUMNS.join(",");
  const body = rows
    .map((row) =>
      FORNECEDOR_CSV_COLUMNS.map((col) => {
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
