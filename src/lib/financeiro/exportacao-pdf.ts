import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { dataRelatorio, type RelatorioFinanceiro } from "./exportacao-relatorios";

const moeda = (valor: number) => valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function criarPdfFinanceiro(relatorio: RelatorioFinanceiro) {
  const fluxo = relatorio.detalhes !== undefined;
  const mensal = fluxo && relatorio.agrupamentoFluxo === "mensal";
  const pdf = new jsPDF({ orientation: fluxo ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: relatorio.titulo, author: "Grazing HUB" });
  const largura = pdf.internal.pageSize.getWidth();
  function cabecalho(secao: string) {
    pdf.setFont("helvetica", "bold").setFontSize(16).setTextColor(25);
    pdf.text(`Grazing HUB | ${relatorio.titulo}`, 12, 15);
    pdf.setFont("helvetica", "normal").setFontSize(9);
    pdf.text(relatorio.filtros, 12, 22);
    pdf.text(secao, 12, 28);
    pdf.setFontSize(8).setTextColor(80);
    pdf.text("Valores em R$. * Inclui pendências (projeção). Todos os níveis estão abertos.", 12, 34);
    pdf.text("Grupos e categorias contêm subtotais: não some novamente os níveis.", 12, 39);
  }
  // Divide os períodos em blocos legíveis. Apenas o diário repete o total do período.
  const blocos: number[][] = [];
  if (fluxo) {
    const periodos = relatorio.colunas.length - (mensal ? 0 : 1);
    for (let i = 0; i < Math.max(1, periodos); i += 6) {
      const indices = Array.from({ length: Math.min(6, periodos - i) }, (_, j) => i + j);
      blocos.push(mensal ? indices : [...indices, periodos]);
    }
  } else blocos.push([0]);
  blocos.forEach((indices, indiceBloco) => {
    if (indiceBloco) pdf.addPage();
    const secao = fluxo
      ? `Resumo ${mensal ? "mensal" : "diário"} | Bloco ${indiceBloco + 1} de ${blocos.length}${mensal ? "" : " | Total referente ao período completo"}`
      : "Demonstrativo de resultado";
    autoTable(pdf, {
      startY: 44, margin: { top: 44, bottom: 15, left: 12, right: 12 },
      head: [["Categoria", ...indices.map(i => relatorio.colunas[i])]],
      body: relatorio.linhas.map(l => [l.nome, ...indices.map(i => moeda(l.valores[i]) + (l.pendentes?.[i] ? " *" : ""))]),
      theme: "grid", styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak", halign: "right" },
      headStyles: { fillColor: [40, 55, 65], halign: "right" },
      columnStyles: { 0: { cellWidth: fluxo ? 77 : 137, halign: "left" } },
      rowPageBreak: "avoid",
      didParseCell: dados => {
        if (dados.section !== "body") return;
        const linha = relatorio.linhas[dados.row.index];
        if (linha.nivel === 0) { dados.cell.styles.fontStyle = "bold"; dados.cell.styles.fillColor = [236, 240, 242]; }
        if (dados.column.index === 0) dados.cell.styles.cellPadding = { top: 2, bottom: 2, right: 2, left: 2 + Math.min(linha.nivel, 7) * 3 };
      },
      willDrawPage: () => cabecalho(secao),
    });
  });
  if (relatorio.detalhes?.length) {
    pdf.addPage();
    autoTable(pdf, {
      startY: 44, margin: { top: 44, bottom: 15, left: 12, right: 12 }, theme: "grid",
      head: [["Data", "Categoria", "Descrição", "Situação", "Valor (R$)"]],
      body: relatorio.detalhes.map(l => [dataRelatorio(l.dia), l.categoria, l.descricao, l.status, moeda(l.valor)]),
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [40, 55, 65] },
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 72 }, 2: { cellWidth: 107 }, 3: { cellWidth: 36 }, 4: { halign: "right" } },
      rowPageBreak: "avoid", willDrawPage: () => cabecalho("Lançamentos do período"),
    });
  }
  const paginas = pdf.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    pdf.setPage(i).setFont("helvetica", "normal").setFontSize(8).setTextColor(80);
    pdf.text(`Página ${i} de ${paginas}`, largura - 12, pdf.internal.pageSize.getHeight() - 7, { align: "right" });
  }
  return pdf;
}

export function baixarPdfFinanceiro(relatorio: RelatorioFinanceiro) {
  criarPdfFinanceiro(relatorio).save(`${relatorio.arquivo}.pdf`);
}
