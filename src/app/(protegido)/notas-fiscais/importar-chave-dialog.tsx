"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { importarChavePelaApi } from "@/lib/notas-fiscais/api-cliente";
export function ImportarChaveDialog() {
  const router = useRouter();
  const [aberto,setAberto]=useState(false),[pendente,iniciar]=useTransition();
  function consultar(form:FormData) { iniciar(async()=>{
    try { const r=await importarChavePelaApi(String(form.get("chave")??"")); if("erro" in r){toast.error(r.erro);return;}toast.success(r.mensagem);setAberto(false);router.refresh(); }
    catch {toast.error("Não foi possível consultar a chave. Tente novamente mais tarde.");}
  }); }
  return <Dialog open={aberto} onOpenChange={v=>{if(!pendente)setAberto(v);}}><DialogTrigger render={<Button type="button" variant="outline"/>}><KeyRound className="size-4"/>Importar pela chave</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Importar NF-e pela chave</DialogTitle><DialogDescription>Consulte uma nota destinada à empresa usando os 44 dígitos do DANFE.</DialogDescription></DialogHeader><form action={consultar} className="space-y-4"><label className="block space-y-1 text-sm">Chave de acesso<Input name="chave" inputMode="numeric" maxLength={60} required disabled={pendente} placeholder="44 dígitos"/></label><p className="text-xs text-muted-foreground">A disponibilidade depende da SEFAZ e da janela de até 90 dias. A consulta não confirma a operação nem lança despesas. Se o XML não estiver disponível, solicite o arquivo ao fornecedor.</p><DialogFooter><Button type="submit" disabled={pendente}>{pendente && <Loader2 className="size-4 animate-spin"/>}Consultar e importar</Button></DialogFooter></form></DialogContent></Dialog>;
}
