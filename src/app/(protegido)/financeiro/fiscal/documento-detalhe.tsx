"use client";
import { startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DetalheDocumentoDashboard } from "@/lib/fiscal-dashboard/documento";
import type { DocumentoDashboardFiscal } from "@/lib/fiscal-dashboard/tipos";
import { tipoDocumentoDashboard } from "@/lib/fiscal-dashboard/periodo";
import { consultarDocumentoDashboardAction } from "@/app/(protegido)/financeiro/fiscal/documento-actions";
import { formatarMoedaFiscal, formatarDataFiscal } from "./formatacao";

export function DetalheDocumentoFiscal({ documento, fechar }: { documento: DocumentoDashboardFiscal; fechar: () => void }) {
  const [resultado, definirResultado] = useState<DetalheDocumentoDashboard | { erro: string } | null>(null);
  const [tentativa, tentarNovamente] = useState(0);
  useEffect(() => {
    let ativo = true;
    startTransition(async () => {
      try { const r = await consultarDocumentoDashboardAction(tipoDocumentoDashboard(documento), documento.id); if (ativo) definirResultado(r); }
      catch { if (ativo) definirResultado({ erro: "Não foi possível consultar a nota. Tente novamente." }); }
    });
    return () => { ativo = false; };
  }, [documento.id, documento, tentativa]);
  return <Dialog open onOpenChange={aberto => { if (!aberto) fechar(); }}><DialogContent variant="painel-direito"><DialogHeader className="border-b p-5 pr-12"><DialogTitle>Detalhes da nota</DialogTitle><DialogDescription>{documento.tipo === "NFS_ENTRADA" ? "NFS-e" : documento.modelo === 65 ? "NFC-e" : "NF-e"} · {documento.numero ?? "Sem número"}</DialogDescription></DialogHeader><div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Emissão</dt><dd>{documento.dataFiscal ? formatarDataFiscal(documento.dataFiscal) : "Não informada"}</dd></div><div><dt className="text-xs text-muted-foreground">Valor fiscal</dt><dd className="font-medium tabular-nums">{formatarMoedaFiscal(documento.valor)}</dd></div></dl>
    {!resultado ? <p role="status">Carregando os detalhes da nota…</p> : "erro" in resultado ? <div role="alert" className="space-y-3"><p>{resultado.erro}</p><Button variant="outline" onClick={() => { definirResultado(null); tentarNovamente(n => n + 1); }}>Tentar novamente</Button></div> : <>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{resultado.campos.map(c => <div key={c.nome} className="min-w-0"><dt className="text-xs text-muted-foreground">{c.nome}</dt><dd className="break-words [overflow-wrap:anywhere]">{c.valor ?? "Não informado"}</dd></div>)}</dl>
      {resultado.aviso && <p role="status" className="text-sm text-muted-foreground">{resultado.aviso}</p>}
      {resultado.itens.length > 0 && <Table aria-label="Itens da nota"><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{resultado.itens.map(i => <TableRow key={i.numero}><TableCell>{i.descricao}</TableCell><TableCell>{i.quantidade.toLocaleString("pt-BR")} {i.unidade}</TableCell><TableCell className="whitespace-nowrap text-right">{formatarMoedaFiscal(i.valor.toFixed(2))}</TableCell></TableRow>)}</TableBody></Table>}
    </>}
  </div></DialogContent></Dialog>;
}
