"use client";
import { useId, useRef, useState, useTransition } from "react";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelecaoFormulario } from "@/components/ui/select";
import { BotaoRemoverItem } from "@/components/remover-item";
import type { CobrancaAsaasInterface } from "@/lib/asaas/cobrancas";

type Resultado<T> = ({ ok: true } & T) | { erro: string };
export type AcoesCobrancaAsaas = {
  gerar: (pedidoId: string, entrada: { forma: string; vencimento: string }, operacao: string) => Promise<Resultado<{ cobranca: CobrancaAsaasInterface }>>;
  cancelar: (cobrancaId: string) => Promise<Resultado<{ cobranca: CobrancaAsaasInterface }>>;
  pix: (cobrancaId: string) => Promise<Resultado<{ pix: { copiaCola: string; imagem: string | null; expiraEm: string | null } }>>;
};
export type PedidoSiteInterface = { numero: string; status: string; pendencia: string | null };

const moeda = (v: string) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dia = (v: string | null) => v ? v.split("-").reverse().join("/") : "";
const FORMAS: Record<string, string> = { PIX: "Pix", BOLETO: "Boleto", CARTAO_CREDITO: "Cartão de crédito", INDEFINIDA: "Cliente escolhe" };
const STATUS_SITE: Record<string, string> = { pending: "Aguardando pagamento", "on-hold": "Aguardando confirmação", processing: "Pago, em processamento", completed: "Concluído", cancelled: "Cancelado", refunded: "Reembolsado", failed: "Pagamento não concluído" };
function situacao(c: CobrancaAsaasInterface): { rotulo: string; variante: "success" | "warning" | "muted" | "destructive" } {
  if (c.estado === "ENVIANDO" || c.estado === "INCERTA") return { rotulo: "Em conferência", variante: "warning" };
  if (c.estado === "FALHOU") return { rotulo: "Não gerada", variante: "muted" };
  return ({ AGUARDANDO: { rotulo: "Aguardando pagamento", variante: "warning" }, PAGA: { rotulo: "Paga", variante: "success" }, VENCIDA: { rotulo: "Vencida", variante: "destructive" }, ESTORNADA: { rotulo: "Estornada", variante: "muted" }, CONTESTADA: { rotulo: "Contestada", variante: "destructive" }, REMOVIDA: { rotulo: "Cancelada", variante: "muted" } } as const)[c.situacao as "AGUARDANDO"] ?? { rotulo: c.situacao, variante: "muted" };
}

/** Cobrança do pedido no Asaas e origem do site. Não lança títulos nem baixas no Financeiro. */
export function CobrancaAsaasPedido({ pedidoId, total, hoje, cobrancas: iniciais, podeCobrar, motivoBloqueio, site, acoes }: { pedidoId: string; total: string; hoje: string; cobrancas: CobrancaAsaasInterface[]; podeCobrar: boolean; motivoBloqueio?: string; site?: PedidoSiteInterface | null; acoes: AcoesCobrancaAsaas }) {
  const id = useId(), [cobrancas, setCobrancas] = useState(iniciais), [aberto, setAberto] = useState(false);
  const [forma, setForma] = useState("PIX"), [vencimento, setVencimento] = useState(hoje), [erro, setErro] = useState(""), [aviso, setAviso] = useState("");
  const [pix, setPix] = useState<{ cobrancaId: string; copiaCola: string; imagem: string | null } | null>(null);
  const [pendente, iniciar] = useTransition(), trava = useRef(false), operacao = useRef<string | null>(null);
  const emAberto = cobrancas.some(c => c.origem === "HUB" && (c.estado === "ENVIANDO" || c.estado === "INCERTA" || c.estado === "ATIVA" && ["AGUARDANDO", "VENCIDA"].includes(c.situacao)));
  const paga = cobrancas.some(c => c.estado === "ATIVA" && c.situacao === "PAGA");
  const substituir = (c: CobrancaAsaasInterface) => setCobrancas(lista => lista.some(x => x.id === c.id) ? lista.map(x => x.id === c.id ? c : x) : [c, ...lista]);
  function executar(tarefa: () => Promise<void>) {
    if (trava.current) return;
    trava.current = true; setErro(""); setAviso("");
    iniciar(async () => { try { await tarefa(); } catch { setErro("Não foi possível concluir. Confira a cobrança antes de tentar de novo."); } finally { trava.current = false; } });
  }
  const gerar = () => executar(async () => {
    // A mesma chave acompanha novas tentativas do mesmo formulário: repetir não cobra duas vezes.
    operacao.current ??= crypto.randomUUID();
    const r = await acoes.gerar(pedidoId, { forma, vencimento }, operacao.current);
    if ("erro" in r) { setErro(r.erro); operacao.current = null; return; }
    substituir(r.cobranca); operacao.current = null; setAberto(false);
    setAviso(r.cobranca.estado === "ATIVA" ? "Cobrança gerada. Envie o link ao cliente." : "O Asaas não confirmou a criação. O HUB confere sozinho e atualiza esta cobrança.");
  });
  const cancelar = (c: CobrancaAsaasInterface) => executar(async () => { const r = await acoes.cancelar(c.id); if ("erro" in r) setErro(r.erro); else { substituir(r.cobranca); setPix(null); setAviso("Cobrança cancelada no Asaas."); } });
  const verPix = (c: CobrancaAsaasInterface) => executar(async () => { const r = await acoes.pix(c.id); if ("erro" in r) setErro(r.erro); else setPix({ cobrancaId: c.id, ...r.pix }); });
  const copiar = (texto: string, nome: string) => { void navigator.clipboard?.writeText(texto).then(() => setAviso(`${nome} copiado.`), () => setErro("Não foi possível copiar. Selecione e copie manualmente.")); };

  return <div className="space-y-3 border-t pt-3" data-cobranca-asaas>
    {site && <div className="space-y-1"><p className="text-sm">Pedido #{site.numero} do site · {STATUS_SITE[site.status] ?? site.status}</p>{site.pendencia && <p role="status" className="text-sm text-warning">{site.pendencia}</p>}</div>}
    {cobrancas.length > 0 && <ul className="space-y-3" aria-label="Cobranças no Asaas">{cobrancas.map(c => { const s = situacao(c), aberta = c.estado === "ATIVA" && ["AGUARDANDO", "VENCIDA"].includes(c.situacao); return <li key={c.id} className="space-y-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm font-medium">{moeda(c.valor)} · {FORMAS[c.forma] ?? c.forma}{c.origem === "SITE" ? " · site" : ""}</span>
        <Badge variant={s.variante}>{s.rotulo}</Badge>
        {aberta && c.origem === "HUB" && podeCobrar && <BotaoRemoverItem nome="Cancelar cobrança no Asaas" disabled={pendente} onClick={() => cancelar(c)} />}
      </div>
      <p className="text-xs text-muted-foreground">{c.situacao === "PAGA" && c.pagoEm ? `Paga em ${dia(c.pagoEm)}` : `Vencimento ${dia(c.vencimento)}`}{c.liquido && c.situacao === "PAGA" ? ` · líquido ${moeda(c.liquido)}` : ""}{c.ambiente === "SANDBOX" ? " · ambiente de testes" : ""}</p>
      {c.erro && <p className="text-xs text-muted-foreground">{c.erro}</p>}
      {aberta && c.link && <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={() => copiar(c.link!, "Link de pagamento")}><Copy aria-hidden className="size-4" />Copiar link</Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={c.link} target="_blank" rel="noopener noreferrer" />}><ExternalLink aria-hidden className="size-4" />Abrir cobrança</Button>
        {c.forma !== "CARTAO_CREDITO" && <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={() => verPix(c)}><QrCode aria-hidden className="size-4" />Pix copia e cola</Button>}
      </div>}
      {pix?.cobrancaId === c.id && <div className="space-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada pelo Asaas em data URL */}
        {pix.imagem && <img src={pix.imagem} alt="QR Code Pix da cobrança" width={160} height={160} className="size-40" />}
        <div className="flex min-w-0 items-end gap-2"><div className="min-w-0 flex-1 space-y-1"><Label htmlFor={`${id}-pix`}>Pix copia e cola</Label><Input id={`${id}-pix`} readOnly value={pix.copiaCola} onFocus={e => e.currentTarget.select()} /></div><Button type="button" variant="outline" onClick={() => copiar(pix.copiaCola, "Código Pix")}><Copy aria-hidden className="size-4" />Copiar</Button></div>
      </div>}
    </li>; })}</ul>}
    {podeCobrar && !emAberto && !paga && !aberto && <Button type="button" variant="outline" size="sm" onClick={() => { setAberto(true); setErro(""); setAviso(""); }}>Gerar cobrança no Asaas</Button>}
    {!podeCobrar && motivoBloqueio && cobrancas.length === 0 && !site && <p className="text-xs text-muted-foreground">{motivoBloqueio}</p>}
    {aberto && <div className="space-y-3">
      <p className="text-sm">Cobrar {moeda(total)} pelo Asaas</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor={`${id}-forma`}>Forma de pagamento</Label><SelecaoFormulario id={`${id}-forma`} value={forma} disabled={pendente} onValueChange={setForma}>{Object.entries(FORMAS).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</SelecaoFormulario></div>
        <div className="space-y-1"><Label htmlFor={`${id}-vencimento`}>Vencimento</Label><Input id={`${id}-vencimento`} type="date" min={hoje} value={vencimento} disabled={pendente} onChange={e => setVencimento(e.target.value)} /></div>
      </div>
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={pendente} onClick={() => { setAberto(false); operacao.current = null; }}>Cancelar</Button><Button type="button" variant="entrada" disabled={pendente || !vencimento} onClick={gerar}>{pendente ? "Gerando…" : "Gerar cobrança"}</Button></div>
    </div>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {aviso && <p role="status" className="text-xs text-muted-foreground">{aviso}</p>}
  </div>;
}
