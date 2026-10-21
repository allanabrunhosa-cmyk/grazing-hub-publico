"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { vincularDocumentoExternoPedidoAction } from "../../documento-actions";
export function DocumentoExternoPedido({ id, editar, documentos, fusoHorario }: { fusoHorario: string; id: string; editar: boolean; documentos: { emissor: string; referencia: string; evidencia: string; autor: string; data: string }[] }) {
  const [emissor, setEmissor] = useState(""); const [referencia, setReferencia] = useState(""); const [evidencia, setEvidencia] = useState(""); const [erro, setErro] = useState(""); const [ocupado, iniciar] = useTransition(); const router = useRouter();
  return <section className="space-y-3 rounded-2xl border bg-card p-4"><h2 className="font-semibold">Documento emitido externamente</h2><p className="text-sm">Registro de referência e conferência pelo responsável. Não emite documento, não consulta autenticidade e não cria receita.</p>
    {documentos.map(d => <p key={`${d.emissor}:${d.referencia}`}>{d.emissor} · {d.referencia} · Evidência: {d.evidencia} · {d.autor} · {new Date(d.data).toLocaleString("pt-BR", { timeZone: fusoHorario })}</p>)}
    {!documentos.length && <p>Documento externo ainda não vinculado. Procedimento fiscal depende dos responsáveis.</p>}
    {erro && <p role="alert" className="text-destructive">{erro}</p>}
    {editar && <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); iniciar(async () => { try { const r = await vincularDocumentoExternoPedidoAction(id, emissor, referencia, evidencia); if ("erro" in r) setErro(r.erro ?? "Falha ao vincular."); else { setErro(""); router.refresh(); } } catch { setErro("Confira o histórico antes de repetir."); } }); }}>
      <label>Emissor<Input required maxLength={200} value={emissor} onChange={e => setEmissor(e.target.value)} /></label><label>Identificação do documento<Input required maxLength={200} value={referencia} onChange={e => setReferencia(e.target.value)} /></label><label>Referência da evidência<Input required maxLength={200} value={evidencia} onChange={e => setEvidencia(e.target.value)} /></label><Button disabled={ocupado} type="submit">Vincular documento já emitido</Button>
    </form>}
  </section>;
}
