"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, LoaderCircle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { htmlResumoComercialPedido } from "@/lib/vendas/resumo-pedido-a4";
import type { DadosResumoPedido } from "@/lib/vendas/resumo-pedido";
import { consultarResumoPedidoAction } from "./resumo-pedido-actions";

export function ResumoPedido({ pedido, fechar }: { pedido: { id: string; numero: number | string }; fechar: () => void }) {
  const [carregado, setCarregado] = useState<{ id: string; dados: DadosResumoPedido } | null>(null);
  const [falha, setFalha] = useState<{ id: string; erro: string } | null>(null);
  const dados = carregado?.id === pedido.id ? carregado.dados : null;
  const erro = falha?.id === pedido.id ? falha.erro : "";
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let ativo = true;
    consultarResumoPedidoAction(pedido.id).then(resposta => {
      if (!ativo) return;
      if (resposta.erro) setFalha({ id: pedido.id, erro: resposta.erro });
      else if (resposta.dados) setCarregado({ id: pedido.id, dados: resposta.dados });
    }).catch(() => { if (ativo) setFalha({ id: pedido.id, erro: "Não foi possível carregar o resumo. Feche e tente novamente." }); });
    return () => { ativo = false; };
  }, [pedido.id]);
  function imprimir() {
    if (!dados) return;
    const janela = window.open("", "_blank");
    if (!janela) { setFalha({ id: pedido.id, erro: "Permita abrir a janela de impressão neste navegador." }); return; }
    janela.document.write(htmlResumoComercialPedido(dados, { impressao: true, origem: window.location.origin }));
    janela.document.close();
    janela.opener = null;
  }
  return <Dialog open protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto) fechar(); }}><DialogContent className="sm:max-w-4xl" initialFocus={titulo}><DialogHeader><DialogTitle ref={titulo} tabIndex={-1} className="flex items-center gap-2"><FileText className="size-4" />Resumo do pedido #{pedido.numero}</DialogTitle><DialogDescription>Documento comercial da Grazing Table &amp; Co para conferir, aprovar ou compartilhar com o cliente.</DialogDescription></DialogHeader>
    {dados ? <iframe title={`Resumo comercial do pedido #${pedido.numero}`} srcDoc={htmlResumoComercialPedido(dados)} sandbox="" className="h-[65dvh] w-full rounded-[var(--ds-controle-raio)] border bg-card" /> : <div className="flex min-h-48 items-center justify-center gap-2 rounded-[var(--ds-controle-raio)] border bg-muted p-5 text-sm" role="status">{erro ? "O resumo ainda não está disponível." : <><LoaderCircle className="size-4 animate-spin" />Preparando o resumo do pedido…</>}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="max-w-md text-xs text-muted-foreground">Formato A4. Na janela de impressão, escolha sua impressora ou Salvar como PDF.</p><Button disabled={!dados} onClick={imprimir}><Printer className="size-4" />Imprimir / salvar PDF</Button></div>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </DialogContent></Dialog>;
}
