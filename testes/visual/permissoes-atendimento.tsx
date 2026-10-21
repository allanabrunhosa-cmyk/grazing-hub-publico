import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { MatrizPermissoes } from "@/app/(protegido)/configuracoes/usuarios/matriz-permissoes";
import type { Excecoes, Permissoes } from "@/lib/permissoes/catalogo";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
const tema = parametros.get("tema") === "escuro" ? "dark" : "light";
const estado = parametros.get("estado") ?? "perfil";
const inicial: Permissoes = {
  crm: ["visualizar", "editar"],
  "crm.atendimento.mensagens": ["visualizar", "adicionar"],
  "crm.atendimento.contatos": ["visualizar", "adicionar", "editar"],
  "crm.atendimento.notas": ["visualizar", "adicionar"],
  "crm.atendimento.agenda": ["visualizar"],
  "vendas.clientes": ["visualizar"],
};
function Previa() {
  const [base, definirBase] = useState<Permissoes>(estado === "vazio" ? {} : inicial);
  const [excecoes, definirExcecoes] = useState<Excecoes>({ "crm.atendimento.mensagens": { adicionar: false } });
  const personalizada = estado === "personalizado";
  return <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
    <h1 className="font-heading text-display">Permissões do Atendimento</h1>
    <p className="text-sm text-muted-foreground">Prévia isolada. Perfil e usuário fictícios. As alterações ficam somente nesta página.</p>
    {estado === "salvando" && <p role="status" className="text-sm text-muted-foreground">Salvando perfil fictício… A edição está bloqueada.</p>}
    {estado === "erro" && <p role="alert" className="text-sm text-destructive">Falha fictícia ao salvar. As alterações foram preservadas.</p>}
    <MatrizPermissoes base={base} excecoes={personalizada ? excecoes : undefined} aoMudar={personalizada ? undefined : definirBase} aoPersonalizar={personalizada ? definirExcecoes : undefined} bloqueada={estado === "salvando"} />
    <pre data-testid="resultado" hidden>{JSON.stringify({ base, excecoes })}</pre>
  </main>;
}
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" forcedTheme={tema} defaultTheme={tema} enableSystem={false}><Previa /></ThemeProvider>);
