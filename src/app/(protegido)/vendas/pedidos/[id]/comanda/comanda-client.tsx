"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { htmlResumoPedido, imprimirResumoPedido } from "../operacao/impressao";
import type { ResumoOperacional } from "../operacao/operacao-client";
export function ComandaPedido({ pedido, geradoEm }: { pedido: ResumoOperacional; geradoEm: string }) {
  const [formato, setFormato] = useState<"A4" | "80mm">("80mm"), [aviso, setAviso] = useState("");
  return <section className="space-y-4"><div className="flex flex-wrap gap-3"><Button variant={formato === "A4" ? "default" : "outline"} aria-pressed={formato === "A4"} onClick={() => setFormato("A4")}>A4</Button><Button variant={formato === "80mm" ? "default" : "outline"} aria-pressed={formato === "80mm"} onClick={() => setFormato("80mm")}>80 mm</Button><Button onClick={() => setAviso(imprimirResumoPedido(pedido, formato) ? "Solicitação de impressão aberta. Confira o resultado na impressora; o HUB não confirma impressão física." : "Permita a janela de impressão do navegador.")}>Imprimir comanda</Button></div><p className="text-sm text-muted-foreground">Para a térmica, selecione bobina de 80 mm no driver e escala de 100%. Desative cabeçalhos e rodapés do navegador.</p>{aviso && <p role="status">{aviso}</p>}<iframe title={`Comanda de produção ${formato}`} srcDoc={htmlResumoPedido(pedido, formato, new Date(geradoEm))} className="h-screen w-full rounded-xl border bg-card" sandbox="" /></section>;
}
