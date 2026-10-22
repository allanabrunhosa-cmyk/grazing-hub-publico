"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FiscalProdutoUnificado } from "../../financeiro/fiscal/ficha-produto";
import { CamposClassificacaoFiscal } from "@/components/fiscal/campos-classificacao";
import type { CrtFiscal } from "@/lib/fiscal/catalogos/tipos";
import { Campo, classeSelecao } from "../componentes";
import { herdarParametrosFiscais } from "@/lib/tributacao/heranca";

export type GrupoFiscalVinculo = { id: string; nome: string; ativo: boolean; fiscal: Record<string, string> };
/** Grupos sugerem parâmetros; classificações e exceções individuais prevalecem. */
export function sugerirModeloFiscal(modelo: Record<string, string>, individual: Record<string, string>) {
  return herdarParametrosFiscais(modelo, individual);
}
export function CamposFiscais({ fiscal, mudar, revisado, crt }: { fiscal: Record<string,string>; mudar: (valor: Record<string,string>) => void; revisado: boolean; crt?: CrtFiscal }) {
  return <><CamposClassificacaoFiscal fiscal={fiscal} mudar={mudar} revisado={revisado} crt={crt} /><Campo nome="Justificativa e evidências da classificação"><textarea className={`${classeSelecao} h-20 py-2`} maxLength={2000} value={fiscal.observacoes ?? ""} onChange={e => mudar({ ...fiscal, observacoes: e.target.value })} /></Campo></>;
}
export function FiscalProdutoEditor({ produto, fechar }: { produto: { id: string; nome: string; versao: number; fiscal?: Record<string,string>; fiscalRevisado?: boolean; grupoFiscalId?: string | null }; grupos: GrupoFiscalVinculo[]; fechar: () => void; aoSalvar: (versao: number, fiscal: Record<string,string>, revisado: boolean, grupoFiscalId: string | null) => void; crt?: CrtFiscal }) {
  return <Dialog open onOpenChange={aberto => { if (!aberto) fechar(); }}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>Fiscal · {produto.nome}</DialogTitle><DialogDescription>Configuração versionada utilizada pela emissão.</DialogDescription></DialogHeader><FiscalProdutoUnificado produtoId={produto.id} /></DialogContent></Dialog>;
}
