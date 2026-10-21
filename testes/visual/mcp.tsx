import React from "react";
import { createRoot } from "react-dom/client";
import { GestaoMcp } from "@/app/(protegido)/configuracoes/integracoes/mcp/gestao";
import { dadosMcpFicticios } from "../mcp/fixture-gestao";
import "@/app/globals.css";
document.documentElement.className = new URLSearchParams(location.search).get("tema") === "escuro" ? "dark" : "light";
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-7xl space-y-4 p-6"><p className="text-sm text-muted-foreground">Prévia isolada · dados fictícios · sem gravação · Em revisão visual</p><GestaoMcp dados={dadosMcpFicticios} editar /></main>);
