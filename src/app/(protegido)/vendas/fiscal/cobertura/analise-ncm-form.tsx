"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SelecaoFormulario } from "@/components/ui/select";
import { Campo, Texto } from "../../componentes";
import type { AnaliseNcm } from "@/lib/tributacao/tipos";

export function novaAnaliseNcm(): AnaliseNcm {
  return { fundamento: "PESQUISA", confianca: "BAIXA", descricaoNcm: null, dataAnalise: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()), justificativa: "", fontes: [], pendenciasNcm: [] };
}
export function Referencias({ nome, valores, limite, mudar, obrigatorio = false }: { nome: string; valores: string[]; limite: number; mudar: (v: string[]) => void; obrigatorio?: boolean }) {
  const [texto, setTexto] = useState(valores.join("\n"));
  return <Campo nome={nome}><Textarea aria-label={nome} required={obrigatorio} maxLength={limite} value={texto} onChange={e => { setTexto(e.target.value); mudar(e.target.value.split(/\r?\n/).map(s => s.trim()).filter(Boolean)); }} /></Campo>;
}

export function AnaliseNcmForm({ valor, mudar, semNcm = false, nome = "Análise do NCM" }: { valor: AnaliseNcm; mudar: (v: AnaliseNcm) => void; semNcm?: boolean; nome?: string }) {
  const alterar = <K extends keyof AnaliseNcm>(k: K, v: AnaliseNcm[K]) => mudar({ ...valor, [k]: v });
  return <fieldset className="min-w-0 space-y-3 rounded-xl border p-3"><legend className="px-1 font-medium">{nome}</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo nome="Fundamento da classificação"><SelecaoFormulario aria-label={`${nome}: fundamento`} value={valor.fundamento} onValueChange={v => { if (v === "DOCUMENTAL" || v === "PESQUISA") alterar("fundamento", v); }}><option value="DOCUMENTAL">Documentação específica</option><option value="PESQUISA">Pesquisa fundamentada</option></SelecaoFormulario></Campo>
      <Campo nome="Confiança da classificação"><SelecaoFormulario aria-label={`${nome}: confiança`} value={valor.confianca} onValueChange={v => { if (v === "ALTA" || v === "MEDIA" || v === "BAIXA") alterar("confianca", v); }}><option value="ALTA">Alta</option><option value="MEDIA">Média</option><option value="BAIXA">Baixa · classificação pendente</option></SelecaoFormulario></Campo>
      <Texto nome={`${nome}: data da pesquisa`} type="date" required maxLength={10} value={valor.dataAnalise} onChange={e => alterar("dataAnalise", e.target.value)} />
    </div>
    {!semNcm && <Campo nome="Descrição oficial correspondente ao NCM"><Textarea aria-label={`${nome}: descrição oficial`} maxLength={2000} value={valor.descricaoNcm ?? ""} onChange={e => alterar("descricaoNcm", e.target.value || null)} /></Campo>}
    <Campo nome="Justificativa técnica do enquadramento"><Textarea aria-label={`${nome}: justificativa`} required minLength={15} maxLength={4000} value={valor.justificativa} onChange={e => alterar("justificativa", e.target.value)} /></Campo>
    <Referencias nome={`${nome}: fontes e documentos, uma referência por linha`} valores={valor.fontes} limite={20000} mudar={v => alterar("fontes", v)} />
    <Referencias nome={`${nome}: características ainda não determinadas`} valores={valor.pendenciasNcm} limite={10000} mudar={v => alterar("pendenciasNcm", v)} />
    <p className="text-xs text-muted-foreground">Documentação específica identifica a mercadoria efetiva. Pesquisa registra a análise técnica e suas fontes. Confiança baixa mantém a operação afetada pendente. Autoria e data da atualização são registradas pelo servidor.</p>
  </fieldset>;
}
