"use client";
import { useState } from "react";
import type { ComponenteRow } from "../../insumos/types";
import { ComposicaoPicker } from "../../insumos/composicao-picker";
import type { ProdutoEntrada } from "@/lib/vendas/dominio";
import type { DadosProdutos } from "@/lib/vendas/consultas";
import type { UnidadeMedida } from "@/generated/prisma/client";
import { CASAS_DECIMAIS_PORCAO } from "@/lib/insumos/porcoes";
export function ComposicaoProduto({ componentes, insumos, mudar, podeCadastrarInsumo, configurarFicha = true }: {
  componentes: ProdutoEntrada["componentes"]; insumos: DadosProdutos["insumos"];
  mudar: (componentes: ProdutoEntrada["componentes"]) => void; podeCadastrarInsumo: boolean; configurarFicha?: boolean;
}) {
  const [recentes, setRecentes] = useState<ComponenteRow[]>([]);
  return <div className="@container"><ComposicaoPicker ordenar configurarFicha={configurarFicha} podeCadastrarInsumo={podeCadastrarInsumo}
    candidatos={insumos.filter(i => i.ativo).map(i => ({ ...i, tipo: i.tipo ?? "INSUMO", custoMedio: i.custo ?? undefined, custoUnitario: i.custo }))}
    itens={componentes.map(c => { const i = insumos.find(i => i.id === c.insumoId); const recente = recentes.find(i => i.componenteId === c.insumoId); return { componenteId: c.insumoId, nome: i?.nome ?? recente?.nome ?? "Ingrediente indisponível", especificacao: i?.especificacao ?? recente?.especificacao, tipo: i?.tipo ?? recente?.tipo ?? "INSUMO", unidade: c.unidade as UnidadeMedida, quantidade: Number(c.quantidade), custoUnitario: i?.custo ?? recente?.custoUnitario, observacaoPorcao: c.observacaoPorcao ?? null, porcao: c.porcao, exibirFicha: c.exibirFicha !== false }; })}
    onChange={itens => { setRecentes(itens); mudar(itens.map(i => {
      const anterior = componentes.find(c => c.insumoId === i.componenteId);
      return { insumoId: i.componenteId, unidade: i.unidade, quantidade: i.quantidadePorcao ?? (anterior && Number(anterior.quantidade) === i.quantidade ? anterior.quantidade : i.quantidade.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: CASAS_DECIMAIS_PORCAO })), observacaoPorcao: i.observacaoPorcao, porcao: i.porcao, exibirFicha: i.exibirFicha !== false };
    })); }}
  /></div>;
}
