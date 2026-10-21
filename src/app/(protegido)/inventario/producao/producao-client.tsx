"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { SelecaoFormulario } from "@/components/ui/select";
import { diaNoFuso } from "@/lib/vendas/pedidos-agenda-dominio";
import { registrarProducaoPreparacaoAction, corrigirProducaoPreparacaoAction } from "./actions";
type Preparacao = { id: string; nome: string; unidade: string; revisao: string; ingredientes: { id: string; nome: string; unidade: string }[] };
type Registro = { id: string; nome: string; local: string; autor: string; data: string; quantidade: string; unidade: string; motivo: string; corrigido: boolean; ingredientes: { nome: string; unidade: string; quantidadeConsumida: string }[] };
export function ProducaoPreparacoes({ editar, admin, locais, preparacoes, registros }: { editar: boolean; admin: boolean; locais: { id: string; nome: string }[]; preparacoes: Preparacao[]; registros: Registro[] }) {
  const [novo, setNovo] = useState(false), [registro, setRegistro] = useState<Registro | null>(null);
  return <div className="space-y-5"><BarraAcoes titulo="Produção de preparações" descricao="Registre ingredientes consumidos e rendimento real que entrou no estoque.">{editar && <Button onClick={() => setNovo(true)}><Plus />Registrar produção</Button>}</BarraAcoes>
    <Card><CardContent><p className="mb-4 text-sm text-muted-foreground">Últimos 50 registros. Produzir uma preparação movimenta seus ingredientes e seu resultado. Vender a preparação usa esse estoque, sem consumir os ingredientes outra vez. Custos não apurados permanecem pendentes; este registro não gera despesa financeira nem etiqueta.</p>
      <Table><TableHeader><TableRow><TableHead>Preparação</TableHead><TableHead>Produzido</TableHead><TableHead>Local e data</TableHead><TableHead>Registro</TableHead></TableRow></TableHeader><TableBody>{registros.map(r => <TableRow key={r.id}><TableCell>{r.nome}{r.corrigido && <p className="text-sm text-muted-foreground">Apontamento corrigido</p>}</TableCell><TableCell>{r.quantidade} {r.unidade}</TableCell><TableCell>{r.local}<p className="text-sm text-muted-foreground">{new Date(r.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></TableCell><TableCell><Button variant="outline" onClick={() => setRegistro(r)}>Ver registro</Button></TableCell></TableRow>)}{!registros.length && <TableRow><TableCell colSpan={4}>Nenhuma produção registrada.</TableCell></TableRow>}</TableBody></Table>
    </CardContent></Card>
    {novo && <NovaProducao preparacoes={preparacoes} locais={locais} fechar={() => setNovo(false)} />}
    {registro && <Detalhe registro={registro} admin={admin} fechar={() => setRegistro(null)} />}
  </div>;
}
function NovaProducao({ preparacoes, locais, fechar }: { preparacoes: Preparacao[]; locais: { id: string; nome: string }[]; fechar: () => void }) {
  const router = useRouter();
  const [dataInicial] = useState(() => diaNoFuso(new Date(), "America/Sao_Paulo"));
  const [id, setId] = useState(""), [local, setLocal] = useState(""), [q, setQ] = useState(""), [data, setData] = useState(diaNoFuso(new Date(), "America/Sao_Paulo")), [motivo, setMotivo] = useState(""), [itens, setItens] = useState<Record<string, string>>({}), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const trava = useRef(false), tentativa = useRef<{ texto: string; chave: string } | null>(null);
  const p = preparacoes.find(p => p.id === id);
  async function salvar() {
    if (trava.current || !p) return; trava.current = true; setOcupado(true); setErro("");
    const dados = { preparacaoId: id, revisao: p.revisao, localId: local, quantidade: q, data, motivo, ingredientes: p.ingredientes.map(i => ({ insumoId: i.id, quantidade: itens[i.id] ?? "" })) };
    const texto = JSON.stringify(dados); if (tentativa.current?.texto !== texto) tentativa.current = { texto, chave: crypto.randomUUID() };
    try { const r = await registrarProducaoPreparacaoAction({ ...dados, chave: tentativa.current.chave }); if ("erro" in r) setErro(r.erro ?? "Não foi possível registrar."); else { fechar(); router.refresh(); } }
    catch { setErro("Resultado não confirmado. Confira o histórico antes de repetir; os dados foram preservados."); }
    finally { trava.current = false; setOcupado(false); }
  }
  return <Dialog open alterado={!!(id || local || q || motivo || data !== dataInicial)} protegerAlteracoes={!ocupado} onOpenChange={aberto => { if (!aberto && !ocupado) fechar(); }}><DialogContent className="sm:max-w-lg" showCloseButton={!ocupado}><DialogHeader><DialogTitle>Registrar produção física</DialogTitle><DialogDescription>Informe as quantidades realmente produzidas e consumidas, na unidade de estoque indicada. Não use estimativas como apontamento realizado.</DialogDescription></DialogHeader>
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void salvar(); }}><fieldset disabled={ocupado} className="min-w-0 space-y-4">
      <div className="space-y-2"><Label>Preparação</Label><SelecaoFormulario aria-label="Preparação" value={id} onValueChange={v => { setId(v); setItens({}); }}><option value="">Selecione</option>{preparacoes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</SelecaoFormulario></div>
      <div className="space-y-2"><Label>Local do estoque</Label><SelecaoFormulario aria-label="Local do estoque" value={local} onValueChange={setLocal}><option value="">Selecione</option>{locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}</SelecaoFormulario></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="producao-q">Rendimento real{p ? ` (${p.unidade})` : ""}</Label><Input id="producao-q" inputMode="decimal" restricao="decimal" casasDecimais={6} maxLength={19} min={0} value={q} onChange={e => setQ(e.target.value.replace(",", "."))} required /></div><div className="space-y-2"><Label htmlFor="producao-data">Data da produção</Label><Input id="producao-data" type="date" value={data} onChange={e => setData(e.target.value)} required /></div></div>
      {p && <div className="space-y-3"><h3 className="font-semibold">Ingredientes efetivamente consumidos</h3>{!p.ingredientes.length && <p className="text-sm text-muted-foreground">Complete a composição desta preparação em Insumos.</p>}{p.ingredientes.map(i => <div key={i.id} className="space-y-2"><Label htmlFor={`consumo-${i.id}`}>{i.nome} ({i.unidade})</Label><Input id={`consumo-${i.id}`} inputMode="decimal" restricao="decimal" casasDecimais={6} maxLength={19} min={0} required value={itens[i.id] ?? ""} onChange={e => setItens(a => ({ ...a, [i.id]: e.target.value.replace(",", ".") }))} /></div>)}</div>}
      <div className="space-y-2"><Label htmlFor="producao-motivo">Referência ou observação do lote</Label><Input id="producao-motivo" value={motivo} maxLength={1000} required onChange={e => setMotivo(e.target.value)} /></div>
    </fieldset>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<GrupoAcoes><DialogClose render={<Button type="button" variant="outline" disabled={ocupado} />}>Cancelar</DialogClose><Button type="submit" disabled={ocupado || !p?.ingredientes.length || !local || !q || !data || !motivo.trim()}>{ocupado ? "Registrando…" : "Confirmar produção"}</Button></GrupoAcoes></form>
  </DialogContent></Dialog>;
}
function Detalhe({ registro: r, admin, fechar }: { registro: Registro; admin: boolean; fechar: () => void }) {
  const router = useRouter(); const [motivo, setMotivo] = useState(""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false); const trava = useRef(false), chave = useRef(crypto.randomUUID());
  async function corrigir() {
    if (trava.current) return; trava.current = true; setOcupado(true); setErro("");
    try { const resposta = await corrigirProducaoPreparacaoAction(r.id, motivo, chave.current); if ("erro" in resposta) setErro(resposta.erro ?? "Não foi possível corrigir."); else { fechar(); router.refresh(); } } catch { setErro("Resultado não confirmado. Confira o registro antes de repetir."); } finally { trava.current = false; setOcupado(false); }
  }
  return <Dialog open alterado={!!motivo} protegerAlteracoes={!ocupado} onOpenChange={aberto => { if (!aberto && !ocupado) fechar(); }}><DialogContent><DialogHeader><DialogTitle>{r.nome}</DialogTitle><DialogDescription>Produzido: {r.quantidade} {r.unidade} · {r.local}. Autor: {r.autor}. Custo não apurado.</DialogDescription></DialogHeader><p>{r.motivo}</p><ul className="space-y-2">{r.ingredientes.map((i, n) => <li key={n}>{i.nome}: {i.quantidadeConsumida} {i.unidade}</li>)}</ul>{r.corrigido ? <p>Apontamento corrigido; os movimentos originais e seus ajustes permanecem no histórico.</p> : admin && <div className="space-y-3"><p className="text-sm text-muted-foreground">Correção administrativa é exclusiva para registro incorreto. Uma preparação realmente produzida não volta a ser ingredientes: registre perda ou destino físico no fluxo correspondente.</p><Label htmlFor="correcao-producao">Motivo da correção administrativa</Label><Input id="correcao-producao" value={motivo} disabled={ocupado} maxLength={1000} onChange={e => setMotivo(e.target.value)} /><Button variant="outline" disabled={ocupado || !motivo.trim()} onClick={() => void corrigir()}>{ocupado ? "Corrigindo…" : "Confirmar correção do apontamento"}</Button></div>}{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}</DialogContent></Dialog>;
}
