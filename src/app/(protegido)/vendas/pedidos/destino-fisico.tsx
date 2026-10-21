"use client";
import { useContext, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import type { DestinoFisicoPedido } from "@/lib/vendas/pedidos-operacao-dominio";
import { executarOperacaoPedidoAction } from "./actions";
import { PedidoPopupContext } from "./modal-pedido";

export function DestinoFisico({ pedidoId, versao, ocorrenciaId, destino }: { pedidoId: string; versao: number; ocorrenciaId: string; destino: DestinoFisicoPedido }) {
  const popup = useContext(PedidoPopupContext), router = useRouter(), prefixo = useId();
  const [aberto, setAberto] = useState(false), [recuperavel, setRecuperavel] = useState(""), [perda, setPerda] = useState(""), [motivo, setMotivo] = useState(""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const trava = useRef(false), tentativa = useRef<{ dados: string; chave: string } | null>(null);
  const fracionavel = !!destino.reservaId || ["KG", "G", "L", "ML", "M", "M2", "M3"].includes(destino.unidade.toUpperCase());
  async function confirmar() {
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações comerciais antes de definir o destino."); return; }
    if (trava.current) return;
    trava.current = true; setOcupado(true); setErro("");
    const comando = { tipo: "RESOLVER" as const, ocorrenciaId, recuperavel: recuperavel.replace(",", "."), perda: perda.replace(",", "."), motivo };
    const dados = JSON.stringify({ versao, comando }); if (tentativa.current?.dados !== dados) tentativa.current = { dados, chave: crypto.randomUUID() };
    try { const r = await executarOperacaoPedidoAction(pedidoId, versao, comando, tentativa.current.chave); if ("erro" in r) setErro(r.erro); else { setAberto(false); router.refresh(); } }
    catch { setErro("Resultado não confirmado. Confira o histórico antes de repetir; os dados foram preservados."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <><Button type="button" variant="outline" onClick={() => setAberto(true)}>Definir destino físico</Button><Dialog open={aberto} alterado={!!(recuperavel || perda || motivo)} protegerAlteracoes={!ocupado} onOpenChange={v => { if (!ocupado) setAberto(v); }}><DialogContent className="sm:max-w-lg" showCloseButton={!ocupado}><DialogHeader><DialogTitle>Destino do produto</DialogTitle><DialogDescription>{destino.produto} · {destino.quantidade} {destino.unidade}. Informe as quantidades efetivamente recuperáveis e perdidas, usando zero quando não se aplicar. Enquanto houver dúvida, mantenha a pendência aberta.</DialogDescription></DialogHeader>
    <fieldset disabled={ocupado} className="min-w-0 space-y-4"><div className="grid gap-4 sm:grid-cols-2">{([["recuperavel", "Recuperável", recuperavel, setRecuperavel], ["perda", "Perda", perda, setPerda]] as const).map(([id, rotulo, valor, alterar]) => <div className="space-y-2" key={id}><Label htmlFor={`${prefixo}-${id}`}>{rotulo} ({destino.unidade})</Label><Input id={`${prefixo}-${id}`} inputMode={fracionavel ? "decimal" : "numeric"} restricao={fracionavel ? "decimal" : "inteiro"} casasDecimais={fracionavel ? 6 : 0} min={0} maxLength={17} value={valor} onChange={e => alterar(e.target.value)} /></div>)}</div><div className="space-y-2"><Label htmlFor={`${prefixo}-motivo`}>Destino, condição e responsável pelo material</Label><Input id={`${prefixo}-motivo`} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)} /></div></fieldset>
    <p className="text-sm text-muted-foreground">Produto preparado não volta a ser ingrediente. Este registro não movimenta estoque nem dinheiro. Para revenda com saída registrada, conclua também o retorno ou perda na seção Materiais.</p>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><DialogClose render={<Button type="button" variant="outline" disabled={ocupado} />}>Voltar</DialogClose><Button type="button" disabled={ocupado || !recuperavel || !perda || !motivo.trim()} onClick={() => void confirmar()}>{ocupado ? "Registrando…" : "Confirmar destino"}</Button></GrupoAcoes></DialogContent></Dialog></>;
}
