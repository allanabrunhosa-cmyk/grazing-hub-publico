import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { EntradaAvulsaForm } from "@/app/(protegido)/inventario/entrada-avulsa/entrada-avulsa-form";
import { Toaster } from "@/components/ui/sonner";
import { gerarCssTema } from "@/lib/design-system/gerar-css";
import { cartoes, contas, type ChamadaEntradaSimulada } from "./entrada-avulsa-previa";
import "@/app/globals.css";

function PreviaEntrada() {
  const [chamadas, setChamadas] = useState<ChamadaEntradaSimulada[]>([]);
  useEffect(() => {
    const registrar = (evento: Event) => setChamadas(atuais => [...atuais, (evento as CustomEvent<ChamadaEntradaSimulada>).detail]);
    window.addEventListener("entrada-avulsa-simulada", registrar);
    return () => window.removeEventListener("entrada-avulsa-simulada", registrar);
  }, []);
  return <ThemeProvider attribute="class" forcedTheme={new URLSearchParams(location.search).get("escuro") === "1" ? "dark" : "light"}>
    <style>{gerarCssTema()}</style>
    <div className="estrutura-sistema">
      <Sidebar />
      <div className="painel-sistema">
        <CabecalhoConteudo sessao={{ nome: "Operador fictício", email: "equipe@example.com", admin: true }} />
        <main className="conteudo-sistema">
          <p className="mb-4 text-xs text-muted-foreground">Prévia com dados fictícios. Ações simuladas, sem gravação.</p>
          <EntradaAvulsaForm
            insumos={[
              { id: "brie", nome: "Queijo brie", especificacao: "Peça de 1 kg · maturação suave", unidade: "KG", custoMedio: 71.92 },
              { id: "presunto", nome: "Presunto parma", especificacao: "Fatiado fino", unidade: "KG", custoMedio: 96.5 },
              { id: "uva", nome: "Uva verde sem semente", especificacao: "Categoria extra", unidade: "KG", custoMedio: 18.7 },
            ]}
            locais={[
              { id: "camara", nome: "Câmara fria" },
              { id: "producao", nome: "Produção" },
            ]}
            fornecedores={[
              { id: "mercado", nome: "MERCADO CENTRAL LTDA" },
              { id: "distribuidora", nome: "DISTRIBUIDORA GASTRONÔMICA" },
            ]}
            contasBancarias={contas}
            cartoes={cartoes}
            insumoIdPreselecionado="brie"
          />
        </main>
      </div>
    </div>
    <output className="sr-only" data-testid="chamadas-simuladas">{JSON.stringify(chamadas)}</output>
    <Toaster />
  </ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<PreviaEntrada />);
