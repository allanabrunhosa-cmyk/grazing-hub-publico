import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";

export function FiscalPreviewLayout({ children }: { children: ReactNode }) {
  const tema = new URLSearchParams(location.search).has("escuro") ? "dark" : "light";
  return <ThemeProvider attribute="class" defaultTheme={tema} forcedTheme={tema} enableSystem={false}><ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}><div className="estrutura-sistema"><a href="#conteudo-principal" className="atalho-conteudo">Ir para o conteúdo</a><Sidebar /><div className="painel-sistema"><CabecalhoConteudo sessao={{ nome: "Equipe fictícia", admin: true }} /><main className="conteudo-sistema" id="conteudo-principal" tabIndex={-1}><p className="mb-3 text-xs text-muted-foreground">Prévia isolada · dados sintéticos · sem consultas ou operações externas</p>{children}</main></div></div></ProvedorAcesso></ThemeProvider>;
}
