"use client";

import { useEffect, useId, useRef } from "react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CartaoOption } from "@/lib/financeiro/cartoes";
import { DATA_LANCAMENTO_MIN, DATA_LANCAMENTO_MAX } from "@/lib/financeiro/data-lancamento";
import { formatarMoeda } from "@/lib/financeiro/formatarMoeda";
import { gerarParcelasEntrada, validarPagamentoEntrada, type PagamentoEntradaInput } from "@/lib/inventario/entrada-avulsa-pagamento";

const formas = { BOLETO: "Boleto", PIX: "Pix", CARTAO: "Cartão de crédito" };

export type RascunhoPagamentoEntrada = {
  formaPagamento: PagamentoEntradaInput["formaPagamento"];
  cartaoCreditoId: string | null;
  dataCompra: string;
  parcelaCartao: string;
  quantidade: string;
  parcelas: { valor: string; dataVencimento: string }[];
};

export function rascunhoPagamentoEntrada(pagamento: PagamentoEntradaInput): RascunhoPagamentoEntrada {
  return {
    formaPagamento: pagamento.formaPagamento,
    cartaoCreditoId: pagamento.cartaoCreditoId ?? null,
    dataCompra: pagamento.dataCompra ?? "",
    parcelaCartao: String(pagamento.parcelaCartao ?? 1),
    quantidade: String(pagamento.parcelas.length),
    parcelas: pagamento.parcelas.map(parcela => ({ ...parcela, valor: String(parcela.valor) })),
  };
}

export function pagamentoDoRascunho(rascunho: RascunhoPagamentoEntrada, valorTotal: number): PagamentoEntradaInput {
  const quantidade = Number(rascunho.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 36 || quantidade !== rascunho.parcelas.length) throw new Error("Informe de 1 a 36 parcelas.");
  const parcelas = rascunho.parcelas.map(parcela => ({ valor: Number(parcela.valor), dataVencimento: parcela.dataVencimento }));
  return validarPagamentoEntrada({ formaPagamento: rascunho.formaPagamento, cartaoCreditoId: rascunho.cartaoCreditoId, dataCompra: rascunho.dataCompra, parcelaCartao: Number(rascunho.parcelaCartao), parcelas }, valorTotal);
}

function recalcular(rascunho: RascunhoPagamentoEntrada, valorTotal: number, cartoes: CartaoOption[], dataPadrao: string, repartir: boolean, preservarDatas = false): RascunhoPagamentoEntrada {
  const quantidade = Number(rascunho.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 36) return rascunho;
  const dataBase = rascunho.parcelas[0]?.dataVencimento || dataPadrao;
  let parcelas;
  try { parcelas = gerarParcelasEntrada({ valorTotal: Math.max(0, valorTotal), quantidade, dataVencimento: "2000-01-01", formaPagamento: "BOLETO" }); }
  catch { return rascunho; }
  try {
    if (rascunho.formaPagamento === "CARTAO") {
      const cartao = cartoes.find(item => item.id === rascunho.cartaoCreditoId);
      if (!cartao) throw new Error("Selecione o cartão.");
      parcelas = gerarParcelasEntrada({ valorTotal: Math.max(0, valorTotal), quantidade, dataVencimento: dataBase, formaPagamento: "CARTAO", cartao, dataCompra: rascunho.dataCompra, parcelaCartao: Number(rascunho.parcelaCartao) });
    } else {
      parcelas = gerarParcelasEntrada({ valorTotal: Math.max(0, valorTotal), quantidade, dataVencimento: dataBase, formaPagamento: rascunho.formaPagamento });
    }
  } catch {
    parcelas = parcelas.map(parcela => ({ ...parcela, dataVencimento: "" }));
  }
  return { ...rascunho, parcelas: parcelas.map((parcela, indice) => ({
    valor: !repartir && rascunho.parcelas[indice] ? rascunho.parcelas[indice].valor : String(parcela.valor),
    dataVencimento: preservarDatas && rascunho.formaPagamento !== "CARTAO" && rascunho.parcelas[indice] ? rascunho.parcelas[indice].dataVencimento : parcela.dataVencimento,
  })) };
}

export function PagamentoEntradaAvulsa({ value, valorTotal, cartoes, dataPadrao, disabled = false, redistribuirAoAlterarTotal = false, onChange }: {
  value: RascunhoPagamentoEntrada;
  valorTotal: number;
  cartoes: CartaoOption[];
  dataPadrao: string;
  disabled?: boolean;
  redistribuirAoAlterarTotal?: boolean;
  onChange: (pagamento: RascunhoPagamentoEntrada) => void;
}) {
  const id = useId();
  const totalAnterior = useRef(valorTotal);
  useEffect(() => {
    if (totalAnterior.current === valorTotal) return;
    totalAnterior.current = valorTotal;
    if (redistribuirAoAlterarTotal) onChange(recalcular(value, valorTotal, cartoes, dataPadrao, true, true));
  }, [valorTotal, redistribuirAoAlterarTotal, onChange, value, cartoes, dataPadrao]);
  const cartao = cartoes.find(item => item.id === value.cartaoCreditoId);
  const totalParcelas = value.parcelas.reduce((soma, parcela) => soma + Math.round(Number(parcela.valor) * 100), 0) / 100;
  const somaDivergente = Math.round(totalParcelas * 100) !== Math.round(valorTotal * 100);
  function atualizar(alteracao: Partial<RascunhoPagamentoEntrada>, repartir = false) {
    onChange(recalcular({ ...value, ...alteracao }, valorTotal, cartoes, dataPadrao, repartir));
  }
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-4">
      <legend className="sr-only">Parcelamento da compra</legend>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${id}-forma`}>Forma de pagamento</Label>
          <Select value={value.formaPagamento} disabled={disabled} onValueChange={forma => {
            if (!forma) return;
            const formaPagamento = forma as PagamentoEntradaInput["formaPagamento"];
            atualizar({
              formaPagamento,
              cartaoCreditoId: formaPagamento === "CARTAO" ? value.cartaoCreditoId : null,
              dataCompra: formaPagamento === "CARTAO" ? value.dataCompra || dataPadrao : "",
              parcelaCartao: "1",
            });
          }}>
            <SelectTrigger id={`${id}-forma`} aria-label="Forma de pagamento da compra" className="w-full">
              <SelectValue>{() => formas[value.formaPagamento]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(formas).map(([valor, rotulo]) => <SelectItem key={valor} value={valor}>{rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${id}-quantidade`}>Quantidade de parcelas</Label>
          <Input id={`${id}-quantidade`} aria-label="Quantidade de parcelas" inputMode="numeric" restricao="inteiro"
            min={1} max={36} maxLength={2} value={value.quantidade}
            onChange={evento => atualizar({ quantidade: evento.target.value }, true)} />
        </div>
      </div>
      {value.formaPagamento === "CARTAO" && (
        <div className="grid min-w-0 gap-3 rounded-xl border p-3 sm:grid-cols-2">
          <div className="grid min-w-0 gap-1.5 sm:col-span-2">
            <Label htmlFor={`${id}-cartao`}>Cartão / conta bancária</Label>
            <Select value={value.cartaoCreditoId ?? ""} disabled={disabled} onValueChange={cartaoCreditoId => atualizar({ cartaoCreditoId })}>
              <SelectTrigger id={`${id}-cartao`} aria-label="Cartão da compra" className="min-w-0 w-full">
                <SelectValue className="min-w-0 truncate" placeholder="Selecione o cartão">
                  {() => cartao ? `${cartao.nome} · ${cartao.contaBancariaNome}` : value.cartaoCreditoId ? "Cartão registrado" : "Selecione o cartão"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {cartoes.filter(item => item.ativo || item.id === value.cartaoCreditoId).map(item => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nome} · {item.contaBancariaNome}{item.ativo ? "" : " (inativo)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={`${id}-compra`}>Data da compra</Label>
            <Input id={`${id}-compra`} aria-label="Data da compra" type="date"
              min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX} value={value.dataCompra}
              onChange={evento => atualizar({ dataCompra: evento.target.value })} />
          </div>
          <div className="grid min-w-0 gap-1.5">
            <Label htmlFor={`${id}-ordinal`}>Parcela inicial do cartão</Label>
            <Input id={`${id}-ordinal`} aria-label="Parcela inicial do cartão" inputMode="numeric" restricao="inteiro"
              min={1} max={120} maxLength={3} value={value.parcelaCartao}
              onChange={evento => atualizar({ parcelaCartao: evento.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Os vencimentos seguem a fatura do cartão. A última parcela deve ser, no máximo, a 120. A compra fica pendente até a baixa da fatura.
          </p>
        </div>
      )}
      <div className="space-y-3">
        {value.parcelas.map((parcela, indice) => (
          <div key={indice} className="space-y-2 rounded-xl border p-3">
            <p className="text-sm font-medium">Parcela {indice + 1} de {value.parcelas.length}</p>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`${id}-valor-${indice}`}>Valor</Label>
                <CurrencyInput id={`${id}-valor-${indice}`} aria-label={`Valor da parcela ${indice + 1}`} value={parcela.valor}
                  disabled={disabled} onValueChange={valor => onChange({
                    ...value,
                    parcelas: value.parcelas.map((atual, i) => i === indice ? { ...atual, valor } : atual),
                  })} />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor={`${id}-vencimento-${indice}`}>Vencimento</Label>
                <Input id={`${id}-vencimento-${indice}`} aria-label={`Vencimento da parcela ${indice + 1}`} type="date"
                  min={DATA_LANCAMENTO_MIN} max={DATA_LANCAMENTO_MAX} value={parcela.dataVencimento}
                  disabled={disabled || value.formaPagamento === "CARTAO"} onChange={evento => onChange({
                    ...value,
                    parcelas: value.parcelas.map((atual, i) => i === indice ? { ...atual, dataVencimento: evento.target.value } : atual),
                  })} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p role={somaDivergente ? "alert" : "status"} className={somaDivergente ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
        Total das parcelas {formatarMoeda(totalParcelas)} · Total da compra {formatarMoeda(valorTotal)}{somaDivergente ? ". Ajuste os valores para fechar o total." : ""}
      </p>
    </fieldset>
  );
}
