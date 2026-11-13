"use client";
import { startTransition, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileCode2, FileText } from "lucide-react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  return <Dialog open protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto) fechar(); }}><DialogContent variant="painel-direito" onKeyDownCapture={evento => {
    // A consulta não edita dados. Capture Escape antes do GrupoAcoes, que interrompe a propagação das teclas.
    if (evento.key === "Escape" && !evento.defaultPrevented) { evento.preventDefault(); evento.stopPropagation(); fechar(); }
  }}><DialogHeader className="border-b p-5 pr-12"><DialogTitle>Detalhes da nota</DialogTitle><DialogDescription>{documento.tipo === "NFS_ENTRADA" ? "NFS-e" : documento.modelo === 65 ? "NFC-e" : "NF-e"} · {documento.numero ?? "Sem número"}</DialogDescription></DialogHeader><div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Emissão</dt><dd>{documento.dataFiscal ? formatarDataFiscal(documento.dataFiscal) : "Não informada"}</dd></div><div><dt className="text-xs text-muted-foreground">Valor fiscal</dt><dd className="font-medium tabular-nums">{formatarMoedaFiscal(documento.valor)}</dd></div></dl>
    {!resultado ? <p role="status">Carregando os detalhes da nota…</p> : "erro" in resultado ? <div role="alert" className="space-y-3"><p>{resultado.erro}</p><Button variant="outline" onClick={() => { definirResultado(null); tentarNovamente(n => n + 1); }}>Tentar novamente</Button></div> : <>
      <Card size="sm" aria-label="Arquivos da nota" className="gap-3"><CardHeader><CardTitle>Arquivos da nota</CardTitle></CardHeader><CardContent className="space-y-3"><GrupoAcoes nome="Abrir e baixar arquivos da nota" alinhamento="inicio">
        {resultado.arquivos?.impressao && <><Button variant="entrada-outline" size="sm" nativeButton={false} role="link" render={<a href={resultado.arquivos.impressao.abrir} target="_blank" rel="noopener noreferrer" />}><FileText aria-hidden="true" />{resultado.arquivos.impressao.formato === "PDF" ? "Abrir PDF" : "Abrir DANFE"}</Button><Button variant="outline" size="sm" nativeButton={false} role="link" render={<a href={resultado.arquivos.impressao.baixar} />}><Download aria-hidden="true" />{resultado.arquivos.impressao.formato === "PDF" ? "Baixar PDF" : "Baixar impressão HTML"}</Button></>}
        {resultado.arquivos?.xml && <Button variant="entrada-outline" size="sm" nativeButton={false} role="link" render={<a href={resultado.arquivos.xml} />}><FileCode2 aria-hidden="true" />Baixar XML</Button>}
        {resultado.arquivos?.cancelamento && <Button variant="outline" size="sm" nativeButton={false} role="link" render={<a href={resultado.arquivos.cancelamento} />}><FileCode2 aria-hidden="true" />XML do cancelamento</Button>}
      </GrupoAcoes>{!resultado.arquivos?.impressao && !resultado.arquivos?.xml && !resultado.arquivos?.cancelamento && <p role="status" className="text-xs text-muted-foreground">Nenhum arquivo completo está disponível no HUB para esta nota.</p>}{!resultado.arquivos?.impressao && (resultado.arquivos?.xml || resultado.arquivos?.cancelamento) && <p className="text-xs text-muted-foreground">PDF/DANFE não disponível nos arquivos locais desta nota.</p>}</CardContent></Card>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">{resultado.campos.map(c => <div key={c.nome} className="min-w-0"><dt className="text-xs text-muted-foreground">{c.nome}</dt><dd className="break-words [overflow-wrap:anywhere]">{c.valor ?? "Não informado"}</dd></div>)}</dl>
      {resultado.aviso && <p role="status" className="text-sm text-muted-foreground">{resultado.aviso}</p>}
      {resultado.itens.length > 0 && <Table aria-label="Itens da nota"><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader><TableBody>{resultado.itens.map(i => <TableRow key={i.numero}><TableCell>{i.descricao}</TableCell><TableCell>{i.quantidade.toLocaleString("pt-BR")} {i.unidade}</TableCell><TableCell className="whitespace-nowrap text-right">{formatarMoedaFiscal(i.valor.toFixed(2))}</TableCell></TableRow>)}</TableBody></Table>}
    </>}
  </div></DialogContent></Dialog>;
}
