"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ShoppingCart, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
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
} from "@/components/ui/dialog";
import { FornecedorCombobox } from "@/app/(protegido)/compras/fornecedor-combobox";
import { InsumoComboboxPorFornecedor } from "@/app/(protegido)/compras/insumo-combobox-por-fornecedor";
import { salvarPedidoAction } from "@/app/(protegido)/compras/actions";
import { unidadeMedidaLabels, unidadeMedidaAbreviada } from "@/lib/labels";
import { UnidadeMedida } from "@/generated/prisma/browser";
import type { FornecedorOption, InsumoComFornecedorOption, PedidoRow } from "@/app/(protegido)/compras/types";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";
import { fatorDaUnidade, descreverConversao, descreverEquivalencia } from "@/lib/insumos/conversoes";

type Linha = {
  conversaoOriginal?: { pedidoItemId: string; fator: number; unidadePrincipal: UnidadeMedida };
  chave: string;
  insumoId: string | null;
  descricao: string;
  quantidade: string;
  unidadeCompra: UnidadeMedida;
  precoUnitario: string;
};

export const CHAVE_RASCUNHO_NOVO_PEDIDO = "grazing-hub:compras:novo-pedido:v1";

type RascunhoNovoPedido = {
  versao: 1;
  usoConsumo: boolean;
  avulso: boolean;
  fornecedorAvulso: string;
  fornecedorId: string | null;
  previsaoEntrega: string;
  observacoes: string;
  linhas: Array<Omit<Linha, "chave" | "conversaoOriginal">>;
};

function novaChave() {
  return Math.random().toString(36).slice(2);
}

function linhaVazia(): Linha {
  return { chave: novaChave(), insumoId: null, descricao: "", quantidade: "", unidadeCompra: UnidadeMedida.UN, precoUnitario: "" };
}

function lerRascunhoNovoPedido(insumos: InsumoComFornecedorOption[]): (RascunhoNovoPedido & { linhas: Linha[] }) | null {
  if (typeof window === "undefined") return null;
  try {
    const salvo = sessionStorage.getItem(CHAVE_RASCUNHO_NOVO_PEDIDO);
    if (!salvo) return null;
    const rascunho = JSON.parse(salvo) as Partial<RascunhoNovoPedido>;
    if (rascunho.versao !== 1 || !Array.isArray(rascunho.linhas)) return null;

    const unidades = new Set<string>(Object.values(UnidadeMedida));
    const idsInsumos = new Set(insumos.map((insumo) => insumo.id));
    const linhas = rascunho.linhas.flatMap((linha) => {
      if (!linha || typeof linha !== "object" || !unidades.has(linha.unidadeCompra)) return [];
      const insumoId = typeof linha.insumoId === "string" && idsInsumos.has(linha.insumoId) ? linha.insumoId : null;
      return [{
        chave: novaChave(),
        insumoId,
        descricao: typeof linha.descricao === "string" ? linha.descricao : "",
        quantidade: typeof linha.quantidade === "string" ? linha.quantidade : "",
        unidadeCompra: linha.unidadeCompra as UnidadeMedida,
        precoUnitario: typeof linha.precoUnitario === "string" ? linha.precoUnitario : "",
      }];
    });

    return {
      versao: 1,
      usoConsumo: rascunho.usoConsumo === true,
      avulso: rascunho.avulso === true,
      fornecedorAvulso: typeof rascunho.fornecedorAvulso === "string" ? rascunho.fornecedorAvulso : "",
      fornecedorId: typeof rascunho.fornecedorId === "string" ? rascunho.fornecedorId : null,
      previsaoEntrega: typeof rascunho.previsaoEntrega === "string" ? rascunho.previsaoEntrega : "",
      observacoes: typeof rascunho.observacoes === "string" ? rascunho.observacoes : "",
      linhas: linhas.length > 0 ? linhas : [linhaVazia()],
    };
  } catch {
    try {
      sessionStorage.removeItem(CHAVE_RASCUNHO_NOVO_PEDIDO);
    } catch {
      // O formulário segue vazio se o navegador bloquear o armazenamento.
    }
    return null;
  }
}

function paraDataInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

function sugerirPreco(
  insumoId: string,
  fornecedorId: string,
  insumos: InsumoComFornecedorOption[],
  cotacoes: { insumoId: string; fornecedorId: string; precoUnitario: number }[]
): string {
  const cotacao = cotacoes.find((c) => c.insumoId === insumoId && c.fornecedorId === fornecedorId);
  if (cotacao) return cotacao.precoUnitario.toFixed(2);
  const insumo = insumos.find((i) => i.id === insumoId);
  if (insumo?.custoMedio !== undefined && insumo.custoMedio > 0) return insumo.custoMedio.toFixed(2);
  return "";
}

export function PedidoDialog({
  fornecedores,
  insumos,
  cotacoes,
  pedido,
  previsaoEntregaInicial,
  open,
  onOpenChange,
  podeCadastrarFornecedor,
  podeCadastrarInsumo,
}: {
  fornecedores: FornecedorOption[];
  insumos: InsumoComFornecedorOption[];
  cotacoes: { insumoId: string; fornecedorId: string; precoUnitario: number }[];
  pedido?: PedidoRow;
  previsaoEntregaInicial?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  podeCadastrarFornecedor?: boolean;
  podeCadastrarInsumo?: boolean;
}) {
  const ehEdicao = pedido != null;
  const [rascunhoInicial] = useState(() => ehEdicao ? null : lerRascunhoNovoPedido(insumos));
  const [usoConsumo, setUsoConsumo] = useState(pedido?.usoConsumo ?? rascunhoInicial?.usoConsumo ?? false);
  const [avulso, setAvulso] = useState(!!pedido?.fornecedorAvulso || (rascunhoInicial?.avulso ?? false));
  const [fornecedorAvulso, setFornecedorAvulso] = useState(pedido?.fornecedorAvulso ?? rascunhoInicial?.fornecedorAvulso ?? "");
  const [fornecedorId, setFornecedorId] = useState<string | null>(pedido?.fornecedorId ?? rascunhoInicial?.fornecedorId ?? null);
  const [previsaoEntrega, setPrevisaoEntrega] = useState(pedido ? paraDataInput(pedido.previsaoEntrega) : rascunhoInicial?.previsaoEntrega ?? previsaoEntregaInicial ?? "");
  const [observacoes, setObservacoes] = useState(pedido?.observacoes ?? rascunhoInicial?.observacoes ?? "");
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    pedido && pedido.itens.length > 0
      ? pedido.itens
          .filter((i) => i.quantidade > 0)
          .map((i) => ({
            chave: novaChave(),
            insumoId: i.insumoId,
            descricao: pedido.usoConsumo ? i.insumoNome : "",
            quantidade: String(i.quantidade),
            unidadeCompra: i.unidadeCompra,
            conversaoOriginal: i.fatorConversao != null && i.unidadePrincipal ? { pedidoItemId: i.id, fator: i.fatorConversao, unidadePrincipal: i.unidadePrincipal } : undefined,
            precoUnitario: i.precoUnitario != null ? i.precoUnitario.toFixed(2) : "",
          }))
      : rascunhoInicial?.linhas ?? [linhaVazia()]
  );
  const [insumosCriados, setInsumosCriados] = useState<InsumoCriado[]>([]);
  const [erroEnvio, setErroEnvio] = useState("");
  const [rascunhoRecuperado, setRascunhoRecuperado] = useState(rascunhoInicial != null);
  const [pending, startTransition] = useTransition();
  const insumosDisponiveis: InsumoComFornecedorOption[] = [...insumos, ...insumosCriados.filter((criado) => !insumos.some((insumo) => insumo.id === criado.id))];

  function removerRascunho() {
    if (ehEdicao) return;
    try {
      sessionStorage.removeItem(CHAVE_RASCUNHO_NOVO_PEDIDO);
    } catch {
      // O armazenamento do navegador pode estar indisponível em modo privado.
    }
  }

  function salvarRascunho() {
    if (ehEdicao) return;
    const rascunho: RascunhoNovoPedido = {
      versao: 1,
      usoConsumo,
      avulso,
      fornecedorAvulso,
      fornecedorId,
      previsaoEntrega,
      observacoes,
      linhas: linhas.map(({ insumoId, descricao, quantidade, unidadeCompra, precoUnitario }) => ({
        insumoId,
        descricao,
        quantidade,
        unidadeCompra,
        precoUnitario,
      })),
    };
    try {
      sessionStorage.setItem(CHAVE_RASCUNHO_NOVO_PEDIDO, JSON.stringify(rascunho));
    } catch {
      // O envio ainda pode continuar mesmo se o navegador bloquear o armazenamento.
    }
  }

  function resetar() {
    removerRascunho();
    setUsoConsumo(false);
    setAvulso(false);
    setFornecedorAvulso("");
    setFornecedorId(null);
    setPrevisaoEntrega("");
    setObservacoes("");
    setLinhas([linhaVazia()]);
    setErroEnvio("");
    setRascunhoRecuperado(false);
  }

  function handleFornecedorChange(novoId: string | null) {
    if (!usoConsumo) {
      const restantes = linhas.filter((l) => {
        if (!l.insumoId) return true;
        const insumo = insumosDisponiveis.find((i) => i.id === l.insumoId);
        return novoId != null && (insumo?.fornecedorIds.includes(novoId) ?? false);
      });
      if (restantes.length !== linhas.length) {
        toast.warning("Alguns itens foram removidos por não serem do novo fornecedor.");
      }
      setLinhas(restantes.length > 0 ? restantes : [linhaVazia()]);
    }
    setFornecedorId(novoId);
  }

  function atualizarLinha(chave: string, patch: Partial<Linha>) {
    setLinhas((prev) => prev.map((l) => (l.chave === chave ? { ...l, ...patch } : l)));
  }

  function selecionarInsumo(chave: string, insumoId: string | null) {
    const precoSugerido = insumoId && (avulso || fornecedorId) ? sugerirPreco(insumoId, avulso ? "" : fornecedorId!, insumosDisponiveis, cotacoes) : "";
    const insumo = insumosDisponiveis.find((i) => i.id === insumoId);
    atualizarLinha(chave, {
      insumoId,
      conversaoOriginal: undefined,
      precoUnitario: precoSugerido,
      // pré-preenche com a unidade de estoque do insumo — o usuário troca se comprar em outra (ex: caixa)
      unidadeCompra: insumo?.unidade ?? UnidadeMedida.UN,
    });
  }

  function adicionarLinha() {
    setLinhas((prev) => [...prev, linhaVazia()]);
  }

  function trocarUnidade(linha: Linha, unidadeCompra: UnidadeMedida) {
    if (unidadeCompra === linha.unidadeCompra) return;
    const insumo = !usoConsumo ? insumosDisponiveis.find((item) => item.id === linha.insumoId) : undefined;
    const fatorAnterior = linha.conversaoOriginal?.fator ?? (insumo ? fatorDaUnidade(linha.unidadeCompra, insumo.unidade, insumo.conversoes) : null);
    const fatorNovo = insumo ? fatorDaUnidade(unidadeCompra, insumo.unidade, insumo.conversoes) : null;
    const preco = Number(linha.precoUnitario);
    atualizarLinha(linha.chave, {
      unidadeCompra,
      conversaoOriginal: undefined,
      precoUnitario: linha.precoUnitario && fatorAnterior && fatorNovo && Number.isFinite(preco) ? (preco / fatorAnterior * fatorNovo).toFixed(2) : "",
    });
  }

  function removerLinha(chave: string) {
    setLinhas((prev) => (prev.length > 1 ? prev.filter((l) => l.chave !== chave) : prev));
  }

  function handleSubmit() {
    setErroEnvio("");
    const itens = linhas
      .map((l) => {
        const insumo = !usoConsumo ? insumosDisponiveis.find((item) => item.id === l.insumoId) : undefined;
        const fator = l.conversaoOriginal?.fator ?? (insumo ? fatorDaUnidade(l.unidadeCompra, insumo.unidade, insumo.conversoes) : null);
        return {
        pedidoItemOriginalId: !usoConsumo ? l.conversaoOriginal?.pedidoItemId : undefined,
        conversao: insumo && fator !== null ? { fator, unidadePrincipal: l.conversaoOriginal?.unidadePrincipal ?? insumo.unidade } : null,
        insumoId: usoConsumo ? null : l.insumoId,
        descricao: l.descricao,
        quantidade: Number.parseFloat(l.quantidade.replace(",", ".")),
        unidadeCompra: l.unidadeCompra,
        precoUnitario: l.precoUnitario.trim() ? Number.parseFloat(l.precoUnitario.replace(",", ".")) : null,
      }; });

    salvarRascunho();
    startTransition(async () => {
      try {
        const resultado = await salvarPedidoAction({
          pedidoId: pedido?.id,
          fornecedorId: avulso ? null : fornecedorId,
          fornecedorAvulso: avulso ? fornecedorAvulso : null,
          usoConsumo,
          previsaoEntrega: previsaoEntrega || null,
          observacoes: observacoes.trim() || null,
          itens,
        });
        if ("erro" in resultado) {
          toast.error(resultado.erro);
          return;
        }
        removerRascunho();
        toast.success(ehEdicao ? "Pedido atualizado." : "Pedido criado.");
        onOpenChange(false);
        if (!ehEdicao) resetar();
      } catch {
        setErroEnvio("O sistema foi atualizado enquanto o pedido era enviado. Seus dados foram preservados. Atualize a página para continuar.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next && !ehEdicao) resetar(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            {ehEdicao ? "Editar pedido" : "Novo pedido de compra"}
          </DialogTitle>
          <DialogDescription>Reúna os itens de um fornecedor e acompanhe a entrega.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de compra</Label>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de compra">
              <Button variant={!usoConsumo ? "default" : "outline"} aria-pressed={!usoConsumo} disabled={pending} onClick={() => setUsoConsumo(false)}>Itens de estoque</Button>
              <Button variant={usoConsumo ? "default" : "outline"} aria-pressed={usoConsumo} disabled={pending} onClick={() => setUsoConsumo(true)}>Uso e consumo</Button>
            </div>
            {usoConsumo && <p className="text-sm text-muted-foreground">Descreva os itens sem cadastrar insumos. Esta compra não movimenta o estoque.</p>}
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={avulso} onCheckedChange={marcado => {
            setAvulso(marcado);
            if (!marcado) handleFornecedorChange(fornecedorId);
          }} disabled={pending} />Fornecedor não cadastrado</label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fornecedor</Label>
              {avulso ? <Input aria-label="Nome do fornecedor avulso" placeholder="Nome do fornecedor" value={fornecedorAvulso} onChange={e => setFornecedorAvulso(e.target.value)} maxLength={200} disabled={pending} /> : <FornecedorCombobox fornecedores={fornecedores} value={fornecedorId} onChange={handleFornecedorChange} disabled={pending} podeCadastrar={podeCadastrarFornecedor} />}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pedido-data-entrega">Data de entrega</Label>
              <Input id="pedido-data-entrega" type="date" value={previsaoEntrega} onChange={(e) => setPrevisaoEntrega(e.target.value)} disabled={pending} />
            </div>
          </div>
          {avulso && <p className="text-sm text-muted-foreground">O nome ficará apenas neste pedido, sem criar cadastro em Fornecedores.</p>}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens do pedido</Label>
              <Button type="button" data-dialogo-altera variant="outline" size="sm" className="gap-1.5" onClick={adicionarLinha} disabled={pending}>
                <Plus className="size-4" />
                Adicionar item
              </Button>
            </div>
            <div className="space-y-2">
              {linhas.map((linha) => {
                const insumo = !usoConsumo ? insumosDisponiveis.find((item) => item.id === linha.insumoId) : undefined;
                const fator = linha.conversaoOriginal?.fator ?? (insumo ? fatorDaUnidade(linha.unidadeCompra, insumo.unidade, insumo.conversoes) : null);
                const unidadePrincipal = linha.conversaoOriginal?.unidadePrincipal ?? insumo?.unidade;
                const quantidade = Number(linha.quantidade.replace(",", "."));
                return (
                  <div key={linha.chave} className="grid grid-cols-12 items-center gap-2 rounded-xl border p-3">
                    <div className="col-span-12 min-w-0 sm:col-span-5">
                      {usoConsumo ? <Input aria-label="Descrição do item" placeholder="Ex.: material de escritório" maxLength={300} value={linha.descricao} onChange={e => atualizarLinha(linha.chave, { descricao: e.target.value })} disabled={pending} /> : <InsumoComboboxPorFornecedor
                        insumos={insumosDisponiveis}
                        fornecedorId={fornecedorId}
                        fornecedorAvulso={avulso}
                        value={linha.insumoId}
                        onChange={(id) => selecionarInsumo(linha.chave, id)}
                        disabled={pending}
                        podeCadastrar={podeCadastrarInsumo}
                        aoCriar={(criado) => setInsumosCriados((atuais) => [...atuais.filter((item) => item.id !== criado.id), criado])}
                      />}
                    </div>
                    <Input
                      value={linha.quantidade}
                      onChange={(e) => atualizarLinha(linha.chave, { quantidade: e.target.value })}
                      aria-label="Quantidade"
                      placeholder="Qtd"
                      inputMode="decimal"
                      className="col-span-3 h-10 min-w-0 sm:col-span-2"
                      disabled={pending}
                    />
                    <Select
                      value={linha.unidadeCompra}
                      onValueChange={(v) => v && trocarUnidade(linha, v as UnidadeMedida)}
                      disabled={pending}
                    >
                      <SelectTrigger aria-label="Unidade de compra" className="col-span-3 w-full min-w-0 sm:col-span-2">
                        <SelectValue placeholder="Unidade">
                          {(value: string) => unidadeMedidaAbreviada[value as UnidadeMedida] ?? value}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(UnidadeMedida).map((unidade) => (
                          <SelectItem key={unidade} value={unidade}>
                            {unidadeMedidaLabels[unidade]}{insumo?.conversoes?.find((conversao) => conversao.unidade === unidade) ? ` · ${descreverConversao(insumo.conversoes.find((conversao) => conversao.unidade === unidade)!, insumo.unidade)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <CurrencyInput
                      value={linha.precoUnitario}
                      onValueChange={(valor) => atualizarLinha(linha.chave, { precoUnitario: valor })}
                      aria-label="Preço unitário"
                      placeholder={`0,00/${unidadeMedidaAbreviada[linha.unidadeCompra]}`}
                      containerClassName="col-span-4 sm:col-span-2"
                      className="h-10 min-w-0"
                      disabled={pending}
                    />
                    <Button
                      type="button"
                      data-dialogo-altera
                      variant="excluir"
                      size="icon"
                      className="col-span-2 justify-self-end sm:col-span-1"
                      aria-label="Remover item"
                      onClick={() => removerLinha(linha.chave)}
                      disabled={pending || linhas.length === 1}
                    >
                      <X className="size-4" />
                    </Button>
                    {insumo && <p className="col-span-12 text-xs text-muted-foreground">
                      {fator !== null && unidadePrincipal && linha.unidadeCompra !== unidadePrincipal ? <>{linha.conversaoOriginal ? "Conversão do pedido: " : ""}{descreverConversao({ unidade: linha.unidadeCompra, fator }, unidadePrincipal)}{linha.quantidade.trim() && Number.isFinite(quantidade) && quantidade > 0 ? ` · Total: ${descreverEquivalencia(quantidade, fator, unidadePrincipal)}` : ""}. </> : linha.unidadeCompra !== insumo.unidade ? "Sem fator cadastrado para esta unidade. " : ""}
                      Preço por {unidadeMedidaAbreviada[linha.unidadeCompra]}.
                    </p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} disabled={pending} />
          </div>

          {rascunhoRecuperado && !erroEnvio && (
            <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              O pedido que estava sendo preenchido foi recuperado.
            </p>
          )}
          {erroEnvio && (
            <div role="alert" className="flex flex-col gap-3 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>{erroEnvio}</p>
              </div>
              <Button type="button" variant="outline" className="shrink-0 border-amber-500 bg-white" onClick={() => window.location.reload()}>
                <RefreshCw className="size-4" />
                Atualizar página
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {ehEdicao ? "Salvar" : "Criar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
