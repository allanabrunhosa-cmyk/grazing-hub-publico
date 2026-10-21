"use client";
import { startTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from "@/components/ui/dialog";
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from "@/components/ui/table";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { identificarFaturaAction,prepararFaturaAction,importarFaturaAction } from "./actions";
import type { CampoCabecalho } from "@/lib/financeiro/faturas/cabecalho";
import { dataFatura } from "@/lib/financeiro/faturas/data";
import { moedaFatura,SeletorFatura,useOperacaoFatura } from "./componentes";

type Previa=Extract<Awaited<ReturnType<typeof prepararFaturaAction>>,{previa:unknown}>["previa"];
type Identificacao=Extract<Awaited<ReturnType<typeof identificarFaturaAction>>,{identificacao:unknown}>["identificacao"];
const rotulos:Record<CampoCabecalho,string>={competencia:"Competência",total:"Total informado",inicio:"Início",fim:"Fim",fechamento:"Fechamento",vencimento:"Vencimento",final:"Final da conta/cartão principal"};
type DadosFormulario=Record<Exclude<CampoCabecalho,"final">,string>;
const vazios:DadosFormulario={competencia:"",total:"",inicio:"",fim:"",fechamento:"",vencimento:""};
export function ImportarFatura({cartoes,inicial}:{cartoes:{id:string;nome:string;ativo:boolean}[];inicial?:{cartaoId:string;competencia:string;inicio:string;fim:string;fechamento:string;vencimento:string;total:number}}){
  const [aberto,setAberto]=useState(false),[cartao,setCartao]=useState(inicial?.cartaoId??""),[previa,setPrevia]=useState<Previa|null>(null),[pagina,setPagina]=useState(0),[duplicadas,setDuplicadas]=useState(false),[naoReconhecidas,setNaoReconhecidas]=useState(false),[credito,setCredito]=useState((inicial?.total??0)<0);
  const [arquivo,setArquivo]=useState<File|null>(null),[senha,setSenha]=useState(""),[pedirSenha,setPedirSenha]=useState(false),[identificacao,setIdentificacao]=useState<Identificacao|null>(null),[manual,setManual]=useState(false),[memorizar,setMemorizar]=useState(false);
  const dadosIniciais=():DadosFormulario=>inicial?{competencia:inicial.competencia,inicio:inicial.inicio,fim:inicial.fim,fechamento:inicial.fechamento,vencimento:inicial.vencimento,total:(Math.abs(inicial.total)/100).toFixed(2)}:{...vazios};
  const [dados,setDados]=useState<DadosFormulario>(dadosIniciais);
  const formulario=useRef<FormData|null>(null),router=useRouter(),op=useOperacaoFatura(),acesso=useAcesso();
  function limpar(){setArquivo(null);setSenha("");setPedirSenha(false);setIdentificacao(null);setManual(false);setMemorizar(false);setCartao(inicial?.cartaoId??"");setDados(dadosIniciais());setCredito((inicial?.total??0)<0);setPrevia(null);formulario.current=null;}
  function montar(valores:DadosFormulario,id:string,anexo:File,chave:string,credor:boolean){const form=new FormData();for(const [k,v]of Object.entries(valores))form.set(k,v);form.set("cartaoId",id);form.set("arquivo",anexo);form.set("senhaPdf",chave);if(credor)form.set("total","-"+valores.total);return form;}
  async function gerar(form:FormData){const r=await prepararFaturaAction(form);if("previa" in r){formulario.current=form;setPrevia(r.previa);setPagina(0);setDuplicadas(false);setNaoReconhecidas(false);}return r;}
  function reconhecer(anexo:File,chave:string){startTransition(()=>{void op.executar(async()=>{
    setPrevia(null);setIdentificacao(null);setManual(false);setMemorizar(false);setCartao(inicial?.cartaoId??"");setDados(dadosIniciais());
    const form=new FormData();form.set("arquivo",anexo);form.set("senhaPdf",chave);
    const r=await identificarFaturaAction(form);
    if("erro" in r){setPedirSenha(Boolean(r.senhaNecessaria));setManual(!r.senhaNecessaria);return r;}
    setPedirSenha(false);setIdentificacao(r.identificacao);
    const extraidos=r.identificacao.cabecalho.dados,novos={...dadosIniciais()};
    for(const campo of Object.keys(novos) as (keyof DadosFormulario)[])if(extraidos[campo])novos[campo]=extraidos[campo]!.valor;
    const credor=novos.total.startsWith("-");novos.total=novos.total.replace(/^-/ ,"");setCredito(credor);setDados(novos);
    const id=inicial?.cartaoId??r.identificacao.cartaoId??"";setCartao(id);
    if(id&&Object.values(novos).every(Boolean)&&!r.identificacao.cabecalho.conflitos.length)return gerar(montar(novos,id,anexo,chave,credor));
    return {};
  });});}
  async function preparar(form:FormData){if(!arquivo)return;form.set("arquivo",arquivo);form.set("senhaPdf",senha);form.set("cartaoId",cartao);if(credito)form.set("total","-"+form.get("total"));
    if(form.get("decimal")||form.get("colunaData")||form.get("colunaDescricao")||form.get("colunaValor"))form.set("mapa",JSON.stringify({data:form.get("colunaData")||"Data",descricao:form.get("colunaDescricao")||"Descrição",valor:form.get("colunaValor")||"Valor",formatoValor:form.get("decimal")?"DECIMAL":"BR"}));
    await op.executar(()=>gerar(form));}
  return <><Button variant="outline" disabled={!acesso.pode("financeiro.faturas","adicionar")} onClick={()=>{limpar();op.setErro("");setAberto(true);}}><Upload className="size-4"/>{inicial?"Reprocessar":"Importar fatura"}</Button>
    <Dialog open={aberto} onOpenChange={v=>{if(!op.ocupado){setAberto(v);if(!v)limpar();}}}><DialogContent className="sm:max-w-4xl"><DialogHeader><DialogTitle>{previa?"Conferir detalhamento":"Destrinchar fatura do cartão"}</DialogTitle><DialogDescription>Anexe o PDF para identificar dados e compras. Depois, vincule à saída já importada do extrato bancário, sem outra despesa pelo total. Nada é gravado antes de confirmar.</DialogDescription></DialogHeader>
      {!previa&&<div className="space-y-3"><label className="block space-y-1 text-sm">Arquivo da fatura<Input type="file" accept=".csv,.pdf,.xls,.xlsx" disabled={op.ocupado} onChange={e=>{const f=e.target.files?.[0];limpar();op.setErro("");if(f){setArquivo(f);reconhecer(f,"");}}}/></label><p className="text-sm text-muted-foreground">PDF, CSV ou Excel de até 2 MB. Não envie número completo do cartão nem CVV.</p>
        {arquivo&&<p className="text-sm">Arquivo selecionado: {arquivo.name}</p>}
        {pedirSenha&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();if(arquivo)reconhecer(arquivo,senha);}}><label className="block space-y-1 text-sm">Senha deste PDF<Input type="password" autoComplete="off" value={senha} disabled={op.ocupado} maxLength={128} onChange={e=>setSenha(e.target.value)}/></label><p className="text-sm text-muted-foreground">Usada somente nesta importação. Não fica salva no sistema.</p><Button disabled={op.ocupado||!senha} type="submit">Abrir PDF</Button></form>}
        {op.ocupado&&<p role="status">Lendo fatura e conferindo os dados…</p>}
      </div>}
      {identificacao&&<div className="space-y-2 text-sm" role="status"><p>{identificacao.cabecalho.banco??"Arquivo"}{identificacao.cabecalho.dados.final&&` · principal final ${identificacao.cabecalho.dados.final.valor}`} · {identificacao.quantidade} itens identificados.</p><details><summary>Como os dados foram preenchidos</summary>{Object.entries(identificacao.cabecalho.dados).map(([campo,dado])=><p key={campo}>{rotulos[campo as CampoCabecalho]}: {dado.valor} — {dado.origem==="PDF"?"Lido no PDF":"Referência calculada"}. {dado.evidencia}</p>)}</details>
        {identificacao.cabecalho.conflitos.length>0&&<p className="text-destructive">Confira os dados divergentes: {identificacao.cabecalho.conflitos.map(c=>rotulos[c]).join(", ")}.</p>}
      </div>}
      {!previa&&(identificacao||manual)&&!pedirSenha?<form onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);startTransition(()=>{void preparar(form);});}} className="space-y-4"><fieldset disabled={op.ocupado} className="space-y-4">
        {!cartao&&<p className="text-sm text-muted-foreground">Escolha o cadastro deste cartão. Se faltar um dos cartões principais, cadastre-o na tela anterior. Configure seu final para reconhecê-lo nos próximos meses.</p>}
        <SeletorFatura nome="Cartão da fatura" opcoes={cartoes.filter(c=>c.ativo)} valor={cartao} alterar={setCartao}/>
        <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-sm">Competência<Input name="competencia" type="month" value={dados.competencia} onChange={e=>setDados(d=>({...d,competencia:e.target.value}))} required/></label><label className="space-y-1 text-sm">Total informado<CurrencyInput aria-label="Total informado" name="total" value={dados.total} onValueChange={total=>setDados(d=>({...d,total}))} required/></label><label className="flex items-center gap-2 text-sm"><Checkbox checked={credito} onCheckedChange={v=>setCredito(Boolean(v))}/>Total credor (negativo)</label></div>
        <div className="grid gap-3 sm:grid-cols-4">{([['inicio','Início'],['fim','Fim'],['fechamento','Fechamento'],['vencimento','Vencimento']] as const).map(([campo,nome])=><label key={campo} className="space-y-1 text-sm">{nome}<Input name={campo} type="date" value={dados[campo]} onChange={e=>setDados(d=>({...d,[campo]:e.target.value}))} required/>{!dados[campo]&&<span className="block text-muted-foreground">Não identificado: complete.</span>}</label>)}</div>
        <details className="text-sm"><summary>Mapear colunas da planilha (opcional)</summary><p className="my-2 text-muted-foreground">Padrão: Data, Descrição e Valor (1.234,56). Preencha os títulos exatos se forem diferentes.</p><div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Coluna da data" name="colunaData" placeholder="Data"/><Input aria-label="Coluna da descrição" name="colunaDescricao" placeholder="Descrição"/><Input aria-label="Coluna do valor" name="colunaValor" placeholder="Valor"/></div><label className="mt-2 flex items-center gap-2"><Checkbox name="decimal"/>Valor decimal com ponto, sem milhares (1234.56)</label></details>
      </fieldset><DialogFooter><Button type="submit" disabled={op.ocupado||!cartao||!arquivo}>{op.ocupado?"Lendo arquivo…":"Conferir compras"}</Button></DialogFooter></form>:null}
      {previa&&<div className="space-y-4">
        <p>{previa.cartao} · {previa.linhas.length} itens · Extraído: <strong>{moedaFatura(previa.totalExtraido)}</strong> · Diferença: <strong>{moedaFatura(previa.totalExtraido-previa.totalInformado)}</strong></p>
        <p className="text-sm text-muted-foreground">{previa.linhas.filter(l=>l.totalParcelas>1).length} parcelas · {previa.linhas.filter(l=>l.valor<0).length} créditos · {previa.linhas.filter(l=>l.existente).length} itens já importados, preservados. Reprocessamento acrescenta apenas linhas novas; não remove linhas antigas nem vínculos.</p>
        {previa.arquivoRepetido&&<p role="status">Arquivo já importado. A confirmação abrirá a fatura existente sem duplicar itens.</p>}
        {previa.avisos.map(a=><p key={a} className="text-sm">{a}</p>)}
        <Table identificationColumn={2}><TableHeader><TableRow><TableHead>Linha</TableHead><TableHead>Data</TableHead><TableHead>Descrição original</TableHead><TableHead>Valor</TableHead><TableHead>Revisão</TableHead></TableRow></TableHeader><TableBody>{previa.linhas.slice(pagina*50,(pagina+1)*50).map(l=><TableRow key={l.linha}><TableCell>{l.linha}</TableCell><TableCell>{dataFatura(l.data)}</TableCell><TableCell>{l.descricao}</TableCell><TableCell>{moedaFatura(l.valor)}</TableCell><TableCell>{l.existente?"Já importada":l.possivelDuplicada?"Possível duplicidade":l.revisar?"Revisar":"Nova"}</TableCell></TableRow>)}</TableBody></Table>
        <div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={pagina===0} onClick={()=>setPagina(p=>p-1)}>Anterior</Button><span className="text-sm">Página {pagina+1} de {Math.ceil(previa.linhas.length/50)}</span><Button variant="outline" size="sm" disabled={(pagina+1)*50>=previa.linhas.length} onClick={()=>setPagina(p=>p+1)}>Próxima</Button></div>
        {previa.naoReconhecidas.length>0&&<details open><summary>{previa.naoReconhecidas.length} linhas não reconhecidas</summary><div className="max-h-48 overflow-auto text-sm">{previa.naoReconhecidas.map(l=><p key={l.linha}>Linha {l.linha}: {l.texto}</p>)}</div><label className="flex items-center gap-2 text-sm"><Checkbox checked={naoReconhecidas} onCheckedChange={v=>setNaoReconhecidas(Boolean(v))}/>Conferi no PDF: estas linhas não são compras faltantes. Linhas inválidas em planilhas exigem correção do arquivo.</label></details>}
        {previa.linhas.some(l=>l.possivelDuplicada)&&<label className="flex items-center gap-2 text-sm"><Checkbox checked={duplicadas} onCheckedChange={v=>setDuplicadas(Boolean(v))}/>As compras repetidas conferem com a fatura original.</label>}
        {identificacao?.cabecalho.dados.final&&!identificacao.cartaoId&&acesso.pode("financeiro.bancario","editar")&&<label className="flex items-center gap-2 text-sm"><Checkbox checked={memorizar} onCheckedChange={v=>setMemorizar(Boolean(v))}/>Associar final {identificacao.cabecalho.dados.final.valor} ao cartão selecionado para reconhecê-lo nos próximos meses.</label>}
        <DialogFooter><Button variant="outline" disabled={op.ocupado} onClick={()=>setPrevia(null)}>Conferir dados</Button><Button disabled={op.ocupado} onClick={()=>void op.executar(async()=>{const form=formulario.current!;form.set("token",previa.token);form.set("confirmar","sim");form.set("memorizarFinal",memorizar?"sim":"nao");form.set("confirmarDuplicadas",duplicadas?"sim":"nao");form.set("conferirNaoReconhecidas",naoReconhecidas?"sim":"nao");const r=await importarFaturaAction(form);if("id" in r){setAberto(false);limpar();router.push(`/financeiro/cartoes/faturas/${r.id}`);}return r;})}>{op.ocupado?"Importando…":"Confirmar importação"}</Button></DialogFooter>
      </div>}
      {op.erro&&<p role="alert" className="text-destructive">{op.erro}</p>}
    </DialogContent></Dialog></>;
}
