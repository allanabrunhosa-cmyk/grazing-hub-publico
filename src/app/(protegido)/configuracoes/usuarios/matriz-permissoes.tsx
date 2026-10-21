"use client";

import { Check, ChevronRight, Minus } from "lucide-react";
import { useId, useState } from "react";
import { ACOES, ROTULOS, CATALOGO, permissaoEfetiva, type Permissoes, type Excecoes, type Acao, type SecaoCatalogo } from "@/lib/permissoes/catalogo";
import { RECURSOS_ATENDIMENTO, SECOES_ATENDIMENTO } from "@/lib/permissoes/atendimento";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GrupoAcoes } from "@/components/padroes-operacionais";

const modulosMatriz = CATALOGO.flatMap(modulo => {
  const atendimento = modulo.secoes.filter(secao => secao.id === "crm" || secao.id.startsWith("crm.atendimento."));
  const demais = modulo.secoes.filter(secao => !atendimento.includes(secao));
  return [
    ...(demais.length ? [{ ...modulo, nome: modulo.id === "vendas" ? "Vendas" : modulo.nome, secoes: demais }] : []),
    ...(atendimento.length ? [{ id: "atendimento", nome: "Atendimento", secoes: atendimento }] : []),
  ];
});

export function MatrizPermissoes({ base, excecoes, aoMudar, aoPersonalizar, bloqueada = false }: {
  base: Permissoes; excecoes?: Excecoes; aoMudar?: (valor: Permissoes) => void; aoPersonalizar?: (valor: Excecoes) => void; bloqueada?: boolean;
}) {
  const personalizada = !!aoPersonalizar;
  const idDescricao = useId();
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
        if (acao === "visualizar" && !permitir) for (const a of RECURSOS_ATENDIMENTO.find(r => r.id === recurso)?.acoes ?? ACOES) definir(a, false);
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
  return <div className="space-y-3">
    <div className="rounded-xl bg-primary/5 p-3 text-sm text-muted-foreground">
      {personalizada ? "As permissões do perfil são herdadas. Ajuste as ações para personalizar somente este usuário." : "Visualizar é necessário para editar, adicionar ou excluir. Sem ações, a seção fica bloqueada."}
      <span className="mt-1 block">Clique no título de uma coluna para marcar ou desmarcar todas as ações daquela coluna no módulo.</span>
      {personalizada && <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span id={`${idDescricao}-permitida`} className="inline-flex items-center gap-2"><span aria-hidden="true" className="flex size-4 items-center justify-center rounded border-2 border-yellow-500 bg-yellow-400 text-slate-950"><Check className="size-3" strokeWidth={3} /></span>Permissão extra</span>
        <span id={`${idDescricao}-vetada`} className="inline-flex items-center gap-2"><span aria-hidden="true" className="size-4 rounded border-2 border-yellow-500 bg-transparent" />Veto extra</span>
        <span id={`${idDescricao}-herdada`} className="sr-only">Segue o perfil</span>
      </span>}
    </div>
    {modulosMatriz.map(modulo => {
      const secoes = modulo.secoes.filter(secao => !secao.administradorApenas);
      if (!secoes.length) return null;
      if (modulo.id === "atendimento") return <MatrizAtendimento key={modulo.id} recursos={secoes} base={base} excecoes={excecoes} personalizada={personalizada} bloqueada={bloqueada} idDescricao={idDescricao} alterar={alterar} aoMudar={aoMudar} aoPersonalizar={aoPersonalizar} />;
      return <details key={modulo.id} open={modulo.id === "suprimentos" || modulo.id === "configuracoes"} className="group overflow-hidden rounded-2xl border bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-3 hover:bg-muted/30 sm:px-4">
        <ChevronRight className="size-4 shrink-0 transition-transform group-open:rotate-90" />
        <span className="min-w-0 flex-1 font-semibold">{modulo.nome}</span>
        <span className="flex basis-full flex-wrap items-center gap-1 sm:basis-auto sm:gap-1.5">
          <span className="mr-auto text-[11px] whitespace-nowrap text-muted-foreground sm:mr-2">{secoes.filter(s => permissaoEfetiva(base, excecoes ?? {}, s.id, "visualizar")).length}/{secoes.length} seções</span>
          {!personalizada && !bloqueada && ["Bloquear", "Só visualizar", "Tudo"].map((nome, i) => <button key={nome} type="button" aria-label={`${nome} em ${modulo.nome}`}
            className="rounded-lg border bg-background px-1.5 py-1.5 text-[11px] font-medium sm:px-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
            onClick={evento => { evento.preventDefault(); evento.stopPropagation(); aoMudar?.({ ...base, ...Object.fromEntries(secoes.map(s => [s.id, i === 0 ? [] : i === 1 ? ["visualizar"] : [...s.acoes]])) }); }}>{i === 1 ? "Só ver" : nome}</button>)}
        </span>
      </summary>
      <div className="grid grid-cols-4 items-center border-t bg-muted/20 px-3 py-1.5 text-center text-[10px] font-medium text-muted-foreground sm:px-4 md:grid-cols-[minmax(170px,1fr)_repeat(4,78px)] md:text-[11px]">
        <span className="hidden text-left md:block">SEÇÃO / AÇÃO</span>
        {ACOES.map(acao => {
          const secoesDaAcao = secoes.filter(s => s.acoes.includes(acao));
          const marcadas = secoesDaAcao.filter(s => permissaoEfetiva(base, excecoes ?? {}, s.id, acao)).length;
          const todas = secoesDaAcao.length > 0 && marcadas === secoesDaAcao.length;
          return <button key={acao} type="button" role="checkbox" aria-checked={todas ? true : marcadas ? "mixed" : false}
            aria-label={`${modulo.nome}: ${ROTULOS[acao]} em todas as seções`} disabled={bloqueada || !secoesDaAcao.length}
            title={`${todas ? "Desmarcar" : "Marcar"} ${ROTULOS[acao].toLowerCase()} em ${modulo.nome}`}
            className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
            onClick={() => alterar(secoesDaAcao.map(s => s.id), acao, !todas)}>
            <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded border ${marcadas ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-background"}`}>{todas ? <Check className="size-3" /> : marcadas ? <Minus className="size-3" /> : null}</span>
            {ROTULOS[acao]}
          </button>;
        })}
      </div>
      {secoes.map(entrada => {
        const secao = { ...entrada, nome: entrada.nomeMatriz ?? entrada.nome };
        const idDescricaoSecao = `${idDescricao}-${secao.id}-descricao`;
        const dif = Object.keys(excecoes?.[secao.id] ?? {}).length;
        const visivel = permissaoEfetiva(base, excecoes ?? {}, secao.id, "visualizar");
        return <div key={secao.id} role="group" aria-label={secao.nome} aria-describedby={secao.descricao ? idDescricaoSecao : undefined} className="grid grid-cols-4 gap-y-2 border-t px-3 py-3 sm:px-4 md:grid-cols-[minmax(170px,1fr)_repeat(4,78px)] md:items-center">
          <div className="col-span-4 min-w-0 pr-2 md:col-span-1"><p className="text-sm font-medium">{secao.nome}</p>{secao.descricao && <p id={idDescricaoSecao} className="mt-1 text-xs text-muted-foreground">{secao.descricao}</p>}<div className="mt-1 flex flex-wrap items-center gap-2">{!visivel && <span className="text-[11px] text-muted-foreground">Bloqueado</span>}{!!dif && <><span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Personalizada</span><button type="button" disabled={bloqueada} aria-label={`Restaurar perfil em ${secao.nome}`} className="text-[11px] text-primary underline" onClick={() => { const novo = { ...excecoes }; delete novo[secao.id]; aoPersonalizar?.(novo); }}>Restaurar</button></>}</div></div>
          {ACOES.map(acao => {
            const excecao = excecoes?.[secao.id]?.[acao];
            const extra = typeof excecao === "boolean" && excecao !== (base[secao.id]?.includes(acao) ?? false);
            const descricao = extra ? (excecao ? "Permissão extra" : "Veto extra") : "Segue o perfil";
            return <label key={acao} title={personalizada ? descricao : undefined} className="flex min-h-8 items-center justify-center gap-2 text-sm"><span className="sr-only">{ROTULOS[acao]}</span>{secao.acoes.includes(acao) ? <span className="relative flex size-4 shrink-0 items-center justify-center">
              <input type="checkbox" className={`peer size-4 cursor-pointer appearance-none rounded border-2 bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default forced-colors:appearance-auto ${extra ? "border-yellow-500 checked:bg-yellow-400" : "border-muted-foreground/50 checked:border-primary checked:bg-primary"}`} aria-label={`${secao.nome}: ${ROTULOS[acao]}`} aria-describedby={personalizada ? `${idDescricao}-${extra ? (excecao ? "permitida" : "vetada") : "herdada"}` : undefined} disabled={bloqueada} checked={permissaoEfetiva(base, excecoes ?? {}, secao.id, acao)} onChange={e => alterar([secao.id], acao, e.target.checked)} />
              <Check aria-hidden="true" strokeWidth={3} className={`pointer-events-none absolute hidden size-3 peer-checked:block forced-colors:hidden ${extra ? "text-slate-950" : "text-primary-foreground"}`} />
            </span> : <span aria-label="Não se aplica" className="text-muted-foreground">—</span>}</label>;
          })}
        </div>;
      })}
    </details>;
    })}
  </div>;
}

type PropsAtendimento = {
  recursos: SecaoCatalogo[]; base: Permissoes; excecoes?: Excecoes; personalizada: boolean; bloqueada: boolean; idDescricao: string;
  alterar: (recursos: string[], acao: Acao, permitir: boolean) => void;
  aoMudar?: (valor: Permissoes) => void; aoPersonalizar?: (valor: Excecoes) => void;
};
const gradeAtendimento = "grid grid-cols-4 items-center gap-y-2 px-3 sm:px-4 md:grid-cols-[minmax(170px,1fr)_repeat(4,78px)]";

function MatrizAtendimento({ recursos, base, excecoes, personalizada, bloqueada, idDescricao, alterar, aoMudar, aoPersonalizar }: PropsAtendimento) {
  const [abertas, definirAbertas] = useState<string[]>(["chat"]);
  const secoes = SECOES_ATENDIMENTO.map(secao => ({ ...secao, recursos: secao.recursos.map(id => recursos.find(r => r.id === id)).filter((r): r is SecaoCatalogo => !!r) })).filter(secao => secao.recursos.length);
  const visiveis = (itens: SecaoCatalogo[]) => itens.filter(r => permissaoEfetiva(base, excecoes ?? {}, r.id, "visualizar")).length;
  function acoesConjunto(itens: SecaoCatalogo[], nome: string) {
    if (personalizada || bloqueada) return null;
    return <GrupoAcoes nome={`Acesso em ${nome}`} alinhamento="inicio">{["Bloquear", "Só visualizar", "Tudo"].map((rotulo, indice) => <Button key={rotulo} type="button" variant="outline" size="sm" aria-label={`${rotulo} em ${nome}`} onClick={evento => {
      evento.preventDefault(); evento.stopPropagation();
      aoMudar?.({ ...base, ...Object.fromEntries(itens.map(r => [r.id, indice === 0 ? [] : indice === 1 ? ["visualizar"] : [...r.acoes]])) });
    }}>{indice === 1 ? "Só ver" : rotulo}</Button>)}</GrupoAcoes>;
  }
  function colunas(itens: SecaoCatalogo[], nome: string, modulo = false) {
    return <div className={`${gradeAtendimento} border-t bg-muted/20 py-2 text-center text-xs text-muted-foreground`}>
      <span className="hidden text-left font-medium md:block">{modulo ? "TODAS AS SEÇÕES" : "RECURSO / AÇÃO"}</span>
      {ACOES.map(acao => {
        const aplicaveis = itens.filter(r => r.acoes.includes(acao));
        const marcadas = aplicaveis.filter(r => permissaoEfetiva(base, excecoes ?? {}, r.id, acao)).length;
        const todas = !!aplicaveis.length && marcadas === aplicaveis.length;
        return <Button key={acao} type="button" variant="ghost" className="min-w-0 flex-col gap-1 whitespace-normal px-1" role="checkbox" aria-checked={todas ? true : marcadas ? "mixed" : false} aria-label={`${nome}: ${ROTULOS[acao]} em ${modulo ? "todas as seções" : "todos os recursos"}`} disabled={bloqueada || !aplicaveis.length} onClick={() => alterar(aplicaveis.map(r => r.id), acao, !todas)}>
          <span aria-hidden="true" className={`flex size-4 items-center justify-center rounded border ${marcadas ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50 bg-background"}`}>{todas ? <Check className="size-3" /> : marcadas ? <Minus className="size-3" /> : null}</span>{ROTULOS[acao]}
        </Button>;
      })}
    </div>;
  }
  function linha(recurso: SecaoCatalogo) {
    const nome = recurso.nomeMatriz ?? recurso.nome;
    const idAjuda = `${idDescricao}-${recurso.id}-descricao`;
    const dif = Object.keys(excecoes?.[recurso.id] ?? {}).length;
    return <div key={recurso.id} role="group" aria-label={nome} aria-describedby={recurso.descricao ? idAjuda : undefined} className={`${gradeAtendimento} border-t py-3`}>
      <div className="col-span-4 min-w-0 pr-2 md:col-span-1"><p className="text-sm font-medium">{nome}</p>{recurso.descricao && <p id={idAjuda} className="mt-1 text-xs text-muted-foreground">{recurso.descricao}</p>}<div className="mt-1 flex flex-wrap items-center gap-2">{!permissaoEfetiva(base, excecoes ?? {}, recurso.id, "visualizar") && <span className="text-xs text-muted-foreground">Bloqueado</span>}{!!dif && <><span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Personalizada</span><Button type="button" variant="link" size="sm" disabled={bloqueada} aria-label={`Restaurar perfil em ${nome}`} onClick={() => { const novo = { ...excecoes }; delete novo[recurso.id]; aoPersonalizar?.(novo); }}>Restaurar</Button></>}</div></div>
      {ACOES.map(acao => {
        if (!recurso.acoes.includes(acao)) return <span key={acao} title="Esta operação não está disponível para este recurso." aria-label={`${nome}: ${ROTULOS[acao]} não se aplica`} className="flex min-h-11 items-center justify-center text-muted-foreground">—</span>;
        const excecao = excecoes?.[recurso.id]?.[acao];
        const extra = typeof excecao === "boolean" && excecao !== (base[recurso.id]?.includes(acao) ?? false);
        const descricao = extra ? (excecao ? "Permissão extra" : "Veto extra") : "Segue o perfil";
        return <label key={acao} title={personalizada ? descricao : undefined} className="flex min-h-11 cursor-pointer items-center justify-center"><Checkbox className={extra ? "border-yellow-500 data-checked:border-yellow-500 data-checked:bg-yellow-400 data-checked:text-slate-950" : undefined} aria-label={`${nome}: ${ROTULOS[acao]}`} aria-describedby={personalizada ? `${idDescricao}-${extra ? (excecao ? "permitida" : "vetada") : "herdada"}` : undefined} disabled={bloqueada} checked={permissaoEfetiva(base, excecoes ?? {}, recurso.id, acao)} onCheckedChange={valor => alterar([recurso.id], acao, valor)} /></label>;
      })}
    </div>;
  }
  return <details open className="group/atendimento overflow-hidden rounded-2xl border bg-card" aria-label="Módulo Atendimento">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-3 hover:bg-muted/30 sm:px-4"><ChevronRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-open/atendimento:rotate-90" /><span className="min-w-0 flex-1 font-semibold">Atendimento</span><span className="text-xs text-muted-foreground">{secoes.length} seções · {visiveis(recursos)}/{recursos.length} recursos</span><span className="basis-full sm:basis-auto">{acoesConjunto(recursos, "Atendimento")}</span></summary>
    <p className="border-t px-3 py-3 text-xs text-muted-foreground sm:px-4">Módulo → seção → recurso. As ações valem somente para o recurso selecionado. O traço (—) indica uma operação indisponível. Mensagens e histórico são preservados.</p>
    {colunas(recursos, "Atendimento", true)}
    {secoes.map(secao => <details key={secao.id} open={abertas.includes(secao.id)} className="group/secao border-t" aria-label={`Seção ${secao.nome}`}><summary onClick={evento => { evento.preventDefault(); definirAbertas(atuais => atuais.includes(secao.id) ? atuais.filter(id => id !== secao.id) : [...atuais, secao.id]); }} className="flex cursor-pointer list-none flex-wrap items-center gap-2 bg-muted/10 px-3 py-3 hover:bg-muted/30 sm:px-4"><ChevronRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-open/secao:rotate-90" /><span className="min-w-0 flex-1 font-semibold">{secao.nome}</span><span className="text-xs text-muted-foreground">{visiveis(secao.recursos)}/{secao.recursos.length} recursos</span><span className="basis-full sm:basis-auto">{acoesConjunto(secao.recursos, secao.nome)}</span></summary>{abertas.includes(secao.id) && <>{colunas(secao.recursos, secao.nome)}{secao.recursos.map(linha)}</>}</details>)}
  </details>;
}
