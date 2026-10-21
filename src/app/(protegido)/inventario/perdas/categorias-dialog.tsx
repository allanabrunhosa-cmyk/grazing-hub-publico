"use client";

import { useState, useTransition } from "react";
import { Loader2, Settings2, X } from "lucide-react";
import { StatusAtivoSalvavel } from "@/components/status-ativo";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { CategoriaPerdaOption } from "@/app/(protegido)/inventario/types";
import { adicionarCategoriaPerdaAction, alterarCategoriaPerdaAction, removerCategoriaPerdaAction } from "./categorias-actions";

export function CategoriasPerdaDialog({ categorias }: { categorias: CategoriaPerdaOption[] }) {
  const acesso = useAcesso();
  const podeEditar = acesso.pode("inventario.perdas.categorias", "editar");
  const podeAdicionar = acesso.pode("inventario.perdas.categorias", "adicionar");
  const podeExcluir = acesso.pode("inventario.perdas.categorias", "excluir");
  const [lista, setLista] = useState(categorias);
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState("");
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function adicionar() {
    iniciar(async () => {
      try {
        const resultado = await adicionarCategoriaPerdaAction(nome);
        if ("erro" in resultado) return setErro(resultado.erro ?? "Não foi possível cadastrar a categoria.");
        setLista(atual => [...atual, resultado.categoria].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
        setNome(""); setErro("");
      } catch { setErro("Não foi possível cadastrar a categoria. Tente novamente."); }
    });
  }

  function remover(id: string) {
    iniciar(async () => {
      try {
        const resultado = await removerCategoriaPerdaAction(id);
        if ("erro" in resultado) return setErro(resultado.erro ?? "Não foi possível remover a categoria.");
        setLista(atual => atual.filter(categoria => categoria.id !== id));
        setRemoverId(null); setErro("");
      } catch { setErro("Não foi possível remover a categoria. Tente novamente."); }
    });
  }

  return <Dialog onOpenChange={() => { setErro(""); setRemoverId(null); }}>
    <DialogTrigger render={<Button type="button" size="sm" variant="outline" className="h-10! gap-1.5" />}><Settings2 className="size-4" /> Gerenciar categorias</DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Categorias de perdas</DialogTitle>
        <DialogDescription>Uma categoria usada em registros pode ser inativada. A remoção está disponível somente para categorias ainda não utilizadas.</DialogDescription>
      </DialogHeader>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="nova-categoria-perda">Nova categoria</Label><Input id="nova-categoria-perda" value={nome} onChange={evento => setNome(evento.target.value)} maxLength={80} disabled={pendente} onKeyDown={evento => { if (evento.key === "Enter") { evento.preventDefault(); adicionar(); } }} /></div>
        <Button type="button" disabled={pendente || !podeAdicionar || nome.trim().length < 3} onClick={adicionar}>Adicionar</Button>
      </div>
      <ul className="max-h-72 space-y-1 overflow-y-auto" aria-label="Categorias cadastradas">
        {lista.map(categoria => <li key={categoria.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 break-words">{categoria.nome}{!categoria.ativo && <span className="ml-2 text-xs text-muted-foreground">Inativa</span>}</span>
          <GrupoAcoes nome={`Ações de ${categoria.nome}`}>
            <StatusAtivoSalvavel ativo={categoria.ativo} nome={categoria.nome} disabled={pendente} motivoBloqueio={!podeEditar ? "Seu acesso não permite editar categorias." : undefined} salvar={async ativo => {
              const resultado = await alterarCategoriaPerdaAction(categoria.id, ativo);
              if ("erro" in resultado) return { erro: resultado.erro ?? "Não foi possível alterar." };
              setLista(atual => atual.map(item => item.id === categoria.id ? { ...item, ativo } : item));
              return { ok: true };
            }} />
            {!categoria.usada && (removerId === categoria.id ?
              <Button type="button" size="sm" variant="destructive" disabled={pendente || !podeExcluir} onClick={() => remover(categoria.id)}>Confirmar remoção</Button> :
              <Button type="button" variant="excluir" aria-label={`Remover ${categoria.nome}`} disabled={pendente || !podeExcluir} onClick={() => setRemoverId(categoria.id)}><X className="size-4" /></Button>)}
          </GrupoAcoes>
        </li>)}
      </ul>
      {pendente && <p className="flex items-center gap-1 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Salvando...</p>}
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      {removerId && <DialogFooter><Button type="button" variant="outline" onClick={() => setRemoverId(null)}>Cancelar remoção</Button></DialogFooter>}
    </DialogContent>
  </Dialog>;
}
