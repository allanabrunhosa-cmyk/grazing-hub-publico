"use client";
import { useContext, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PedidoPopupContext } from "./modal-pedido";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { SelecaoFormulario } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CampoBusca } from "@/components/campo-busca";
import { BotaoRemoverItem } from "@/components/remover-item";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { cents } from "@/lib/vendas/entregas-dominio";
import { buscarDespesasEntregaAction, vincularDespesaEntregaAction, desvincularDespesaEntregaAction } from "./custos-entrega-actions";
type Despesa = { id: string; descricao: string; categoria: string; valor: string; disponivel: string; revisao: string; status: string; competencia: string };
export type VinculoDespesaEntrega = { id: string; valor: string; lancamento: { descricao: string; status: string } };
const moeda = (v: string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function DespesasEntrega({ pedidoId, versao, efetivo, vinculos, financeiroHref }: { pedidoId: string; versao: number; efetivo: string | null; vinculos: VinculoDespesaEntrega[]; financeiroHref: string }) {
  const popup = useContext(PedidoPopupContext);
  const router = useRouter(), trava = useRef(false), tentativa = useRef<{ texto: string; chave: string } | null>(null);
  const [aberto, setAberto] = useState(false), [remover, setRemover] = useState<string | null>(null), [busca, setBusca] = useState(""), [despesas, setDespesas] = useState<Despesa[]>([]), [id, setId] = useState(""), [valor, setValor] = useState(""), [motivo, setMotivo] = useState(""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const pendente = efetivo == null ? null : vinculos.reduce((s, v) => s - cents(v.valor), cents(efetivo));
  async function pesquisar() { if (trava.current) return; trava.current = true; setOcupado(true); setErro(""); try { const r = await buscarDespesasEntregaAction(busca); if ("erro" in r) setErro(r.erro ?? "Busca indisponível"); else { setDespesas(r.despesas); setId(""); if (!r.despesas.length) setErro("Nenhuma despesa encontrada. Cadastre no Financeiro ou refine a busca."); } } catch { setErro("Não foi possível buscar; tente novamente."); } finally { trava.current = false; setOcupado(false); } }
  async function salvar() {
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações comerciais antes desta ação."); return; }
    if (trava.current) return; const d = despesas.find(d => d.id === id); if (!remover && !d) return;
    trava.current = true; setOcupado(true); setErro(""); const dados = { pedidoId, versao, lancamentoId: id, revisao: d?.revisao ?? "", valor, motivo }; const texto = JSON.stringify({ ...dados, remover }); if (tentativa.current?.texto !== texto) tentativa.current = { texto, chave: crypto.randomUUID() };
    try { const r = remover ? await desvincularDespesaEntregaAction(remover, motivo, tentativa.current.chave) : await vincularDespesaEntregaAction({ ...dados, chave: tentativa.current.chave }); if ("erro" in r) setErro(r.erro ?? "Não foi possível concluir."); else { setAberto(false); setRemover(null); setMotivo(""); router.refresh(); } } catch { setErro("Resultado não confirmado. Confira os vínculos antes de repetir; os dados foram preservados."); } finally { trava.current = false; setOcupado(false); }
  }
  function abrir(removerId: string | null) { setRemover(removerId); setErro(""); setMotivo(""); setId(""); setValor(""); setDespesas([]); setAberto(true); }
  return <Card><CardHeader><CardTitle>Despesa da entrega</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Vincule a despesa já registrada ou conciliada no Financeiro, inteira ou rateada. O vínculo não cria outro lançamento, receita, pagamento ou movimento de caixa.</p><p className="text-sm">{pendente == null ? "Registre o custo efetivo antes de vincular despesas." : `Custo ainda sem vínculo financeiro: ${moeda((Number(pendente) / 100).toFixed(2))}`}</p>
    <ul className="space-y-2">{vinculos.map(v => <li key={v.id} className="flex items-center justify-between gap-3"><span className="min-w-0 break-words text-sm">{v.lancamento.descricao} · {moeda(v.valor)} · {v.lancamento.status === "BAIXADO" ? "Pago" : "Em aberto"}</span><BotaoRemoverItem nome={`Desvincular despesa ${v.lancamento.descricao}`} disabled={ocupado} onClick={() => abrir(v.id)} /></li>)}</ul>
    <GrupoAcoes className="flex-wrap"><Button variant="outline" nativeButton={false} role="link" render={<a href={financeiroHref} target="_blank" rel="noreferrer" />}>Abrir Financeiro</Button><Button type="button" variant="outline" disabled={ocupado || pendente == null || pendente <= 0} onClick={() => abrir(null)}>Vincular despesa existente</Button></GrupoAcoes>
    <Dialog open={aberto} alterado={!!(id || valor || motivo)} protegerAlteracoes={!ocupado} onOpenChange={v => { if (!ocupado) setAberto(v); }}><DialogContent className="sm:max-w-lg" showCloseButton={!ocupado}><DialogHeader><DialogTitle>{remover ? "Desvincular despesa" : "Vincular despesa da entrega"}</DialogTitle><DialogDescription>{remover ? "O lançamento e seu pagamento permanecem no Financeiro. O pedido voltará a mostrar o custo sem vínculo." : "Escolha uma despesa existente e informe quanto pertence a esta entrega. A categoria e a competência permanecem as do lançamento original."}</DialogDescription></DialogHeader><fieldset disabled={ocupado} className="min-w-0 space-y-4">
    {!remover && <><div className="space-y-2"><Label htmlFor="busca-despesa-entrega">Buscar descrição ou fornecedor</Label><CampoBusca id="busca-despesa-entrega" value={busca} maxLength={120} onChange={setBusca} /><Button type="button" variant="outline" disabled={busca.trim().length < 2 || ocupado} onClick={() => void pesquisar()}>{ocupado ? "Buscando…" : "Buscar despesas"}</Button></div><div className="space-y-2"><Label>Despesa existente</Label><SelecaoFormulario aria-label="Despesa existente" value={id} onValueChange={setId}><option value="">Selecione entre os resultados</option>{despesas.map(d => <option key={d.id} value={d.id}>{d.descricao} · {d.categoria} · disponível {moeda(d.disponivel)}</option>)}</SelecaoFormulario><p className="text-xs text-muted-foreground">Até 50 resultados por busca. Refine a descrição para localizar despesas antigas.</p></div><div className="space-y-2"><Label htmlFor="valor-despesa-entrega">Valor desta entrega</Label><CurrencyInput id="valor-despesa-entrega" value={valor} onValueChange={setValor} /></div></>}
    <div className="space-y-2"><Label htmlFor="motivo-despesa-entrega">Justificativa do vínculo</Label><Input id="motivo-despesa-entrega" value={motivo} maxLength={1000} onChange={e => setMotivo(e.target.value)} /></div></fieldset>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><DialogClose render={<Button type="button" variant="outline" disabled={ocupado} />}>Voltar</DialogClose><Button type="button" disabled={ocupado || !motivo.trim() || (!remover && (!id || !valor))} onClick={() => void salvar()}>{ocupado ? "Registrando…" : remover ? "Confirmar desvinculação" : "Confirmar vínculo"}</Button></GrupoAcoes></DialogContent></Dialog>
  </CardContent></Card>;
}
