"use client";
import { useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GrupoAcoes, SlotExpansivel } from "@/components/padroes-operacionais";
import { quantidadeExecucao } from "@/lib/vendas/pedidos-execucao-dominio";
import type { FatoOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import { executarOperacaoPedidoAction } from "./actions";
import { PedidoPopupContext } from "./modal-pedido";

type Item = { id: string; quantidade: string; unidadeSnapshot: string; produtoSnapshot: { nome: string } };
export function ApontamentosPedido({ id, versao, estado, status, itens, historico, preparar, expedir }: {
  id: string; versao: number; estado: string; status: string; itens: Item[]; historico: FatoOperacao[]; preparar: boolean; expedir: boolean;
}) {
  const popup = useContext(PedidoPopupContext), router = useRouter();
  const [quantidades, setQuantidades] = useState<Record<string, string>>({}), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const trava = useRef(false), chaves = useRef<Record<string, string>>({});
  const tipo = estado === "EM_PREPARO" ? "PREPARAR" : "EXPEDIR";
  const permitido = status === "CONFIRMADO" && (estado === "EM_PREPARO" && preparar || estado === "PRONTO" && expedir);
  async function registrar(itemId: string) {
    if (trava.current || !permitido) return;
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações comerciais antes do apontamento."); return; }
    const comando = { tipo, itemId, quantidade: (quantidades[itemId] ?? "").replace(",", ".") } as const;
    const assinatura = JSON.stringify({ versao, comando });
    const chave = chaves.current[assinatura] ??= crypto.randomUUID();
    trava.current = true; setOcupado(true); setErro("");
    try {
      const r = await executarOperacaoPedidoAction(id, versao, comando, chave);
      if ("erro" in r) { setErro(r.erro); return; }
      setQuantidades(q => ({ ...q, [itemId]: "" })); popup?.marcarSalvo(`apontamento:${itemId}`); router.refresh();
    } catch { setErro("Resultado não confirmado. Os dados foram preservados; confira o histórico antes de repetir."); }
    finally { trava.current = false; setOcupado(false); }
  }
  if (status === "RASCUNHO" || status === "DECLINADO") return null;
  return <SlotExpansivel titulo="Preparo e expedição por item" resumo="Consulte o realizado e registre quantidades parciais. O avanço de etapa permanece nas ações do pedido.">
    <div className="space-y-4">{itens.map(i => <div key={i.id} className="space-y-3 border-t pt-3 first:border-t-0 first:pt-0">
      <p className="text-sm font-medium">{i.produtoSnapshot.nome} · {i.quantidade} {i.unidadeSnapshot}</p>
      <p className="text-sm text-muted-foreground">Preparado: {quantidadeExecucao(historico, i.id, "PREPARAR").toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 6 })} · Expedido: {quantidadeExecucao(historico, i.id, "EXPEDIR").toNumber().toLocaleString("pt-BR", { maximumFractionDigits: 6 })}</p>
      {permitido && <fieldset className="space-y-3" disabled={ocupado}><label className="grid gap-1 text-sm">Quantidade adicional de {i.produtoSnapshot.nome}<Input inputMode="decimal" min={0} maxLength={17} casasDecimais={["KG", "G", "L", "ML", "M", "M2", "M3"].includes(i.unidadeSnapshot) ? 6 : 0} value={quantidades[i.id] ?? ""} onChange={e => { setQuantidades(q => ({ ...q, [i.id]: e.target.value })); popup?.marcarAlterado(`apontamento:${i.id}`); }} /></label><GrupoAcoes alinhamento="inicio" nome={`Apontamento de ${i.produtoSnapshot.nome}`}><Button disabled={ocupado || !quantidades[i.id]} onClick={() => void registrar(i.id)}>{ocupado ? "Registrando…" : tipo === "PREPARAR" ? "Registrar preparo" : "Registrar expedição"}</Button></GrupoAcoes></fieldset>}
    </div>)}{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}</div>
  </SlotExpansivel>;
}
