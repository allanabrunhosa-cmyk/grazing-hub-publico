"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { iniciarContagemAction, type EscopoContagem } from "@/app/(protegido)/inventario/contagem/actions";
import type { CategoriaOption, InsumoParaContagemOption, LocalOption } from "@/app/(protegido)/inventario/types";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";
import { CadastroRapidoInsumoDialog } from "@/components/cadastro-rapido-insumo-dialog";

type TipoEscopo = "TODOS" | "ITENS" | "CATEGORIA";

export function NovaContagemDialog({
  locais,
  categorias,
  insumos,
  podeCadastrarInsumo,
}: {
  locais: LocalOption[];
  categorias: CategoriaOption[];
  insumos: InsumoParaContagemOption[];
  podeCadastrarInsumo?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [localId, setLocalId] = useState<string | null>(null);
  const [tipoEscopo, setTipoEscopo] = useState<TipoEscopo>("TODOS");
  const [insumoIds, setInsumoIds] = useState<Set<string>>(new Set());
  const [categoriaIds, setCategoriaIds] = useState<Set<string>>(new Set());
  const [insumosCriados, setInsumosCriados] = useState<InsumoCriado[]>([]);
  const [pending, startTransition] = useTransition();

  const insumosDisponiveis: InsumoParaContagemOption[] = useMemo(
    () => [...insumos, ...insumosCriados.filter((criado) => !insumos.some((insumo) => insumo.id === criado.id))],
    [insumos, insumosCriados]
  );
  const localSelecionado = locais.find((l) => l.id === localId) ?? null;
  function resetarEscopo(novoTipo: TipoEscopo) {
    setTipoEscopo(novoTipo);
    setInsumoIds(new Set());
    setCategoriaIds(new Set());
  }

  function handleIniciar() {
    const escopo: EscopoContagem =
      tipoEscopo === "ITENS"
        ? { tipo: "ITENS", insumoIds: [...insumoIds] }
        : tipoEscopo === "CATEGORIA"
          ? { tipo: "CATEGORIA", categoriaIds: [...categoriaIds] }
          : { tipo: "TODOS" };

    startTransition(async () => {
      const resultado = await iniciarContagemAction(localId ?? "", escopo);
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      setOpen(false);
      router.push(`/inventario/contagem/${resultado.contagemId}`);
    });
  }

  const podeIniciar =
    !!localId && (tipoEscopo === "TODOS" || (tipoEscopo === "ITENS" && insumoIds.size > 0) || (tipoEscopo === "CATEGORIA" && categoriaIds.size > 0));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setLocalId(null);
          resetarEscopo("TODOS");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-1.5">
            <ClipboardList className="size-4" />
            Nova contagem
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova contagem de estoque</DialogTitle>
          <DialogDescription>Escolha o local e quais insumos entram na contagem, com o campo em branco — o saldo do sistema só aparece depois de finalizar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Local de estoque</Label>
          <Select value={localId ?? ""} onValueChange={(v) => setLocalId(v)} disabled={pending}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione">{() => localSelecionado?.nome ?? "Selecione"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {locais.map((local) => (
                <SelectItem key={local.id} value={local.id}>
                  {local.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Itens da contagem</Label>
          <div className="flex flex-wrap gap-1.5">
            <Button type="button" size="sm" aria-pressed={tipoEscopo === "TODOS"} variant={tipoEscopo === "TODOS" ? "default" : "outline"} onClick={() => resetarEscopo("TODOS")} disabled={pending}>
              Todos os insumos
            </Button>
            <Button type="button" size="sm" aria-pressed={tipoEscopo === "CATEGORIA"} variant={tipoEscopo === "CATEGORIA" ? "default" : "outline"} onClick={() => resetarEscopo("CATEGORIA")} disabled={pending}>
              Por categoria
            </Button>
            <Button type="button" size="sm" aria-pressed={tipoEscopo === "ITENS"} variant={tipoEscopo === "ITENS" ? "default" : "outline"} onClick={() => resetarEscopo("ITENS")} disabled={pending}>
              Itens avulsos
            </Button>
          </div>

          {tipoEscopo === "CATEGORIA" && <MultiselecaoCombobox
            opcoes={categorias}
            selecionadosIds={[...categoriaIds]}
            aoMudar={(ids) => setCategoriaIds(new Set(ids))}
            placeholder="Buscar categoria..."
            ariaLabel="Categorias da contagem"
            vazio="Nenhuma categoria cadastrada."
            disabled={pending}
          />}

          {tipoEscopo === "ITENS" && (
            <div className="space-y-2">
              <MultiselecaoCombobox
                opcoes={insumosDisponiveis.map(insumo=>({...insumo,descricao:null}))}
                selecionadosIds={[...insumoIds]}
                aoMudar={(ids) => setInsumoIds(new Set(ids))}
                placeholder="Buscar insumo..."
                ariaLabel="Insumos da contagem"
                vazio="Nenhum insumo encontrado."
                disabled={pending}
              />
              {podeCadastrarInsumo && !pending && <CadastroRapidoInsumoDialog aoSalvar={(criado) => {
                setInsumosCriados((atuais) => [...atuais.filter((item) => item.id !== criado.id), criado]);
                setInsumoIds((atuais) => new Set([...atuais, criado.id]));
              }} />}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
          <Button type="button" disabled={pending || !podeIniciar} onClick={handleIniciar}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Iniciar contagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
