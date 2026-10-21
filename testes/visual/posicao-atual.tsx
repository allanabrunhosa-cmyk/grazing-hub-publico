import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { PosicaoAtualTable } from "@/app/(protegido)/inventario/posicao-atual-table";
import type { PosicaoAtualRow } from "@/app/(protegido)/inventario/types";
import "@/app/globals.css";

const linhas: PosicaoAtualRow[] = [
  { insumoId: "acucar", nome: "Açúcar refinado", tipo: "INSUMO", marca: null, marcasHomologadas: ["Marca Exemplo"], categoriaNome: "Categoria Exemplo", fornecedoresHomologados: [{ id: "f1", nome: "Distribuidora Exemplo de Alimentos" }, { id: "f2", nome: "Fornecedor Homologado de Nome Longo" }], unidade: "KG", estoqueMinimo: 5, estoqueMaximo: 30, custoMedio: 4.5, saldosPorLocal: { central: 4, cozinha: 8 } },
  { insumoId: "leite", nome: "Leite integral", tipo: "INSUMO", marca: null, marcasHomologadas: ["Marca Exemplo"], categoriaNome: "Categoria Exemplo", fornecedoresHomologados: [{ id: "f1", nome: "Distribuidora Exemplo de Alimentos" }, { id: "f2", nome: "Fornecedor Homologado de Nome Longo" }], unidade: "L", estoqueMinimo: 3, estoqueMaximo: 20, custoMedio: 5, saldosPorLocal: { central: 1, cozinha: 1 } },
  { insumoId: "bandeja", nome: "Bandeja kraft", tipo: "PRODUTO_INTERMEDIARIO", marca: null, marcasHomologadas: ["Marca Exemplo"], categoriaNome: "Categoria Exemplo", fornecedoresHomologados: [{ id: "f1", nome: "Distribuidora Exemplo de Alimentos" }, { id: "f2", nome: "Fornecedor Homologado de Nome Longo" }], unidade: "UN", estoqueMinimo: 20, estoqueMaximo: 100, custoMedio: 2, saldosPorLocal: { central: 30, cozinha: 10 } },
];

function PreviaPosicaoAtual() {
  const historico = new URLSearchParams(location.search).has("historico");
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-3 sm:p-6">
      <h1 className="text-2xl font-semibold">Posição atual de estoque</h1>
      <p className="text-sm text-muted-foreground">Prévia com dados fictícios e ações simuladas.</p>
      <PosicaoAtualTable
        linhas={linhas}
        locais={[{ id: "central", nome: "Estoque central" }, { id: "cozinha", nome: "Cozinha" }]}
        dataSelecionada={historico ? "2026-09-10" : "2026-09-11"}
        hoje="2026-09-11"
        isHistorico={historico}
        responsavelNome="Allan · prévia"
      />
      <Toaster />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<PreviaPosicaoAtual />);
