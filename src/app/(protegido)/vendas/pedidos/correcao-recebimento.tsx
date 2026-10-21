"use client";
import { useContext, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PedidoPopupContext } from "./modal-pedido";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { corrigirRecebimentoPedidoAction } from "./actions";

export function CorrecaoRecebimento({ pedidoId, tituloId, revisao, valor }: { pedidoId: string; tituloId: string; revisao: string; valor: string }) {
  const popup = useContext(PedidoPopupContext);
  const router = useRouter(), campoId = useId(), trava = useRef(false), tentativa = useRef<{ motivo: string; chave: string } | null>(null);
  const [aberto, setAberto] = useState(false), [motivo, setMotivo] = useState(""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  async function confirmar() {
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações comerciais antes desta ação."); return; }
    if (trava.current) return; trava.current = true; setOcupado(true); setErro("");
    if (tentativa.current?.motivo !== motivo) tentativa.current = { motivo, chave: crypto.randomUUID() };
    try {
      const r = await corrigirRecebimentoPedidoAction(pedidoId, tituloId, revisao, motivo, tentativa.current.chave);
      if ("erro" in r) setErro(r.erro); else { setAberto(false); setMotivo(""); router.refresh(); }
    } catch { setErro("Resultado não confirmado. Confira o histórico antes de repetir; sua justificativa foi preservada."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <><Button type="button" variant="outline" onClick={() => { setErro(""); setAberto(true); }}>Corrigir registro de recebimento</Button>
    <Dialog open={aberto} alterado={!!motivo} protegerAlteracoes={!ocupado} onOpenChange={v => { if (!ocupado) setAberto(v); }}><DialogContent className="sm:max-w-lg" showCloseButton={!ocupado}><DialogHeader><DialogTitle>Corrigir registro de recebimento</DialogTitle><DialogDescription>Use somente quando o recebimento foi registrado por engano. O registro de {Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} será retirado do caixa e a obrigação será recalculada, preservando a fotografia anterior no histórico. Para dinheiro realmente recebido e devolvido, use Devoluções e pós-venda.</DialogDescription></DialogHeader>
    <div className="space-y-2"><Label htmlFor={campoId}>Justificativa da correção</Label><Input id={campoId} value={motivo} maxLength={1000} disabled={ocupado} onChange={e => setMotivo(e.target.value)} /></div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><DialogClose render={<Button type="button" variant="outline" disabled={ocupado} />}>Voltar</DialogClose><Button type="button" disabled={ocupado || !motivo.trim()} onClick={() => void confirmar()}>{ocupado ? "Corrigindo…" : "Confirmar correção"}</Button></GrupoAcoes></DialogContent></Dialog></>;
}
