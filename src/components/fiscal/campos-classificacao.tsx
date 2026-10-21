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
export function CamposClassificacaoFiscal({ fiscal, mudar, revisado = false, crt = null, dia, modelo, uf = "SP", aplicabilidade }: {
  fiscal: Record<string, string>; mudar: (fiscal: Record<string, string>) => void; revisado?: boolean; crt?: CrtFiscal; dia?: string; modelo?: 55 | 65; uf?: string; aplicabilidade?: AplicabilidadeCamposFiscais;
}) {
  const [gtinEmEdicao, definirGtinEmEdicao] = useState(false);
  const [exibir, definirExibir] = useState<AplicabilidadeCamposFiscais>({ cest: Boolean(fiscal.cest), ipi: Boolean(fiscal.ipi || fiscal.cEnq), fcp: Boolean(fiscal.fcp), beneficio: Boolean(fiscal.cBenef), ibsCbs: Boolean(fiscal.cstIbsCbs || fiscal.cClassTrib) });
  const [operacao, definirOperacao] = useState<"SAIDA" | "INTERNA" | "INTERESTADUAL" | "EXTERIOR">("SAIDA");
  const aplicar = (campo: string, valor: string) => mudar({ ...fiscal, [campo]: valor });
  const simples = crt === 1 || crt === 4;
  const campo = (tabela: TabelaFiscal, requerido = false) => <div key={tabela} className="grid min-w-0 gap-1.5 text-sm font-medium"><span>{rotulos[tabela]}</span><SeletorFiscal nome={rotulos[tabela]!} valor={fiscal[tabela] ?? ""} mudar={v => aplicar(tabela, v)} requerido={requerido} contexto={{ tabela, crt, dia, modelo, uf, operacao, ...(tabela === "cest" ? { ncm: fiscal.ncm } : {}), ...(tabela === "cBenef" ? { cst: fiscal.cstIcms } : {}), ...(tabela === "cClassTrib" ? { cst: fiscal.cstIbsCbs } : {}), ...(tabela === "cEnq" ? { ipi: fiscal.ipi } : {}) }} /></div>;
  const aplicavel = (nome: keyof AplicabilidadeCamposFiscais) => aplicabilidade ? Boolean(aplicabilidade[nome]) || Boolean(fiscal[nome === "beneficio" ? "cBenef" : nome === "ibsCbs" ? "cClassTrib" : nome]) : Boolean(exibir[nome]);
  const gtin = fiscal.ean ?? "", modoGtin = gtin === "SEM GTIN" ? "NAO" : gtin || gtinEmEdicao ? "SIM" : "";
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{crt ? `Opções de ICMS conforme CRT ${crt}.` : "Regime ainda não confirmado. Confira o CRT vigente antes da aprovação."} A seleção não aprova regras nem atribui classificação à mercadoria.</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      {campo("ncm", revisado)}{campo("origem", revisado)}
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">Tipo de operação para CFOP<SelecaoFormulario aria-label="Tipo de operação para CFOP" value={operacao} onValueChange={v => definirOperacao(v as typeof operacao)}><option value="SAIDA">Todas as saídas</option><option value="INTERNA">Saída no estado · 5</option><option value="INTERESTADUAL">Saída para outro estado · 6</option><option value="EXTERIOR">Saída para exterior · 7</option></SelecaoFormulario></label>
      {campo("cfop", revisado)}{simples ? campo("csosn", revisado) : crt ? campo("cstIcms", revisado) : <>{campo("csosn", revisado && !fiscal.cstIcms)}{campo("cstIcms", revisado && !fiscal.csosn)}</>}
      {campo("pis", revisado)}{campo("cofins", revisado)}{campo("unidadeTributavel", revisado)}
      <div className="space-y-2"><label className="grid gap-1.5 text-sm font-medium">GTIN da unidade final<SelecaoFormulario aria-label="GTIN da unidade final" value={modoGtin} onValueChange={v => { definirGtinEmEdicao(v === "SIM"); aplicar("ean", v === "NAO" ? "SEM GTIN" : ""); }}><option value="">Confirmação pendente</option><option value="SIM">Possui GTIN próprio</option><option value="NAO">Não possui · SEM GTIN confirmado</option></SelecaoFormulario></label>
        {modoGtin === "SIM" && <Input aria-label="EAN / GTIN" value={gtin === "SEM GTIN" ? "" : gtin} inputMode="numeric" maxLength={14} restricao="digitos" required={revisado} onChange={e => { if (aceitaEdicaoGtinFiscalBrasilNfe(e.target.value)) aplicar("ean", e.target.value); }} />}
        <p className="text-xs text-muted-foreground">Confirme o código da unidade vendida. Não herde o GTIN do insumo ou grupo. A ausência de código exige declaração e fundamento.</p>
      </div>
    </div>
    <details className="space-y-3 rounded-[var(--ds-cartao-raio)] border p-4"><summary className="cursor-pointer text-sm font-medium">Campos condicionais e tratamentos adicionais</summary>
      {!aplicabilidade && <div className="flex flex-wrap gap-4 text-sm">{([["cest", "Informar CEST"], ["ipi", "Informar IPI"], ["fcp", "Informar FCP"], ["beneficio", "Informar benefício fiscal"], ["ibsCbs", "Informar IBS/CBS"]] as const).map(([nome, label]) => <label key={nome} className="flex items-center gap-2"><Checkbox checked={Boolean(exibir[nome])} onCheckedChange={checked => definirExibir(v => ({ ...v, [nome]: checked }))} />{label}</label>)}</div>}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {simples && <>{campo("cstIcms")}<p className="text-xs text-muted-foreground">CST do regime normal aparece aqui somente para hipóteses monofásicas previstas na norma. Não substitua CSOSN sem fundamento da operação.</p></>}
        {aplicavel("cest") && campo("cest")}{aplicavel("ipi") && <>{campo("ipi")}{campo("cEnq")}</>}
        {aplicavel("fcp") && <label className="grid gap-1.5 text-sm font-medium">FCP (%)<Input aria-label="FCP (%)" value={fiscal.fcp ?? ""} maxLength={8} restricao="decimal" casasDecimais={4} inputMode="decimal" onChange={e => aplicar("fcp", e.target.value)} /></label>}
        {aplicavel("beneficio") && campo("cBenef")}{aplicavel("ibsCbs") && <>{campo("cstIbsCbs")}{campo("cClassTrib")}</>}
      </div>
      <p className="text-xs text-muted-foreground">CEST depende do NCM e da descrição. ST, FCP, benefícios e IBS/CBS exigem aplicabilidade, vigência e aprovação na regra de emissão. Campos sem suporte na montagem mantêm a operação bloqueada.</p>
    </details>
  </div>;
}
