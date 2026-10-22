import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { analisarImpactoFiscalNaTransacao, ativarVersaoFiscalNaTransacao, conferirAutorFiscal, consultarPainelFiscal, consultarVersoesFiscais, hashFiscal, salvarVersaoFiscalNaTransacao } from "./servico";
import { hojeFiscal, ErroEstruturaFiscal, textoFiscal } from "./validacao";
import { compararCadastroFiscal, valoresClassificacao, valoresRegra } from "./ficha";
import { versoesVigentes } from "./motor";
import type { ClassificacaoFiscal, PainelFiscal, RegraFiscal, SalvarVersaoFiscalEntrada } from "./tipos";

export async function consultarFichaFiscal(produtoId: string, sessao: SessaoAtual) {
  textoFiscal(produtoId, "Produto", 100);
  const painel = await consultarPainelFiscal(sessao, { tabelas: false, evidenciasEntrada: false });
  const interno = produtoId.startsWith("INSUMO:");
  const insumo = interno ? await prisma.insumo.findUniqueOrThrow({ where: { id: produtoId.slice(7) }, select: { nome: true, unidade: true } }) : null;
  const produto = insumo ? { id: produtoId, nome: insumo.nome, unidade: insumo.unidade, fiscal: {}, grupoFiscalId: null } : await prisma.produtoVenda.findUniqueOrThrow({ where: { id: produtoId }, select: { id: true, nome: true, unidade: true, fiscal: true, grupoFiscalId: true } });
  const fichaPainel: PainelFiscal = { ...painel, versoes: painel.versoes.filter(v => v.tipo !== "TABELA"), entradas: [] };
  return { painel: fichaPainel, produto: { ...produto, fiscal: produto.fiscal as Record<string, string> }, dia: hojeFiscal() };
}

/** Cada lote contém somente as versões que o usuário editou nesta tela. */
export async function salvarManutencaoFiscal(entradas: SalvarVersaoFiscalEntrada[], sessao: SessaoAtual) {
  if (!Array.isArray(entradas) || !entradas.length || entradas.length > 20) throw new ErroEstruturaFiscal("Selecione de uma a vinte alterações fiscais.");
  if (entradas.some(e => typeof e?.justificativa !== "string" || e.justificativa.trim().length < 15)) throw new ErroEstruturaFiscal("Motivo da alteração: informe pelo menos 15 caracteres.");
  return prisma.$transaction(async tx => {
    await conferirAutorFiscal(tx, sessao, true);
    const ids: string[] = [];
    for (const e of entradas) ids.push((await salvarVersaoFiscalNaTransacao(tx, e, sessao)).id);
    return { ids };
  }, { timeout: 30000 });
}
async function revisar(tx: Prisma.TransactionClient, ids: string[], sessao: SessaoAtual) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 20 || new Set(ids).size !== ids.length) throw new ErroEstruturaFiscal("Seleção de versões inválida.");
  await conferirAutorFiscal(tx, sessao, true);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
  const versoes = await tx.versaoEstruturaFiscal.findMany({ where: { id: { in: ids } }, orderBy: { id: "asc" } });
  if (versoes.length !== ids.length || versoes.some(v => v.status !== "RASCUNHO")) throw new ErroEstruturaFiscal("O rascunho mudou. Atualize a ficha e revise novamente.");
  if (new Set(versoes.map(v => `${v.tipo}:${v.chave}`)).size !== versoes.length) throw new ErroEstruturaFiscal("Selecione somente uma versão por configuração.");
  const impactos = [];
  for (const v of versoes) {
    const ultima = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: v.tipo, chave: v.chave }, orderBy: { versao: "desc" }, select: { id: true } });
    if (ultima?.id !== v.id) throw new ErroEstruturaFiscal("Existe rascunho mais recente. Atualize a ficha.");
    impactos.push({ id: v.id, ...(await analisarImpactoFiscalNaTransacao(tx, v.id, sessao)) });
  }
  return { hash: hashFiscal(impactos.map(i => ({ id: i.id, hash: i.hash }))), impactos };
}
export async function revisarManutencaoFiscal(ids: string[], sessao: SessaoAtual) {
  return prisma.$transaction(tx => revisar(tx, ids, sessao), { timeout: 30000 });
}
export async function aplicarManutencaoFiscal(ids: string[], hash: string, sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    const revisao = await revisar(tx, ids, sessao);
    if (revisao.hash !== hash) throw new ErroEstruturaFiscal("Configuração ou catálogo mudou. Revise o impacto novamente nesta ficha.");
    for (const id of ids) {
      const impacto = await analisarImpactoFiscalNaTransacao(tx, id, sessao);
      await ativarVersaoFiscalNaTransacao(tx, id, impacto.hash, randomUUID(), sessao);
    }
    return { ids };
  }, { timeout: 30000 });
}

/** Simulação de conciliação. Sem UPDATE, migração automática ou escolha tributária. */
export async function simularConciliacaoFiscal(sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    await conferirAutorFiscal(tx, sessao, true);
    const versoes = versoesVigentes(await consultarVersoesFiscais(tx), hojeFiscal());
    const produtos = await tx.produtoVenda.findMany({ select: { id: true, nome: true, grupoFiscalId: true, fiscal: true } });
    const grupos = await tx.grupoFiscalVenda.findMany({ select: { id: true, nome: true, codigo: true, ativo: true } });
    return produtos.map(p => {
      const c = versoes.find(v => v.tipo === "CLASSIFICACAO" && v.chave === p.id)?.dados as ClassificacaoFiscal | undefined;
      const regras = versoes.filter(v => v.tipo === "REGRA" && (v.dados as RegraFiscal).produtoId === p.id);
      return { id: p.id, nome: p.nome, grupoCadastro: grupos.find(g => g.id === p.grupoFiscalId)?.nome ?? null, grupoMotor: grupos.find(g => g.id === c?.grupoFiscalId)?.nome ?? c?.grupo ?? null,
        classificacaoAusente: !c, regras: regras.map(v => ({ id: v.id, chave: v.chave, contexto: `${(v.dados as RegraFiscal).ufDestino} · ${(v.dados as RegraFiscal).destinatario} · ${(v.dados as RegraFiscal).modelo ?? "55/65"}`, diferencas: compararCadastroFiscal(p.fiscal as Record<string, string>, valoresRegra(v.dados as RegraFiscal)) })),
        diferencas: compararCadastroFiscal(p.fiscal as Record<string, string>, valoresClassificacao(c)) };
    });
  }, { timeout: 30000 });
}
