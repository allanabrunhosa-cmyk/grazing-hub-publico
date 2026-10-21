"use client";
import { useState } from "react";
import type { DadosCatalogo } from "@/lib/vendas/consultas";
import { ListaOrdenavel } from "../lista-ordenavel";
import { EditorVenda, Situacao, Vazio } from "../componentes";
import { reordenarCategoriasVendaAction } from "../actions";

export function OrdemCategorias({ categorias, fechar }: { categorias: DadosCatalogo["categorias"]; fechar: () => void }) {
  const [itens, setItens] = useState(categorias);
  return <EditorVenda titulo="Ordem das categorias" descricao="Arraste as categorias para definir a sequência do cardápio." fechar={fechar} salvar={() => reordenarCategoriasVendaAction(itens.map(({ id, versao }) => ({ id, versao })))}>
    {!itens.length ? <Vazio>Nenhuma categoria cadastrada.</Vazio> : <ListaOrdenavel itens={itens} chave={c => c.id} nome={c => c.nome} mudar={setItens}>{(c, indice, alca) => <div className="flex items-center gap-2 rounded-xl border p-3">{alca}<span className="text-xs text-muted-foreground">{indice + 1}</span><span className="min-w-0 flex-1 text-sm">{c.nome}</span><Situacao ativo={c.ativo} /></div>}</ListaOrdenavel>}
  </EditorVenda>;
}
