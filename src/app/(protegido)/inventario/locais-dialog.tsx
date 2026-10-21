"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2, Warehouse } from "lucide-react";
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
import { createLocalAction, renameLocalAction, deleteLocalAction } from "@/app/(protegido)/inventario/actions";
import type { LocalOption } from "@/app/(protegido)/inventario/types";

export function LocaisDialog({ locais, trigger }: { locais: LocalOption[]; trigger: ReactElement }) {
  const acesso = useAcesso();
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lista, setLista] = useState(locais);
  const [novoLocal, setNovoLocal] = useState("");
  const [pending, startTransition] = useTransition();

  function handleAdd() {
    const nome = novoLocal.trim();
    if (!nome) return;
    startTransition(async () => {
      try {
        const criado = await createLocalAction(nome);
        setLista((prev) => (prev.some((l) => l.id === criado.id) ? prev : [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome))));
        setNovoLocal("");
      } catch {
        toast.error("Não foi possível adicionar o local.");
      }
    });
  }

  async function handleRename(id: string, nome: string): Promise<{ ok: true } | { erro: string }> {
    try {
      await renameLocalAction(id, nome);
      setLista((prev) => prev.map((l) => l.id === id ? { ...l, nome } : l));
      return { ok: true };
    } catch { return { erro: "Não foi possível renomear o local. Confira o nome e seu acesso." }; }
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
      const result = await deleteLocalAction(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setLista((prev) => prev.filter((l) => l.id !== id));
        setRemoverId(null);
        toast.success("Local excluído.");
      }
      } catch { toast.error("Não foi possível excluir o local."); }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="size-5" />
            Locais de estoque
          </DialogTitle>
          <DialogDescription>Gerencie os locais onde o estoque é controlado (cozinha, depósito, câmara fria...).</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhum local cadastrado ainda.</p>}
          {lista.map((local) => (
            <div key={local.id} className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 basis-full"><EdicaoInline nome={`Nome de ${local.nome}`} valor={local.nome} disabled={pending} motivoBloqueio={!acesso.pode("inventario", "editar") ? "Seu acesso não permite editar locais." : undefined} validar={valor => valor.trim() ? null : "Informe o nome do local."} salvar={valor => handleRename(local.id, valor.trim())} /></div>
              <GrupoAcoes nome={`Ações de ${local.nome}`} className="ml-auto flex-wrap">
                {removerId === local.id ? <><Button variant="destructive" size="sm" disabled={pending} onClick={() => handleDelete(local.id)}>Confirmar exclusão</Button><Button variant="outline" size="sm" disabled={pending} onClick={() => setRemoverId(null)}>Cancelar</Button></> : <Button type="button" variant="excluir" aria-label={`Excluir ${local.nome}`} disabled={pending || !acesso.pode("inventario", "excluir")} onClick={() => setRemoverId(local.id)}><Trash2 /></Button>}
              </GrupoAcoes>
            </div>
          ))}
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Input
            value={novoLocal}
            onChange={(e) => setNovoLocal(e.target.value)}
            aria-label="Nome do novo local"
            placeholder="Novo local..."
            disabled={pending || !acesso.pode("inventario", "adicionar")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button type="button" variant="outline" size="icon" aria-label="Adicionar local" onClick={handleAdd} disabled={pending || !novoLocal.trim() || !acesso.pode("inventario", "adicionar")}>
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
