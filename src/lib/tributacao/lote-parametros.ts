import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { validarFiscal } from "@/lib/vendas/dominio";
import { historico, salvarFiscalProdutoNaTransacao, salvarGrupoFiscalNaTransacao } from "@/lib/vendas/persistencia";
import { gtinFiscalBrasilNfeValido } from "@/lib/fiscal-saida/brasilnfe/gtin";
import { consultarTabelaFiscal } from "@/lib/fiscal/catalogos/consulta";
import { conferirAutorFiscal, hashFiscal, salvarVersaoFiscalNaTransacao, analisarImpactoFiscalNaTransacao, ativarVersaoFiscalNaTransacao, consultarVersoesFiscais } from "./servico";
import { versoesVigentes } from "./motor";
import { ErroEstruturaFiscal, hojeFiscal, validarSalvarVersaoFiscal } from "./validacao";
import type { RegraFiscal, SalvarVersaoFiscalEntrada } from "./tipos";

type Cadastro = { id: string; versao: number; fiscal: Record<string, string>; justificativa: string; revisado?: boolean };
export type LoteParametrosFiscais = { loteId: string; vigenciaInicio: string; perfilHash: string; grupos: Cadastro[]; produtos: Cadastro[]; versoes: (SalvarVersaoFiscalEntrada & { ativar?: false })[] };
const campos = ["ncm", "origem", "cfop", "csosn", "pis", "cofins", "ean", "unidadeTributavel", "observacoes"];
const falhar = (s: string): never => { throw new ErroEstruturaFiscal(s); };

export function validarLoteParametrosFiscais(entrada: unknown): LoteParametrosFiscais {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) falhar("Lote de parâmetros inválido.");
  const e = entrada as LoteParametrosFiscais;
  if (Object.keys(e).some(k => !["loteId", "vigenciaInicio", "perfilHash", "grupos", "produtos", "versoes"].includes(k)) || !/^[A-Za-z0-9_-]{1,80}$/.test(e.loteId ?? "") || !/^[a-f0-9]{64}$/.test(e.perfilHash ?? "") || e.vigenciaInicio !== hojeFiscal()) falhar("Lote exige identidade, perfil e vigência na data da execução.");
  if (![e.grupos, e.produtos, e.versoes].every(Array.isArray) || e.grupos.length > 30 || e.produtos.length > 500 || e.versoes.length > 600 || !e.grupos.length && !e.produtos.length && !e.versoes.length) falhar("Tamanho do lote inválido.");
  for (const lista of [e.grupos, e.produtos]) {
    if (new Set(lista.map(r => r.id)).size !== lista.length) falhar("Não repetir um cadastro no lote.");
    for (const r of lista) {
      if (!r || typeof r !== "object" || Object.keys(r).some(k => !["id", "versao", "fiscal", "justificativa", "revisado"].includes(k)) || r.revisado !== undefined && (typeof r.revisado !== "boolean" || lista === e.grupos) || !/^[A-Za-z0-9_-]{1,100}$/.test(r.id ?? "") || !Number.isSafeInteger(r.versao) || r.versao < 1 || typeof r.justificativa !== "string" || r.justificativa.trim().length < 20 || r.justificativa.length > 2000 || !r.fiscal || Array.isArray(r.fiscal) || Object.keys(r.fiscal).some(k => !campos.includes(k)) || Object.values(r.fiscal).some(v => typeof v !== "string")) falhar("Cadastro, versão ou fundamento inválido.");
      validarFiscal(r.fiscal, false);
      if (r.fiscal.ean && !gtinFiscalBrasilNfeValido(r.fiscal.ean)) falhar("GTIN final inválido.");
      for (const campo of ["ncm", "origem", "cfop", "csosn", "pis", "cofins", "unidadeTributavel"] as const) {
        const codigo = r.fiscal[campo];
        if (codigo && !consultarTabelaFiscal({ tabela: campo, selecionado: codigo, dia: e.vigenciaInicio, crt: 1, uf: "SP", operacao: "INTERNA" }).selecionado?.vigente) falhar(`Código ${campo} inexistente, vencido ou incompatível.`);
      }
      if (r.fiscal.cfop && !["5101", "5102", "5405"].includes(r.fiscal.cfop)) falhar("Lote limitado à venda interna paulista comum.");
      if (r.fiscal.cfop === "5405" && r.fiscal.csosn !== "500" || ["5101", "5102"].includes(r.fiscal.cfop) && !["102", "900"].includes(r.fiscal.csosn)) falhar("CFOP e CSOSN incompatíveis.");
    }
  }
  if (new Set(e.versoes.map(v => `${v.tipo}:${v.chave}`)).size !== e.versoes.length) falhar("Não repetir versões da mesma identidade.");
  for (const v of e.versoes) {
    validarSalvarVersaoFiscal(v);
    if (!["CLASSIFICACAO", "REGRA", "TABELA"].includes(v.tipo) || v.vigenciaInicio !== e.vigenciaInicio) falhar("Lote não modifica perfis, complementos ou vigência histórica.");
    if (v.ativar !== undefined && (v.ativar !== false || v.tipo !== "REGRA")) falhar("Somente regras podem permanecer como proposta sem ativação.");
    if (v.tipo === "REGRA") {
      const r = v.dados as RegraFiscal;
      const componenteInterno = !r.produtoId && r.grupo && r.natureza && r.ncm && e.versoes.some(v => { const c = v.dados as { referenciaInternaInsumoId?: string; grupo?: string; natureza?: string; ncm?: string }; return v.tipo === "CLASSIFICACAO" && c.referenciaInternaInsumoId && c.grupo === r.grupo && c.natureza === r.natureza && c.ncm === r.ncm; });
      if (r.estabelecimento !== "singleton" || r.regime !== "SIMPLES_NACIONAL" || r.operacao !== "VENDA" || r.ufDestino !== "SP" || r.destinatario !== "CONSUMIDOR_FINAL" || !r.produtoId && !componenteInterno || r.reforma || r.ipi || r.seletivo !== "NAO_APLICAVEL") falhar("Regra fora do cenário autorizado.");
      if (r.st === "CALCULO_PENDENTE" && v.ativar !== false) falhar("ST não resolvida deve permanecer como proposta sem ativação.");
    }
  }
  return e;
}

type Tx = Prisma.TransactionClient;
async function fotografia(tx: Tx, e: LoteParametrosFiscais) {
  // JSONB textual preserva também números legados fora da precisão de Number.
  const produtos = await tx.$queryRaw<{ id: string; versao: number; fiscal: string }[]>`SELECT id,versao,fiscal::text FROM "ProdutoVenda" WHERE id IN (${Prisma.join(e.produtos.map(p => p.id).concat(["__nenhum__"]))}) ORDER BY id`;
  const grupos = await tx.grupoFiscalVenda.findMany({ where: { id: { in: e.grupos.map(g => g.id) } }, orderBy: { id: "asc" } });
  const versoes = await consultarVersoesFiscais(tx);
  return hashFiscal({ produtos, grupos, versoes: versoes.map(v => ({ id: v.id, hash: v.hash, status: v.status })) });
}
async function executar(tx: Tx, e: LoteParametrosFiscais, sessao: SessaoAtual, hashEsperado?: string) {
  const autor = await conferirAutorFiscal(tx, sessao, true);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
  const vigentes = versoesVigentes(await consultarVersoesFiscais(tx), e.vigenciaInicio);
  const perfil = vigentes.find(v => v.tipo === "PERFIL" && v.chave === "singleton");
  const p = perfil?.dados as { uf?: string; regime?: string; confirmado?: boolean; crt?: number } | undefined;
  if (perfil?.hash !== e.perfilHash || p?.uf !== "SP" || p.regime !== "SIMPLES_NACIONAL" || !p.confirmado || p.crt !== 1) falhar("Perfil efetivo mudou ou não corresponde ao cenário aprovado.");
  const antes = await fotografia(tx, e), hashEntrada = hashFiscal(e);
  const anterior = await tx.historicoCadastroVenda.findFirst({ where: { entidade: "FISCAL", registroId: e.loteId, depois: { path: ["tipo"], equals: "PARAMETRIZACAO_FISCAL" } }, orderBy: { createdAt: "desc" } });
  if (anterior) {
    const recibo = anterior.depois as { hashEntrada?: string; estadoDepois?: string; hashPlano?: string };
    if (anterior.usuarioId !== autor.userId || recibo.hashEntrada !== hashEntrada || recibo.estadoDepois !== antes || hashEsperado && recibo.hashPlano !== hashEsperado) falhar("Lote já utilizado com dados ou estado divergente.");
    return { aplicadoAnteriormente: true, hashPlano: recibo.hashPlano!, grupos: 0, produtos: 0, versoes: [] as string[] };
  }
  const hashPlano = hashFiscal({ hashEntrada, antes });
  if (hashEsperado && hashEsperado !== hashPlano) falhar("Cadastros mudaram. Refaça a simulação.");
  for (const r of e.grupos) {
    const g = await tx.grupoFiscalVenda.findUniqueOrThrow({ where: { id: r.id } });
    if (!g.ativo || g.versao !== r.versao) falhar("Grupo mudou ou está inativo.");
    await salvarGrupoFiscalNaTransacao(tx, { id: g.id, versao: g.versao, nome: g.nome, ativo: g.ativo, fiscal: { ...(g.fiscal as object), ...r.fiscal }, atualizarVinculados: false }, autor);
  }
  const versoes: string[] = [];
  for (const r of e.versoes) {
    if (r.tipo === "CLASSIFICACAO") {
      const antiga = vigentes.find(v => v.tipo === "CLASSIFICACAO" && v.chave === r.chave)?.dados as { ncm?: string | null } | undefined;
      const nova = r.dados as { ncm?: string | null };
      if (antiga?.ncm && antiga.ncm !== nova.ncm) falhar("Preserve o NCM individual já fundamentado.");
    }
    const v = await salvarVersaoFiscalNaTransacao(tx, r, sessao);
    const impacto = await analisarImpactoFiscalNaTransacao(tx, v.id, sessao);
    if (r.ativar !== false) await ativarVersaoFiscalNaTransacao(tx, v.id, impacto.hash, `${e.loteId}-ativar-${versoes.length}`, sessao);
    versoes.push(v.id);
  }
  const classesDepois = versoesVigentes(await consultarVersoesFiscais(tx, ["CLASSIFICACAO"]), e.vigenciaInicio);
  for (const r of e.produtos) {
    const atual = await tx.produtoVenda.findUniqueOrThrow({ where: { id: r.id } });
    const alteradaPeloLote = e.versoes.some(v => v.tipo === "CLASSIFICACAO" && v.chave === r.id);
    if (!atual.ativo || atual.versao !== r.versao + (alteradaPeloLote ? 1 : 0)) falhar("Produto mudou ou está inativo.");
    const antigo = atual.fiscal as Record<string, string>;
    if (r.fiscal.ncm && antigo.ncm && r.fiscal.ncm !== antigo.ncm) falhar("Preserve o NCM individual já fundamentado.");
    const fiscal = { ...antigo, ...r.fiscal };
    if (r.revisado) {
      const c = classesDepois.find(v => v.chave === r.id)?.dados as { estado?: string; pendencias?: string[] } | undefined;
      if (c?.estado !== "CONFIRMADO" || c.pendencias?.length || !fiscal.ncm || !fiscal.origem || !fiscal.cfop || !fiscal.csosn || !fiscal.pis || !fiscal.cofins || !fiscal.unidadeTributavel) falhar("Conferência exige classificação confirmada e todos os campos cadastrais aplicáveis válidos. A emissão conserva suas validações próprias.");
    }
    await salvarFiscalProdutoNaTransacao(tx, r.id, atual.versao, fiscal, r.revisado ?? atual.fiscalRevisado, autor, atual.grupoFiscalId);
    await historico(tx, autor, "FISCAL", r.id, null, { tipo: "FUNDAMENTO_PARAMETROS_FISCAIS", loteId: e.loteId, vigenciaInicio: e.vigenciaInicio, justificativa: r.justificativa, campos: r.fiscal });
  }
  if (hojeFiscal() !== e.vigenciaInicio) falhar("Data fiscal mudou. Transação revertida.");
  await historico(tx, autor, "FISCAL", e.loteId, { hashEntrada, estadoAntes: antes }, { tipo: "PARAMETRIZACAO_FISCAL", hashEntrada, hashPlano, estadoDepois: await fotografia(tx, e), grupos: e.grupos.length, produtos: e.produtos.length, versoes, transmissaoAutorizada: false });
  return { aplicadoAnteriormente: false, hashPlano, grupos: e.grupos.length, produtos: e.produtos.length, versoes };
}
type Resultado = Awaited<ReturnType<typeof executar>>;
class SimulacaoRevertida extends Error { constructor(readonly resultado: Resultado) { super("Simulação revertida."); } }
export async function simularParametrosFiscais(entrada: unknown, sessao: SessaoAtual, cliente: PrismaClient = prisma): Promise<Resultado> {
  const e = validarLoteParametrosFiscais(entrada);
  try { return await cliente.$transaction(async tx => { throw new SimulacaoRevertida(await executar(tx, e, sessao)); }, { timeout: 180000 }); }
  catch (err) { if (err instanceof SimulacaoRevertida) return err.resultado; throw err; }
}
export async function aplicarParametrosFiscais(entrada: unknown, hashPlano: string, sessao: SessaoAtual, cliente: PrismaClient = prisma) {
  if (!/^[a-f0-9]{64}$/.test(hashPlano)) falhar("Hash da simulação inválido.");
  const e = validarLoteParametrosFiscais(entrada);
  return cliente.$transaction(tx => executar(tx, e, sessao, hashPlano), { timeout: 180000 });
}
