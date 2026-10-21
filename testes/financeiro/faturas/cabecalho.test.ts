import { describe, expect, it } from "vitest";
import { completarCiclo, identificarCabecalho, identificarCartao } from "@/lib/financeiro/faturas/cabecalho";
import { cabecalhoBanco, lerPdfBanco, type PaginaTextoFatura } from "@/lib/financeiro/faturas/pdf-bancos";
import { ordenarColunas } from "@/lib/financeiro/faturas/pdf-colunas";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
const primeiraItau = "Cartão Itaú Empresas\nNumero da conta\n5526.XXXX.XXXX.1234\nTotal desta fatura 150,00\nVencimento: 15/01/2026\nEmissão: 02/01/2026\nPrevisão prox. Fechamento: 02/02/2026\nTotal a pagar R$ 180,00";
const pagina = (numero: number, texto: string, colunas = [texto]): PaginaTextoFatura => ({ numero, texto, colunas });
describe("cabeçalho da fatura, sem adivinhar dados ausentes", () => {
  it("lê rótulos e rejeita valor mínimo/limite/simulação como total", () => {
    const c = identificarCabecalho("Total da sua fatura\nR$ 150,00\nLimite de crédito total\nR$ 9.000,00\nPagamento mínimo: R$ 15,00\nTotal a pagar R$ 199,00\nVencimento: 15/09/2026");
    expect(c.dados.total?.valor).toBe("150.00"); expect(c.dados.competencia?.valor).toBe("2026-09");
    expect(c.dados.inicio).toBeUndefined(); expect(c.dados.fechamento).toBeUndefined();
  });
  it("ambiguidade não escolhe o primeiro valor", () => {
    const c = identificarCabecalho("Total da fatura 10,00\nTotal da fatura 20,00");
    expect(c.dados.total).toBeUndefined(); expect(c.conflitos).toContain("total");
  });
  it("não soma compras para preencher o total", () => expect(identificarCabecalho("01/09/2026 MERCADO 10,00").dados.total).toBeUndefined());
  it("lê crédito negativo e competência explícita", () => {
    const c = identificarCabecalho("Saldo credor da fatura R$ 10,50\nCompetência: setembro de 2026\nVencimento: 15/10/2026");
    expect(c.dados.total?.valor).toBe("-10.50"); expect(c.dados.competencia?.valor).toBe("2026-09");
  });
  it("não aceita datas inválidas", () => expect(identificarCabecalho("Vencimento: 31/02/2026").dados.vencimento).toBeUndefined());
  it("período explícito tem precedência sobre convenção", () => {
    const c = completarCiclo(identificarCabecalho("Período da fatura: 01/08/2026 a 02/09/2026\nFechamento: 02/09/2026"));
    expect(c.dados.inicio?.valor).toBe("2026-08-01"); expect(c.dados.inicio?.origem).toBe("PDF");
  });
  it("não confunde final principal com cartões virtuais", () => {
    const c = cabecalhoBanco([pagina(1, primeiraItau), pagina(2, "NOME (final 9999)\nLançamentos no cartão (final 9999) 150,00")])!;
    expect(c.dados.final?.valor).toBe("1234"); expect(c.dados.fechamento?.valor).toBe("2026-01-02");
    expect(c.dados.fechamento?.origem).toBe("CONVENCAO"); expect(c.dados.inicio?.valor).toBe("2025-12-03");
  });
  it("só reconhece cadastro por final único, não nome aproximado", () => {
    const c = identificarCabecalho("Cartão final 1234");
    expect(identificarCartao(c, [{ id: "a", final: "1234" }])).toBe("a");
    expect(identificarCartao(c, [{ id: "a", final: "1234" }, { id: "b", final: "1234" }])).toBeNull();
    expect(identificarCartao(c, [{ id: "a", final: null }])).toBeNull();
  });
});
describe("seções atuais dos bancos", () => {
  it("Inter separa pagamento anterior, ofertas e próximas parcelas", () => {
    const r = lerPdfBanco([pagina(1, "Resumo da fatura\nTotal da sua fatura\nR$ 35,00\nData de Vencimento\n10/09/2026"), pagina(2, "BANCO INTER S/A\nCARTÃO 1234****5678\nDespesas da fatura\n09 de abr. 2026 LOJA (Parcela 05 de 12) - R$ 30,00\n25 de ago. 2026 PAGAMENTO DE FATURA - + R$ 100,00\n03 de set. 2026 IOF - R$ 5,00\nTotal CARTÃO 1234****5678 R$ 35,00\nPróxima fatura\n09 de abr. 2026 LOJA (Parcela 06 de 12) - R$ 30,00\nDATA DOCUMENTO\n03/09/2026")])!;
    expect(r.linhas).toHaveLength(2); expect(r.linhas.reduce((s,l)=>s+l.valor,0)).toBe(3500);
    expect(r.linhas[0].parcela).toBe(5); expect(r.linhas[1].tipo).toBe("IOF"); expect(r.naoReconhecidas).toEqual([]);
  });
  it("Itaú inclui créditos, IOF e encargos reais, não totais nem parcelas futuras", () => {
    const texto = "Lançamentos: compras e saques\n20/12 LOJA02/12 100,00\n21/12 ESTORNO LOJA - 10,00\nLançamentos internacionais\n23/12 SOFTWARE 20,00\nDOVER 3,00 USD 3,00\nRepasse de IOF em R$ 2,00\nTotal lançamentos inter. em R$ 22,00\nCompras parceladas - próximas faturas\n20/12 LOJA03/12 100,00\nEncargos cobrados nesta fatura\nJuros de mora 1,00 % a.m 3,00\nIOF de financiamento(0,38 %) 0,00\nE Total de encargos em R$ 3,00";
    const r = lerPdfBanco([pagina(1, primeiraItau), pagina(2, texto)])!;
    expect(r.linhas).toHaveLength(5); expect(r.linhas.reduce((s,l)=>s+l.valor,0)).toBe(11500);
    expect(r.linhas[0].data).toBe("2025-12-20"); expect(r.linhas[1].data).toBe("2025-12-21");
    expect(r.linhas[1].valor).toBe(-1000); expect(r.avisos.join(" ")).toContain("ano foi reconstituído");
  });
  it("linha inválida de compra continua pendente, não desaparece", () => {
    const r = lerPdfBanco([pagina(1, primeiraItau), pagina(2, "Lançamentos: compras e saques\n31/02 LOJA 20,00\n21/12 LOJA valor ilegível")])!;
    expect(r.naoReconhecidas).toHaveLength(2);
  });
  it("layout desconhecido não assume banco", () => expect(lerPdfBanco([pagina(1, "Outro documento")])).toBeNull());
  it("recompõe colunas por posição sem perder o valor da esquerda", () => {
    const item=(str:string,x:number,y:number,width=20)=>({str,transform:[1,0,0,1,x,y],width,height:8} as TextItem);
    const c=ordenarColunas([item("5,54",328,10),item("01/09 LOJA",151,10,80),item("COLUNA DIREITA",367,10),item("ç",170,30,4),item("Lan",155,30,15),item("amentos",174,30)],595);
    expect(c[0]).toBe("Lançamentos\n01/09 LOJA 5,54"); expect(c[1]).toBe("COLUNA DIREITA");
  });
});
