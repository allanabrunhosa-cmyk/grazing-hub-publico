"use client";

import { useId, useState, type ReactNode } from "react";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { periodoDoAno, periodoDoMes, periodoUltimosDias, mesesFechados } from "@/lib/financeiro/periodos";

const OPCOES = [
  ["7", "Últimos 7 dias"], ["30", "Últimos 30 dias"], ["90", "Últimos 90 dias"],
  ["MES_FECHADO", "Mês fechado"], ["MES", "Mês completo"], ["ANO", "Ano completo"],
] as const;
type OpcaoPeriodo = "" | typeof OPCOES[number][0];
type CampoData = "de" | "ate";
type RascunhoData = { original: string; valor: string; incompleta: boolean };

export function FiltroPeriodo({ de, ate, aoAlterar, acoes, acoesDireita }: {
  de: string; ate: string; aoAlterar: (periodo: { de: string; ate: string }) => void;
  acoes?: ReactNode;
  acoesDireita?: ReactNode;
}) {
  const identificador = useId();
  const [opcao, definirOpcao] = useState<OpcaoPeriodo>("");
  const [mes, definirMes] = useState("");
  const [ano, definirAno] = useState("");
  const [rascunhos, definirRascunhos] = useState<Partial<Record<CampoData, RascunhoData>>>({});
  const [baseRascunho, definirBaseRascunho] = useState({ de, ate });
  if (baseRascunho.de !== de || baseRascunho.ate !== ate) {
    definirBaseRascunho({ de, ate });
    definirRascunhos({});
  }
  const edicaoDe = rascunhos.de?.original === de ? rascunhos.de : undefined;
  const edicaoAte = rascunhos.ate?.original === ate ? rascunhos.ate : undefined;
  const fechados = mesesFechados(new Date());

  function selecionar(valor: string | null) {
    if (!valor) return;
    definirRascunhos({});
    definirOpcao(valor as OpcaoPeriodo);
    if (valor === "7" || valor === "30" || valor === "90") aoAlterar(periodoUltimosDias(Number(valor), new Date()));
    if (valor === "MES_FECHADO") definirMes("");
    const referencia = de || periodoUltimosDias(1, new Date()).de;
    if (valor === "MES") {
      definirMes(referencia.slice(0, 7));
      const periodo = periodoDoMes(referencia.slice(0, 7));
      if (periodo) aoAlterar(periodo);
    }
    if (valor === "ANO") {
      definirAno(referencia.slice(0, 4));
      const periodo = periodoDoAno(referencia.slice(0, 4));
      if (periodo) aoAlterar(periodo);
    }
  }

  function alterarData(campo: CampoData, valor: string) {
    definirOpcao("");
    definirMes("");
    definirAno("");
    definirRascunhos(atuais => ({ ...atuais, [campo]: { original: campo === "de" ? de : ate, valor, incompleta: false } }));
  }

  function confirmarData(campo: CampoData, entrada: HTMLInputElement) {
    const valor = entrada.value;
    // Um segmento incompleto também tem value vazio; isso não significa limpar o limite.
    if (entrada.validity.badInput || !entrada.validity.valid || (valor && !/^\d{4}-\d{2}-\d{2}$/.test(valor))) {
      definirRascunhos(atuais => ({ ...atuais, [campo]: { original: campo === "de" ? de : ate, valor, incompleta: true } }));
      return;
    }
    if (valor !== (campo === "de" ? de : ate)) aoAlterar({ de, ate, [campo]: valor });
  }

  const botaoLimpar = (de || ate || opcao) && <Button type="button" size="sm" variant="ghost" className="h-9!" onClick={() => {
    definirRascunhos({}); definirOpcao(""); definirMes(""); definirAno(""); aoAlterar({ de: "", ate: "" });
  }}>Limpar datas</Button>;

  const controles = <>
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <label htmlFor={identificador + "-de"}>De</label>
      <Input id={identificador + "-de"} type="date" min="0001-01-01" max="9999-12-31" value={edicaoDe?.valor ?? de} aria-invalid={edicaoDe?.incompleta || undefined} aria-describedby={edicaoDe?.incompleta ? identificador + "-erro-de" : undefined} className="h-9! w-36 py-1.5" onChange={evento => alterarData("de", evento.target.value)} onBlur={evento => confirmarData("de", evento.currentTarget)} onKeyDown={evento => { if (evento.key === "Enter") { evento.preventDefault(); confirmarData("de", evento.currentTarget); } }} />
    </div>
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <label htmlFor={identificador + "-ate"}>até</label>
      <Input id={identificador + "-ate"} type="date" min="0001-01-01" max="9999-12-31" value={edicaoAte?.valor ?? ate} aria-invalid={edicaoAte?.incompleta || undefined} aria-describedby={edicaoAte?.incompleta ? identificador + "-erro-ate" : undefined} className="h-9! w-36 py-1.5" onChange={evento => alterarData("ate", evento.target.value)} onBlur={evento => confirmarData("ate", evento.currentTarget)} onKeyDown={evento => { if (evento.key === "Enter") { evento.preventDefault(); confirmarData("ate", evento.currentTarget); } }} />
    </div>
    <Select value={opcao} onValueChange={selecionar}>
      <SelectTrigger aria-label="Filtro" className="h-9! gap-2">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M2 5h3m5 0h12M2 12h12m5 0h3M2 19h6m5 0h9" />
          <circle cx="7.5" cy="5" r="2.5" /><circle cx="16.5" cy="12" r="2.5" /><circle cx="10.5" cy="19" r="2.5" />
        </svg>
        <SelectValue placeholder="Filtro">{() => OPCOES.find(([valor]) => valor === opcao)?.[1] ?? "Filtro"}</SelectValue>
      </SelectTrigger>
      <SelectContent>{OPCOES.map(([valor, titulo]) => <SelectItem key={valor} value={valor}>{titulo}</SelectItem>)}</SelectContent>
    </Select>
    {opcao === "MES_FECHADO" && (fechados.length ? <Select value={mes} onValueChange={valor => {
      if (!valor) return;
      definirMes(valor);
      const periodo = periodoDoMes(valor);
      if (periodo) aoAlterar(periodo);
    }}>
      <SelectTrigger aria-label="Mês fechado" className="h-9!">
        <SelectValue placeholder="Selecione o mês">{() => fechados.find(m => m.valor === mes)?.label ?? "Selecione o mês"}</SelectValue>
      </SelectTrigger>
      <SelectContent>{fechados.map(m => <SelectItem key={m.valor} value={m.valor}>{m.label}</SelectItem>)}</SelectContent>
    </Select> : <span className="text-sm text-muted-foreground">Nenhum mês fechado neste ano ainda.</span>)}
    {opcao === "MES" && <Input aria-label="Mês de referência" type="month" value={mes} className="h-9! w-48 py-1.5" onChange={evento => {
      definirMes(evento.target.value);
      const periodo = periodoDoMes(evento.target.value);
      if (periodo) aoAlterar(periodo);
    }} />}
    {opcao === "ANO" && <Input aria-label="Ano de referência" type="number" min={1} max={9999} value={ano} className="h-9! w-28 py-1.5" onChange={evento => {
      definirAno(evento.target.value);
      const periodo = periodoDoAno(evento.target.value);
      if (periodo) aoAlterar(periodo);
    }} />}
    {acoes ? <GrupoAcoes nome="Opções do período" alinhamento="inicio" className="flex-wrap">{botaoLimpar}{acoes}</GrupoAcoes> : botaoLimpar}
  </>;

  return <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Filtro de data">
    {acoesDireita ? <div className="flex w-full min-w-0 flex-wrap items-start gap-2">
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-1">{controles}</div>
      <GrupoAcoes nome="Ações do filtro" className="ml-auto shrink-0">{acoesDireita}</GrupoAcoes>
    </div> : controles}
    <p className="w-full text-xs text-muted-foreground">As datas são aplicadas ao sair do campo ou pressionar Enter.</p>
    {edicaoDe?.incompleta && <p id={identificador + "-erro-de"} role="alert" className="w-full text-xs text-destructive">Complete a data inicial com dia, mês e ano válido de quatro dígitos.</p>}
    {edicaoAte?.incompleta && <p id={identificador + "-erro-ate"} role="alert" className="w-full text-xs text-destructive">Complete a data final com dia, mês e ano válido de quatro dígitos.</p>}
    {opcao === "MES" && !periodoDoMes(mes) && <p role="alert" className="w-full text-xs text-destructive">Selecione um mês válido.</p>}
    {opcao === "ANO" && !periodoDoAno(ano) && <p role="alert" className="w-full text-xs text-destructive">Informe o ano com quatro dígitos.</p>}
    {de && ate && de > ate && <p role="alert" className="w-full text-xs text-destructive">A data inicial deve ser anterior ou igual à final.</p>}
  </div>;
}
