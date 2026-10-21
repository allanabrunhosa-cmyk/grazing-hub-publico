"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxContent, ComboboxItem } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, AlertTriangle, Clock3 } from "lucide-react";

export function SeletorFatura({nome,opcoes,valor,alterar,disabled}:{nome:string;opcoes:{id:string;nome:string}[];valor:string;alterar:(v:string)=>void;disabled?:boolean}) {
  const itens=opcoes.map(o=>({...o,label:o.nome,value:o.id}));
  return <Combobox items={itens} value={itens.find(o=>o.id===valor)??null} disabled={disabled} isItemEqualToValue={(a,b)=>a.id===b.id} onValueChange={o=>alterar(o?.id??"")}>
    <ComboboxInputGroup><ComboboxInput aria-label={nome} placeholder={nome}/></ComboboxInputGroup>
    <ComboboxContent>{(o:typeof itens[number])=><ComboboxItem key={o.id} value={o}>{o.nome}</ComboboxItem>}</ComboboxContent>
  </Combobox>;
}
const rotulos:Record<string,string>={REVISAO:"Aguardando revisão",REVISAR:"Revisar",CLASSIFICADO:"Classificado",VINCULADO:"Vinculado",COMPENSADO:"Compensado",CONCILIADA:"Conciliada",DIVERGENTE:"Divergente",DUPLICIDADE:"Possível duplicidade",PARCIAL:"Pagamento parcial",PRONTA:"Pronta para conciliar",CANCELADA:"Cancelada"};
export function SituacaoFatura({estado}:{estado:string}) {
  const ok=["CLASSIFICADO","VINCULADO","COMPENSADO","CONCILIADA","PRONTA"].includes(estado),alerta=["DIVERGENTE","DUPLICIDADE"].includes(estado);
  const Icone=ok?CheckCircle2:alerta?AlertTriangle:Clock3;
  return <Badge variant={ok?"success":alerta?"warning":"secondary"}><Icone className="size-3"/>{rotulos[estado]??estado}</Badge>;
}
export const moedaFatura=(centavos:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(centavos/100);
export function useOperacaoFatura() {
  const [ocupado,setOcupado]=useState(false),[erro,setErro]=useState("");const trava=useRef(false),router=useRouter();
  async function executar(operacao:()=>Promise<{erro:string}|object>,sucesso?:()=>void){
    if(trava.current)return;trava.current=true;setOcupado(true);setErro("");
    try{const r=await operacao();if("erro" in r)setErro(String(r.erro));else{sucesso?.();router.refresh();}}
    catch{setErro("Não foi possível confirmar o resultado. Atualize e confira o histórico antes de repetir.");}
    finally{trava.current=false;setOcupado(false);}
  }
  return {ocupado,erro,executar,setErro};
}
export function ConfirmacaoFatura({titulo,descricao,confirmar,fechar,children,perguntarMotivo=true}:{titulo:string;descricao:string;confirmar:(motivo:string)=>Promise<{erro:string}|object>;fechar:()=>void;children?:ReactNode;perguntarMotivo?:boolean}) {
  const [motivo,setMotivo]=useState("");const op=useOperacaoFatura();
  return <Dialog open onOpenChange={v=>{if(!v&&!op.ocupado)fechar();}}><DialogContent><DialogHeader><DialogTitle>{titulo}</DialogTitle><DialogDescription>{descricao}</DialogDescription></DialogHeader>{children}
    {perguntarMotivo&&<label className="space-y-1 text-sm">Motivo<Input value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={1000}/></label>}
    {op.erro&&<p role="alert" className="text-sm text-destructive">{op.erro}</p>}
    <DialogFooter><Button variant="outline" disabled={op.ocupado} onClick={fechar}>Voltar</Button><Button disabled={op.ocupado||(perguntarMotivo&&motivo.trim().length<3)} onClick={()=>void op.executar(()=>confirmar(motivo),fechar)}>{op.ocupado?"Confirmando…":"Confirmar"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
