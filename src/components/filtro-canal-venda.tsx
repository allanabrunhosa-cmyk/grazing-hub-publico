"use client";

import { useId } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

export type FiltroCanalVendaProps = {
  canais: readonly { id: string; nome: string }[];
  canalId?: string;
  nomeCanalSelecionado?: string;
  aoMudar: (canalId: string | undefined) => void;
  disabled?: boolean;
  contagens?: Readonly<Record<string, number>>;
};

/** Consulta simples: seleção exclusiva e imediata, controlada pelo consumidor. */
export function FiltroCanalVenda({ canais, canalId, nomeCanalSelecionado, aoMudar, disabled = false, contagens }: FiltroCanalVendaProps) {
  const idGrupo = useId();
  const foraDoCatalogo = Boolean(canalId && !canais.some(canal => canal.id === canalId));
  function opcao(id: string | undefined, nome: string, indisponivel = false) {
    const marcado = id === canalId || (!id && !canalId);
    const idNome = idGrupo + "-" + (id === undefined ? "todos" : encodeURIComponent(id));
    return <label key={id ?? "todos"} className="flex min-h-[var(--ds-controle-altura-compacta)] cursor-pointer items-center gap-3 rounded-[var(--ds-controle-raio)] px-2 py-2 text-sm transition-colors duration-[var(--ds-movimento-rapido)] hover:bg-accent focus-within:bg-accent has-disabled:cursor-not-allowed has-disabled:opacity-50 [@media(pointer:coarse)]:min-h-[var(--ds-controle-altura)]">
      <Checkbox aria-labelledby={idNome} aria-describedby={indisponivel ? idNome + "-ajuda" : undefined} checked={marcado} disabled={disabled} onCheckedChange={ativo => { if (ativo) aoMudar(id); else if (id && marcado) aoMudar(undefined); }} />
      <span className="min-w-0 break-words"><span id={idNome}>{nome}{contagens && <>{" "}<span className="tabular-nums">({(contagens[id ?? ""] ?? 0).toLocaleString("pt-BR")})</span></>}</span>{indisponivel && <span id={idNome + "-ajuda"} className="mt-0.5 block text-xs text-muted-foreground">Fora do catálogo atual; desmarque para remover.</span>}</span>
    </label>;
  }
  return <Popover>
    <PopoverTrigger render={<Button variant="outline" size="sm" disabled={disabled} />}><Filter aria-hidden="true" />Filtros{canalId && <span aria-hidden="true" className="text-xs tabular-nums">1</span>}</PopoverTrigger>
    <PopoverContent align="start">
      <PopoverTitle id={idGrupo} className="mb-2">Canal</PopoverTitle>
      <div role="group" aria-labelledby={idGrupo}>
        {opcao(undefined, "Todos os canais")}
        {canais.map(canal => opcao(canal.id, canal.nome))}
        {foraDoCatalogo && opcao(canalId, nomeCanalSelecionado?.trim() || "Canal selecionado (indisponível)", true)}
      </div>
      {canais.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nenhum canal disponível no catálogo.</p>}
    </PopoverContent>
  </Popover>;
}
