import { createRoot } from "react-dom/client";
import { ContagemTable } from "@/app/(protegido)/inventario/contagem/contagem-table";
import { Toaster } from "sonner";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-6xl space-y-6 p-6">
  <h1 className="text-2xl font-semibold">Contagem de estoque</h1>
  <p className="text-sm text-muted-foreground">Dados fictícios. Exclusão simulada, sem gravação no banco.</p>
  <ContagemTable administrador linhas={[
    { id: "andamento", localNome: "Estoque principal", dataContagem: "2026-09-10T12:00:00Z", status: "EM_ANDAMENTO", totalItens: 230, itensContados: 42, itensAjustados: 0, responsavelNome: "Responsável de teste" },
    { id: "finalizada", localNome: "Estoque principal", dataContagem: "2026-09-09T12:00:00Z", status: "FINALIZADO", totalItens: 230, itensContados: 230, itensAjustados: 5, responsavelNome: "Responsável de teste" },
    { id: "excluida", localNome: "Estoque principal", dataContagem: "2026-09-08T12:00:00Z", status: "EXCLUIDO", totalItens: 230, itensContados: 10, itensAjustados: 0, responsavelNome: "Responsável de teste" },
  ]} />
  <Toaster />
</main>);
