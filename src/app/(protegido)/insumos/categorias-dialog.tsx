"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, ListFilter } from "lucide-react";
import { EdicaoInline, GrupoAcoes } from "@/components/padroes-operacionais";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCategoriaAction, renameCategoriaAction, deleteCategoriaAction } from "@/app/(protegido)/insumos/actions";
import type { SimpleOption } from "@/app/(protegido)/insumos/types";

export function CategoriasDialog({ categorias, trigger }: { categorias: SimpleOption[]; trigger: ReactElement }) {
  const acesso = useAcesso();
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lista, setLista] = useState(categorias);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const nome = novaCategoria.trim();
    if (!nome) return;
    startTransition(async () => {
      try {
        const criada = await createCategoriaAction(nome);
        setLista((prev) => (prev.some((c) => c.id === criada.id) ? prev : [...prev, criada].sort((a, b) => a.nome.localeCompare(b.nome))));
        setNovaCategoria("");
      } catch {
        toast.error("Não foi possível adicionar a categoria.");
      }
    });
  }

  async function handleRename(id: string, nome: string): Promise<{ ok: true } | { erro: string }> {
    try {
      await renameCategoriaAction(id, nome);
      setLista(prev => prev.map(c => c.id === id ? { ...c, nome } : c));
      return { ok: true };
    } catch { return { erro: "Não foi possível renomear a categoria. Confira o nome e seu acesso." }; }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
      const result = await deleteCategoriaAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setLista((prev) => prev.filter((c) => c.id !== id));
        setRemoverId(null);
        toast.success("Categoria excluída.");
      }
      } catch { toast.error("Não foi possível excluir a categoria."); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListFilter className="size-5" />
            Categorias
          </DialogTitle>
          <DialogDescription>Gerencie as categorias usadas no catálogo global.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada ainda.</p>}
          {lista.map((categoria) => (
            <div key={categoria.id} className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 basis-full"><EdicaoInline nome={`Nome de ${categoria.nome}`} valor={categoria.nome} disabled={pending} motivoBloqueio={!acesso.pode("insumos", "editar") ? "Seu acesso não permite editar categorias." : undefined} validar={valor => valor.trim() ? null : "Informe o nome da categoria."} salvar={valor => handleRename(categoria.id, valor.trim())} /></div>
              <GrupoAcoes nome={`Ações de ${categoria.nome}`} className="ml-auto flex-wrap">
                {removerId === categoria.id ? <><Button variant="destructive" size="sm" disabled={pending} onClick={() => handleDelete(categoria.id)}>Confirmar exclusão</Button><Button variant="outline" size="sm" disabled={pending} onClick={() => setRemoverId(null)}>Cancelar</Button></> : <Button variant="excluir" aria-label={`Excluir ${categoria.nome}`} disabled={pending || !acesso.pode("insumos", "excluir")} onClick={() => setRemoverId(categoria.id)}><Trash2 /></Button>}
              </GrupoAcoes>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Input
            value={novaCategoria}
            onChange={(e) => setNovaCategoria(e.target.value)}
            aria-label="Nome da nova categoria"
            placeholder="Nova categoria..."
            disabled={pending || !acesso.pode("insumos", "adicionar")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" aria-label="Adicionar categoria" onClick={handleAdd} disabled={pending || !novaCategoria.trim() || !acesso.pode("insumos", "adicionar")}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          </Button>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Fechar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
