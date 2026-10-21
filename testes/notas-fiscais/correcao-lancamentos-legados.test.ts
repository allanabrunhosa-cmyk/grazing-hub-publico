import { describe, expect, it } from "vitest";
import { planejarCorrecaoNotaLegada, type NotaLegada } from "@/lib/notas-fiscais/correcao-lancamentos-legados";

const xmlTroppo = `<nfeProc><NFe><infNFe>
  <det nItem="1"><prod><vProd>583.00</vProd><vDesc>29.15</vDesc></prod></det>
  <det nItem="2"><prod><vProd>106.00</vProd><vDesc>5.30</vDesc></prod></det>
  <det nItem="3"><prod><vProd>53.00</vProd><vDesc>2.65</vDesc></prod></det>
  <total><ICMSTot><vProd>742.00</vProd><vDesc>37.10</vDesc><vNF>704.90</vNF></ICMSTot></total>
</infNFe></NFe></nfeProc>`;

function notaTroppo(): NotaLegada {
  const brutos = [583, 106, 53];
  return {
    id: "troppo",
    chaveAcesso: "35260924192876000145550010000149021628573414",
    fornecedorNome: "DMD TROPPO ALIMENTOS LTDA",
    valorTotal: 704.9,
    xml: xmlTroppo,
    itens: brutos.map((valor, indice) => ({
      id: `item-${indice + 1}`,
      numeroItem: indice + 1,
      status: "CONCILIADO",
      valorTotalItem: valor,
      valorTotalConciliado: valor,
      composicaoCusto: null,
      lancamentos: [{
        id: `vinculo-${indice + 1}`,
        valor,
        valorDuplicata: 704.9,
        lancamentoFinanceiro: {
          id: `lancamento-${indice + 1}`,
          valor,
          status: "PENDENTE",
          dataPagamento: null,
          temVinculoExtrato: false,
          temMovimentacaoBancaria: false,
        },
      }],
    })),
  };
}

describe("correção dos lançamentos de notas anteriores à composição de custos", () => {
  it("corrige a nota Troppo de R$ 742,00 para R$ 704,90 usando o desconto exato de cada item", () => {
    const resultado = planejarCorrecaoNotaLegada(notaTroppo());
    expect(resultado).toMatchObject({
      situacao: "CORRIGIR",
      plano: {
        valorAnterior: 742,
        valorCorrigido: 704.9,
        itens: [
          { valorAnterior: 583, valorCorrigido: 553.85, composicaoCusto: { desconto: 29.15, total: 553.85 } },
          { valorAnterior: 106, valorCorrigido: 100.7, composicaoCusto: { desconto: 5.3, total: 100.7 } },
          { valorAnterior: 53, valorCorrigido: 50.35, composicaoCusto: { desconto: 2.65, total: 50.35 } },
        ],
      },
    });
  });

  it.each([
    ["baixado", { status: "BAIXADO" }],
    ["vinculado ao extrato", { temVinculoExtrato: true }],
    ["com movimentação bancária", { temMovimentacaoBancaria: true }],
    ["com valor financeiro editado", { valor: 582 }],
  ])("bloqueia item %s sem alterar parcialmente a nota", (_caso, alteracao) => {
    const nota = notaTroppo();
    Object.assign(nota.itens[0].lancamentos[0].lancamentoFinanceiro, alteracao);
    expect(planejarCorrecaoNotaLegada(nota)).toMatchObject({ situacao: "BLOQUEADA" });
  });

  it("bloqueia nota parcial ou com valor do item editado manualmente", () => {
    const parcial = notaTroppo();
    parcial.itens[0].status = "IGNORADO";
    expect(planejarCorrecaoNotaLegada(parcial)).toMatchObject({ situacao: "BLOQUEADA" });

    const editada = notaTroppo();
    editada.itens[0].valorTotalConciliado = 580;
    expect(planejarCorrecaoNotaLegada(editada)).toMatchObject({ situacao: "BLOQUEADA" });
  });

  it("preserva as parcelas e fecha os centavos pela proporção das duplicatas", () => {
    const nota = notaTroppo();
    const primeiro = nota.itens[0];
    primeiro.lancamentos = [
      { ...primeiro.lancamentos[0], id: "v1", valor: 194.33, valorDuplicata: 234.96, lancamentoFinanceiro: { ...primeiro.lancamentos[0].lancamentoFinanceiro, id: "l1", valor: 194.33 } },
      { ...primeiro.lancamentos[0], id: "v2", valor: 388.67, valorDuplicata: 469.94, lancamentoFinanceiro: { ...primeiro.lancamentos[0].lancamentoFinanceiro, id: "l2", valor: 388.67 } },
    ];
    const resultado = planejarCorrecaoNotaLegada(nota);
    expect(resultado).toMatchObject({ situacao: "CORRIGIR" });
    if (resultado.situacao !== "CORRIGIR") return;
    const parcelas = resultado.plano.itens[0].lancamentos.map(lancamento => lancamento.valorCorrigido);
    expect(parcelas).toEqual([184.61, 369.24]);
    expect(parcelas.reduce((soma, valor) => soma + valor, 0)).toBeCloseTo(553.85, 2);
  });
});
