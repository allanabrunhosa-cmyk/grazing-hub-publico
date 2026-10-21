import * as XLSX from "xlsx";
import { dataRelatorio, type RelatorioFinanceiro } from "./exportacao-relatorios";

const MOEDA = '#,##0.00;[Red]-#,##0.00';
export const NOTA_EXPORTACAO = "Valores em R$. * Inclui pendências (projeção). Grupos e categorias contêm subtotais: não some novamente os níveis.";

export function criarXlsxFinanceiro(relatorio: RelatorioFinanceiro) {
  if (relatorio.colunas.length > 16383) throw new Error("O período excede o limite de colunas do Excel. Reduza o intervalo.");
  const dados = [
    [relatorio.titulo], [relatorio.filtros], [NOTA_EXPORTACAO],
    ["Use os controles + / - à esquerda para abrir ou recolher os grupos."],
    ["Categoria", ...relatorio.colunas],
    ...relatorio.linhas.map(l => [`${"  ".repeat(l.nivel)}${l.nome}`, ...l.valores]),
  ];
  const folha = XLSX.utils.aoa_to_sheet(dados);
  folha["!cols"] = [{ wch: 64 }, ...relatorio.colunas.map(() => ({ wch: 22 }))];
  folha["!outline"] = { above: true };
  folha["!rows"] = dados.map((_, i) => i < 5 ? {} : {
    level: Math.min(relatorio.linhas[i - 5].nivel, 7), hidden: relatorio.linhas[i - 5].nivel > 0,
  });
  // Textos permanecem células de texto, mesmo que comecem por =, +, - ou @.
  relatorio.linhas.forEach((linha, r) => linha.valores.forEach((_, c) => {
    folha[XLSX.utils.encode_cell({ r: r + 5, c: c + 1 })].z = linha.pendentes?.[c]
      ? '#,##0.00" *";[Red]-#,##0.00" *"' : MOEDA;
  }));
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, folha, relatorio.titulo);
  if (relatorio.detalhes) {
    const detalhes = XLSX.utils.aoa_to_sheet([
      [relatorio.titulo + " — Lançamentos"], [relatorio.filtros],
      ["Data", "Categoria", "Descrição", "Situação", "Valor (R$)"],
      ...relatorio.detalhes.map(l => [dataRelatorio(l.dia), l.categoria, l.descricao, l.status, l.valor]),
    ]);
    detalhes["!cols"] = [{ wch: 14 }, { wch: 55 }, { wch: 60 }, { wch: 24 }, { wch: 22 }];
    detalhes["!autofilter"] = { ref: `A3:E${Math.max(3, relatorio.detalhes.length + 3)}` };
    relatorio.detalhes.forEach((_, i) => { detalhes[`E${i + 4}`].z = MOEDA; });
    XLSX.utils.book_append_sheet(livro, detalhes, "Lançamentos");
  }
  return livro;
}

export function baixarXlsxFinanceiro(relatorio: RelatorioFinanceiro) {
  XLSX.writeFile(criarXlsxFinanceiro(relatorio), `${relatorio.arquivo}.xlsx`, { compression: true, cellStyles: true });
}
