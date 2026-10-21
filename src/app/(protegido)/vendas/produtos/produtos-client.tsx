"use client";
/* Fotos autenticadas: servir diretamente preserva a sessão, sem cache público do otimizador. */
/* eslint-disable @next/next/no-img-element */
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useState } from "react";
import { entidadeInicial } from "@/lib/atividades/entidade-inicial";
import { Plus, Printer, Package, ChevronRight, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelecaoFormulario } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui/currency-input";
import { StatusCadastroVenda } from "../status-cadastro";
import { GrupoAcoes } from "@/components/padroes-operacionais";
import { limitesEfetivos, opcoesEfetivas, precoObrigatorioNaConfiguracao, type ProdutoEntrada, type CategoriaEntrada, type GrupoEntrada } from "@/lib/vendas/dominio";
import { MultiselecaoCombobox } from "@/components/multiselecao-combobox";
import type { DadosProdutos } from "@/lib/vendas/consultas";
import { PreviaFichaProduto } from "./previa-ficha";
import { EditorCategoria, EditorGrupo } from "../catalogo/catalogo-client";
import { OrdemProdutos } from "../catalogo/ordem-produtos";
import { OrdemCategorias } from "../catalogo/ordem-categorias";
import { salvarProdutoVendaAction } from "../actions";
import { CamposFiscais, sugerirModeloFiscal } from "../fiscal/fiscal-produto-editor";
import type { CrtFiscal } from "@/lib/fiscal/catalogos/tipos";
import { PrecoProduto } from "./preco-produto";
import { custoComposicaoProduto } from "@/lib/vendas/cmv";
import { FotoCampo } from "./foto-campo";
import { BotaoRemoverItem } from "@/components/remover-item";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LinhaComplemento } from "../catalogo/linha-complemento";
import { composicaoDaOpcao, precosOpcoes, ehComplemento } from "@/lib/vendas/complementos";
import { ComposicaoProduto } from "./composicao-produto";

import { ListaOrdenavel } from "../lista-ordenavel";
import { Campo, Texto, Check, Vazio, CabecalhoVendas, EditorVenda, classeSelecao } from "../componentes";
import { BotaoExcluirVenda } from "../botao-excluir";
import { classificacaoComercial } from "@/lib/vendas/classificacao";
import { DisponibilidadeCadastro } from "../catalogo/disponibilidade";
import { TagCategoriaComplemento } from "../catalogo/tag-categoria";

const moeda = (n: number | string) => Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const classes = { PRINCIPAL: "Produto", COMPLEMENTO: "Complemento" };
const novo = (categoriaId?: string): ProdutoEntrada => ({ id: "", versao: 0, nome: "", especificacao: null, descricao: null, tipo: "PADRAO", classificacao: "PRINCIPAL", classificacoes: ["PRINCIPAL"], tempoPreparoMinutos: null, codigo: null, unidade: "UN", fotoUrl: null, observacoes: null, modoPreparo: null, ativo: true, categorias: categoriaId ? [categoriaId] : [], grupos: [], preco: "0", componentes: [] });

export function ProdutosVenda({ dados, adicionar, editar, adicionarCatalogo = false, editarCatalogo = false, podeCadastrarInsumo = false, podeVerFiscal = false, podeEditarFiscal = false, situacaoInicial = "ativos", entidadeInicialId, complementos = false, semCabecalho = false, renderEditor, crt }: {
  dados: DadosProdutos; adicionar: boolean; editar: boolean; adicionarCatalogo?: boolean; editarCatalogo?: boolean; podeCadastrarInsumo?: boolean; podeVerFiscal?: boolean; podeEditarFiscal?: boolean; situacaoInicial?: string; entidadeInicialId?: string; crt?: CrtFiscal; complementos?: boolean; semCabecalho?: boolean; renderEditor?: (produto: ProdutoEntrada, fechar: () => void) => React.ReactNode;
}) {
  const alvoInicial = entidadeInicial(entidadeInicialId) ? dados.produtos.find(p => p.id === entidadeInicialId && (!complementos || ehComplemento(p))) : undefined;
  const [busca, setBusca] = useState(""); const [categoria, setCategoria] = useState(""); const [situacao, setSituacao] = useState(alvoInicial ? alvoInicial.ativo ? "ativos" : "inativos" : situacaoInicial);
  const categoriasDoEscopo = dados.categorias.filter(c => (c.escopo ?? "PRODUTO") === (complementos ? "COMPLEMENTO" : "PRODUTO"));
  const [produto, setProduto] = useState<ProdutoEntrada | null>(null);
  const [ficha, setFicha] = useState<ProdutoEntrada | null>(null); const [ordem, setOrdem] = useState(false);
  const [ordemCategorias, setOrdemCategorias] = useState(false);
  const [categoriaRapida, setCategoriaRapida] = useState<CategoriaEntrada | null>(null);
  const [abertos, setAbertos] = useState<string[]>(alvoInicial ? [alvoInicial.id] : []);
  const normal = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const novoItem = (categoriaId?: string) => complementos ? { ...novo(categoriaId), classificacao: "COMPLEMENTO" as const, classificacoes: ["COMPLEMENTO" as const] } : novo(categoriaId);
  const nomeItem = complementos ? "complemento" : "produto";
  const titulo = complementos ? "Complementos" : "Produtos";
  const filtrados = dados.produtos.filter(p => (complementos ? ehComplemento(p) : !ehComplemento(p)) && (situacao === "todos" || p.ativo === (situacao === "ativos")) && (!categoria || p.categorias.includes(categoria)) && normal(p.nome + " " + (p.especificacao ?? "") + " " + (p.codigo ?? "")).includes(normal(busca)));
  const categoriaAtual = categoriasDoEscopo.find(c => c.id === categoria);
  if (categoriaAtual) { const posicoes = new Map(categoriaAtual.produtos.map(v => [v.produtoId, v.ordem])); filtrados.sort((a, b) => (posicoes.get(a.id) ?? 0) - (posicoes.get(b.id) ?? 0) || a.nome.localeCompare(b.nome, "pt-BR")); }
  const acoesCabecalho = <>{editarCatalogo && !complementos && <Button variant="outline" onClick={() => setOrdemCategorias(true)}><ListOrdered className="size-4" />Ordenar categorias</Button>}{adicionarCatalogo && <Button variant="outline" onClick={() => setCategoriaRapida({ id:"",versao:0,nome:"",ativo:true,escopo:complementos ? "COMPLEMENTO" : "PRODUTO",cor:"azul" })}><Plus className="size-4" />Nova categoria</Button>}{adicionar && <Button onClick={() => setProduto(novoItem())}><Plus className="size-4" />Novo {nomeItem}</Button>}</>;
  return <div className="space-y-5">
    {semCabecalho ? <div className="flex flex-wrap justify-end gap-2">{acoesCabecalho}</div> : <CabecalhoVendas titulo={titulo} descricao={complementos ? "Complementos organizados por categoria. Abra um complemento para conferir os detalhes." : "Cardápio organizado por categoria. Abra um produto para conferir os detalhes."}>{acoesCabecalho}</CabecalhoVendas>}
    <div className="flex flex-wrap items-center gap-2">
      <Input className="max-w-sm" aria-label={complementos ? "Buscar complementos" : "Buscar produtos"} placeholder="Nome, especificação ou código" value={busca} onChange={e => setBusca(e.target.value)} />
      <SelecaoFormulario aria-label="Categoria" className="max-w-60" value={categoria} onValueChange={valor => setCategoria(valor)}><option value="">Todas as categorias</option>{categoriasDoEscopo.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}</SelecaoFormulario>
      <SelecaoFormulario aria-label={complementos ? "Status dos complementos" : "Situação dos produtos"} className="max-w-36" value={situacao} onValueChange={valor => setSituacao(valor)}><option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option></SelecaoFormulario>
      {editarCatalogo && categoriaAtual && <Button variant="outline" onClick={() => setOrdem(true)}><ListOrdered className="size-4" />Reordenar por arrastar</Button>}
    </div>
    <p className="text-xs text-muted-foreground">{filtrados.length} {nomeItem}(s) neste filtro</p>
    {!filtrados.length && <Vazio>Nenhum {nomeItem} encontrado neste filtro.</Vazio>}
    {(complementos ? [null] : categoria ? (categoriaAtual ? [categoriaAtual] : []) : [...categoriasDoEscopo, null]).map(c => { const itens = filtrados.filter(p => complementos || (c ? p.categorias.includes(c.id) : !p.categorias.length)).sort((a,b) => c ? (c.produtos.find(v => v.produtoId === a.id)?.ordem ?? 99999) - (c.produtos.find(v => v.produtoId === b.id)?.ordem ?? 99999) || a.nome.localeCompare(b.nome,"pt-BR") : a.nome.localeCompare(b.nome,"pt-BR")); if (!itens.length && (!c || (complementos && !categoria))) return null; return <section key={c?.id ?? "sem-categoria"} className="space-y-2">{!complementos && <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2"><h2 className="font-semibold">{c?.nome ?? "Sem categoria"} <span className="text-xs font-normal text-muted-foreground">({itens.length})</span></h2><GrupoAcoes className="flex-wrap">{c && <StatusCadastroVenda tipo="CATEGORIA" id={c.id} versao={c.versao} nome={c.nome} ativo={c.ativo} editar={editarCatalogo} />}{c && editarCatalogo && <><Button size="sm" variant="ghost" onClick={() => { setCategoria(c.id); setOrdem(true); }}><ListOrdered className="size-3" />Ordenar</Button><Button onClick={() => setCategoriaRapida(c)} aria-label={`Editar ${c.nome}`} variant="editar" size="icon-sm" /><BotaoExcluirVenda tipo="CATEGORIA" id={c.id} versao={c.versao} nome={c.nome} aviso="Os produtos vinculados ficarão sem esta categoria." /></>}{adicionar && <Button size="sm" variant="outline" onClick={() => setProduto(novoItem(c?.id))}><Plus className="size-3" />Adicionar {nomeItem}</Button>}</GrupoAcoes></div>}{itens.length ? <div className="overflow-x-auto rounded-2xl border bg-card">
      <Table className="produtos-catalogo w-full min-w-[812px] text-sm"><colgroup><col />{complementos && <col style={{ width: 176 }} />}<col style={{ width: 208 }} /><col style={{ width: 128 }} /><col style={{ width: 176 }} /></colgroup><TableHeader className="border-b bg-muted/30 text-left text-xs text-muted-foreground"><TableRow><TableHead className="px-4 py-3 font-medium">{complementos ? "Complemento" : "Produto"}</TableHead>{complementos && <TableHead>Categoria</TableHead>}<TableHead className="px-3 py-3 font-medium">Preço</TableHead><TableHead className="px-3 py-3 font-medium">Status</TableHead><TableHead className="px-3 py-3 text-right font-medium">Ações</TableHead></TableRow></TableHeader>
      <TableBody>{itens.map(p => { const aberto = abertos.includes(p.id); return <LinhaProduto key={p.id} produto={p} dados={dados} aberto={aberto} editarPreco={editar} complemento={complementos}
        alternar={() => setAbertos(a => aberto ? a.filter(id => id !== p.id) : [...a,p.id])}
        status={<StatusCadastroVenda tipo="PRODUTO" id={p.id} versao={p.versao} ativo={p.ativo} nome={p.nome} editar={editar} />}
        acoes={<>{!complementos && <Button size="icon-sm" variant="ghost" aria-label={"Imprimir ficha técnica de " + p.nome} onClick={() => setFicha(p)}><Printer className="size-4" /></Button>}{editar && <><Button aria-label={"Editar " + p.nome} onClick={() => setProduto(structuredClone(p))} variant="editar" size="icon-sm" /><BotaoExcluirVenda tipo="PRODUTO" id={p.id} versao={p.versao} nome={p.nome} aviso="Caso ele esteja em um grupo de complementos, retire o vínculo antes." /></>}</>} />; })}</TableBody></Table>
    </div> : <p className="px-4 text-xs text-muted-foreground">Nenhum {nomeItem} desta categoria no filtro atual.</p>}</section>; })}
    {complementos && categoriasDoEscopo.length > 0 && <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-medium">Categorias de complementos</summary><div className="mt-3 space-y-2">{categoriasDoEscopo.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-2"><TagCategoriaComplemento categoria={c} /><GrupoAcoes>{editarCatalogo && <><StatusCadastroVenda tipo="CATEGORIA" id={c.id} versao={c.versao} nome={c.nome} ativo={c.ativo} editar /><Button variant="editar" aria-label={"Editar categoria " + c.nome} onClick={() => setCategoriaRapida(c)} /><BotaoExcluirVenda tipo="CATEGORIA" id={c.id} versao={c.versao} nome={c.nome} aviso="Os complementos perderão somente esta categoria." /></>}</GrupoAcoes></div>)}</div></details>}
    <style>{`@media(max-width:639px){.produtos-catalogo{min-width:0!important}.produtos-catalogo,.produtos-catalogo tbody{display:block}.produtos-catalogo colgroup,.produtos-catalogo thead{display:none}.produtos-catalogo tr{display:flex;flex-wrap:wrap}.produtos-catalogo td{display:block;min-width:0}.produtos-catalogo td:first-child,.produtos-catalogo td[colspan]{width:100%}.produtos-catalogo td[data-status]{flex:1 0 7rem}.produtos-catalogo td[data-acoes]{flex:1 0 10.75rem}.produtos-catalogo td[data-preco]{flex:1 1 100%;text-align:left;padding-top:0}.produtos-catalogo td[data-preco]:before{content:"Preço";display:block;font-size:11px;color:var(--muted-foreground);margin-bottom:4px}}`}</style>
    {ordem && categoriaAtual && <OrdemProdutos categoria={categoriaAtual} produtos={dados.produtos} fechar={() => setOrdem(false)} />}
    {ordemCategorias && <OrdemCategorias categorias={categoriasDoEscopo} fechar={() => setOrdemCategorias(false)} />}
    {produto && (renderEditor ? renderEditor(produto, () => setProduto(null)) : <EditorProduto inicial={produto} dados={dados} adicionarCatalogo={adicionarCatalogo} editarCatalogo={editarCatalogo} podeCadastrarInsumo={podeCadastrarInsumo} podeVerFiscal={podeVerFiscal} podeEditarFiscal={podeEditarFiscal} crt={crt} fechar={() => setProduto(null)} />)}
    {categoriaRapida && <EditorCategoria inicial={categoriaRapida} fechar={() => setCategoriaRapida(null)} />}
    {ficha && <PreviaFichaProduto produto={ficha} dados={dados} fechar={() => setFicha(null)} />}
  </div>;
}
function LinhaProduto({ produto: p, dados, aberto, alternar, status, acoes, editarPreco, complemento = false }: { produto: ProdutoEntrada; dados: DadosProdutos; aberto: boolean; alternar: () => void; status: React.ReactNode; acoes: React.ReactNode; editarPreco: boolean; complemento?: boolean }) {
  const custo = custoComposicaoProduto(p, dados.insumos);
  const configuracaoObrigatoriaPaga = precoObrigatorioNaConfiguracao(dados.grupos, p.grupos);
  return <><TableRow className="border-b last:border-0 hover:bg-muted/20">
    <TableCell className="px-4 py-3"><Button type="button" variant="ghost" className="h-auto w-full justify-start gap-3 p-0 text-left font-normal whitespace-normal" aria-label={`${aberto ? "Fechar" : "Abrir"} detalhes de ${p.nome}`} aria-expanded={aberto} aria-controls={"detalhes-" + p.id} onClick={alternar}>
      <ChevronRight className={"size-4 shrink-0 text-muted-foreground transition-transform duration-200 " + (aberto ? "rotate-90" : "")} />
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">{p.fotoUrl ? <img src={p.fotoUrl} alt="" loading="lazy" width={80} height={80} className="h-full w-full object-cover" /> : <Package className="size-7 text-muted-foreground" />}</span>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{p.nome}</span>{p.especificacao && <span className="mt-1 block text-xs text-muted-foreground">{p.especificacao}</span>}<span className="mt-1 block text-xs text-muted-foreground">{classes[classificacaoComercial(p)]}</span></span>
    </Button></TableCell>
    {complemento && <TableCell data-categoria className="px-3 py-3"><div className="flex flex-wrap gap-1">{dados.categorias.filter(c => p.categorias.includes(c.id) && c.escopo === "COMPLEMENTO").map(c => <TagCategoriaComplemento key={c.id} categoria={c} />)}{!dados.categorias.some(c => p.categorias.includes(c.id) && c.escopo === "COMPLEMENTO") && <span className="text-xs text-muted-foreground">Sem categoria</span>}</div></TableCell>}
    <TableCell data-preco className="py-3 pl-3 pr-6 align-middle tabular-nums"><PrecoProduto key={p.preco} produto={p} editar={editarPreco} custo={custo} configuracaoObrigatoriaPaga={configuracaoObrigatoriaPaga} /></TableCell>
    <TableCell data-status className="px-3 py-3">{status}</TableCell>
    <TableCell data-acoes className="px-3 py-3"><GrupoAcoes nome={`Ações de ${p.nome}`}>{acoes}</GrupoAcoes></TableCell>
  </TableRow>
  {aberto && <TableRow id={"detalhes-" + p.id} className="border-b bg-muted/15"><TableCell colSpan={complemento ? 5 : 4} className="p-5"><div className="grid gap-5 md:grid-cols-3">
    <div><h3 className="mb-2 font-medium">Informações do {complemento ? "complemento" : "produto"}</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.descricao || "Sem descrição comercial."}</p><p className="mt-3 text-xs">{p.codigo || "Sem código"} · {p.unidade}</p><p className="mt-1 text-xs">Tempo de preparo: {p.tempoPreparoMinutos == null ? "não informado" : p.tempoPreparoMinutos + " min"}</p></div>
    <div><h3 className="mb-2 font-medium">Composição por unidade</h3>{p.componentes.length ? <ul className="space-y-1 text-xs text-muted-foreground">{p.componentes.map(c => <li key={c.insumoId}>{c.quantidade.replace(".", ",")} {c.unidade} · {dados.insumos.find(i => i.id === c.insumoId)?.nome ?? "Ingrediente indisponível"}{c.observacaoPorcao ? " · " + c.observacaoPorcao : ""}</li>)}</ul> : <p className="text-xs text-muted-foreground">Composição ainda não cadastrada.</p>}</div>
    <div><h3 className="mb-2 font-medium">Grupos e escolhas</h3>{p.grupos.length ? p.grupos.map(v => { const g = dados.grupos.find(g => g.id === v.grupoId); if (!g) return null; const l = limitesEfetivos(g,v); return <details key={g.id} className="mb-2 rounded-lg border bg-card p-2 text-xs"><summary className="cursor-pointer font-medium">{g.nome} · {l.minimo} a {l.maximo ?? "ilimitado"}</summary><ul className="mt-2 space-y-1 text-muted-foreground">{opcoesEfetivas(precosOpcoes(g.opcoes, dados.produtos), v).filter(o => o.ativo && !v.opcoesExcluidas?.includes(o.id)).map(o => <li key={o.id}>{o.nome} · {moeda(o.preco)}</li>)}</ul></details>; }) : <p className="text-xs text-muted-foreground">Sem grupos de escolhas.</p>}</div>
  </div></TableCell></TableRow>}</>;
}
function EditorProduto({ inicial, dados: dadosOriginais, fechar, adicionarCatalogo, editarCatalogo, podeCadastrarInsumo, podeVerFiscal, podeEditarFiscal, crt }: { inicial: ProdutoEntrada; dados: DadosProdutos; fechar: () => void; adicionarCatalogo: boolean; editarCatalogo: boolean; podeCadastrarInsumo: boolean; podeVerFiscal: boolean; podeEditarFiscal: boolean; crt?: CrtFiscal }) {
  const [d, setD] = useState<ProdutoEntrada>(() => ({ ...inicial, grupos: inicial.grupos.map(v => { const g = dadosOriginais.grupos.find(g => g.id === v.grupoId); return g ? { ...v, ...limitesEfetivos(g,v), usarPadrao: g.tipo === "EXTRAS" } : v; }) }));
  const [pausa, setPausa] = useState<{ grupoId: string; opcaoId: string; ativo: boolean; nome: string; globalAtivo: boolean } | null>(null);
  const [aba, setAba] = useState("identificacao"); const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [fichaAberta, setFichaAberta] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<string[]>([]);
  const [categoriaRapida, setCategoriaRapida] = useState<CategoriaEntrada | null>(null); const [grupoRapido, setGrupoRapido] = useState<GrupoEntrada | null>(null);
  const [categoriasLocais, setCategoriasLocais] = useState<DadosProdutos["categorias"]>([]); const [gruposLocais, setGruposLocais] = useState<DadosProdutos["grupos"]>([]);
  const dados = { ...dadosOriginais, categorias: [...new Map([...dadosOriginais.categorias, ...categoriasLocais].map(c => [c.id,c])).values()], grupos: [...new Map([...dadosOriginais.grupos, ...gruposLocais].map(g => [g.id,g])).values()] };
  const configuracaoObrigatoriaPaga = precoObrigatorioNaConfiguracao(dados.grupos, d.grupos);
  const campo = <K extends keyof ProdutoEntrada>(chave: K, valor: ProdutoEntrada[K]) => setD(a => ({ ...a, [chave]: valor }));
  const pertencentes = dados.grupos.filter(g => g.opcoes.some(o => o.produtoId === d.id && o.ativo));
  const abas = [["identificacao","Identificação"],["preco","Preço"],["composicao","Composição"],["disponibilidade","Disponibilidade"],...(podeVerFiscal ? [["fiscal","Fiscal"]] : [])];
  const vincularGrupo = (g: DadosProdutos["grupos"][number]) => ({ grupoId: g.id, usarPadrao: g.tipo === "EXTRAS", minimo: 0, maximo: null, opcoesExcluidas: [] });
  function blocoGrupo(g: DadosProdutos["grupos"][number], alca?: React.ReactNode) {
    const aberto = gruposAbertos.includes(g.id);
    const conteudoId = `complementos-do-grupo-${g.id}`;
    const v = d.grupos.find(v => v.grupoId === g.id);
    const mudar = (alteracao: Partial<NonNullable<typeof v>>) => campo("grupos",d.grupos.map(v => v.grupoId === g.id ? { ...v, ...alteracao } : v));
    const totalOpcoes = opcoesEfetivas(g.opcoes, v ?? {}).filter(o => o.ativo).length;
    const ajustar = (opcaoId: string, ajuste: Partial<NonNullable<NonNullable<typeof v>["ajustesOpcoes"]>[number]>) => mudar({ ajustesOpcoes: [...(v?.ajustesOpcoes ?? []).filter(a => a.opcaoId !== opcaoId), { ...v?.ajustesOpcoes?.find(a => a.opcaoId === opcaoId), ...ajuste, opcaoId }] });
    const opcoes = precosOpcoes(g.opcoes, dados.produtos).map(o => { const global = d.pausasComplementos?.find(p => { const origem = dados.grupos.flatMap(g => g.opcoes).find(o => o.id === p.opcaoId); return o.produtoId ? origem?.produtoId === o.produtoId : p.opcaoId === o.id; }); return { ...o, ativo: global?.ativo ?? o.ativo }; });
    return <div key={g.id} className="min-w-0 rounded-xl border bg-card p-2"><div className="flex flex-wrap items-center gap-2">{alca}<button type="button" className="flex min-h-9 min-w-0 flex-1 basis-44 items-center gap-2 py-2 text-left text-sm font-medium" aria-label={`${aberto ? "Fechar" : "Abrir"} grupo ${g.nome}`} aria-expanded={aberto} aria-controls={conteudoId} onClick={() => setGruposAbertos(atual => aberto ? atual.filter(id => id !== g.id) : [...atual, g.id])}><ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-90" : ""}`} /><span className="min-w-0 truncate" title={g.nome}>{g.nome}</span><span className="shrink-0 text-xs font-normal text-muted-foreground">· {totalOpcoes} {totalOpcoes === 1 ? "opção" : "opções"}{!g.ativo ? " · Inativo" : ""}</span></button>
      {v && (g.tipo === "EXTRAS" ? <span className="flex min-h-9 items-center text-xs text-muted-foreground">Opcional · Sem limite</span> : <div className="flex min-h-9 flex-wrap items-center gap-2"><Check checked={v.minimo > 0} onChange={e => { const minimo = e.target.checked ? Math.max(1, v.minimo || 0) : 0; mudar({ usarPadrao:false, minimo, maximo:v.maximo !== null && v.maximo < minimo ? minimo : v.maximo }); }}>Obrigatório</Check><label className="flex items-center gap-1 text-xs font-medium">Mín.<Input aria-label={`Mínimo de ${g.nome}`} className="h-9 w-14 px-2 text-center" type="number" min={0} step={1} required value={Number.isNaN(v.minimo) ? "" : v.minimo} onChange={e => mudar({ usarPadrao:false,minimo:e.target.value === "" ? NaN : Number(e.target.value) })} /></label><label className="flex items-center gap-1 text-xs font-medium">Máx.<Input aria-label={`Máximo de ${g.nome}; vazio significa ilimitado`} className="h-9 w-14 px-2 text-center" type="number" min={v.minimo || 0} step={1} value={v.maximo ?? ""} onChange={e => mudar({ usarPadrao:false,maximo:e.target.value === "" ? null : Number(e.target.value) })} /></label></div>)}
      <BotaoRemoverItem nome={`Remover grupo ${g.nome} do produto`} data-dialogo-altera onClick={() => campo("grupos", d.grupos.filter(grupo => grupo.grupoId !== g.id))} />
      </div><div id={conteudoId} hidden={!aberto} className="min-w-0 space-y-2 pt-2">
        <p className="text-xs text-muted-foreground">Ajuste preço e composição para este produto. As alterações serão confirmadas ao salvar.</p>
        <div className="space-y-2">{opcoesEfetivas(opcoes, v ?? {}).filter(o => !v?.opcoesExcluidas?.includes(o.id)).map(o => <LinhaComplemento key={o.id} nome={o.nome} preco={o.preco} ativo={o.ativo} alterarPreco={preco => ajustar(o.id, { preco })} alterarAtivo={ativo => setPausa({ grupoId: g.id, opcaoId: o.id, ativo, nome: o.nome, globalAtivo: opcoes.find(base => base.id === o.id)?.ativo ?? false })} remover={() => mudar({ opcoesExcluidas: [...(v?.opcoesExcluidas ?? []), o.id] })}>
          <ComposicaoProduto configurarFicha={false} podeCadastrarInsumo={false} insumos={dados.insumos} componentes={composicaoDaOpcao(o, dados.produtos)} mudar={composicao => ajustar(o.id, { composicao })} />
          {(v?.ajustesOpcoes?.find(a => a.opcaoId === o.id)?.composicao != null || v?.ajustesOpcoes?.find(a => a.opcaoId === o.id)?.preco !== undefined) && <Button variant="outline" size="sm" onClick={() => mudar({ ajustesOpcoes: (v?.ajustesOpcoes ?? []).map(a => a.opcaoId === o.id ? { opcaoId: a.opcaoId, ...(a.ativo === undefined ? {} : { ativo: a.ativo }) } : a) })}>Usar padrão do grupo</Button>}
        </LinhaComplemento>)}</div>
        {!!v?.opcoesExcluidas?.length && <Button variant="outline" size="sm" onClick={() => mudar({ opcoesExcluidas: [] })}>Restaurar complementos removidos</Button>}
        {editarCatalogo && <Button onClick={() => setGrupoRapido(structuredClone(g))} aria-label="Editar grupo compartilhado" variant="editar" size="icon-sm" />}
      </div>
    </div>;
  }
  return <><EditorVenda titulo={d.id ? "Editar produto" : "Novo produto"} descricao="Cadastro comercial, composição e fiscal do produto." fechar={fechar} salvar={() => salvarProdutoVendaAction(d)} impedido={enviandoFoto} abrirSecao={setAba}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-1">{abas.map(([id,nome]) => <Button key={id} data-abrir-secao={id} size="sm" variant={aba === id ? "default" : "outline"} onClick={() => setAba(id)}>{nome}</Button>)}</div>
      <Button type="button" variant="outline" size="sm" onClick={() => setFichaAberta(true)}><Printer className="size-4" />Imprimir ficha técnica</Button>
    </div>
    {fichaAberta && <PreviaFichaProduto produto={d} dados={dados} fechar={() => setFichaAberta(false)} />}
    <div hidden={aba !== "identificacao"} data-secao="identificacao" className="space-y-4">
      <Texto nome="Nome *" required maxLength={160} value={d.nome} onChange={e => campo("nome",e.target.value)} />
      <Texto nome="Especificação" maxLength={300} value={d.especificacao ?? ""} onChange={e => campo("especificacao",e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-2"><FotoCampo produtoId={d.id} url={d.fotoUrl} mudar={url => campo("fotoUrl",url)} aoEnviar={setEnviandoFoto} /><div className="space-y-3">
        <Campo nome="Classificação"><SelecaoFormulario aria-label="Classificação" value={classificacaoComercial(d)} onValueChange={valor => { const classificacao = valor as "PRINCIPAL" | "COMPLEMENTO"; setD(a => ({ ...a, classificacao, classificacoes: [classificacao], categorias: [], grupos: classificacao === "COMPLEMENTO" ? [] : a.grupos })); }}><option value="PRINCIPAL">Produto</option><option value="COMPLEMENTO">Complemento</option></SelecaoFormulario></Campo>
        <p className="text-xs text-muted-foreground">Produto pode ser vendido sozinho. Complemento precisa estar dentro de um produto.</p>
        <Texto nome="Código interno (único)" maxLength={80} value={d.codigo ?? ""} onChange={e => campo("codigo",e.target.value)} />
        <Texto nome="Unidade comercial *" maxLength={10} required value={d.unidade} onChange={e => campo("unidade",e.target.value)} />
        <Check checked={d.ativo} onChange={e => campo("ativo",e.target.checked)}>Produto ativo</Check>
      </div></div>
      {(d.classificacoes ?? [d.classificacao ?? "PRINCIPAL"]).includes("COMPLEMENTO") && <div className="space-y-3 rounded-xl border p-3"><h3 className="text-sm font-medium">Grupos aos quais pertence</h3>{pertencentes.map(g => <p key={g.id} className="text-sm">{g.nome}</p>)}{!pertencentes.length && <p className="text-xs text-muted-foreground">O complemento pode ser cadastrado antes de ser vinculado a um grupo.</p>}
        {editarCatalogo ? <><Campo nome={pertencentes.length ? "Adicionar a outro grupo" : "Grupo do complemento *"}><SelecaoFormulario aria-label={pertencentes.length ? "Adicionar a outro grupo" : "Grupo do complemento *"}  required={false} value={d.novoVinculoComplemento?.grupoId ?? ""} onValueChange={valor => campo("novoVinculoComplemento",valor ? { grupoId:valor,preco:"0" } : null)}><option value="">Selecione um grupo</option>{dados.grupos.filter(g => g.ativo && !pertencentes.some(v => v.id === g.id)).map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}</SelecaoFormulario></Campo>{d.novoVinculoComplemento && <Campo nome="Preço desta escolha no grupo"><CurrencyInput required value={d.novoVinculoComplemento.preco} onValueChange={preco => campo("novoVinculoComplemento",{ ...d.novoVinculoComplemento!,preco })} /></Campo>}</> : !pertencentes.length && <p role="alert" className="text-sm text-destructive">É necessária permissão de editar o catálogo para vincular este novo complemento a um grupo.</p>}</div>}
      <Campo nome="Descrição comercial"><textarea className={classeSelecao + " h-24 py-2"} maxLength={3000} value={d.descricao ?? ""} onChange={e => campo("descricao",e.target.value)} /></Campo>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">Categorias</span>{adicionarCatalogo && <Button type="button" size="sm" variant="outline" onClick={() => setCategoriaRapida({ id:"",versao:0,nome:"",ativo:true,escopo:classificacaoComercial(d) === "PRINCIPAL" ? "PRODUTO" : "COMPLEMENTO",cor:"azul" })}><Plus className="size-3" />Criar categoria</Button>}</div>
        <MultiselecaoCombobox opcoes={dados.categorias.filter(c => (c.escopo ?? "PRODUTO") === (classificacaoComercial(d) === "PRINCIPAL" ? "PRODUTO" : "COMPLEMENTO") && (c.ativo || d.categorias.includes(c.id))).map(c => ({ id:c.id, nome:c.nome, descricao:c.ativo ? null : "Inativa" }))} selecionadosIds={d.categorias} aoMudar={ids => campo("categorias",ids)} placeholder="Selecionar categorias..." ariaLabel="Categorias do produto" vazio="Nenhuma categoria encontrada." />
      </div>
    </div>
    <div hidden={aba !== "preco"} data-secao="preco" className="max-w-sm space-y-3">
      <Campo nome="Preço *"><CurrencyInput aria-label="Preço do produto" required value={d.preco} onValueChange={preco => campo("preco", preco)} /></Campo>
      <p className="text-xs text-muted-foreground">O mesmo preço vale para todas as vendas. O canal informa apenas a origem da venda.</p>
      <p className="text-xs text-muted-foreground">{Number(d.preco) > 0 ? "Preço cadastrado" : configuracaoObrigatoriaPaga ? "Preço formado pelas escolhas obrigatórias" : "Preço zero sem escolha obrigatória paga: produto indisponível para venda"}</p>
    </div>
    <div hidden={aba !== "composicao"} data-secao="composicao" className="space-y-4">
      <div className="max-w-40"><Campo nome="Slots de entrega"><Input inputMode="numeric" restricao="inteiro" maxLength={6} value={d.slotsEntrega ?? ""} onChange={e => campo("slotsEntrega", e.target.value === "" ? null : Number(e.target.value))} /></Campo></div>
      <p className="text-xs text-muted-foreground">Ocupação por unidade de venda. Zero indica que o produto não ocupa slots; vazio mantém o cálculo de veículo pendente.</p>
      <p className="text-sm text-muted-foreground">Todos os ingredientes entram no custo e no consumo de estoque. Arraste para ordenar e desmarque os itens que não devem aparecer na ficha de montagem.</p>
      <ComposicaoProduto componentes={d.componentes} insumos={dados.insumos} mudar={componentes => campo("componentes",componentes)} podeCadastrarInsumo={podeCadastrarInsumo} />
      {classificacaoComercial(d) === "PRINCIPAL" && <><h3 className="text-sm font-semibold">Grupo de complementos</h3>
      <p className="text-xs text-muted-foreground">Defina os limites na própria linha. Abra o grupo para escolher as opções e arraste para ordenar.</p>
      <MultiselecaoCombobox opcoes={dados.grupos.filter(g => g.ativo || d.grupos.some(v => v.grupoId === g.id)).map(g => { const quantidade = g.opcoes.filter(o => o.ativo).length; return { id:g.id, nome:g.nome, grupo:dados.categoriasGrupos.find(c => c.id === g.categoriaId)?.nome ?? "Sem categoria", descricao:`${quantidade} ${quantidade === 1 ? "opção" : "opções"}${g.ativo ? "" : " · inativo"}` }; })} selecionadosIds={d.grupos.map(v => v.grupoId)} aoMudar={ids => campo("grupos",[...d.grupos.filter(v => ids.includes(v.grupoId)),...ids.filter(id => !d.grupos.some(v => v.grupoId === id)).flatMap(id => { const g = dados.grupos.find(g => g.id === id); return g ? [vincularGrupo(g)] : []; })])} placeholder="Buscar grupos de complementos..." ariaLabel="Grupo de complementos" mostrarChips={false} />
      <ListaOrdenavel itens={d.grupos} chave={v => v.grupoId} nome={v => dados.grupos.find(g => g.id === v.grupoId)?.nome ?? "Grupo"} mudar={grupos => campo("grupos",grupos)}>{(v,_,alca) => { const g = dados.grupos.find(g => g.id === v.grupoId); return g ? blocoGrupo(g,alca) : null; }}</ListaOrdenavel>
      <p className="text-xs text-muted-foreground">Somente as opções escolhidas compõem o consumo variável. Vincule cada opção ao produto que contém seus ingredientes; não some todas as alternativas como ingredientes fixos.</p></>}
      <Texto nome="Tempo de preparo (minutos)" type="number" min={0} step={1} value={d.tempoPreparoMinutos ?? ""} onChange={e => campo("tempoPreparoMinutos",e.target.value === "" ? null : Number(e.target.value))} />
      <Campo nome="Observações operacionais"><textarea className={classeSelecao + " h-20 py-2"} maxLength={3000} value={d.observacoes ?? ""} onChange={e => campo("observacoes",e.target.value)} /></Campo>
    </div>
    <div hidden={aba !== "disponibilidade"} data-secao="disponibilidade"><DisponibilidadeCadastro produto={d} dados={dados} /></div>
    {podeVerFiscal && <fieldset disabled={!podeEditarFiscal} hidden={aba !== "fiscal"} data-secao="fiscal" className="space-y-4">
      <Campo nome="Grupo fiscal"><SelecaoFormulario aria-label="Grupo fiscal"  value={d.grupoFiscalId ?? ""} onValueChange={valor => { const grupoFiscalId = valor || null; const grupo = dados.gruposFiscais.find(g => g.id === grupoFiscalId); setD(a => ({ ...a, grupoFiscalId, fiscal: grupo ? sugerirModeloFiscal(grupo.fiscal, a.fiscal ?? {}) : a.fiscal, fiscalRevisado: false, salvarFiscal: true })); }}><option value="">Sem grupo fiscal</option>{dados.gruposFiscais.filter(g => g.ativo || g.id === d.grupoFiscalId).map(g => <option key={g.id} value={g.id}>{g.nome}{!g.ativo ? " (inativo)" : ""}</option>)}</SelecaoFormulario></Campo>
      <CamposFiscais fiscal={d.fiscal ?? {}} mudar={fiscal => setD(a => ({ ...a, fiscal, fiscalRevisado: false, salvarFiscal: true }))} revisado={d.fiscalRevisado ?? false} crt={crt} />
      <Check checked={d.fiscalRevisado ?? false} onChange={e => setD(a => ({ ...a, fiscalRevisado: e.target.checked, salvarFiscal: true }))}>Dados conferidos para este produto</Check>
      <p className="text-xs text-muted-foreground">Cadastro comercial fiscal: alterações para emissão exigem versão prospectiva no painel. O grupo não atribui NCM automaticamente.</p>
      <Button type="button" nativeButton={false} render={<a href="/financeiro/fiscal/cobertura" target="_blank" rel="noreferrer" />} variant="outline">Cobertura e versões fiscais</Button>
    </fieldset>}
  </EditorVenda>
    {pausa && <Dialog open protegerAlteracoes={false} onOpenChange={aberto => { if (!aberto) setPausa(null); }}><DialogContent><DialogHeader><DialogTitle>{pausa.ativo ? "Ativar" : "Pausar"} {pausa.nome}</DialogTitle><DialogDescription>Escolha onde aplicar. A mudança será confirmada ao salvar o produto.</DialogDescription></DialogHeader><div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={!pausa.globalAtivo} onClick={() => { const atual = pausa; campo("grupos", d.grupos.map(v => v.grupoId === atual.grupoId ? { ...v, ajustesOpcoes: [...(v.ajustesOpcoes ?? []).filter(a => a.opcaoId !== atual.opcaoId), { ...v.ajustesOpcoes?.find(a => a.opcaoId === atual.opcaoId), opcaoId: atual.opcaoId, ativo: atual.ativo }] } : v)); setPausa(null); }}>Apenas neste produto</Button>
      {editarCatalogo && <Button onClick={() => { const origem = dados.grupos.flatMap(g => g.opcoes).find(o => o.id === pausa.opcaoId)!; const grupos = dados.grupos.filter(g => g.opcoes.some(o => origem.produtoId ? o.produtoId === origem.produtoId : o.id === origem.id)).map(g => ({ id: g.id, versao: g.versao })); setD(a => ({ ...a, pausasComplementos: [...(a.pausasComplementos ?? []).filter(p => { const o = dados.grupos.flatMap(g => g.opcoes).find(o => o.id === p.opcaoId); return origem.produtoId ? o?.produtoId !== origem.produtoId : p.opcaoId !== origem.id; }), { opcaoId: origem.id, ativo: pausa.ativo, grupos }], grupos: a.grupos.map(v => v.grupoId === pausa.grupoId ? { ...v, ajustesOpcoes: (v.ajustesOpcoes ?? []).map(a => a.opcaoId === origem.id ? { ...a, ativo: pausa.ativo } : a) } : v) })); setPausa(null); }}>Em todos os produtos</Button>}
      <Button variant="ghost" onClick={() => setPausa(null)}>Cancelar</Button>
    </div>{!editarCatalogo && <p className="text-sm text-muted-foreground">A alteração em todos os produtos exige permissão de editar Complementos.</p>}</DialogContent></Dialog>}
    {categoriaRapida && <EditorCategoria inicial={categoriaRapida} fechar={() => setCategoriaRapida(null)} aoSalvar={c => { setCategoriasLocais(a => [...a.filter(v => v.id !== c.id),c]); setD(a => ({ ...a,categorias:[...new Set([...a.categorias,c.id])] })); }} />}
    {grupoRapido && <EditorGrupo inicial={grupoRapido} produtos={dados.produtos.filter(p => p.id !== d.id)} insumos={dados.insumos} categoriasGrupos={dados.categoriasGrupos} podeCriarCategoria={adicionarCatalogo} afetados={dados.grupos.find(g => g.id === grupoRapido.id)?.produtos.length ?? 0} fechar={() => setGrupoRapido(null)} aoSalvar={g => { setGruposLocais(a => [...a.filter(v => v.id !== g.id),g]); }} />}
  </>;
}

