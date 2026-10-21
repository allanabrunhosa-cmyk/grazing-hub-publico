"use client";

import { useRef, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { ListaOrdenavel } from "@/components/lista-ordenavel";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CategoriaPorcoesOption } from "@/lib/insumos/ordem-categorias-porcoes";
import { reordenarCategoriasPorcoesAction } from "./actions";

export function OrdemCategoriasPorcoes({ categorias, fechar, aoSalvar }: { categorias: CategoriaPorcoesOption[]; fechar: () => void; aoSalvar: (categorias: CategoriaPorcoesOption[]) => void }) {
  const [itens, setItens] = useState(categorias);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState("");
  const trava = useRef(false);
  const alterado = itens.some((item, indice) => item.id !== categorias[indice]?.id);
  async function salvar() {
    if (trava.current || !alterado) return;
    trava.current = true; setPendente(true); setErro("");
    try {
      const resultado = await reordenarCategoriasPorcoesAction(itens.map(({ id, versao }) => ({ id, versao })));
      if ("erro" in resultado) { setErro(resultado.erro); return; }
      aoSalvar(resultado.categorias); fechar();
    } catch { setErro("Não foi possível ordenar as categorias. Tente novamente."); }
    finally { trava.current = false; setPendente(false); }
  }
  return <Dialog open alterado={alterado} protegerAlteracoes={!pendente} onOpenChange={aberto => { if (!aberto && !trava.current) fechar(); }}>
    <DialogContent showCloseButton={!pendente}>
      <DialogHeader><DialogTitle>Ordem das categorias</DialogTitle><DialogDescription>Arraste as categorias com porções cadastradas para definir a sequência da tabela. Pelo teclado, use a alça com Espaço e as setas.</DialogDescription></DialogHeader>
      <ListaOrdenavel itens={itens} chave={c => c.id} nome={c => c.nome} mudar={setItens} disabled={pendente}>{(categoria, indice, alca) => <div className="flex items-center gap-2 rounded-xl border p-3">{alca}<span className="text-xs text-muted-foreground">{indice + 1}</span><span className="min-w-0 flex-1 break-words text-sm">{categoria.nome}</span></div>}</ListaOrdenavel>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <DialogFooter><DialogClose render={<Button type="button" variant="outline" disabled={pendente} />}>Cancelar</DialogClose><Button type="button" onClick={() => void salvar()} disabled={pendente || !alterado} aria-busy={pendente || undefined}>{pendente ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Salvar ordem</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
