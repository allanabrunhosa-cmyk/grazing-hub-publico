"use client";

import { useEffect } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { Button } from "@/components/ui/button";

const CHAVE_RECARGA = "grazing:manifesto:ultima-recarga-erro";

export default function NotasFiscaisError({ error }: { error: Error & { digest?: string } }) {
  const paginaDesatualizada = unstable_isUnrecognizedActionError(error);

  useEffect(() => {
    if (!paginaDesatualizada) return;

    const ultimaRecarga = Number(window.sessionStorage.getItem(CHAVE_RECARGA));
    if (!ultimaRecarga || Date.now() - ultimaRecarga > 60_000) {
      window.sessionStorage.setItem(CHAVE_RECARGA, String(Date.now()));
      window.location.reload();
    }
  }, [paginaDesatualizada]);

  return (
    <div className="flex min-h-[55vh] items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
          <ScrollText className="size-6" />
        </span>
        <h1 className="mt-4 font-heading text-2xl font-semibold">
          {paginaDesatualizada ? "Atualizando o Manifesto" : "Não foi possível concluir a operação"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {paginaDesatualizada
            ? "O sistema recebeu uma versão nova enquanto esta tela estava aberta. A página será atualizada para preservar a operação."
            : "Atualize o Manifesto e tente novamente. Se o problema continuar, a equipe poderá consultar o registro técnico desta tentativa."}
        </p>
        <Button type="button" className="mt-6" onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" />
          Atualizar Manifesto
        </Button>
      </div>
    </div>
  );
}
