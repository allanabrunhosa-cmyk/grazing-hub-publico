"use server";
import { isDeepStrictEqual } from "node:util";
import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { salvarCliente, salvarCategoria, salvarCategoriaGrupo, salvarGrupo, salvarProduto, salvarGrupoFiscal, excluirCadastroVenda, reordenarCategorias, mensagemErroCadastro } from "@/lib/vendas/persistencia";
import { validarComponentes } from "@/lib/vendas/dominio";
import type { ClienteEntrada, CategoriaEntrada, GrupoEntrada, ProdutoEntrada } from "@/lib/vendas/dominio";
import { mimeFotoVenda } from "@/lib/vendas/foto";
import { prisma } from "@/lib/prisma";
import { reordenarProdutos, alterarSituacaoProduto, alterarPrecoProduto, criarCanalVenda } from "@/lib/vendas/persistencia";
import type { ReferenciaOrdem } from "@/lib/vendas/ordem";
import { alterarStatusCadastroVenda } from "@/lib/vendas/persistencia";
import { RECURSOS_STATUS_VENDA, type TipoStatusVenda } from "@/lib/vendas/status-cadastro";
import { validarClienteCadastro } from "@/lib/vendas/cliente-pedido";

function atualizarCadastrosFiscais() {
  revalidatePath("/financeiro/fiscal/grupos");
  revalidatePath("/financeiro/fiscal/vinculos");
}

export async function alterarStatusCadastroVendaAction(tipo: TipoStatusVenda, id: string, versao: number, ativo: boolean) {
  if (!Object.hasOwn(RECURSOS_STATUS_VENDA, tipo)) return { erro: "Tipo de cadastro inválido." };
  const autor = await exigirPermissao(RECURSOS_STATUS_VENDA[tipo], "editar");
  try { const salvo = await alterarStatusCadastroVenda(tipo, id, versao, ativo, autor); revalidatePath("/vendas", "layout"); if (["PRODUTO", "CATEGORIA", "GRUPO_FISCAL"].includes(tipo)) atualizarCadastrosFiscais(); return { ok: true as const, ...salvo }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}

export async function enviarFotoProdutoVendaAction(formulario: FormData) {
  const autor = await exigirPermissao("vendas.produtos", formulario?.get?.("produtoId") ? "editar" : "adicionar");
  const arquivo = formulario.get("foto");
  if (!(arquivo instanceof File) || arquivo.size > 2 * 1024 * 1024) return { erro: "Envie uma imagem JPG, PNG ou WebP de até 2 MB." };
  const dados = new Uint8Array(await arquivo.arrayBuffer()); const mime = mimeFotoVenda(dados);
  if (!mime) return { erro: "Formato de imagem inválido. Utilize JPG, PNG ou WebP." };
  try {
    const foto = await prisma.fotoProdutoVenda.create({ data: { dados, mime, criadoPorId: autor.userId }, select: { id: true } });
    return { ok: true as const, url: `/api/vendas/fotos/${foto.id}` };
  } catch { return { erro: "Não foi possível enviar a foto. Tente novamente." }; }
}

export async function salvarClienteVendaAction(entrada: ClienteEntrada) {
  const autor = await exigirPermissao("vendas.clientes", entrada?.id ? "editar" : "adicionar");
  try { const id = await salvarCliente(validarClienteCadastro(entrada), autor); revalidatePath("/vendas", "layout"); return { ok: true as const, id }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function salvarCategoriaVendaAction(entrada: CategoriaEntrada) {
  const autor = await exigirPermissao("vendas.catalogo", entrada?.id ? "editar" : "adicionar");
  try { const id = await salvarCategoria(entrada, autor); const registro = await prisma.categoriaVenda.findUniqueOrThrow({ where: { id }, include: { produtos: { select: { produtoId: true, ordem: true } } } }); revalidatePath("/vendas", "layout"); atualizarCadastrosFiscais(); return { ok: true as const, id, registro: { ...registro, escopo: registro.escopo as NonNullable<CategoriaEntrada["escopo"]>, cor: registro.cor as NonNullable<CategoriaEntrada["cor"]> } }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function salvarCategoriaGrupoVendaAction(entrada: CategoriaEntrada) {
  const autor = await exigirPermissao("vendas.catalogo", entrada?.id ? "editar" : "adicionar");
  try { const id = await salvarCategoriaGrupo(entrada, autor); const registro = await prisma.categoriaGrupoComplementoVenda.findUniqueOrThrow({ where: { id } }); revalidatePath("/vendas", "layout"); return { ok: true as const, id, registro }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function reordenarCategoriasVendaAction(ids: ReferenciaOrdem[], escopo = "PRODUTO") {
  const autor = await exigirPermissao("vendas.catalogo", "editar");
  try { await reordenarCategorias(ids, autor, escopo); revalidatePath("/vendas", "layout"); return { ok: true as const }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function reordenarProdutosVendaAction(categoriaId: string, itens: ReferenciaOrdem[]) {
  const autor = await exigirPermissao("vendas.catalogo", "editar");
  try { await reordenarProdutos(categoriaId, itens, autor); revalidatePath("/vendas", "layout"); return { ok: true as const }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function salvarGrupoVendaAction(entrada: GrupoEntrada) {
  const autor = await exigirPermissao("vendas.catalogo", entrada?.id ? "editar" : "adicionar");
  try {
    const id = await salvarGrupo(entrada, autor);
    const g = await prisma.grupoComplementoVenda.findUniqueOrThrow({ where: { id }, include: { opcoes: { orderBy: [{ ordem: "asc" }, { id: "asc" }] }, produtos: { select: { produtoId: true } } } });
    const registro = { ...g, tipo: g.tipo as GrupoEntrada["tipo"], opcoes: g.opcoes.map(o => ({ ...o, preco: o.preco.toString(), quantidade: o.quantidade.toString(), composicao: o.composicao == null ? null : validarComponentes(o.composicao) })), produtos: g.produtos.map(p => p.produtoId) };
    revalidatePath("/vendas", "layout"); return { ok: true as const, id, registro };
  }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function salvarProdutoVendaAction(entrada: ProdutoEntrada) {
  const autor = await exigirPermissao("vendas.produtos", entrada?.id ? "editar" : "adicionar");
  if (entrada?.novoVinculoComplemento || entrada?.pausasComplementos?.length) await exigirPermissao("vendas.catalogo", "editar");
  if (entrada?.salvarFiscal) { await exigirPermissao("vendas.fiscal", "editar"); return { erro: "Salve e aplique a configuração na própria aba Fiscal. O salvamento comercial não altera parâmetros fiscais." }; }
  try { const id = await salvarProduto(entrada, autor, entrada?.salvarFiscal ? { fiscal: entrada.fiscal, revisado: entrada.fiscalRevisado === true, grupoFiscalId: entrada.grupoFiscalId ?? null } : undefined); revalidatePath("/vendas", "layout"); atualizarCadastrosFiscais(); return { ok: true as const, id }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
/** Compatibilidade: a ficha antiga não escreve mais parâmetros paralelos. */
export async function salvarFiscalVendaAction(id: string, versao: number, entrada: unknown, revisado: boolean, grupoFiscalId: string | null = null): Promise<{ ok: true; versao: number; erro?: never } | { erro: string }> {
  await exigirPermissao("vendas.fiscal", "editar");
  void id; void versao; void entrada; void revisado; void grupoFiscalId;
  return { erro: "O cadastro fiscal foi unificado. Abra Produtos → Fiscal ou Financeiro → Fiscal → Vínculos para salvar e aplicar a configuração usada na emissão." };
}

export async function salvarGrupoFiscalVendaAction(entrada: { id: string; versao: number; nome: string; fiscal: unknown; ativo: boolean; atualizarVinculados?: boolean }) {
  const autor = await exigirPermissao("vendas.fiscal", "editar");
  try { const anterior = entrada.id ? await prisma.grupoFiscalVenda.findUniqueOrThrow({ where: { id: entrada.id }, select: { fiscal: true } }) : null; if (entrada.atualizarVinculados || !isDeepStrictEqual(entrada.fiscal, anterior?.fiscal ?? {})) return { erro: "Os parâmetros fiscais foram unificados. Edite as regras por operação na própria tela do grupo; este formulário altera somente sua identificação." }; const id = await salvarGrupoFiscal({ ...entrada, fiscal: anterior?.fiscal ?? {}, atualizarVinculados: false }, autor); revalidatePath("/vendas", "layout"); atualizarCadastrosFiscais(); return { ok: true as const, id }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function alterarSituacaoProdutoVendaAction(id: string, versao: number, ativo: boolean) {
  const autor = await exigirPermissao("vendas.produtos", "editar");
  try { const salvo = await alterarSituacaoProduto(id, versao, ativo, autor); revalidatePath("/vendas", "layout"); atualizarCadastrosFiscais(); return { ok: true as const, ...salvo }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function alterarPrecoProdutoVendaAction(id: string, versao: number, preco: string) {
  const autor = await exigirPermissao("vendas.produtos", "editar");
  try { const salvo = await alterarPrecoProduto(id, versao, preco, autor); revalidatePath("/vendas", "layout"); return { ok: true as const, ...salvo }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function criarCanalVendaAction(nome: string) {
  const autor = await exigirPermissao("vendas.produtos", "editar");
  try { const registro = await criarCanalVenda(nome, autor); revalidatePath("/vendas", "layout"); return { ok: true as const, registro }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
export async function excluirCadastroVendaAction(tipo: "PRODUTO" | "CATEGORIA" | "GRUPO" | "CATEGORIA_GRUPO" | "GRUPO_FISCAL", id: string, versao: number) {
  const recurso = tipo === "PRODUTO" ? "vendas.produtos" : tipo === "GRUPO_FISCAL" ? "vendas.fiscal" : "vendas.catalogo";
  const autor = await exigirPermissao(recurso, "excluir");
  try { await excluirCadastroVenda(tipo,id,versao,autor); revalidatePath("/vendas", "layout"); if (["PRODUTO", "CATEGORIA", "GRUPO_FISCAL"].includes(tipo)) atualizarCadastrosFiscais(); return { ok: true as const }; }
  catch (erro) { return { erro: mensagemErroCadastro(erro) }; }
}
