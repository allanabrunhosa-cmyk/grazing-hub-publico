"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import type { EstadoDemonstracao } from "@/lib/design-system/grupos";

/** Demonstra somente estado sintético, sem importar ações ou dados de Pedidos. */
export function DemonstracaoProcesso({ estado }: { estado: EstadoDemonstracao }) {
  const [etapa, setEtapa] = useState(0), [erro, setErro] = useState("");
  const nomes = ["Em preparo", "Pronto", "Em rota", "Entregues"];
  const estilos = ["bg-warning-bg text-warning", "bg-success-bg text-success", "bg-[var(--ds-processo-rota-fundo)] text-[var(--ds-processo-rota)]", "bg-[var(--ds-processo-entregue-fundo)] text-[var(--ds-processo-entregue)]"];
  const bloqueado = ["desabilitado", "sem-permissao", "somente-leitura", "carregando", "salvando"].includes(estado);
  function mudar(delta: number) { if (estado === "erro") setErro("Transição recusada no exemplo. A etapa foi preservada."); else { setEtapa(v => v + delta); setErro(""); } }
  return <div className="space-y-3"><p className="text-xs text-muted-foreground">Quatro etapas fixas. Cor acompanha texto; avançar e retornar alteram apenas este exemplo.</p><div className="grid gap-2 sm:grid-cols-4">{nomes.map((nome, n) => <section key={nome} className="rounded-[var(--ds-cartao-raio)] border bg-muted p-3"><h3 className="mb-3 font-medium">{nome}</h3>{estado !== "vazio" && etapa === n && <article className={`rounded-[var(--ds-controle-raio)] p-3 ${estilos[n]}`}><p className="break-words">Pedido #101 · {estado === "longo" ? "Cliente fictício com nome completo extenso para conferir quebra de linhas" : "Cliente fictício"}</p><p className="my-2 text-xs">{nome}</p><GrupoAcoes nome="Etapa do exemplo">{etapa > 0 && <Button variant="ghost" size="icon-sm" aria-label="Retornar etapa do exemplo" disabled={bloqueado} onClick={() => mudar(-1)}><ArrowLeft /></Button>}{etapa < 3 && <Button variant="outline" size="icon-sm" aria-label="Avançar etapa do exemplo" disabled={bloqueado} onClick={() => mudar(1)}><ArrowRight /></Button>}</GrupoAcoes></article>}</section>)}</div>{erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}</div>;
}
