"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { StatusAtivo } from "@/components/status-ativo";
import { BotaoRemoverItem } from "@/components/remover-item";

export function SlotComplemento({ nome, controles, alca, children, abertoInicial = false }: {
  nome: string; controles: ReactNode; alca?: ReactNode; children?: ReactNode; abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial); const id = useId();
  return <div className="min-w-0 w-full rounded-xl border bg-card">
    <div className="overflow-x-auto"><div className="flex min-w-96 items-center gap-2 px-2 py-1">
      {alca}{children && <button type="button" className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={`${aberto ? "Fechar" : "Abrir"} composição de ${nome}`} aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(a => !a)}><ChevronRight className={`size-4 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`} /></button>}
      <div className="min-w-0 flex-1">{children ? <button type="button" className="block w-full truncate text-left text-sm font-medium" title={nome} aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(a => !a)}>{nome}</button> : <span className="block truncate text-left text-sm font-medium" title={nome}>{nome}</span>}</div>
      {controles}
    </div></div>
    {children && <div id={id} hidden={!aberto} className="min-w-0 space-y-2 border-t p-2">{children}</div>}
  </div>;
}

export function LinhaComplemento({ nome, preco, ativo, alterarPreco, alterarAtivo, remover, alca, children, abertoInicial = false, statusBloqueado = false }: {
  nome: string; preco: string; ativo: boolean; alterarPreco: (preco: string) => void;
  alterarAtivo: (ativo: boolean) => void; remover: () => void; alca?: ReactNode; children: ReactNode; abertoInicial?: boolean; statusBloqueado?: boolean;
}) {
  return <SlotComplemento nome={nome} alca={alca} abertoInicial={abertoInicial} controles={<><div className="w-32 shrink-0"><CurrencyInput aria-label={`Preço de ${nome}`} required value={preco} onValueChange={alterarPreco} /></div><StatusAtivo nome={nome} ativo={ativo} disabled={statusBloqueado} onChange={alterarAtivo} /><BotaoRemoverItem nome={`Remover ${nome}`} data-dialogo-altera onClick={remover} /></>}>{children}</SlotComplemento>;
}
