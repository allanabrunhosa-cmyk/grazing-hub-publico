"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, PackageCheck, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InsumoComboboxPorFornecedor } from "@/app/(protegido)/compras/insumo-combobox-por-fornecedor";
import { confirmarRecebimentoAction } from "@/app/(protegido)/compras/actions";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import { formatarNumeroPedido, type InsumoComFornecedorOption, type PedidoRow } from "@/app/(protegido)/compras/types";
import { descreverConversao } from "@/lib/insumos/conversoes";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";
import { IdentificacaoInsumo } from "@/components/identificacao-insumo";

type Linha = {
  referenciaConversao?: string;
  chave: string;
  pedidoItemId: string | null;
  insumoId: string | null;
  insumoNome: string;
  insumoEspecificacao?: string | null;
  unidadeAbrev: string;
  quantidadeOrdenada: number | null;
  quantidadeRecebida: string;
  lote: string;
  validade: string;
  qualidadeOk: boolean;
};

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function novaChave() {
  return Math.random().toString(36).slice(2);
}

export function RecebimentoDialog({
  pedido,
  insumos,
  open,
  onOpenChange,
  podeCadastrarInsumo,
}: {
  pedido: PedidoRow;
  insumos: InsumoComFornecedorOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podeCadastrarInsumo?: boolean;
}) {
  const [responsavel, setResponsavel] = useState("");
  const [dataRecebimento, setDataRecebimento] = useState(hoje());
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    pedido.itens
      .filter((i) => i.quantidade > 0)
      .map((i) => ({
        chave: novaChave(),
        pedidoItemId: i.id,
        insumoId: i.insumoId,
        insumoNome: i.insumoNome,
        insumoEspecificacao: i.insumoEspecificacao,
        unidadeAbrev: unidadeMedidaAbreviada[i.unidadeCompra],
        referenciaConversao: i.fatorConversao != null && i.unidadePrincipal && i.unidadeCompra !== i.unidadePrincipal ? descreverConversao({ unidade: i.unidadeCompra, fator: i.fatorConversao }, i.unidadePrincipal) : undefined,
        quantidadeOrdenada: i.quantidade,
        quantidadeRecebida: String(i.quantidade),
        lote: "",
        validade: "",
        qualidadeOk: true,
      }))
  );
  const [insumosCriados, setInsumosCriados] = useState<InsumoCriado[]>([]);
  const [pending, startTransition] = useTransition();
  const insumosDisponiveis: InsumoComFornecedorOption[] = [...insumos, ...insumosCriados.filter((criado) => !insumos.some((insumo) => insumo.id === criado.id))];

  function atualizarLinha(chave: string, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));
  }

  function adicionarItemExtra() {
    setLinhas((prev) => [
      {
        chave: novaChave(),
        pedidoItemId: null,
        insumoId: null,
        insumoNome: "",
        insumoEspecificacao: null,
        unidadeAbrev: "",
        quantidadeOrdenada: null,
        quantidadeRecebida: "",
        lote: "",
        validade: "",
        qualidadeOk: true,
      },
      ...prev,
    ]);
  }

  function handleSubmit() {
    const itens = linhas
      .filter((l) => l.pedidoItemId || l.insumoId)
      .map((l) => ({
        pedidoItemId: l.pedidoItemId,
        insumoId: l.insumoId,
        quantidadeRecebida: Number.parseFloat(l.quantidadeRecebida.replace(",", ".") || "0"),
        lote: l.lote.trim() || null,
        validade: l.validade || null,
        qualidadeOk: l.qualidadeOk,
      }));

    startTransition(async () => {
      const resultado = await confirmarRecebimentoAction({
        pedidoId: pedido.id,
        responsavel,
        dataRecebimento,
        itens,
      });
      if ("erro" in resultado) {
        toast.error(resultado.erro);
        return;
      }
      toast.success("Recebimento registrado.");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-5" />
            Confirmar recebimento — {formatarNumeroPedido(pedido.numero)}
          </DialogTitle>
          <DialogDescription>Confira o que chegou. A quantidade recebida já vem preenchida com o que foi pedido — ajuste se for diferente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {pedido.recebimentos.some(r => r.reabertoEm) && <p className="rounded-xl bg-warning-bg p-3 text-sm text-warning">Pedido reaberto: confira novamente as quantidades totais que chegaram. As conferências anteriores permanecem no histórico.</p>}
          <div className="space-y-2">
            {!pedido.usoConsumo && <Button type="button" data-dialogo-altera variant="outline" size="sm" className="gap-1.5" onClick={adicionarItemExtra} disabled={pending}>
            <Plus className="size-4" />
            Adicionar insumo (fora do pedido)
          </Button>}
    {linhas.map((linha) => (
              <div key={linha.chave} className="space-y-1.5 rounded-lg border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  {linha.pedidoItemId ? (
                    <div className="text-sm">
                      <IdentificacaoInsumo nome={linha.insumoNome} especificacao={linha.insumoEspecificacao} nomeClassName="font-medium" />
                      {linha.referenciaConversao && <span className="block text-xs font-normal text-muted-foreground">{linha.referenciaConversao}</span>}
                      {linha.quantidadeOrdenada != null && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (pedido: {linha.quantidadeOrdenada} {linha.unidadeAbrev})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1">
                      <InsumoComboboxPorFornecedor
                        insumos={insumosDisponiveis}
                        fornecedorId={pedido.fornecedorId}
                        fornecedorAvulso={!!pedido.fornecedorAvulso}
                        value={linha.insumoId}
                        onChange={(id) => atualizarLinha(linha.chave, { insumoId: id })}
                        disabled={pending}
                        podeCadastrar={podeCadastrarInsumo}
                        aoCriar={(criado) => setInsumosCriados((atuais) => [...atuais.filter((item) => item.id !== criado.id), criado])}
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={linha.quantidadeRecebida}
                    onChange={(e) => atualizarLinha(linha.chave, { quantidadeRecebida: e.target.value })}
                    placeholder="Qtd. recebida"
                    inputMode="decimal"
                    className="w-32"
                    disabled={pending}
                  />
                  <Input
                    value={linha.lote}
                    onChange={(e) => atualizarLinha(linha.chave, { lote: e.target.value })}
                    placeholder="Lote (opc.)"
                    className="w-28"
                    disabled={pending}
                  />
                  <Input
                    type="date"
                    value={linha.validade}
                    onChange={(e) => atualizarLinha(linha.chave, { validade: e.target.value })}
                    className="w-40"
                    disabled={pending}
                  />
                  <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Checkbox
                      checked={linha.qualidadeOk}
                      onCheckedChange={(v) => atualizarLinha(linha.chave, { qualidadeOk: v === true })}
                      disabled={pending}
                    />
                    Qualidade OK
                  </label>
                </div>
              </div>
            ))}
          </div>



          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Responsável pelo recebimento</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome de quem recebeu" disabled={pending} />
            </div>
            <div className="space-y-1.5">
              <Label>Data do recebimento</Label>
              <Input type="date" value={dataRecebimento} onChange={(e) => setDataRecebimento(e.target.value)} disabled={pending} />
            </div>
          </div>

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {pedido.usoConsumo ? "Isso registra a chegada dos itens de uso e consumo, sem movimentar o estoque." : "Isso registra a chegada do pedido. A entrada formal no estoque é feita separadamente em Inventário › Entrada de insumo."}
          </p>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Confirmar recebimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
