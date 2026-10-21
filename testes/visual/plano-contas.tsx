import React from "react";
import { createRoot } from "react-dom/client";
import { PlanoContasView } from "@/app/(protegido)/financeiro/plano-de-contas/plano-contas-view";
import type { CategoriaFinanceiraRow } from "@/app/(protegido)/financeiro/types";
import type { GrupoDre } from "@/generated/prisma/client";
import fonte from "../../docs/plano-contas-takeat.json";
import "@/app/globals.css";
type No = { nome: string; subcategorias?: No[] };
const categorias: CategoriaFinanceiraRow[] = [];
const grupos: Record<string, GrupoDre> = { operacional: "DESPESAS_OPERACIONAIS", insumos: "CMV", "Deduções da receita": "DEDUCOES_RECEITA" };
function adicionar(no: No, id: string, paiId: string | null, grupo: GrupoDre) {
  categorias.push({ id, paiId, nome: no.nome, grupo, ativo: true, excluidoEm: null, centroCustoId: null, centroCustoNome: null, quantidadeLancamentos: 0, quantidadeItensNota: 0, quantidadeItensFatura: 0, quantidadeRegrasCartao: 0, quantidadeSubcategorias: no.subcategorias?.length ?? 0 });
  no.subcategorias?.forEach((filha, i) => adicionar(filha, `${id}-${i + 1}`, id, grupo));
}
fonte.categorias.forEach((raiz, i) => adicionar(raiz, String(i + 1), null, grupos[raiz.classificacao]));
categorias.sort((a,b) => a.nome.localeCompare(b.nome, "pt-BR"));
categorias.push({ id: "receita", paiId: null, nome: "Receita com Vendas", grupo: "RECEITA_BRUTA", ativo: true, excluidoEm: null, centroCustoId: null, centroCustoNome: null, quantidadeLancamentos: 0, quantidadeItensNota: 0, quantidadeItensFatura: 0, quantidadeRegrasCartao: 0, quantidadeSubcategorias: 0 });
createRoot(document.getElementById("root")!).render(<main className="p-4 sm:p-8"><PlanoContasView categorias={categorias} centrosCusto={[]} /></main>);
