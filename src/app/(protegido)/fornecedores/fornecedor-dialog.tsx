"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "sonner";
import { Check, Loader2, Truck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { Label } from "@/components/ui/label";
import { CampoStatusAtivo } from "@/components/status-ativo";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";
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
import {
  saveFornecedorAction,
  createCanalPedidoAction,
  createFormaPagamentoAction,
} from "@/app/(protegido)/fornecedores/actions";
import { CreatableCheckboxList } from "@/app/(protegido)/fornecedores/creatable-checkbox-list";
import type { FornecedorRow, SimpleOption } from "@/app/(protegido)/fornecedores/types";
import { FormularioBeneficiario } from "@/app/(protegido)/fornecedores/beneficiario-dialog";
import { aplicarCaixaAltaNoCampo } from "@/lib/caixa-alta";
import { cn } from "@/lib/utils";

export function FornecedorDialog({
  fornecedor,
  canaisPedidoOptions,
  formasPagamentoOptions,
  trigger,
  tipoInicial = "FORNECEDOR",
  tipoFixo = false,
  aoSalvar,
}: {
  fornecedor?: FornecedorRow;
  canaisPedidoOptions: SimpleOption[];
  formasPagamentoOptions: SimpleOption[];
  trigger: ReactElement;
  tipoInicial?: "FORNECEDOR" | "BENEFICIARIO";
  tipoFixo?: boolean;
  aoSalvar?: (cadastro: { id: string; nome: string; tipo: "FORNECEDOR" | "BENEFICIARIO"; formaPagamentoId?: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tipoNovo, setTipoNovo] = useState<"FORNECEDOR" | "BENEFICIARIO">(tipoInicial);
  const [pending, startTransition] = useTransition();

  function alterarAbertura(aberto: boolean) {
    setOpen(aberto);
    if (!aberto && !fornecedor) setTipoNovo(tipoInicial);
    if (aberto) setError(null);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await saveFornecedorAction({ error: null }, formData);
      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        setError(null);
        toast.success(fornecedor ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
        if (result.fornecedor) aoSalvar?.({ ...result.fornecedor, tipo: "FORNECEDOR" });
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={alterarAbertura}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{fornecedor ? "Editar fornecedor" : tipoFixo ? `Novo ${tipoNovo === "FORNECEDOR" ? "fornecedor" : "beneficiário"}` : "Novo cadastro"}</DialogTitle>
          <DialogDescription>
            {fornecedor
              ? "Dados cadastrais, condições comerciais e canais de compra."
              : tipoFixo
                ? `Preencha os dados do novo ${tipoNovo === "FORNECEDOR" ? "fornecedor" : "beneficiário"} sem sair deste fluxo.`
                : "Escolha o tipo e preencha os dados do novo cadastro."}
          </DialogDescription>
        </DialogHeader>

        {!fornecedor && !tipoFixo && (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tipo de cadastro</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={tipoNovo === "FORNECEDOR"}
                onClick={() => setTipoNovo("FORNECEDOR")}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors",
                  tipoNovo === "FORNECEDOR" ? "border-foreground bg-foreground text-background" : "border-input hover:bg-accent/40"
                )}
              >
                <Truck className="size-5" />
                <div>
                  <div className="text-sm font-medium">Fornecedor</div>
                  <div className={cn("text-xs", tipoNovo === "FORNECEDOR" ? "text-background/70" : "text-muted-foreground")}>
                    Compras, insumos e notas fiscais
                  </div>
                </div>
                {tipoNovo === "FORNECEDOR" && <Check className="absolute top-2 right-2 size-4" />}
              </button>
              <button
                type="button"
                aria-pressed={tipoNovo === "BENEFICIARIO"}
                onClick={() => setTipoNovo("BENEFICIARIO")}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors",
                  tipoNovo === "BENEFICIARIO" ? "border-foreground bg-foreground text-background" : "border-input hover:bg-accent/40"
                )}
              >
                <UserRound className="size-5" />
                <div>
                  <div className="text-sm font-medium">Beneficiário</div>
                  <div className={cn("text-xs", tipoNovo === "BENEFICIARIO" ? "text-background/70" : "text-muted-foreground")}>
                    Pagamentos e lançamentos financeiros
                  </div>
                </div>
                {tipoNovo === "BENEFICIARIO" && <Check className="absolute top-2 right-2 size-4" />}
              </button>
            </div>
          </div>
        )}

        {!fornecedor && tipoNovo === "BENEFICIARIO" ? (
          <FormularioBeneficiario
            key="novo-beneficiario"
            formasPagamentoOptions={formasPagamentoOptions}
            onSaved={(beneficiarioSalvo) => {
              aoSalvar?.({ ...beneficiarioSalvo, tipo: "BENEFICIARIO" });
              setOpen(false);
            }}
          />
        ) : (
        <form action={handleSubmit} onSubmit={(evento) => evento.stopPropagation()} className="space-y-5">
          {fornecedor && <input type="hidden" name="id" value={fornecedor.id} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" name="nome" defaultValue={fornecedor?.nome} required disabled={pending} autoCapitalize="characters" onInput={(evento) => aplicarCaixaAltaNoCampo(evento.currentTarget)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="razaoSocial">Razão social</Label>
              <Input id="razaoSocial" name="razaoSocial" defaultValue={fornecedor?.razaoSocial ?? ""} disabled={pending} autoCapitalize="characters" onInput={(evento) => aplicarCaixaAltaNoCampo(evento.currentTarget)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" name="cnpj" defaultValue={fornecedor?.cnpj ?? ""} disabled={pending} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" defaultValue={fornecedor?.email ?? ""} disabled={pending} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Input id="site" name="site" type="url" defaultValue={fornecedor?.site ?? ""} disabled={pending} placeholder="https://" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contatoNome">Contato</Label>
              <Input id="contatoNome" name="contatoNome" defaultValue={fornecedor?.contatoNome ?? ""} disabled={pending} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" name="telefone" defaultValue={fornecedor?.telefone ?? ""} disabled={pending} />
          </div>

          <div className="space-y-2">
            <Label>Canal para pedido</Label>
            <CreatableCheckboxList
              name="canaisPedido"
              initialOptions={canaisPedidoOptions}
              selectedIds={fornecedor?.canaisPedido.map((c) => c.id) ?? []}
              onCreate={createCanalPedidoAction}
              placeholder="Adicionar novo canal..."
              searchPlaceholder="Buscar canal para pedido..."
              ariaLabel="Canais para pedido"
              disabled={pending}
            />
          </div>

          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <CreatableCheckboxList
              name="formasPagamento"
              initialOptions={formasPagamentoOptions}
              selectedIds={fornecedor?.formasPagamento.map((f) => f.id) ?? []}
              onCreate={createFormaPagamentoAction}
              placeholder="Adicionar nova forma..."
              searchPlaceholder="Buscar forma de pagamento..."
              ariaLabel="Formas de pagamento"
              disabled={pending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prazoPagamentoDias">Prazo de pagamento</Label>
              <InputComSufixo
                id="prazoPagamentoDias"
                name="prazoPagamentoDias"
                type="number"
                min={0}
                defaultValue={fornecedor?.prazoPagamentoDias ?? ""}
                disabled={pending}
                sufixo="dias"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazoEntregaDias">Tempo de entrega</Label>
              <InputComSufixo
                id="prazoEntregaDias"
                name="prazoEntregaDias"
                type="number"
                min={0}
                defaultValue={fornecedor?.prazoEntregaDias ?? ""}
                disabled={pending}
                sufixo="dias"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" name="observacoes" defaultValue={fornecedor?.observacoes ?? ""} disabled={pending} rows={3} />
          </div>

          <CampoStatusAtivo ativoInicial={fornecedor?.ativo ?? true} nome={fornecedor?.nome ?? "novo cadastro"} disabled={pending} />

          {fornecedor && (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Label className="text-muted-foreground">
                Insumos vinculados ({fornecedor.insumosVinculados.length})
              </Label>
              {fornecedor.insumosVinculados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum insumo ativo vinculado a este fornecedor.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {fornecedor.insumosVinculados.map((insumo) => (
                    <Badge key={insumo.id} variant="secondary" className="h-auto py-1.5">
                      <IdentificacaoInsumo nome={insumo.nome} especificacao={insumo.especificacao} especificacaoClassName="text-[10px] text-current/70" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {fornecedor ? "Salvar alterações" : "Cadastrar fornecedor"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
