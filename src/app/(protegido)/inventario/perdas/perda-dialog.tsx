"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { InsumoCombobox } from "@/app/(protegido)/inventario/insumo-combobox";
import { registrarPerdaAction } from "@/app/(protegido)/inventario/perdas/actions";
import { motivoPerdaLabels, unidadeMedidaAbreviada } from "@/lib/labels";
import type { CategoriaPerdaOption, InsumoOption, LocalOption } from "@/app/(protegido)/inventario/types";
import type { MotivoPerda } from "@/generated/prisma/client";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";

const MOTIVOS = Object.keys(motivoPerdaLabels) as MotivoPerda[];

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function PerdaDialog({
  insumos,
  locais,
  responsavelNome,
  insumoIdPreselecionado,
  trigger,
  open: openControlado,
  onOpenChange: onOpenChangeControlado,
  podeCadastrarInsumo,
  categorias,
}: {
  insumos: InsumoOption[];
  locais: LocalOption[];
  responsavelNome?: string;
  insumoIdPreselecionado?: string | null;
  // Sem `trigger`, o diálogo é controlado externamente via `open`/`onOpenChange` — usado
  // pela ação de linha da Posição Atual, onde um DialogTrigger aninhado num item de menu
  // fecharia o menu (e desmontaria o diálogo) antes dele conseguir abrir.
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  podeCadastrarInsumo?: boolean;
  categorias?: CategoriaPerdaOption[];
}) {
  const [openInterno, setOpenInterno] = useState(false);
  const open = openControlado ?? openInterno;
  const setOpen = onOpenChangeControlado ?? setOpenInterno;
  const [insumoId, setInsumoId] = useState<string | null>(insumoIdPreselecionado ?? null);
  const [localId, setLocalId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoPerda>("VALIDADE_VENCIDA");
  const [categoriaId, setCategoriaId] = useState<string>(categorias?.[0]?.id ?? "");
  const [motivoPersonalizado, setMotivoPersonalizado] = useState("");
  const [erro, setErro] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [data, setData] = useState(hoje());
  const [observacao, setObservacao] = useState("");
  const [insumosCriados, setInsumosCriados] = useState<InsumoCriado[]>([]);
  const [pending, startTransition] = useTransition();

  const insumosDisponiveis: InsumoOption[] = [...insumos, ...insumosCriados.filter((criado) => !insumos.some((insumo) => insumo.id === criado.id))];
  const localSelecionado = locais.find((l) => l.id === localId) ?? null;
  const insumoSelecionado = insumosDisponiveis.find((i) => i.id === insumoId) ?? null;
  const usaCategoriasCadastradas = categorias !== undefined;
  const categoriaSelecionada = categorias?.find(categoria => categoria.id === categoriaId && categoria.ativo);
  const motivoSelecionado = categoriaSelecionada?.codigoLegado ?? (categoriaSelecionada ? "OUTRO" : motivo);
  const exigeDescricao = motivoSelecionado === "OUTRO" && (!categoriaSelecionada || categoriaSelecionada.codigoLegado === "OUTRO");

  function resetar() {
    setInsumoId(insumoIdPreselecionado ?? null);
    setLocalId(null);
    setMotivo("VALIDADE_VENCIDA");
    setCategoriaId(categorias?.[0]?.id ?? "");
    setMotivoPersonalizado("");
    setErro("");
    setQuantidade("");
    setData(hoje());
    setObservacao("");
  }

  function handleSubmit() {
    if (pending) return;
    if (usaCategoriasCadastradas && !categoriaSelecionada) { setErro("Selecione uma categoria ativa."); return; }
    if (exigeDescricao && (motivoPersonalizado.trim().length < 3 || motivoPersonalizado.trim().length > 500)) {
      setErro("Descreva o motivo da perda com 3 a 500 caracteres.");
      return;
    }
    setErro("");
    const quantidadeNum = Number(quantidade.trim().replace(",", "."));
    startTransition(async () => {
      try {
        const resultado = await registrarPerdaAction({
          insumoId: insumoId ?? "",
          localId: localId ?? "",
          motivo: motivoSelecionado,
          categoriaPerdaId: categoriaSelecionada?.id,
          motivoPersonalizado: exigeDescricao ? motivoPersonalizado.trim() : null,
          quantidade: quantidadeNum,
          observacao: observacao.trim() || null,
          data,
        });
        if ("erro" in resultado) {
          setErro(resultado.erro);
          return;
        }
        toast.success("Perda registrada.");
        setOpen(false);
        resetar();
      } catch {
        setErro("Não foi possível confirmar o registro. Atualize a página para conferir antes de tentar novamente.");
      }
    });
  }

  const quantidadeNumerica = Number(quantidade.trim().replace(",", "."));
  const valorCalculado = insumoSelecionado?.custoMedio !== undefined && Number.isFinite(quantidadeNumerica) && quantidadeNumerica > 0
    ? quantidadeNumerica * insumoSelecionado.custoMedio
    : null;
  const valorCalculadoTexto = valorCalculado == null
    ? insumoSelecionado?.custoMedio === undefined ? "Custo não disponível para este acesso" : "Selecione o insumo e informe a quantidade"
    : valorCalculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) resetar();
      }}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="size-5" />
            Registrar perda
          </DialogTitle>
          <DialogDescription>Baixa de estoque por validade vencida, quebra, furto ou outro motivo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Insumo</Label>
            <InsumoCombobox insumos={insumosDisponiveis} value={insumoId} onChange={setInsumoId} disabled={pending} podeCadastrar={podeCadastrarInsumo} aoCriar={(criado) => setInsumosCriados((atuais) => [...atuais.filter((atual) => atual.id !== criado.id), criado])} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Local de estoque</Label>
              <Select value={localId ?? ""} onValueChange={(v) => setLocalId(v)} disabled={pending}>
                <SelectTrigger className="w-full" aria-label="Local de estoque">
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
            <div className="space-y-1.5">
              <Label>Categoria da perda</Label>
              <Select value={usaCategoriasCadastradas ? categoriaId : motivo} onValueChange={(v) => { if (v) { if (usaCategoriasCadastradas) setCategoriaId(v); else setMotivo(v as MotivoPerda); } }} disabled={pending}>
                <SelectTrigger className="w-full" aria-label="Categoria da perda">
                  <SelectValue placeholder="Selecione">{(v: string) => usaCategoriasCadastradas ? categorias?.find(categoria => categoria.id === v)?.nome ?? "Selecione" : motivoPerdaLabels[v as MotivoPerda]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {usaCategoriasCadastradas ? categorias?.filter(categoria => categoria.ativo).map(categoria => <SelectItem key={categoria.id} value={categoria.id}>{categoria.nome}</SelectItem>) : MOTIVOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {motivoPerdaLabels[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {exigeDescricao && (
            <div className="space-y-1.5">
              <Label htmlFor="perda-motivo-personalizado">Descreva o motivo</Label>
              <Textarea id="perda-motivo-personalizado" value={motivoPersonalizado} onChange={(evento) => setMotivoPersonalizado(evento.target.value)} required minLength={3} maxLength={500} rows={2} placeholder="Ex.: falha no equipamento de refrigeração" disabled={pending} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <InputComSufixo aria-label="Quantidade" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex.: 0,0875" inputMode="decimal" disabled={pending} sufixo={insumoSelecionado ? unidadeMedidaAbreviada[insumoSelecionado.unidade] : "—"} />
            </div>
            <div className="space-y-1.5">
              <Label>Valor da perda (custo médio)</Label>
              <div aria-live="polite" className="flex min-h-10 items-center rounded-md border bg-muted/40 px-3 text-sm font-semibold tabular-nums">
                {valorCalculadoTexto}
              </div>
              {insumoSelecionado?.custoMedio !== undefined && <p className="text-xs text-muted-foreground">Calculado automaticamente: quantidade × {insumoSelecionado.custoMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/{unidadeMedidaAbreviada[insumoSelecionado.unidade]}.</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perda-data">Data</Label>
            <Input id="perda-data" type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={pending} className="w-40" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="perda-observacao">Observação (opcional)</Label>
            <Textarea id="perda-observacao" value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={2000} rows={2} disabled={pending} />
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Responsável pela documentação</p>
            <p className="break-words font-medium">{responsavelNome || "Usuário conectado"}</p>
            <p className="mt-1 text-xs text-muted-foreground">Registrado automaticamente com o usuário conectado.</p>
          </div>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleSubmit}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Registrar perda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
