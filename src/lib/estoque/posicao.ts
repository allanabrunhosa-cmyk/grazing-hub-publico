import { prisma } from "@/lib/prisma";
import type { TipoMovimentacaoEstoque } from "@/generated/prisma/client";
import { DecimalEstoque } from "./quantidade";

const TIPOS_ENTRADA: TipoMovimentacaoEstoque[] = ["ENTRADA_COMPRA", "AJUSTE_ENTRADA"];

// Chave "insumoId:localId" -> saldo naquela data.
export type MapaPosicao = Map<string, number>;

export function chavePosicao(insumoId: string, localId: string) {
  return `${insumoId}:${localId}`;
}

// Reconstrói o saldo de cada insumo (por local) somando/subtraindo todas as movimentações
// até a data-limite informada — não existe tabela de snapshot, então isso é recalculado
// a cada consulta. Na escala de um restaurante (dezenas a poucas centenas de insumos) uma
// agregação por request é rápida o suficiente; revisitar só se o volume crescer muito.
export async function calcularPosicaoHistorica(dataLimite: Date, localId?: string): Promise<MapaPosicao> {
  const agrupado = await prisma.movimentacaoEstoque.groupBy({
    by: ["insumoId", "localId", "tipo"],
    where: { createdAt: { lte: dataLimite }, ...(localId ? { localId } : {}) },
    _sum: { quantidade: true },
  });

  const saldoPorChave = new Map<string, InstanceType<typeof DecimalEstoque>>();
  for (const linha of agrupado) {
    const chave = chavePosicao(linha.insumoId, linha.localId);
    const sinal = TIPOS_ENTRADA.includes(linha.tipo) ? 1 : -1;
    const atual = saldoPorChave.get(chave) ?? new DecimalEstoque(0);
    saldoPorChave.set(chave, atual.plus(new DecimalEstoque(linha._sum.quantidade ?? 0).times(sinal)));
  }
  return new Map([...saldoPorChave].map(([chave, saldo]) => [chave, saldo.toNumber()]));
}

// Fim do dia escolhido, pra incluir movimentações feitas no próprio dia (mesmo padrão de
// filtro de data usado em notas-fiscais-table.tsx).
export function fimDoDia(dataISO: string): Date {
  return new Date(`${dataISO}T23:59:59.999`);
}
