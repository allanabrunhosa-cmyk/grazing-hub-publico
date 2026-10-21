"use client";
import { useId, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { GripVertical } from "lucide-react";

export function moverItem<T>(itens: T[], origem: number, destino: number) {
  const lista = [...itens];
  if (origem < 0 || destino < 0 || origem >= lista.length || destino >= lista.length) return lista;
  lista.splice(destino, 0, lista.splice(origem, 1)[0]);
  return lista;
}
/** Mouse, toque e teclado. Só confirma a ordem ao soltar/pressionar Enter. */
export function ListaOrdenavel<T>({ itens, chave, nome, mudar, children, disabled = false, className = "space-y-2" }: {
  itens: T[]; chave: (item: T) => string; nome: (item: T) => string; mudar: (itens: T[]) => void;
  children: (item: T, indice: number, alca: ReactNode) => ReactNode; disabled?: boolean; className?: string;
}) {
  const id = useId(); const raiz = useRef<HTMLDivElement>(null);
  const arrasto = useRef<{ chave: string; lista: T[]; teclado: boolean } | null>(null);
  const [previa, setPrevia] = useState<T[] | null>(null); const [aviso, setAviso] = useState("");
  const [arrastando, setArrastando] = useState<string | null>(null);
  function iniciar(item: T, teclado: boolean) {
    arrasto.current = { chave: chave(item), lista: [...itens], teclado }; setPrevia([...itens]);
    setArrastando(chave(item));
    setAviso(`${nome(item)} selecionado. Arraste ou use as setas; Enter confirma e Escape cancela.`);
  }
  function mover(destino: number) {
    const atual = arrasto.current; if (!atual) return;
    const origem = atual.lista.findIndex(i => chave(i) === atual.chave);
    if (destino === origem || destino < 0 || destino >= atual.lista.length) return;
    atual.lista = moverItem(atual.lista, origem, destino); setPrevia(atual.lista);
    setAviso(`Posição ${destino + 1} de ${atual.lista.length}.`);
  }
  function finalizar(cancelar = false) {
    const atual = arrasto.current; arrasto.current = null; setPrevia(null);
    setArrastando(null);
    if (atual && !cancelar && atual.lista.some((v, i) => chave(v) !== chave(itens[i]))) mudar(atual.lista);
    setAviso(cancelar ? "Ordenação cancelada." : "Ordem atualizada.");
  }
  function moverPonteiro(e: PointerEvent<HTMLDivElement>) {
    if (!arrasto.current || arrasto.current.teclado) return;
    const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-ordem]");
    if (alvo?.dataset.lista === id && raiz.current?.contains(alvo)) mover(Number(alvo.dataset.ordem));
    let pai = raiz.current?.parentElement;
    while (pai && pai.scrollHeight <= pai.clientHeight) pai = pai.parentElement;
    if (pai) { const r = pai.getBoundingClientRect(); if (e.clientY > r.bottom - 50) pai.scrollTop += 18; else if (e.clientY < r.top + 50) pai.scrollTop -= 18; }
  }
  return <div ref={raiz} className={className} onPointerMove={moverPonteiro} onPointerUp={() => { if (arrasto.current && !arrasto.current.teclado) finalizar(); }} onPointerCancel={() => { if (arrasto.current && !arrasto.current.teclado) finalizar(true); }}>
    <p id={id} className="sr-only">Arraste pela alça para reordenar. Pelo teclado, pressione Espaço, use as setas e confirme com Enter. Escape cancela.</p>
    <span className="sr-only" role="status" aria-live="polite">{aviso}</span>
    {(previa ?? itens).map((item, indice) => <div key={chave(item)} data-ordem={indice} data-lista={id} className={arrastando === chave(item) ? "rounded-xl ring-2 ring-primary" : undefined}>
      {children(item, indice, !disabled && <span className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}><button type="button" data-dialogo-altera aria-label={`Arrastar ${nome(item)}`} aria-describedby={id} aria-pressed={arrastando === chave(item)}
        className="flex size-9 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
        onPointerDown={e => { if (e.button !== 0 || disabled) return; iniciar(item, false); raiz.current?.setPointerCapture(e.pointerId); }}

        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (arrasto.current) finalizar(); else iniciar(item, true); } else if (e.key === "Escape" && arrasto.current) { e.preventDefault(); e.stopPropagation(); finalizar(true); } else if (arrasto.current && ["ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); mover(indice + (e.key === "ArrowUp" ? -1 : 1)); } }}
      ><GripVertical className="size-4" /></button></span>)}
    </div>)}
  </div>;
}
