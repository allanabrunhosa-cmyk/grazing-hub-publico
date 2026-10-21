"use client";

import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { LIMITE_CREDITO_ABERTO_PADRAO, type ClienteEntrada } from "@/lib/vendas/dominio";
import { Campo, Check } from "../componentes";
import type { FormaPagamentoCliente } from "./tipos";
// Cliente novo já nasce com o limite padrão; o cadastro pode alterá-lo explicitamente.
const padrao = { formasPagamentoIds: null, boletoDiasAposEntrega: null, limiteCreditoAberto: LIMITE_CREDITO_ABERTO_PADRAO };

export function RegrasPagamentoCliente({ cliente, formas, onChange }: {
  cliente: ClienteEntrada; formas: FormaPagamentoCliente[];
  onChange?: (regras: NonNullable<ClienteEntrada["regrasPagamento"]>) => void;
}) {
  const regras = cliente.regrasPagamento ?? padrao;
  if (!onChange) return <dl className="grid gap-4 text-sm sm:grid-cols-3">
    <div><dt className="text-muted-foreground">Formas de pagamento habilitadas</dt><dd className="mt-1">{regras.formasPagamentoIds === null ? "Todas as formas ativas" : regras.formasPagamentoIds.length === 0 ? "Nenhuma forma habilitada" : regras.formasPagamentoIds.map(id => { const f = formas.find(forma => forma.id === id); return f ? `${f.nome}${f.ativo ? "" : " (inativa)"}` : "Forma indisponível"; }).join(", ")}</dd></div>
    <div><dt className="text-muted-foreground">Vencimento máximo do boleto</dt><dd className="mt-1">{regras.boletoDiasAposEntrega === null ? "Sem limite por cliente" : `${regras.boletoDiasAposEntrega} dia(s) após a entrega`}</dd></div>
    <div><dt className="text-muted-foreground">Crédito total permitido em aberto</dt><dd className="mt-1">{regras.limiteCreditoAberto === null ? "Sem limite por cliente" : Number(regras.limiteCreditoAberto).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</dd></div>
  </dl>;

  return <div className="space-y-4">
    <Check checked={regras.formasPagamentoIds === null} onChange={e => onChange({ ...regras, formasPagamentoIds: e.target.checked ? null : formas.filter(f => f.ativo).map(f => f.id) })}>Habilitar todas as formas de pagamento ativas</Check>
    {regras.formasPagamentoIds !== null && <Campo nome="Formas de pagamento habilitadas"><MultiselecaoCombobox opcoes={formas.filter(f => f.ativo || regras.formasPagamentoIds?.includes(f.id)).map(f => ({ id: f.id, nome: f.nome, descricao: f.ativo ? f.tipo : "Inativa — não disponível em novos pedidos" }))} selecionadosIds={regras.formasPagamentoIds} aoMudar={ids => onChange({ ...regras, formasPagamentoIds: ids })} placeholder="Selecione as formas permitidas" ariaLabel="Formas de pagamento habilitadas" /></Campo>}
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo nome="Dias máximos do boleto após a entrega"><Input aria-label="Dias máximos do boleto após a entrega" type="number" min={0} max={3650} step={1} placeholder="Sem limite" value={regras.boletoDiasAposEntrega ?? ""} onChange={e => onChange({ ...regras, boletoDiasAposEntrega: e.target.value === "" ? null : Number(e.target.value) })} /><p className="mt-1 text-xs text-muted-foreground">Dias corridos. Zero exige vencimento até o dia da entrega. Vazio deixa sem limite.</p></Campo>
      <Campo nome="Crédito total permitido em aberto"><CurrencyInput aria-label="Crédito total permitido em aberto" value={regras.limiteCreditoAberto ?? ""} placeholder="Sem limite" onValueChange={valor => onChange({ ...regras, limiteCreditoAberto: valor === "" ? null : valor })} /><p className="mt-1 text-xs text-muted-foreground">Limite da dívida pendente do cliente, separado do crédito disponível no extrato. Vazio deixa sem limite.</p></Campo>
    </div>
    <p className="text-xs text-muted-foreground">As regras são verificadas nos pedidos com financeiro integrado ao HUB. Pedidos com financeiro externo não informam condições ou saldos de pagamento ao HUB.</p>
  </div>;
}
