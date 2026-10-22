"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { consultarHistoricoFiscalLegadoAction } from "./manutencao-actions";

export function HistoricoFiscalLegado() {
  const [registros, setRegistros] = useState<{ id: string; consultaId?: string; titulo: string; detalhe: string }[]>([]), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  async function consultar(id?: string) {
    if (ocupado) return;
    setOcupado(true); setErro("");
    try { const r = await consultarHistoricoFiscalLegadoAction(id); if ("erro" in r) setErro(r.erro ?? "Consulta não concluída."); else setRegistros(r.registros); }
    catch { setErro("Consulta não concluída. Tente novamente."); }
    finally { setOcupado(false); }
  }
  return <details className="space-y-3 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Histórico anterior do emissor</summary>
    <p className="text-sm text-muted-foreground">Registros preservados dos pilotos anteriores. A manutenção atual utiliza as versões da ficha fiscal.</p>
    <Button type="button" variant="outline" disabled={ocupado} onClick={() => void consultar()}>Consultar registros anteriores</Button>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {registros.map(v => <div key={v.id} className="space-y-2 border-b pb-3"><p className="text-sm font-medium">{v.titulo}</p><details><summary className="cursor-pointer text-sm">Fundamentos e registro preservado</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{v.detalhe}</pre></details><Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={() => void consultar(v.consultaId ?? v.id)}>Consultar histórico</Button></div>)}
  </details>;
}
