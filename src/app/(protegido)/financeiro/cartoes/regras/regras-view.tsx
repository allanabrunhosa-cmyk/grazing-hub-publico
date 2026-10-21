"use client";
import Link from "next/link";
import {useState} from "react";
import type {EntradaRegra} from "@/lib/financeiro/faturas/regras";
import type {CadastrosFatura} from "@/lib/financeiro/faturas/consultas";
import {BarraAcoes} from "@/components/padroes-operacionais";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Checkbox} from "@/components/ui/checkbox";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from "@/components/ui/table";
import {CategoriaFinanceiraCombobox} from "@/components/categoria-financeira-combobox";
import {useAcesso} from "@/components/layout/acesso-contexto";
import {GRUPOS_RECEITA} from "@/lib/labels";
import {SeletorFatura,useOperacaoFatura} from "../componentes";
import {salvarRegraFaturaAction} from "../actions";
const vazia:EntradaRegra={nome:"",texto:"",modo:"EXATO",prioridade:0,cartaoId:null,categoriaId:"",fornecedorId:null,centroCustoId:null,tipo:null,minimo:"",maximo:"",ativa:true};
export function RegrasFatura({regras,cadastros:c}:{regras:(EntradaRegra&{origem:string})[];cadastros:CadastrosFatura}){
  const [edicao,setEdicao]=useState<EntradaRegra|null>(null),[busca,setBusca]=useState("");const op=useOperacaoFatura(),acesso=useAcesso();
  return <div className="space-y-5"><BarraAcoes titulo="Regras de classificação" descricao="Regras explícitas primeiro; depois histórico, fornecedor conhecido e revisão humana. IA externa não configurada."><Button variant="outline" nativeButton={false} role="link" render={<Link href="/financeiro/cartoes"/>}>Voltar</Button><Button disabled={!acesso.pode("financeiro.cartoes-regras","adicionar")} onClick={()=>setEdicao({...vazia})}>Nova regra</Button></BarraAcoes><Input aria-label="Buscar regra" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar regra"/>
    <Table><TableHeader><TableRow>{['Nome','Correspondência','Origem','Prioridade','Situação',''].map(t=><TableHead key={t}>{t}</TableHead>)}</TableRow></TableHeader><TableBody>{regras.filter(r=>(r.nome+' '+r.texto).toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))).map(r=><TableRow key={r.id}><TableCell>{r.nome}</TableCell><TableCell>{r.texto} · {r.modo==='EXATO'?'Exata':'Contém'}</TableCell><TableCell>{r.origem}</TableCell><TableCell>{r.prioridade}</TableCell><TableCell>{r.ativa?'Ativa':'Inativa'}</TableCell><TableCell><Button variant="editar" aria-label={`Editar ${r.nome}`} disabled={!acesso.pode("financeiro.cartoes-regras","editar")} onClick={()=>setEdicao(r)}/></TableCell></TableRow>)}</TableBody></Table><p className="text-sm text-muted-foreground">Até 1.000 regras. Inativar preserva o histórico e as classificações anteriores. Regras sugerem, não criam despesas automaticamente.</p>
    {edicao&&<Dialog open onOpenChange={v=>{if(!v&&!op.ocupado)setEdicao(null);}}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{edicao.id?'Editar regra':'Nova regra'}</DialogTitle><DialogDescription>Regra exata prevalece sobre “contém”. A prioridade desempata regras do mesmo tipo.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={e=>{e.preventDefault();void op.executar(()=>salvarRegraFaturaAction(edicao),()=>setEdicao(null));}}>
      <label className="block text-sm">Nome<Input required maxLength={120} value={edicao.nome} onChange={e=>setEdicao({...edicao,nome:e.target.value})}/></label><label className="block text-sm">Texto do estabelecimento<Input required maxLength={250} value={edicao.texto} onChange={e=>setEdicao({...edicao,texto:e.target.value})}/></label>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={edicao.modo==='EXATO'} onCheckedChange={v=>setEdicao({...edicao,modo:v?'EXATO':'CONTEM'})}/>Correspondência exata (desmarcado: contém)</label>
      <SeletorFatura nome="Cartão (opcional)" opcoes={c.cartoes} valor={edicao.cartaoId??''} alterar={v=>setEdicao({...edicao,cartaoId:v||null})}/>
      <CategoriaFinanceiraCombobox categorias={c.categorias.filter(c=>!GRUPOS_RECEITA.includes(c.grupo))} value={edicao.categoriaId} onChange={v=>setEdicao({...edicao,categoriaId:v})}/>
      <SeletorFatura nome="Fornecedor (opcional)" opcoes={c.fornecedores} valor={edicao.fornecedorId??''} alterar={v=>setEdicao({...edicao,fornecedorId:v||null})}/><SeletorFatura nome="Centro de custo (opcional)" opcoes={c.centros} valor={edicao.centroCustoId??''} alterar={v=>setEdicao({...edicao,centroCustoId:v||null})}/>
      <SeletorFatura nome="Tipo de item (opcional)" opcoes={['COMPRA','ESTORNO','CREDITO','JUROS','IOF','MULTA','TARIFA'].map(t=>({id:t,nome:t}))} valor={edicao.tipo??''} alterar={v=>setEdicao({...edicao,tipo:v||null})}/>
      <label className="block text-sm">Prioridade<Input type="number" min={-1000} max={1000} value={edicao.prioridade} onChange={e=>setEdicao({...edicao,prioridade:Number(e.target.value)})}/></label><label className="flex items-center gap-2 text-sm"><Checkbox checked={edicao.ativa} onCheckedChange={v=>setEdicao({...edicao,ativa:Boolean(v)})}/>Regra ativa</label>
      {op.erro&&<p role="alert" className="text-destructive">{op.erro}</p>}<DialogFooter><Button variant="outline" disabled={op.ocupado} onClick={()=>setEdicao(null)}>Cancelar</Button><Button type="submit" disabled={op.ocupado||!edicao.categoriaId}>Salvar regra</Button></DialogFooter>
    </form></DialogContent></Dialog>}
  </div>;
}
