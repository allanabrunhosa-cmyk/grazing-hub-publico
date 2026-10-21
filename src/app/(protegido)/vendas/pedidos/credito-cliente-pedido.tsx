"use client";
import { useEffect, useState } from "react";
import { LIMITE_CREDITO_ABERTO_PADRAO } from "@/lib/vendas/dominio";
import { consultarCreditoClientePedidoAction } from "./actions";

type Credito = { limite: string | null; emAberto: string; disponivel: string | null };
const moeda = (valor: string) => Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function texto(credito: Credito) {
  if (credito.limite === null || credito.disponivel === null) return `Crédito sem limite definido · em aberto ${moeda(credito.emAberto)}.`;
  return `Crédito disponível: ${moeda(credito.disponivel)} de ${moeda(credito.limite)} · em aberto ${moeda(credito.emAberto)}.`;
}

/** Informativo; a confirmação revalida o limite em aberto dentro da transação. */
export function CreditoClientePedido({ clienteId }: { clienteId: string | null }) {
  const [consulta, setConsulta] = useState<{ clienteId: string; credito?: Credito; erro?: string } | null>(null);
  useEffect(() => {
    if (!clienteId) return;
    let ativo = true;
    consultarCreditoClientePedidoAction(clienteId)
      .then(r => { if (ativo) setConsulta("erro" in r ? { clienteId, erro: r.erro } : { clienteId, credito: r }); })
      .catch(() => { if (ativo) setConsulta({ clienteId, erro: "Crédito do cliente indisponível no momento." }); });
    return () => { ativo = false; };
  }, [clienteId]);
  const atual = clienteId && consulta?.clienteId === clienteId ? consulta : null;
  const mensagem = !clienteId ? `Crédito disponível: ${moeda(LIMITE_CREDITO_ABERTO_PADRAO)} (limite inicial do novo cliente).`
    : !atual ? "Consultando crédito do cliente…"
    : atual.credito ? texto(atual.credito) : atual.erro;
  return <p role="status" aria-live="polite" data-credito-cliente className="text-xs text-muted-foreground">{mensagem}</p>;
}
