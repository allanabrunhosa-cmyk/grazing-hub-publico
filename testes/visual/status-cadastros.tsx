import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { FornecedoresTable } from "@/app/(protegido)/fornecedores/fornecedores-table";
import { InsumosTable } from "@/app/(protegido)/insumos/insumos-table";
import { GrupoCard } from "@/app/(protegido)/financeiro/plano-de-contas/grupo-card";
import { fornecedorStatus, insumoStatus } from "../cadastros/dados";
import { estados, observarStatus, versaoStatus } from "./status-cadastros-acoes";
import "@/app/globals.css";

function Previa() {
  useSyncExternalStore(observarStatus, versaoStatus);
  return <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">Status dos cadastros</h1>
    <p className="text-sm text-muted-foreground">Dados fictícios. Clique no status para ativar ou inativar.</p>
    <h2 className="text-xl font-semibold">Fornecedores</h2>
    <FornecedoresTable fornecedores={[fornecedorStatus, { ...fornecedorStatus, id: "central", nome: "Distribuidora Central de Alimentos", ativo: false }].map(i => ({ ...i, ativo: estados[i.id] ?? i.ativo }))} canaisPedidoOptions={[]} formasPagamentoOptions={[]} />
    <h2 className="text-xl font-semibold">Insumos</h2>
    <InsumosTable insumos={[insumoStatus, { ...insumoStatus, id: "massa", nome: "Massa artesanal para pães", tipo: "PRODUTO_INTERMEDIARIO" as const, ativo: false }].map(i => ({ ...i, ativo: estados[i.id] ?? i.ativo }))} categorias={[]} centrosCusto={[]} fornecedores={[]} todosInsumos={[]} />
    <h2 className="text-xl font-semibold">Plano de contas</h2>
    <GrupoCard grupo="CMV" centrosCusto={[]} categorias={[{ id: "cmv", nome: "Insumos para preparações", grupo: "CMV", ativo: true, excluidoEm: null, paiId: null, centroCustoId: null, centroCustoNome: null, quantidadeLancamentos: 0, quantidadeItensNota: 0, quantidadeItensFatura: 0, quantidadeRegrasCartao: 0, quantidadeSubcategorias: 0 }]} />
    <Toaster />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Previa />);
