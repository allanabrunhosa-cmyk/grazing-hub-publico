export type ModoDescontoNota = "NOTA" | "PROPORCIONAL" | "PERSONALIZADO";
export type DetalhamentoTributos = {
  icmsIncluso: number; fcpIncluso: number; pisIncluso: number; cofinsIncluso: number;
  icmsSt: number; icmsMonofasicoRetido: number; fcpSt: number; impostoImportacao: number;
  pisSt: number; cofinsSt: number; ipiDevolvido: number;
};
export type CustoItemNota = {
  numeroItem: number; produtos: number; frete: number; ipi: number; seguro: number;
  outrasDespesas: number; outrosTributos: number; abatimentos: number; desconto: number;
  tributos: DetalhamentoTributos;
};
export type CustosNotaFiscal = {
  itens: CustoItemNota[]; produtos: number; frete: number; ipi: number; seguro: number;
  outrasDespesas: number; outrosTributos: number; abatimentos: number; desconto: number; totalNota: number;
  tributos: DetalhamentoTributos;
};
export type ComposicaoCusto = CustoItemNota & { modoDesconto: ModoDescontoNota; total: number };
export type DistribuicaoDesconto = { modo: ModoDescontoNota; itens: { numeroItem: number; desconto: number }[] };

export const centavos = (valor: number) => Math.round(valor * 100);
export function totalCustoItem(item: CustoItemNota, desconto = item.desconto) {
  return (centavos(item.produtos) + centavos(item.frete) + centavos(item.ipi) + centavos(item.seguro)
    + centavos(item.outrasDespesas) + centavos(item.outrosTributos) - centavos(item.abatimentos) - centavos(desconto)) / 100;
}

// Maiores restos: distribui cada centavo uma única vez, com desempate pela ordem da nota.
export function ratearDesconto(total: number, itens: CustoItemNota[]): number[] {
  return ratearValor(total, itens.map(item => item.produtos));
}

export function ratearValor(total: number, valores: number[]): number[] {
  const pesos = valores.map(centavos);
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (soma <= 0) return valores.map(() => 0);
  const quantia = BigInt(centavos(total));
  const divisor = BigInt(soma);
  const partes = pesos.map((peso, indice) => ({ indice, valor: Number(quantia * BigInt(peso) / divisor), resto: quantia * BigInt(peso) % divisor }));
  const faltantes = Number(quantia) - partes.reduce((a, b) => a + b.valor, 0);
  const ordem = [...partes].sort((a, b) => a.resto === b.resto ? a.indice - b.indice : a.resto > b.resto ? -1 : 1);
  for (let i = 0; i < faltantes; i++) ordem[i].valor++;
  return partes.map(parte => parte.valor / 100);
}

// Fecha tanto o total de cada item quanto a soma de cada parcela. Os centavos
// consumidos por um item deixam de estar disponíveis para os seguintes.
// No aceite parcial, os títulos anteriores são fixos; somente os novos valores
// ocupam o saldo proporcional das parcelas. Rateios legados nunca são regravados.
export function ratearItensPorDuplicatas(valoresItens: number[], valoresDuplicatas: number[], valoresAnteriores: number[] = []): number[][] {
  const valores = [...valoresItens, ...valoresDuplicatas, ...valoresAnteriores];
  if (valores.some(valor => !Number.isFinite(valor) || valor < 0 || !Number.isSafeInteger(centavos(valor)))) throw new Error("Informe valores monetários válidos para o rateio.");
  const totalNovos = valoresItens.reduce((soma, valor) => soma + centavos(valor), 0);
  const anteriores = valoresDuplicatas.map((_, indice) => centavos(valoresAnteriores[indice] ?? 0));
  const total = totalNovos + anteriores.reduce((soma, valor) => soma + valor, 0);
  if (!Number.isSafeInteger(total)) throw new Error("O total ultrapassa o limite do rateio.");
  const alvos = ratearValor(total / 100, valoresDuplicatas);
  // Um rateio legado pode ter excedido um alvo em um centavo. Preservamos esse
  // histórico e distribuímos o novo valor apenas entre os saldos não negativos.
  const pesosRestantes = alvos.map((valor, indice) => Math.max(0, centavos(valor) - anteriores[indice]) / 100);
  const saldos = ratearValor(totalNovos / 100, pesosRestantes).map(centavos);
  if (totalNovos > 0 && saldos.reduce((soma, valor) => soma + valor, 0) !== totalNovos) throw new Error("Informe parcelas válidas para o rateio.");
  return valoresItens.map(valor => {
    const partes = ratearValor(valor, saldos.map(saldo => saldo / 100));
    partes.forEach((parte, indice) => { saldos[indice] -= centavos(parte); });
    return partes;
  });
}

export function calcularCustosNota(custos: CustosNotaFiscal, distribuicao: DistribuicaoDesconto | null): { erro: string } | { itens: ComposicaoCusto[]; total: number } {
  if (!distribuicao || !["NOTA", "PROPORCIONAL", "PERSONALIZADO"].includes(distribuicao.modo) || !Array.isArray(distribuicao.itens)) return { erro: "Escolha a distribuição do desconto." };
  const descontos = distribuicao.modo === "PROPORCIONAL" ? ratearDesconto(custos.desconto, custos.itens) : custos.itens.map(item => item.desconto);
  if (distribuicao.modo === "PERSONALIZADO") {
    if (distribuicao.itens.length !== custos.itens.length || new Set(distribuicao.itens.map(item => item.numeroItem)).size !== custos.itens.length) return { erro: "Informe o desconto de cada produto uma única vez." };
    for (const [indice, item] of custos.itens.entries()) {
      const valor = distribuicao.itens.find(d => d.numeroItem === item.numeroItem)?.desconto;
      if (valor == null || !Number.isFinite(valor) || valor < 0 || Math.abs(valor * 100 - centavos(valor)) > 0.00001) return { erro: "Informe descontos válidos, com duas casas decimais." };
      descontos[indice] = valor;
    }
  }
  if (descontos.reduce((soma, valor) => soma + centavos(valor), 0) !== centavos(custos.desconto)) return { erro: "A soma dos descontos dos produtos deve ser igual ao desconto total da nota." };
  const itens = custos.itens.map((item, indice) => ({ ...item, desconto: descontos[indice], modoDesconto: distribuicao.modo, total: totalCustoItem(item, descontos[indice]) }));
  if (itens.some(item => item.total < 0)) return { erro: "O desconto não pode deixar o custo de um produto negativo." };
  return { itens, total: itens.reduce((soma, item) => soma + centavos(item.total), 0) / 100 };
}

export function lerComposicaoCusto(valor: unknown): ComposicaoCusto | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const registro = valor as Record<string, unknown>;
  if (!["NOTA", "PROPORCIONAL", "PERSONALIZADO"].includes(String(registro.modoDesconto))
    || !["numeroItem", "produtos", "frete", "ipi", "seguro", "outrasDespesas", "outrosTributos", "abatimentos", "desconto", "total"].every(campo => typeof registro[campo] === "number" && Number.isFinite(registro[campo]))
  ) return null;
  const tributosSalvos = registro.tributos && typeof registro.tributos === "object" && !Array.isArray(registro.tributos)
    ? registro.tributos as Record<string, unknown> : {};
  const numeroOuZero = (campo: keyof DetalhamentoTributos) => typeof tributosSalvos[campo] === "number" && Number.isFinite(tributosSalvos[campo]) ? tributosSalvos[campo] : 0;
  return {
    ...(valor as Omit<ComposicaoCusto, "tributos">),
    tributos: {
      icmsIncluso: numeroOuZero("icmsIncluso"), fcpIncluso: numeroOuZero("fcpIncluso"),
      pisIncluso: numeroOuZero("pisIncluso"), cofinsIncluso: numeroOuZero("cofinsIncluso"),
      icmsSt: numeroOuZero("icmsSt"), icmsMonofasicoRetido: numeroOuZero("icmsMonofasicoRetido"),
      fcpSt: numeroOuZero("fcpSt"), impostoImportacao: numeroOuZero("impostoImportacao"),
      pisSt: numeroOuZero("pisSt"), cofinsSt: numeroOuZero("cofinsSt"), ipiDevolvido: numeroOuZero("ipiDevolvido"),
    },
  };
}
