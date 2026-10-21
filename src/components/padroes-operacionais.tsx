"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "cn";

export function GrupoAcoes({ children, nome = "Ações", className, alinhamento = "fim" }: { children: ReactNode; nome?: string; className?: string; alinhamento?: "inicio" | "fim" }) {
  return <div role="group" aria-label={nome} data-alinhamento={alinhamento} className={cn("ds-grupo-acoes", className)} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>{children}</div>;
}

export function BarraAcoes({ titulo, descricao, children, variante = "padrao", className }: { titulo: string; descricao?: string; children?: ReactNode; variante?: "padrao" | "compacta"; className?: string }) {
  const compacta = variante === "compacta";
  return <header data-variante={variante} className={cn("flex flex-wrap justify-between", compacta ? "items-center gap-2" : "items-start gap-4", className)}><div className={compacta ? "sr-only" : "min-w-0"}><h1 className={compacta ? "sr-only" : "text-display break-words"}>{titulo}</h1>{descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}</div><GrupoAcoes nome={`Ações de ${titulo}`} className={cn("ml-auto flex-wrap", compacta && "min-w-0 w-full flex-1")}>{children}</GrupoAcoes></header>;
}

/** Reserva geométrica também quando não há mudanças. Não salva ao perder foco. */
export function AcoesEdicao({ nome, alterado, salvando, confirmar, cancelar, invalido = false, somenteConfirmar = false, destacarAlterado = false }: {
  nome: string; alterado: boolean; salvando: boolean; confirmar: () => void; cancelar: () => void; invalido?: boolean; somenteConfirmar?: boolean; destacarAlterado?: boolean;
}) {
  return <GrupoAcoes nome={`Edição de ${nome}`} className="ds-reserva-edicao" alinhamento={somenteConfirmar ? "inicio" : "fim"}>
    <Button size="icon-sm" variant={alterado && destacarAlterado ? "entrada" : "outline"} aria-label={`Confirmar ${nome}`} title={`Confirmar ${nome}`} disabled={!alterado || salvando || invalido} onClick={confirmar} aria-busy={salvando || undefined}>{salvando ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}</Button>
    {!somenteConfirmar && <Button size="icon-sm" variant="ghost" aria-label={`Cancelar ${nome}`} title={`Cancelar ${nome}`} disabled={!alterado || salvando} onClick={cancelar}><X className="size-4" /></Button>}
  </GrupoAcoes>;
}

/** Validação e persistência vêm do domínio; a representação nunca arredonda números. */
export function EdicaoInline({ nome, valor, salvar, validar, disabled, motivoBloqueio, inputMode = "text" }: {
  nome: string; valor: string; salvar: (valor: string) => Promise<{ ok: true } | { erro: string }>;
  validar: (valor: string) => string | null; disabled?: boolean; motivoBloqueio?: string;
  inputMode?: "text" | "decimal" | "numeric";
}) {
  const [edicao, definirEdicao] = useState<{ base: string; valor: string } | null>(null);
  const [salvo, definirSalvo] = useState({ base: valor, valor });
  if (salvo.base !== valor) definirSalvo({ base: valor, valor });
  const [erro, definirErro] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const trava = useRef(false); const id = useId();
  const confirmado = salvo.base === valor ? salvo.valor : valor;
  const atual = edicao?.base === valor ? edicao.valor : confirmado;
  const alterado = atual !== confirmado;
  const bloqueado = disabled || Boolean(motivoBloqueio);
  function cancelar() { if (trava.current) return; definirEdicao(null); definirErro(""); }
  async function confirmar() {
    if (trava.current || bloqueado || !alterado) return;
    const mensagem = validar(atual); if (mensagem) { definirErro(mensagem); return; }
    trava.current = true; definirSalvando(true); definirErro("");
    try { const r = await salvar(atual); if ("erro" in r) definirErro(r.erro); else { definirSalvo({ base: valor, valor: atual }); definirEdicao(null); } }
    catch { definirErro("Não foi possível confirmar. Confira os dados antes de tentar novamente."); }
    finally { trava.current = false; definirSalvando(false); }
  }
  return <div className="ds-edicao-inline" onClick={e => e.stopPropagation()} onKeyDown={e => {
    e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); cancelar(); }
    if (e.key === "Enter" && e.target instanceof HTMLInputElement) { e.preventDefault(); void confirmar(); }
  }}>
    <label htmlFor={id} className="text-xs font-medium">{nome}</label>
    <div className="flex min-w-0 items-center gap-2"><Input id={id} inputMode={inputMode} value={atual} readOnly={bloqueado} disabled={salvando} aria-invalid={Boolean(erro)} aria-describedby={erro || motivoBloqueio ? `${id}-ajuda` : undefined} onChange={e => { definirEdicao({ base: valor, valor: e.target.value }); definirErro(""); }} className="min-w-0" /><AcoesEdicao nome={nome} alterado={alterado} salvando={salvando} confirmar={confirmar} cancelar={cancelar} invalido={bloqueado} /></div>
    <div className="min-h-4 text-xs" id={`${id}-ajuda`}>{erro ? <span role="alert" className="text-destructive">{erro}</span> : motivoBloqueio ? <span className="text-muted-foreground">{motivoBloqueio}</span> : <span className="sr-only" role="status">{salvando ? "Salvando" : alterado ? "Alteração não salva" : "Valor confirmado"}</span>}</div>
  </div>;
}

export function GradeSlots({ children }: { children: ReactNode }) { return <div className="ds-slots-container"><div className="ds-grade-slots">{children}</div></div>; }

export function SlotExpansivel({ titulo, resumo, acoes, children, abertoInicial = false }: { titulo: string; resumo?: ReactNode; acoes?: ReactNode; children: ReactNode; abertoInicial?: boolean }) {
  const id = useId(); const [aberto, definirAberto] = useState(abertoInicial);
  return <section className="min-w-0 rounded-[var(--ds-cartao-raio)] border bg-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-2"><h3 className="min-w-0 break-words font-semibold">{titulo}</h3>{acoes && <GrupoAcoes nome={`Ações de ${titulo}`} className="ml-auto">{acoes}</GrupoAcoes>}</div>
    {resumo && <div className="mt-2 text-xs text-muted-foreground">{resumo}</div>}
    <Button variant="ghost" size="sm" className="mt-2 max-w-full" aria-label={`${aberto ? "Recolher" : "Abrir"} ${titulo}`} aria-expanded={aberto} aria-controls={id} onClick={() => definirAberto(!aberto)}><ChevronDown className={aberto ? "size-4 rotate-180" : "size-4"} />{aberto ? "Recolher" : "Ver detalhes"}</Button>
    <div id={id} role="region" aria-label={`Conteúdo de ${titulo}`} hidden={!aberto} className="mt-3 min-w-0 break-words">{children}</div>
  </section>;
}
