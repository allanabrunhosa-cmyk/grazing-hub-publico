import { createRoot } from "react-dom/client";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import { insumoStatus } from "../cadastros/dados";
import "@/app/globals.css";
const insumos = [
  { ...insumoStatus, marcasHomologadas: ["Marca Exemplo"], categoria: { id: "c1", nome: "Panificação" }, fornecedoresHomologados: [{ id: "f1", nome: "Distribuidora Exemplo de Alimentos" }, { id: "f2", nome: "Fornecedor Homologado de Nome Longo" }] },
  { ...insumoStatus, id: "sal", nome: "Sal fino", fornecedoresHomologados: [] },
];
createRoot(document.getElementById("root")!).render(<main className="space-y-4 p-6"><h1 className="text-2xl font-semibold">Insumos</h1><p>Dados fictícios e ações simuladas.</p><InsumosTable insumos={insumos} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} /></main>);
