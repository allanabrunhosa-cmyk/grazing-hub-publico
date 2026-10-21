import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import type { ClassificacaoFiscal, SalvarVersaoFiscalEntrada, TabelaFiscal } from "./tipos";
import { analisarImpactoFiscalNaTransacao, ativarVersaoFiscalNaTransacao, conferirAutorFiscal, consultarVersoesFiscais, hashFiscal, salvarVersaoFiscalNaTransacao } from "./servico";
import { dataFiscal, ErroEstruturaFiscal, hojeFiscal, textoFiscal, validarDadosFiscais, validarSalvarVersaoFiscal } from "./validacao";
import { versoesVigentes } from "./motor";

export type LoteClassificacaoFiscal = { loteId: string; vigenciaInicio: string; registros: Omit<SalvarVersaoFiscalEntrada, "chaveOperacao" | "vigenciaInicio">[] };
export type PlanoClassificacaoFiscal = { loteId: string; data: string; hashPlano: string; hashEntrada: string; registros: SalvarVersaoFiscalEntrada[]; resumo: { classificacoes: number; referenciasInternas: number; complementos: number; tabelas: number; ncmNaoAplicavel: number; ncmPendente: number } };
export type ResultadoLoteFiscal = { plano: PlanoClassificacaoFiscal; aplicado: boolean; aplicadoAnteriormente: boolean; versoes: { id: string; tipo: string; chave: string; hash: string }[] };
class PreviaRevertida extends Error { constructor(readonly resultado: ResultadoLoteFiscal) { super("Prévia integral revertida."); } }

export function validarLoteClassificacaoFiscal(entrada: unknown): { lote: LoteClassificacaoFiscal; registros: SalvarVersaoFiscalEntrada[]; hashEntrada: string } {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) throw new ErroEstruturaFiscal("Lote fiscal inválido.");
  const e = entrada as LoteClassificacaoFiscal;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(e.loteId ?? "") || !Array.isArray(e.registros) || !e.registros.length || e.registros.length > 1000) throw new ErroEstruturaFiscal("Identidade ou tamanho do lote fiscal inválido.");
  const vigenciaInicio = dataFiscal(e.vigenciaInicio);
  if (vigenciaInicio < hojeFiscal()) throw new ErroEstruturaFiscal("Lote fiscal exige vigência prospectiva.");
  const registros = e.registros.map((r, i) => {
    if (!["CLASSIFICACAO", "COMPLEMENTO", "TABELA"].includes(r.tipo)) throw new ErroEstruturaFiscal("Lote de catálogo não altera perfil ou regras tributárias.");
    const d = validarSalvarVersaoFiscal({ ...r, vigenciaInicio, chaveOperacao: `validacao-lote-${i}` });
    if (d.tipo === "TABELA" && (d.dados as TabelaFiscal).tabela !== "NCM") throw new ErroEstruturaFiscal("Lote de catálogo admite somente tabela NCM oficial.");
    if (d.tipo === "CLASSIFICACAO" && (!(d.dados as ClassificacaoFiscal).analiseNcm || !(d.dados as ClassificacaoFiscal).ncmAplicabilidade)) throw new ErroEstruturaFiscal("Classificação do lote exige aplicabilidade e análise NCM rastreáveis.");
    return d;
  });
  if (new Set(registros.map(r => `${r.tipo}:${r.chave}`)).size !== registros.length) throw new ErroEstruturaFiscal("Lote contém identidades fiscais repetidas.");
  registros.sort((a, b) => {
    const ordem = (r: SalvarVersaoFiscalEntrada) => r.tipo === "TABELA" ? 0 : r.tipo === "COMPLEMENTO" ? "escolhas" in (r.dados as object) ? 2 : 1 : (r.dados as ClassificacaoFiscal).tratamento === "KIT_COMPOSTO" ? 4 : 3;
    return ordem(a) - ordem(b) || a.chave.localeCompare(b.chave);
  });
  const hashEntrada = hashFiscal({ loteId: e.loteId, vigenciaInicio, registros: registros.map(r => ({ tipo: r.tipo, chave: r.chave, versaoBase: r.versaoBase, vigenciaInicio: r.vigenciaInicio, dados: r.dados, justificativa: r.justificativa, fontes: r.fontes })) });
  registros.forEach((r, i) => { r.chaveOperacao = `catalogo-${hashEntrada}-${i}`; });
  return { lote: { loteId: e.loteId, vigenciaInicio, registros: e.registros }, registros, hashEntrada };
}

/** Texto PostgreSQL preserva precisão JSONB desconhecida no controle de concorrência. */
async function fotografiaCatalogo(tx: Prisma.TransactionClient) {
  const tabelas = ["ProdutoVenda", "ComponenteProdutoVenda", "ProdutoGrupoVenda", "GrupoComplementoVenda", "OpcaoComplementoVenda", "Insumo", "ComposicaoInsumo", "GrupoFiscalVenda", "VersaoEstruturaFiscal"] as const;
  const partes: { tabela: string; hash: string }[] = [];
  for (const tabela of tabelas) {
    const expressao = tabela === "Insumo" ? Prisma.raw("(to_jsonb(t) - 'fotoData' - 'fotoMimeType')") : Prisma.raw("to_jsonb(t)");
    const rows = await tx.$queryRaw<{ linha: string }[]>(Prisma.sql`SELECT ${expressao}::text AS linha FROM ${Prisma.raw(`"${tabela}"`)} t ORDER BY ${expressao}::text`);
    partes.push({ tabela, hash: hashFiscal(rows) });
  }
  return hashFiscal(partes);
}
function planoLote(loteId: string, hashEntrada: string, registros: SalvarVersaoFiscalEntrada[], antes: string): PlanoClassificacaoFiscal {
  const classificacoes = registros.filter(r => r.tipo === "CLASSIFICACAO").map(r => r.dados as ClassificacaoFiscal);
  return { loteId, data: hojeFiscal(), hashEntrada, hashPlano: hashFiscal({ hashEntrada, antes }), registros, resumo: { classificacoes: classificacoes.length, referenciasInternas: classificacoes.filter(c => !!c.referenciaInternaInsumoId).length, complementos: registros.filter(r => r.tipo === "COMPLEMENTO").length, tabelas: registros.filter(r => r.tipo === "TABELA").length, ncmNaoAplicavel: classificacoes.filter(c => c.ncmAplicabilidade === "NAO_APLICAVEL").length, ncmPendente: classificacoes.filter(c => c.analiseNcm?.confianca === "BAIXA" || c.configuracaoNcm?.cenarios.some(s => s.analiseNcm.confianca === "BAIXA")).length } };
}

/** Toda escrita usa exatamente os serviços da interface, inclusive análise, autorização e sincronização. */
export async function executarLoteClassificacaoFiscalNaTransacao(tx: Prisma.TransactionClient, entrada: unknown, tabelaOficial: TabelaFiscal, sessao: SessaoAtual, aplicar: boolean, hashEsperado?: string): Promise<ResultadoLoteFiscal> {
  const { lote, registros, hashEntrada: hashRegistros } = validarLoteClassificacaoFiscal(entrada);
  const oficial = validarDadosFiscais("TABELA", tabelaOficial) as TabelaFiscal;
  if (oficial.tabela !== "NCM" || !oficial.completa || !oficial.linhas.length) throw new ErroEstruturaFiscal("Tabela NCM oficial integral e vigente é obrigatória para conferir o lote.");
  const hashEntrada = hashFiscal({ hashRegistros, tabelaOficial: hashFiscal(oficial) });
  registros.forEach((r, i) => { r.chaveOperacao = `catalogo-${hashEntrada}-${i}`; });
  const autor = await conferirAutorFiscal(tx, sessao, true);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
  await tx.$queryRaw`SELECT id FROM "Insumo" FOR SHARE`;
  const chaveRecibo = `catalogo-lote-${hashFiscal(lote.loteId)}`;
  const anterior = await tx.eventoEstruturaFiscal.findUnique({ where: { chaveOperacao: chaveRecibo } });
  const estadoAntes = await fotografiaCatalogo(tx);
  const plano = planoLote(lote.loteId, hashEntrada, registros, estadoAntes);
  if (anterior) {
    const recibo = anterior.dados as { hashEntrada?: string; hashPlano?: string; estadoDepois?: string; versoes?: ResultadoLoteFiscal["versoes"]; plano?: PlanoClassificacaoFiscal };
    if (anterior.usuarioId !== autor.userId || recibo.hashEntrada !== hashEntrada || !recibo.plano || !recibo.versoes?.length || recibo.estadoDepois !== estadoAntes || aplicar && hashEsperado !== recibo.hashPlano) throw new ErroEstruturaFiscal("Lote já utilizado com conteúdo, autoria ou estado atual divergente; preparar revisão prospectiva distinta.");
    return { plano: recibo.plano, aplicado: false, aplicadoAnteriormente: true, versoes: recibo.versoes };
  }
  if (aplicar && (!/^[a-f0-9]{64}$/.test(hashEsperado ?? "") || hashEsperado !== plano.hashPlano)) throw new ErroEstruturaFiscal("Catálogo ou versões mudaram; refazer a prévia e conferir seu hash antes de aplicar.");
  const existentes = versoesVigentes(await consultarVersoesFiscais(tx, ["CLASSIFICACAO"]), lote.vigenciaInicio);
  const codigos = new Set(oficial.linhas.map(l => l.codigo));
  for (const r of registros) {
    if (r.tipo === "TABELA" && hashFiscal(r.dados) !== hashFiscal(oficial)) throw new ErroEstruturaFiscal("Tabela NCM do lote diverge do arquivo oficial vigente fornecido.");
    if (r.tipo !== "CLASSIFICACAO") continue;
    const c = r.dados as ClassificacaoFiscal;
    const ncm = [c.ncm, ...(c.configuracaoNcm?.cenarios.map(s => s.ncm) ?? [])].filter((n): n is string => !!n);
    if (ncm.some(n => !codigos.has(n))) throw new ErroEstruturaFiscal("NCM de classificação ou cenário não pertence à tabela oficial vigente.");
    if (c.produtoId && !await tx.produtoVenda.count({ where: { id: c.produtoId, ativo: true } })) throw new ErroEstruturaFiscal("Lote contém produto comercial inexistente ou inativo; não reativar automaticamente.");
    const antiga = existentes.find(v => v.tipo === "CLASSIFICACAO" && v.chave === r.chave)?.dados as ClassificacaoFiscal | undefined;
    if (antiga?.estado === "CONFIRMADO" && antiga.ncm && c.ncmAplicabilidade === "APLICAVEL" && !c.configuracaoNcm && c.ncm !== antiga.ncm) throw new ErroEstruturaFiscal("Lote não substitui NCM anteriormente confirmado; correção individual exige revisão própria fundamentada.");
  }
  const versoes: ResultadoLoteFiscal["versoes"] = [];
  for (const r of registros) {
    const v = await salvarVersaoFiscalNaTransacao(tx, r, sessao);
    const impacto = await analisarImpactoFiscalNaTransacao(tx, v.id, sessao);
    await ativarVersaoFiscalNaTransacao(tx, v.id, impacto.hash, `catalogo-ativar-${hashEntrada}-${versoes.length}`, sessao);
    const gravada = await tx.versaoEstruturaFiscal.findUniqueOrThrow({ where: { id: v.id }, select: { id: true, tipo: true, chave: true, hash: true } }); versoes.push(gravada);
  }
  const tabelaVigente = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo: "TABELA", chave: "NCM", status: "ATIVO", vigenciaInicio: { lte: new Date(`${lote.vigenciaInicio}T00:00:00Z`) } }, orderBy: [{ vigenciaInicio: "desc" }, { versao: "desc" }] });
  const vigente = tabelaVigente?.dados as TabelaFiscal | undefined, codigosVigentes = new Set(vigente?.linhas.map(n => n.codigo));
  if (!vigente?.completa || codigosVigentes.size !== codigos.size || oficial.linhas.some(n => !codigosVigentes.has(n.codigo))) throw new ErroEstruturaFiscal("Tabela NCM integral vigente deve estar ativada no HUB; incluir a tabela oficial no mesmo lote quando necessário.");
  const estadoDepois = await fotografiaCatalogo(tx);
  await tx.eventoEstruturaFiscal.create({ data: { versaoId: versoes[0].id, tipo: "IMPACTO", chaveOperacao: chaveRecibo, usuarioId: autor.userId, usuarioNome: autor.nome, dados: JSON.parse(JSON.stringify({ loteId: lote.loteId, hashEntrada, hashPlano: plano.hashPlano, estadoDepois, versoes, plano })) as Prisma.InputJsonValue } });
  if (hojeFiscal() !== plano.data) throw new ErroEstruturaFiscal("Data fiscal mudou durante o lote; transação integral revertida.");
  return { plano, aplicado: aplicar, aplicadoAnteriormente: false, versoes };
}

export async function preverLoteClassificacaoFiscal(entrada: unknown, tabela: TabelaFiscal, sessao: SessaoAtual, cliente: PrismaClient = prisma): Promise<ResultadoLoteFiscal> {
  try { return await cliente.$transaction(async tx => { const r = await executarLoteClassificacaoFiscalNaTransacao(tx, entrada, tabela, sessao, false); throw new PreviaRevertida(r); }, { timeout: 180000 }); }
  catch (e) { if (e instanceof PreviaRevertida) return e.resultado; throw e; }
}
export async function aplicarLoteClassificacaoFiscal(entrada: unknown, tabela: TabelaFiscal, sessao: SessaoAtual, hashEsperado: string, cliente: PrismaClient = prisma) {
  textoFiscal(hashEsperado, "Hash do plano", 64);
  return cliente.$transaction(tx => executarLoteClassificacaoFiscalNaTransacao(tx, entrada, tabela, sessao, true, hashEsperado), { timeout: 180000 });
}
