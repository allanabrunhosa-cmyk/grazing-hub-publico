"use client";

import { useState } from "react";
import { Archive, CalendarDays, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FotoProduto } from "@/app/(protegido)/producao/etiquetas/foto-produto";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { EstadoDemonstracao } from "@/lib/design-system/grupos";
import "@/app/(protegido)/producao/etiquetas/validades.css";

/** Composição sintética da Central. Sem API, credenciais, fila ou hardware. */
export function DemonstracaoValidades({ estado }: { estado: EstadoDemonstracao }) {
  const [aberto,setAberto]=useState(false), [erro,setErro]=useState(false), [baixada,setBaixada]=useState(false);
  const [grupoAberto,setGrupoAberto]=useState(false);
  const ocupado=estado==="carregando"||estado==="salvando";
  const leitura=estado==="sem-permissao"||estado==="somente-leitura";
  const disabled=ocupado||estado==="desabilitado";
  const nome=estado==="longo"?"Produto de demonstração com identificação longa para conferir leitura e quebra nos cartões":"Morango de demonstração";
  function abrir() {setAberto(true);setErro(false);}
  function baixar() { if(estado==="erro") {setErro(true);return;} setBaixada(true);setAberto(false); }
  return <div className="validades-premium space-y-4" data-cenario={estado}>
    <p className="text-sm text-muted-foreground">Composição de Validades. A baixa deste exemplo não altera registros nem imprime.</p>
    <Tabs defaultValue="imprimir"><div className="validades-navegacao-emissao"><div className="validades-steps flex" aria-label="Etapas de exemplo">{["Responsável","Produto","Etiqueta"].map((etapa,i)=><Button variant="ghost" disabled={disabled} key={etapa} aria-label={etapa}><span>{i+1}</span><span className="validades-nome-etapa">{etapa}</span></Button>)}</div><TabsList aria-label="Áreas de exemplo"><TabsTrigger value="imprimir">Imprimir</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger></TabsList></div><TabsContent value="imprimir"><Tabs defaultValue="grupo"><TabsList aria-label="Escolha do produto de exemplo" variant="line"><TabsTrigger value="grupo">Grupo</TabsTrigger><TabsTrigger value="produto">Produto</TabsTrigger><TabsTrigger value="conservacao">Conservação</TabsTrigger></TabsList><TabsContent value="grupo">Escolha um grupo ou busque pelo produto.</TabsContent><TabsContent value="produto"><div className="flex items-center gap-3"><FotoProduto className="validades-foto-selecao" /><span>Produto de demonstração · foto cadastrada ou ícone de apoio</span></div></TabsContent><TabsContent value="conservacao">Escolha a conservação para revisar.</TabsContent></Tabs></TabsContent><TabsContent value="historico">Histórico sintético.</TabsContent></Tabs>
    {estado==="vazio"||baixada?<p role="status">Nenhuma etiqueta neste exemplo.</p>:<Card className="validades-etiqueta"><CardContent>
      <Button variant="ghost" className="validades-abrir-slot" aria-label={`Ver etiqueta de ${nome}`} disabled={disabled} onClick={()=>abrir()}><span className="sr-only">Ver etiqueta</span></Button>
      <div className="validades-etiqueta-conteudo"><FotoProduto /><div className="min-w-0 flex-1"><h3 className="font-semibold">{nome}</h3><p className="text-xs text-muted-foreground">Frutas · Refrigerado</p><span className="validades-chip mt-2" data-tom="critico"><TriangleAlert />Vencida</span><p className="mt-2 flex gap-2 text-sm"><CalendarDays className="size-4" />20/09/2026, 14:11</p></div></div>
      <div className="validades-etiqueta-acoes"><span className="flex items-center gap-2 text-sm">Ver etiqueta <ChevronRight className="ml-auto size-4" /></span>{!leitura&&<Button variant="outline" disabled={disabled} onClick={baixar}><Archive />Dar baixa</Button>}</div>
    </CardContent></Card>}
    {erro&&!aberto&&<p role="alert">Falha simulada. A etiqueta foi preservada.</p>}
    <Card><CardContent><Button variant="ghost" className="h-auto min-h-11 w-full whitespace-normal text-left" aria-expanded={grupoAberto} aria-controls="validades-demo-agrupadas" onClick={()=>setGrupoAberto(!grupoAberto)}><span className="min-w-0 flex-1">Produto agrupado · 2 registros</span><ChevronDown className={grupoAberto?"rotate-180":""} /></Button><div id="validades-demo-agrupadas" role="region" aria-label="Registros agrupados do exemplo" hidden={!grupoAberto} className="validades-registros"><p className="validades-registro">Lote A · Refrigerado · 1 etiqueta</p><p className="validades-registro">Lote B · Congelado · 1 etiqueta</p></div></CardContent></Card>
    {ocupado&&<p role="status">Aguarde a conclusão do exemplo…</p>}
    {leitura&&<p className="text-sm text-muted-foreground">Consulta permitida. Baixa indisponível neste perfil.</p>}
    <Dialog open={aberto} onOpenChange={setAberto} protegerAlteracoes={false}><DialogContent className="validades-detalhe"><DialogHeader><DialogTitle>{nome}</DialogTitle><DialogDescription>Detalhe sintético da etiqueta.</DialogDescription></DialogHeader><span className="validades-chip" data-tom="critico">Vencida</span><dl className="validades-dados-etiqueta"><div><dt>Responsável</dt><dd>Equipe fictícia</dd></div><div><dt>Conservação</dt><dd>Refrigerado</dd></div></dl>{erro&&<p role="alert" className="text-destructive">Falha simulada. A etiqueta foi preservada.</p>}<footer className="validades-detalhe-acoes"><DialogClose render={<Button variant="outline" />}>Fechar</DialogClose>{!leitura&&<Button variant="entrada" disabled={disabled} onClick={baixar}><Archive />Dar baixa</Button>}</footer></DialogContent></Dialog>
  </div>;
}
