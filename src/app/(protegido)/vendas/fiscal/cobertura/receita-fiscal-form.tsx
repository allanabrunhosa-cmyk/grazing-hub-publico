"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelecaoFormulario } from "@/components/ui/select";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Campo, Check, Texto } from "../../componentes";
import type { ClassificacaoFiscal, PainelFiscal, ReceitaFiscalDocumentada } from "@/lib/tributacao/tipos";
import { Referencias } from "./analise-ncm-form";

type Componente = ReceitaFiscalDocumentada["componentesFixos"][number];
const classeAdicionar = "h-auto min-h-[var(--ds-controle-altura)] max-w-full whitespace-normal";

function Ingredientes({ nome, componentes, mudar, painel }: { nome: string; componentes: Componente[]; mudar: (v: Componente[]) => void; painel: PainelFiscal }) {
  return <div className="space-y-3"><Button type="button" variant="outline" className={classeAdicionar} disabled={componentes.length>=100} onClick={()=>mudar([{insumoId:"",unidade:"KG",quantidade:""},...componentes])}><Plus className="size-4" />Adicionar ingrediente de {nome.toLocaleLowerCase("pt-BR")}</Button>
    {componentes.map((c,i) => {
    const alterar = (v: Componente) => mudar(componentes.map((a,j) => j===i?v:a));
    return <fieldset key={i} className="min-w-0 space-y-3 rounded-xl border p-3"><legend className="px-1 font-medium">{nome} · ingrediente {i+1}</legend>
      <div className="flex items-start justify-between gap-2"><p className="text-xs text-muted-foreground">Quantidade final, conforme a ficha</p><BotaoRemoverItem nome={`Remover ingrediente ${i+1} de ${nome}`} onClick={() => mudar(componentes.filter((_,j)=>i!==j))} /></div>
      <Campo nome={`${nome}: insumo ${i+1}`}><SelecaoFormulario aria-label={`${nome}: insumo ${i+1}`} value={c.insumoId} onValueChange={v=>alterar({...c,insumoId:v})}><option value="">Selecione o insumo existente</option>{(painel.insumos??[]).map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</SelecaoFormulario></Campo>
      <div className="grid gap-3 sm:grid-cols-2"><Texto nome={`${nome}: quantidade final ${i+1}`} required inputMode="decimal" restricao="decimal" casasDecimais={9} maxLength={22} pattern="[0-9]{1,12}([.][0-9]{1,9})?" value={c.quantidade} onChange={e=>alterar({...c,quantidade:e.target.value.replace(",",".")})} /><Texto nome={`${nome}: unidade final ${i+1}`} required maxLength={6} pattern="[A-Z0-9]{1,6}" value={c.unidade} onChange={e=>alterar({...c,unidade:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")})} /></div>
    </fieldset>;
  })}</div>;
}

export function ReceitaFiscalForm({ d, mudar, painel }: { d: ClassificacaoFiscal; mudar: (v: ClassificacaoFiscal) => void; painel: PainelFiscal }) {
  const receita=d.receitaFiscalDocumentada;
  const opcoes=painel.opcoes.filter(o=>o.produtoPrincipalIds?.includes(d.produtoId??""));
  const alterar=(v:ReceitaFiscalDocumentada)=>mudar({...d,receitaFiscalDocumentada:v});
  return <details className="space-y-3" open={!!receita}><summary className="cursor-pointer font-medium">Composição final documentada para a análise fiscal</summary>
    <Check checked={!!receita} onChange={e=>mudar({...d,baseSemIngredientesComprovada:undefined,receitaFiscalDocumentada:e.target.checked?{componentesFixos:[],opcoes:[],justificativa:"",fontes:[]}:undefined})}>Registrar a composição fiscal pela ficha técnica</Check>
    <p className="text-xs text-muted-foreground">Informe o conteúdo final por uma unidade do produto e por uma escolha. Esta composição registra a mercadoria entregue; o consumo de estoque continua seguindo seu cadastro próprio. Peso de polpa, peso bruto e rendimento exigem fundamentos distintos.</p>
    {receita&&<div className="space-y-4"><Ingredientes nome="Composição fixa" componentes={receita.componentesFixos} mudar={v=>alterar({...receita,componentesFixos:v})} painel={painel} />
      <Button type="button" variant="outline" className={classeAdicionar} disabled={receita.opcoes.length>=200} onClick={()=>alterar({...receita,opcoes:[{opcaoId:"",componentes:[]},...receita.opcoes]})}><Plus className="size-4"/>Adicionar porção de uma escolha</Button>
    {receita.opcoes.map((o,i)=>{ const editar=(v:typeof o)=>alterar({...receita,opcoes:receita.opcoes.map((a,j)=>i===j?v:a)});return <fieldset key={i} className="min-w-0 space-y-3 rounded-xl border p-3"><legend className="px-1 font-medium">Porção da escolha {i+1}</legend><div className="flex items-start justify-between gap-2"><p className="text-xs text-muted-foreground">Conteúdo final por uma seleção desta alternativa</p><BotaoRemoverItem nome={`Remover porção da escolha ${i+1}`} onClick={()=>alterar({...receita,opcoes:receita.opcoes.filter((_,j)=>i!==j)})}/></div>
        <Campo nome={`Alternativa da porção fiscal ${i+1}`}><SelecaoFormulario aria-label={`Alternativa da porção fiscal ${i+1}`} value={o.opcaoId} onValueChange={v=>editar({...o,opcaoId:v,componentes:[]})}><option value="">Selecione a alternativa</option>{opcoes.filter(a=>a.id===o.opcaoId||!receita.opcoes.some(b=>b.opcaoId===a.id)).map(a=><option key={a.id} value={a.id}>{a.grupo} · {a.nome}</option>)}</SelecaoFormulario></Campo>
        <Ingredientes nome={`Porção da escolha ${i+1}`} componentes={o.componentes} mudar={v=>editar({...o,componentes:v})} painel={painel}/>
      </fieldset>;})}

      <Campo nome="Fundamento da composição fiscal"><Textarea required minLength={15} maxLength={4000} value={receita.justificativa} onChange={e=>alterar({...receita,justificativa:e.target.value})}/></Campo><Referencias nome="Documentos da composição fiscal, uma referência por linha" obrigatorio valores={receita.fontes} limite={20000} mudar={v=>alterar({...receita,fontes:v})}/>
      <p className="text-xs text-muted-foreground">O servidor confere a composição e seus vínculos ao ativar a versão. Pedidos novos guardam a prova da configuração utilizada; alterações posteriores preservam essa fotografia e os documentos emitidos.</p>
    </div>}
  </details>;
}
