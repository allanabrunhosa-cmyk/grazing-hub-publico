import type { TipoMovimentacaoEstoque } from "@/generated/prisma/client";
import { TIPOS_ENTRADA } from "@/lib/estoque/extrato";
import { DecimalEstoque } from "./quantidade";

type MovimentoBase = {
  id: string;
  createdAt: string;
  tipo: TipoMovimentacaoEstoque;
  quantidade: number;
};

// Recebe a posição na data de referência e percorre o extrato de trás para frente.
// Assim, o último item da apresentação cronológica sempre chega ao saldo mostrado no topo.
export function montarTrechoMovimentacoes<T extends MovimentoBase>(
  movimentos: T[],
  saldoReferencia: number,
  limite = 50
) {
  const ordenados = [...movimentos].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)
  );
  const selecionados = ordenados.slice(0, limite);
  let saldo = new DecimalEstoque(saldoReferencia);

  const comSaldoDecrescente = selecionados.map((movimento) => {
    const saldoDepois = saldo.toNumber();
    const delta = new DecimalEstoque(movimento.quantidade).times(TIPOS_ENTRADA.includes(movimento.tipo) ? 1 : -1);
    saldo = saldo.minus(delta);
    return { ...movimento, saldo: saldoDepois };
  });

  return {
    movimentos: comSaldoDecrescente.reverse(),
    saldoAnteriorAoTrecho: saldo.toNumber(),
    temMais: ordenados.length > limite,
  };
}
