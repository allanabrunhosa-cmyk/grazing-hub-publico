"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SelecaoFormulario } from "@/components/ui/select";
import { SeletorFiscal } from "./seletor-fiscal";
import { aceitaEdicaoGtinFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/gtin";
import type { CrtFiscal, TabelaFiscal } from "@/lib/fiscal/catalogos/tipos";

const rotulos: Partial<Record<TabelaFiscal, string>> = { ncm: "NCM", origem: "Origem ICMS", cfop: "CFOP", csosn: "CSOSN", cstIcms: "CST ICMS", pis: "CST PIS", cofins: "CST COFINS", cest: "CEST", ipi: "CST IPI", cEnq: "Enquadramento IPI", cBenef: "Benefício fiscal · cBenef", cstIbsCbs: "CST IBS/CBS", cClassTrib: "Classificação IBS/CBS", unidadeTributavel: "Unidade tributável" };
export type AplicabilidadeCamposFiscais = { cest?: boolean; ipi?: boolean; fcp?: boolean; beneficio?: boolean; ibsCbs?: boolean };
export function CamposClassificacaoFiscal({ fiscal, mudar, revisado = false, crt = null, dia, modelo, uf = "SP", aplicabilidade, escopo, ncmEditavel = true }: {
  fiscal: Record<string, string>; mudar: (fiscal: Record<string, string>) => void; revisado?: boolean; crt?: CrtFiscal; dia?: string; modelo?: 55 | 65; uf?: string; aplicabilidade?: AplicabilidadeCamposFiscais; escopo?: "produto" | "grupo"; ncmEditavel?: boolean;
}) {
  const [gtinEmEdicao, definirGtinEmEdicao] = useState(false);
  const [exibir, definirExibir] = useState<AplicabilidadeCamposFiscais>({ cest: Boolean(fiscal.cest), ipi: Boolean(fiscal.ipi || fiscal.cEnq), fcp: Boolean(fiscal.fcp), beneficio: Boolean(fiscal.cBenef), ibsCbs: Boolean(fiscal.cstIbsCbs || fiscal.cClassTrib) });
  const [operacao, definirOperacao] = useState<"SAIDA" | "INTERNA" | "INTERESTADUAL" | "EXTERIOR">("SAIDA");
  const aplicar = (campo: string, valor: string) => mudar({ ...fiscal, [campo]: valor });
  const simples = crt === 1 || crt === 4;
  const campo = (tabela: TabelaFiscal, requerido = false) => <div key={tabela} className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{rotulos[tabela]}</span><SeletorFiscal mostrarDescricao={false} nome={rotulos[tabela]!} valor={fiscal[tabela] ?? ""} mudar={v => aplicar(tabela, v)} requerido={requerido} contexto={{ tabela, crt, dia, modelo, uf, operacao, ...(tabela === "cest" ? { ncm: fiscal.ncm } : {}), ...(tabela === "cBenef" ? { cst: fiscal.cstIcms } : {}), ...(tabela === "cClassTrib" ? { cst: fiscal.cstIbsCbs } : {}), ...(tabela === "cEnq" ? { ipi: fiscal.ipi } : {}) }} /></div>;
  const aplicavel = (nome: keyof AplicabilidadeCamposFiscais) => aplicabilidade ? Boolean(aplicabilidade[nome]) || Boolean(fiscal[nome === "beneficio" ? "cBenef" : nome === "ibsCbs" ? "cClassTrib" : nome]) : Boolean(exibir[nome]);
  const gtin = fiscal.ean ?? "", modoGtin = gtin === "SEM GTIN" ? "NAO" : gtin || gtinEmEdicao ? "SIM" : "";
  return <div className="space-y-4">
    {!crt && <p className="text-sm text-muted-foreground">Regime ainda não confirmado. Confira o CRT vigente antes da aprovação.</p>}
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {escopo !== "grupo" && (ncmEditavel ? campo("ncm", revisado) : <p className="text-sm text-muted-foreground">NCM definido pela composição do produto.</p>)}{campo("origem", revisado)}
      {!escopo && <label className="grid min-w-0 gap-1.5 text-sm font-medium">Tipo de operação para CFOP<SelecaoFormulario aria-label="Tipo de operação para CFOP" value={operacao} onValueChange={v => definirOperacao(v as typeof operacao)}><option value="SAIDA">Todas as saídas</option><option value="INTERNA">Saída no estado · 5</option><option value="INTERESTADUAL">Saída para outro estado · 6</option><option value="EXTERIOR">Saída para exterior · 7</option></SelecaoFormulario></label>}
      {campo("cfop", revisado)}{simples ? campo("csosn", revisado) : crt ? campo("cstIcms", revisado) : <>{campo("csosn", revisado && !fiscal.cstIcms)}{campo("cstIcms", revisado && !fiscal.csosn)}</>}
      {campo("pis", revisado)}{campo("cofins", revisado)}{escopo !== "grupo" && campo("unidadeTributavel", revisado)}
      {escopo !== "grupo" && <div className="space-y-2"><label className="grid gap-1.5 text-sm font-medium">GTIN da unidade final<SelecaoFormulario aria-label="GTIN da unidade final" value={modoGtin} onValueChange={v => { definirGtinEmEdicao(v === "SIM"); aplicar("ean", v === "NAO" ? "SEM GTIN" : ""); }}><option value="">Confirmação pendente</option><option value="SIM">Possui GTIN próprio</option><option value="NAO">Não possui · SEM GTIN confirmado</option></SelecaoFormulario></label>
        {modoGtin === "SIM" && <Input aria-label="EAN / GTIN" value={gtin === "SEM GTIN" ? "" : gtin} inputMode="numeric" maxLength={14} restricao="digitos" required={revisado} onChange={e => { if (aceitaEdicaoGtinFiscalBrasilNfe(e.target.value)) aplicar("ean", e.target.value); }} />}
      </div>}
      {escopo && ([["pis", "PIS"], ["cofins", "COFINS"], ...(!simples ? [["cstIcms", "ICMS"]] : [])] as const).map(([codigo, nome]) => (["01", "02", "03"].includes(fiscal[codigo]) && nome !== "ICMS" || nome === "ICMS" && ["00", "20"].includes(fiscal[codigo])) ? <label key={nome} className="grid gap-1.5 text-sm font-medium">Alíquota {nome} (%)<Input aria-label={`Alíquota ${nome} (%)`} value={fiscal[`aliquota${nome === "ICMS" ? "Icms" : nome === "PIS" ? "Pis" : "Cofins"}`] ?? ""} restricao="decimal" casasDecimais={4} inputMode="decimal" maxLength={8} required onChange={e => aplicar(`aliquota${nome === "ICMS" ? "Icms" : nome === "PIS" ? "Pis" : "Cofins"}`, e.target.value)} /></label> : null)}
    </div>
    <details className="space-y-3 rounded-[var(--ds-cartao-raio)] border p-4"><summary className="cursor-pointer text-sm font-medium">{escopo ? "Outros impostos, quando aplicáveis" : "Campos condicionais e tratamentos adicionais"}</summary>
      {!aplicabilidade && <div className="flex flex-wrap gap-4 text-sm">{([["cest", "Informar CEST"], ["ipi", "Informar IPI"], ["fcp", "Informar FCP"], ["beneficio", "Informar benefício fiscal"], ["ibsCbs", "Informar IBS/CBS"]] as const).filter(([nome]) => !escopo || nome === "cest").map(([nome, label]) => <label key={nome} className="flex items-center gap-2"><Checkbox checked={Boolean(exibir[nome])} onCheckedChange={checked => definirExibir(v => ({ ...v, [nome]: checked }))} />{label}</label>)}</div>}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {!escopo && simples && campo("cstIcms")}
        {(aplicavel("cest") || escopo && (fiscal.csosn === "500" || fiscal.cstIcms === "60")) && campo("cest")}
        {escopo && (fiscal.csosn === "500" || fiscal.cstIcms === "60") && <><label className="grid gap-1.5 text-sm font-medium">ICMS-ST<SelecaoFormulario aria-label="ICMS-ST" value={fiscal.st ?? "NAO_APLICAVEL"} onValueChange={v => aplicar("st", v)}><option value="NAO_APLICAVEL">Não aplicável</option><option value="RETIDO_ANTERIORMENTE">Retido anteriormente</option><option value="CALCULO_PENDENTE">Cálculo de ST pendente</option></SelecaoFormulario></label><label className="grid gap-1.5 text-sm font-medium">Comprovação da retenção<Input aria-label="Comprovação da retenção" maxLength={2000} value={fiscal.evidenciaSt ?? ""} onChange={e => aplicar("evidenciaSt", e.target.value)} /></label></>}{!escopo && aplicavel("ipi") && <>{campo("ipi")}{campo("cEnq")}</>}
        {!escopo && aplicavel("fcp") && <label className="grid gap-1.5 text-sm font-medium">FCP (%)<Input aria-label="FCP (%)" value={fiscal.fcp ?? ""} maxLength={8} restricao="decimal" casasDecimais={4} inputMode="decimal" onChange={e => aplicar("fcp", e.target.value)} /></label>}
        {!escopo && aplicavel("beneficio") && campo("cBenef")}{!escopo && aplicavel("ibsCbs") && <>{campo("cstIbsCbs")}{campo("cClassTrib")}</>}
      </div>
    </details>
  </div>;
}
