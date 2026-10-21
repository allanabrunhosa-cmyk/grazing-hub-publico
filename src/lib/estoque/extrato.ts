import type { TipoMovimentacaoEstoque } from "@/generated/prisma/client";
import { DecimalEstoque } from "./quantidade";

export const TIPOS_ENTRADA: TipoMovimentacaoEstoque[] = ["ENTRADA_COMPRA", "AJUSTE_ENTRADA"];
type Movimento = { id: string; insumoId: string; localId: string; createdAt: string; tipo: TipoMovimentacaoEstoque; quantidade: number };
type Saldo = { insumoId: string; localId: string; quantidadeAtual: number };
const chave = (item: { insumoId: string; localId: string }) => JSON.stringify([item.insumoId, item.localId]);

// Reconstrói o extrato pela data do movimento, a partir da posição atual de cada local.
// Executar sobre TODO o histórico, antes de filtrar/ordenar a apresentação.
// Aritmética decimal preserva também perdas menores que um milésimo.
export function calcularSaldosMovimentacoes<T extends Movimento>(movimentos: T[], saldos: Saldo[]): (T & { saldo: number | null })[] {
  const posicoes = new Map(saldos.map(s => [chave(s), new DecimalEstoque(s.quantidadeAtual)]));
  return [...movimentos].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).map(m => {
    const identificador = chave(m);
    const atual = posicoes.get(identificador);
    if (atual === undefined) return { ...m, saldo: null };
    const delta = new DecimalEstoque(m.quantidade).times(TIPOS_ENTRADA.includes(m.tipo) ? 1 : -1);
    posicoes.set(identificador, atual.minus(delta));
    return { ...m, saldo: atual.toNumber() };
  });
}

const formatoData = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
export const dataMovimentacao = (data: string) => formatoData.format(new Date(data));
export function movimentacaoNoPeriodo(data: string, de: string, ate: string) {
  const dia = dataMovimentacao(data);
  return (!de || dia >= de) && (!ate || dia <= ate);
}
