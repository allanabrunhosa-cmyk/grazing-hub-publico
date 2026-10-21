import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { historico, salvarFiscalProdutoNaTransacao, salvarGrupoFiscalNaTransacao } from "@/lib/vendas/persistencia";
import { mesclarFiscalGrupoJsonb } from "@/lib/vendas/fiscal-jsonb";
import { herdarParametrosFiscais } from "./heranca";
import { GRUPOS_OPERACIONAIS, type GrupoOperacional } from "./grupos-operacionais";
import { ativarVersaoFiscalNaTransacao, analisarImpactoFiscalNaTransacao, conferirAutorFiscal, consultarVersoesFiscais, hashFiscal, salvarVersaoFiscalNaTransacao } from "./servico";
import { versoesVigentes } from "./motor";
import { ErroEstruturaFiscal, hojeFiscal } from "./validacao";
import type { ClassificacaoFiscal } from "./tipos";

export type LoteGruposOperacionais = {
  politicaGrupos: "QUATRO_GRUPOS"; loteId: string; vigenciaInicio: string;
  referencias: Record<GrupoOperacional, { id: string; versao: number }>;
  produtos: { id: string; versao: number; grupo: GrupoOperacional }[];
};
const falhar = (m: string): never => { throw new ErroEstruturaFiscal(m); };
export function validarLoteGruposOperacionais(e: unknown): LoteGruposOperacionais {
  if (!e || typeof e !== "object" || Array.isArray(e)) falhar("Lote de grupos inválido.");
  const r = e as LoteGruposOperacionais;
  if (Object.keys(r).some(k => !["politicaGrupos", "loteId", "vigenciaInicio", "referencias", "produtos"].includes(k)) || r.politicaGrupos !== "QUATRO_GRUPOS" || !/^[A-Za-z0-9_-]{1,80}$/.test(r.loteId ?? "") || r.vigenciaInicio !== hojeFiscal()) falhar("Identidade, política ou vigência inválida.");
  const referencia = (v: { id: string; versao: number }) => v && typeof v.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v.id) && Number.isSafeInteger(v.versao) && v.versao > 0;
  if (!r.referencias || Object.keys(r.referencias).length !== 4 || !Object.keys(GRUPOS_OPERACIONAIS).every(k => referencia(r.referencias[k as GrupoOperacional]))) falhar("Informe as quatro referências e suas revisões.");
  if (!Array.isArray(r.produtos) || !r.produtos.length || r.produtos.length > 10000 || r.produtos.some(p => !referencia(p) || !Object.hasOwn(GRUPOS_OPERACIONAIS, p.grupo)) || new Set(r.produtos.map(p => p.id)).size !== r.produtos.length) falhar("Produtos ou grupos inválidos/duplicados.");
  return r;
}
type Tx = Prisma.TransactionClient;
async function fotografia(tx: Tx) {
  const produtos = await tx.$queryRaw`SELECT id,versao,"grupoFiscalId",fiscal::text FROM "ProdutoVenda" ORDER BY id`;
  const grupos = await tx.$queryRaw`SELECT id,versao,nome,ativo,fiscal::text FROM "GrupoFiscalVenda" ORDER BY id`;
  const versoes = await consultarVersoesFiscais(tx);
  return { produtos, grupos, versoes };
}
async function assinaturaNcm(tx: Tx) {
  return (await tx.$queryRaw<{ hash: string }[]>`SELECT md5(jsonb_agg(jsonb_build_array(id,fiscal ? 'ncm',fiscal->'ncm') ORDER BY id)::text) AS hash FROM "ProdutoVenda"`)[0].hash;
}
async function executar(tx: Tx, e: LoteGruposOperacionais, sessao: SessaoAtual, esperado?: string) {
  const autor = await conferirAutorFiscal(tx, sessao, true);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
  const antes = await fotografia(tx), hashEntrada = hashFiscal(e), estadoAntes = hashFiscal(antes);
  const ncmAntes = await assinaturaNcm(tx);
  const recibo = await tx.historicoCadastroVenda.findFirst({ where: { entidade: "FISCAL", registroId: e.loteId, depois: { path: ["tipo"], equals: "GRUPOS_OPERACIONAIS" } } });
  if (recibo) {
    const r = recibo.depois as { hashEntrada: string; estadoDepois: string; hashPlano: string };
    if (recibo.usuarioId !== autor.userId || r.hashEntrada !== hashEntrada || r.estadoDepois !== estadoAntes || esperado && esperado !== r.hashPlano) falhar("Lote já usado com conteúdo ou estado divergente.");
    return { hashPlano: r.hashPlano, aplicadoAnteriormente: true, produtos: 0, grupos: 4, classificacoesGtin: 0 };
  }
  const hashPlano = hashFiscal({ hashEntrada, estadoAntes });
  if (esperado && esperado !== hashPlano) falhar("Cadastros mudaram. Refaça a simulação.");
  const produtos = await tx.produtoVenda.findMany({ orderBy: { id: "asc" } });
  if (produtos.length !== e.produtos.length || produtos.some(p => e.produtos.find(v => v.id === p.id)?.versao !== p.versao)) falhar("O lote deve conter todos os produtos, inclusive inativos, nas revisões atuais.");
  const vigentes = versoesVigentes(antes.versoes, e.vigenciaInicio);
  const gruposAntes = await tx.grupoFiscalVenda.findMany();
  const destinos = {} as Record<GrupoOperacional, string>, modelos = {} as Record<GrupoOperacional, Record<string, string>>;
  const codigos = { PREPARACOES: "GF01", VINHOS: "GF10", CERVEJAS: "GF09", DESTILADOS: null };
  for (const chave of Object.keys(GRUPOS_OPERACIONAIS) as GrupoOperacional[]) {
    const ref = produtos.find(p => p.id === e.referencias[chave].id) ?? falhar("Referência inexistente.");
    if (!ref.ativo || ref.versao !== e.referencias[chave].versao || e.produtos.find(p => p.id === ref.id)?.grupo !== chave) falhar("Referência mudou ou não pertence ao destino indicado.");
    const f = ref.fiscal as Record<string, string>;
    if (!["origem", "cfop", "csosn", "pis", "cofins", "unidadeTributavel"].every(k => f[k])) falhar("Referência fiscal incompleta.");
    const grupo = gruposAntes.find(g => (g.fiscal as Record<string, unknown>).grupoOperacional === chave) ?? (codigos[chave] ? gruposAntes.find(g => g.codigo === codigos[chave]) : undefined);
    const modelo = { ...(grupo?.fiscal as Record<string, string> ?? {}), ...Object.fromEntries(["origem", "cfop", "csosn", "pis", "cofins", "unidadeTributavel"].map(k => [k, f[k]])), ean: "SEM GTIN" };
    const id = await salvarGrupoFiscalNaTransacao(tx, { id: grupo?.id ?? "", versao: grupo?.versao ?? 0, nome: GRUPOS_OPERACIONAIS[chave], ativo: true, fiscal: modelo, atualizarVinculados: false }, autor);
    await mesclarFiscalGrupoJsonb(tx, id, { grupoOperacional: chave, referenciaProdutoId: ref.id, referenciaProdutoVersao: ref.versao, declaracaoSemGtin: e.loteId });
    destinos[chave] = id; modelos[chave] = modelo;
  }
  // Primeiro fixa os destinos. Ativações técnicas posteriores não restauram os 12 vínculos.
  for (const p of produtos) {
    const destino = e.produtos.find(v => v.id === p.id)!.grupo;
    const f = herdarParametrosFiscais(modelos[destino], p.fiscal as Record<string, string>);
    f.ean = "SEM GTIN";
    await salvarFiscalProdutoNaTransacao(tx, p.id, p.versao, f, p.fiscalRevisado, autor, destinos[destino], { preservarNcm: true });
  }
  for (const g of gruposAntes.filter(g => !Object.values(destinos).includes(g.id))) {
    await salvarGrupoFiscalNaTransacao(tx, { id: g.id, versao: g.versao, nome: g.nome, ativo: false, fiscal: g.fiscal, atualizarVinculados: false }, autor);
    await mesclarFiscalGrupoJsonb(tx, g.id, { arquivoOperacional: "QUATRO_GRUPOS", grupoFiscalSucessorId: destinos.PREPARACOES });
  }
  let classificacoesGtin = 0;
  for (const base of vigentes.filter(v => v.tipo === "CLASSIFICACAO" && produtos.some(p => p.id === v.chave))) {
    const c = base.dados as ClassificacaoFiscal;
    if (c.ncmAplicabilidade === "NAO_APLICAVEL" || c.natureza === "SERVICO" || c.gtin === "SEM GTIN") continue;
    const ultima = antes.versoes.filter(v => v.tipo === base.tipo && v.chave === base.chave).sort((a,b) => b.versao-a.versao)[0];
    const dados = { ...structuredClone(c), gtin: "SEM GTIN" };
    const v = await salvarVersaoFiscalNaTransacao(tx, { tipo: "CLASSIFICACAO", chave: base.chave, versaoBase: ultima.versao, vigenciaInicio: e.vigenciaInicio, dados, justificativa: "Apresentação final sem GTIN por declaração expressa do responsável em 21/10/2026. Preserva NCM, origem, composição e regras individuais.", fontes: [...base.fontes, `instrucao-responsavel:${e.loteId}`], chaveOperacao: `${e.loteId}-gtin-${classificacoesGtin}` }, sessao);
    const impacto = await analisarImpactoFiscalNaTransacao(tx, v.id, sessao);
    await ativarVersaoFiscalNaTransacao(tx, v.id, impacto.hash, `${e.loteId}-ativar-${classificacoesGtin}`, sessao);
    classificacoesGtin++;
  }
  if (hojeFiscal() !== e.vigenciaInicio) falhar("A data fiscal mudou. Lote revertido.");
  if (await assinaturaNcm(tx) !== ncmAntes) falhar("Um NCM seria alterado. Lote integralmente revertido.");
  const depois = await fotografia(tx);
  await historico(tx, autor, "FISCAL", e.loteId, { hashEntrada, estadoAntes }, { tipo: "GRUPOS_OPERACIONAIS", hashEntrada, hashPlano, estadoDepois: hashFiscal(depois), destinos, referencias: e.referencias, produtos: produtos.length, classificacoesGtin, declaracaoSemGtin: "Instrução expressa do responsável; não é comprovação do fabricante.", regrasTributariasPreservadas: true, documentosTransmitidos: 0 });
  return { hashPlano, aplicadoAnteriormente: false, produtos: produtos.length, grupos: 4, classificacoesGtin };
}
type Resultado = Awaited<ReturnType<typeof executar>>;
class SimulacaoRevertida extends Error { constructor(readonly resultado: Resultado) { super("Simulação revertida."); } }
export async function simularGruposOperacionais(entrada: unknown, sessao: SessaoAtual, cliente: PrismaClient = prisma): Promise<Resultado> {
  const e = validarLoteGruposOperacionais(entrada);
  try { return await cliente.$transaction(async tx => { throw new SimulacaoRevertida(await executar(tx, e, sessao)); }, { timeout: 180000 }); }
  catch (err) { if (err instanceof SimulacaoRevertida) return err.resultado; throw err; }
}
export async function aplicarGruposOperacionais(entrada: unknown, hashPlano: string, sessao: SessaoAtual, cliente: PrismaClient = prisma) {
  if (!/^[a-f0-9]{64}$/.test(hashPlano)) falhar("Hash da simulação inválido.");
  return cliente.$transaction(tx => executar(tx, validarLoteGruposOperacionais(entrada), sessao, hashPlano), { timeout: 180000 });
}
