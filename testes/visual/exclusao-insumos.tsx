import { createRoot } from "react-dom/client";
import { ProvedorAcesso } from "@/components/layout/acesso-contexto";
import { InsumoActionsCell } from "@/app/(protegido)/insumos/insumo-actions-cell";
import { insumoStatus } from "../cadastros/dados";
import "@/app/globals.css";
createRoot(document.getElementById("root")!).render(
  <ProvedorAcesso acesso={{ admin: true, permissoes: {}, excecoes: {} }}>
    <main className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Exclusão de insumos — prévia isolada</h1>
      <p className="text-muted-foreground">Dados fictícios e ações simuladas.</p>
      {[{ id: "livre", nome: "Insumo fictício sem vínculos" }, { id: "vinculado", nome: "Farinha fictícia em uso" }].map(item => <div key={item.id} className="flex items-center justify-between rounded-lg border p-4">
        <span>{item.nome}</span><InsumoActionsCell insumo={{ ...insumoStatus, ...item }} />
      </div>)}
    </main>
  </ProvedorAcesso>,
);
