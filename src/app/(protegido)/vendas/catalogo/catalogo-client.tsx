"use client";
import { Fragment, useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import { CORES_CATEGORIA, classificacaoComercial } from "@/lib/vendas/classificacao";
import { DisponibilidadeGrupo } from "./disponibilidade";
import { TagCategoriaComplemento } from "./tag-categoria";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { Tabs, TabsList, TabsTriggerBotao, TabsContent } from "@/components/ui/tabs";
import { ComposicaoProduto } from "../produtos/composicao-produto";
import { ComplementosLista } from "./complementos-client";
import { LinhaComplemento } from "./linha-complemento";
import { composicaoDaOpcao, precoPadraoComplemento } from "@/lib/vendas/complementos";
import type { CategoriaEntrada, GrupoEntrada, ProdutoEntrada } from "@/lib/vendas/dominio";
import type { DadosProdutos, DadosCatalogo } from "@/lib/vendas/consultas";
import { salvarCategoriaVendaAction, salvarCategoriaGrupoVendaAction, salvarGrupoVendaAction } from "../actions";
import { ListaOrdenavel } from "../lista-ordenavel";
import { Campo, Texto, Check, Vazio, CabecalhoVendas, EditorVenda } from "../componentes";
import { BotaoExcluirVenda } from "../botao-excluir";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { StatusCadastroVenda } from "../status-cadastro";

export function CatalogoVenda({ dados, adicionar, editar, dadosComplementos, adicionarComplemento = false, editarComplemento = false, podeCadastrarInsumo = false }: { dados: DadosCatalogo; adicionar: boolean; editar: boolean; dadosComplementos?: DadosProdutos; adicionarComplemento?: boolean; editarComplemento?: boolean; podeCadastrarInsumo?: boolean }) {
  return <div className="space-y-5"><CabecalhoVendas titulo="Complementos" descricao="Cadastre complementos e organize as escolhas disponíveis dentro dos produtos." />
    <Tabs defaultValue="complementos"><TabsList variant="buttons"><TabsTriggerBotao value="complementos">Complementos</TabsTriggerBotao><TabsTriggerBotao value="grupos">Grupos de complementos</TabsTriggerBotao></TabsList>
      <TabsContent value="complementos">{dadosComplementos ? <ComplementosLista dados={dadosComplementos} adicionar={adicionarComplemento} editar={editarComplemento} adicionarCatalogo={adicionar} editarCatalogo={editar} podeCadastrarInsumo={podeCadastrarInsumo} /> : <Vazio>Sem acesso ao cadastro de complementos.</Vazio>}</TabsContent>
      <TabsContent value="grupos"><GruposComplementos dados={dados} adicionar={adicionar} editar={editar} dadosComplementos={dadosComplementos} /></TabsContent>
    </Tabs>
  </div>;
}
function GruposComplementos({ dados, adicionar, editar, dadosComplementos }: { dados: DadosCatalogo; adicionar: boolean; editar: boolean; dadosComplementos?: DadosProdutos }) {
  const [grupo, setGrupo] = useState<GrupoEntrada | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [categoriaGrupo, setCategoriaGrupo] = useState<CategoriaEntrada | null>(null);
  const novoGrupo = (categoriaId?: string) => setGrupo({ id:"", versao:0, nome:"", tipo:"COMPOSICAO", categoriaId: categoriaId ?? null, minimo:0, maximo:null, repetir:true, ativo:true, opcoes:[] });
  return <div className="space-y-5"><CabecalhoVendas titulo="Grupos de complementos" descricao="Organize grupos por categoria e abra cada um para ver suas opções.">{adicionar && <><Button variant="outline" onClick={() => setCategoriaGrupo({ id:"",versao:0,nome:"",ativo:true })}><Plus className="size-4" />Nova categoria</Button><Button onClick={() => novoGrupo()}><Plus className="size-4" />Novo grupo</Button></>}</CabecalhoVendas>
    {!dados.grupos.length && <Vazio>Crie um grupo de complementos para começar.</Vazio>}
    {[...dados.categoriasGrupos, null].map(c => {
      const grupos = dados.grupos.filter(g => (g.categoriaId ?? null) === (c?.id ?? null));
      if (!grupos.length && !c) return null;
      return <section key={c?.id ?? "sem-categoria"} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-4 py-3">
          <h2 className="font-semibold">{c?.nome ?? "Sem categoria"} <span className="text-xs font-normal text-muted-foreground">({grupos.length})</span></h2>
          <GrupoAcoes className="flex-wrap">{c && <StatusCadastroVenda tipo="CATEGORIA_GRUPO" id={c.id} versao={c.versao} nome={c.nome} ativo={c.ativo} editar={editar} />}{c && editar && <><Button onClick={() => setCategoriaGrupo(c)} aria-label={`Editar ${c.nome}`} variant="editar" /><BotaoExcluirVenda tipo="CATEGORIA_GRUPO" id={c.id} versao={c.versao} nome={c.nome} aviso="Os grupos permanecerão sem categoria." /></>}{adicionar && <Button size="sm" variant="outline" onClick={() => novoGrupo(c?.id)}><Plus className="size-3" />Adicionar grupo</Button>}</GrupoAcoes>
        </div>
        <div className="rounded-xl border bg-card"><Table><TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead>Complementos</TableHead><TableHead>Produtos</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead></TableRow></TableHeader><TableBody>{grupos.map(g => <Fragment key={g.id}><TableRow className="cursor-pointer" onClick={() => setAberto(a => a === g.id ? null : g.id)}><TableCell className="whitespace-normal"><button type="button" className="flex items-center gap-2 text-left font-medium" aria-label={`${aberto === g.id ? "Recolher" : "Abrir"} ${g.nome}`} aria-expanded={aberto === g.id} aria-controls={`grupo-${g.id}`} onClick={e => { e.stopPropagation(); setAberto(a => a === g.id ? null : g.id); }}><ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${aberto === g.id ? "rotate-90" : ""}`} /><span className="break-words">{g.nome}</span></button></TableCell><TableCell>{g.opcoes.filter(o => o.ativo).length}</TableCell><TableCell>{g.produtos.length}</TableCell><TableCell onClick={e => e.stopPropagation()}><StatusCadastroVenda tipo="GRUPO" id={g.id} versao={g.versao} ativo={g.ativo} nome={g.nome} editar={editar} /></TableCell><TableCell onClick={e => e.stopPropagation()}><GrupoAcoes alinhamento="inicio">{editar && <><Button onClick={() => setGrupo(structuredClone(g))} aria-label={`Editar ${g.nome}`} variant="editar" />{g.tipo !== "EXTRAS" && <BotaoExcluirVenda tipo="GRUPO" id={g.id} versao={g.versao} nome={g.nome} aviso="Os produtos serão desvinculados deste grupo." />}</>}</GrupoAcoes></TableCell></TableRow>
          {aberto === g.id && <TableRow id={`grupo-${g.id}`}><TableCell colSpan={5} className="whitespace-normal bg-muted/20 p-4"><ul className="space-y-2 text-sm">{g.opcoes.map(o => <li key={o.id} className="flex justify-between gap-2"><span className="min-w-0 break-words">{o.nome}{!o.ativo ? " (inativa)" : ""}</span><span className="shrink-0 tabular-nums">{Number(o.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></li>)}</ul></TableCell></TableRow>}</Fragment>)}</TableBody></Table></div>
      </section>;
    })}
    {categoriaGrupo && <EditorCategoriaGrupo inicial={categoriaGrupo} fechar={() => setCategoriaGrupo(null)} />}
    {grupo && <EditorGrupo inicial={grupo} produtos={dadosComplementos?.produtos ?? dados.produtos} insumos={dadosComplementos?.insumos ?? []} afetados={dados.grupos.find(g => g.id === grupo.id)?.produtos.length ?? 0} categoriasGrupos={dados.categoriasGrupos} podeCriarCategoria={adicionar} fechar={() => setGrupo(null)} />}
  </div>;
}
function EditorCategoriaGrupo({ inicial, fechar, aoSalvar }: { inicial: CategoriaEntrada; fechar: () => void; aoSalvar?: (categoria: DadosCatalogo["categoriasGrupos"][number]) => void }) {
  const [d, setD] = useState(inicial);
  return <EditorVenda titulo={d.id ? "Editar categoria de grupos" : "Nova categoria de grupos"} descricao="Agrupa visualmente os grupos de complementos." fechar={fechar} salvar={async () => { const r = await salvarCategoriaGrupoVendaAction(d); if (r.registro) aoSalvar?.(r.registro); return r; }}><Texto nome="Nome *" required maxLength={120} value={d.nome} onChange={e => setD({ ...d,nome:e.target.value })} /><Check checked={d.ativo} onChange={e => setD({ ...d,ativo:e.target.checked })}>Categoria ativa</Check></EditorVenda>;
}
export function EditorCategoria({ inicial, fechar, aoSalvar }: { inicial: CategoriaEntrada; fechar: () => void; aoSalvar?: (categoria: DadosCatalogo["categorias"][number]) => void }) {
  const [d, setD] = useState(inicial);
  const complemento = d.escopo === "COMPLEMENTO";
  return <EditorVenda titulo={d.id ? "Editar categoria" : complemento ? "Nova categoria de complementos" : "Nova categoria"} descricao={complemento ? "Categoria opcional para organizar complementos. Não aparece no site." : "Categorias expostas no cardápio do site."} fechar={fechar} salvar={async () => { const r = await salvarCategoriaVendaAction(d); if (r.registro) aoSalvar?.(r.registro); return r; }}><Texto nome="Nome *" required maxLength={120} value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} />
    {complemento && <><Campo nome="Cor da categoria"><SelecaoFormulario aria-label="Cor da categoria" value={d.cor ?? "azul"} onValueChange={cor => setD({ ...d, cor: cor as NonNullable<CategoriaEntrada["cor"]> })}>{Object.entries(CORES_CATEGORIA).map(([id,nome]) => <option key={id} value={id}>{nome}</option>)}</SelecaoFormulario></Campo><TagCategoriaComplemento categoria={d} /></>}
    <Check checked={d.ativo} onChange={e => setD({ ...d, ativo: e.target.checked })}>Categoria ativa</Check></EditorVenda>;
}
export function EditorGrupo({ inicial, produtos, insumos = [], afetados, categoriasGrupos = [], podeCriarCategoria = false, fechar, aoSalvar }: { inicial: GrupoEntrada; produtos: DadosCatalogo["produtos"] | DadosProdutos["produtos"]; insumos?: DadosProdutos["insumos"]; afetados: number; categoriasGrupos?: DadosCatalogo["categoriasGrupos"]; podeCriarCategoria?: boolean; fechar: () => void; aoSalvar?: (grupo: DadosCatalogo["grupos"][number]) => void }) {
  const [d, setD] = useState(() => ({ ...inicial, opcoes: inicial.opcoes.map(o => ({ ...o, chaveTela: o.id || crypto.randomUUID() })) }));
  const [aba, setAba] = useState("cadastro");
  const [categoriaRapida, setCategoriaRapida] = useState(false);
  const [categoriasLocais, setCategoriasLocais] = useState<DadosCatalogo["categoriasGrupos"]>([]);
  const todasCategorias = [...new Map([...categoriasGrupos, ...categoriasLocais].map(c => [c.id,c])).values()];
  const extras = d.tipo === "EXTRAS";
  const opcao = (i: number, valores: Partial<GrupoEntrada["opcoes"][number]>) => setD({ ...d, opcoes: d.opcoes.map((o, n) => n === i ? { ...o, ...valores } : o) });
  return <EditorVenda titulo={d.id ? `Editar ${inicial.nome}` : "Novo grupo de complementos"} descricao={`Cadastro compartilhado: alterações afetam ${afetados} produto(s) vinculado(s).`} fechar={fechar} abrirSecao={setAba} salvar={async () => { const r = await salvarGrupoVendaAction(d); if (r.registro) aoSalvar?.(r.registro); return r; }}>
    <Tabs value={aba} onValueChange={setAba}><TabsList variant="buttons"><TabsTriggerBotao value="cadastro">Cadastro</TabsTriggerBotao><TabsTriggerBotao value="disponibilidade">Disponibilidade</TabsTriggerBotao></TabsList>
    <TabsContent value="cadastro" keepMounted data-secao="cadastro" className="space-y-4">
    <Texto nome="Nome *" required maxLength={120} value={d.nome} onChange={e => setD({ ...d, nome: e.target.value })} />
    <Campo nome="Categoria de grupos"><SelecaoFormulario aria-label="Categoria de grupos"  value={d.categoriaId ?? ""} onValueChange={valor => setD({ ...d,categoriaId:valor || null })}><option value="">Sem categoria</option>{todasCategorias.filter(c => c.ativo || c.id === d.categoriaId).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario></Campo>
    {podeCriarCategoria && <Button variant="outline" size="sm" onClick={() => setCategoriaRapida(true)}><Plus className="size-3" />Criar categoria de grupos</Button>}
    <Campo nome="Finalidade"><SelecaoFormulario aria-label="Finalidade"  disabled={inicial.tipo === "EXTRAS"} value={d.tipo} onValueChange={valor => setD({ ...d, tipo: valor as GrupoEntrada["tipo"] })}><option value="COMPOSICAO">Escolha de composição</option><option value="COMPLEMENTAR">Produto complementar / quantidade</option>{extras && <option value="EXTRAS">Extras — padrão ilimitado</option>}</SelecaoFormulario></Campo>
    {extras ? <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">Extras é sempre opcional, permite repetir e não tem limite máximo.</p> : <Check checked={d.repetir} onChange={e => setD({ ...d, repetir: e.target.checked })}>Permitir repetir a mesma opção</Check>}
    <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Escolhas do grupo ({d.opcoes.length})</h2><Button variant="outline" size="sm" data-dialogo-altera onClick={() => setD({ ...d, opcoes: [{ id: "", chaveTela: crypto.randomUUID(), nome: "", preco: "0", produtoId: null, quantidade: "1", ativo: true }, ...d.opcoes] })}><Plus className="size-3" />Adicionar opção</Button></div>
      <MultiselecaoCombobox ariaLabel="Produtos e complementos do grupo" placeholder="Buscar produtos ou complementos cadastrados..." mostrarChips={false} opcoes={produtos.filter(p => (p.ativo && !p.grupos.some(v => v.grupoId === d.id)) || d.opcoes.some(o => o.produtoId === p.id)).map(p => ({ id: p.id, nome: p.nome, grupo: classificacaoComercial(p) === "PRINCIPAL" ? "Produtos" : "Complementos", descricao: p.ativo ? null : "Inativo" }))} selecionadosIds={[...new Set(d.opcoes.flatMap(o => o.produtoId ? [o.produtoId] : []))]} aoMudar={ids => setD(a => ({ ...a, opcoes: [...a.opcoes.filter(o => !o.produtoId || ids.includes(o.produtoId)), ...ids.filter(id => !a.opcoes.some(o => o.produtoId === id)).map(id => { const p = produtos.find(p => p.id === id)!; return { id: "", chaveTela: crypto.randomUUID(), nome: p.nome, preco: p.preco, produtoId: p.id, quantidade: "1", ativo: true, composicao: null, usarPrecoPadrao: true }; })] }))} />
      <p className="text-xs text-muted-foreground">As novas escolhas herdam o preço e a composição do cadastro. Arraste para definir a disposição no produto.</p>
      <ListaOrdenavel itens={d.opcoes} chave={o => o.chaveTela} nome={o => o.nome || "Novo complemento"} mudar={opcoes => setD({ ...d,opcoes })}>{(o,i,alca) => <LinhaComplemento nome={o.nome || `Complemento ${i + 1}`} alca={alca} abertoInicial={!o.id} preco={o.usarPrecoPadrao && produtos.some(p => p.id === o.produtoId && "preco" in p) ? precoPadraoComplemento(produtos.find(p => p.id === o.produtoId)! as ProdutoEntrada) : o.preco} ativo={o.ativo} alterarPreco={preco => opcao(i, { preco, usarPrecoPadrao: false })} alterarAtivo={ativo => opcao(i, { ativo })} remover={() => setD({ ...d, opcoes: d.opcoes.filter((_, n) => n !== i) })}>
        {o.produtoId && <p className="text-xs text-muted-foreground">Cadastro: {produtos.find(p => p.id === o.produtoId)?.nome ?? "Indisponível"}. A composição abaixo vale somente para este grupo.</p>}
        <Campo nome="Nome do complemento"><Input aria-label={`Nome da opção ${i + 1}`} autoFocus={!o.id && !o.produtoId && i === 0} required maxLength={160} placeholder="Nome do complemento" value={o.nome} onChange={e => opcao(i, { nome: e.target.value })} /></Campo>
        <ComposicaoProduto configurarFicha={false} podeCadastrarInsumo={false} insumos={insumos} componentes={composicaoDaOpcao(o, produtos.filter(p => "componentes" in p) as ProdutoEntrada[])} mudar={composicao => opcao(i, { composicao, quantidade: "1" })} />
        {o.composicao != null && <Button variant="outline" size="sm" onClick={() => opcao(i, { composicao: null, quantidade: "1" })}>Usar composição padrão</Button>}
        {o.produtoId && !o.usarPrecoPadrao && <Button variant="outline" size="sm" onClick={() => opcao(i, { usarPrecoPadrao: true })}>Usar preço do cadastro</Button>}
      </LinhaComplemento>}</ListaOrdenavel>
    </div><p className="text-xs text-muted-foreground">Mínimo e máximo são definidos dentro de cada produto. Preço zero permite uma escolha grátis. Alterar a composição aqui afeta apenas este grupo. Retirar uma opção a inativa e preserva o histórico.</p>
    </TabsContent><TabsContent value="disponibilidade"><DisponibilidadeGrupo grupo={d} produtos={produtos} /></TabsContent></Tabs>
    {categoriaRapida && <EditorCategoriaGrupo inicial={{ id: "", versao: 0, nome: "", ativo: true }} fechar={() => setCategoriaRapida(false)} aoSalvar={c => { setCategoriasLocais(a => [...a.filter(v => v.id !== c.id),c]); setD(a => ({ ...a, categoriaId: c.id })); }} />}
  </EditorVenda>;
}
