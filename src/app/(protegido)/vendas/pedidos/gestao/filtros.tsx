"use client";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { rotaPopupPedido } from "../pedidos-navegacao";

export function FiltrosGestaoPedidos({ children, retorno, className }: { children: ReactNode; retorno: string; className?: string }) {
  const router = useRouter();
  return <form className={className} onSubmit={e => {
    e.preventDefault();
    const parametros = new URLSearchParams();
    for (const [chave, valor] of new FormData(e.currentTarget)) if (typeof valor === "string" && valor) parametros.set(chave, valor);
    router.replace(rotaPopupPedido(`/vendas/pedidos/gestao?${parametros}`, retorno), { scroll: false });
  }}>{children}</form>;
}
