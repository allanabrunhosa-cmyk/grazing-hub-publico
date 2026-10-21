"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Mesmo intervalo da produção; apenas consulta, sem consumir eventos no navegador. */
export function AtualizacaoIfood({ pausada = false }: { pausada?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (pausada) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" &&
          !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName ?? "") &&
          !document.querySelector('[role="dialog"] input:focus, [role="dialog"] textarea:focus')) router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [router, pausada]);
  return null;
}
