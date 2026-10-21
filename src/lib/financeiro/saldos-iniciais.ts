export type SaldoInicialConta = {
  id: string;
  saldoInicial: number;
  dataSaldoInicial: string | null;
};

export type MovimentoParaSaldo = {
  contaBancariaId?: string | null;
  data: string;
  valor: number; // Entrada positiva; saída negativa.
};

// Reconstrói o saldo na data de abertura sem apagar o histórico ou criar receitas.
// Sem data, preserva a base antiga. Valores internos sempre em centavos.
export function calcularBasesSaldo(contas: SaldoInicialConta[], movimentos: MovimentoParaSaldo[]) {
  let semData = 0;
  const porData: Record<string, number> = {};
  for (const conta of contas) {
    const inicial = Math.round(conta.saldoInicial * 100);
    if (!conta.dataSaldoInicial) { semData += inicial; continue; }
    const data = conta.dataSaldoInicial.slice(0, 10);
    const anteriores = movimentos.reduce((soma, movimento) =>
      movimento.contaBancariaId === conta.id && movimento.data.slice(0, 10) < data
        ? soma + Math.round(movimento.valor * 100) : soma, 0);
    porData[data] = (porData[data] ?? 0) + inicial - anteriores;
  }
  return { semData, porData };
}

export function calcularSaldoContasAte(contas: SaldoInicialConta[], movimentos: MovimentoParaSaldo[], data: string): number {
  const bases = calcularBasesSaldo(contas, movimentos);
  const base = Object.entries(bases.porData).reduce((soma, [dia, valor]) => dia <= data ? soma + valor : soma, bases.semData);
  return movimentos.reduce((soma, movimento) => movimento.data.slice(0, 10) <= data ? soma + Math.round(movimento.valor * 100) : soma, base) / 100;
}
