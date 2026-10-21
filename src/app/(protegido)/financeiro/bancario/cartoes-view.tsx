"use client";
import { useState, useTransition } from "react";
import { CreditCard, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAcesso } from "@/components/layout/acesso-contexto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";
import { StatusAtivoSalvavel } from "@/components/status-ativo";
import { salvarCartaoAction, alternarCartaoAction } from "./cartoes-actions";
import type { CartaoOption } from "@/lib/financeiro/cartoes";
import { CurrencyInput } from "@/components/ui/currency-input";
type Conta = {id:string;nome:string;ativo:boolean};
function CartaoDialog({cartao,contas}:{cartao?:CartaoOption;contas:Conta[]}) {
  const acesso = useAcesso();
  const [erro,setErro]=useState("");
  const [aberto,setAberto]=useState(false), [pendente,iniciar]=useTransition();
  const [contaId,setContaId]=useState(cartao?.contaBancariaId ?? "");
  function salvar(formulario:FormData) { formulario.set("contaBancariaId",contaId); iniciar(async()=>{
    try { const resultado=await salvarCartaoAction(cartao?.id ?? null,formulario); if("erro" in resultado) {setErro(resultado.erro);return;} toast.success("Cartão salvo.");setAberto(false); }
    catch {setErro("Não foi possível salvar o cartão.");}
  }); }
  return <Dialog open={aberto} onOpenChange={setAberto}><DialogTrigger render={<Button type="button" disabled={!acesso.pode("financeiro.bancario", cartao ? "editar" : "adicionar")} aria-label={cartao ? `Editar cartão ${cartao.nome}` : undefined} variant={cartao ? "editar" : "outline"}/>}>{cartao ? null : <><Plus className="size-4"/>Novo cartão</>}</DialogTrigger>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{cartao ? "Editar cartão" : "Novo cartão de crédito"}</DialogTitle><DialogDescription>Configure a conta de pagamento e o calendário da fatura.</DialogDescription></DialogHeader>
      <form onSubmit={evento => { evento.preventDefault(); setErro(""); salvar(new FormData(evento.currentTarget)); }} className="space-y-4"><fieldset disabled={pendente} className="space-y-4">
        <label className="block space-y-1 text-sm">Nome do cartão<Input name="nome" defaultValue={cartao?.nome} required maxLength={120} placeholder="Ex.: Visa empresa"/></label>
        <input type="hidden" name="versao" value={cartao?.updatedAt??""}/>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm">Emissor<Input name="emissor" defaultValue={cartao?.emissor??""} maxLength={120}/></label><label className="space-y-1 text-sm">Bandeira<Input name="bandeira" defaultValue={cartao?.bandeira??""} maxLength={60}/></label></div>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm">Quatro últimos dígitos<Input name="final" defaultValue={cartao?.final??""} maxLength={4} inputMode="numeric" pattern="[0-9]{4}"/></label><label className="space-y-1 text-sm">Limite (opcional)<CurrencyInput name="limite" defaultValue={cartao?.limite??""}/></label></div>
        <label className="block space-y-1 text-sm">Tolerância de datas para correspondências<Input name="toleranciaDias" type="number" min={0} max={31} defaultValue={cartao?.toleranciaDias??5}/></label>
        <label className="block space-y-1 text-sm">Observações<Input name="observacoes" defaultValue={cartao?.observacoes??""} maxLength={2000}/></label>
        <div className="space-y-1 text-sm">Conta bancária de pagamento<Select value={contaId} onValueChange={v=>setContaId(v??"")}><SelectTrigger aria-label="Conta bancária de pagamento" className="w-full"><SelectValue placeholder="Selecione">{()=>contas.find(c=>c.id===contaId)?.nome ?? "Selecione"}</SelectValue></SelectTrigger><SelectContent>{contas.filter(c=>c.ativo).map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm">Dia do fechamento<Input name="diaFechamento" type="number" min={1} max={31} defaultValue={cartao?.diaFechamento} required/></label><label className="space-y-1 text-sm">Dia do vencimento<Input name="diaVencimento" type="number" min={1} max={31} defaultValue={cartao?.diaVencimento} required/></label></div>
        <p className="text-xs text-muted-foreground">Compras no dia do fechamento já entram na próxima fatura. Em meses mais curtos, usamos o último dia. Alterações valem para novas despesas; vencimentos já provisionados são preservados.</p>
      </fieldset>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}<DialogFooter><DialogClose render={<Button type="button" variant="outline" disabled={pendente}/>}>Cancelar</DialogClose><Button type="submit" disabled={pendente || !contaId}>{pendente && <Loader2 className="size-4 animate-spin"/>}Salvar cartão</Button></DialogFooter></form>
    </DialogContent></Dialog>;
}
export function CartoesView({cartoes,contas}:{cartoes:CartaoOption[];contas:Conta[]}) {
  const acesso = useAcesso();
  return <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Cartões de crédito</h2><CartaoDialog contas={contas}/></div>
    {!cartoes.length && <p className="text-sm text-muted-foreground">Cadastre um cartão para provisionar compras conforme a fatura.</p>}
    <div className="grid gap-4 sm:grid-cols-2">{cartoes.map(c=><Card key={c.id}><CardHeader><div className="flex items-start justify-between gap-2"><div><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="size-4"/>{c.nome}</CardTitle><CardDescription>{c.contaBancariaNome}</CardDescription></div><StatusAtivoSalvavel ativo={c.ativo} nome={c.nome} motivoBloqueio={!acesso.pode("financeiro.bancario", "editar") ? "Seu acesso não permite editar cartões." : undefined} salvar={ativo=>alternarCartaoAction(c.id,ativo)}/></div></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm">Fecha dia <strong>{c.diaFechamento}</strong> · Vence dia <strong>{c.diaVencimento}</strong></p><CartaoDialog cartao={c} contas={contas}/></CardContent></Card>)}</div>
  </section>;
}
