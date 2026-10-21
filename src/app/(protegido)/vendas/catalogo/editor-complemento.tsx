"use client";
import { useState } from "react";
import { CurrencyInput } from "@/components/ui/currency-input";
import type { DadosProdutos } from "@/lib/vendas/consultas";
import type { ProdutoEntrada } from "@/lib/vendas/dominio";
import { ComposicaoProduto } from "../produtos/composicao-produto";
import { FotoCampo } from "../produtos/foto-campo";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import { salvarProdutoVendaAction } from "../actions";
import { Campo, Texto, EditorVenda } from "../componentes";

export function EditorComplemento({ inicial, dados, fechar, podeCadastrarInsumo }: { inicial: ProdutoEntrada; dados: DadosProdutos; fechar: () => void; podeCadastrarInsumo: boolean }) {
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [d, setD] = useState(() => ({ ...inicial }));
  return <EditorVenda titulo={d.id ? `Editar ${inicial.nome}` : "Novo complemento"} descricao="Defina o padrão. Preço e composição podem ser ajustados em cada grupo ou produto." fechar={fechar} impedido={enviandoFoto} salvar={() => salvarProdutoVendaAction(d)}>
    <Texto nome="Nome do complemento *" required maxLength={160} value={d.nome} onChange={e => setD(a => ({ ...a, nome: e.target.value }))} />
    <div className="grid items-start gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <FotoCampo nome="complemento" produtoId={d.id} url={d.fotoUrl} mudar={fotoUrl => setD(a => ({ ...a, fotoUrl }))} aoEnviar={setEnviandoFoto} />
      <div className="min-w-0 space-y-4"><Campo nome="Preço *"><CurrencyInput aria-label="Preço do complemento" required value={d.preco} onValueChange={preco => setD(a => ({ ...a, preco }))} /></Campo>
        <div className="space-y-2"><p className="text-sm font-medium">Categorias</p><MultiselecaoCombobox opcoes={dados.categorias.filter(c => c.ativo || d.categorias.includes(c.id)).map(c => ({ id: c.id, nome: c.nome, descricao: c.ativo ? null : "Inativa" }))} selecionadosIds={d.categorias} aoMudar={categorias => setD(a => ({ ...a, categorias }))} placeholder="Selecionar categorias..." ariaLabel="Categorias do complemento" vazio="Nenhuma categoria encontrada." /></div>
      </div>
    </div>
    <ComposicaoProduto configurarFicha={false} componentes={d.componentes} insumos={dados.insumos} podeCadastrarInsumo={podeCadastrarInsumo} mudar={componentes => setD(a => ({ ...a, componentes }))} />
  </EditorVenda>;
}
