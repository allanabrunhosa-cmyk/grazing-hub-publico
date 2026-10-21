import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { resolverTema } from "./resolver-tema";
import { validarValoresTema, validarPublicacaoTema } from "./validacao";
import type { DadosCentralDesign, EventoDesignTela, RascunhoDesignTela, VersaoDesignTela } from "./tipos";
import type { ValoresTemaParciais, ValoresTemaResolvidos } from "./registro";

const LOJA_ID = "singleton";
const SCHEMA_VERSAO_DESIGN = 2;
const LIMITE_MOTIVO = 500;

type Transacao = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export class ErroDesign extends Error {}

async function exigirAutorAdministrador(tx: Transacao, autorId: string) {
  const autor = await tx.usuario.findUnique({ where: { id: autorId }, select: { perfilAcesso: { select: { sistema: true } }, ativo: true, excluidoEm: true } });
  if (autor?.perfilAcesso?.sistema !== "ADMINISTRADOR" || !autor.ativo || autor.excluidoEm) throw new ErroDesign("Seu acesso não permite alterar a Central de Design.");
}

function schemaCompativel(schema: number) {
  if (!Number.isInteger(schema) || schema < 1 || schema > SCHEMA_VERSAO_DESIGN) throw new ErroDesign("Esta versão visual exige outra versão do aplicativo.");
}

function temaPublicavel(valores: unknown) {
  try { return validarPublicacaoTema(valores); }
  catch (erro) { throw new ErroDesign(erro instanceof Error ? erro.message : "Tema inválido."); }
}

function comoJson(valor: unknown) {
  return valor as Prisma.InputJsonValue;
}

function textoValido(valor: unknown, minimo: number, maximo: number) {
  if (typeof valor !== "string") throw new ErroDesign("Informe um motivo da alteração.");
  const texto = valor.trim().replace(/\s+/g, " ");
  if (texto.length < minimo || texto.length > maximo) throw new ErroDesign(`Informe um motivo entre ${minimo} e ${maximo} caracteres.`);
  return texto;
}

function chaveIdempotenciaValida(valor: unknown) {
  if (typeof valor !== "string" || !/^[a-zA-Z0-9-]{20,120}$/.test(valor)) throw new ErroDesign("Não foi possível confirmar esta publicação. Atualize a página e tente novamente.");
  return valor;
}

function valoresParciais(valor: unknown): ValoresTemaParciais {
  try { return validarValoresTema(valor); }
  catch { throw new ErroDesign("Os valores visuais deste rascunho não são compatíveis com a versão atual do sistema."); }
}

function valoresResolvidos(valor: unknown): ValoresTemaResolvidos {
  try { return resolverTema(valor); }
  catch { throw new ErroDesign("Esta versão visual não é compatível com a versão atual do sistema."); }
}

function rascunhoParaTela(rascunho: { valores: Prisma.JsonValue; revisao: number; versaoBase: number; autor: { nome: string }; updatedAt: Date }): RascunhoDesignTela {
  return { valores: valoresParciais(rascunho.valores), revisao: rascunho.revisao, versaoBase: rascunho.versaoBase, autor: rascunho.autor.nome, atualizadoEm: rascunho.updatedAt.toISOString() };
}

function versaoParaTela(versao: { id: string; numero: number; schemaVersao: number; tipo: "PUBLICACAO" | "RESTAURACAO"; motivo: string; valores: Prisma.JsonValue; autor: { nome: string }; versaoOrigem: { numero: number } | null; createdAt: Date }): VersaoDesignTela {
  schemaCompativel(versao.schemaVersao);
  return { id: versao.id, numero: versao.numero, tipo: versao.tipo, motivo: versao.motivo, valores: valoresResolvidos(versao.valores), autor: versao.autor.nome, versaoOrigemNumero: versao.versaoOrigem?.numero ?? null, criadaEm: versao.createdAt.toISOString() };
}

function eventoParaTela(evento: { id: string; acao: "RASCUNHO_SALVO" | "PUBLICADO" | "RESTAURADO"; autor: { nome: string }; createdAt: Date }): EventoDesignTela {
  return { id: evento.id, acao: evento.acao, autor: evento.autor.nome, criadoEm: evento.createdAt.toISOString() };
}

async function garantirConfiguracao(tx: Transacao) {
  await tx.configuracaoLoja.upsert({ where: { id: LOJA_ID }, create: { id: LOJA_ID }, update: {} });
  return tx.configuracaoDesign.upsert({ where: { lojaId: LOJA_ID }, create: { id: LOJA_ID, lojaId: LOJA_ID }, update: {} });
}

export async function obterTemaPublicado() {
  try {
    const configuracao = await prisma.configuracaoDesign.findUnique({ where: { lojaId: LOJA_ID }, include: { versaoPublicada: { select: { valores: true, schemaVersao: true } } } });
    if (!configuracao?.versaoPublicada) return { revisao: 0, valores: resolverTema() };
    schemaCompativel(configuracao.versaoPublicada.schemaVersao);
    return { revisao: configuracao.revisaoPublicada, valores: valoresResolvidos(configuracao.versaoPublicada.valores) };
  }
  catch { return { revisao: 0, valores: resolverTema() }; }
}

export async function obterDadosCentralDesign(): Promise<DadosCentralDesign> {
  const configuracao = await prisma.configuracaoDesign.findUnique({ where: { lojaId: LOJA_ID }, include: {
    versaoPublicada: { include: { autor: { select: { nome: true } }, versaoOrigem: { select: { numero: true } } } },
    rascunho: { include: { autor: { select: { nome: true } } } },
    versoes: { orderBy: { numero: "desc" }, take: 12, include: { autor: { select: { nome: true } }, versaoOrigem: { select: { numero: true } } } },
    eventos: { orderBy: { createdAt: "desc" }, take: 12, include: { autor: { select: { nome: true } } } },
  } });
  if (!configuracao) return { revisaoPublicada: 0, publicada: null, rascunho: null, versoes: [], eventos: [] };
  return {
    revisaoPublicada: configuracao.revisaoPublicada,
    publicada: configuracao.versaoPublicada ? versaoParaTela(configuracao.versaoPublicada) : null,
    rascunho: configuracao.rascunho ? rascunhoParaTela(configuracao.rascunho) : null,
    versoes: configuracao.versoes.map(versaoParaTela),
    eventos: configuracao.eventos.map(eventoParaTela),
  };
}

export async function salvarRascunhoDesign(input: { valores: unknown; revisao: number; versaoBase: number; autorId: string }) {
  if (!Number.isInteger(input.revisao) || input.revisao < 0) throw new ErroDesign("Este rascunho não pode ser salvo. Atualize a página e tente novamente.");
  const valores = valoresParciais(input.valores);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('configuracao-design'))`;
    await exigirAutorAdministrador(tx, input.autorId);
    const configuracao = await garantirConfiguracao(tx);
    if (input.versaoBase !== configuracao.revisaoPublicada) throw new ErroDesign("A versão operacional mudou. Atualize a página e revise antes de salvar.");
    const publicada = configuracao.versaoPublicadaId ? await tx.versaoDesign.findUniqueOrThrow({ where: { id: configuracao.versaoPublicadaId } }) : null;
    if (publicada) schemaCompativel(publicada.schemaVersao);
    temaPublicavel({ ...valoresResolvidos(publicada?.valores ?? {}), ...valores });
    const atual = await tx.rascunhoDesign.findUnique({ where: { configuracaoId: configuracao.id }, include: { autor: { select: { nome: true } } } });
    if (!atual && input.revisao !== 0) throw new ErroDesign("O rascunho foi removido ou publicado por outra pessoa. Atualize a página.");
    if (atual && atual.revisao !== input.revisao) throw new ErroDesign(`Este rascunho foi atualizado por ${atual.autor.nome}. Atualize a página antes de sobrescrever.`);
    const rascunho = atual
      ? await tx.rascunhoDesign.update({ where: { id: atual.id }, data: { valores: comoJson(valores), versaoBase: input.versaoBase, revisao: { increment: 1 }, autorId: input.autorId }, include: { autor: { select: { nome: true } } } })
      : await tx.rascunhoDesign.create({ data: { configuracaoId: configuracao.id, valores: comoJson(valores), revisao: 1, versaoBase: configuracao.revisaoPublicada, autorId: input.autorId }, include: { autor: { select: { nome: true } } } });
    await tx.eventoDesign.create({ data: { configuracaoId: configuracao.id, acao: "RASCUNHO_SALVO", autorId: input.autorId, revisao: rascunho.revisao, detalhes: comoJson({ campos: Object.keys(valores).sort(), versaoBase: input.versaoBase, antes: atual?.valores ?? {}, depois: valores }) } });
    return rascunhoParaTela(rascunho);
  }, { timeout: 20_000 });
}

type PedidoPublicacao = { chaveIdempotencia: string; motivo: string; autorId: string; tipo: "PUBLICACAO" | "RESTAURACAO"; revisaoRascunho?: number; versaoOrigemId?: string; versaoBase?: number };

async function repeticao(tx: Transacao, pedido: PedidoPublicacao) {
  const existente = await tx.versaoDesign.findUnique({ where: { chaveIdempotencia: pedido.chaveIdempotencia }, include: { autor: { select: { nome: true } }, versaoOrigem: { select: { numero: true } } } });
  if (!existente) return null;
  const evento = await tx.eventoDesign.findFirst({ where: { versaoId: existente.id } });
  const detalhes = evento?.detalhes as Record<string, unknown> | null;
  if (existente.autorId !== pedido.autorId || existente.motivo !== pedido.motivo || existente.tipo !== pedido.tipo
    || (existente.versaoOrigemId ?? undefined) !== pedido.versaoOrigemId
    || (pedido.tipo === "PUBLICACAO" && detalhes?.revisaoRascunho !== pedido.revisaoRascunho)
    || (pedido.tipo === "RESTAURACAO" && detalhes?.versaoBase !== pedido.versaoBase)) throw new ErroDesign("Esta chave já pertence a outro pedido. Atualize e revise a operação.");
  return { versao: versaoParaTela(existente), repetida: true };
}

async function publicar(tx: Transacao, input: PedidoPublicacao & { valores: ValoresTemaResolvidos }) {
  const configuracao = await garantirConfiguracao(tx);
  const numero = configuracao.revisaoPublicada + 1;
  const versao = await tx.versaoDesign.create({ data: { configuracaoId: configuracao.id, numero, valores: comoJson(input.valores), schemaVersao: SCHEMA_VERSAO_DESIGN, tipo: input.tipo, motivo: input.motivo, autorId: input.autorId, versaoOrigemId: input.versaoOrigemId ?? null, chaveIdempotencia: input.chaveIdempotencia }, include: { autor: { select: { nome: true } }, versaoOrigem: { select: { numero: true } } } });
  await tx.configuracaoDesign.update({ where: { id: configuracao.id }, data: { versaoPublicadaId: versao.id, revisaoPublicada: numero } });
  await tx.eventoDesign.create({ data: { configuracaoId: configuracao.id, acao: input.tipo === "PUBLICACAO" ? "PUBLICADO" : "RESTAURADO", autorId: input.autorId, versaoId: versao.id, revisao: numero, detalhes: comoJson({ motivo: input.motivo, origem: input.versaoOrigemId ?? null, versaoBase: configuracao.revisaoPublicada, revisaoRascunho: input.revisaoRascunho ?? null, valores: input.valores }) } });
  return { versao: versaoParaTela(versao), repetida: false };
}

export async function publicarRascunhoDesign(input: { revisao: number; motivo: unknown; chaveIdempotencia: unknown; autorId: string }) {
  if (!Number.isInteger(input.revisao) || input.revisao < 1) throw new ErroDesign("Salve o rascunho antes de publicar.");
  const pedido: PedidoPublicacao = { motivo: textoValido(input.motivo, 5, LIMITE_MOTIVO), chaveIdempotencia: chaveIdempotenciaValida(input.chaveIdempotencia), autorId: input.autorId, tipo: "PUBLICACAO", revisaoRascunho: input.revisao };
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('configuracao-design'))`;
    await exigirAutorAdministrador(tx, input.autorId);
    const repetida = await repeticao(tx, pedido); if (repetida) return repetida;
    const configuracao = await garantirConfiguracao(tx);
    const rascunho = await tx.rascunhoDesign.findUnique({ where: { configuracaoId: configuracao.id } });
    if (!rascunho || rascunho.revisao !== input.revisao) throw new ErroDesign("O rascunho foi alterado por outra pessoa. Atualize a página e revise antes de publicar.");
    if (rascunho.versaoBase !== configuracao.revisaoPublicada) throw new ErroDesign("A versão operacional mudou desde este rascunho. Atualize a página e revise as diferenças antes de publicar.");
    const base = configuracao.versaoPublicadaId ? await tx.versaoDesign.findUniqueOrThrow({ where: { id: configuracao.versaoPublicadaId } }) : null;
    if (base) schemaCompativel(base.schemaVersao);
    const valores = temaPublicavel({ ...valoresResolvidos(base?.valores ?? {}), ...valoresParciais(rascunho.valores) });
    const resultado = await publicar(tx, { ...pedido, valores });
    await tx.rascunhoDesign.delete({ where: { id: rascunho.id } });
    return resultado;
  }, { timeout: 20_000 });
}

export async function restaurarVersaoDesign(input: { versaoId: unknown; versaoBase: number; motivo: unknown; chaveIdempotencia: unknown; autorId: string }) {
  if (typeof input.versaoId !== "string" || input.versaoId.length < 10) throw new ErroDesign("A versão escolhida não é válida.");
  const pedido: PedidoPublicacao = { motivo: textoValido(input.motivo, 5, LIMITE_MOTIVO), chaveIdempotencia: chaveIdempotenciaValida(input.chaveIdempotencia), autorId: input.autorId, tipo: "RESTAURACAO", versaoOrigemId: input.versaoId, versaoBase: input.versaoBase };
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('configuracao-design'))`;
    await exigirAutorAdministrador(tx, input.autorId);
    const repetida = await repeticao(tx, pedido); if (repetida) return repetida;
    const configuracao = await garantirConfiguracao(tx);
    if (input.versaoBase !== configuracao.revisaoPublicada) throw new ErroDesign("A versão operacional mudou. Revise antes de restaurar.");
    const origem = await tx.versaoDesign.findFirst({ where: { id: pedido.versaoOrigemId, configuracaoId: configuracao.id } });
    if (!origem) throw new ErroDesign("A versão escolhida não existe mais.");
    schemaCompativel(origem.schemaVersao);
    return publicar(tx, { ...pedido, valores: temaPublicavel(origem.valores) });
  }, { timeout: 20_000 });
}
