import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/components/theme-provider";
import { PorcoesTable } from "@/app/(protegido)/porcoes/porcoes-table";
import { ComposicaoPicker } from "@/app/(protegido)/insumos/composicao-picker";
import { selecionarPorcao, calcularPorcao } from "@/lib/insumos/porcoes";
import type { ComponenteRow } from "@/app/(protegido)/insumos/types";
import { categoriasPorcoes, insumosPorcoes, porcoesFicticias } from "./porcoes-dados";
import "@/app/globals.css";

const candidatos = [...insumosPorcoes, { id: "damasco-ficticio", nome: "Damasco turco seco", especificacao: "12,5 kg cada caixa fictícia", unidade: "KG" as const, categoriaNome: "Frutas", ativo: true }, { id: "tabua-ficticia", nome: "Tábua fictícia", unidade: "UN" as const, categoriaNome: "Embalagens", ativo: true }, { id: "bandeja-ficticia", nome: "Bandeja fictícia", unidade: "UN" as const, categoriaNome: "Embalagens", ativo: true }, { id: "cinta-ficticia", nome: "Cinta fictícia", unidade: "UN" as const, categoriaNome: "Embalagens", ativo: true }];
function Previa() {
  const [itens, setItens] = useState<ComponenteRow[]>(() => candidatos.map((insumo): ComponenteRow => {
    if (insumo.id === "damasco-ficticio") return { componenteId: insumo.id, nome: insumo.nome, especificacao: "12,5 kg cada caixa fictícia", tipo: "INSUMO", unidade: insumo.unidade, quantidade: 0.08, observacaoPorcao: "8 un" };
    const medida = porcoesFicticias.find(p => p.insumoId === insumo.id);
    if (!medida) return { componenteId: insumo.id, nome: insumo.nome, tipo: "INSUMO", unidade: insumo.unidade, quantidade: 1, observacaoPorcao: null };
    const porcao = { ...selecionarPorcao(medida), numeroPorcoes: "0.5" };
    const resultado = calcularPorcao(porcao);
    if ("erro" in resultado) throw new Error(resultado.erro);
    return { componenteId: insumo.id, nome: insumo.nome, tipo: "INSUMO", unidade: insumo.unidade, quantidade: Number(resultado.quantidade), quantidadePorcao: resultado.quantidade, observacaoPorcao: resultado.observacaoPorcao, porcao };
  }));
  return <main className="space-y-8 p-4 sm:p-8">
    <p className="mx-auto max-w-5xl text-xs text-muted-foreground">Prévia isolada com dados fictícios · Em revisão visual</p>
    <PorcoesTable insumos={insumosPorcoes} porcoes={porcoesFicticias} categorias={categoriasPorcoes} podeCriar podeEditar podeExcluir />
    <section className="mx-auto max-w-5xl space-y-3">
      <h2 className="text-title">Composição de produto em Vendas</h2>
      <p className="text-sm text-muted-foreground">Digite ,5 em Porção ou Qtd. e use FM para definir o que aparece na ficha de montagem.</p>
      <div className="@container"><ComposicaoPicker candidatos={candidatos.map(insumo => ({ ...insumo, tipo: "INSUMO", custoMedio: 0.1 }))} itens={itens} onChange={setItens} ordenar configurarFicha /></div>
    </section>
    <section className="mx-auto max-w-5xl space-y-3">
      <h2 className="text-title">Composição de preparação em Suprimentos</h2>
      <div className="@container"><ComposicaoPicker exibirEspecificacao candidatos={candidatos.map(insumo => ({ ...insumo, tipo: "INSUMO", custoMedio: 0.1 }))} itens={itens} onChange={setItens} ordenar /></div>
    </section>
  </main>;
}
createRoot(document.getElementById("root")!).render(<ThemeProvider attribute="class" defaultTheme="light"><Previa /></ThemeProvider>);
