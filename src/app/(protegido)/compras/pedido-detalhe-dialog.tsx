"use client";

import { gerarDocumentoPedidoTermico } from "@/lib/compras/impressao-pedido";
import { Printer, PackageCheck, Trash2, TriangleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusPedidoBadge } from "@/app/(protegido)/compras/status-badge";
import { unidadeMedidaAbreviada, tipoDivergenciaLabels } from "@/lib/labels";
import { formatarNumeroPedido, statusExibicaoPedido, type PedidoRow } from "@/app/(protegido)/compras/types";
import { descreverConversao, descreverEquivalencia } from "@/lib/insumos/conversoes";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";

function imprimirPedido(pedido: PedidoRow) {
  const janela = window.open("", "_blank", "width=420,height=800");
  if (!janela) return;
  janela.document.write(gerarDocumentoPedidoTermico(pedido));
  janela.document.close();
  janela.focus();
  janela.print();
}

export function PedidoDetalheDialog({
  pedido,
  open,
  onOpenChange,
  onEditar,
  onReceber,
  onExcluir,
  onReabrir,
  somenteLeitura = false,
}: {
  pedido: PedidoRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditar: () => void;
  onReceber: () => void;
  onExcluir: () => void;
  onReabrir: () => void;
  somenteLeitura?: boolean;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const status = statusExibicaoPedido(pedido, hoje);
  const itens = pedido.itens.filter((i) => i.quantidade > 0);
  const recebimento = pedido.recebimentos.find(r => !r.reabertoEm) ?? null;
  const podeEditar = !somenteLeitura && !pedido.excluidoEm && pedido.status === "CONFIRMADO";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {formatarNumeroPedido(pedido.numero)} — {pedido.fornecedorNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              <strong>Entrega:</strong>{" "}
              {pedido.previsaoEntrega ? new Date(pedido.previsaoEntrega).toLocaleDateString("pt-BR") : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <strong>Status:</strong> <StatusPedidoBadge status={status} />
            </span>
          </div>

          {pedido.excluidoEm && <p className="rounded-lg border p-3 text-sm">Excluído em {new Date(pedido.excluidoEm).toLocaleString("pt-BR")}. Disponível somente para consulta.</p>}
          {pedido.usoConsumo && <p className="text-sm font-medium">Uso e consumo · sem entrada no estoque{pedido.fornecedorAvulso ? " · fornecedor não cadastrado" : ""}</p>}
          <div className="divide-y rounded-lg border">
            {itens.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span><IdentificacaoInsumo nome={item.insumoNome} especificacao={item.insumoEspecificacao} nomeClassName="font-medium" />{item.fatorConversao != null && item.unidadePrincipal && item.unidadeCompra !== item.unidadePrincipal && <small className="mt-1 block text-muted-foreground">{descreverConversao({ unidade: item.unidadeCompra, fator: item.fatorConversao }, item.unidadePrincipal)}</small>}</span>
                <span className="text-right text-muted-foreground">
                  {item.quantidade} {unidadeMedidaAbreviada[item.unidadeCompra]}
                  {item.precoUnitario != null && <> · R$ {item.precoUnitario.toFixed(2)}/{unidadeMedidaAbreviada[item.unidadeCompra]}</>}
                  {item.fatorConversao != null && item.unidadePrincipal && item.unidadeCompra !== item.unidadePrincipal && <small className="mt-1 block">Total: {descreverEquivalencia(item.quantidade, item.fatorConversao, item.unidadePrincipal)}</small>}
                </span>
              </div>
            ))}
          </div>

          {pedido.observacoes && <p className="text-sm text-muted-foreground">{pedido.observacoes}</p>}

          {recebimento && (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm">
              <p>
                Recebido por <strong>{recebimento.responsavelNome}</strong> em{" "}
                {new Date(recebimento.dataRecebimento).toLocaleDateString("pt-BR")}
              </p>
              {recebimento.itens.some((item) => item.divergencias.length > 0) && (
                <ul className="space-y-1">
                  {recebimento.itens
                    .filter((item) => item.divergencias.length > 0)
                    .map((item) => (
                      <li key={item.id} className="flex items-start gap-1.5 text-destructive">
                        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          <IdentificacaoInsumo nome={item.insumoNome} especificacao={item.insumoEspecificacao} nomeClassName="font-medium" />
                          {item.divergencias.map((d) => tipoDivergenciaLabels[d.tipo]).join(", ")}
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {(pedido.historico?.length || pedido.recebimentos.length) ? <details className="rounded-xl border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">Histórico do pedido</summary>
          <div className="mt-3 space-y-3">
            {pedido.historico?.map(h => <div key={h.id} className="border-l-2 border-primary/30 pl-3">
              <p className="font-medium">{h.acao === "REAGENDAMENTO" ? "Previsão de entrega alterada" : h.acao === "EXCLUSAO" ? "Pedido excluído" : h.statusNovo === "CONFIRMADO" ? "Pedido reaberto" : h.statusNovo === "CANCELADO" ? "Pedido cancelado" : "Recebimento registrado"}</p>
              <p className="text-xs text-muted-foreground">{new Date(h.criadoEm).toLocaleString("pt-BR")} · {h.usuarioNome}</p>
              {h.acao !== "REAGENDAMENTO" && <p className="text-xs text-muted-foreground">{h.statusAnterior === "RECEBIDO_PARCIAL" ? "Recebido parcialmente" : h.statusAnterior === "RECEBIDO_TOTAL" ? "Recebido" : "Pendente"} → {h.statusNovo === "CONFIRMADO" ? "Pendente" : h.statusNovo === "CANCELADO" ? "Cancelado" : h.statusNovo === "RECEBIDO_PARCIAL" ? "Recebido parcialmente" : "Recebido"}</p>}
              <p className="whitespace-pre-wrap break-words">{h.motivo}</p>
            </div>)}
            {pedido.recebimentos.map(r => <details key={r.id} className="rounded-lg bg-muted/40 p-3">
              <summary className="cursor-pointer">Conferência de {new Date(r.dataRecebimento).toLocaleDateString("pt-BR")} · {r.responsavelNome}{r.reabertoEm ? " · reaberta" : ""}</summary>
              {r.reabertoEm && <p className="mt-2 text-xs text-muted-foreground">Reaberta em {new Date(r.reabertoEm).toLocaleString("pt-BR")}. Preservada como histórico.</p>}
              <ul className="mt-2 space-y-2">{r.itens.map(i => <li key={i.id}><IdentificacaoInsumo nome={i.insumoNome} especificacao={i.insumoEspecificacao} nomeClassName="font-medium" />{i.quantidadeRecebida} de {i.quantidadeOrdenada} {unidadeMedidaAbreviada[i.unidadeCompra]}
                {i.fatorConversao != null && i.unidadePrincipal && i.unidadeCompra !== i.unidadePrincipal && <p className="text-xs text-muted-foreground">{descreverConversao({ unidade: i.unidadeCompra, fator: i.fatorConversao }, i.unidadePrincipal)} · Recebido: {descreverEquivalencia(i.quantidadeRecebida, i.fatorConversao, i.unidadePrincipal)}</p>}
                {i.lote && <span> · Lote {i.lote}</span>}{i.validade && <span> · Validade {new Date(i.validade).toLocaleDateString("pt-BR")}</span>}
                {i.divergencias.length > 0 && <p className="text-destructive">{i.divergencias.map(d => tipoDivergenciaLabels[d.tipo] + (d.descricao ? ": " + d.descricao : "")).join("; ")}</p>}
              </li>)}</ul>
            </details>)}
          </div>
        </details> : null}
        <DialogFooter className="flex-wrap justify-start sm:justify-start">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => imprimirPedido(pedido)}>
            <Printer className="size-4" />
            Imprimir
          </Button>
          {!somenteLeitura && !pedido.excluidoEm && (pedido.status === "RECEBIDO_TOTAL" || pedido.status === "RECEBIDO_PARCIAL") && <Button variant="outline" size="sm" onClick={onReabrir}><RotateCcw className="size-4" />Reabrir pedido</Button>}
          {podeEditar && (
            <>
              <Button type="button" className="gap-1.5" onClick={onEditar} aria-label="Editar" variant="editar" size="icon-sm" />
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onReceber}>
                <PackageCheck className="size-4" />
                Confirmar recebimento
              </Button>

            </>
          )}
          {!somenteLeitura && !pedido.excluidoEm && <Button type="button" variant="destructive" size="sm" onClick={onExcluir}><Trash2 className="size-4" />Excluir pedido</Button>}
          <DialogClose render={<Button type="button" variant="ghost" size="sm" className="ml-auto" />}>Fechar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
