"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CategoriaBi } from "@/lib/vendas/bi-types";
import s from "./bi-vendas.module.css";

const moeda = (valor: number | null) => valor === null ? "Não apurado" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

export function RankingCategorias({ categorias, selecionar }: { categorias: CategoriaBi[]; selecionar: (id: string) => void }) {
  const [aberto, definirAberto] = useState(false);
  const maximo = Math.max(1, ...categorias.map(c => c.receita ?? 0));
  return <>
    <div className={s.ranking}>{categorias.slice(0, 5).map((categoria, indice) => <div className={s.rankingLinha} key={categoria.id}>
      <span className={s.posicao}>{indice + 1}</span>
      <div className={s.rankingNome}><Button formato="campo" variant="link" size="xs" title={categoria.nome} onClick={() => selecionar(categoria.id)}><span>{categoria.nome}</span></Button></div>
      <div className={s.barraTrilho} aria-hidden="true"><div className={s.barra} style={{ width: `${Math.max(0, (categoria.receita ?? 0) / maximo * 100)}%` }} /></div>
      <span className={s.rankingValor}>{moeda(categoria.receita)}</span>
    </div>)}{!categorias.length && <p className={s.vazio}>Nenhuma categoria vendida na seleção.</p>}</div>
    <p className={s.legendaRegioes}>Receita dos itens, sem frete. Produtos com mais de uma categoria participam de cada uma.</p>
    <div className={s.linkRodape}><Button formato="campo" variant="link" size="sm" onClick={() => definirAberto(true)}>Ver ranking de categorias<ArrowRight aria-hidden="true" /></Button></div>
    <Dialog open={aberto} onOpenChange={definirAberto} protegerAlteracoes={false}>
      <DialogContent variant="painel-direito">
        <DialogHeader className={s.painelCabecalho}><DialogTitle>Categorias mais vendidas</DialogTitle><DialogDescription>Mesmo período e filtros do Dashboard. As categorias podem se sobrepor; seus valores não devem ser somados como faturamento.</DialogDescription></DialogHeader>
        <div className={s.painelConteudo}><Table aria-label="Ranking de categorias"><TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Pedidos</TableHead></TableRow></TableHeader><TableBody>
          {categorias.map(categoria => <TableRow key={categoria.id}><TableCell><Button formato="campo" variant="link" size="sm" onClick={() => { definirAberto(false); selecionar(categoria.id); }}>{categoria.nome}</Button></TableCell><TableCell className="text-right tabular-nums">{moeda(categoria.receita)}</TableCell><TableCell className="text-right tabular-nums">{categoria.pedidos}</TableCell></TableRow>)}
        </TableBody></Table>{!categorias.length && <p className={s.vazio}>Nenhuma categoria vendida na seleção.</p>}</div>
      </DialogContent>
    </Dialog>
  </>;
}
