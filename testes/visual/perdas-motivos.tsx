import { createRoot } from "react-dom/client";
import { ResumoPerdas } from "@/app/(protegido)/inventario/perdas/resumo-perdas";
import type { PerdaRow } from "@/app/(protegido)/inventario/types";
import "@/app/globals.css";

const parametros = new URLSearchParams(window.location.search);
document.documentElement.classList.toggle("dark", parametros.get("tema") === "escuro");
const motivos = ["Falha na refrigeração", "Dano no transporte", "Erro na embalagem", "Armazenamento inadequado", "Avaria na conferência", "Contaminação cruzada", "Descarte na montagem", "Falha no equipamento"];
const linhas: PerdaRow[] = motivos.slice(0, parametros.has("muitos") ? 8 : 5).map((nome, indice) => ({
  id: `perda-${indice}`, categoriaPerdaId: `categoria-${indice}`, categoriaNome: nome,
  motivo: "OUTRO", motivoPersonalizado: null, insumoNome: `Insumo de demonstração ${indice + 1}`,
  localNome: "Câmara fria", data: "2026-10-20T12:00:00Z", quantidade: 1,
  unidade: "KG", valorEstimado: parametros.has("zero") ? 0 : (8 - indice) * 15,
  observacao: null, responsavelNome: "Equipe de demonstração",
}));

createRoot(document.getElementById("root")!).render(<main className="space-y-6 p-4 md:p-6">
  <header><h1 className="text-display">Registro de perdas</h1><p className="text-sm text-muted-foreground">Prévia com dados fictícios. Sem gravação.</p></header>
  <ResumoPerdas linhas={parametros.has("vazio") ? [] : linhas} />
</main>);
