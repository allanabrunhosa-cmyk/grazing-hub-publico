"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buscarNotasPelaApi } from "@/lib/notas-fiscais/api-cliente";

export function SincronizarButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      let resultado: Awaited<ReturnType<typeof buscarNotasPelaApi>>;
      try {
        resultado = await buscarNotasPelaApi();
      } catch {
        toast.error("Não foi possível receber o resultado da busca.", {
          description: "A busca pode ter continuado no servidor. Atualize a página para conferir as notas e aguarde o intervalo da SEFAZ antes de tentar novamente.",
          duration: 12000,
        });
        return;
      }
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Busca agendada", { description: resultado.mensagem, duration: 10000 });
    });
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      Buscar novas notas
    </Button>
  );
}
