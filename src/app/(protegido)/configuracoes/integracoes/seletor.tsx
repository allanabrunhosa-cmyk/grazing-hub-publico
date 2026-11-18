import Link from "next/link";
import { ArrowUpRight, Bot, FileText, Plug } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent } from "@/components/ui/card";
import { IconeTom, type Tom } from "./tons";

export type IntegracaoId = "mcp" | "brasilnfe";
const INTEGRACOES: { id: IntegracaoId; nome: string; resumo: string; href: string; tom: Tom; icone: typeof Bot; externa?: boolean }[] = [
  { id: "mcp", nome: "MCP do Grazing HUB", resumo: "Assistentes de IA", href: "/configuracoes/integracoes/mcp", tom: "azul", icone: Bot },
  { id: "brasilnfe", nome: "Brasil NFe", resumo: "NF-e e NFC-e · abre em Fiscal", href: "/configuracoes/integracoes/brasilnfe", tom: "verde", icone: FileText, externa: true },
];

/** Cabeçalho e seletor comuns das Integrações. A permissão de cada item é decidida no servidor pela página. */
export function CabecalhoIntegracoes({ disponiveis, ativa }: { disponiveis: IntegracaoId[]; ativa?: IntegracaoId }) {
  const itens = INTEGRACOES.filter(i => disponiveis.includes(i.id));
  return <div className="space-y-6">
    <header className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-[var(--ds-cartao-raio)] bg-primary text-primary-foreground"><Plug className="size-5" /></span>
      <div className="min-w-0"><h1 className="text-display break-words">Integrações</h1><p className="mt-1 text-sm text-muted-foreground">Conecte e gerencie as integrações do Grazing HUB.</p></div>
    </header>
    <Card size="sm"><CardContent><nav aria-label="Integrações disponíveis" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {itens.map(i => { const Icone = i.icone; const selecionada = i.id === ativa; return <Link key={i.id} href={i.href} aria-current={selecionada ? "page" : undefined}
        className={cn("flex min-h-11 min-w-0 items-center gap-3 rounded-[var(--ds-aba-raio)] px-3 py-2 text-sm transition-colors duration-[var(--ds-movimento-rapido)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          selecionada ? "bg-foreground text-background" : "hover:bg-muted")}>
        <IconeTom tom={i.tom} tamanho="pequeno"><Icone /></IconeTom>
        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i.nome}</span><span className={cn("block truncate text-xs", selecionada ? "text-background/70" : "text-muted-foreground")}>{i.resumo}</span></span>
        {i.externa && <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 opacity-60" />}
      </Link>; })}
    </nav></CardContent></Card>
  </div>;
}
