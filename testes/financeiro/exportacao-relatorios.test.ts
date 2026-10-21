import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";
import { calcularDre } from "@/lib/financeiro/calcularDre";
import { calcularPlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { consolidarPlanilhaFluxoCaixaPorMes } from "@/lib/financeiro/fluxoCaixaMensal";
import { montarExportacaoDre, montarExportacaoFluxo } from "@/lib/financeiro/exportacao-relatorios";
import { criarXlsxFinanceiro } from "@/lib/financeiro/exportacao-xlsx";
import { criarPdfFinanceiro } from "@/lib/financeiro/exportacao-pdf";
import { lancamentoTeste } from "./dados-movimentacoes";

const periodo = { de: "2026-09-01", ate: "2026-09-30" };
const plano = [
  { id: "pai", nome: "Pessoal", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "filho", nome: "Pessoal › Benefícios", paiId: "pai", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "neto", nome: "Pessoal › Benefícios › Alimentação", paiId: "filho", grupo: "DESPESAS_OPERACIONAIS" as const },
  { id: "sem", nome: "Sem atividade", grupo: "DESPESAS_OPERACIONAIS" as const },
];
const lancamentos = [
  lancamentoTeste({ id: "direto", categoriaId: "pai", categoriaNome: "Pessoal", valor: 11.25 }),
  lancamentoTeste({ id: "neto", categoriaId: "neto", categoriaNome: plano[2].nome, valor: 23.45, descricao: "=HYPERLINK(\"https://example.invalid\")" }),
  lancamentoTeste({ id: "fora", dataVencimento: "2026-08-10", valor: 100 }),
  lancamentoTeste({ id: "credito", pedidoQuitadoCredito: true, valor: 900 }),
];
function fluxo() {
  const p = calcularPlanilhaFluxoCaixa(1000, lancamentos, periodo, undefined, plano);
  return { p, r: montarExportacaoFluxo(p, lancamentos, periodo.de, periodo.ate) };
}

describe("exportação dos resultados financeiros", () => {
  it("inclui a hierarquia completa, zeros e detalhes filtrados sem duplicar os totais", () => {
    const { p, r } = fluxo();
    expect(r.linhas.find(l => l.nome === plano[2].nome)?.nivel).toBe(3);
    expect(r.linhas.find(l => l.nome === "Pessoal")?.valores.at(-1)).toBeCloseTo(-34.70);
    expect(r.linhas.find(l => l.nome === "Sem atividade")?.valores.at(-1)).toBe(0);
    expect(r.linhas.find(l => l.nome === "Total de Despesas")?.valores.at(-1)).toBeCloseTo(-34.70);
    expect(r.linhas.at(-2)?.nome).toBe("Saldo do Dia");
    expect(r.linhas.at(-2)?.valores.at(-1)).toBe(p.saldoFinal);
    expect(r.linhas.at(-1)?.nome).toBe("Resultado do Dia");
    expect(r.linhas.at(-1)?.valores[9]).toBeCloseTo(-34.70);
    expect(r.linhas.at(-1)?.valores.at(-1)).toBeCloseTo(-34.70);
    expect(r.colunas.at(-1)).toBe("Total do período");
    expect(r.detalhes?.map(l => l.valor).sort()).toEqual([-11.25, -23.45].sort());
    expect(r.detalhes?.every(l => l.status === "Pendente (projeção)")).toBe(true);
    expect(r.linhas.find(l => l.nome === plano[2].nome)?.pendentes?.at(-1)).toBe(true);
  });

  it("exporta o consolidado mensal com somas e datas reais nos detalhes", () => {
    const limites = { de: "2026-09-01", ate: "2026-10-31" };
    const dados = [
      lancamentoTeste({ id: "entrada-setembro", tipo: "RECEITA", categoriaId: "vendas", categoriaNome: "Vendas", categoriaGrupo: "RECEITA_BRUTA", status: "BAIXADO", valor: 110.55, dataVencimento: "2026-09-04T12:00:00Z", dataPagamento: "2026-09-13T12:00:00Z" }),
      lancamentoTeste({ id: "entrada-outubro", tipo: "RECEITA", categoriaId: "vendas", categoriaNome: "Vendas", categoriaGrupo: "RECEITA_BRUTA", status: "BAIXADO", valor: 20.35, dataVencimento: "2026-09-15T12:00:00Z", dataPagamento: "2026-10-07T12:00:00Z" }),
      lancamentoTeste({ id: "despesa-setembro", categoriaId: "pai", categoriaNome: "Pessoal", valor: 11.25 }),
      lancamentoTeste({ id: "despesa-outubro", categoriaId: "neto", categoriaNome: plano[2].nome, status: "BAIXADO", valor: 23.45, dataVencimento: "2026-10-12T12:00:00Z", dataPagamento: "2026-10-02T12:00:00Z" }),
      lancamentoTeste({ id: "fora", dataVencimento: "2026-08-10", valor: 100 }),
      lancamentoTeste({ id: "credito", pedidoQuitadoCredito: true, valor: 900 }),
    ];
    const diario = calcularPlanilhaFluxoCaixa(1000, dados, limites, undefined, plano);
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(diario);
    const r = montarExportacaoFluxo(mensal, dados, limites.de, limites.ate, "mensal");
    expect(r.colunas).toEqual(["09/2026", "10/2026"]);
    expect(r.agrupamentoFluxo).toBe("mensal");
    expect(r.arquivo).toBe("fluxo-de-caixa-mensal-2026-09-01-2026-10-31");
    expect(r.filtros).toContain("Agrupamento: Mensal");
    const receitas = r.linhas.find(l => l.nome === "Total de Receitas")!.valores;
    [110.55, 20.35].forEach((valor, indice) => expect(receitas[indice]).toBeCloseTo(valor));
    const despesas = r.linhas.find(l => l.nome === "Total de Despesas")!.valores;
    [-11.25, -23.45].forEach((valor, indice) => expect(despesas[indice]).toBeCloseTo(valor));
    expect(r.linhas.find(l => l.nome === plano[2].nome)?.nivel).toBe(3);
    expect(r.linhas.find(l => l.nome === "Sem atividade")?.valores).toEqual([0, 0]);
    expect(r.linhas.at(-2)?.nome).toBe("Saldo do Mês");
    expect(r.linhas.at(-2)?.valores.at(-1)).toBe(diario.saldoFinal);
    expect(r.linhas.at(-1)).toMatchObject({ nome: "Resultado do Mês", valores: [99.30, -3.10] });
    expect(r.linhas.every(l => l.valores.length === r.colunas.length && (!l.pendentes || l.pendentes.length === r.colunas.length))).toBe(true);
    expect(r.detalhes?.map(l => [l.dia, l.valor])).toEqual(expect.arrayContaining([
      ["2026-09-13", 110.55], ["2026-10-07", 20.35], ["2026-09-10", -11.25], ["2026-10-02", -23.45],
    ]));
    expect(r.detalhes).toHaveLength(4);
    expect(r.detalhes?.find(l => l.valor === -11.25)?.status).toBe("Pendente (projeção)");
    expect(r.detalhes?.find(l => l.valor === 110.55)?.status).toBe("Baixado");
    expect(montarExportacaoFluxo(diario, dados, limites.de, limites.ate, "diario"))
      .toEqual(montarExportacaoFluxo(diario, dados, limites.de, limites.ate));
  });

  it.each([1, 2, 8])("gera PDF e XLSX reais com %i meses completos sem coluna Total ou meses duplicados", async quantidadeMeses => {
    const limites = { de: "2026-01-01", ate: new Date(Date.UTC(2026, quantidadeMeses, 0)).toISOString().slice(0, 10) };
    const dados = Array.from({ length: quantidadeMeses }, (_, indice) => {
      const mes = String(indice + 1).padStart(2, "0");
      return [
        lancamentoTeste({ id: `receita-${mes}`, tipo: "RECEITA", categoriaId: "vendas", categoriaNome: "Vendas", categoriaGrupo: "RECEITA_BRUTA", valor: 100.11 + indice, status: "BAIXADO", dataVencimento: `2026-${mes}-04`, dataPagamento: `2026-${mes}-12` }),
        lancamentoTeste({ id: `despesa-${mes}`, valor: 10.01 + indice, dataVencimento: `2026-${mes}-20` }),
      ];
    }).flat();
    const mensal = consolidarPlanilhaFluxoCaixaPorMes(calcularPlanilhaFluxoCaixa(1000, dados, limites));
    const r = montarExportacaoFluxo(mensal, dados, limites.de, limites.ate, "mensal");
    expect(r.colunas).toHaveLength(quantidadeMeses);
    expect(r.colunas).not.toContain("Total do período");
    expect(r.linhas.every(l => l.valores.length === quantidadeMeses && (!l.pendentes || l.pendentes.length === quantidadeMeses))).toBe(true);
    expect(r.linhas.at(-1)).toMatchObject({ nome: "Resultado do Mês", valores: Array(quantidadeMeses).fill(90.10) });

    const bytes = XLSX.write(criarXlsxFinanceiro(r), { type: "buffer", bookType: "xlsx", cellStyles: true });
    const livro = XLSX.read(bytes, { cellStyles: true });
    const folha = livro.Sheets["Fluxo de Caixa"];
    expect(XLSX.utils.decode_range(folha["!ref"]!).e.c).toBe(quantidadeMeses);
    expect(XLSX.utils.sheet_to_json(folha, { header: 1 })[4]).toEqual(["Categoria", ...r.colunas]);
    const indiceResultado = r.linhas.findIndex(l => l.nome === "Resultado do Mês") + 5;
    for (let coluna = 1; coluna <= quantidadeMeses; coluna++) {
      expect(folha[XLSX.utils.encode_cell({ r: indiceResultado, c: coluna })]).toMatchObject({ t: "n", v: 90.10 });
    }
    expect(livro.Sheets["Lançamentos"]["A4"].v).toBe("12/01/2026");

    const pdf = criarPdfFinanceiro(r);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(Math.ceil(quantidadeMeses / 6) + 1);
    const leitor = new PDFParse({ data: new Uint8Array(pdf.output("arraybuffer")) });
    try {
      const { text } = await leitor.getText();
      expect(text).toContain("Resumo mensal");
      expect(text).toContain("Resultado do Mês");
      expect(text).toContain("90,10");
      expect(text).not.toContain("Total do período");
      expect(text).not.toContain("Total referente ao período completo");
      for (const coluna of r.colunas) {
        expect(text.match(new RegExp(`(?<![\\d/])${coluna}(?!\\d)`, "g"))).toHaveLength(1);
      }
    } finally { await leitor.destroy(); }
  });

  it("preserva números, textos seguros, agrupamentos reabríveis e detalhes no XLSX real", async () => {
    const { r } = fluxo();
    const bytes = XLSX.write(criarXlsxFinanceiro(r), { type: "buffer", bookType: "xlsx", cellStyles: true });
    const livro = XLSX.read(bytes, { cellStyles: true });
    const folha = livro.Sheets["Fluxo de Caixa"];
    const indice = r.linhas.findIndex(l => l.nome === plano[2].nome) + 5;
    expect(folha["!rows"]?.[indice]).toMatchObject({ level: 3, hidden: true });
    expect(folha[XLSX.utils.encode_cell({ r: indice, c: 31 })]).toMatchObject({ t: "n", v: -23.45 });
    const indiceResultado = r.linhas.findIndex(l => l.nome === "Resultado do Dia") + 5;
    expect(folha[XLSX.utils.encode_cell({ r: indiceResultado, c: 31 })]).toMatchObject({ t: "n", v: -34.70 });
    expect(folha["!rows"]?.[5]?.hidden).not.toBe(true);
    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file("xl/worksheets/sheet1.xml")!.async("string")).toContain('summaryBelow="0"');
    const indiceDetalhe = r.detalhes!.findIndex(l => l.descricao.startsWith("=HYPERLINK"));
    const detalhe = livro.Sheets["Lançamentos"][`C${indiceDetalhe + 4}`];
    expect(detalhe.t).toBe("s");
    expect(detalhe.f).toBeUndefined();
    expect(detalhe.v).toContain("=HYPERLINK");
  });

  it("preserva modo, liquidações parciais e valor de competência da DRE", () => {
    const dados = [{ ...lancamentoTeste({ valor: 100, categoriaGrupo: "RECEITA_BRUTA" }), valorCompetencia: 80, liquidacoesCartao: [{ valor: 25, data: "2026-09-12T12:00:00Z" }, { valor: 30, data: "2026-10-01T12:00:00Z" }] }];
    const limites = { de: new Date("2026-09-01T00:00:00"), ate: new Date("2026-09-30T23:59:59") };
    for (const [modo, valor] of [["COMPETENCIA", 80], ["CAIXA", 25]] as const) {
      const resultado = calcularDre(dados, limites, modo);
      const r = montarExportacaoDre(resultado, periodo.de, periodo.ate, modo);
      expect(r.linhas[0].valores).toEqual([valor]);
      expect(r.linhas.at(-1)?.valores).toEqual([valor]);
      expect(r.linhas[1].nivel).toBe(1);
      expect(r.filtros).toContain(modo === "CAIXA" ? "Caixa" : "Competência");
    }
  });

  it("não inventa limites ao exportar filtro aberto e aceita relatório vazio", () => {
    const r = montarExportacaoDre(calcularDre([], { de: new Date(0), ate: new Date() }, "CAIXA"), "", "", "CAIXA");
    expect(r.filtros).toContain("sem limite inicial a sem limite final");
    expect(r.linhas.every(l => l.valores[0] === 0)).toBe(true);
    expect(criarXlsxFinanceiro(r).SheetNames).toEqual(["DRE"]);
    expect(criarPdfFinanceiro(r).getNumberOfPages()).toBeGreaterThan(0);
  });

  it("gera PDF paginado com todos os dias, categorias recolhidas, detalhes e totais", async () => {
    const { r } = fluxo();
    const pdf = criarPdfFinanceiro(r);
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(6);
    const leitor = new PDFParse({ data: new Uint8Array(pdf.output("arraybuffer")) });
    try {
      const { text } = await leitor.getText();
      expect(text).toContain("01/09/2026");
      expect(text).toContain("30/09/2026");
      expect(text).toContain("Alimentação");
      expect(text).toContain("34,70");
      expect(text).toContain("Pendente (projeção)");
      expect(text).toContain("HYPERLINK");
      expect(text).toContain("Resumo diário");
      expect(text).toContain("Total do período");
      expect(text).toContain("Resultado do Dia");
    } finally { await leitor.destroy(); }
  });
});
