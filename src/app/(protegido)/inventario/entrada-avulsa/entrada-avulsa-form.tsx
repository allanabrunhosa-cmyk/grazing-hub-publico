"use client";

import { Fragment, useState, useTransition, useRef, useId } from "react";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Loader2,
  PackagePlus,
  Plus,
  ReceiptText,
  Truck,
} from "lucide-react";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { InputComSufixo } from "@/components/ui/input-com-sufixo";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InsumoCombobox } from "@/app/(protegido)/inventario/insumo-combobox";
import { registrarEntradaAvulsaAction } from "@/app/(protegido)/inventario/entrada-avulsa/actions";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { calcularCompraSemNota } from "@/lib/inventario/entrada-avulsa";
import type { InsumoOption, LocalOption } from "@/app/(protegido)/inventario/types";
import type { ContaBancariaOption, FornecedorOption } from "@/app/(protegido)/financeiro/types";
import { dataCalendarioValida, vencimentoCartao, type CartaoOption } from "@/lib/financeiro/cartoes";
import type { PagamentoNota } from "@/lib/notas-fiscais/pagamentos";
import type { InsumoCriado } from "@/app/(protegido)/insumos/types";
import { FornecedorCombobox } from "@/app/(protegido)/compras/fornecedor-combobox";

type LinhaItem = {
  chave: string;
  insumoId: string | null;
  localId: string | null;
  quantidade: string;
  fatorConversao: string;
  valorProdutos: string;
};

type LinhaCusto = {
  chave: string;
  descricao: string;
  valor: string;
};

let proximaChave = 1;
function chave(prefixo: string) {
  proximaChave += 1;
  return `${prefixo}-${proximaChave}`;
}
function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function paraNumero(valor: string) {
  const numero = Number.parseFloat(valor.replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

function novaLinha(insumoId: string | null, locais: LocalOption[], chaveInicial?: string): LinhaItem {
  return {
    chave: chaveInicial ?? chave("item"),
    insumoId,
    localId: locais.length === 1 ? locais[0].id : null,
    quantidade: "",
    fatorConversao: "1",
    valorProdutos: "",
  };
}

export function EntradaAvulsaForm({
  insumos,
  locais,
  fornecedores,
  contasBancarias,
  cartoes = [],
  insumoIdPreselecionado,
  podeCadastrarFornecedor,
  podeCadastrarInsumo,
}: {
  insumos: InsumoOption[];
  locais: LocalOption[];
  fornecedores: FornecedorOption[];
  contasBancarias: ContaBancariaOption[];
  cartoes?: CartaoOption[];
  insumoIdPreselecionado: string | null;
  podeCadastrarFornecedor?: boolean;
  podeCadastrarInsumo?: boolean;
}) {
  const [tipo, setTipo] = useState<"COMPRA_SIMPLES" | "OUTRO_MOTIVO">("COMPRA_SIMPLES");
  const idFormulario = useId();
  const [itens, setItens] = useState<LinhaItem[]>(() => [novaLinha(insumoIdPreselecionado, locais, `item-${idFormulario}`)]);
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [frete, setFrete] = useState("");
  const [desconto, setDesconto] = useState("");
  const [custosAdicionais, setCustosAdicionais] = useState<LinhaCusto[]>([]);
  const [data, setData] = useState(hoje());
  const [dataVencimento, setDataVencimento] = useState("");
  const [pago, setPago] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(hoje());
  const [contaBancariaId, setContaBancariaId] = useState<string | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<PagamentoNota["formaPagamento"]>("BOLETO");
  const [cartaoCreditoId, setCartaoCreditoId] = useState<string | null>(null);
  const [dataCompra, setDataCompra] = useState(hoje());
  const [parcelaCartao, setParcelaCartao] = useState(1);
  const [observacao, setObservacao] = useState("");
  const [insumosCriados, setInsumosCriados] = useState<InsumoCriado[]>([]);
  const [pending, startTransition] = useTransition();
  const trava = useRef(false);
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const topoItens = useRef<HTMLDivElement>(null);
  const [focarLinha, setFocarLinha] = useState<string | null>(null);

  const ehCompra = tipo === "COMPRA_SIMPLES";
  const insumosDisponiveis: InsumoOption[] = [...insumos, ...insumosCriados.filter((criado) => !insumos.some((insumo) => insumo.id === criado.id))];
  const contaSelecionada = contasBancarias.find(conta => conta.id === contaBancariaId) ?? null;
  const cartaoSelecionado = cartoes.find(cartao => cartao.id === cartaoCreditoId) ?? null;
  const itensNumericos = itens.map(item => ({
    insumoId: item.insumoId ?? "",
    localId: item.localId ?? "",
    quantidade: paraNumero(item.quantidade),
    fatorConversao: item.fatorConversao.trim() ? paraNumero(item.fatorConversao) : 1,
    valorProdutos: paraNumero(item.valorProdutos),
  }));
  const adicionaisNumericos = custosAdicionais
    .filter(custo => custo.descricao.trim() || paraNumero(custo.valor) > 0)
    .map(custo => ({ descricao: custo.descricao.trim(), valor: paraNumero(custo.valor) }));
  const calculo = calcularCompraSemNota({
    itens: itensNumericos,
    frete: paraNumero(frete),
    desconto: paraNumero(desconto),
    custosAdicionais: adicionaisNumericos,
  });
  const composicao = "composicao" in calculo ? calculo.composicao : null;
  const valorProdutos = itensNumericos.reduce((soma, item) => soma + Math.round(item.valorProdutos * 100), 0) / 100;
  const valorOutrosCustos = adicionaisNumericos.reduce((soma, custo) => soma + Math.round(custo.valor * 100), 0) / 100;
  const valorTotal = (Math.round(valorProdutos * 100) + Math.round(paraNumero(frete) * 100) + Math.round(valorOutrosCustos * 100) - Math.round(paraNumero(desconto) * 100)) / 100;

  function atualizarItem(chaveItem: string, dados: Partial<LinhaItem>) {
    setItens(atuais => atuais.map(item => item.chave === chaveItem ? { ...item, ...dados } : item));
  }

  function atualizarCusto(chaveCusto: string, dados: Partial<LinhaCusto>) {
    setCustosAdicionais(atuais => atuais.map(custo => custo.chave === chaveCusto ? { ...custo, ...dados } : custo));
  }

  function mudarTipo(novoTipo: "COMPRA_SIMPLES" | "OUTRO_MOTIVO") {
    setTipo(novoTipo);
    if (novoTipo === "OUTRO_MOTIVO") {
      setPago(false);
      setFormaPagamento("BOLETO");
      setCartaoCreditoId(null);
    }
  }

  function limpar() {
    setItens([novaLinha(null, locais)]);
    setFornecedorId(null);
    setFrete("");
    setDesconto("");
    setCustosAdicionais([]);
    setDataVencimento("");
    setPago(false);
    setDataPagamento(hoje());
    setContaBancariaId(null);
    setFormaPagamento("BOLETO");
    setCartaoCreditoId(null);
    setDataCompra(hoje());
    setParcelaCartao(1);
    setObservacao("");
  }

  function registrar() {
    if (trava.current) return;
    trava.current = true;
    setErro(null);
    startTransition(async () => {
      const dados = {
        tipo,
        itens: itensNumericos,
        fornecedorId: ehCompra ? fornecedorId : null,
        frete: ehCompra ? paraNumero(frete) : 0,
        desconto: ehCompra ? paraNumero(desconto) : 0,
        custosAdicionais: ehCompra ? adicionaisNumericos : [],
        data,
        dataVencimento: ehCompra && dataVencimento ? dataVencimento : null,
        pago: ehCompra && pago,
        dataPagamento: ehCompra && pago ? dataPagamento : null,
        contaBancariaId: ehCompra && pago ? contaBancariaId : null,
        formaPagamento: ehCompra ? formaPagamento : "BOLETO",
        cartaoCreditoId: ehCompra && formaPagamento === "CARTAO" ? cartaoCreditoId : null,
        dataCompra: ehCompra && formaPagamento === "CARTAO" ? dataCompra : null,
        parcelaCartao: ehCompra && formaPagamento === "CARTAO" ? parcelaCartao : 1,
        observacao: observacao.trim() || null,
      };
      const assinatura = JSON.stringify(dados);
      if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
      try {
      const resultado = await registrarEntradaAvulsaAction({ ...dados, chave: tentativa.current!.chave });
      if ("erro" in resultado) {
        setErro(resultado.erro);
        toast.error(resultado.erro);
        return;
      }
      toast.success("Entrada registrada.");
      limpar();
      tentativa.current = null;
      } catch { setErro("Não foi possível confirmar a entrada. Tente novamente; a mesma tentativa não será duplicada."); }
      finally { trava.current = false; }
    });
  }

  function atualizarFormaPagamento(valor: PagamentoNota["formaPagamento"]) {
    setFormaPagamento(valor);
    if (valor !== "CARTAO") {
      setCartaoCreditoId(null);
      setParcelaCartao(1);
      return;
    }
    setPago(false);
    const cartao = cartoes.find(item => item.id === cartaoCreditoId);
    if (cartao && dataCalendarioValida(dataCompra)) {
      try { setDataVencimento(vencimentoCartao(dataCompra, cartao.diaFechamento, cartao.diaVencimento, parcelaCartao)); } catch { setDataVencimento(""); }
    }
  }

  function atualizarCartao(id: string | null) {
    setCartaoCreditoId(id);
    if (!id) { setDataVencimento(""); return; }
    const cartao = cartoes.find(item => item.id === id);
    if (!cartao || !dataCalendarioValida(dataCompra)) return;
    try { setDataVencimento(vencimentoCartao(dataCompra, cartao.diaFechamento, cartao.diaVencimento, parcelaCartao)); } catch { setDataVencimento(""); }
  }

  function atualizarDataCompra(valor: string) {
    setDataCompra(valor);
    if (!cartaoSelecionado || !dataCalendarioValida(valor)) return;
    try { setDataVencimento(vencimentoCartao(valor, cartaoSelecionado.diaFechamento, cartaoSelecionado.diaVencimento, parcelaCartao)); } catch { setDataVencimento(""); }
  }

  function atualizarParcela(valor: number) {
    setParcelaCartao(valor);
    if (!cartaoSelecionado || !dataCalendarioValida(dataCompra) || !Number.isInteger(valor) || valor < 1 || valor > 120) return;
    try { setDataVencimento(vencimentoCartao(dataCompra, cartaoSelecionado.diaFechamento, cartaoSelecionado.diaVencimento, valor)); } catch { setDataVencimento(""); }
  }

  if (locais.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Cadastre um local de estoque antes de registrar uma entrada.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BarraAcoes titulo="Entrada de insumo" descricao="Registre uma compra recebida sem nota fiscal ou um ajuste pontual de estoque." />

      <div className="inline-flex rounded-xl border bg-muted/40 p-1">
        <Button type="button" size="sm" variant={ehCompra ? "default" : "ghost"} disabled={pending} onClick={() => mudarTipo("COMPRA_SIMPLES")}>
          <ReceiptText className="size-4" /> Completa
        </Button>
        <Button type="button" size="sm" variant={!ehCompra ? "default" : "ghost"} disabled={pending} onClick={() => mudarTipo("OUTRO_MOTIVO")}>
          <PackagePlus className="size-4" /> Simples
        </Button>
      </div>

      {ehCompra && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ReceiptText className="size-5 text-primary" /> Fornecedor e entrada</CardTitle>
            <CardDescription>Identifique o fornecedor e a data em que os itens entraram no estoque.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fornecedor *</Label>
              <FornecedorCombobox fornecedores={fornecedores} value={fornecedorId} onChange={setFornecedorId} disabled={pending} podeCadastrar={podeCadastrarFornecedor} ariaLabel="Fornecedor da compra" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="data-entrada-avulsa">Data de entrada *</Label>
              <Input id="data-entrada-avulsa" type="date" value={data} onChange={evento => setData(evento.target.value)} disabled={pending} />
            </div>
          </CardContent>
        </Card>
      )}

      <div ref={topoItens} className="scroll-mt-24" />
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Itens recebidos</CardTitle>
              <CardDescription>
                {ehCompra ? "Informe o valor dos itens antes de frete, desconto e custos adicionais." : "Informe o item que entrou no estoque."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {itens.map((item, indice) => {
            const insumo = insumosDisponiveis.find(opcao => opcao.id === item.insumoId) ?? null;
            const local = locais.find(opcao => opcao.id === item.localId) ?? null;
            const itemCalculado = composicao?.itens[indice] ?? null;
            return (
              <Fragment key={item.chave}><div data-item-entrada={item.chave} className="rounded-xl border bg-muted/15 p-4" ref={elemento => {
                if (elemento && focarLinha === item.chave) {
                  elemento.querySelector<HTMLInputElement>('input[role="combobox"]')?.focus({ preventScroll: true });
                  setFocarLinha(null);
                }
              }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <Badge variant="muted">Item {indice + 1}</Badge>
                  {itens.length > 1 && (
                    <BotaoRemoverItem nome={`Remover item ${indice + 1}`} disabled={pending} onClick={() => setItens(atuais => atuais.filter(atual => atual.chave !== item.chave))} />
                  )}
                </div>
                <div data-campos-entrada className="grid min-w-0 gap-3 sm:grid-cols-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)_minmax(0,.9fr)_minmax(0,.75fr)_minmax(0,1fr)]">
                  <div className="min-w-0 space-y-1.5">
                    <Label>Insumo *</Label>
                    <InsumoCombobox insumos={insumosDisponiveis} value={item.insumoId} onChange={insumoId => atualizarItem(item.chave, { insumoId })} disabled={pending} podeCadastrar={podeCadastrarInsumo} fornecedorIdNovo={ehCompra ? fornecedorId : null} aoCriar={(criado) => setInsumosCriados((atuais) => [...atuais.filter((atual) => atual.id !== criado.id), criado])} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label>Local *</Label>
                    <Select value={item.localId ?? ""} onValueChange={localId => atualizarItem(item.chave, { localId })} disabled={pending}>
                      <SelectTrigger aria-label={`Local do item ${indice + 1}`} className="w-full">
                        <SelectValue placeholder="Selecione">{() => local?.nome ?? "Selecione"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>{locais.map(opcao => <SelectItem key={opcao.id} value={opcao.id}>{opcao.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`quantidade-${item.chave}`}>Qtd *</Label>
                    <InputComSufixo id={`quantidade-${item.chave}`} aria-label={`Quantidade do item ${indice + 1}`} value={item.quantidade} onChange={evento => atualizarItem(item.chave, { quantidade: evento.target.value })} placeholder="0,000" inputMode="decimal" casasDecimais={6} maxLength={16} disabled={pending} sufixo={insumo ? unidadeMedidaAbreviada[insumo.unidade] : "—"} />
                   </div>
                   <div className="space-y-1.5">
                    <Label htmlFor={`fator-${item.chave}`}>Fator</Label>
                    <Input id={`fator-${item.chave}`} aria-label={`Fator de conversão do item ${indice + 1}`} value={item.fatorConversao} onChange={evento => atualizarItem(item.chave, { fatorConversao: evento.target.value })} placeholder="1" inputMode="decimal" casasDecimais={6} maxLength={16} disabled={pending} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{ehCompra ? "Valor *" : "Valor"}</Label>
                    <CurrencyInput aria-label={`Valor do item ${indice + 1}`} value={item.valorProdutos} onValueChange={valorProdutos => atualizarItem(item.chave, { valorProdutos })} disabled={pending} />
                  </div>
                </div>
                {insumo && <p className="mt-2 text-xs text-muted-foreground">Entrada no estoque: <strong className="text-foreground">{(paraNumero(item.quantidade) * paraNumero(item.fatorConversao || "1")).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {unidadeMedidaAbreviada[insumo.unidade]}</strong> · 1 unidade de entrada = {paraNumero(item.fatorConversao || "1")} {unidadeMedidaAbreviada[insumo.unidade]}</p>}
                {ehCompra && itemCalculado && insumo && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
                    <span>Custo final rateado: <strong className="text-foreground">{formatarMoeda(itemCalculado.valorFinal)}</strong></span>
                    <span>{formatarMoeda(itemCalculado.custoUnitario)} / {unidadeMedidaAbreviada[insumo.unidade]}</span>
                    {(itemCalculado.freteRateado > 0 || itemCalculado.outrosCustosRateados > 0 || itemCalculado.descontoRateado > 0) && (
                      <span>Frete {formatarMoeda(itemCalculado.freteRateado)} · Outros {formatarMoeda(itemCalculado.outrosCustosRateados)} · Desconto −{formatarMoeda(itemCalculado.descontoRateado)}</span>
                    )}
                  </div>
                )}
              </div>{indice === 0 && <GrupoAcoes nome="Inclusão de itens" alinhamento="inicio">
                <Button type="button" variant="outline" disabled={pending || itens.length >= 100} onClick={() => {
                  const linha = novaLinha(null, locais);
                  setFocarLinha(linha.chave);
                  setItens(atuais => [linha, ...atuais]);
                  topoItens.current?.scrollIntoView?.({ block: "start", behavior: "instant" });
                }}><Plus className="size-4" /> Adicionar item</Button>
              </GrupoAcoes>}</Fragment>
            );
          })}
        </CardContent>
      </Card>

      {ehCompra && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Truck className="size-5 text-primary" /> Composição do custo</CardTitle>
            <CardDescription>Os valores são rateados entre os itens e atualizam o custo médio do estoque.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_11rem]">
              <div className="space-y-1.5">
                <Label>Frete (opcional)</Label>
                <CurrencyInput aria-label="Frete da compra" value={frete} onValueChange={setFrete} disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label>Desconto (opcional)</Label>
                <CurrencyInput aria-label="Desconto da compra" value={desconto} onValueChange={setDesconto} disabled={pending} />
              </div>
              <div className="space-y-1.5">
                <Label>Outros custos</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/20 px-3 font-medium">
                  {formatarMoeda(valorOutrosCustos)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Custos adicionais</Label>
                <Button type="button" size="sm" variant="ghost" disabled={pending || custosAdicionais.length >= 20} onClick={() => setCustosAdicionais(atuais => [{ chave: chave("custo"), descricao: "", valor: "" }, ...atuais])}>
                  <Plus className="size-4" /> Adicionar custo
                </Button>
              </div>
              {custosAdicionais.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Nenhum custo adicional. Use esta área para seguro, taxa, descarga ou outro valor da compra.</p>
              ) : custosAdicionais.map((custo, indice) => (
                <div key={custo.chave} className="grid grid-cols-[minmax(0,1fr)_9rem_auto] gap-2">
                  <Input aria-label={`Descrição do custo adicional ${indice + 1}`} value={custo.descricao} onChange={evento => atualizarCusto(custo.chave, { descricao: evento.target.value })} placeholder="Ex: seguro, descarga..." maxLength={120} disabled={pending} />
                  <CurrencyInput aria-label={`Valor do custo adicional ${indice + 1}`} value={custo.valor} onValueChange={valor => atualizarCusto(custo.chave, { valor })} disabled={pending} />
                    <BotaoRemoverItem nome={`Remover custo adicional ${indice + 1}`} disabled={pending} onClick={() => setCustosAdicionais(atuais => atuais.filter(atual => atual.chave !== custo.chave))} />
                </div>
              ))}
            </div>

            <div className="grid gap-2 rounded-xl border bg-primary/5 p-4 sm:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Valor dos itens</p><p className="font-medium">{formatarMoeda(valorProdutos)}</p></div>
              <div><p className="text-xs text-muted-foreground">Frete + outros</p><p className="font-medium">{formatarMoeda(paraNumero(frete) + valorOutrosCustos)}</p></div>
              <div><p className="text-xs text-muted-foreground">Desconto</p><p className="font-medium text-success">− {formatarMoeda(paraNumero(desconto))}</p></div>
              <div><p className="text-xs text-muted-foreground">Total da compra</p><p className="font-heading text-lg font-semibold">{formatarMoeda(valorTotal)}</p></div>
            </div>
            {valorTotal < 0 && <p role="alert" className="text-sm text-destructive">O desconto não pode ser maior que o valor da compra.</p>}
          </CardContent>
        </Card>
      )}

      {ehCompra && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BadgeDollarSign className="size-5 text-primary" /> Pagamento</CardTitle>
            <CardDescription>Será criada uma única despesa para o fornecedor com o total completo da compra.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Forma de pagamento *</Label>
                <Select value={formaPagamento ?? "BOLETO"} onValueChange={valor => atualizarFormaPagamento(valor as PagamentoNota["formaPagamento"])} disabled={pending}>
                  <SelectTrigger aria-label="Forma de pagamento da compra" className="w-full"><SelectValue>{() => ({ BOLETO: "Boleto", PIX: "Pix", CARTAO: "Cartão de crédito" }[formaPagamento ?? "BOLETO"])}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="BOLETO">Boleto</SelectItem><SelectItem value="PIX">Pix</SelectItem><SelectItem value="CARTAO">Cartão de crédito</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vencimento-entrada-avulsa">Vencimento</Label>
                <Input id="vencimento-entrada-avulsa" type="date" value={dataVencimento} onChange={evento => setDataVencimento(evento.target.value)} disabled={pending || formaPagamento === "CARTAO"} />
                <p className="text-xs text-muted-foreground">{formaPagamento === "CARTAO" ? "Calculado pela fatura do cartão." : "Vazio = mesma data da entrada."}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Situação</Label>
                <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                  <Checkbox checked={pago} onCheckedChange={(marcado) => setPago(marcado === true)} disabled={pending || formaPagamento === "CARTAO"} />
                  Já está pago
                </label>
              </div>
            </div>
            {formaPagamento === "CARTAO" && (
              <div className="grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_9rem]">
                <div className="space-y-1.5">
                  <Label>Cartão / conta bancária *</Label>
                  <Select value={cartaoCreditoId ?? ""} onValueChange={atualizarCartao} disabled={pending}>
                    <SelectTrigger aria-label="Cartão da compra" className="w-full"><SelectValue placeholder="Selecione o cartão">{() => cartaoSelecionado ? `${cartaoSelecionado.nome} · ${cartaoSelecionado.contaBancariaNome}` : "Selecione o cartão"}</SelectValue></SelectTrigger>
                    <SelectContent>{cartoes.filter(cartao => cartao.ativo).map(cartao => <SelectItem key={cartao.id} value={cartao.id}>{cartao.nome} · {cartao.contaBancariaNome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label htmlFor="data-compra-entrada-avulsa">Data da compra *</Label><Input id="data-compra-entrada-avulsa" aria-label="Data da compra" type="date" value={dataCompra} onChange={evento => atualizarDataCompra(evento.target.value)} disabled={pending} /></div>
                <div className="space-y-1.5"><Label htmlFor="parcela-cartao-entrada-avulsa">Parcela do cartão *</Label><Input id="parcela-cartao-entrada-avulsa" aria-label="Parcela do cartão" type="number" min={1} max={120} value={parcelaCartao} onChange={evento => atualizarParcela(Number(evento.target.value))} disabled={pending} /></div>
                <p className="text-xs text-muted-foreground sm:col-span-3">O vencimento é calculado pela fatura. A compra fica pendente até a baixa da fatura do cartão.</p>
              </div>
            )}
            {pago && (
              <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pagamento-entrada-avulsa">Data do pagamento *</Label>
                  <Input id="pagamento-entrada-avulsa" type="date" value={dataPagamento} onChange={evento => setDataPagamento(evento.target.value)} disabled={pending} />
                </div>
                <div className="space-y-1.5">
                  <Label>Conta bancária *</Label>
                  <Select value={contaBancariaId ?? ""} onValueChange={valor => setContaBancariaId(valor)} disabled={pending}>
                    <SelectTrigger aria-label="Conta bancária da compra" className="w-full">
                      <SelectValue placeholder="Selecione a conta">{() => contaSelecionada?.nome ?? "Selecione a conta"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>{contasBancarias.map(conta => <SelectItem key={conta.id} value={conta.id}>{conta.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 pt-6">
          {!ehCompra && (
            <div className="space-y-1.5">
              <Label htmlFor="data-ajuste-avulso">Data de entrada *</Label>
              <Input id="data-ajuste-avulso" type="date" value={data} onChange={evento => setData(evento.target.value)} disabled={pending} className="max-w-52" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="observacao-entrada-avulsa">{ehCompra ? "Observação (opcional)" : "Motivo do ajuste *"}</Label>
            <Textarea id="observacao-entrada-avulsa" value={observacao} onChange={evento => setObservacao(evento.target.value)} rows={3} maxLength={2000} placeholder={ehCompra ? "Pedido, comprovante ou informação útil para conferência..." : "Explique por que este item entrou no estoque..."} disabled={pending} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              {ehCompra ? `${itens.length} ${itens.length === 1 ? "item" : "itens"} · Total ${formatarMoeda(valorTotal)}` : "Este ajuste não gera despesa no Financeiro."}
            </p>
            <Button type="button" variant="entrada" disabled={pending} onClick={registrar}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
              Registrar
            </Button>
          </div>
        </CardContent>
      </Card>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    </div>
  );
}
