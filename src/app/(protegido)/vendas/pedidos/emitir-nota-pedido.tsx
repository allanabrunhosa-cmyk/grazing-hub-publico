"use client";

import { useContext, useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { rejeicaoFiscalCorrigivel } from "@/lib/fiscal-saida/rejeicao";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, CircleX, FileCode2, FileDown, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelecaoFormulario } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { PedidoPopupContext } from "./modal-pedido";
import type { ResumoFiscalSaida } from "./fiscal-pedido";
import { destinoHubFiscalPedido } from "./fiscal-navegacao";
import { emitirNotaPedidoDiretaBrasilNfeAction, consultarResultadoEmissaoPedidoBrasilNfeAction, consultarEmissaoPedidoBrasilNfeAction, obterDocumentosEmissaoPedidoBrasilNfeAction, cancelarNotaPedidoBrasilNfeAction } from "./emissao-actions";

type IndicadorPresenca = 1 | 2 | 3 | 4 | 5 | 9;
const opcoesPresenca: { valor: IndicadorPresenca; rotulo: string }[] = [
  { valor: 1, rotulo: "Presencial no estabelecimento" },
  { valor: 2, rotulo: "Não presencial, internet" },
  { valor: 3, rotulo: "Não presencial, telefone" },
  { valor: 4, rotulo: "NFC-e com entrega a domicílio" },
  { valor: 5, rotulo: "Presencial fora do estabelecimento" },
  { valor: 9, rotulo: "Não presencial, outros" },
];
type DocumentoPedido = ResumoFiscalSaida & { modeloDocumento?: number | null; xmlDisponivel?: boolean; cancelamentoPendente?: boolean; cancelamentoSolicitado?: boolean };
export type FiscalDoDetalhePedido = { editar: boolean; documentos: DocumentoPedido[]; origemHub?: string | null };
const nomesStatus: Record<string, string> = {
  SEM_EMISSOR: "Preparação pendente", PREPARADO: "Preparada", PROCESSANDO: "Em processamento",
  INCERTO: "Em conferência", PENDENTE_CONFERENCIA: "Em conferência", AUTORIZADO: "Autorizada",
  REJEITADO: "Rejeitada", DENEGADO: "Uso denegado", CANCELADO: "Cancelada",
};
const modeloNome = (modelo: number) => modelo === 65 ? "NFC-e" : "NF-e";
const ambienteNome = (ambiente: string) => ambiente === "PRODUCAO" ? "Produção" : ambiente === "HOMOLOGACAO" ? "Homologação" : "Ambiente não configurado";
const incerto = (d: DocumentoPedido) => ["INCERTO", "PENDENTE_CONFERENCIA", "PROCESSANDO"].includes(d.status);

function IdentificacaoDocumento({ documento: d }: { documento: DocumentoPedido }) {
  return <div className="flex flex-wrap items-center gap-2"><Badge variant={d.status === "AUTORIZADO" ? "success" : incerto(d) ? "warning" : d.status === "REJEITADO" ? "destructive" : "outline"}>{nomesStatus[d.status] ?? "Conferência necessária"}</Badge><span className="text-xs text-muted-foreground">{d.modeloDocumento ? `${modeloNome(d.modeloDocumento)} · ` : ""}{ambienteNome(d.ambiente)}</span></div>;
}

function DadosDocumento({ documento: d, editar, ocupado, consultar, arquivos, cancelar, mostrarIdentificacao = true }: { documento: DocumentoPedido; editar: boolean; ocupado: boolean; consultar: (id: string) => void; arquivos: (id: string) => void; cancelar?: (documento: DocumentoPedido) => void; mostrarIdentificacao?: boolean }) {
  const autorizado = ["AUTORIZADO", "CANCELADO"].includes(d.status);
  return <section aria-label="Resultado fiscal" className="space-y-3">
    {mostrarIdentificacao && <IdentificacaoDocumento documento={d} />}
    {d.status === "AUTORIZADO" && <p role="status" className="flex items-center gap-2 text-sm font-medium text-success"><CircleCheck aria-hidden className="size-4 shrink-0" />Nota fiscal emitida com sucesso{d.ambiente === "HOMOLOGACAO" ? " em homologação, sem valor fiscal." : "."}</p>}
    {d.status === "CANCELADO" && <p role="status" className="text-sm">Cancelamento da nota fiscal confirmado.</p>}
    {d.numero && <p className="text-sm break-words">Número {d.numero} · Série {d.serie ?? "Não informada"}</p>}
    {d.protocolo && <p className="text-xs break-all">Protocolo: {d.protocolo}</p>}
    {d.chaveFiscal && <p className="text-xs break-all">Chave: {d.chaveFiscal}</p>}
    {d.ultimoErro && <p role="alert" className="pedido-detalhe-fiscal-alerta text-sm text-destructive whitespace-pre-wrap break-words"><CircleAlert aria-hidden="true" className="size-4 shrink-0" /><span>{d.ultimoErro}</span></p>}
    {incerto(d) && <p className="text-xs text-muted-foreground">A tentativa anterior será consultada ao tentar novamente. Nenhuma nota será reenviada enquanto o resultado estiver incerto.</p>}
    {d.cancelamentoPendente && <p role="status" className="text-sm text-muted-foreground">Cancelamento aguardando confirmação. Consulte o resultado antes de qualquer nova ação.</p>}
    <GrupoAcoes nome="Ações da nota fiscal" alinhamento="inicio" className="flex-wrap">
      {editar && (d.tentativas > 0 || d.referenciaProvedor || d.chaveFiscal || d.protocolo || incerto(d)) && <Button type="button" variant="outline" disabled={ocupado} onClick={() => consultar(d.id)}><RefreshCw aria-hidden="true" />Consultar resultado</Button>}
      {autorizado && <>
        {d.xmlDisponivel !== false && <Button variant="entrada-outline" nativeButton={false} role="link" render={<a href={`/api/fiscal-saida/${d.id}/arquivo?tipo=xml`} />}><FileCode2 aria-hidden="true" />Baixar XML</Button>}
        {d.formatoImpressao && <Button variant="atencao" nativeButton={false} role="link" render={<a href={`/api/fiscal-saida/${d.id}/arquivo?tipo=${d.formatoImpressao === "HTML" ? "html" : "pdf"}&visualizar=1`} target="_blank" rel="noopener noreferrer" />}><FileText aria-hidden="true" />{d.formatoImpressao === "PDF" ? "Abrir PDF" : "Abrir DANFE"}</Button>}
        {editar && (!d.formatoImpressao || d.xmlDisponivel === false) && <Button type="button" variant="outline" disabled={ocupado} onClick={() => arquivos(d.id)}><FileDown aria-hidden="true" />Obter documentos</Button>}
        {editar && d.status === "AUTORIZADO" && d.provedor === "BRASIL_NFE" && !d.cancelamentoSolicitado && !d.cancelamentoPendente && cancelar && <Button type="button" variant="saida-outline" title="Solicitar cancelamento da nota fiscal" disabled={ocupado || !d.chaveFiscal || !d.protocolo} onClick={() => cancelar(d)}><CircleX aria-hidden="true" />Cancelar NF</Button>}
      </>}
    </GrupoAcoes>
  </section>;
}

type PendenciaEmissao = { campo: string; mensagem: string; href: string | null };

export function EmitirNotaPedido({ pedidoId, versao, confirmado, modeloSugerido = 65, fiscal }: { pedidoId: string; numeroPedido: number; versao: number; confirmado: boolean; modeloSugerido?: 55 | 65; fiscal: FiscalDoDetalhePedido }) {
  const popup = useContext(PedidoPopupContext), router = useRouter(), { podeRota } = useAcesso();
  const [modelo, setModelo] = useState<55 | 65>(modeloSugerido), [erro, setErro] = useState("");
  const [pendencias, setPendencias] = useState<PendenciaEmissao[]>([]);
  const [presenca, setPresenca] = useState<IndicadorPresenca | null>(null), [exigePresenca, setExigePresenca] = useState(false);
  const [conferirAntesDeRepetir, setConferirAntesDeRepetir] = useState(false);
  const [cancelando, setCancelando] = useState<DocumentoPedido | null>(null), [justificativa, setJustificativa] = useState("");
  const [cancelamentosIniciados, setCancelamentosIniciados] = useState<string[]>([]);
  const [resultadoLocal, setResultadoLocal] = useState<{ documento: DocumentoPedido; base: string | undefined } | null>(null);
  const [ocupado, iniciar] = useTransition();
  const trava = useRef(false), modeloResumoId = useId(), presencaId = useId(), justificativaId = useId();
  const bloquearSaida = popup?.bloquearSaida;
  useEffect(() => { bloquearSaida?.("fiscal", ocupado); return () => bloquearSaida?.("fiscal", false); }, [ocupado, bloquearSaida]);
  const documentos = resultadoLocal && JSON.stringify(fiscal.documentos.find(d => d.id === resultadoLocal.documento.id)) === resultadoLocal.base
    ? [resultadoLocal.documento, ...fiscal.documentos.filter(d => d.id !== resultadoLocal.documento.id)] : fiscal.documentos;
  const atual = documentos.find(d => d.ambiente === "PRODUCAO" && (d.status === "AUTORIZADO" || incerto(d)))
    ?? documentos.find(d => d.ambiente === "PRODUCAO" && d.versaoPedido === versao)
    ?? documentos.find(d => d.versaoPedido === versao) ?? documentos[0];
  const rejeicaoCorrigivel = rejeicaoFiscalCorrigivel(atual);
  const possuiResultadoProdutivo = Boolean(!rejeicaoCorrigivel && atual?.ambiente === "PRODUCAO" && (atual.tentativas > 0 || atual.chaveFiscal || atual.protocolo || atual.referenciaProvedor || incerto(atual) || ["AUTORIZADO", "REJEITADO", "DENEGADO", "CANCELADO"].includes(atual.status)));
  const podeEmitir = fiscal.editar && confirmado;
  const mostrarControles = fiscal.editar && confirmado && (atual?.ambiente !== "PRODUCAO" || !["AUTORIZADO", "CANCELADO", "DENEGADO"].includes(atual?.status ?? ""));
  function guardarResultado(documento: DocumentoPedido) {
    setResultadoLocal({ documento, base: JSON.stringify(fiscal.documentos.find(d => d.id === documento.id)) });
  }
  function agir(operacao: () => Promise<unknown>) {
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações do pedido antes da ação fiscal."); return; }
    if (trava.current) return;
    trava.current = true; setErro("");
    iniciar(async () => { try { await operacao(); } catch { setConferirAntesDeRepetir(true); setErro("A conexão foi interrompida e o resultado não foi confirmado. Clique em Emitir para consultar a tentativa anterior e tentar novamente com segurança."); } finally { trava.current = false; } });
  }
  function emitir() {
    if (!podeEmitir) return;
    agir(async () => {
      setPendencias([]);
      // Uma resposta perdida nunca autoriza um novo envio pelo navegador.
      setConferirAntesDeRepetir(true);
      const r = await emitirNotaPedidoDiretaBrasilNfeAction({ pedidoId, versaoPedido: versao, modelo, ...(presenca === null ? {} : { indicadorPresenca: presenca }) });
      if (r.documento) guardarResultado(r.documento);
      if ("erro" in r) {
        setErro(r.erro ?? "A emissão não foi confirmada. Consulte o resultado fiscal.");
        setPendencias("pendencias" in r ? r.pendencias ?? [] : []);
        setExigePresenca("exigeEscolhaPresenca" in r && r.exigeEscolhaPresenca === true);
        setConferirAntesDeRepetir(r.conferirAntesDeRepetir !== false);
      } else { setConferirAntesDeRepetir(r.conferirAntesDeRepetir); setExigePresenca(false); }
      router.refresh();
    });
  }
  function consultarPedido() { agir(async () => {
    const r = await consultarResultadoEmissaoPedidoBrasilNfeAction(pedidoId);
    if (r.documento) guardarResultado(r.documento);
    if ("erro" in r) setErro(r.erro ?? "Consulta não confirmada. Aguarde e consulte novamente.");
    setConferirAntesDeRepetir(r.conferirAntesDeRepetir !== false); router.refresh();
  }); }
  function consultar(id: string) { agir(async () => {
    const r = await consultarEmissaoPedidoBrasilNfeAction(id);
    if ("erro" in r) setErro(r.erro ?? "Consulta não confirmada.");
    else if (r.documento) {
      guardarResultado(r.documento); setConferirAntesDeRepetir(false);
      if (!r.documento.cancelamentoSolicitado && !r.documento.cancelamentoPendente) setCancelamentosIniciados(ids => ids.filter(item => item !== id));
    }
    router.refresh();
  }); }
  function arquivos(id: string) { agir(async () => { const r = await obterDocumentosEmissaoPedidoBrasilNfeAction(id); if ("erro" in r) setErro(r.erro ?? "Documentos não confirmados."); else if (r.documento) guardarResultado(r.documento); router.refresh(); }); }
  function pedirCancelamento(d: DocumentoPedido) {
    if (popup?.temAlteracoes()) { setErro("Salve ou descarte as alterações do pedido antes da ação fiscal."); return; }
    setErro(""); setJustificativa(""); setCancelando(d);
  }
  function confirmarCancelamento() {
    if (!cancelando?.chaveFiscal || !cancelando.protocolo || ![55, 65].includes(cancelando.modeloDocumento ?? 0) || justificativa.trim().length < 15 || cancelamentosIniciados.includes(cancelando.id)) return;
    const d = cancelando;
    agir(async () => {
      setCancelamentosIniciados(ids => [...ids, d.id]);
      const r = await cancelarNotaPedidoBrasilNfeAction({ documentoId: d.id, modelo: d.modeloDocumento, ambiente: d.ambiente, chaveFiscal: d.chaveFiscal, protocolo: d.protocolo, justificativa: justificativa.trim(), confirmarCancelamento: true });
      if ("erro" in r) { setErro(r.erro ?? "Cancelamento não confirmado. Consulte a nota antes de repetir."); router.refresh(); return; }
      guardarResultado(r.documento); setCancelando(null); setJustificativa(""); router.refresh();
    });
  }
  return <Card size="sm" role="region" aria-label="Nota fiscal" aria-busy={ocupado} data-fiscal-status={atual?.status} className="pedido-detalhe-secao pedido-detalhe-fiscal">
    <CardHeader className="pedido-detalhe-rotulo"><h2><FileText aria-hidden="true" />Fiscal</h2>{atual && <IdentificacaoDocumento documento={atual} />}</CardHeader>
    <CardContent className="space-y-3">
      {mostrarControles && <>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <div className="grid min-w-0 gap-1">
            <Label htmlFor={modeloResumoId}>Modelo da nota</Label>
            <SelecaoFormulario id={modeloResumoId} value={modelo} disabled={ocupado} onValueChange={v => { if (v === "55" || v === "65") { setModelo(Number(v) as 55 | 65); setPendencias([]); setErro(""); if (v === "55" && presenca === 4) setPresenca(null); } }}>
              <option value="65">NFC-e (65)</option><option value="55">NF-e (55)</option>
            </SelecaoFormulario>
          </div>
          <Button type="button" variant="entrada" aria-label={`Emitir ${modeloNome(modelo)}`} onClick={emitir} disabled={ocupado || !podeEmitir}><FileText aria-hidden="true" />Emitir</Button>
        </div>
        <p className="text-xs text-muted-foreground">{possuiResultadoProdutivo || conferirAntesDeRepetir ? "Clique em Emitir para tentar novamente. O sistema consulta a tentativa anterior antes de enviar outra nota, para evitar duplicidade." : "Emissão em produção. O botão envia a nota para autorização da SEFAZ."}</p>
        {exigePresenca && <div className="grid gap-1">
          <Label htmlFor={presencaId}>Como a venda foi realizada?</Label>
          <SelecaoFormulario id={presencaId} value={presenca === null ? "" : String(presenca)} disabled={ocupado} onValueChange={v => setPresenca(opcoesPresenca.find(o => String(o.valor) === v && (modelo === 65 || o.valor !== 4))?.valor ?? null)}>
            <option value="">Selecione o canal efetivo da venda</option>{opcoesPresenca.filter(o => modelo === 65 || o.valor !== 4).map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </SelecaoFormulario>
        </div>}

      </>}
      {ocupado && <p role="status" className="text-sm text-muted-foreground">Processando a ação fiscal. Aguarde o resultado…</p>}
      {atual && <DadosDocumento documento={atual} editar={fiscal.editar} ocupado={ocupado} consultar={consultar} arquivos={arquivos} cancelar={cancelamentosIniciados.includes(atual.id) ? undefined : pedirCancelamento} mostrarIdentificacao={false} />}
      {!atual && !ocupado && <p className="text-xs text-muted-foreground">Nenhuma nota fiscal vinculada a este pedido.</p>}
      {erro && !cancelando && <div role="alert" className="pedido-detalhe-fiscal-alerta text-sm text-destructive whitespace-pre-wrap break-words"><CircleAlert aria-hidden="true" className="size-4 shrink-0" /><div className="min-w-0 space-y-2"><p className="font-medium">{conferirAntesDeRepetir ? "Resultado fiscal não confirmado" : "Ação fiscal não concluída"}</p><p>{erro}</p>{pendencias.length > 0 && <ul className="list-disc space-y-2 pl-4">{pendencias.map((p, i) => {
        const href = p.href && podeRota(p.href.split("?")[0]) ? destinoHubFiscalPedido(p.href, fiscal.origemHub) : null;
        return <li key={`${p.campo}:${i}`}><span>{p.mensagem}</span>{href && <Link href={href} className="ml-1 underline underline-offset-2">Corrigir informação</Link>}</li>;
      })}</ul>}</div></div>}
      {conferirAntesDeRepetir && fiscal.editar && (!atual || atual.tentativas === 0 && !atual.referenciaProvedor && !atual.chaveFiscal && !atual.protocolo && !incerto(atual)) && <Button type="button" variant="outline" disabled={ocupado} onClick={consultarPedido}><RefreshCw aria-hidden="true" />Consultar resultado fiscal</Button>}
      <Dialog open={Boolean(cancelando)} alterado={Boolean(justificativa)} protegerAlteracoes={!ocupado} onOpenChange={v => { if (!ocupado && !v) { setCancelando(null); setJustificativa(""); setErro(""); } }}>
        <DialogContent showCloseButton={!ocupado}>
          <DialogHeader><DialogTitle>Cancelar nota fiscal</DialogTitle><DialogDescription>{cancelando?.modeloDocumento === 65 ? "NFC-e" : "NF-e"} {cancelando?.numero ?? ""} · {ambienteNome(cancelando?.ambiente ?? "")}. O cancelamento será solicitado à SEFAZ e depende do prazo e das regras fiscais.</DialogDescription></DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={justificativaId}>Justificativa do cancelamento</Label>
            <Textarea id={justificativaId} value={justificativa} disabled={ocupado} minLength={15} maxLength={255} rows={4} onChange={e => setJustificativa(e.target.value.replace(/[\p{C}<>]/gu, " "))} aria-describedby={`${justificativaId}-ajuda`} />
            <p id={`${justificativaId}-ajuda`} className="text-xs text-muted-foreground">Informe de 15 a 255 caracteres. O pedido e seu pagamento permanecem registrados.</p>
            {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          </div>
          {cancelando && cancelamentosIniciados.includes(cancelando.id) && !ocupado && <p role="status" className="text-sm text-muted-foreground">Volte ao pedido e consulte o resultado desta nota antes de repetir o cancelamento.</p>}
          <DialogFooter><Button variant="outline" disabled={ocupado} onClick={() => { setCancelando(null); setJustificativa(""); setErro(""); }}>Voltar</Button><Button variant="saida" disabled={ocupado || justificativa.trim().length < 15 || Boolean(cancelando && cancelamentosIniciados.includes(cancelando.id))} onClick={confirmarCancelamento}>{ocupado ? "Cancelando…" : "Confirmar cancelamento da NF"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}
