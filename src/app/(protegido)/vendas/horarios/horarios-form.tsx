"use client";

import { useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { BarraAcoes, GrupoAcoes } from "@/components/padroes-operacionais";
import { ListaOrdenavel } from "@/components/lista-ordenavel";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIAS_ENTREGA, HORAS_ENTREGA, MINUTOS_ENTREGA, horariosEntregaVazios, validarHorariosEntrega, type DiaEntrega, type FaixaEntrega, type HorariosEntrega } from "@/lib/vendas/horarios-entrega-dominio";
import { converterHorariosEntrega, type HorariosPedidos } from "@/lib/vendas/pedidos-horarios-dominio";
import { salvarHorariosAction } from "./actions";

type Dados = { configuracao: HorariosEntrega | null; versao: number };
type Salvar = (configuracao: HorariosEntrega, versao: number, chave: string) => Promise<{ ok: true; configuracao: HorariosEntrega; versao: number } | { erro: string }>;
type FaixaRascunho = FaixaEntrega & { chaveLocal: string };
type DiaRascunho = Omit<DiaEntrega, "horarios"> & { horarios: FaixaRascunho[] };
type AgendaRascunho = Omit<HorariosEntrega, "semana" | "especiais"> & { semana: DiaRascunho[]; especiais: { data: string; horarios: FaixaRascunho[] }[] };
const novoHorario = (): FaixaRascunho => ({ inicio: "", fim: "", texto: "", chaveLocal: crypto.randomUUID() });
function rascunho(config: HorariosEntrega, base: string): AgendaRascunho {
  return { ...config, semana: config.semana.map((dia, i) => ({ ...dia, horarios: dia.horarios.map((h, n) => ({ ...h, chaveLocal: `${base}-dia-${i}-${n}` })) })), especiais: config.especiais.map(e => ({ ...e, horarios: e.horarios.map((h, n) => ({ ...h, chaveLocal: `${base}-${e.data}-${n}` })) })) };
}

function Selecao({ nome, valor, opcoes, selecionar, placeholder = "Selecione" }: { nome: string; valor: string; opcoes: { value: string; label: string }[]; selecionar: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return <div className="grid min-w-0"><Label htmlFor={id} className="sr-only">{nome}</Label>
    <Select items={opcoes} value={valor || null} onValueChange={v => selecionar(v ?? "")}>
      <SelectTrigger id={id} className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>{opcoes.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>;
}
function ParteHora({ nome, valor, opcoes, alterar, placeholder }: { nome: string; valor: string; opcoes: string[]; alterar: (v: string) => void; placeholder: string }) {
  const itens = opcoes.map(value => ({ value, label: value || "—" }));
  return <Select items={itens} value={valor || null} onValueChange={v => alterar(v ?? "")}>
    <SelectTrigger size="sm" className="w-20" aria-label={nome}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent align="start" alignItemWithTrigger={false}>{itens.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
  </Select>;
}
function Hora({ nome, valor, alterar, contexto }: { nome: string; valor: string; alterar: (v: string) => void; contexto: string }) {
  const [hora, minuto] = valor.split(":");
  return <div className="flex flex-col gap-1 lg:flex-row">
    <ParteHora nome={`${nome} — hora — ${contexto}`} valor={hora ?? ""} opcoes={["", ...HORAS_ENTREGA, ...(nome === "Término" ? ["24"] : [])]} alterar={v => alterar(v ? `${v}:${v === "24" ? "00" : minuto || "00"}` : "")} placeholder="Hora" />
    <ParteHora nome={`${nome} — minutos — ${contexto}`} valor={minuto ?? ""} opcoes={["", ...(hora === "24" ? ["00"] : MINUTOS_ENTREGA)]} alterar={v => alterar(v ? `${hora || "00"}:${v}` : "")} placeholder="Min." />
  </div>;
}
const colunasHorario = "grid grid-cols-[2.25rem_5rem_5rem_2.25rem] items-center gap-x-2 gap-y-2 lg:grid-cols-[2.25rem_10.25rem_10.25rem_minmax(10rem,1fr)_2.25rem]";
function ListaHorarios({ horarios, alterar, contexto, disabled }: { horarios: FaixaRascunho[]; alterar: (h: FaixaRascunho[]) => void; contexto: string; disabled: boolean }) {
  return <div className="min-w-0 space-y-3">
    <Button type="button" variant="outline" disabled={horarios.length >= 100} onClick={() => alterar([novoHorario(), ...horarios])}><Plus className="size-4" />Adicionar horário</Button>
    {!!horarios.length && <div className="overflow-x-auto"><div className="lg:min-w-[40rem]">
      <div className={`${colunasHorario} mb-2 text-sm font-medium`} aria-hidden="true"><span /><span>Início</span><span>Término</span><span className="hidden lg:block">Horário em texto (opcional)</span></div>
      <ListaOrdenavel itens={horarios} chave={h => h.chaveLocal} nome={h => `${h.texto || (h.inicio ? `${h.inicio}–${h.fim}` : "horário")} de ${contexto}`} mudar={alterar} disabled={disabled}>
        {(h, i, alca) => <div className={`${colunasHorario} border-b border-border/60 pb-3`}>
          <div className="self-start lg:self-center">{alca}</div>
          <Hora nome="Início" contexto={`${contexto}, linha ${i + 1}`} valor={h.inicio} alterar={inicio => alterar(horarios.map(v => v.chaveLocal === h.chaveLocal ? { ...v, inicio } : v))} />
          <Hora nome="Término" contexto={`${contexto}, linha ${i + 1}`} valor={h.fim} alterar={fim => alterar(horarios.map(v => v.chaveLocal === h.chaveLocal ? { ...v, fim } : v))} />
          <label className="col-start-2 col-end-4 row-start-2 grid min-w-0 gap-1 text-sm lg:col-auto lg:row-auto"><span className="lg:sr-only">Horário em texto (opcional)</span><Input value={h.texto} maxLength={100} placeholder="Ex.: Pela manhã" onChange={e => alterar(horarios.map(v => v.chaveLocal === h.chaveLocal ? { ...v, texto: e.target.value } : v))} /></label>
          <div className="col-start-4 row-start-1 self-start lg:col-auto lg:row-auto lg:self-center"><BotaoRemoverItem nome={`Remover horário ${i + 1} de ${contexto}`} disabled={disabled} onClick={() => alterar(horarios.filter(v => v.chaveLocal !== h.chaveLocal))} /></div>
        </div>}
      </ListaOrdenavel>
    </div></div>}
    {!horarios.length && <p className="text-sm text-muted-foreground">Nenhum horário adicionado.</p>}

  </div>;
}

export function HorariosEntregaForm({ inicial, editar, salvar }: { inicial: Dados; editar: boolean; salvar: Salvar }) {
  const id = useId();
  const [confirmado, setConfirmado] = useState(inicial);
  const [d, setD] = useState(() => rascunho(inicial.configuracao ?? horariosEntregaVazios(), id));
  const [dataDesativada, setDataDesativada] = useState("");
  const [dataEspecial, setDataEspecial] = useState("");
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [salvando, setSalvando] = useState(false);
  const trava = useRef(false);
  const tentativa = useRef<{ assinatura: string; chave: string } | null>(null);
  const alterado = !confirmado.configuracao || JSON.stringify(d, (chave, valor) => chave === "chaveLocal" ? undefined : valor) !== JSON.stringify(confirmado.configuracao);
  function mudar(novo: AgendaRascunho) { setD(novo); setErro(""); setSucesso(""); }
  function dia(i: number, novo: DiaRascunho) { mudar({ ...d, semana: d.semana.map((v, n) => n === i ? novo : v) }); }
  function selecionarDia(i: number, escolha: string) {
    if (escolha.startsWith("copiar:")) {
      const origem = Number(escolha.slice(7)), fonte = d.semana[origem];
      dia(i, { fechado: fonte.fechado, horarios: fonte.horarios.map(h => ({ ...h, chaveLocal: crypto.randomUUID() })), copiadoDe: origem });
    } else dia(i, { fechado: escolha === "fechado", horarios: d.semana[i].horarios });
  }
  function adicionarData(data: string, especial: boolean) {
    if (!data) return;
    if (d.desativadas.includes(data) || d.especiais.some(e => e.data === data)) { setErro("Esta data já está cadastrada. Remova a exceção anterior para mudar seu tipo."); return; }
    if (especial) { mudar({ ...d, especiais: [{ data, horarios: [novoHorario()] }, ...d.especiais] }); setDataEspecial(""); }
    else { mudar({ ...d, desativadas: [...d.desativadas, data].sort() }); setDataDesativada(""); }
  }
  async function confirmar() {
    if (trava.current || !editar || !alterado) return;
    let configuracao: HorariosEntrega;
    try { configuracao = validarHorariosEntrega(d); } catch (e) { setErro((e as Error).message); return; }
    const assinatura = JSON.stringify({ configuracao, versao: confirmado.versao });
    if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() };
    trava.current = true; setSalvando(true); setErro(""); setSucesso("");
    try {
      const r = await salvar(configuracao, confirmado.versao, tentativa.current.chave);
      if ("erro" in r) setErro(r.erro);
      else { setConfirmado(r); setD(rascunho(r.configuracao, id)); tentativa.current = null; setSucesso("Horários de entrega salvos."); }
    } catch { setErro("Não foi possível salvar os horários. Tente novamente."); }
    finally { trava.current = false; setSalvando(false); }
  }
  const acoes = <><Button type="button" variant="outline" disabled={!editar || !alterado || salvando} onClick={() => { mudar(rascunho(confirmado.configuracao ?? horariosEntregaVazios(), id)); setDataDesativada(""); setDataEspecial(""); }}>Cancelar</Button><Button type="button" disabled={!editar || !alterado || salvando} aria-busy={salvando} onClick={() => void confirmar()}>{salvando ? "Salvando…" : "Salvar horários"}</Button></>;
  return <div className="space-y-6">
    <BarraAcoes titulo="Horários de entrega" descricao="Configure os dias da semana e as exceções por data. As alterações só entram em vigor ao salvar.">{acoes}</BarraAcoes>
    {!editar && <p className="text-sm text-muted-foreground">Seu acesso permite consultar os horários. A edição exige permissão em Horários de entrega.</p>}
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {sucesso && <p role="status" className="text-sm text-muted-foreground">{sucesso}</p>}
    <fieldset disabled={!editar || salvando} className="min-w-0 space-y-6"><legend className="sr-only">Agenda de entrega</legend>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card role="region" aria-label="Desativar datas"><CardHeader><CardTitle>Desativar datas</CardTitle><CardDescription>Bloqueie entregas em uma data específica.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2"><label className="grid flex-1 gap-1 text-sm font-medium">Data a desativar<Input type="date" value={dataDesativada} onChange={e => setDataDesativada(e.target.value)} /></label><Button type="button" variant="outline" disabled={!dataDesativada || d.desativadas.length >= 500} onClick={() => adicionarData(dataDesativada, false)}>Desativar data</Button></div>
          {!d.desativadas.length && <p className="text-muted-foreground">Nenhuma data desativada.</p>}
          {d.desativadas.map(data => <div key={data} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><span>{new Date(`${data}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · Sem entregas</span><Button type="button" variant="ghost" aria-label={`Remover data desativada ${data}`} onClick={() => mudar({ ...d, desativadas: d.desativadas.filter(v => v !== data) })}>Remover</Button></div>)}
        </CardContent></Card>
        <Card role="region" aria-label="Datas especiais"><CardHeader><CardTitle>Datas especiais</CardTitle><CardDescription>Os horários desta data substituem os do dia da semana, inclusive quando ele está fechado.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-2"><label className="grid flex-1 gap-1 text-sm font-medium">Data especial<Input type="date" value={dataEspecial} onChange={e => setDataEspecial(e.target.value)} /></label><Button type="button" variant="outline" disabled={!dataEspecial || d.especiais.length >= 500} onClick={() => adicionarData(dataEspecial, true)}>Adicionar data</Button></div>
          {!d.especiais.length && <p className="text-muted-foreground">Nenhuma data especial.</p>}
        </CardContent></Card>
      </div>
      {d.especiais.map((e, i) => <Card key={e.data} size="sm" role="region" aria-label={`Horários especiais de ${e.data}`}><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{new Date(`${e.data}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })} · Data especial</CardTitle><Button type="button" variant="ghost" aria-label={`Remover data especial ${e.data}`} onClick={() => mudar({ ...d, especiais: d.especiais.filter(v => v.data !== e.data) })}>Remover data</Button></div></CardHeader><CardContent><ListaHorarios horarios={e.horarios} contexto={`data ${e.data}`} disabled={!editar || salvando} alterar={horarios => mudar({ ...d, especiais: d.especiais.map((v, n) => n === i ? { ...v, horarios } : v) })} /></CardContent></Card>)}
      <div className="space-y-4">{d.semana.map((v, i) => <Card key={DIAS_ENTREGA[i]} size="sm" role="region" aria-label={DIAS_ENTREGA[i]}>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3"><h2 className="shrink-0 font-heading text-title">{DIAS_ENTREGA[i]}</h2>
            <div className="w-64 min-w-0"><Selecao nome={`Configuração de ${DIAS_ENTREGA[i]}`} valor={v.copiadoDe !== undefined ? `copiar:${v.copiadoDe}` : v.fechado ? "fechado" : "personalizar"} opcoes={[{ value: "fechado", label: "Dia fechado" }, { value: "personalizar", label: "Personalizar" }, ...DIAS_ENTREGA.flatMap((label, n) => n === i ? [] : [{ label: `Copiar de ${label}`, value: `copiar:${n}` }])]} selecionar={escolha => selecionarDia(i, escolha)} /></div>
          </div>
          {v.fechado ? <p className="text-sm text-muted-foreground">Sem entregas neste dia da semana.</p> : <ListaHorarios horarios={v.horarios} contexto={DIAS_ENTREGA[i]} disabled={!editar || salvando} alterar={horarios => dia(i, { fechado: false, horarios })} />}
        </CardContent>
      </Card>)}</div>
    </fieldset>
    <GrupoAcoes nome="Salvar agenda de entrega" className="justify-end flex-wrap">{acoes}</GrupoAcoes>
  </div>;
}

export function HorariosForm({ inicial, editar }: { inicial: { horarios: HorariosPedidos | null; versao: number }; editar: boolean }) {
  return <HorariosEntregaForm inicial={{ configuracao: converterHorariosEntrega(inicial.horarios), versao: inicial.versao }} editar={editar} salvar={async (configuracao, versao, chave) => {
    const r = await salvarHorariosAction(configuracao, versao, chave);
    return "erro" in r ? { erro: r.erro } : { ok: true, configuracao, versao: r.versao };
  }} />;
}
