import type { TextItem } from "pdfjs-dist/types/src/display/api";

/** Ordena pelas posições impressas: o stream Itaú traz compras antes dos títulos. */
export function ordenarColunas(itens: TextItem[], largura: number): string[] {
  return [0, 1].map(lado => {
    // No layout Itaú Empresas, os dois blocos são separados após 58% da página.
    const selecionados = itens.filter(i => i.str.trim() && (i.transform[4] < largura * 0.58 ? 0 : 1) === lado)
      .sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
    const linhas: { y: number; itens: TextItem[] }[] = [];
    for (const item of selecionados) {
      const ultima = linhas.at(-1);
      if (ultima && Math.abs(ultima.y - item.transform[5]) < 3) ultima.itens.push(item);
      else linhas.push({ y: item.transform[5], itens: [item] });
    }
    return linhas.map(linha => {
      let fim = -1;
      return linha.itens.sort((a, b) => a.transform[4] - b.transform[4]).map(i => {
        const texto = (fim >= 0 && i.transform[4] - fim > 1.5 ? " " : "") + i.str;
        fim = i.transform[4] + i.width; return texto;
      }).join("");
    }).join("\n");
  });
}

export async function lerColunasItau(bytes: Buffer, senha?: string) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const tarefa = getDocument({ data: new Uint8Array(bytes), password: senha, isEvalSupported: false, stopAtErrors: true });
  try {
    const doc = await tarefa.promise, colunas = new Map<number, string[]>();
    for (let i = 2; i <= Math.min(doc.numPages, 80); i++) {
      const pagina = await doc.getPage(i), conteudo = await pagina.getTextContent();
      colunas.set(i, ordenarColunas(conteudo.items.filter((item): item is TextItem => "str" in item), pagina.getViewport({ scale: 1 }).width));
    }
    return colunas;
  } finally { await tarefa.destroy(); }
}
