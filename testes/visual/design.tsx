import React from "react";
import { createRoot } from "react-dom/client";
import { CentralDesign } from "@/components/design-system/central-design";
import { LaboratorioDesign } from "@/components/design-system/laboratorio-design";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";
import { DemonstracaoPadrao } from "@/components/design-system/demonstracao-padrao";
import { PADROES_DESIGN } from "@/lib/design-system/grupos";

const laboratorio = location.pathname === "/configuracoes/design/laboratorio" || new URLSearchParams(location.search).has("laboratorio");
const padrao = PADROES_DESIGN.find(p => p.id === new URLSearchParams(location.search).get("padrao"));
createRoot(document.getElementById("root")!).render(padrao ? <div className="p-4"><DemonstracaoPadrao componente={padrao.componente} estado="normal" aplicado /></div> : laboratorio ? <LaboratorioDesign /> :
  <ThemeProvider attribute="class" defaultTheme="light"><ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>
    <div className="estrutura-sistema"><Sidebar /><div className="painel-sistema">
      <CabecalhoConteudo sessao={{ nome: "Prévia isolada", email: "teste@example.invalid", admin: true }} />
      <main className="conteudo-sistema"><CentralDesign dados={{ publicada: null, rascunho: null, revisaoPublicada: 0, versoes: [], eventos: [] }} /></main>
    </div></div><Toaster />
  </ProvedorAcesso></ThemeProvider>);
