import { Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SincronizarButton } from "@/app/(protegido)/notas-fiscais/sincronizar-button";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";

class LimiteErro extends Component<{ children: ReactNode }, { falhou: boolean }> {
  state = { falhou: false };
  static getDerivedStateFromError() { return { falhou: true }; }
  render() {
    return this.state.falhou
      ? <main className="p-10"><h1 className="text-xl font-semibold">Falha na página</h1><p>Teste isolado: uma falha simulada de comunicação derrubou a página.</p></main>
      : this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light"><LimiteErro>
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <p className="text-sm text-muted-foreground">Teste isolado com falha de comunicação simulada. Sem acesso à SEFAZ ou ao banco.</p>
      <div className="flex items-center justify-between gap-4"><h1 className="text-2xl font-semibold">Manifesto de Notas</h1><SincronizarButton /></div>
      <div className="rounded-xl border bg-card p-6"><h2 className="font-semibold">Notas recebidas</h2><p className="mt-3">Fornecedor de exemplo · R$ 100,00 · Resumo</p></div>
    </main><Toaster />
  </LimiteErro></ThemeProvider>
);
