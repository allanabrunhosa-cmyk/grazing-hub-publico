import "server-only";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { salvarGrupoFiscalNaTransacao } from "@/lib/vendas/persistencia";
import { hashFiscal, analisarImpactoFiscalNaTransacao, ativarVersaoFiscalNaTransacao, conferirAutorFiscal, consultarVersoesFiscais, salvarVersaoFiscalNaTransacao } from "./servico";
import { ErroEstruturaFiscal, hojeFiscal, textoFiscal } from "./validacao";
import { versoesVigentes } from "./vigencia";
import { regrasDaOperacao } from "./ficha";
import { camposDoProduto, camposDaRegra, regraDoGrupo, type ContextoEdicaoFiscal } from "./campos-simples";
import { consultarFichaFiscal } from "./manutencao";
import type { ClassificacaoFiscal, PerfilFiscal, RegraFiscal, TributoConfigurado, VersaoFiscalDto, TipoVersaoFiscal } from "./tipos";

export type RepresentacaoFiscalSimples = "PRODUTO_PREPARADO" | "PRODUTO" | "KIT";
export type EdicaoFiscalSimples = { produtoId: string; classificacaoId: string | null; regraId: string | null; contexto: ContextoEdicaoFiscal; grupoFiscalId: string | null; fiscal: Record<string, string>; herdarOrigemGrupo: boolean; usarImpostosGrupo?: boolean; representacao?: RepresentacaoFiscalSimples; componentesKit?: ClassificacaoFiscal["componentesKit"]; chaveOperacao: string };
export type EdicaoGrupoFiscalSimples = { id: string; versao: number; nome: string; ativo: boolean; regraId: string | null; contexto: ContextoEdicaoFiscal; fiscal: Record<string, string>; chaveOperacao: string };
export type EdicaoEmpresaFiscalSimples = { perfilId: string; crt: 1 | 2 | 3 | 4; regime: PerfilFiscal["regime"]; inscricaoEstadual: string; chaveOperacao: string };
const motivo = "Alteração fiscal informada e salva pelo responsável no cadastro.";
export async function salvarVinculoFiscalSimples(produtoId: string, entrada: unknown, grupoFiscalId: string | null, referencia: { classificacaoId: string | null; regraId: string | null; contexto: ContextoEdicaoFiscal }, chaveOperacao: string, sessao: SessaoAtual) {
  const ficha = await consultarFichaFiscal(produtoId, sessao);
  const vs = versoesVigentes(ficha.painel.versoes, hojeFiscal());
  const cv = vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === produtoId), c = cv?.dados as ClassificacaoFiscal | undefined;
  const perfil = vs.find(v => v.tipo === "PERFIL")?.dados as PerfilFiscal | undefined;
  if (!c || !perfil) throw new ErroEstruturaFiscal("Abra a aba Fiscal do produto para preencher os dados fiscais que faltam.");
  const rv = regrasDaOperacao(vs, c, produtoId, { ...referencia.contexto, data: hojeFiscal(), estabelecimento: perfil.estabelecimento, operacao: "VENDA" }, perfil).efetiva;
  const rg = grupoFiscalId ? regraDoGrupo(vs, grupoFiscalId, ficha.painel.grupos.find(g => g.id === grupoFiscalId)?.codigo ?? (grupoFiscalId === ficha.produto.grupoFiscalId ? c.grupo : null), referencia.contexto, perfil).efetiva?.dados as RegraFiscal | undefined : undefined;
  const fiscal = camposDoProduto(c, rv?.dados as RegraFiscal | undefined, rg);
  if (!entrada || typeof entrada !== "object" || typeof (entrada as Record<string, unknown>).ncm !== "string") throw new ErroEstruturaFiscal("NCM inválido.");
  fiscal.ncm = (entrada as Record<string, string>).ncm;
  if (grupoFiscalId !== c.grupoFiscalId && !(rv?.dados as RegraFiscal | undefined)?.produtoId && rg) Object.assign(fiscal, camposDaRegra(rg), { ncm: fiscal.ncm });
  await salvarFiscalSimples({ produtoId, ...referencia, fiscal, grupoFiscalId, herdarOrigemGrupo: c.herdarOrigemGrupo ?? false, chaveOperacao }, sessao);
  const atual = await consultarFichaFiscal(produtoId, sessao);
  const vigentes = versoesVigentes(atual.painel.versoes, hojeFiscal());
  const classe = vigentes.find(v => v.tipo === "CLASSIFICACAO" && v.chave === produtoId);
  const regra = regrasDaOperacao(vigentes, classe!.dados as ClassificacaoFiscal, produtoId, { ...referencia.contexto, data: hojeFiscal(), estabelecimento: perfil.estabelecimento, operacao: "VENDA" }, perfil).efetiva;
  return { referenciaFiscal: { ...referencia, classificacaoId: classe!.id, regraId: regra?.id ?? null } };
}
export async function salvarEmpresaFiscalSimples(e: EdicaoEmpresaFiscalSimples, sessao: SessaoAtual) {
  textoFiscal(e.chaveOperacao, "Operação", 60);
  return prisma.$transaction(async tx => {
    const { repetida, vs, perfil } = await iniciar(tx, sessao, e.chaveOperacao, hashFiscal(e));
    if (repetida) return;
    const atual = vs.find(v => v.tipo === "PERFIL" && v.chave === "singleton");
    if (!atual || atual.id !== e.perfilId) throw new ErroEstruturaFiscal("Os dados da empresa mudaram. Reabra as configurações antes de salvar.");
    await aplicar(tx, "PERFIL", "singleton", { ...perfil!, crt: e.crt, regime: e.regime, inscricaoEstadual: e.inscricaoEstadual }, `${e.chaveOperacao}-empresa`, sessao, hashFiscal(e));
  }, { timeout: 30000 });
}
function campos(f: Record<string, string>, op: string) {
  textoFiscal(op, "Identificador da operação", 60);
  if (!/^[a-zA-Z0-9_-]{16,60}$/.test(op) || !f || Array.isArray(f) || Object.keys(f).length > 30 || Object.values(f).some(v => typeof v !== "string" || v.length > 2000)) throw new ErroEstruturaFiscal("Campos fiscais inválidos. Atualize o cadastro.");
}
function contexto(c: ContextoEdicaoFiscal) {
  if (!c || !["55", "65"].includes(c.modelo) || !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(c.ufDestino) || !["CONSUMIDOR_FINAL", "CONTRIBUINTE"].includes(c.destinatario)) throw new ErroEstruturaFiscal("Selecione uma operação fiscal válida.");
}
function tributo(anterior: TributoConfigurado | undefined, cst: string, aliquota: string, nome: string, simples = false): TributoConfigurado {
  const tributado = !simples && (nome === "ICMS" ? ["00", "20"].includes(cst) : ["01", "02", "03"].includes(cst));
  return { ...anterior, cst, modalidade: tributado ? "TRIBUTADO" : "SEM_DESTAQUE", aliquota: tributado ? aliquota.replace(",", ".") || null : null, reducaoBase: anterior?.reducaoBase ?? "0", justificativa: anterior?.justificativa || motivo };
}
export function regraComCampos(base: RegraFiscal | undefined, f: Record<string, string>, perfil: PerfilFiscal, c: ContextoEdicaoFiscal): RegraFiscal {
  const simples = perfil.crt === 1 || perfil.crt === 4;
  const r: RegraFiscal = { estabelecimento: perfil.estabelecimento, regime: perfil.regime, operacao: "VENDA", ufDestino: c.ufDestino, destinatario: c.destinatario, grupo: null, produtoId: null, natureza: null, ncm: null, ipi: null, st: "NAO_APLICAVEL", segregacaoReceita: "VENDA", reforma: null, seletivo: "NAO_APLICAVEL", ...base,
    cfop: f.cfop, csosn: simples ? f.csosn || null : null,
    icms: tributo(base?.icms, simples ? base?.icms.cst ?? "00" : f.cstIcms, f.aliquotaIcms ?? "", "ICMS", simples),
    pis: tributo(base?.pis, f.pis, f.aliquotaPis ?? "", "PIS"), cofins: tributo(base?.cofins, f.cofins, f.aliquotaCofins ?? "", "COFINS"), cest: f.cest || null };
  if (f.origem !== undefined) r.origem = f.origem || null;
  if (f.st !== undefined) r.st = f.st as RegraFiscal["st"];
  if (f.evidenciaSt) r.evidenciaSt = f.evidenciaSt; else delete r.evidenciaSt;
  if (f.reducaoIcms !== undefined) r.icms.reducaoBase = f.reducaoIcms.replace(",", ".") || "0";
  return r;
}
async function aplicar(tx: Prisma.TransactionClient, tipo: TipoVersaoFiscal, chave: string, dados: unknown, op: string, sessao: SessaoAtual, hashEntrada: string) {
  const ultima = await tx.versaoEstruturaFiscal.findFirst({ where: { tipo, chave }, orderBy: { versao: "desc" }, select: { versao: true } });
  const v = await salvarVersaoFiscalNaTransacao(tx, { tipo, chave, dados, versaoBase: ultima?.versao ?? 0, vigenciaInicio: hojeFiscal(), justificativa: motivo, fontes: ["Cadastro fiscal preenchido pelo responsável.", `Entrada fiscal ${hashEntrada}`], chaveOperacao: op }, sessao);
  const impacto = await analisarImpactoFiscalNaTransacao(tx, v.id, sessao);
  await ativarVersaoFiscalNaTransacao(tx, v.id, impacto.hash, randomUUID(), sessao);
}
async function iniciar(tx: Prisma.TransactionClient, sessao: SessaoAtual, op: string, hashEntrada: string) {
  await conferirAutorFiscal(tx, sessao, true);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('estrutura-fiscal'))`;
  const repetida = await tx.versaoEstruturaFiscal.findFirst({ where: { chaveOperacao: { in: [`${op}-regra`, `${op}-classe`, `${op}-empresa`] } } });
  if (repetida && (repetida.criadoPorId !== sessao.userId || !(repetida.fontes as string[]).includes(`Entrada fiscal ${hashEntrada}`))) throw new ErroEstruturaFiscal("Esta operação já foi confirmada com outros dados. Reabra o cadastro antes de salvar.");
  if (repetida?.status === "ATIVO") return { repetida, vs: [] as VersaoFiscalDto[], perfil: null };
  const vs = versoesVigentes(await consultarVersoesFiscais(tx), hojeFiscal());
  const perfil = vs.find(v => v.tipo === "PERFIL" && v.chave === "singleton")?.dados as PerfilFiscal | undefined;
  if (!perfil) throw new ErroEstruturaFiscal("Falta configurar o regime e o CRT da empresa em Fiscal → Configurações.");
  return { repetida: null, vs, perfil };
}
export async function salvarFiscalSimples(e: EdicaoFiscalSimples, sessao: SessaoAtual) {
  campos(e.fiscal, e.chaveOperacao); contexto(e.contexto); textoFiscal(e.produtoId, "Produto", 100);
  if (e.representacao !== undefined && !["PRODUTO_PREPARADO", "PRODUTO", "KIT"].includes(e.representacao)) throw new ErroEstruturaFiscal("Representação fiscal inválida.");
  return prisma.$transaction(async tx => {
    const { repetida, vs, perfil } = await iniciar(tx, sessao, e.chaveOperacao, hashFiscal(e));
    if (repetida) return;
    const cv = vs.find(v => v.tipo === "CLASSIFICACAO" && v.chave === e.produtoId);
    const c = cv?.dados as ClassificacaoFiscal | undefined ?? { produtoId: e.produtoId, grupo: null, grupoFiscalId: e.grupoFiscalId, natureza: e.fiscal.natureza as ClassificacaoFiscal["natureza"], tratamento: "NORMAL", ncm: null, origem: null, cest: null, unidade: e.fiscal.unidadeTributavel, gtin: null, estado: "CONFIRMADO", evidencias: [motivo], pendencias: [] } satisfies ClassificacaoFiscal;
    const resolucao = regrasDaOperacao(vs, c, e.produtoId, { ...e.contexto, data: hojeFiscal(), estabelecimento: perfil!.estabelecimento, operacao: "VENDA" }, perfil!);
    if (resolucao.conflito) throw new ErroEstruturaFiscal("Há duas configurações para esta operação. Nenhum valor foi alterado.");
    const rv = resolucao.efetiva;
    if ((cv?.id ?? null) !== e.classificacaoId || cv && (rv?.id ?? null) !== e.regraId) throw new ErroEstruturaFiscal("O cadastro foi atualizado. Reabra a aba Fiscal antes de salvar.");
    if (e.representacao && (!c.produtoId || c.tratamento === "OPCAO_CONFIGURACAO" || c.natureza === "SERVICO")) throw new ErroEstruturaFiscal("A representação aplica-se somente a produtos de NF-e/NFC-e.");
    const corrigirKit = c.tratamento === "KIT_COMPOSTO" && !!e.representacao && e.representacao !== "KIT";
    if (e.herdarOrigemGrupo && (!e.grupoFiscalId || !regraDoGrupo(vs, e.grupoFiscalId, c.grupo, e.contexto, perfil!).efetiva || !(regraDoGrupo(vs, e.grupoFiscalId, c.grupo, e.contexto, perfil!).efetiva!.dados as RegraFiscal).origem)) throw new ErroEstruturaFiscal("Preencha a origem ICMS no grupo ou informe a origem do produto.");
    const nova: ClassificacaoFiscal = { ...c, grupoFiscalId: e.grupoFiscalId, herdarOrigemGrupo: e.herdarOrigemGrupo };
    if (e.representacao) {
      nova.tratamento = e.representacao === "KIT" ? "KIT_COMPOSTO" : "NORMAL";
      nova.natureza = e.representacao === "PRODUTO_PREPARADO" ? "PREPARADO" : c.natureza === "FRACIONADO" && !corrigirKit ? "FRACIONADO" : "REVENDA";
      if (e.grupoFiscalId) nova.grupo = null;
      if (nova.tratamento !== c.tratamento || nova.natureza !== c.natureza) {
        // Somente a nova versão muda. Classificação, receitas e documentos anteriores permanecem íntegros.
        delete nova.analiseNcm; delete nova.ncmAplicabilidade; delete nova.configuracaoNcm;
        delete nova.fotografiaTecnica; delete nova.receitaFiscalDocumentada; delete nova.baseSemIngredientesComprovada;
        nova.evidencias = [...nova.evidencias, e.representacao === "KIT" ? "Responsável definiu kit com mercadorias, quantidades e rateio explícitos; ingredientes não são importados da ficha técnica." : "Responsável definiu produto em uma linha fiscal; ingredientes integram o produto final, sem discriminação como kit."];
      }
      if (e.representacao === "KIT") {
        if (!Array.isArray(e.componentesKit) || !e.componentesKit.length) throw new ErroEstruturaFiscal("Kit: adicione as mercadorias vendidas separadamente, com quantidade e valor para rateio.");
        nova.componentesKit = e.componentesKit; nova.ncm = null; nova.origem = null; nova.cest = null; delete nova.fci;
      } else delete nova.componentesKit;
    }
    if (nova.tratamento === "NORMAL" && nova.natureza !== "SERVICO") {
      if (!c.configuracaoNcm) nova.ncm = e.fiscal.ncm || null; nova.origem = e.fiscal.origem || null; nova.cest = !c.cest && (resolucao.efetiva?.dados as RegraFiscal | undefined)?.grupoFiscalId && (resolucao.efetiva?.dados as RegraFiscal).cest === e.fiscal.cest ? null : e.fiscal.cest || null; nova.gtin = e.fiscal.ean || null; nova.unidade = e.fiscal.unidadeTributavel;
      if (nova.ncm !== c.ncm) delete nova.analiseNcm;
    }
    if (nova.estado === "CONFIRMADO" && nova.tratamento === "NORMAL" && nova.natureza !== "SERVICO") {
      if (!nova.grupo && !nova.grupoFiscalId) throw new ErroEstruturaFiscal("Selecione o grupo fiscal do produto.");
      if (!nova.configuracaoNcm && !nova.ncm) throw new ErroEstruturaFiscal("NCM do produto: informe o código de oito dígitos.");
      if (nova.origem == null) throw new ErroEstruturaFiscal("Preencha a origem ICMS do produto.");
      if (!nova.gtin) throw new ErroEstruturaFiscal("Confirme o GTIN do produto ou selecione Não possui · SEM GTIN.");
    }
    if (!cv || !isDeepStrictEqual(nova, c)) await aplicar(tx, "CLASSIFICACAO", e.produtoId, nova, `${e.chaveOperacao}-classe`, sessao, hashFiscal(e));
    if (nova.tratamento !== "NORMAL" || nova.natureza === "SERVICO") return;
    const anterior = rv?.dados as RegraFiscal | undefined;
    if (e.usarImpostosGrupo && anterior?.produtoId === e.produtoId) {
      await aplicar(tx, "REGRA", rv!.chave, { ...anterior, habilitada: false }, `${e.chaveOperacao}-regra`, sessao, hashFiscal(e)); return;
    }
    const base = regrasDaOperacao(vs, nova, e.produtoId, { ...e.contexto, data: hojeFiscal(), estabelecimento: perfil!.estabelecimento, operacao: "VENDA" }, perfil!).efetiva?.dados as RegraFiscal | undefined;
    const visiveis = camposDaRegra(base);
    const editados = ["cfop", "csosn", "cstIcms", "pis", "cofins", "cest", "st", "evidenciaSt", "aliquotaIcms", "reducaoIcms", "aliquotaPis", "aliquotaCofins"];
    if (base && editados.every(k => (e.fiscal[k] ?? "") === (visiveis[k] ?? ""))) return;
    const r = regraComCampos(base, e.fiscal, perfil!, e.contexto);
    delete r.origem;
    r.produtoId = e.produtoId; r.grupo = null; r.grupoFiscalId = null; r.ncm = null; r.natureza = null;
    // A exceção conserva o alcance da regra mostrada, inclusive 55/65 quando genérica.
    // O cadastro anterior de um agrupador não diferenciava 55/65. A correção
    // explícita conserva esses impostos na mesma operação interna dos dois modelos.
    if (!base && !corrigirKit) r.modelo = e.contexto.modelo;
    const chave = base?.produtoId === e.produtoId ? rv!.chave : `produto-${e.produtoId.replace(/^INSUMO:/, "i-")}-${e.contexto.ufDestino}-${e.contexto.destinatario === "CONTRIBUINTE" ? "C" : "F"}-${e.contexto.modelo}`;
    await aplicar(tx, "REGRA", chave, r, `${e.chaveOperacao}-regra`, sessao, hashFiscal(e));
  }, { timeout: 30000 });
}
export async function salvarGrupoFiscalSimples(e: EdicaoGrupoFiscalSimples, sessao: SessaoAtual) {
  campos(e.fiscal, e.chaveOperacao); contexto(e.contexto);
  return prisma.$transaction(async tx => {
    const { repetida, vs, perfil } = await iniciar(tx, sessao, e.chaveOperacao, hashFiscal(e));
    if (repetida) return (repetida.dados as unknown as RegraFiscal).grupoFiscalId!;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))`;
    const anterior = e.id ? await tx.grupoFiscalVenda.findUniqueOrThrow({ where: { id: e.id } }) : null;
    const resolucao = anterior ? regraDoGrupo(vs, anterior.id, anterior.codigo, e.contexto, perfil!) : null;
    if (resolucao?.conflito || (resolucao?.efetiva?.id ?? null) !== e.regraId) throw new ErroEstruturaFiscal("A configuração do grupo mudou ou tem conflito. Reabra o grupo antes de salvar.");
    const id = await salvarGrupoFiscalNaTransacao(tx, { id: e.id, versao: e.versao, nome: e.nome, ativo: e.ativo, fiscal: anterior?.fiscal ?? {}, atualizarVinculados: false }, sessao);
    const base = resolucao?.efetiva?.dados as RegraFiscal | undefined;
    const anteriores = camposDaRegra(base);
    const alterouImpostos = base ? Object.keys(e.fiscal).some(k => (e.fiscal[k] ?? "") !== (anteriores[k] ?? "")) : !e.id || Object.values(e.fiscal).some(Boolean);
    if (!alterouImpostos) return id;
    if (!e.ativo) throw new ErroEstruturaFiscal("Ative o grupo antes de alterar seus impostos.");
    const regra = regraComCampos(base, e.fiscal, perfil!, e.contexto);
    regra.grupoFiscalId = id; regra.grupo = null;
    if (!base && e.contexto.modelo === "55") regra.modelo = "55";
    const chave = base?.grupoFiscalId === id ? resolucao!.efetiva!.chave : `grupo-${id}-${e.contexto.ufDestino}-${e.contexto.destinatario === "CONTRIBUINTE" ? "C" : "F"}`;
    const vinculados = await tx.produtoVenda.findMany({ where: { grupoFiscalId: id }, select: { id: true } });
    const ids = new Set(vinculados.map(p => p.id));
    let indice = 0;
    for (const v of vs.filter(v => v.tipo === "CLASSIFICACAO" && ids.has(v.chave) && !Object.hasOwn(v.dados, "grupoFiscalId"))) {
      await aplicar(tx, "CLASSIFICACAO", v.chave, { ...v.dados, grupoFiscalId: id }, `${e.chaveOperacao}-p${indice++}`, sessao, hashFiscal(e));
    }
    await aplicar(tx, "REGRA", chave, regra, `${e.chaveOperacao}-regra`, sessao, hashFiscal(e));
    return id;
  }, { timeout: 30000 });
}
