"use client";

import { Check, ChevronRight, Minus } from "lucide-react";
import { useId, useState } from "react";
import { ACOES, ROTULOS, SECOES, permissaoEfetiva, type Permissoes, type Excecoes, type Acao } from "@/lib/permissoes/catalogo";
import { filtrarMatriz, normalizarBusca, type ModuloMatriz, type TemaMatriz } from "@/lib/permissoes/organizacao";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { GrupoAcoes } from "@/components/padroes-operacionais";

const grade = "grid grid-cols-4 items-center gap-y-2 px-3 sm:px-4 md:grid-cols-[minmax(170px,1fr)_repeat(4,78px)]";
const alternar = (lista: string[], id: string) => lista.includes(id) ? lista.filter(item => item !== id) : [...lista, id];

/** Matriz em três níveis: módulo → seção → tema. As ações valem somente para o tema da linha. */
export function MatrizPermissoes({ base, excecoes, aoMudar, aoPersonalizar, bloqueada = false }: {
  base: Permissoes; excecoes?: Excecoes; aoMudar?: (valor: Permissoes) => void; aoPersonalizar?: (valor: Excecoes) => void; bloqueada?: boolean;
}) {
  const personalizada = !!aoPersonalizar;
  const idDescricao = useId();
  const [busca, definirBusca] = useState("");
  const [modulosAbertos, definirModulosAbertos] = useState<string[]>(["suprimentos", "atendimento", "configuracoes"]);
  const [secoesAbertas, definirSecoesAbertas] = useState<string[]>(["atendimento/chat"]);
  const emBusca = !!normalizarBusca(busca);
  const modulos = filtrarMatriz(busca);
  const efetiva = (recurso: string, acao: Acao) => permissaoEfetiva(base, excecoes ?? {}, recurso, acao);
  const visiveis = (temas: TemaMatriz[]) => temas.filter(tema => efetiva(tema.id, "visualizar")).length;

  function alterar(recursos: string[], acao: Acao, permitir: boolean) {
    if (bloqueada) return;
    if (personalizada) {
      const novo: Excecoes = structuredClone(excecoes ?? {});
      for (const recurso of recursos) {
        const definir = (a: Acao, v: boolean) => {
          if (v === (base[recurso]?.includes(a) ?? false)) { if (novo[recurso]) delete novo[recurso][a]; }
          else (novo[recurso] ??= {})[a] = v;
        };
        definir(acao, permitir);
        if (acao !== "visualizar" && permitir) definir("visualizar", true);
        if (acao === "visualizar" && !permitir) for (const a of SECOES.find(s => s.id === recurso)?.acoes ?? ACOES) definir(a, false);
        if (novo[recurso] && !Object.keys(novo[recurso]).length) delete novo[recurso];
      }
      aoPersonalizar!(novo);
    } else {
      const novo = { ...base };
      for (const recurso of recursos) {
        let acoes = [...(base[recurso] ?? [])].filter(a => a !== acao);
        if (permitir) acoes.push(acao);
        if (acao !== "visualizar" && permitir && !acoes.includes("visualizar")) acoes.push("visualizar");
        if (acao === "visualizar" && !permitir) acoes = [];
        novo[recurso] = acoes;
      }
      aoMudar?.(novo);
    }
  }

  // Ações em lote ficam ocultas durante a busca: o conjunto visível não é a seção inteira.
  function acoesConjunto(temas: TemaMatriz[], nome: string) {
    if (personalizada || bloqueada || emBusca) return null;
    return <GrupoAcoes nome={`Acesso em ${nome}`} alinhamento="inicio">{["Bloquear", "Só visualizar", "Tudo"].map((rotulo, indice) => <Button key={rotulo} type="button" variant="outline" size="sm" aria-label={`${rotulo} em ${nome}`} onClick={evento => {
      evento.preventDefault(); evento.stopPropagation();
      aoMudar?.({ ...base, ...Object.fromEntries(temas.map(tema => [tema.id, indice === 0 ? [] : indice === 1 ? ["visualizar"] : [...tema.acoes]])) });
    }}>{indice === 1 ? "Só ver" : rotulo}</Button>)}</GrupoAcoes>;
  }
  function colunas(temas: TemaMatriz[], nome: string, modulo = false) {
    return <div className={`${grade} border-t bg-muted/20 py-2 text-center text-xs text-muted-foreground`}>
      <span className="hidden text-left font-medium md:block">{modulo ? "TODAS AS SEÇÕES" : "TEMA / AÇÃO"}</span>
      {ACOES.map(acao => {
        if (emBusca) return <span key={acao} className="flex min-h-9 items-center justify-center">{ROTULOS[acao]}</span>;
        const aplicaveis = temas.filter(tema => tema.acoes.includes(acao));
        const marcadas = aplicaveis.filter(tema => efetiva(tema.id, acao)).length;
        const todas = !!aplicaveis.length && marcadas === aplicaveis.length;
        return <Button key={acao} type="button" variant="ghost" className="min-w-0 flex-col gap-1 whitespace-normal px-1" role="checkbox" aria-checked={todas ? true : marcadas ? "mixed" : false} aria-label={`${nome}: ${ROTULOS[acao]} em ${modulo ? "todas as seções" : "todos os temas"}`} title={`${todas ? "Desmarcar" : "Marcar"} ${ROTULOS[acao].toLowerCase()} em ${nome}`} disabled={bloqueada || !aplicaveis.length} onClick={() => alterar(aplicaveis.map(tema => tema.id), acao, !todas)}>
          <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded border ${marcadas ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-background"}`}>{todas ? <Check className="size-3" /> : marcadas ? <Minus className="size-3" /> : null}</span>{ROTULOS[acao]}
        </Button>;
      })}
    </div>;
  }
  function linha(tema: TemaMatriz) {
    const nome = tema.nomeMatriz ?? tema.nome;
    const idAjuda = `${idDescricao}-${tema.id}-descricao`;
    const dif = Object.keys(excecoes?.[tema.id] ?? {}).length;
    return <div key={tema.id} role="group" aria-label={nome} aria-describedby={tema.descricao ? idAjuda : undefined} className={`${grade} border-t py-3`}>
      <div className="col-span-4 min-w-0 pr-2 md:col-span-1"><p className="text-sm font-medium">{nome}</p>{tema.descricao && <p id={idAjuda} className="mt-1 text-xs text-muted-foreground">{tema.descricao}</p>}<div className="mt-1 flex flex-wrap items-center gap-2">{!efetiva(tema.id, "visualizar") && <span className="text-xs text-muted-foreground">Bloqueado</span>}{!!dif && <><span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Personalizada</span><Button type="button" variant="link" size="sm" disabled={bloqueada} aria-label={`Restaurar perfil em ${nome}`} onClick={() => { const novo = { ...excecoes }; delete novo[tema.id]; aoPersonalizar?.(novo); }}>Restaurar</Button></>}</div></div>
      {ACOES.map(acao => {
        if (!tema.acoes.includes(acao)) return <span key={acao} title="Esta operação não está disponível para este tema." aria-label={`${nome}: ${ROTULOS[acao]} não se aplica`} className="flex min-h-11 items-center justify-center text-muted-foreground">—</span>;
        const excecao = excecoes?.[tema.id]?.[acao];
        const extra = typeof excecao === "boolean" && excecao !== (base[tema.id]?.includes(acao) ?? false);
        const descricao = extra ? (excecao ? "Permissão extra" : "Veto extra") : "Segue o perfil";
        return <label key={acao} title={personalizada ? descricao : undefined} className="flex min-h-11 cursor-pointer items-center justify-center"><Checkbox className={extra ? "border-yellow-500 data-checked:border-yellow-500 data-checked:bg-yellow-400 data-checked:text-slate-950" : undefined} aria-label={`${nome}: ${ROTULOS[acao]}`} aria-describedby={personalizada ? `${idDescricao}-${extra ? (excecao ? "permitida" : "vetada") : "herdada"}` : undefined} disabled={bloqueada} checked={efetiva(tema.id, acao)} onCheckedChange={valor => alterar([tema.id], acao, valor)} /></label>;
      })}
    </div>;
  }
  function modulo(item: ModuloMatriz) {
    const temas = item.secoes.flatMap(secao => secao.temas);
    const aberto = emBusca || modulosAbertos.includes(item.id);
    return <details key={item.id} open={aberto} className="group/modulo overflow-hidden rounded-2xl border bg-card" aria-label={`Módulo ${item.nome}`}>
      <summary onClick={evento => { evento.preventDefault(); if (!emBusca) definirModulosAbertos(atuais => alternar(atuais, item.id)); }} className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-3 hover:bg-muted/30 sm:px-4"><ChevronRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-open/modulo:rotate-90" /><span className="min-w-0 flex-1 font-semibold">{item.nome}</span><span className="text-xs text-muted-foreground">{item.secoes.length} {item.secoes.length === 1 ? "seção" : "seções"} · {visiveis(temas)}/{temas.length} temas</span><span className="basis-full sm:basis-auto">{acoesConjunto(temas, item.nome)}</span></summary>
      {!emBusca && colunas(temas, item.nome, true)}
      {item.secoes.map(secao => {
        const secaoAberta = emBusca || secoesAbertas.includes(secao.chave);
        return <details key={secao.id} open={secaoAberta} className="group/secao border-t" aria-label={`Seção ${secao.nome}`}>
          <summary onClick={evento => { evento.preventDefault(); if (!emBusca) definirSecoesAbertas(atuais => alternar(atuais, secao.chave)); }} className="flex cursor-pointer list-none flex-wrap items-center gap-2 bg-muted/10 px-3 py-3 hover:bg-muted/30 sm:px-4"><ChevronRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-open/secao:rotate-90" /><span className="min-w-0 flex-1 font-semibold">{secao.nome}</span><span className="text-xs text-muted-foreground">{visiveis(secao.temas)}/{secao.temas.length} temas</span><span className="basis-full sm:basis-auto">{acoesConjunto(secao.temas, secao.nome)}</span></summary>
          {secaoAberta && <>{colunas(secao.temas, secao.nome)}{secao.temas.map(linha)}</>}
        </details>;
      })}
    </details>;
  }

  return <div className="space-y-3">
    <div className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
      {personalizada ? "As permissões do perfil são herdadas. Ajuste as ações para personalizar somente este usuário." : "Visualizar é necessário para editar, adicionar ou excluir. Sem ações, o tema fica bloqueado."}
      <span className="mt-1 block">Módulo → seção → tema. Abra a seção para ver os temas; as ações valem somente para o tema da linha e o traço (—) indica uma operação que não existe nele. O título de uma coluna marca ou desmarca a ação em todo o conjunto.</span>
      {personalizada && <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span id={`${idDescricao}-permitida`} className="inline-flex items-center gap-2"><span aria-hidden="true" className="flex size-4 items-center justify-center rounded border-2 border-yellow-500 bg-yellow-400 text-slate-950"><Check className="size-3" strokeWidth={3} /></span>Permissão extra</span>
        <span id={`${idDescricao}-vetada`} className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded border-2 border-yellow-500 bg-transparent" />Veto extra</span>
        <span id={`${idDescricao}-herdada`} className="sr-only">Segue o perfil</span>
      </span>}
    </div>
    <label className="block space-y-1.5 text-sm font-medium">Buscar permissão
      <Input type="search" maxLength={60} placeholder="Ex.: baixar nota fiscal, desconto, etiquetas" value={busca} onChange={evento => definirBusca(evento.target.value)} />
    </label>
    {emBusca && <p role="status" className="text-xs text-muted-foreground">{modulos.length ? "Mostrando somente os temas encontrados. Limpe a busca para ver todos e usar as ações em lote." : `Nenhuma permissão encontrada para “${busca.trim()}”.`}</p>}
    {modulos.map(modulo)}
  </div>;
}
