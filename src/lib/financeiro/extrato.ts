import type { LancamentoRow, MovimentacaoBancariaRow } from "@/app/(protegido)/financeiro/types";
import { periodoDoMes } from "@/lib/financeiro/periodos";
import { calcularBasesSaldo, type SaldoInicialConta } from "@/lib/financeiro/saldos-iniciais";

export type FiltroMovimentacoes = "PENDENTE" | "BAIXADO" | "TUDO";
export type LinhaExtrato = {
  id: string;
  data: string;
  descricao: string;
  valor: number; // Com sinal: entrada positiva, saída negativa.
  status: "PENDENTE" | "BAIXADO";
  categoria: string;
  contraparte: string | null;
  conta: string | null;
  contaBancariaId?: string | null;
  lancamento: LancamentoRow | null;
};

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const mes = periodoDoMes(data.slice(0, 7));
  return !!mes && data >= mes.de && data <= mes.ate;
}

export function montarLinhasExtrato(lancamentos: LancamentoRow[], avulsas: MovimentacaoBancariaRow[]): LinhaExtrato[] {
  return [
    // O título quitado pela carteira representa receita por competência, sem
    // dinheiro novo. Conserva-se na origem/DRE, fora do caixa e da conciliação.
    ...lancamentos.filter((l) => l.status !== "CANCELADO" && !l.pedidoQuitadoCredito).map((l): LinhaExtrato => ({
      id: l.id,
      data: ((l.status === "BAIXADO" ? l.dataPagamento : null) ?? l.dataVencimento).slice(0, 10),
      descricao: l.descricao,
      valor: l.tipo === "DESPESA" ? -l.valor : l.valor,
      status: l.status === "BAIXADO" ? "BAIXADO" : "PENDENTE",
      categoria: l.categoriaNome,
      contraparte: l.fornecedorNome ?? l.contraparteNome,
      conta: l.contaBancariaNome,
      contaBancariaId: l.contaBancariaId,
      lancamento: l,
    })),
    // Apenas registros sem lançamento associado: a baixa já está representada acima.
    ...avulsas.map((m): LinhaExtrato => ({
      id: `bancaria-${m.id}`, data: m.data.slice(0, 10), descricao: m.descricao,
      valor: m.tipo === "SAIDA" ? -m.valor : m.valor,
      status: "BAIXADO", categoria: m.tipo === "AJUSTE" ? "Ajuste bancário" : "Movimentação bancária",
      contraparte: null, conta: m.contaBancariaNome, contaBancariaId: m.contaBancariaId, lancamento: null,
    })),
  ].sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}

export function calcularExtrato(linhas: LinhaExtrato[], saldoInicial: number, periodo: { de: string; ate: string }, filtro: FiltroMovimentacoes, saldosIniciais?: SaldoInicialConta[]) {
  const selecionadas = linhas.filter((l) => filtro === "TUDO" || l.status === filtro);
  const centavos = (valor: number) => Math.round(valor * 100);
  const bases = saldosIniciais ? calcularBasesSaldo(saldosIniciais, selecionadas) : { semData: centavos(saldoInicial), porData: {} as Record<string, number> };
  let saldo = bases.semData;
  for (const [data, valor] of Object.entries(bases.porData)) if (data < periodo.de) saldo += valor;
  for (const linha of selecionadas) if (linha.data < periodo.de) saldo += centavos(linha.valor);
  const saldoAnterior = saldo / 100;
  let entradas = 0;
  let saidas = 0;
  const dias: { data: string; linhas: LinhaExtrato[]; saldo: number; temSaldoInicial: boolean }[] = [];
  const porDia = new Map<string, LinhaExtrato[]>();
  for (const linha of selecionadas) {
    if (linha.data < periodo.de || linha.data > periodo.ate) continue;
    const grupo = porDia.get(linha.data) ?? [];
    grupo.push(linha);
    porDia.set(linha.data, grupo);
  }
  // UTC mantém todos os dias do calendário, inclusive nas mudanças de horário de verão.
  const inicio = dataValida(periodo.de) ? Date.parse(`${periodo.de}T00:00:00Z`) : NaN;
  const fim = dataValida(periodo.ate) ? Date.parse(`${periodo.ate}T00:00:00Z`) : NaN;
  // Histórico extenso mantém todas as operações e saldos, sem milhares de linhas vazias.
  const periodoResumido = Number.isFinite(inicio) && Number.isFinite(fim) && (fim - inicio) / 86_400_000 + 1 > 366;
  const datas = periodoResumido
    ? [...new Set([periodo.de, periodo.ate, ...porDia.keys(), ...Object.keys(bases.porData)])].filter(data => data >= periodo.de && data <= periodo.ate && dataValida(data)).sort()
    : [];
  if (!periodoResumido) for (let instante = inicio; instante <= fim; instante += 86_400_000) datas.push(new Date(instante).toISOString().slice(0, 10));
  for (const data of datas) {
    saldo += bases.porData[data] ?? 0;
    const linhasDoDia = (porDia.get(data) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    for (const linha of linhasDoDia) {
      const valor = centavos(linha.valor);
      saldo += valor;
      if (valor >= 0) entradas += valor; else saidas -= valor;
    }
    dias.push({ data, linhas: linhasDoDia, saldo: saldo / 100, temSaldoInicial: Object.hasOwn(bases.porData, data) });
  }
  return { dias, periodoResumido, saldoAnterior, saldoFinal: saldo / 100, entradas: entradas / 100, saidas: saidas / 100 };
}
