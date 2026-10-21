"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TriangleAlert } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { SelecaoFormulario } from "@/components/ui/select";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { BotaoRemoverItem } from "@/components/remover-item";
import type { PedidoDetalhado } from "./detalhe-pedido";
import type { Dados, Capacidades } from "./editor-pedido";
import { cancelarPedidoVendaAction, mudarEstadoDevolucaoPedidoAction, retomarDevolucaoPedidoAction, concluirDevolucaoContextualAction } from "./actions";
import { EncerramentoManual } from "./encerramento-manual";
import { TratamentoBoleto } from "./tratamento-boleto";
import { aceitaMotivoCancelamento, aceitaNomeResponsavelCancelamento, LIMITE_MOTIVO_CANCELAMENTO, LIMITE_RESPONSAVEL_CANCELAMENTO, nomeResponsavelCancelamentoValido } from "@/lib/vendas/cancelamento-pedido-dominio";
const moeda = (v: string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const estados: Record<string, string> = { SOLICITADA: "Devolução solicitada", PROCESSANDO: "Devolução em processamento", FALHA: "Falha na devolução", CONCLUIDA: "Devolução concluída", CANCELADA: "Solicitação interrompida" };
export function CancelamentoPedido({ pedido: p, dados, capacidades: c, responsavel, aberto: abertoControlado, aoMudarAberto, mostrarGatilho = true }: { pedido: PedidoDetalhado; dados: Dados; capacidades: Capacidades; responsavel: string; aberto?: boolean; aoMudarAberto?: (aberto: boolean) => void; mostrarGatilho?: boolean }) {
  const router = useRouter(), [abertoInterno, setAbertoInterno] = useState(false), [ocupado, iniciar] = useTransition(), trava = useRef(false), chaves = useRef<Record<string, string>>({});
  const aberto = abertoControlado ?? abertoInterno;
  function setAberto(valor: boolean) { if (abertoControlado === undefined) setAbertoInterno(valor); aoMudarAberto?.(valor); }
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [motivo, setMotivo] = useState(""), [mensagem, setMensagem] = useState(""), [destino, setDestino] = useState("DEVOLUCAO"), [reter, setReter] = useState("0.00"), [politica, setPolitica] = useState(""), [comunicacao, setComunicacao] = useState(""), [escolha, setEscolha] = useState("");
  const [conta, setConta] = useState(""), [data, setData] = useState(""), [evidencia, setEvidencia] = useState("");
  const financeiro = p.financeiro, externo = p.modoFinanceiro === "EXTERNO";
  const disponivel = Number(p.status === "CONFIRMADO" ? financeiro?.elegivelCancelamento ?? 0 : financeiro?.elegivel ?? 0);
  const retencao = destino === "DEVOLUCAO" ? Number(reter) : 0;
  const retencaoInvalida = !Number.isFinite(retencao) || retencao < 0 || retencao > disponivel;
  const tratamentos = (financeiro?.tratamentos ?? []).filter(t => t.tipo === "DEVOLUCAO");
  const podeCancelar = p.status === "CONFIRMADO" && p.statusOperacional !== "ENTREGUE" && p.origem !== "IFOOD" && c.cancelar;
  const permite = c.cancelar && c.receber;
  function executar(dadosAcao: unknown, fn: (k: string) => Promise<{ erro?: string; ok?: boolean }>, sucesso: string) {
    if (trava.current) return; trava.current = true;
    const assinatura = JSON.stringify(dadosAcao);
    iniciar(async () => { try { const r = await fn(chaves.current[assinatura] ??= crypto.randomUUID()); if (r.erro) setMensagem(r.erro); else { delete chaves.current[assinatura]; setMensagem(sucesso); router.refresh(); } } catch { setMensagem("Resultado não confirmado. Atualize antes de repetir; seu preenchimento foi mantido."); } finally { trava.current = false; } });
  }
  if (!podeCancelar && p.status !== "CANCELADO" && p.status !== "ESTORNADO") return null;
  return <div className="space-y-2 text-sm">
    {mostrarGatilho && tratamentos.map(t => <p key={t.id} role={t.status === "FALHA" ? "alert" : "status"}>{estados[t.status] ?? t.status} · {moeda(t.valor)}</p>)}
    {mostrarGatilho && (podeCancelar ? <BotaoRemoverItem nome="Cancelar pedido" disabled={ocupado} onClick={() => setAberto(true)} /> : <Button variant="ghost" onClick={() => setAberto(true)}>Ver cancelamento</Button>)}
    {/* A fase confirmada pelo servidor inicia uma proteção nova; drafts de pós-venda permanecem na mesma fase. */}
    <Dialog key={podeCancelar ? "cancelamento" : "devolucao"} open={aberto} onOpenChange={(v, detalhes) => { if (!v && (ocupado || trava.current)) detalhes.cancel(); else setAberto(v); }} protegerAlteracoes={!ocupado}><DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto"><DialogHeader><DialogTitle>{podeCancelar ? "Cancelar pedido" : "Cancelamento e devolução"}</DialogTitle><DialogDescription>Pedido #{p.numero} · Registro por: {responsavel}</DialogDescription></DialogHeader>
      <fieldset disabled={ocupado} className="grid min-w-0 gap-3">
        {podeCancelar && <><Label className="grid gap-2">Nome do responsável<Input autoComplete="off" required maxLength={LIMITE_RESPONSAVEL_CANCELAMENTO} value={nomeResponsavel} onChange={e => { if (aceitaNomeResponsavelCancelamento(e.target.value)) setNomeResponsavel(e.target.value); else e.target.value = nomeResponsavel; }} onKeyDown={e => { if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1 && !aceitaNomeResponsavelCancelamento(e.key)) e.preventDefault(); }} onPaste={e => { const el = e.currentTarget, texto = e.clipboardData.getData("text"); const proposta = el.value.slice(0, el.selectionStart ?? 0) + texto + el.value.slice(el.selectionEnd ?? el.value.length); if (!aceitaNomeResponsavelCancelamento(proposta)) e.preventDefault(); }} /></Label>
          <Label className="grid gap-2">Motivo<Textarea required maxLength={LIMITE_MOTIVO_CANCELAMENTO} value={motivo} onChange={e => { if (aceitaMotivoCancelamento(e.target.value)) setMotivo(e.target.value); else e.target.value = motivo; }} onPaste={e => { const el = e.currentTarget, texto = e.clipboardData.getData("text"); if (!aceitaMotivoCancelamento(el.value.slice(0, el.selectionStart) + texto + el.value.slice(el.selectionEnd))) e.preventDefault(); }} /></Label>
          <section aria-label="Consequências do cancelamento" className="space-y-2 rounded-[var(--ds-controle-raio)] border bg-muted/50 p-3 text-sm">
            <Badge variant="warning"><TriangleAlert aria-hidden />Antes de confirmar</Badge>
            <p>O pedido será interrompido. Cobranças pendentes sem captura serão canceladas; pagamentos já registrados, capturas de cartão e histórico serão preservados. Cancelar não transfere valores nem estorna cartão automaticamente.</p>
            <p>Reservas ainda não consumidas serão liberadas. Materiais já consumidos e produtos preparados precisam de destinação própria: cancelar não os devolve automaticamente ao estoque.</p>
          </section>
          {externo ? <p className="text-sm">O pagamento é controlado externamente. A devolução precisará de comprovação no mesmo fluxo após cancelar.</p> : disponivel > 0 ? destino === "CREDITO" ? <p className="text-sm">{moeda(String(disponivel))} será convertido em crédito escolhido pelo comprador, sem devolver dinheiro.</p> : retencaoInvalida ? <p role="alert">A retenção deve estar entre zero e {moeda(String(disponivel))}.</p> : <p className="text-sm">{moeda(String(disponivel - retencao))} será encaminhado para devolução. A solicitação só será concluída após comprovação.{retencao > 0 && ` Retenção justificada: ${moeda(String(retencao))}.`}</p> : <p className="text-sm">Sem valor pago disponível para devolver. Não será criada devolução.</p>}
          {Number(financeiro?.creditoRestauravel ?? 0) > 0 && <p className="text-sm">Crédito utilizado será restaurado ao comprador, sem movimentar dinheiro.</p>}
          {disponivel > 0 && c.condicao && <details><summary className="cursor-pointer text-sm">Devolução parcial ou crédito acordado com o cliente</summary><div className="mt-3 grid gap-3"><Label className="grid gap-2">Destino do pagamento<SelecaoFormulario aria-label="Destino do pagamento" value={destino} onValueChange={setDestino}><option value="DEVOLUCAO">Devolver ao cliente</option>{p.clienteId && <option value="CREDITO">Crédito escolhido pelo comprador</option>}</SelecaoFormulario></Label>{destino === "DEVOLUCAO" ? <><Label className="grid gap-2">Retenção justificada<CurrencyInput aria-label="Retenção justificada" value={reter} onValueChange={setReter} /></Label>{Number(reter) > 0 && <Label className="grid gap-2">Política que justifica a retenção<Input maxLength={180} value={politica} onChange={e => setPolitica(e.target.value)} /></Label>}</> : <Label className="grid gap-2">Data da escolha do comprador<Input type="date" value={escolha} onChange={e => setEscolha(e.target.value)} /></Label>}<Label className="grid gap-2">Referência da comunicação<Input maxLength={180} value={comunicacao} onChange={e => setComunicacao(e.target.value)} /></Label></div></details>}
          {disponivel > 0 && !permite && <p role="alert">Seu perfil não permite tratar os valores pagos. Um responsável autorizado precisa confirmar o cancelamento.</p>}
          <GrupoAcoes nome="Confirmação do cancelamento" alinhamento="fim"><Button type="button" variant="saida" disabled={ocupado || !nomeResponsavelCancelamentoValido(nomeResponsavel) || !motivo.trim() || disponivel > 0 && (!permite || retencaoInvalida)} aria-busy={ocupado || undefined} onClick={() => { const tratamento = { destino: destino as "DEVOLUCAO" | "CREDITO", reter, politica, comunicacao, dataEscolha: escolha }; executar({ tipo: "cancelar", versao: p.versao, motivo, tratamento, responsavelInformado: nomeResponsavel }, k => cancelarPedidoVendaAction(p.id, p.versao, motivo, k, tratamento, nomeResponsavel), "Pedido cancelado. Confira a situação da devolução abaixo."); }}>{ocupado ? "Cancelando…" : "Confirmar cancelamento"}</Button></GrupoAcoes>
        </>}
        {!podeCancelar && externo && c.cancelar && p.status === "CANCELADO" && <EncerramentoManual id={p.id} versao={p.versao} estado="ESTORNADO" />}
        {!podeCancelar && !externo && (c.condicao || c.receber) && financeiro?.externos?.filter(e => e.tipo === "BOLETO" && e.status !== "PAGO_TARDIO").map(e => <TratamentoBoleto key={e.id} pedidoId={p.id} cobrancaId={e.id} tardio contas={dados.contas} />)}
        {!podeCancelar && tratamentos.map(t => <section key={t.id} className="space-y-3 border-t pt-3"><h3 className="text-sm font-semibold">{estados[t.status]} · {moeda(t.valor)}</h3>{Number(t.retido) > 0 && <p>Retido: {moeda(t.retido)} · {t.motivo}</p>}{t.status === "CONCLUIDA" && <p>Comprovação: {t.evidenciaConclusao}</p>}{permite && t.status === "SOLICITADA" && <Button variant="outline" onClick={() => executar({ tipo: "processar", id: t.id }, k => mudarEstadoDevolucaoPedidoAction(p.id, t.id, "PROCESSANDO", "", k), "Devolução em processamento. Conclua somente após comprovar o resultado.")}>Registrar processamento</Button>}{permite && t.status === "FALHA" && <Button variant="outline" onClick={() => executar({ tipo: "retomar", id: t.id }, k => retomarDevolucaoPedidoAction(p.id, t.id, k), "Solicitação retomada; nenhum pagamento foi reenviado automaticamente.")}>Retomar devolução</Button>}{permite && t.status === "PROCESSANDO" && <><Label className="grid gap-2">Conta de onde o valor saiu<SelecaoFormulario aria-label="Conta da devolução" value={conta} onValueChange={setConta}><option value="">Selecione</option>{dados.contas.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}</SelecaoFormulario></Label><Label className="grid gap-2">Data da devolução<Input type="date" value={data} onChange={e => setData(e.target.value)} /></Label><Label className="grid gap-2">Comprovação da devolução<Input value={evidencia} maxLength={180} onChange={e => setEvidencia(e.target.value)} /></Label><GrupoAcoes nome="Resultado da devolução" className="flex-wrap" alinhamento="inicio">{c.condicao && <Button disabled={!conta || !data || !evidencia.trim()} onClick={() => executar({ tipo: "concluir", id: t.id, conta, data, evidencia }, k => concluirDevolucaoContextualAction(p.id, t.id, conta, data, evidencia, k), "Devolução concluída com comprovação.")}>Confirmar devolução realizada</Button>}<Button variant="ghost" disabled={!evidencia.trim()} onClick={() => executar({ tipo: "falha", id: t.id, evidencia }, k => mudarEstadoDevolucaoPedidoAction(p.id, t.id, "FALHA", evidencia, k), "Falha registrada. A solicitação poderá ser retomada neste fluxo.")}>Registrar falha</Button></GrupoAcoes></>}</section>)}
        {!podeCancelar && financeiro?.tratamentos?.filter(t => t.tipo === "CREDITO").map(t => <p key={t.id}>Crédito concedido ao comprador: {moeda(t.valor)}.</p>)}
        {!podeCancelar && !externo && !tratamentos.length && <p>Nenhuma devolução de dinheiro necessária.{Number(financeiro?.creditoRestaurado ?? 0) > 0 ? " Crédito do comprador restaurado." : ""}</p>}
        {mensagem && <p role="status">{mensagem}</p>}
      </fieldset>
    </DialogContent></Dialog>
  </div>;
}
