import { createRoot } from "react-dom/client";
import { LancamentoDialog } from "@/app/(protegido)/financeiro/lancamentos/lancamento-dialog";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "@/app/globals.css";
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light"><main className="p-6"><p>Prévia isolada com dados fictícios; nenhuma operação real.</p><LancamentoDialog categorias={[{ id: "ficticia", nome: "Serviços fictícios", grupo: "DESPESAS_OPERACIONAIS" }]} fornecedores={[]} formasPagamento={[]} contasBancarias={[]} /><Toaster /></main></ThemeProvider>);
