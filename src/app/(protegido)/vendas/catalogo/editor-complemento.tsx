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
import { Tabs, TabsList, TabsTriggerBotao, TabsContent } from "@/components/ui/tabs";
import { SelecaoFormulario } from "@/components/ui/select";
import { DisponibilidadeCadastro } from "./disponibilidade";
import { classificacaoComercial } from "@/lib/vendas/classificacao";

export function EditorComplemento({ inicial, dados, fechar, podeCadastrarInsumo }: { inicial: ProdutoEntrada; dados: DadosProdutos; fechar: () => void; podeCadastrarInsumo: boolean }) {
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [aba, setAba] = useState("cadastro");
  const [d, setD] = useState(() => ({ ...inicial }));
  return <EditorVenda titulo={d.id ? `Editar ${inicial.nome}` : "Novo complemento"} descricao="Defina o padrão. Preço e composição podem ser ajustados em cada grupo ou produto." fechar={fechar} impedido={enviandoFoto} abrirSecao={setAba} salvar={() => salvarProdutoVendaAction(d)}>
    <Tabs value={aba} onValueChange={setAba}><TabsList variant="buttons"><TabsTriggerBotao value="cadastro">Cadastro</TabsTriggerBotao><TabsTriggerBotao value="disponibilidade">Disponibilidade</TabsTriggerBotao></TabsList>
    <TabsContent value="cadastro" keepMounted data-secao="cadastro" className="space-y-4">
    <Texto nome="Nome do complemento *" required maxLength={160} value={d.nome} onChange={e => setD(a => ({ ...a, nome: e.target.value }))} />
    <Campo nome="Classificação"><SelecaoFormulario aria-label="Classificação" value={classificacaoComercial(d)} onValueChange={valor => setD(a => ({ ...a, classificacao: valor as "PRINCIPAL" | "COMPLEMENTO", classificacoes: [valor as "PRINCIPAL" | "COMPLEMENTO"], categorias: [] }))}><option value="PRINCIPAL">Produto</option><option value="COMPLEMENTO">Complemento</option></SelecaoFormulario></Campo>
    <div className="grid items-start gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <FotoCampo nome="complemento" produtoId={d.id} url={d.fotoUrl} mudar={fotoUrl => setD(a => ({ ...a, fotoUrl }))} aoEnviar={setEnviandoFoto} />
      <div className="min-w-0 space-y-4"><Campo nome="Preço *"><CurrencyInput aria-label="Preço do complemento" required value={d.preco} onValueChange={preco => setD(a => ({ ...a, preco }))} /></Campo>
        <div className="space-y-2"><p className="text-sm font-medium">{classificacaoComercial(d) === "PRINCIPAL" ? "Categorias do site" : "Categorias do complemento (opcional)"}</p><MultiselecaoCombobox opcoes={dados.categorias.filter(c => (c.escopo ?? "PRODUTO") === (classificacaoComercial(d) === "PRINCIPAL" ? "PRODUTO" : "COMPLEMENTO") && (c.ativo || d.categorias.includes(c.id))).map(c => ({ id: c.id, nome: c.nome, descricao: c.ativo ? null : "Inativa" }))} selecionadosIds={d.categorias} aoMudar={categorias => setD(a => ({ ...a, categorias }))} placeholder="Selecionar categorias..." ariaLabel="Categorias do complemento" vazio="Nenhuma categoria encontrada." /></div>
      </div>
    </div>
    <h3 className="text-sm font-semibold">Composição padrão</h3>
    <p className="text-xs text-muted-foreground">Composição de uma unidade do complemento. Para usar outra porção em um produto, ajuste a escolha dentro da composição desse produto.</p>
    <ComposicaoProduto configurarFicha={false} componentes={d.componentes} insumos={dados.insumos} podeCadastrarInsumo={podeCadastrarInsumo} mudar={componentes => setD(a => ({ ...a, componentes }))} />
    </TabsContent><TabsContent value="disponibilidade"><DisponibilidadeCadastro produto={d} dados={dados} /></TabsContent></Tabs>
  </EditorVenda>;
}
