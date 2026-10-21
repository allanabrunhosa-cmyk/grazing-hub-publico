import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { CabecalhoConteudo } from "@/components/layout/cabecalho-conteudo";
import { EntradaAvulsaForm } from "@/app/(protegido)/inventario/entrada-avulsa/entrada-avulsa-form";
import { Toaster } from "@/components/ui/sonner";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <div className="estrutura-sistema">
      <Sidebar />
      <div className="painel-sistema">
        <CabecalhoConteudo sessao={{ nome: "Allan Abrunhosa", email: "equipe@example.com", admin: true }} />
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
            contasBancarias={[
              { id: "itau", nome: "ITAÚ — CONTA CORRENTE" },
              { id: "caixa", nome: "CAIXA OPERACIONAL" },
            ]}
            insumoIdPreselecionado={null}
          />
        </main>
      </div>
    </div>
    <Toaster />
  </ThemeProvider>,
);
