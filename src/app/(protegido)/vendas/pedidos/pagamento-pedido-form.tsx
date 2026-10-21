"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Campo } from "../componentes";
import { resumoParcelamento } from "@/lib/vendas/pedidos-parcelamento";
import { limiteParcelasComerciais } from "@/lib/vendas/pedidos-pagamento-comercial";
import type { PedidoEntrada } from "@/lib/vendas/pedidos-dominio";
type Forma = { id: string; nome: string; tipo: string; permiteParcelamento: boolean; maximoParcelas: number };
export function PagamentoPedidoForm({ formas, valor, tipoHistorico, nomeHistorico, alterar, total, dataCompra, alterarDataCompra, dataCompraSomenteLeitura = false, dataCompraObrigatoria = true }: { total?: string; formas: Forma[]; valor: PedidoEntrada["pagamentoInformado"]; tipoHistorico: PedidoEntrada["formaPagamentoInformada"]; nomeHistorico?: string; alterar: (valor: PedidoEntrada["pagamentoInformado"], tipo: PedidoEntrada["formaPagamentoInformada"]) => void; dataCompra?: string; alterarDataCompra?: (data: string) => void; dataCompraSomenteLeitura?: boolean; dataCompraObrigatoria?: boolean }) {
  const forma = formas.find(f => f.id === valor?.formaId);
  const quantidade = valor?.parcelas ?? 1;
  const nome = forma?.nome ?? nomeHistorico ?? ({ PIX: "Pix", BOLETO: "Boleto", CARTAO_CREDITO: "Cartão de crédito", CARTAO_DEBITO: "Cartão de débito" } as Record<string, string>)[tipoHistorico ?? ""];
  const rotuloParcela = (n: number) => forma?.tipo === "CARTAO_CREDITO" && total ? resumoParcelamento(total, n) : `${n}x`;
  const boleto = forma?.tipo === "BOLETO" || !forma && tipoHistorico === "BOLETO";
  return <div className="grid gap-3 sm:grid-cols-2">
    {dataCompra !== undefined && <Campo nome="Data da compra"><Input aria-label="Data da compra" type="date" min="2000-01-01" max="2200-12-31" required={dataCompraObrigatoria && !dataCompraSomenteLeitura} readOnly={dataCompraSomenteLeitura} value={dataCompra} onChange={e => alterarDataCompra?.(e.target.value)} /></Campo>}
    <Campo nome="Forma de pagamento"><Select value={valor?.formaId ?? ""} onValueChange={id => { const f = formas.find(f => f.id === id); if (f) alterar({ formaId: f.id, parcelas: 1, vencimentos: f.tipo === "BOLETO" ? [""] : [] }, f.tipo as PedidoEntrada["formaPagamentoInformada"]); }}><SelectTrigger aria-label="Forma de pagamento" className="w-full"><SelectValue placeholder="Selecione">{() => nome ?? "Selecione"}</SelectValue></SelectTrigger><SelectContent>{valor && !forma && <SelectItem value={valor.formaId} disabled>{nome ?? "Forma histórica"}</SelectItem>}{formas.map(f => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent></Select></Campo>
    {forma && ["BOLETO", "CARTAO_CREDITO"].includes(forma.tipo) && <Campo nome="Parcelas"><Select value={String(quantidade)} onValueChange={v => { const parcelas = Number(v); alterar({ formaId: forma.id, parcelas, vencimentos: boleto ? Array.from({ length: parcelas }, (_, i) => valor?.vencimentos[i] ?? "") : [] }, forma.tipo as PedidoEntrada["formaPagamentoInformada"]); }}><SelectTrigger aria-label="Parcelas" className="w-full"><SelectValue>{() => rotuloParcela(quantidade)}</SelectValue></SelectTrigger><SelectContent>{Array.from({ length: limiteParcelasComerciais(forma) }, (_, i) => <SelectItem key={i} value={String(i + 1)}>{rotuloParcela(i + 1)}</SelectItem>)}</SelectContent></Select></Campo>}
    {forma?.tipo === "CARTAO_CREDITO" && total && rotuloParcela(quantidade).includes("*") && <p className="text-xs text-muted-foreground sm:col-span-2">* Algumas parcelas têm um centavo a menos para preservar o valor total.</p>}
    {boleto && valor && valor.vencimentos.map((v, i) => <Campo key={i} nome={quantidade === 1 ? "Vencimento do boleto" : `Venc. parcela ${i + 1}`}><Input data-pedido-vencimento={i} type="date" value={v} onChange={e => alterar({ ...valor, vencimentos: valor.vencimentos.map((a, n) => n === i ? e.target.value : a) }, tipoHistorico)} /></Campo>)}
    {!formas.length && <p role="status" className="text-xs text-muted-foreground sm:col-span-2">Nenhuma forma de pagamento ativa disponível em Vendas.</p>}
    {valor && !forma && <p className="text-xs text-muted-foreground sm:col-span-2">Cadastro indisponível; condição histórica preservada.</p>}
  </div>;
}
