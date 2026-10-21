"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AtualizacaoTema({ revisao }: { revisao: number }) {
  const [novaRevisao, setNovaRevisao] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    async function conferir() {
      try {
        const resposta = await fetch("/api/design/revisao", { cache: "no-store" });
        const dados = await resposta.json() as { revisao?: unknown };
        if (ativo && typeof dados.revisao === "number" && dados.revisao > revisao) setNovaRevisao(dados.revisao);
      } catch { /* Uma falha de rede não interfere no trabalho aberto. */ }
    }
    function aoFocar() { void conferir(); }
    window.addEventListener("focus", aoFocar);
    const intervalo = window.setInterval(conferir, 5 * 60_000);
    return () => { ativo = false; window.removeEventListener("focus", aoFocar); window.clearInterval(intervalo); };
  }, [revisao]);

  if (novaRevisao === null) return null;
  return <aside role="status" className="fixed right-4 bottom-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border bg-card p-3 shadow-lg"><RefreshCw className="size-4 text-primary" /><p className="text-sm">Novo padrão visual disponível.</p><Button size="sm" type="button" onClick={() => window.location.reload()}>Atualizar</Button></aside>;
}
