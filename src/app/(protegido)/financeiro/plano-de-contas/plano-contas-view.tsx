"use client";

import { useState } from "react";
import { ORDEM_GRUPOS_DRE } from "@/lib/labels";
import { estilosNaturezaFinanceira } from "@/lib/financeiro/natureza-financeira";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { GrupoCard } from "./grupo-card";
import type { CategoriaFinanceiraRow } from "../types";

export type FiltroStatusCategoria = "TODAS" | "ATIVAS" | "INATIVAS" | "EXCLUIDAS";

export function PlanoContasView({ categorias, centrosCusto }: {
  categorias: CategoriaFinanceiraRow[];
  centrosCusto: { id: string; nome: string }[];
}) {
  const [filtroStatus, definirFiltroStatus] = useState<FiltroStatusCategoria>("ATIVAS");
  const totais = {
    TODAS: categorias.length,
    ATIVAS: categorias.filter((categoria) => categoria.ativo && !categoria.excluidoEm).length,
    INATIVAS: categorias.filter((categoria) => !categoria.ativo && !categoria.excluidoEm).length,
    EXCLUIDAS: categorias.filter((categoria) => !!categoria.excluidoEm).length,
  };
  return <div className="mx-auto w-full max-w-5xl space-y-6">
    <BarraAcoes titulo="Plano de Contas" descricao="Categorias organizadas na mesma sequência da DRE." />
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm">
      <p className="text-muted-foreground">Abra um grupo para consultar e organizar suas categorias.</p>
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtrar categorias por status">
        {([
          ["TODAS", "Todas"],
          ["ATIVAS", "Ativas"],
          ["INATIVAS", "Inativas"],
          ["EXCLUIDAS", "Excluídas"],
        ] as const).map(([valor, rotulo]) => <Button key={valor} type="button" size="sm"
          variant={filtroStatus === valor ? "default" : "outline"}
          aria-pressed={filtroStatus === valor}
          onClick={() => definirFiltroStatus(valor)}>
          {rotulo} ({totais[valor]})
        </Button>)}
      </div>
    </div>
    <div aria-label="Legenda das categorias financeiras" className="flex flex-wrap gap-2 text-xs font-semibold">
      <span className={`rounded-full px-2.5 py-1 ${estilosNaturezaFinanceira.ENTRADA.indicador}`}>Entrada · Receita</span>
      <span className={`rounded-full px-2.5 py-1 ${estilosNaturezaFinanceira.SAIDA.indicador}`}>Saída · Despesa</span>
    </div>
    <div className="space-y-3">
      {ORDEM_GRUPOS_DRE.map((grupo, indice) => <GrupoCard key={grupo} grupo={grupo} ordem={indice + 1}
        categorias={categorias.filter((categoria) => categoria.grupo === grupo)}
        todasCategorias={categorias}
        centrosCusto={centrosCusto} abertoInicial={indice === 0} filtroStatus={filtroStatus} />)}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">Hierarquia: categoria › subcategoria › subdivisão. Use + para adicionar; no lápis, edite o nome, o grupo ou a categoria superior; use a chave para ativar ou inativar e a lixeira para excluir.</p>
  </div>;
}
