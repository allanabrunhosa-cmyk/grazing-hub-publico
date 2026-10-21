"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarGrupoFiscalVendaAction } from "../actions";
import { CabecalhoVendas, Check, EditorVenda, Texto, Vazio } from "../componentes";
import { BotaoExcluirVenda } from "../botao-excluir";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusCadastroVenda } from "../status-cadastro";
import { CamposFiscais } from "./fiscal-produto-editor";
import type { CrtFiscal } from "@/lib/fiscal/catalogos/tipos";

type GrupoFiscal = { id: string; nome: string; versao: number; fiscal: Record<string,string>; ativo: boolean; produtos: { id: string }[] };
export function GruposFiscais({ grupos, editar, crt }: { grupos: GrupoFiscal[]; editar: boolean; crt?: CrtFiscal }) {
  const [atual, setAtual] = useState<GrupoFiscal | null>(null);
  return <div className="space-y-5"><CabecalhoVendas titulo="Grupos fiscais" descricao="Grupos organizam regras e sugerem parâmetros. Cada mercadoria conserva seu NCM individual."><Button nativeButton={false} render={<a href="/financeiro/fiscal/cobertura" />} variant="outline">Cobertura e versões</Button>{editar && <Button onClick={() => setAtual({ id:"",nome:"",versao:0,fiscal:{},ativo:true,produtos:[] })}><Plus className="size-4" />Novo grupo fiscal</Button>}</CabecalhoVendas>
    {!grupos.length ? <Vazio>Nenhum grupo fiscal cadastrado.</Vazio> : <div className="grid gap-3 md:grid-cols-2">{grupos.map(g => <div key={g.id} className="rounded-2xl border bg-card p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{g.nome}</h2><StatusCadastroVenda tipo="GRUPO_FISCAL" id={g.id} versao={g.versao} ativo={g.ativo} nome={g.nome} editar={editar} /></div><p className="mt-2 text-sm text-muted-foreground">NCM {g.fiscal.ncm || "—"} · CFOP {g.fiscal.cfop || "—"} · {g.produtos.length} produto(s)</p>{editar && <GrupoAcoes className="mt-3"><Button onClick={() => setAtual(g)} aria-label={`Editar ${g.nome}`} variant="editar" size="icon-sm" /><BotaoExcluirVenda tipo="GRUPO_FISCAL" id={g.id} versao={g.versao} nome={g.nome} aviso="Os produtos manterão seus valores fiscais, mas perderão o vínculo com este modelo." /></GrupoAcoes>}</div>)}</div>}
    {atual && <EditorGrupoFiscal inicial={atual} fechar={() => setAtual(null)} crt={crt} />}
  </div>;
}
function EditorGrupoFiscal({ inicial, fechar, crt }: { inicial: GrupoFiscal; fechar: () => void; crt?: CrtFiscal }) {
  const [d, setD] = useState({ id: inicial.id, versao: inicial.versao, nome: inicial.nome, fiscal: inicial.fiscal, ativo: inicial.ativo, atualizarVinculados: false });
  return <EditorVenda titulo={d.id ? "Editar grupo fiscal" : "Novo grupo fiscal"} descricao="Parâmetros gerais sugeridos pelo grupo. A classificação individual depende de características e evidências técnicas." fechar={fechar} salvar={() => salvarGrupoFiscalVendaAction(d)}>
    <Texto nome="Nome do grupo *" required maxLength={120} value={d.nome} onChange={e => setD({ ...d,nome:e.target.value })} />
    <CamposFiscais fiscal={d.fiscal} mudar={fiscal => setD({ ...d,fiscal })} revisado={false} crt={crt} />
    <Check checked={d.ativo} onChange={e => setD({ ...d,ativo:e.target.checked })}>Grupo ativo</Check>
    {d.id && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><Check checked={d.atualizarVinculados} onChange={e => setD({ ...d,atualizarVinculados:e.target.checked })}>Sugerir parâmetros para {inicial.produtos.length} produto(s) vinculado(s)</Check><p className="mt-1 pl-6 text-xs text-muted-foreground">Preserva NCM e parâmetros individuais; completa sugestões gerais e registra nova conferência cadastral. Documentos emitidos mantêm seus snapshots.</p></div>}
  </EditorVenda>;
}
