import type { UnidadeMedida } from "@/generated/prisma/browser";
import { descreverConversao, formatarQuantidadeConversao, type ConversaoInsumo } from "@/lib/insumos/conversoes";
import { unidadeMedidaAbreviada } from "@/lib/labels";

export function ReferenciasConversao({ conversoes = [], unidade, quantidade }: {
  conversoes?: ConversaoInsumo[];
  unidade: UnidadeMedida;
  quantidade?: string;
}) {
  const valor = quantidade?.trim() ? Number(quantidade.replace(",", ".")) : NaN;
  if (conversoes.length === 0) return null;
  return <div className="mt-2 space-y-1 text-xs font-normal text-muted-foreground whitespace-normal">
    {conversoes.map((conversao) => <p key={conversao.unidade}>{quantidade === undefined
      ? descreverConversao(conversao, unidade)
      : Number.isFinite(valor) && valor >= 0 ? `Equivale a ${formatarQuantidadeConversao(valor / conversao.fator)} ${unidadeMedidaAbreviada[conversao.unidade]}` : null}</p>)}
  </div>;
}
