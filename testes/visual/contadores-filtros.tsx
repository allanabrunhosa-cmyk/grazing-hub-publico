import { createRoot } from "react-dom/client";
import { NotasFiscaisTable } from "@/app/(protegido)/notas-fiscais/notas-fiscais-table";
import { notaTeste, opcoesTeste } from "../notas-fiscais/dados";
import type { NotaFiscalRow } from "@/app/(protegido)/notas-fiscais/types";
import "@/app/globals.css";
const notas: NotaFiscalRow[] = [
  ...["Alimentos Exemplo", "Embalagens Exemplo", "Insumos Exemplo"].map((fornecedorNome, n) => ({ ...notaTeste, id: "pendente-" + n, fornecedorNome, dataEmissao: "2026-10-07T12:00:00Z", valorTotal: 150 + n * 50 })),
  ...["Mercado Exemplo", "Hortifruti Exemplo"].map((fornecedorNome, n) => ({ ...notaTeste, id: "aceita-" + n, fornecedorNome, ultimaManifestacao: "CONFIRMACAO_DA_OPERACAO" as const })),
  { ...notaTeste, id: "recusada", fornecedorNome: "Fornecedor Exemplo", ultimaManifestacao: "DESCONHECIMENTO_DA_OPERACAO" },
];
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6"><header><h1 className="font-heading text-display">Manifestação de notas</h1><p className="mt-2 text-sm text-muted-foreground">Prévia isolada com dados fictícios.</p></header><NotasFiscaisTable notas={notas} {...opcoesTeste} /></main>);
