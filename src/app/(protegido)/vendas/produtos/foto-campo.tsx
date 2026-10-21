"use client";
import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { BotaoRemoverItem } from "@/components/remover-item";
import { enviarFotoProdutoVendaAction } from "../actions";
export function FotoCampo({ produtoId, url, mudar, aoEnviar, nome = "produto" }: { produtoId: string; url: string | null; mudar: (url: string | null) => void; aoEnviar: (enviando: boolean) => void; nome?: "produto" | "complemento" }) {
  const [erro, setErro] = useState(""); const [enviando, setEnviando] = useState(false);
  return <div className="space-y-2"><p className="text-sm font-medium">Foto do {nome}</p><div className="relative flex aspect-[4/5] max-h-64 items-center justify-center overflow-hidden rounded-xl border bg-muted/30">{url ? <>
    {/* Rota privada: a foto usa a sessão do navegador, sem otimizador público. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={`Foto do ${nome}`} className="size-full object-cover" /><span className="absolute right-2 top-2"><BotaoRemoverItem discreto data-dialogo-altera nome="Remover foto do formulário" onClick={() => mudar(null)} /></span></> : <ImagePlus className="size-10 text-muted-foreground/50" />}</div><label className="block cursor-pointer text-xs text-primary">{enviando ? "Enviando foto…" : "Escolher foto · JPG, PNG ou WebP, até 2 MB"}<input aria-label={`Escolher foto do ${nome}`} type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs" disabled={enviando} onChange={async e => {
    const arquivo = e.target.files?.[0]; if (!arquivo) return;
    if (arquivo.size > 2 * 1024 * 1024) { setErro("A imagem deve ter no máximo 2 MB."); return; }
    const dados = new FormData(); dados.set("foto", arquivo); dados.set("produtoId", produtoId); setEnviando(true); aoEnviar(true); setErro("");
    try { const resultado = await enviarFotoProdutoVendaAction(dados); if (resultado.erro) setErro(resultado.erro); else if (resultado.url) mudar(resultado.url); } catch { setErro("Não foi possível enviar a foto. Tente novamente."); } finally { setEnviando(false); aoEnviar(false); }
  }} /></label>{erro && <p role="alert" className="text-xs text-destructive">{erro}</p>}</div>;
}
