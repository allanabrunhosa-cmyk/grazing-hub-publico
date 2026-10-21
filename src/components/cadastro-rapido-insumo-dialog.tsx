"use client";

import { useState, useTransition, type ReactElement } from "react";
import { Loader2, PackagePlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { saveInsumoAction } from "@/app/(protegido)/insumos/actions";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnidadeMedida } from "@/generated/prisma/browser";
import { unidadeMedidaLabels } from "@/lib/labels";
import { aplicarCaixaAltaNoCampo } from "@/lib/caixa-alta";

export function CadastroRapidoInsumoDialog({
  aoSalvar,
  fornecedorId,
  trigger,
  exibirEspecificacao = true,
}: {
  aoSalvar: (insumo: InsumoCriado) => void;
  fornecedorId?: string | null;
  trigger?: ReactElement;
  exibirEspecificacao?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [unidade, setUnidade] = useState<UnidadeMedida>(UnidadeMedida.UN);
  const [erro, setErro] = useState("");
  const [pendente, iniciarTransicao] = useTransition();

  function salvar(formData: FormData) {
    formData.set("tipo", "INSUMO");
    formData.set("unidade", unidade);
    formData.set("ativo", "on");
    if (fornecedorId) {
      formData.set("fornecedorPrincipalId", fornecedorId);
      formData.append("fornecedorIds", fornecedorId);
    }
    iniciarTransicao(async () => {
      const resultado = await saveInsumoAction({ error: null }, formData);
      if (resultado.error || !resultado.insumo) {
        const mensagem = resultado.error ?? "O insumo foi salvo, mas não foi possível selecioná-lo. Atualize a página.";
        setErro(mensagem);
        toast.error(mensagem);
        return;
      }
      toast.success("Insumo cadastrado e selecionado.");
      aoSalvar(resultado.insumo);
      setAberto(false);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(valor) => { if (!pendente) { setAberto(valor); setErro(""); } }}>
      <DialogTrigger render={trigger ?? (
        <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <Plus className="size-3.5" />
          Cadastrar novo insumo
        </button>
      )} />
      <DialogContent className="sm:max-w-md" showCloseButton={!pendente}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><PackagePlus className="size-5" />Novo insumo</DialogTitle>
          <DialogDescription>Cadastre os dados essenciais agora. Os demais detalhes podem ser completados depois em Insumos.</DialogDescription>
        </DialogHeader>
        <form action={salvar} onSubmit={(evento) => evento.stopPropagation()} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome-insumo-rapido">Nome *</Label>
            <Input id="nome-insumo-rapido" name="nome" required maxLength={200} disabled={pendente} autoCapitalize="characters" onInput={(evento) => aplicarCaixaAltaNoCampo(evento.currentTarget)} />
          </div>
          {exibirEspecificacao && <div className="space-y-1.5">
            <Label htmlFor="especificacao-insumo-rapido">Especificação</Label>
            <Input id="especificacao-insumo-rapido" name="especificacao" maxLength={300} disabled={pendente} placeholder="Complemento exibido abaixo do nome" />
          </div>}
          <div className="space-y-1.5">
            <Label>Unidade principal *</Label>
            <Select value={unidade} onValueChange={(valor) => valor && setUnidade(valor as UnidadeMedida)} disabled={pendente}>
              <SelectTrigger className="w-full" aria-label="Unidade principal do novo insumo">
                <SelectValue>{(valor: string) => unidadeMedidaLabels[valor as UnidadeMedida]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.values(UnidadeMedida).map((opcao) => <SelectItem key={opcao} value={opcao}>{unidadeMedidaLabels[opcao]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {fornecedorId && <p className="text-xs text-muted-foreground">O fornecedor selecionado será vinculado como principal e homologado.</p>}
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pendente} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pendente}>{pendente && <Loader2 className="size-4 animate-spin" />}Cadastrar insumo</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
