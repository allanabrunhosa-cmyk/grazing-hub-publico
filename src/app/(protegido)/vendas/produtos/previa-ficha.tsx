"use client";
import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { gerarFichaProduto, gerarFichaConfiguracao } from "@/lib/vendas/ficha";
import type { ProdutoEntrada } from "@/lib/vendas/dominio";
import type { DadosProdutos } from "@/lib/vendas/consultas";
import { ajustarFichaA4 } from "@/lib/vendas/ficha-a4";

export function PreviaFichaProduto({ produto, dados, fechar, configuracao }: { produto: ProdutoEntrada; dados: DadosProdutos; fechar: () => void; configuracao?: { escolhas: Record<string, number> } }) {
  const [erro, setErro] = useState("");
  const botaoImprimir = useRef<HTMLButtonElement>(null);
  const html = configuracao ? gerarFichaConfiguracao(produto, dados, configuracao.escolhas) : gerarFichaProduto(produto, dados);
  const previa = html.replace('<button class="imprimir" onclick="window.print()">Imprimir ficha</button>', "");
  function imprimir() {
    const janela = window.open("", "_blank");
    if (!janela) { setErro("Permita abrir a janela de impressão neste navegador."); return; }
    janela.document.write(html); janela.document.close();
  }
  return <Dialog open protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto) fechar(); }}><DialogContent className="sm:max-w-5xl" initialFocus={botaoImprimir}><DialogHeader><DialogTitle>Ficha técnica · {produto.nome}</DialogTitle><DialogDescription>{configuracao ? "Configuração de exemplo: somente as escolhas selecionadas. Não é ordem de produção." : "Ficha-mestre: ingredientes, porções e informações de montagem. Nenhum estoque é movimentado."}</DialogDescription></DialogHeader><iframe title={`Ficha técnica de ${produto.nome}`} srcDoc={previa} sandbox="allow-same-origin" onLoad={evento => { const documento = evento.currentTarget.contentDocument; if (documento) ajustarFichaA4(documento); }} className="h-[60vh] w-full rounded-xl border bg-white" /><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Uma folha A4 paisagem, com ajuste automático ao conteúdo. Na janela aberta, use Imprimir ficha para imprimir ou salvar em PDF.</p><Button ref={botaoImprimir} onClick={imprimir}><Printer className="size-4" />Imprimir / salvar PDF</Button></div>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}</DialogContent></Dialog>;
}
