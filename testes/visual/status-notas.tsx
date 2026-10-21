import { createRoot } from "react-dom/client";
import { NotasFiscaisTable } from "@/app/(protegido)/notas-fiscais/notas-fiscais-table";
import { notaTeste, opcoesTeste } from "../notas-fiscais/dados";
import { Toaster } from "sonner";
import "@/app/globals.css";

const parametros = new URLSearchParams(location.search);
if (parametros.has("escuro")) document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-7xl space-y-4 p-4">
  <h1 className="text-2xl font-semibold">Manifesto de Notas</h1>
  <p className="text-sm text-muted-foreground">Prévia local com dados fictícios. Nenhuma operação fiscal.</p>
  <NotasFiscaisTable {...opcoesTeste} notas={parametros.has("vazio") ? [] : [
    { ...notaTeste, valorTotal: parametros.has("custos") ? 445 : 100, id: "pendente", fornecedorNome: "Fornecedor de queijos — teste" },
    { ...notaTeste, id: "resumo", fornecedorNome: "Fornecedor de embalagens — teste", temXmlCompleto: false, ultimaManifestacao: "CIENCIA_DA_OPERACAO" },
    { ...notaTeste, id: "aceita", fornecedorNome: "Fornecedor de frutas — teste", ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" },
    { ...notaTeste, id: "recusada", fornecedorNome: "Fornecedor de utensílios — teste", temXmlCompleto: false, ultimaManifestacao: "DESCONHECIMENTO_DA_OPERACAO" },
  ]} />
  <Toaster />
</main>);
