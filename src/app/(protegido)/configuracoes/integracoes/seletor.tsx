import type { ReactNode } from "react";
import Link from "next/link";
import { Bot, FileText, Plug, Plus, Server, ShieldCheck, ShoppingBag, Wallet } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogoMark } from "@/components/logo";
import { FaixaServidorMcp } from "./mcp/faixa-servidor";
import { IconeTom, situacaoDaConexao, type Tom } from "./tons";

export type ResumoIntegracoes = {
  mcp: { endereco: string; ativo: boolean; configurado: boolean; editar: boolean; conexoes: { id: string; nome: string; clienteNome: string; situacao: string }[] } | null;
  brasilnfe: boolean;
  certificado: { resumo: string; tom: Tom } | null;
  /** Cobrança pelo Asaas e pedidos do site: visíveis a quem acessa as configurações da loja. */
  asaas?: { resumo: string; tom: Tom } | null;
  site?: { resumo: string; tom: Tom } | null;
};
type Item = { id: string; nome: string; resumo: string; href: string; tom: Tom; icone: typeof Bot;
  /** Identificação visual no lugar do ícone genérico: a marca do HUB ou as iniciais da aplicação. */
  marca?: "hub"; monograma?: string; logo?: string };

/** Logos de sistemas conhecidos, em `public/marca/integracoes` (origem e data no inventário visual). */
const LOGOS_DE_APLICACOES: { padrao: RegExp; arquivo: string }[] = [
  { padrao: /open\s*bot/i, arquivo: "openbot" },
  { padrao: /chat\s*gpt|open\s*ai/i, arquivo: "chatgpt" },
];
const caminhoDoLogo = (arquivo: string) => `/marca/integracoes/${arquivo}.png`;
/** Logo da aplicação quando o nome cadastrado identifica um sistema conhecido; senão, a grade usa as iniciais. */
export function logoDaAplicacao(nome: string) {
  const achado = LOGOS_DE_APLICACOES.find(l => l.padrao.test(nome));
  return achado ? caminhoDoLogo(achado.arquivo) : undefined;
}

/** Iniciais da aplicação conectada ("OpenBot" → "OB", "ChatGPT — Allan" → "CG"), para distinguir conexões na grade. */
export function monogramaDaAplicacao(nome: string) {
  const partes = nome.match(/\p{Lu}+(?!\p{Ll})|\p{Lu}?\p{Ll}+|\d+/gu) ?? [];
  return partes.slice(0, 2).map(p => p[0]!.toLocaleUpperCase("pt-BR")).join("");
}

export const rotaConexaoMcp = (id: string) => `/configuracoes/integracoes/mcp?conexao=${encodeURIComponent(id)}`;
/** Conexão aberta quando a URL não escolhe uma: a primeira ativa, depois a primeira vigente. */
export function conexaoMcpInicial(mcp: NonNullable<ResumoIntegracoes["mcp"]>) {
  return (mcp.conexoes.find(c => c.situacao === "ATIVA") ?? mcp.conexoes.find(c => c.situacao !== "REVOGADA"))?.id ?? (mcp.editar ? "nova" : "servidor");
}

/**
 * Conexões vigentes que a pessoa pode ver, na ordem do seletor. As permissões vêm resolvidas do servidor.
 * Revogadas não entram: são definitivas e ficam só no histórico do Servidor MCP. Criar conexão é uma
 * ação à parte (`MolduraIntegracoes`), para não se confundir com uma conexão existente.
 */
export function itensDoSeletor(resumo: ResumoIntegracoes): Item[] {
  const itens: Item[] = [];
  if (resumo.mcp) {
    for (const c of resumo.mcp.conexoes.filter(c => c.situacao !== "REVOGADA")) { const s = situacaoDaConexao(c.situacao); itens.push({ id: `mcp:${c.id}`, nome: c.nome, resumo: `${c.clienteNome} · ${s.rotulo}`, href: rotaConexaoMcp(c.id), tom: s.tom, icone: Bot, monograma: monogramaDaAplicacao(c.clienteNome), logo: logoDaAplicacao(c.clienteNome) }); }
  }
  if (resumo.brasilnfe) itens.push({ id: "brasilnfe", nome: "Brasil NFe", resumo: "Emissão de NF-e e NFC-e", href: "/configuracoes/integracoes/brasilnfe", tom: "verde", icone: FileText, logo: caminhoDoLogo("brasilnfe") });
  if (resumo.asaas) itens.push({ id: "asaas", nome: "Asaas", resumo: resumo.asaas.resumo, href: "/configuracoes/integracoes/asaas", tom: resumo.asaas.tom, icone: Wallet });
  if (resumo.site) itens.push({ id: "site", nome: "Site", resumo: resumo.site.resumo, href: "/configuracoes/integracoes/site", tom: resumo.site.tom, icone: ShoppingBag });
  if (resumo.certificado) itens.push({ id: "certificado", nome: "Certificado A1", resumo: resumo.certificado.resumo, href: "/configuracoes/integracoes/certificado", tom: resumo.certificado.tom, icone: ShieldCheck });
  if (resumo.mcp) itens.push({ id: "mcp:servidor", nome: "Servidor MCP", resumo: "Diagnóstico, aplicações e histórico", href: rotaConexaoMcp("servidor"), tom: "roxo", icone: Server, marca: "hub" });
  return itens;
}

/** Moldura comum das Integrações: título, endereço do servidor MCP, todas as conexões e, abaixo, o detalhe da selecionada. */
export function MolduraIntegracoes({ resumo, ativa, children }: { resumo: ResumoIntegracoes; ativa: string; children: ReactNode }) {
  const itens = itensDoSeletor(resumo);
  return <div className="space-y-5">
    <header className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-[var(--ds-cartao-raio)] bg-primary text-primary-foreground"><Plug className="size-5" /></span>
      <div className="min-w-0"><h1 className="text-display break-words">Integrações</h1><p className="mt-1 text-sm text-muted-foreground">Conecte e gerencie as integrações do Grazing HUB.</p></div>
    </header>
    {resumo.mcp && <FaixaServidorMcp endereco={resumo.mcp.endereco} ativo={resumo.mcp.ativo} configurado={resumo.mcp.configurado} editar={resumo.mcp.editar} />}
    <Card size="sm"><CardContent className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-label uppercase text-muted-foreground">Conexões</h2>
        {resumo.mcp?.editar && <Button size="sm" nativeButton={false} role="link" aria-current={ativa === "mcp:nova" ? "page" : undefined} render={<Link href={rotaConexaoMcp("nova")} />}><Plus className="size-4" />Nova conexão</Button>}
      </div>
      <nav aria-label="Conexões" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {itens.map(i => { const Icone = i.icone; const selecionada = i.id === ativa; return <Link key={i.id} href={i.href} aria-current={selecionada ? "page" : undefined}
        className={cn("flex min-h-16 min-w-0 items-center gap-3 rounded-[var(--ds-aba-raio)] border px-4 py-3 transition-colors duration-[var(--ds-movimento-rapido)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          selecionada ? "border-transparent bg-foreground text-background" : "border-transparent hover:bg-muted")}>
        {i.marca === "hub" ? <span aria-hidden="true" className="flex shrink-0"><LogoMark className="size-10" /></span>
          : i.logo ? <span aria-hidden="true" className="flex size-10 shrink-0 overflow-hidden rounded-[var(--ds-aba-raio)]"><img src={i.logo} alt="" width={40} height={40} loading="lazy" className="size-full object-contain" /></span>
          : <IconeTom tom={i.tom}>{i.monograma ? <span className="text-sm font-semibold">{i.monograma}</span> : <Icone />}</IconeTom>}
        <span className="min-w-0 flex-1"><span className="block truncate text-base font-semibold">{i.nome}</span><span className={cn("block truncate text-sm", selecionada ? "text-background/70" : "text-muted-foreground")}>{i.resumo}</span></span>
      </Link>; })}
    </nav></CardContent></Card>
    {children}
  </div>;
}
