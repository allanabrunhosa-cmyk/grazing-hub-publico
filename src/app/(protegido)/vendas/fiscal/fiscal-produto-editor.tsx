"use client";
import { SelecaoFormulario } from "@/components/ui/select";
import { useState } from "react";
import { CamposClassificacaoFiscal } from "@/components/fiscal/campos-classificacao";
import type { CrtFiscal } from "@/lib/fiscal/catalogos/tipos";
import { salvarFiscalVendaAction } from "../actions";
import { Campo, Check, EditorVenda, classeSelecao } from "../componentes";
import { Button } from "@/components/ui/button";
import { herdarParametrosFiscais } from "@/lib/tributacao/heranca";

export type GrupoFiscalVinculo = { id: string; nome: string; ativo: boolean; fiscal: Record<string, string> };
/** Grupos sugerem parâmetros; classificações e exceções individuais prevalecem. */
export function sugerirModeloFiscal(modelo: Record<string, string>, individual: Record<string, string>) {
  return herdarParametrosFiscais(modelo, individual);
}
export function CamposFiscais({ fiscal, mudar, revisado, crt }: { fiscal: Record<string,string>; mudar: (valor: Record<string,string>) => void; revisado: boolean; crt?: CrtFiscal }) {
  return <><CamposClassificacaoFiscal fiscal={fiscal} mudar={mudar} revisado={revisado} crt={crt} /><Campo nome="Justificativa e evidências da classificação"><textarea className={`${classeSelecao} h-20 py-2`} maxLength={2000} value={fiscal.observacoes ?? ""} onChange={e => mudar({ ...fiscal, observacoes: e.target.value })} /></Campo></>;
}
export function FiscalProdutoEditor({ produto, grupos, fechar, aoSalvar, crt }: { produto: { id: string; nome: string; versao: number; fiscal?: Record<string,string>; fiscalRevisado?: boolean; grupoFiscalId?: string | null }; grupos: GrupoFiscalVinculo[]; fechar: () => void; aoSalvar: (versao: number, fiscal: Record<string,string>, revisado: boolean, grupoFiscalId: string | null) => void; crt?: CrtFiscal }) {
  const [fiscal, setFiscal] = useState<Record<string,string>>(produto.fiscal ?? {});
  const [revisado, setRevisado] = useState(produto.fiscalRevisado ?? false);
  const [grupoFiscalId, setGrupoFiscalId] = useState(produto.grupoFiscalId ?? null);
  return <EditorVenda titulo={`Fiscal · ${produto.nome}`} descricao="O grupo sugere parâmetros gerais. NCM e dados individuais permanecem preservados; confirme a classificação por evidências." fechar={fechar} salvar={async () => { const r = await salvarFiscalVendaAction(produto.id, produto.versao, fiscal, revisado, grupoFiscalId); if ("ok" in r && r.versao) aoSalvar(r.versao,fiscal,revisado,grupoFiscalId); return r; }}>
    <Campo nome="Grupo fiscal"><SelecaoFormulario aria-label="Grupo fiscal"  value={grupoFiscalId ?? ""} onValueChange={valor => { const id = valor || null; setGrupoFiscalId(id); const g = grupos.find(g => g.id === id); if (g) setFiscal(atual => sugerirModeloFiscal(g.fiscal, atual)); setRevisado(false); }}><option value="">Sem grupo fiscal</option>{grupos.filter(g => g.ativo || g.id === grupoFiscalId).map(g => <option key={g.id} value={g.id}>{g.nome}{!g.ativo ? " (inativo)" : ""}</option>)}</SelecaoFormulario></Campo>
    <CamposFiscais fiscal={fiscal} mudar={v => { setFiscal(v); setRevisado(false); }} revisado={revisado} crt={crt} />
    <Check checked={revisado} onChange={e => setRevisado(e.target.checked)}>Dados conferidos para este produto</Check>
    <p className="text-xs text-muted-foreground">Cadastro comercial fiscal. Alterações para emissão exigem versão prospectiva no painel; esta ficha não altera a classificação tributária ativa.</p>
    <Button type="button" nativeButton={false} render={<a href="/financeiro/fiscal/cobertura" target="_blank" rel="noreferrer" />} variant="outline">Versões, cobertura e evidências</Button>
  </EditorVenda>;
}
