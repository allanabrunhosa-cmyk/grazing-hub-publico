"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxInputGroup, ComboboxItem } from "@/components/ui/combobox";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Campo } from "@/app/(protegido)/vendas/componentes";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";

type Componente = NonNullable<ClassificacaoFiscal["componentesKit"]>[number];
export function ComponentesKitFiscal({ itens, produtos, mudar, disabled = false }: {
  itens: Componente[]; produtos: { id: string; nome: string }[];
  mudar: (itens: Componente[]) => void; disabled?: boolean;
}) {
  const [aberto, setAberto] = useState(itens.length === 0);
  function alterar(n: number, parte: Partial<Componente>) { mudar(itens.map((i, p) => p === n ? { ...i, ...parte } : i)); }
  return <details open={aberto} onToggle={e => setAberto(e.currentTarget.open)} className="space-y-3 rounded-[var(--ds-cartao-raio)] border p-4">
    <summary className="cursor-pointer text-sm font-medium">Componentes do kit ({itens.length})</summary>
    <p className="text-sm text-muted-foreground">Adicione mercadorias vendidas separadamente. O valor para rateio distribui o preço do kit entre elas.</p>
    {itens.map((item, n) => {
      const id = item.produtoId ?? (item.referenciaInternaInsumoId ? `INSUMO:${item.referenciaInternaInsumoId}` : "");
      const opcoes = !id || produtos.some(p => p.id === id) ? produtos : [...produtos, { id, nome: item.descricao ?? id }];
      return <fieldset key={n} disabled={disabled} className="min-w-0 space-y-3 rounded-[var(--ds-cartao-raio)] border p-3">
        <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Item {n + 1}</span><BotaoRemoverItem nome={`Remover componente ${n + 1}`} discreto onClick={() => mudar(itens.filter((_, p) => p !== n))} /></div>
        <Campo nome="Produto"><Combobox items={opcoes} value={opcoes.find(p => p.id === id) ?? null} itemToStringLabel={p => p.nome} onValueChange={p => { if (p) mudar(itens.map((i, pos) => pos === n ? { produtoId: p.id, quantidade: i.quantidade, pesoRateio: i.pesoRateio } : i)); }} disabled={disabled}>
          <ComboboxInputGroup><ComboboxInput aria-label={`Produto do kit ${n + 1}`} placeholder="Buscar produto" maxLength={200} /></ComboboxInputGroup>
          <ComboboxContent>{p => <ComboboxItem key={p.id} value={p}>{p.nome}</ComboboxItem>}</ComboboxContent>
        </Combobox></Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo nome="Quantidade"><Input aria-label={`Quantidade do kit ${n + 1}`} restricao="decimal" casasDecimais={6} inputMode="decimal" maxLength={19} value={item.quantidade.replace(".", ",")} onChange={e => alterar(n, { quantidade: e.target.value.replace(",", ".") })} /></Campo>
          <Campo nome="Valor para rateio (R$)"><Input aria-label={`Valor para rateio do kit ${n + 1}`} restricao="decimal" casasDecimais={6} inputMode="decimal" maxLength={19} value={item.pesoRateio.replace(".", ",")} onChange={e => alterar(n, { pesoRateio: e.target.value.replace(",", ".") })} /></Campo>
        </div>
      </fieldset>;
    })}
    <Button type="button" variant="outline" disabled={disabled || itens.length >= 100} onClick={() => mudar([...itens, { produtoId: "", quantidade: "1", pesoRateio: "" }])}>Adicionar produto ao kit</Button>
  </details>;
}
