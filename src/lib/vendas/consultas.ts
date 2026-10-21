import "server-only";
import { prisma } from "@/lib/prisma";
import { lerAjustesOpcoes, validarComponentes, type GrupoEntrada, type ProdutoEntrada, type VinculoGrupo, type ComposicaoComplemento } from "./dominio";
import { precosOpcoes } from "./complementos";
import { calcularCustosPreparacoes } from "@/lib/insumos/custo-preparacao";
import { lerPorcaoComposicao } from "@/lib/insumos/porcoes";
import { classificacaoComercial, type CorCategoria, type EscopoCategoria } from "./classificacao";

export async function consultarCatalogo() {
  const [categorias, grupos, produtos, categoriasGrupos] = await Promise.all([
    prisma.categoriaVenda.findMany({ include: { produtos: { select: { produtoId: true, ordem: true }, orderBy: [{ ordem: "asc" }, { produtoId: "asc" }] } }, orderBy: [{ ordem: "asc" }, { id: "asc" }] }),
    prisma.grupoComplementoVenda.findMany({ include: { opcoes: { orderBy: [{ ordem: "asc" }, { id: "asc" }] }, produtos: { select: { produtoId: true } } }, orderBy: { nome: "asc" } }),
    prisma.produtoVenda.findMany({ select: { id: true, nome: true, ativo: true, versao: true, preco: true, classificacoes: true, classificacao: true, grupos: { select: { grupoId: true } } }, orderBy: { nome: "asc" } }),
    prisma.categoriaGrupoComplementoVenda.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
  ]);
  return { categorias: categorias.map(c => ({ ...c, escopo: c.escopo as EscopoCategoria, cor: c.cor as CorCategoria })), categoriasGrupos, grupos: grupos.map(g => ({ ...g, tipo: g.tipo as GrupoEntrada["tipo"], opcoes: precosOpcoes(g.opcoes.map(o => ({ ...o, preco: o.preco.toString(), quantidade: o.quantidade.toString(), composicao: o.composicao == null ? null : validarComponentes(o.composicao) })), produtos.map(p => ({ id: p.id, preco: p.preco.toString() }))), produtos: g.produtos.map(p => p.produtoId) })), produtos: produtos.map(p => ({ ...p, preco: p.preco.toString() })) };
}
export async function consultarProdutos(incluirFiscal = false) {
  const [produtos, insumos, catalogo, gruposFiscais, tiposEmbalagem] = await Promise.all([
    prisma.produtoVenda.findMany({ orderBy: { nome: "asc" }, include: { categorias: { orderBy: { ordem: "asc" } }, grupos: { orderBy: { ordem: "asc" } }, componentes: { orderBy: { ordem: "asc" } } } }),
    prisma.insumo.findMany({ where: { excluidoEm: null }, select: { id: true, nome: true, especificacao: true, categoria: { select: { nome: true } }, ativo: true, tipo: true, unidade: true, custoMedio: true, rendimentoQuantidade: true, rendimentoUnidade: true, conversoes: true, componentes: { select: { componenteId: true, quantidade: true } } }, orderBy: { nome: "asc" } }),
    consultarCatalogo(),
    incluirFiscal ? prisma.grupoFiscalVenda.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }) : Promise.resolve([]),
    prisma.tipoEmbalagemVenda.findMany({ select: { id: true, nome: true, ativo: true, versao: true }, orderBy: { nome: "asc" } }),
  ]);
  const custos = calcularCustosPreparacoes(insumos.map(i => ({ ...i, custoMedio: Number(i.custoMedio), rendimentoQuantidade: i.rendimentoQuantidade == null ? null : Number(i.rendimentoQuantidade), conversoes: i.conversoes.map(c => ({ unidade: c.unidade, fator: Number(c.fator) })), componentes: i.componentes.map(c => ({ ...c, quantidade: Number(c.quantidade) })) })));
  return {
    ...catalogo,
    tiposEmbalagem,
    gruposFiscais: gruposFiscais.map(g => ({ ...g, fiscal: g.fiscal as Record<string, string> })),
    insumos: insumos.map(i => { const custo = custos.get(i.id); return { id: i.id, tipo: i.tipo, nome: i.nome, especificacao: i.especificacao, categoriaNome: i.categoria?.nome ?? null, unidade: i.unidade, ativo: i.ativo, custo: i.tipo === "INSUMO" ? Number(i.custoMedio) > 0 ? Number(i.custoMedio) : null : custo && "unitario" in custo ? custo.unitario : null }; }),
    produtos: produtos.map(p => { return { id: p.id, versao: p.versao, tipoEmbalagemId: p.tipoEmbalagemId, slotsEntrega: p.slotsEntrega, classificacao: classificacaoComercial(p), classificacoes: [classificacaoComercial(p)], tempoPreparoMinutos: p.tempoPreparoMinutos, preco: p.preco.toString(), nome: p.nome, especificacao: p.especificacao, descricao: p.descricao, tipo: p.tipo as ProdutoEntrada["tipo"], codigo: p.codigo, unidade: p.unidade, fotoUrl: p.fotoUrl, observacoes: p.observacoes, modoPreparo: p.modoPreparo, ativo: p.ativo, fiscalRevisado: incluirFiscal ? p.fiscalRevisado : false, fiscal: incluirFiscal ? p.fiscal as Record<string, string> : {}, grupoFiscalId: incluirFiscal ? p.grupoFiscalId : null,
      categorias: p.categorias.map(c => c.categoriaId), grupos: p.grupos.map(g => ({ grupoId: g.grupoId, usarPadrao: g.usarPadrao, minimo: g.minimo, maximo: g.maximo, opcoesExcluidas: g.opcoesExcluidas, ajustesOpcoes: lerAjustesOpcoes(g.ajustesOpcoes) })), componentes: p.componentes.map(c => ({ insumoId: c.insumoId, quantidade: c.quantidade.toFixed(), unidade: c.unidade, observacaoPorcao: c.observacaoPorcao, porcao: lerPorcaoComposicao(c.porcao, c.quantidade.toFixed(), c.unidade), exibirFicha: c.exibirFicha })) as ProdutoEntrada["componentes"] }; }),
  };
}
type CatalogoConsultado = Awaited<ReturnType<typeof consultarCatalogo>>;
type ProdutosConsultados = Awaited<ReturnType<typeof consultarProdutos>>;
type GrupoConsultado = CatalogoConsultado["grupos"][number];
type GruposDados = (Omit<GrupoConsultado, "opcoes"> & { opcoes: (Omit<GrupoConsultado["opcoes"][number], "composicao" | "usarPrecoPadrao"> & { composicao?: ComposicaoComplemento | null; usarPrecoPadrao?: boolean })[] })[];
type CategoriasDados = (Omit<CatalogoConsultado["categorias"][number], "escopo" | "cor"> & { escopo?: EscopoCategoria; cor?: CorCategoria })[];
type ProdutosCatalogo = (Omit<CatalogoConsultado["produtos"][number], "classificacao" | "classificacoes"> & { classificacao?: string; classificacoes?: string[] })[];
export type DadosCatalogo = Omit<CatalogoConsultado, "grupos" | "categorias" | "produtos"> & { categorias: CategoriasDados; produtos: ProdutosCatalogo; grupos: GruposDados };
export type DadosProdutos = Omit<ProdutosConsultados, "grupos" | "produtos" | "categorias"> & { categorias: CategoriasDados; grupos: GruposDados; produtos: (Omit<ProdutosConsultados["produtos"][number], "grupos" | "classificacoes"> & { classificacoes: NonNullable<ProdutoEntrada["classificacoes"]>; grupos: VinculoGrupo[] })[] };
