"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { consultarMovimentacoesItemAction } from "./movimentacoes-actions";
import type { ExtratoIndividualDTO, FiltroExtratoIndividual } from "@/lib/estoque/extrato-individual";
import { FiltroPeriodo } from "@/components/filtro-periodo";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { SelecaoFormulario } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, SortableTableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tipoMovimentacaoEstoqueLabels } from "@/lib/labels";

export function MovimentacoesItem({ insumoId, unidade }: { insumoId: string; unidade: string }) {
  const [filtros, setFiltros] = useState<FiltroExtratoIndividual>({ insumoId, de: "", ate: "", tipo: "", ordem: "desc", pagina: 1 });
  const [dados, setDados] = useState<ExtratoIndividualDTO | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [tentativa, setTentativa] = useState(0);
  const consulta = useRef(0);
  useEffect(() => {
    const sequencia = ++consulta.current;
    let ativa = true;
    startTransition(async () => {
      try { const r = await consultarMovimentacoesItemAction({ ...filtros, insumoId }); if (!ativa || sequencia !== consulta.current) return;
        if ("erro" in r) { setErro(r.erro); setDados(null); } else { setDados(r.dados); setErro(null); }
      } catch { if (ativa && sequencia === consulta.current) { setErro("Não foi possível consultar. Tente novamente."); setDados(null); } }
    });
    return () => { ativa = false; };
  }, [filtros, insumoId, tentativa]);
  return <div className="min-w-0 space-y-3" aria-busy={pending}>
    <div className="flex flex-wrap items-end gap-3"><FiltroPeriodo de={filtros.de} ate={filtros.ate} aoAlterar={p => setFiltros(f => ({ ...f, ...p, pagina: 1 }))} />
      <div className="min-w-0"><SelecaoFormulario aria-label="Tipo de movimentação" value={filtros.tipo} onValueChange={tipo => setFiltros(f => ({ ...f, tipo, pagina: 1 }))}><option value="">Todos os tipos</option>{Object.entries(tipoMovimentacaoEstoqueLabels).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</SelecaoFormulario></div>
    </div>
    <p className="text-xs text-muted-foreground">Quantidades em {unidade}. Saldos por local reconstruídos pela data efetiva e posição atual, antes dos filtros. — indica saldo indisponível.</p>
    {pending && <p role="status" className="text-sm text-muted-foreground">Carregando movimentações…</p>}
    {erro && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{erro}</p><Button variant="outline" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</Button></div>}
    {dados && !pending && <>
      <Table><TableHeader><TableRow><SortableTableHead active direction={filtros.ordem} onClick={() => setFiltros(f => ({ ...f, ordem: f.ordem === "desc" ? "asc" : "desc", pagina: 1 }))}>Data e horário</SortableTableHead><TableHead>Tipo</TableHead><TableHead>Quantidade</TableHead><TableHead>Saldo anterior</TableHead><TableHead>Saldo posterior</TableHead><TableHead>Local</TableHead><TableHead>Origem / lançamento</TableHead><TableHead>Responsável</TableHead></TableRow></TableHeader><TableBody>
        {dados.linhas.map(m => <TableRow key={m.id}><TableCell>{new Date(m.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell><TableCell>{tipoMovimentacaoEstoqueLabels[m.tipo as keyof typeof tipoMovimentacaoEstoqueLabels]}{m.observacao && <p className="max-w-sm whitespace-normal text-xs text-muted-foreground">{m.observacao}</p>}</TableCell><TableCell className={m.entrada ? "font-medium text-success" : "font-medium text-destructive"}>{m.entrada ? "+" : "−"}{m.quantidade} {unidade}</TableCell><TableCell>{m.saldoAnterior ?? "—"}</TableCell><TableCell>{m.saldoPosterior ?? "—"}</TableCell><TableCell>{m.local}</TableCell><TableCell><p>{m.origem}</p>{m.href ? <Link className="text-primary underline underline-offset-4" href={m.href}>{m.identificador}</Link> : <span className="text-xs text-muted-foreground">{m.identificador}</span>}</TableCell><TableCell>{m.responsavel}</TableCell></TableRow>)}
        {!dados.linhas.length && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma movimentação neste período.</TableCell></TableRow>}
      </TableBody></Table>
      <GrupoAcoes nome="Paginação de movimentações" className="flex-wrap"><p className="text-xs text-muted-foreground">{dados.total} movimentos · Página {dados.pagina} de {dados.paginas}</p><Button variant="outline" disabled={dados.pagina <= 1} onClick={() => setFiltros(f => ({ ...f, pagina: dados.pagina - 1 }))}>Anterior</Button><Button variant="outline" disabled={dados.pagina >= dados.paginas} onClick={() => setFiltros(f => ({ ...f, pagina: dados.pagina + 1 }))}>Próxima</Button></GrupoAcoes>
    </>}
  </div>;
}
