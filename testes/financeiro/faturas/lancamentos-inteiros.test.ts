import { describe, expect, it } from "vitest";
import {
  agruparLancamentosInteirosFatura,
  validarSelecaoIntegralDeNotasFatura,
  type CandidatoFaturaBase,
} from "@/lib/financeiro/faturas/lancamentos-inteiros";
import { ErroFatura } from "@/lib/financeiro/faturas/erros";

function titulo(id: string, extra: Partial<CandidatoFaturaBase> = {}): CandidatoFaturaBase {
  return { id, descricao: "Despesa inteira", valor: 10000, data: "2026-11-09", vencimento: "2026-11-17", cartaoId: "cartao",
    cartaoNome: "Cartão de teste", podeCorrigirCartao: true, fornecedorId: "fornecedor", versao: `versao-${id}`, notaGrupo: null, ...extra };
}
function componente(id: string, valor: number, extra: Partial<CandidatoFaturaBase> = {}): CandidatoFaturaBase {
  return titulo(id, { descricao: `Produto ${id}`, valor, podeCorrigirCartao: false, notaGrupo: "duplicata-1",
    parcelaNota: { id: "duplicata-1", numero: "001", valor: 10000, chaveAcesso: "1".repeat(44), fornecedorNome: "Fornecedor fictício" }, ...extra });
}

describe("lançamentos inteiros como candidatos da fatura", () => {
  it("oferece uma parcela inteira de NF-e no lugar de seus produtos e preserva IDs e versões", () => {
    const resultado = agruparLancamentosInteirosFatura([componente("b", 6000), componente("a", 4000)]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ id: "a", valor: 10000, componentes: 2, podeCorrigirCartao: false,
      lancamentos: [{ id: "a", versao: "versao-a" }, { id: "b", versao: "versao-b" }] });
    expect(resultado[0].descricao).toBe(`NF-e ${"1".repeat(44)} · Parcela 001 · Fornecedor fictício`);
    expect(resultado[0].descricao).not.toContain("Produto");
  });

  it("mantém duplicatas distintas da mesma nota separadas, inclusive com vencimento igual", () => {
    const primeira = componente("a", 10000);
    const segunda = componente("b", 10000, { notaGrupo: "duplicata-2", parcelaNota: { ...primeira.parcelaNota!, id: "duplicata-2", numero: "002" } });
    expect(agruparLancamentosInteirosFatura([segunda, primeira]).map(l => ({ id: l.id, valor: l.valor })))
      .toEqual([{ id: "a", valor: 10000 }, { id: "b", valor: 10000 }]);
  });

  it("não oferece subtotal quando parte dos componentes não está disponível", () => {
    expect(agruparLancamentosInteirosFatura([componente("a", 4000)])).toEqual([]);
  });

  it("não expõe componente de NF-e sem os metadados integrais da parcela", () => {
    expect(agruparLancamentosInteirosFatura([componente("a", 10000, { parcelaNota: undefined })])).toEqual([]);
  });

  it("uma busca pelo documento encontra o total inteiro e nunca o valor de um produto", () => {
    const lista = agruparLancamentosInteirosFatura([componente("manjericao", 4000), componente("tomate", 6000)]);
    expect(lista.filter(l => l.descricao.includes("Fornecedor fictício"))).toMatchObject([{ valor: 10000, componentes: 2 }]);
    expect(lista.some(l => l.descricao.includes("manjericao"))).toBe(false);
    expect(lista.some(l => l.valor === 4000 || l.valor === 6000)).toBe(false);
  });

  it.each(["NFS-e", "Entrada avulsa"])("preserva parcelas inteiras de %s mesmo com mesma origem, nome, valor e vencimento", origem => {
    const primeira = { ...titulo("a", { descricao: origem }), origemDocumentoId: "mesma-origem", recorrenciaGrupoId: "mesma-recorrencia" };
    const segunda = { ...primeira, id: "b", versao: "versao-b" };
    expect(agruparLancamentosInteirosFatura([segunda, primeira])).toMatchObject([
      { id: "a", descricao: origem, valor: 10000, componentes: 1, lancamentos: [{ id: "a", versao: "versao-a" }] },
      { id: "b", descricao: origem, valor: 10000, componentes: 1, lancamentos: [{ id: "b", versao: "versao-b" }] },
    ]);
  });

  it("não mistura despesas independentes com descrições iguais", () => {
    expect(agruparLancamentosInteirosFatura([titulo("a", { valor: 4000 }), titulo("b", { valor: 6000 })])).toHaveLength(2);
  });

  it("ordena pelo vencimento e pelo ID sem depender da ordem recebida", () => {
    expect(agruparLancamentosInteirosFatura([titulo("z"), titulo("b", { vencimento: "2026-11-15" }), titulo("a")]).map(l => l.id))
      .toEqual(["b", "a", "z"]);
  });

  it("preserva o sinal de crédito de uma parcela integral", () => {
    expect(agruparLancamentosInteirosFatura([componente("a", -4000), componente("b", -6000)]))
      .toMatchObject([{ valor: -10000, componentes: 2 }]);
  });

  it.each([
    ["sinal", { valor: -6000 }],
    ["vencimento", { vencimento: "2026-12-17" }],
    ["competência", { data: "2026-11-10" }],
    ["cartão", { cartaoId: "outro-cartao" }],
    ["fornecedor", { fornecedorId: "outro-fornecedor" }],
    ["parcela", { parcelaNota: { id: "duplicata-1", numero: "002", valor: 10000, chaveAcesso: "1".repeat(44), fornecedorNome: "Fornecedor fictício" } }],
  ] satisfies [string, Partial<CandidatoFaturaBase>][])("omite parcela com %s incoerente entre componentes", (_, alteracao) => {
    expect(agruparLancamentosInteirosFatura([componente("a", 4000), componente("b", 6000, alteracao)])).toEqual([]);
  });

  it("300 produtos de uma nota continuam sendo uma única opção inteira", () => {
    const lista = Array.from({ length: 300 }, (_, i) => componente(`produto-${String(i).padStart(3, "0")}`, 1,
      { parcelaNota: { id: "duplicata-1", numero: "001", valor: 300, chaveAcesso: "1".repeat(44), fornecedorNome: null } }));
    expect(agruparLancamentosInteirosFatura(lista)).toMatchObject([{ valor: 300, componentes: 300 }]);
    expect(agruparLancamentosInteirosFatura(lista)[0].lancamentos).toHaveLength(300);
  });
});

describe("guarda da seleção integral de notas na fatura", () => {
  const ativos = [{ id: "a", notaGrupo: "duplicata", valor: 4000 }, { id: "b", notaGrupo: "duplicata", valor: 6000 }];
  const inteiros = ativos.map(l => ({ ...l, valorParcela: 10000 }));

  it("aceita todos os componentes que fecham o valor da parcela", () => {
    expect(() => validarSelecaoIntegralDeNotasFatura(inteiros, ativos)).not.toThrow();
  });

  it("recusa seleção parcial mesmo que o componente coincida com o valor do item da fatura", () => {
    expect(() => validarSelecaoIntegralDeNotasFatura([inteiros[0]], ativos)).toThrow(ErroFatura);
    expect(() => validarSelecaoIntegralDeNotasFatura([inteiros[0]], ativos)).toThrow("lançamento inteiro");
  });

  it("recusa soma dos componentes diferente do valor da parcela", () => {
    expect(() => validarSelecaoIntegralDeNotasFatura(inteiros.map(l => ({ ...l, valorParcela: 9999 })), ativos)).toThrow("não fecha");
  });

  it("recusa valores selecionados que não fecham a parcela relida", () => {
    expect(() => validarSelecaoIntegralDeNotasFatura([{ ...inteiros[0], valor: 3999 }, inteiros[1]], ativos)).toThrow("não fecha");
  });

  it("recusa valor da parcela ausente ou incoerente entre os títulos", () => {
    expect(() => validarSelecaoIntegralDeNotasFatura(ativos, ativos)).toThrow("não fecha");
    expect(() => validarSelecaoIntegralDeNotasFatura([inteiros[0], { ...inteiros[1], valorParcela: 9000 }], ativos)).toThrow("não fecha");
  });

  it("recusa títulos duplicados ou alheios à composição relida", () => {
    expect(() => validarSelecaoIntegralDeNotasFatura([inteiros[0], inteiros[0]], ativos)).toThrow(ErroFatura);
    expect(() => validarSelecaoIntegralDeNotasFatura([{ ...inteiros[0], id: "outro" }, inteiros[1]], ativos)).toThrow("lançamento inteiro");
  });

  it("não exige a seleção de outra duplicata que não foi escolhida", () => {
    expect(() => validarSelecaoIntegralDeNotasFatura(inteiros, [...ativos, { id: "c", notaGrupo: "outra-parcela", valor: 10000 }])).not.toThrow();
  });

  it("preserva parcelas autônomas de NFS-e e entrada avulsa sem exigir o resto da origem", () => {
    expect(() => validarSelecaoIntegralDeNotasFatura([{ id: "parcela-nfse", notaGrupo: null, valor: 10000 }, { id: "parcela-avulsa", notaGrupo: null, valor: 5000 }], [])).not.toThrow();
  });

  it("aplica o limite a 200 lançamentos inteiros, não aos produtos", () => {
    const selecionados = Array.from({ length: 200 }, (_, i) => ({ id: `titulo-${i}`, notaGrupo: null, valor: 1 }));
    expect(() => validarSelecaoIntegralDeNotasFatura(selecionados, [])).not.toThrow();
    expect(() => validarSelecaoIntegralDeNotasFatura([...selecionados, { id: "titulo-extra", notaGrupo: null, valor: 1 }], [])).toThrow("200 lançamentos inteiros");
  });

  it("aceita 300 componentes de uma única NF-e", () => {
    const componentes = Array.from({ length: 300 }, (_, i) => ({ id: `produto-${i}`, notaGrupo: "duplicata", valor: 1 }));
    expect(() => validarSelecaoIntegralDeNotasFatura(componentes.map(l => ({ ...l, valorParcela: 300 })), componentes)).not.toThrow();
  });
});
