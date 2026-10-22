"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { salvarGrupoFiscalVendaAction } from "../actions";
import { CabecalhoVendas, Check, EditorVenda, Texto, Vazio } from "../componentes";
import { BotaoExcluirVenda } from "../botao-excluir";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusCadastroVenda } from "../status-cadastro";
import { RegrasFiscaisVisiveis } from "../../financeiro/fiscal/cadastros-fiscais";
import type { PainelFiscal } from "@/lib/tributacao/tipos";
import type { CrtFiscal } from "@/lib/fiscal/catalogos/tipos";

type GrupoFiscal = { id: string; nome: string; versao: number; fiscal: Record<string,string>; ativo: boolean; produtos: { id: string }[] };
export function GruposFiscais({ grupos, editar, crt, painel }: { grupos: GrupoFiscal[]; editar: boolean; crt?: CrtFiscal; painel?: PainelFiscal }) {
  const [grupoRegras, setGrupoRegras] = useState<string | null>(null);
  const [atual, setAtual] = useState<GrupoFiscal | null>(null);
  return <div className="space-y-5"><CabecalhoVendas titulo="Grupos fiscais" descricao="Grupos do seu cadastro, com regras por operação. Cada produto conserva sua classificação individual."><Button nativeButton={false} render={<a href="/financeiro/fiscal/vinculos" />} variant="outline">Fiscal dos produtos</Button>{editar && <Button onClick={() => setAtual({ id:"",nome:"",versao:0,fiscal:{},ativo:true,produtos:[] })}><Plus className="size-4" />Novo grupo fiscal</Button>}</CabecalhoVendas>
    {!grupos.length ? <Vazio>Nenhum grupo fiscal cadastrado.</Vazio> : <div className="grid gap-3 md:grid-cols-2">{grupos.map(g => <div key={g.id} className="rounded-2xl border bg-card p-4"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">{g.nome}</h2><StatusCadastroVenda tipo="GRUPO_FISCAL" id={g.id} versao={g.versao} ativo={g.ativo} nome={g.nome} editar={editar} /></div><p className="mt-2 text-sm text-muted-foreground">{g.produtos.length} produto(s) vinculado(s). Versões aplicadas prevalecem sobre o vínculo anterior.</p><Button type="button" variant="outline" onClick={() => setGrupoRegras(g.id)}>Regras e herança</Button>{editar && <GrupoAcoes className="mt-3"><Button onClick={() => setAtual(g)} aria-label={`Editar ${g.nome}`} variant="editar" size="icon-sm" /><BotaoExcluirVenda tipo="GRUPO_FISCAL" id={g.id} versao={g.versao} nome={g.nome} aviso="Grupos com versões fiscais devem ser inativados para preservar IDs e histórico." /></GrupoAcoes>}</div>)}</div>}
    {grupoRegras && painel && <RegrasFiscaisVisiveis key={grupoRegras} painel={painel} grupoId={grupoRegras} />}
    {atual && <EditorGrupoFiscal inicial={atual} fechar={() => setAtual(null)} crt={crt} />}
  </div>;
}
function EditorGrupoFiscal({ inicial, fechar }: { inicial: GrupoFiscal; fechar: () => void; crt?: CrtFiscal }) {
  const [d, setD] = useState({ id: inicial.id, versao: inicial.versao, nome: inicial.nome, fiscal: inicial.fiscal, ativo: inicial.ativo, atualizarVinculados: false });
  return <EditorVenda titulo={d.id ? "Editar grupo fiscal" : "Novo grupo fiscal"} descricao="Nome e situação do grupo. Os parâmetros fiscais são mantidos em Regras e herança." fechar={fechar} salvar={() => salvarGrupoFiscalVendaAction(d)}>
    <Texto nome="Nome do grupo *" required maxLength={120} value={d.nome} onChange={e => setD({ ...d,nome:e.target.value })} />
    <p className="text-sm text-muted-foreground">Este formulário altera somente nome e situação. Edite os parâmetros versionados em Regras e herança.</p>
    <Check checked={d.ativo} onChange={e => setD({ ...d,ativo:e.target.checked })}>Grupo ativo</Check>

  </EditorVenda>;
}
