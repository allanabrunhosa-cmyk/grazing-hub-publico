"use client";
import { useState } from "react";
import { ListaOrdenavel } from "../lista-ordenavel";
import type { DadosCatalogo } from "@/lib/vendas/consultas";
import { EditorVenda, Situacao, Vazio } from "../componentes";
import { reordenarProdutosVendaAction } from "../actions";

export function OrdemProdutos({ categoria, produtos, fechar }: { categoria: DadosCatalogo["categorias"][number]; produtos: DadosCatalogo["produtos"]; fechar: () => void }) {
  const [itens, setItens] = useState(() => categoria.produtos.flatMap(v => {
    const p = produtos.find(p => p.id === v.produtoId);
    return p ? [p] : [];
  }));
  return <EditorVenda titulo={`Ordem · ${categoria.nome}`} descricao="A ordem pertence a esta categoria. O mesmo produto pode ter outra posição em outra categoria." fechar={fechar} salvar={() => reordenarProdutosVendaAction(categoria.id, itens.map(({ id, versao }) => ({ id, versao })))}>
    {!itens.length ? <Vazio>Nenhum produto vinculado a esta categoria.</Vazio> : <ListaOrdenavel itens={itens} chave={p => p.id} nome={p => p.nome} mudar={setItens}>{(p,i,alca) => <div className="flex items-center gap-2 rounded-xl border p-3">{alca}<span className="text-xs text-muted-foreground">{i + 1}</span><span className="min-w-0 flex-1 text-sm">{p.nome}</span><Situacao ativo={p.ativo} /></div>}</ListaOrdenavel>}
  </EditorVenda>;
}
