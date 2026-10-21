"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { consultarHistoricoPedidosClienteAction } from "./historico-actions";
import type { HistoricoPedidosCliente } from "./tipos";

export function HistoricoCliente({ clienteId }: { clienteId: string }) {
  const [pagina, setPagina] = useState(1);
  const [tentativa, setTentativa] = useState(0);
  const [resultado, setResultado] = useState<{ clienteId: string; pagina: number; tentativa: number; dados?: HistoricoPedidosCliente; erro?: string } | null>(null);
  useEffect(() => {
    let atual = true;
    consultarHistoricoPedidosClienteAction(clienteId, pagina).then(resposta => {
      if (atual) setResultado({ clienteId, pagina, tentativa, ...("erro" in resposta ? { erro: resposta.erro } : { dados: resposta }) });
    }).catch(() => {
      if (atual) setResultado({ clienteId, pagina, tentativa, erro: "Não foi possível carregar os pedidos. Tente novamente." });
    });
    return () => { atual = false; };
  }, [clienteId, pagina, tentativa]);

  if (!resultado || resultado.clienteId !== clienteId || resultado.pagina !== pagina || resultado.tentativa !== tentativa) return <p role="status" className="py-6 text-sm text-muted-foreground">Carregando histórico de pedidos…</p>;
  if (resultado.erro) return <div className="space-y-3 py-4"><p role="alert" className="text-sm text-destructive">{resultado.erro}</p><Button variant="outline" size="sm" onClick={() => setTentativa(t => t + 1)}>Tentar novamente</Button></div>;
  const dados = resultado.dados!;
  if (!dados.pedidos.length) return <p className="py-6 text-sm text-muted-foreground">Nenhum pedido para este cliente.</p>;
  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">O total gasto soma pedidos confirmados e históricos ativos.</p>
    <Table className="text-left"><TableHeader><TableRow><TableHead>Pedido</TableHead><TableHead>Data do pedido</TableHead><TableHead>Data e hora de entrega</TableHead><TableHead>Valor total</TableHead></TableRow></TableHeader>
      <TableBody>{dados.pedidos.map(pedido => <TableRow key={pedido.id}>
        <TableCell><Link href={`/vendas/pedidos/${encodeURIComponent(pedido.id)}`} className="font-medium text-primary hover:underline">Pedido #{pedido.numero}</Link>{pedido.status !== "CONFIRMADO" && <p className="text-xs text-muted-foreground">{pedido.status === "RASCUNHO" ? "Rascunho" : pedido.status === "CANCELADO" ? "Cancelado" : pedido.status === "DECLINADO" ? "Declinado" : pedido.status === "HISTORICO" ? "Histórico" : pedido.status === "HISTORICO_REVERTIDO" ? "Histórico revertido" : pedido.status}</p>}</TableCell>
        <TableCell className="whitespace-normal">{pedido.baseDataPedido === "COMPRA" ? pedido.dataPedido.split("-").reverse().join("/") : new Date(pedido.dataPedido).toLocaleString("pt-BR", { timeZone: pedido.fusoHorario, dateStyle: "short", timeStyle: "short" })}<p className="text-xs text-muted-foreground">{pedido.baseDataPedido === "COMPRA" ? "Data da compra" : pedido.baseDataPedido === "CRIACAO_HISTORICA" ? "Criação na origem" : pedido.baseDataPedido === "CONFIRMACAO" ? "Confirmação" : "Criação"}</p></TableCell>
        <TableCell className="whitespace-normal">{pedido.entregueEm ? new Date(pedido.entregueEm).toLocaleString("pt-BR", { timeZone: pedido.fusoHorario, dateStyle: "short", timeStyle: "short" }) : pedido.previsaoData ? <>{pedido.previsaoData.split("-").reverse().join("/")}{pedido.previsaoJanela ? ` · ${pedido.previsaoJanela}` : " · Horário não informado"}<p className="text-xs text-muted-foreground">Entrega prevista</p></> : "Entrega não informada"}</TableCell>
        <TableCell className="tabular-nums">{formatarMoeda(Number(pedido.total))}</TableCell>
      </TableRow>)}</TableBody>
    </Table>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Mostrando {dados.pedidos.length} de {dados.total} pedidos</span><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={dados.pagina <= 1} onClick={() => setPagina(dados.pagina - 1)}>Anterior</Button><span>Pag. {dados.pagina}</span><Button variant="outline" size="sm" disabled={dados.pagina * dados.tamanhoPagina >= dados.total} onClick={() => setPagina(dados.pagina + 1)}>Próxima</Button></div></div>
  </div>;
}
