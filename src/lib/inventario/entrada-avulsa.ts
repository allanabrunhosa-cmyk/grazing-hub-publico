import { centavos, ratearValor } from "@/lib/notas-fiscais/custos";
import { DecimalEstoque } from "@/lib/estoque/quantidade";

export type CustoAdicionalEntrada = {
  descricao: string;
  valor: number;
};

export type ItemCompraSemNota = {
  insumoId: string;
  localId: string;
  /** Quantidade comprada na unidade comercial informada pelo usuário. */
  quantidade: number;
  /** Quantas unidades de estoque correspondem a uma unidade comprada. */
  fatorConversao?: number;
  unidadeEntrada?: string;
  valorProdutos: number;
};

export type CompraSemNotaInput = {
  itens: ItemCompraSemNota[];
  frete: number;
  desconto: number;
  custosAdicionais: CustoAdicionalEntrada[];
};

export type ComposicaoCompraSemNota = {
  valorProdutos: number;
  frete: number;
  desconto: number;
  outrosCustos: number;
  valorTotal: number;
  itens: Array<ItemCompraSemNota & {
    freteRateado: number;
    descontoRateado: number;
    outrosCustosRateados: number;
    valorFinal: number;
    quantidadeEstoque: number;
    custoUnitario: number;
  }>;
};

function moedaValida(valor: number) {
  return Number.isFinite(valor) && valor >= 0 && Math.abs(valor * 100 - centavos(valor)) < 0.00001;
}

export function calcularCompraSemNota(input: CompraSemNotaInput): { erro: string } | { composicao: ComposicaoCompraSemNota } {
  if (!input || !Array.isArray(input.itens) || input.itens.length === 0) return { erro: "Adicione ao menos um item à compra." };
  if (input.itens.length > 100) return { erro: "Uma compra pode ter no máximo 100 itens." };
  if (!moedaValida(input.frete) || !moedaValida(input.desconto)) return { erro: "Informe frete e desconto válidos, com duas casas decimais." };
  if (!Array.isArray(input.custosAdicionais) || input.custosAdicionais.length > 20) return { erro: "Informe no máximo 20 custos adicionais." };
  if (input.custosAdicionais.some(custo => !custo.descricao?.trim() || custo.descricao.trim().length > 120 || !moedaValida(custo.valor) || custo.valor <= 0)) {
    return { erro: "Preencha a descrição e o valor de cada custo adicional." };
  }
  if (input.itens.some(item => {
    const fator = item.fatorConversao ?? 1;
    const quantidadeEstoque = item.quantidade * fator;
    return !item.insumoId || !item.localId || !Number.isFinite(item.quantidade) || item.quantidade <= 0
      || !Number.isFinite(fator) || fator <= 0 || !Number.isFinite(quantidadeEstoque) || quantidadeEstoque <= 0
      || !moedaValida(item.valorProdutos) || item.valorProdutos <= 0;
  })) {
    return { erro: "Preencha insumo, local, quantidade e valor dos produtos em todos os itens." };
  }

  const valorProdutos = input.itens.reduce((soma, item) => soma + centavos(item.valorProdutos), 0) / 100;
  const outrosCustos = input.custosAdicionais.reduce((soma, custo) => soma + centavos(custo.valor), 0) / 100;
  const valorTotal = (centavos(valorProdutos) + centavos(input.frete) + centavos(outrosCustos) - centavos(input.desconto)) / 100;
  if (valorTotal <= 0) return { erro: "O valor total da compra deve ser maior que zero." };

  const pesos = input.itens.map(item => item.valorProdutos);
  const fretes = ratearValor(input.frete, pesos);
  const descontos = ratearValor(input.desconto, pesos);
  const adicionais = ratearValor(outrosCustos, pesos);
  const itens = input.itens.map((item, indice) => {
    const fatorConversao = item.fatorConversao ?? 1;
    const quantidadeEstoque = new DecimalEstoque(item.quantidade).times(fatorConversao).toNumber();
    const valorFinal = (
      centavos(item.valorProdutos)
      + centavos(fretes[indice])
      + centavos(adicionais[indice])
      - centavos(descontos[indice])
    ) / 100;
    return {
      ...item,
      fatorConversao,
      quantidadeEstoque,
      freteRateado: fretes[indice],
      descontoRateado: descontos[indice],
      outrosCustosRateados: adicionais[indice],
      valorFinal,
      custoUnitario: valorFinal / quantidadeEstoque,
    };
  });
  if (itens.some(item => item.valorFinal < 0)) return { erro: "O desconto não pode deixar o custo de um item negativo." };
  const totalRateado = itens.reduce((soma, item) => soma + centavos(item.valorFinal), 0) / 100;
  if (centavos(totalRateado) !== centavos(valorTotal)) return { erro: "Não foi possível fechar o rateio dos custos." };

  return {
    composicao: {
      valorProdutos,
      frete: input.frete,
      desconto: input.desconto,
      outrosCustos,
      valorTotal,
      itens,
    },
  };
}
