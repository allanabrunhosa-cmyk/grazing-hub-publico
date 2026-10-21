"use client";
import type { PedidoDetalhado } from "./detalhe-pedido";

const moeda = (v: string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PagamentoOperacionalPedido({ pedido: p }: { pedido: PedidoDetalhado }) {
  const f = p.financeiro;
  return <div className="space-y-1"><p className="text-sm">{p.pagamentoInformadoSnapshot?.nome ?? ({ PIX: "Pix", CARTAO_CREDITO: "Cartão de crédito", CARTAO_DEBITO: "Cartão de débito", BOLETO: "Boleto" } as Record<string, string>)[p.formaPagamentoInformada ?? ""] ?? "Forma não informada"}{(p.pagamentoInformadoSnapshot?.parcelas ?? 1) > 1 ? ` · ${p.pagamentoInformadoSnapshot!.parcelas}x` : ""}</p>
    {p.dataCompra && <p className="text-sm text-muted-foreground">Data da compra: {p.dataCompra.split("-").reverse().join("/")}</p>}
    {p.modoFinanceiro === "EXTERNO" ? <p className="text-sm text-muted-foreground">Pagamento acompanhado no sistema de origem.</p> : f && <><p className="text-sm">{Number(f.saldoCliente ?? f.saldo) > 0 ? `A receber: ${moeda(f.saldoCliente ?? f.saldo)}` : Number(f.capturado ?? 0) > 0 ? "Pago no cartão · repasse acompanhado separadamente" : Number(f.recebido) > 0 || Number(f.creditoAplicado ?? 0) > 0 ? "Pagamento registrado" : "Sem pagamento registrado"}</p>{Number(f.recebido) > 0 && <p className="text-sm text-muted-foreground">Recebido: {moeda(f.recebido)}</p>}</>}
  </div>;
}
