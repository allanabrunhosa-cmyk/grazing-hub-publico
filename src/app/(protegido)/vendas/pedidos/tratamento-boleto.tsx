"use client";
import { useContext, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelecaoFormulario } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { PedidoPopupContext } from "./modal-pedido";
import { registrarCancelamentoBoletoPedidoAction, registrarEntradaTardiaBoletoPedidoAction } from "./actions";
export function TratamentoBoleto({ pedidoId, cobrancaId, tardio, contas }: { pedidoId: string; cobrancaId: string; tardio: boolean; contas: { id: string; nome: string }[] }) {
  const router = useRouter(), popup = useContext(PedidoPopupContext), prefixo = useId(), trava = useRef(false), tentativa = useRef<{ dados: string; chave: string } | null>(null);
  const [aberto, setAberto] = useState(false), [evidencia, setEvidencia] = useState(""), [conta, setConta] = useState(""), [data, setData] = useState(""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  async function confirmar() {
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações comerciais antes desta ação."); return; }
    if (trava.current) return; trava.current = true; setOcupado(true); setErro("");
    const dados = JSON.stringify({ evidencia, conta, data }); if (tentativa.current?.dados !== dados) tentativa.current = { dados, chave: crypto.randomUUID() };
    try { const r = tardio ? await registrarEntradaTardiaBoletoPedidoAction(pedidoId, cobrancaId, conta, data, evidencia, tentativa.current.chave) : await registrarCancelamentoBoletoPedidoAction(pedidoId, cobrancaId, evidencia, tentativa.current.chave); if ("erro" in r) setErro(r.erro); else { setAberto(false); setEvidencia(""); router.refresh(); } }
    catch { setErro("Resultado não confirmado. Confira o histórico antes de repetir; os dados foram preservados."); } finally { trava.current = false; setOcupado(false); }
  }
  return <><Button type="button" variant="outline" onClick={() => { setErro(""); setAberto(true); }}>{tardio ? "Registrar entrada tardia" : "Registrar cancelamento externo do boleto"}</Button><Dialog open={aberto} alterado={!!(evidencia || conta || data)} protegerAlteracoes={!ocupado} onOpenChange={v => { if (!ocupado) setAberto(v); }}><DialogContent className="sm:max-w-lg" showCloseButton={!ocupado}><DialogHeader><DialogTitle>{tardio ? "Entrada tardia do boleto" : "Cancelamento externo do boleto"}</DialogTitle><DialogDescription>{tardio ? "Registre somente a entrada efetiva comprovada no banco. A situação comercial permanece; confira o saldo e trate o excedente em Devoluções e pós-venda." : "Confirme somente após o emissor cancelar o boleto. Este registro guarda a evidência e libera o saldo para revisão; não solicita cancelamento ao banco."}</DialogDescription></DialogHeader><fieldset disabled={ocupado} className="min-w-0 space-y-4">
  {tardio && <><div className="space-y-2"><Label>Conta da entrada tardia</Label><SelecaoFormulario aria-label="Conta da entrada tardia" value={conta} onValueChange={setConta}><option value="">Selecione</option>{contas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></div><div className="space-y-2"><Label htmlFor={`${prefixo}-data`}>Data da entrada tardia</Label><Input id={`${prefixo}-data`} type="date" value={data} onChange={e => setData(e.target.value)} /></div></>}
  <div className="space-y-2"><Label htmlFor={`${prefixo}-evidencia`}>Evidência externa</Label><Input id={`${prefixo}-evidencia`} value={evidencia} maxLength={180} onChange={e => setEvidencia(e.target.value)} /></div></fieldset>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><DialogClose render={<Button type="button" variant="outline" disabled={ocupado} />}>Voltar</DialogClose><Button type="button" disabled={ocupado || !evidencia.trim() || tardio && (!conta || !data)} onClick={() => void confirmar()}>{ocupado ? "Registrando…" : "Confirmar registro"}</Button></GrupoAcoes></DialogContent></Dialog></>;
}
