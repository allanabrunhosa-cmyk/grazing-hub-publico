"use client";
import { useContext, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { executarOperacaoPedidoAction } from "./actions";
import { PedidoPopupContext } from "./modal-pedido";

export function NovaTentativaEntrega({ id, versao, ocorrenciaId }: { id: string; versao: number; ocorrenciaId: string }) {
  const router = useRouter(), popup = useContext(PedidoPopupContext), rotulo = useId();
  const [aberto, setAberto] = useState(false), [motivo, setMotivo] = useState(""), [integro, setIntegro] = useState(false), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState("");
  const trava = useRef(false), tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  async function registrar() {
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações comerciais antes da nova tentativa."); return; }
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro("");
    const comando = { tipo: "NOVA_TENTATIVA" as const, ocorrenciaId, motivo, conferenciaMaterial: integro, confirmarIntegralmente: true };
    const assinatura = JSON.stringify({ versao, comando });
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    try { const r = await executarOperacaoPedidoAction(id, versao, comando, tentativa.current.chave); if ("erro" in r) setErro(r.erro); else { setAberto(false); router.refresh(); } }
    catch { setErro("Resultado não confirmado. Confira o histórico antes de repetir; os dados foram preservados."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <><Button variant="outline" onClick={() => setAberto(true)}>Nova tentativa de entrega</Button><Dialog open={aberto} alterado={!!motivo || integro} protegerAlteracoes={!ocupado} onOpenChange={v => { if (!ocupado) setAberto(v); }}><DialogContent className="sm:max-w-lg" showCloseButton={!ocupado}><DialogHeader><DialogTitle>Nova tentativa de entrega</DialogTitle><DialogDescription>Registre somente quando a nova saída acontecer. Confira o reagendamento e os produtos antes de confirmar. A tentativa anterior permanece no histórico.</DialogDescription></DialogHeader><fieldset className="min-w-0 space-y-4" disabled={ocupado}><div className="space-y-2"><Label htmlFor={rotulo}>Condição, guarda e responsável pelos produtos</Label><Input id={rotulo} value={motivo} maxLength={1000} onChange={e => setMotivo(e.target.value)} /></div><label className="flex items-start gap-3 text-sm"><Checkbox checked={integro} onCheckedChange={setIntegro} />Conferi todos os produtos: estão íntegros e disponíveis para esta nova saída.</label></fieldset><p className="text-sm text-muted-foreground">Se houve retorno ao estoque, perda ou reposição, registre o destino e conclua o novo preparo antes. Esta ação não repete recebimentos nem desfaz movimentos anteriores.</p>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><DialogClose render={<Button variant="outline" disabled={ocupado} />}>Voltar</DialogClose><Button disabled={ocupado || !motivo.trim() || !integro} onClick={() => void registrar()}>{ocupado ? "Registrando…" : "Registrar nova saída"}</Button></GrupoAcoes></DialogContent></Dialog></>;
}
