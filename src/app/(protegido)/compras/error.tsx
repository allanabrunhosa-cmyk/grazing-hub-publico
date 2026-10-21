"use client";

import { RefreshCw, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ComprasError() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <ShoppingCart className="size-6" />
        </span>
        <h1 className="mt-4 font-heading text-2xl font-semibold">Não foi possível concluir a operação</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          A página de Compras pode ter sido atualizada enquanto você trabalhava. Recarregue para usar a versão mais recente. Se havia um novo pedido preenchido, ele será recuperado.
        </p>
        <Button type="button" className="mt-6" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" />
          Atualizar Compras
        </Button>
      </div>
    </div>
  );
}
