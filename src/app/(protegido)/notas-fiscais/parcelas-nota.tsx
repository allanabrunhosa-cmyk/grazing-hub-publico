"use client";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CampoMonetario } from "./campo-monetario";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dataCalendarioValida, vencimentoCartao, type CartaoOption } from "@/lib/financeiro/cartoes";
import type { PagamentoNota } from "@/lib/notas-fiscais/pagamentos";
export type DuplicataLinha = PagamentoNota & { id?: string; numero: string; dataVencimento: string; valor: string; bloqueada?: boolean };
const formas = { BOLETO: "Boleto", PIX: "Pix", CARTAO: "Cartão de crédito" };
export function ParcelasNota({ parcelas, cartoes, dataEmissao, bloqueado, mostrarErros, onChange }: { parcelas: DuplicataLinha[]; cartoes: CartaoOption[]; dataEmissao: string; bloqueado: boolean; mostrarErros?: boolean; onChange: (parcelas: DuplicataLinha[]) => void }) {
  function atualizar(indice: number, alteracao: Partial<DuplicataLinha>) {
    onChange(parcelas.map((atual, i) => {
      if (i !== indice) return atual;
      const nova = { ...atual, ...alteracao };
      if (nova.formaPagamento === "CARTAO") {
        nova.dataCompra ??= dataEmissao;
        nova.parcelaCartao ??= 1;
        const cartao = cartoes.find(c => c.id === nova.cartaoCreditoId);
        try { nova.dataVencimento = cartao ? vencimentoCartao(nova.dataCompra, cartao.diaFechamento, cartao.diaVencimento, nova.parcelaCartao) : ""; }
        catch { nova.dataVencimento = ""; }
      } else { nova.cartaoCreditoId = null; nova.dataCompra = null; nova.parcelaCartao = 1; }
      return nova;
    }));
  }
  return <div className="space-y-3 rounded-lg border p-3">
    <div className="flex items-center justify-between gap-2"><Label>Parcelas (duplicatas)</Label><Button type="button" data-dialogo-altera size="sm" variant="outline" disabled={bloqueado} onClick={() => onChange([...parcelas, { numero: String(parcelas.length + 1).padStart(3, "0"), valor: "", dataVencimento: "", formaPagamento: "BOLETO" }])}><Plus className="size-3.5" />Nova parcela</Button></div>
    {!parcelas.length && <p className={mostrarErros ? "rounded-md border border-destructive bg-destructive/10 p-2 text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>Nenhuma parcela — adicione ao menos uma.</p>}
    {parcelas.map((p, i) => {
      const numeroInvalido = !!mostrarErros && !p.numero.trim();
      const vencimentoInvalido = !!mostrarErros && !dataCalendarioValida(p.dataVencimento);
      const valorNumero = Number.parseFloat(p.valor.replace(",", "."));
      const valorInvalido = !!mostrarErros && (!Number.isFinite(valorNumero) || valorNumero <= 0);
      const cartaoInvalido = !!mostrarErros && p.formaPagamento === "CARTAO" && !p.cartaoCreditoId;
      const dataCompraInvalida = !!mostrarErros && p.formaPagamento === "CARTAO" && !dataCalendarioValida(p.dataCompra ?? "");
      const parcelaCartaoInvalida = !!mostrarErros && p.formaPagamento === "CARTAO" && (!Number.isInteger(p.parcelaCartao) || (p.parcelaCartao ?? 0) < 1);
      return <fieldset key={p.id ?? i} disabled={bloqueado || p.bloqueada} className="space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="w-20 space-y-1 text-xs">Número<Input aria-label={"Número da parcela " + (i + 1)} aria-invalid={numeroInvalido} className="aria-invalid:bg-destructive/10" value={p.numero} onChange={e => atualizar(i, {numero: e.target.value})} /></label>
        <div className="min-w-40 flex-1 space-y-1"><Label className="text-xs">Pagamento</Label><Select disabled={bloqueado || p.bloqueada} value={p.formaPagamento ?? "BOLETO"} onValueChange={v => atualizar(i, { formaPagamento: v as PagamentoNota["formaPagamento"] })}><SelectTrigger aria-label={"Pagamento da parcela " + (i + 1)} className="w-full"><SelectValue>{() => formas[p.formaPagamento ?? "BOLETO"]}</SelectValue></SelectTrigger><SelectContent>{Object.entries(formas).map(([valor,nome]) => <SelectItem key={valor} value={valor}>{nome}</SelectItem>)}</SelectContent></Select></div>
        <label className="w-36 space-y-1 text-xs">Vencimento<Input aria-label={"Vencimento da parcela " + (i + 1)} aria-invalid={vencimentoInvalido} className="aria-invalid:bg-destructive/10" type="date" disabled={p.formaPagamento === "CARTAO"} value={p.dataVencimento} onChange={e => atualizar(i, {dataVencimento: e.target.value})} /></label>
        <div className="w-28 space-y-1"><Label className="text-xs">Valor</Label><CampoMonetario aria-label={"Valor da parcela " + p.numero + " em reais"} aria-invalid={valorInvalido} className="aria-invalid:bg-destructive/10" value={p.valor} onValueChange={valor => atualizar(i, {valor})} /></div>
        <Button type="button" data-dialogo-altera variant="excluir" size="icon" aria-label={"Remover parcela " + (i + 1)} onClick={() => onChange(parcelas.filter((_,n) => n !== i))}><Trash2 className="size-4" /></Button>
      </div>
      {p.formaPagamento === "CARTAO" && <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/30 p-2">
        <div className="min-w-48 flex-1 space-y-1"><Label className="text-xs">Cartão / conta bancária</Label><Select disabled={bloqueado || p.bloqueada} value={p.cartaoCreditoId ?? ""} onValueChange={v => atualizar(i, {cartaoCreditoId: v})}><SelectTrigger aria-label={"Cartão da parcela " + (i + 1)} aria-invalid={cartaoInvalido} className="w-full aria-invalid:bg-destructive/10"><SelectValue placeholder="Selecione o cartão">{() => { const c = cartoes.find(c => c.id === p.cartaoCreditoId); return c ? c.nome + " · " + c.contaBancariaNome : "Selecione o cartão"; }}</SelectValue></SelectTrigger><SelectContent>{cartoes.filter(c => c.ativo).map(c => <SelectItem key={c.id} value={c.id}>{c.nome} · {c.contaBancariaNome}</SelectItem>)}</SelectContent></Select></div>
        <label className="w-36 space-y-1 text-xs">Data da compra<Input aria-label={"Data da compra da parcela " + (i + 1)} aria-invalid={dataCompraInvalida} className="aria-invalid:bg-destructive/10" type="date" value={p.dataCompra ?? ""} onChange={e => atualizar(i, {dataCompra: e.target.value})} /></label>
        <label className="w-24 space-y-1 text-xs">Parcela do cartão<Input aria-label={"Parcela do cartão " + (i + 1)} aria-invalid={parcelaCartaoInvalida} className="aria-invalid:bg-destructive/10" type="number" min={1} max={120} value={p.parcelaCartao === 0 ? "" : p.parcelaCartao ?? 1} onChange={e => atualizar(i, {parcelaCartao: Number(e.target.value)})} /></label>
        <p className="basis-full text-xs text-muted-foreground">{cartoes.length ? "Vencimento calculado pela fatura. No dia do fechamento, a compra entra na próxima fatura. A despesa será provisionada como pendente." : "Cadastre um cartão ativo em Conta Bancária e Cartões para continuar."}</p>
      </div>}
      {p.bloqueada && <p className="text-xs text-muted-foreground">Parcela já lançada no financeiro; dados preservados.</p>}
    </fieldset>})}
  </div>;
}
