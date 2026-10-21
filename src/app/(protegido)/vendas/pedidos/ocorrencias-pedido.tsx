"use client";
import { useContext, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { NovaTentativaEntrega } from "./nova-tentativa-entrega";
import { DestinoFisico } from "./destino-fisico";
import { pendenciasOperacao, type ComandoOperacao, type FatoOperacao } from "@/lib/vendas/pedidos-operacao-dominio";
import type { HorariosPedidos } from "@/lib/vendas/pedidos-horarios-dominio";
import { executarOperacaoPedidoAction } from "./actions";
import { PedidoPopupContext } from "./modal-pedido";

type Pedido = { atendimento?: string | null; entregueEm?: string | null; fusoHorario?: string; id: string; versao: number; status: string; statusOperacional: string; previsaoData: string | null; previsaoJanela: string | null; historico: FatoOperacao[]; itens?: { id: string; unidadeSnapshot: string; produtoSnapshot: { nome: string } }[] };

/** Trata somente fatos de entrega e devoluções. A agenda é editada no cartão do detalhe. */
export function OcorrenciasPedido({ pedido: p, editar }: { pedido: Pedido; editar: boolean; horarios?: HorariosPedidos | null }) {
  const router = useRouter(), popup = useContext(PedidoPopupContext);
  const [ocupado, iniciar] = useTransition();
  const [erro, setErro] = useState(""), [aviso, setAviso] = useState("");
  const [motivo, setMotivo] = useState("");
  const [itemDevolvido, setItemDevolvido] = useState(""), [quantidadeDevolvida, setQuantidadeDevolvida] = useState("");
  const chaves = useRef<Record<string, string>>({}), trava = useRef(false);
  const pendencias = pendenciasOperacao(p.historico.filter(h => h.tipo.startsWith("OPERACAO_")));
  const aberto = p.status === "CONFIRMADO" && p.statusOperacional !== "ENTREGUE";
  const alterar = (parte = "ocorrencias") => popup?.marcarAlterado(parte);
  function executar(comando: ComandoOperacao) {
    if (trava.current) return;
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações comerciais antes de registrar a ocorrência ou o reagendamento."); return; }
    trava.current = true;
    const assinatura = JSON.stringify({ id: p.id, versao: p.versao, comando }), chave = chaves.current[assinatura] ??= crypto.randomUUID();
    iniciar(async () => {
      setErro(""); setAviso("");
      try {
        const r = await executarOperacaoPedidoAction(p.id, p.versao, comando, chave);
        if ("erro" in r) { setErro(r.erro); return; }
        popup?.marcarSalvo("ocorrencias");
        if (comando.tipo === "REAGENDAR") popup?.marcarSalvo("agenda");
        setMotivo(""); setItemDevolvido(""); setQuantidadeDevolvida(""); setAviso("Registro salvo."); router.refresh();
      } catch { setErro("Resultado não confirmado. Recarregue para conferir antes de repetir."); }
      finally { trava.current = false; }
    });
  }
  return <section className="space-y-3 rounded-[var(--ds-cartao-raio)] border bg-card p-4"><h2 className="font-semibold">Entrega e devoluções</h2><p className="text-sm text-muted-foreground">Registre situações de entrega e devoluções. Valores e materiais são tratados no fluxo correspondente.</p>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}{aviso && <p role="status" className="text-sm text-success">{aviso}</p>}
    {pendencias.length > 0 && <p role="status">Há {pendencias.length} pendência(s) operacional(is). O cancelamento ou a entrega não encerram seu tratamento.</p>}
    {pendencias.map(f => <div key={f.id} className="space-y-2 border-t py-2"><p>{f.motivo} · {f.usuarioNome}</p>{editar && (f.depois.destinoFisico ? <DestinoFisico pedidoId={p.id} versao={p.versao} ocorrenciaId={f.id} destino={f.depois.destinoFisico} /> : f.depois.comando?.natureza === "FALHA_ENTREGA" && p.status === "CONFIRMADO" ? <NovaTentativaEntrega id={p.id} versao={p.versao} ocorrenciaId={f.id} /> : <Button variant="outline" disabled={ocupado || !motivo.trim()} onClick={() => executar({ tipo: "RESOLVER", ocorrenciaId: f.id, motivo })}>Resolver ocorrência</Button>)}</div>)}
    {p.historico.filter(f => f.depois.novaTentativa).map(f => <p className="text-sm" key={f.id}>Nova saída de entrega registrada · {f.motivo} · {f.usuarioNome} · {new Date(f.createdAt).toLocaleString("pt-BR", { timeZone: p.fusoHorario ?? "America/Sao_Paulo" })}</p>)}
    {p.historico.filter(f => f.depois.resolucaoDestino).map(f => { const origem = p.historico.find(o => o.id === f.depois.comando?.ocorrenciaId)?.depois.destinoFisico; return <p className="text-sm" key={f.id}>Destino registrado de {origem?.produto}: recuperável {f.depois.resolucaoDestino!.recuperavel} {origem?.unidade} · perda {f.depois.resolucaoDestino!.perda} {origem?.unidade} · {f.depois.resolucaoDestino!.destino} · {f.usuarioNome} · {new Date(f.createdAt).toLocaleString("pt-BR", { timeZone: p.fusoHorario ?? "America/Sao_Paulo" })}</p>; })}
{editar && p.status !== "RASCUNHO" && <><label className="grid gap-1 text-sm">Motivo / descrição<Input value={motivo} onChange={e => { alterar(); setMotivo(e.target.value); }} maxLength={1000} /></label><GrupoAcoes alinhamento="inicio" nome="Registrar ocorrência de entrega"><Button variant="outline" disabled={ocupado || !motivo.trim()} onClick={() => executar({ tipo: "OCORRENCIA", motivo })}>Registrar ocorrência</Button>{aberto && !p.entregueEm && p.atendimento === "ENTREGA" && p.statusOperacional === "EM_ENTREGA" && <Button variant="outline" disabled={ocupado || !motivo.trim()} onClick={() => executar({ tipo: "OCORRENCIA", natureza: "FALHA_ENTREGA", motivo })}>Registrar falha de entrega</Button>}</GrupoAcoes></>}
    {editar && p.status !== "RASCUNHO" && p.itens?.length ? <div className="grid gap-3 border-t pt-3 sm:grid-cols-2"><label className="grid gap-1 text-sm">Item devolvido<SelecaoFormulario aria-label="Item devolvido" value={itemDevolvido} onValueChange={v => { alterar(); setItemDevolvido(v); }}><option value="">Selecione</option>{p.itens.map(i => <option key={i.id} value={i.id}>{i.produtoSnapshot.nome} ({i.unidadeSnapshot})</option>)}</SelecaoFormulario></label><label className="grid gap-1 text-sm">Quantidade devolvida<Input value={quantidadeDevolvida} min={0} inputMode="decimal" casasDecimais={6} maxLength={17} onChange={e => { alterar(); setQuantidadeDevolvida(e.target.value); }} /></label><Button variant="outline" disabled={ocupado || !motivo.trim() || !itemDevolvido || !quantidadeDevolvida} onClick={() => executar({ tipo: "OCORRENCIA", natureza: "DEVOLUCAO", itemId: itemDevolvido, quantidade: quantidadeDevolvida.replace(",", "."), motivo })}>Registrar devolução física</Button></div> : null}
  </section>;
}
