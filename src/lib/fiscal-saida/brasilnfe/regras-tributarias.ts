import "server-only";
import { Prisma, type RegraFiscalBrasilNfe, type VersaoRegraFiscalBrasilNfe } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { prepararPayloadLocalBrasilNfe } from "./payload-local";
import { gtinFiscalBrasilNfeValido } from "./gtin";
import type { ParametrosPayloadLocalBrasilNfe, PendenciaPayloadLocalBrasilNfe } from "./payload-local-tipos";
import {
  ErroRegraFiscalBrasilNfe, classificacoesCompletasRegraBrasilNfe, classificacoesRegraBrasilNfe,
  hashRegraFiscalBrasilNfe, hojeCivilRegraBrasilNfe, identidadeRegraBrasilNfe,
  materializarItemRegraBrasilNfe, validarConteudoRegraFiscalBrasilNfe,
  validarRascunhoRegraFiscalBrasilNfe, validarSelecaoRegrasDocumentoBrasilNfe, vigenteRegraFiscalBrasilNfe,
  type RascunhoRegraFiscalBrasilNfe, type ConteudoRegraFiscalBrasilNfe,
} from "./regras-tributarias-dominio";
import { conferirFundamentacaoAprovavelBrasilNfe, validarFundamentacaoFiscalBrasilNfe, type AprovacaoInternaFiscalBrasilNfe, type FundamentacaoFiscalBrasilNfe } from "./fundamentacao-dominio";

type Tx = Prisma.TransactionClient;
type VersaoComRegra = VersaoRegraFiscalBrasilNfe & { regra: RegraFiscalBrasilNfe };
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const selectEmitente = { nome: true, cnpj: true, enderecoEstruturado: true } as const;
function falhar(campo: string, mensagem: string): never { throw new ErroRegraFiscalBrasilNfe(campo, mensagem); }
const registro = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
/** A data da operação vem da confirmação comercial fotografada. Fotografias
 * legadas sem data permanecem compatíveis e usam a data da emissão preparada. */
export function diaOperacaoDocumentoBrasilNfe(payload: unknown) {
  const data = registro(registro(payload).pedido).confirmadoEm;
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(data) || !Number.isFinite(Date.parse(data))) return hojeCivilRegraBrasilNfe();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(data));
}

async function autor(tx: Tx, sessao: SessaoAtual, acao: "visualizar" | "editar", pedido = false) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
  const u = await tx.usuario.findUnique({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  const admin = u?.perfilAcesso?.sistema === "ADMINISTRADOR";
  const pode = (recurso: string, acao: "visualizar" | "editar") => admin || permissaoEfetiva((u?.perfilAcesso?.permissoes ?? {}) as Permissoes, (u?.permissoesPersonalizadas ?? {}) as Excecoes, recurso, acao);
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== (sessao.versao ?? 0) || !pode("vendas.fiscal", acao) || (pedido && !pode("vendas.pedidos", "visualizar"))) falhar("acesso", "Seu acesso não permite administrar as decisões tributárias.");
  return { id: u.id, nome: u.nome.slice(0, 200) };
}
async function travar(tx: Tx) { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('brasilnfe-regras-tributarias'))`; }
async function emitente(tx: Tx) {
  const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: selectEmitente });
  if (!loja) return falhar("emitente", "Cadastre a empresa antes de preparar decisões tributárias.");
  return { loja, hash: hashRegraFiscalBrasilNfe(loja) };
}
async function cadastro(tx: Tx, r: Pick<RascunhoRegraFiscalBrasilNfe, "alvo" | "produtoId" | "grupoId">) {
  if (r.alvo === "PRODUTO") {
    const p = await tx.produtoVenda.findUnique({ where: { id: r.produtoId }, select: { versao: true, fiscal: true, fiscalRevisado: true, ativo: true } });
    if (!p?.ativo) return falhar("produtoId", "Produto inexistente ou inativo.");
    return { versaoCadastro: p.versao, fiscalCadastroHash: hashRegraFiscalBrasilNfe(classificacoesRegraBrasilNfe(p.fiscal)), revisado: p.fiscalRevisado };
  }
  if (r.alvo === "GRUPO") {
    const g = await tx.grupoFiscalVenda.findUnique({ where: { id: r.grupoId }, select: { versao: true, fiscal: true, ativo: true } });
    if (!g?.ativo) return falhar("grupoId", "Grupo fiscal inexistente ou inativo.");
    return { versaoCadastro: g.versao, fiscalCadastroHash: hashRegraFiscalBrasilNfe(classificacoesRegraBrasilNfe(g.fiscal)), revisado: true };
  }
  return { versaoCadastro: null, fiscalCadastroHash: null, revisado: true };
}
async function conferirProdutosFotografados(tx: Tx, itens: unknown[]) {
  const ids = [...new Set(itens.map(i => identidadeRegraBrasilNfe(registro(i).produtoId, "produtoId")))];
  const produtos = await tx.produtoVenda.findMany({ where: { id: { in: ids } }, select: { id: true, versao: true, fiscal: true, ativo: true, fiscalRevisado: true } });
  for (const item of itens) {
    const i = registro(item), f = registro(i.fiscal), p = produtos.find(p => p.id === i.produtoId);
    if (!p?.ativo || !p.fiscalRevisado || p.versao !== f.versaoCadastro || hashRegraFiscalBrasilNfe(classificacoesRegraBrasilNfe(p.fiscal)) !== hashRegraFiscalBrasilNfe(classificacoesRegraBrasilNfe(f.produto))) falhar("cadastro", "O produto fotografado mudou ou precisa de revisão fiscal. Não aplicar a regra do grupo como aprovação implícita.");
  }
}
async function conferirFormasPagamento(tx: Tx, conteudo: ConteudoRegraFiscalBrasilNfe) {
  if (conteudo.tipo !== "OPERACAO") return;
  const mapeamentos = conteudo.pagamentos.mapeamentos;
  const formas = await tx.formaPagamentoVenda.findMany({ where: { id: { in: mapeamentos.map(m => m.formaId) } }, select: { id: true, ativo: true } });
  for (const [i, m] of mapeamentos.entries()) if (!formas.some(f => f.id === m.formaId && f.ativo)) falhar(`pagamentos.mapeamentos[${i}].formaId`, "Selecione uma forma de pagamento ativa do cadastro existente. Não criar correspondência para uma forma inexistente ou inativa.");
}
function dtoVersao(v: VersaoRegraFiscalBrasilNfe) {
  return { id: v.id, revisao: v.revisao, estado: v.estado, referenciaConfirp: v.referenciaConfirp, fundamentacaoFiscal: v.fundamentacaoFiscal === null ? null : validarFundamentacaoFiscalBrasilNfe(v.fundamentacaoFiscal), fundamentacaoHash: v.fundamentacaoHash, autorNome: v.autorNome, aprovacaoInterna: v.aprovacaoInterna as unknown as AprovacaoInternaFiscalBrasilNfe | null, aprovacaoHash: v.aprovacaoHash, legado: v.fundamentacaoFiscal === null, vigenteDesde: v.vigenteDesde, vigenteAte: v.vigenteAte, responsavelId: v.responsavelId, emitenteHash: v.emitenteHash, versaoCadastro: v.versaoCadastro, fiscalCadastroHash: v.fiscalCadastroHash, conteudoHash: v.conteudoHash, criadoEm: v.createdAt.toISOString() };
}
async function anexar(tx: Tx, regra: RegraFiscalBrasilNfe, dados: Omit<Prisma.VersaoRegraFiscalBrasilNfeUncheckedCreateInput, "id" | "regraId" | "revisao">) {
  const revisao = regra.revisao + 1;
  const atualizada = await tx.regraFiscalBrasilNfe.updateMany({ where: { id: regra.id, revisao: regra.revisao }, data: { revisao } });
  if (atualizada.count !== 1) return falhar("revisao", "A decisão tributária foi alterada. Atualize antes de salvar.");
  const versao = await tx.versaoRegraFiscalBrasilNfe.create({ data: { ...dados, regraId: regra.id, revisao } });
  return { regraId: regra.id, ...dtoVersao(versao) };
}
export async function salvarRascunhoRegraTributariaBrasilNfe(entrada: unknown, sessao: SessaoAtual, transacao?: Tx) {
  const d = validarRascunhoRegraFiscalBrasilNfe(entrada);
  const executar = async (tx: Tx) => {
    const pessoa = await autor(tx, sessao, "editar"); await travar(tx);
    let regra = d.regraId ? await tx.regraFiscalBrasilNfe.findUnique({ where: { id: d.regraId } }) : await tx.regraFiscalBrasilNfe.findFirst({ where: { lojaId: "singleton", modelo: d.modelo, operacao: d.operacao, alvo: d.alvo, produtoId: d.produtoId ?? null, grupoId: d.grupoId ?? null } });
    if (d.regraId && !regra) falhar("regraId", "Decisão tributária não encontrada.");
    if (regra && (regra.revisao !== d.revisao || regra.lojaId !== "singleton" || regra.modelo !== d.modelo || regra.operacao !== d.operacao || regra.alvo !== d.alvo || regra.produtoId !== (d.produtoId ?? null) || regra.grupoId !== (d.grupoId ?? null))) falhar("revisao", "A decisão tributária foi alterada. Atualize antes de salvar.");
    if (!regra && d.revisao !== 0) falhar("revisao", "A primeira revisão deve ser zero.");
    const c = await cadastro(tx, d), e = await emitente(tx);
    await conferirFormasPagamento(tx, d.conteudo);
    if (!regra) regra = await tx.regraFiscalBrasilNfe.create({ data: { modelo: d.modelo, operacao: d.operacao, alvo: d.alvo, produtoId: d.produtoId, grupoId: d.grupoId } });
    return anexar(tx, regra, { estado: "PROPOSTA", referenciaConfirp: null, fundamentacaoFiscal: json(d.fundamentacaoFiscal), fundamentacaoHash: hashRegraFiscalBrasilNfe(d.fundamentacaoFiscal), autorNome: pessoa.nome, vigenteDesde: d.vigenteDesde, vigenteAte: d.vigenteAte, responsavelId: pessoa.id, emitenteHash: e.hash, versaoCadastro: c.versaoCadastro, fiscalCadastroHash: c.fiscalCadastroHash, conteudo: json(d.conteudo), conteudoHash: hashRegraFiscalBrasilNfe(d.conteudo) });
  };
  return transacao ? executar(transacao) : prisma.$transaction(executar);
}
function comandoVersao(entrada: unknown, aprovar: boolean) {
  const o = registro(entrada), campos = ["regraId", "revisao", ...(aprovar ? ["fundamentacaoHash", "conteudoHash", "aplicacaoConferida", "conferirCadastro"] : [])];
  if (Object.keys(o).some(k => !campos.includes(k)) || !Number.isSafeInteger(o.revisao) || (o.revisao as number) < 1 || (o.revisao as number) > 1000000) falhar("revisao", "Configuração tributária inválida.");
  if (aprovar && o.aplicacaoConferida !== true) falhar("aplicacaoConferida", "Confirme que verificou a fundamentação e sua aplicação ao caso da empresa antes de aprovar internamente.");
  if (aprovar && o.conferirCadastro !== undefined && typeof o.conferirCadastro !== "boolean") falhar("conferirCadastro", "Informe explicitamente a conferência do cadastro.");
  if (aprovar && (typeof o.fundamentacaoHash !== "string" || !/^[a-f0-9]{64}$/.test(o.fundamentacaoHash) || typeof o.conteudoHash !== "string" || !/^[a-f0-9]{64}$/.test(o.conteudoHash))) falhar("fundamentacaoHash", "A revisão precisa corresponder ao conteúdo e fundamento apresentados.");
  return { regraId: identidadeRegraBrasilNfe(o.regraId), revisao: o.revisao as number, fundamentacaoHash: o.fundamentacaoHash as string | undefined, conteudoHash: o.conteudoHash as string | undefined, conferirCadastro: o.conferirCadastro === true };
}
function fundamentoVersao(v: VersaoRegraFiscalBrasilNfe, conteudo: ConteudoRegraFiscalBrasilNfe, regra: RegraFiscalBrasilNfe): FundamentacaoFiscalBrasilNfe {
  if (!v.fundamentacaoFiscal || !v.fundamentacaoHash) return falhar("fundamentacaoFiscal", "Versão legada preservada: prepare nova proposta fundamentada e revisão interna explícita para uma nova preparação fiscal.");
  const fundamento = validarFundamentacaoFiscalBrasilNfe(v.fundamentacaoFiscal);
  if (hashRegraFiscalBrasilNfe(fundamento) !== v.fundamentacaoHash || hashRegraFiscalBrasilNfe(conteudo) !== v.conteudoHash || fundamento.contexto.operacao !== regra.operacao) falhar("fundamentacaoHash", "A versão não corresponde ao fundamento e conteúdo registrados.");
  return fundamento;
}
export function conferirProvaInterna(v: VersaoRegraFiscalBrasilNfe, regra: RegraFiscalBrasilNfe) {
  const a = registro(v.aprovacaoInterna), p = registro(a.aprovador);
  const campos = ["tipo", "regraId", "revisaoOrigem", "modelo", "operacao", "alvo", "conteudoHash", "fundamentacaoHash", "emitenteHash", "fiscalCadastroHash", "versaoCadastro", "vigenteDesde", "vigenteAte", "aprovador", "aprovadoEm"];
  if (Object.keys(a).length !== campos.length || Object.keys(a).some(k => !campos.includes(k)) || Object.keys(p).length !== 2 || Object.keys(p).some(k => !["id", "nome"].includes(k)) || a.tipo !== "APROVACAO_INTERNA" || a.regraId !== regra.id || a.revisaoOrigem !== v.revisao - 1 || a.modelo !== regra.modelo || a.operacao !== regra.operacao || a.alvo !== regra.alvo || a.conteudoHash !== v.conteudoHash || a.fundamentacaoHash !== v.fundamentacaoHash || a.emitenteHash !== v.emitenteHash || a.fiscalCadastroHash !== v.fiscalCadastroHash || a.versaoCadastro !== v.versaoCadastro || a.vigenteDesde !== v.vigenteDesde || a.vigenteAte !== v.vigenteAte || p.id !== v.responsavelId || p.nome !== v.autorNome || typeof p.nome !== "string" || !p.nome || p.nome.length > 200 || typeof a.aprovadoEm !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(a.aprovadoEm) || !Number.isFinite(new Date(a.aprovadoEm).valueOf()) || hashRegraFiscalBrasilNfe(a) !== v.aprovacaoHash) falhar("aprovacaoInterna", "A prova imutável de revisão interna não corresponde à versão fiscal.");
}
async function novaSituacao(entrada: unknown, sessao: SessaoAtual, estado: "APROVADA" | "EM_REVISAO" | "BLOQUEADA" | "INATIVA", transacao?: Tx) {
  const aprovar = estado === "APROVADA";
  const d = comandoVersao(entrada, aprovar);
  const executar = async (tx: Tx) => {
    const pessoa = await autor(tx, sessao, "editar"); await travar(tx);
    const regra = await tx.regraFiscalBrasilNfe.findUnique({ where: { id: d.regraId } });
    if (!regra || regra.revisao !== d.revisao) return falhar("revisao", "A decisão tributária foi alterada. Atualize antes de salvar.");
    const anterior = await tx.versaoRegraFiscalBrasilNfe.findUnique({ where: { regraId_revisao: { regraId: regra.id, revisao: d.revisao } } });
    if (!anterior || (aprovar && !["PROPOSTA", "EM_REVISAO"].includes(anterior.estado)) || anterior.estado === estado || anterior.estado === "INATIVA" || (estado === "EM_REVISAO" && !["PROPOSTA", "BLOQUEADA"].includes(anterior.estado))) return falhar("estado", "Esta revisão não permite a alteração solicitada; legado exige uma nova proposta.");
    const alvo = regra.alvo as RascunhoRegraFiscalBrasilNfe["alvo"], conteudo = validarConteudoRegraFiscalBrasilNfe(anterior.conteudo, alvo);
    if (hashRegraFiscalBrasilNfe(conteudo) !== anterior.conteudoHash) falhar("conteudoHash", "A versão fiscal não corresponde ao conteúdo registrado.");
    const fundamento = anterior.fundamentacaoFiscal === null && estado === "INATIVA" ? null : fundamentoVersao(anterior, conteudo, regra);
    let aprovacao: AprovacaoInternaFiscalBrasilNfe | null = null;
    if (aprovar) {
      if (conteudo.tipo === "ITEM" && !gtinFiscalBrasilNfeValido(conteudo.perfil.classificacoes.ean)) falhar("classificacoes.ean", "Confirme o GTIN válido da unidade final ou declare SEM GTIN quando não possuir código atribuído, com fundamentação identificada.");
      await conferirFormasPagamento(tx, conteudo);
      if (d.fundamentacaoHash !== anterior.fundamentacaoHash || d.conteudoHash !== anterior.conteudoHash) falhar("fundamentacaoHash", "A revisão precisa corresponder ao conteúdo e fundamento apresentados.");
      conferirFundamentacaoAprovavelBrasilNfe(fundamento!, conteudo, regra.operacao as "NF_E_VENDA" | "NFC_E_VENDA");
      if (anterior.vigenteAte && anterior.vigenteAte < hojeCivilRegraBrasilNfe()) falhar("vigenteAte", "A decisão fiscal já expirou. Prepare nova vigência antes de aprovar.");
      const e = await emitente(tx), c = await cadastro(tx, { alvo, produtoId: regra.produtoId ?? undefined, grupoId: regra.grupoId ?? undefined });
      const uf = registro(e.loja.enderecoEstruturado).uf;
      if (typeof uf === "string" && uf && uf !== fundamento!.contexto.uf) falhar("fundamentacaoFiscal.contexto.uf", "A UF do fundamento deve corresponder ao emitente cadastrado.");
      if (e.hash !== anterior.emitenteHash || c.versaoCadastro !== anterior.versaoCadastro || c.fiscalCadastroHash !== anterior.fiscalCadastroHash) falhar("cadastro", "O emitente ou cadastro fiscal mudou. Prepare uma nova revisão.");
      if (conteudo.tipo === "ITEM" && alvo === "PRODUTO" && d.conferirCadastro && !c.revisado && classificacoesCompletasRegraBrasilNfe(conteudo.perfil.classificacoes) && hashRegraFiscalBrasilNfe(conteudo.perfil.classificacoes) === c.fiscalCadastroHash) {
        const u = await tx.usuario.findUniqueOrThrow({ where: { id: pessoa.id }, include: { perfilAcesso: true } });
        if (u.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, (u.permissoesPersonalizadas ?? {}) as Excecoes, "vendas.produtos", "editar")) falhar("acesso", "Seu acesso não permite conferir a ficha do produto.");
        // Conferência do MESMO conteúdo/versionamento, sem aplicar override ou
        // reescrever classificação fotografada. Só o marcador de revisão muda.
        const atualizada = await tx.produtoVenda.updateMany({ where: { id: regra.produtoId!, versao: c.versaoCadastro!, fiscalRevisado: false }, data: { fiscalRevisado: true } });
        if (atualizada.count !== 1) falhar("cadastro", "O cadastro mudou durante a conferência.");
        await tx.historicoCadastroVenda.create({ data: { entidade: "PRODUTO", registroId: regra.produtoId!, usuarioId: pessoa.id, usuarioNome: pessoa.nome, antes: { fiscalRevisado: false, versao: c.versaoCadastro, fiscalHash: c.fiscalCadastroHash }, depois: { fiscalRevisado: true, versao: c.versaoCadastro, fiscalHash: c.fiscalCadastroHash, motivo: "CONFERENCIA_INTERNA_MESMO_CONTEUDO", regraId: regra.id, conteudoHash: anterior.conteudoHash } } });
        c.revisado = true;
      }
      if (conteudo.tipo === "ITEM" && (!c.revisado || !classificacoesCompletasRegraBrasilNfe(conteudo.perfil.classificacoes) || hashRegraFiscalBrasilNfe(conteudo.perfil.classificacoes) !== c.fiscalCadastroHash)) falhar("classificacoes", "Revise o cadastro fiscal e confira as classificações da decisão antes de aprovar.");
      aprovacao = { tipo: "APROVACAO_INTERNA", regraId: regra.id, revisaoOrigem: anterior.revisao, modelo: regra.modelo as 55 | 65, operacao: regra.operacao as "NF_E_VENDA" | "NFC_E_VENDA", alvo, conteudoHash: anterior.conteudoHash, fundamentacaoHash: anterior.fundamentacaoHash!, emitenteHash: anterior.emitenteHash, fiscalCadastroHash: anterior.fiscalCadastroHash, versaoCadastro: anterior.versaoCadastro, vigenteDesde: anterior.vigenteDesde, vigenteAte: anterior.vigenteAte, aprovador: pessoa, aprovadoEm: new Date().toISOString() };
    }
    return anexar(tx, regra, { estado, referenciaConfirp: fundamento ? null : anterior.referenciaConfirp, fundamentacaoFiscal: fundamento ? json(fundamento) : Prisma.DbNull, fundamentacaoHash: anterior.fundamentacaoHash, autorNome: pessoa.nome, aprovacaoInterna: aprovacao ? json(aprovacao) : Prisma.DbNull, aprovacaoHash: aprovacao ? hashRegraFiscalBrasilNfe(aprovacao) : null, vigenteDesde: anterior.vigenteDesde, vigenteAte: anterior.vigenteAte, responsavelId: pessoa.id, emitenteHash: anterior.emitenteHash, versaoCadastro: anterior.versaoCadastro, fiscalCadastroHash: anterior.fiscalCadastroHash, conteudo: json(conteudo), conteudoHash: anterior.conteudoHash });
  };
  return transacao ? executar(transacao) : prisma.$transaction(executar);
}
/** Aprovação é ato administrativo explícito, não comprovação automática de aprovação externa. */
export async function aprovarRegraTributariaBrasilNfe(entrada: unknown, sessao: SessaoAtual) { return novaSituacao(entrada, sessao, "APROVADA"); }
/** Uma revisão humana consolidada, atômica e vinculada aos hashes apresentados.
 * As provas continuam individuais e append-only; não autoriza transmissão. */
export async function aprovarConjuntoRegrasBrasilNfe(entradas: unknown, sessao: SessaoAtual, transacao?: Tx) {
  if (!Array.isArray(entradas) || entradas.length < 1 || entradas.length > 20) falhar("regras", "Selecione entre uma e vinte propostas para a revisão consolidada.");
  const comandos = entradas.map(e => comandoVersao(e, true));
  if (new Set(comandos.map(c => c.regraId)).size !== comandos.length) falhar("regras", "Não repetir uma regra na mesma aprovação.");
  const executar = async (tx: Tx) => {
    const versoes = [];
    for (const entrada of entradas) versoes.push(await novaSituacao(entrada, sessao, "APROVADA", tx));
    return versoes;
  };
  return transacao ? executar(transacao) : prisma.$transaction(executar, { timeout: 30000 });
}
export async function enviarRegraParaRevisaoBrasilNfe(entrada: unknown, sessao: SessaoAtual) { return novaSituacao(entrada, sessao, "EM_REVISAO"); }
export async function bloquearRegraTributariaBrasilNfe(entrada: unknown, sessao: SessaoAtual) { return novaSituacao(entrada, sessao, "BLOQUEADA"); }
export async function inativarRegraTributariaBrasilNfe(entrada: unknown, sessao: SessaoAtual) { return novaSituacao(entrada, sessao, "INATIVA"); }
export async function listarRegrasTributariasBrasilNfe(sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    await autor(tx, sessao, "visualizar");
    const regras = await tx.regraFiscalBrasilNfe.findMany({ where: { lojaId: "singleton" }, orderBy: { createdAt: "desc" }, take: 500, include: { versoes: { orderBy: { revisao: "desc" }, take: 1 }, produto: { select: { nome: true } }, grupo: { select: { nome: true } } } });
    return regras.map(r => ({ id: r.id, modelo: r.modelo, operacao: r.operacao, alvo: r.alvo, produtoId: r.produtoId, grupoId: r.grupoId, produtoNome: r.produto?.nome ?? null, grupoNome: r.grupo?.nome ?? null, revisao: r.revisao, atual: r.versoes[0] ? dtoVersao(r.versoes[0]) : null }));
  });
}
export async function obterHistoricoRegraTributariaBrasilNfe(regraId: string, sessao: SessaoAtual) {
  identidadeRegraBrasilNfe(regraId);
  return prisma.$transaction(async tx => {
    await autor(tx, sessao, "visualizar");
    const regra = await tx.regraFiscalBrasilNfe.findUnique({ where: { id: regraId }, include: { versoes: { orderBy: { revisao: "desc" }, take: 100 } } });
    if (!regra || regra.lojaId !== "singleton") return falhar("regraId", "Decisão tributária não encontrada.");
    return { id: regra.id, revisao: regra.revisao, modelo: regra.modelo, operacao: regra.operacao, alvo: regra.alvo, produtoId: regra.produtoId, grupoId: regra.grupoId, versoes: regra.versoes.map(v => ({ ...dtoVersao(v), conteudo: validarConteudoRegraFiscalBrasilNfe(v.conteudo, regra.alvo as RascunhoRegraFiscalBrasilNfe["alvo"]) })) };
  });
}
async function versaoAprovada(tx: Tx, id: string, modelo: 55 | 65, alvo: string[], eHash: string, hoje: string): Promise<{ versao: VersaoComRegra; conteudo: ConteudoRegraFiscalBrasilNfe }> {
  const versao = await tx.versaoRegraFiscalBrasilNfe.findUnique({ where: { id }, include: { regra: true } });
  if (!versao || versao.regra.lojaId !== "singleton" || versao.regra.modelo !== modelo || !alvo.includes(versao.regra.alvo) || versao.regra.revisao !== versao.revisao || !vigenteRegraFiscalBrasilNfe(versao, hoje) || versao.emitenteHash !== eHash) return falhar("versaoId", "Selecione uma versão aprovada, atual e vigente para o mesmo emitente, modelo e operação.");
  const conteudo = validarConteudoRegraFiscalBrasilNfe(versao.conteudo, versao.regra.alvo as RascunhoRegraFiscalBrasilNfe["alvo"]);
  const fundamento = fundamentoVersao(versao, conteudo, versao.regra);
  conferirProvaInterna(versao, versao.regra);
  conferirFundamentacaoAprovavelBrasilNfe(fundamento, conteudo, versao.regra.operacao as "NF_E_VENDA" | "NFC_E_VENDA", hoje);
  await conferirFormasPagamento(tx, conteudo);
  if (hashRegraFiscalBrasilNfe(conteudo) !== versao.conteudoHash) return falhar("conteudoHash", "A versão fiscal não corresponde ao conteúdo registrado.");
  const c = await cadastro(tx, { alvo: versao.regra.alvo as RascunhoRegraFiscalBrasilNfe["alvo"], produtoId: versao.regra.produtoId ?? undefined, grupoId: versao.regra.grupoId ?? undefined });
  if (c.versaoCadastro !== versao.versaoCadastro || c.fiscalCadastroHash !== versao.fiscalCadastroHash || !c.revisado) return falhar("cadastro", "O cadastro fiscal mudou ou precisa de revisão. Atualize a decisão tributária.");
  return { versao, conteudo };
}
/** Congela complemento aprovado vinculado ao hash existente. Nenhum snapshot, título ou fila é alterado. */
export async function vincularRegrasDocumentoBrasilNfe(entrada: unknown, sessao: SessaoAtual) {
  const d = validarSelecaoRegrasDocumentoBrasilNfe(entrada);
  return prisma.$transaction(async tx => {
    const pessoa = await autor(tx, sessao, "editar", true); await travar(tx);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    const doc = await tx.documentoFiscalSaida.findUnique({ where: { id: d.documentoId }, select: { id: true, payload: true, hashPayload: true, versaoPedido: true, modeloDocumento: true, tentativas: true, referenciaProvedor: true, chaveFiscal: true, leaseToken: true, pedido: { select: { versao: true } } } });
    if (!doc) return falhar("documentoId", "Documento fiscal não encontrado.");
    if (doc.tentativas !== 0 || doc.referenciaProvedor || doc.chaveFiscal || doc.leaseToken || doc.pedido.versao !== doc.versaoPedido) falhar("documentoId", "A fotografia já foi processada ou o pedido mudou. O complemento não pode ser substituído.");
    if (doc.modeloDocumento !== null && doc.modeloDocumento !== d.modelo) falhar("modelo", "O modelo fiscal já definido para a fotografia não pode ser trocado.");
    const e = await emitente(tx), hoje = diaOperacaoDocumentoBrasilNfe(doc.payload), ambiente = d.ambiente ?? "HOMOLOGACAO";
    const existentes = await tx.planoFiscalBrasilNfe.findUnique({ where: { documentoId: doc.id }, include: { versoes: true } });
    const emp = await versaoAprovada(tx, d.empresaVersaoId, d.modelo, ["EMPRESA"], e.hash, hoje), op = await versaoAprovada(tx, d.operacaoVersaoId, d.modelo, ["OPERACAO"], e.hash, hoje);
    if (emp.conteudo.tipo !== "EMPRESA" || op.conteudo.tipo !== "OPERACAO") return falhar("versaoId", "Perfis fiscais incompatíveis.");
    const contextoEmpresa = fundamentoVersao(emp.versao, emp.conteudo, emp.versao.regra).contexto;
    const conferirContexto = (v: VersaoComRegra, c: ConteudoRegraFiscalBrasilNfe) => {
      const contexto = fundamentoVersao(v, c, v.regra).contexto;
      if (contexto.uf !== contextoEmpresa.uf || contexto.regime !== contextoEmpresa.regime || contexto.operacao !== contextoEmpresa.operacao) falhar("fundamentacaoFiscal.contexto", "O alcance da decisão deve corresponder à UF, regime e operação do emitente aprovado para este documento.");
    };
    const ufEmitente = registro(e.loja.enderecoEstruturado).uf;
    if (typeof ufEmitente === "string" && ufEmitente && ufEmitente !== contextoEmpresa.uf) falhar("fundamentacaoFiscal.contexto.uf", "A UF do fundamento deve corresponder ao emitente cadastrado.");
    conferirContexto(op.versao, op.conteudo);
    if (d.complementos.destinatario && d.complementos.destinatario.uf !== contextoEmpresa.uf) falhar("destinatario.uf", "O fundamento deste piloto cobre somente saídas internas na mesma UF. Operação interestadual ou exterior precisa de alcance específico e nova revisão; não aplicar CFOP interno por aproximação.");
    const itens = registro(doc.payload).itens;
    if (!Array.isArray(itens) || itens.length !== d.itens.length || itens.some(i => !d.itens.some(s => s.itemId === registro(i).id))) return falhar("itens", "Selecione explicitamente uma versão para cada item fotografado.");
    await conferirProdutosFotografados(tx, itens);
    const vinculos = [{ papel: "EMPRESA", versaoId: emp.versao.id }, { papel: "OPERACAO", versaoId: op.versao.id }];
    const regrasItens: ParametrosPayloadLocalBrasilNfe["itens"] = [];
    const pendenciasBases: PendenciaPayloadLocalBrasilNfe[] = [];
    for (const [indiceItem, item] of itens.entries()) {
      const i = registro(item), fiscal = registro(i.fiscal), p = d.itens.find(s => s.itemId === i.id)!;
      const r = await versaoAprovada(tx, p.versaoId, d.modelo, ["PRODUTO", "GRUPO"], e.hash, hoje);
      if (r.conteudo.tipo !== "ITEM") return falhar("itens", "Perfil de item incompatível.");
      conferirContexto(r.versao, r.conteudo);
      if (!/^5\d{3}$/.test(r.conteudo.perfil.classificacoes.cfop)) falhar(`itens[${indiceItem}].cfop`, "O CFOP deste item não corresponde ao alcance interno do piloto. Prepare uma revisão específica para a operação; nenhum código será substituído automaticamente.");
      if ((r.versao.regra.alvo === "PRODUTO" && (r.versao.regra.produtoId !== i.produtoId || r.versao.versaoCadastro !== fiscal.versaoCadastro)) || (r.versao.regra.alvo === "GRUPO" && (r.versao.regra.grupoId !== fiscal.grupoId || r.versao.versaoCadastro !== fiscal.versaoGrupo))) return falhar("itens", "A decisão não corresponde ao produto/grupo e revisão fotografados.");
      if (hashRegraFiscalBrasilNfe(classificacoesRegraBrasilNfe(fiscal.produto)) !== hashRegraFiscalBrasilNfe(r.conteudo.perfil.classificacoes)) return falhar("classificacoes", "As classificações aprovadas diferem da fotografia do produto; nenhum override será aplicado.");
      const produtoId = identidadeRegraBrasilNfe(i.produtoId, "produtoId"), itemId = identidadeRegraBrasilNfe(i.id, "itemId");
      if (!Number.isSafeInteger(fiscal.versaoCadastro) || (fiscal.versaoCadastro as number) < 1) return falhar("versaoCadastro", "Revisão de produto ausente na fotografia.");
      const bases = d.complementos.bases.find(b => b.itemId === itemId)!;
      for (const tributo of ["icms", "pis", "cofins"] as const) if (r.conteudo.perfil[tributo].tratamento === "TRIBUTADO" && bases[tributo] === undefined) pendenciasBases.push({ campo: `Produtos[${indiceItem}].Imposto.${tributo.toUpperCase()}.BaseCalculo`, codigo: "AUSENTE", motivo: "Informar a base aprovada para este item e documento; ela não é inferida do valor comercial.", responsavel: "REVISAO_FISCAL", itemId, produtoId, operacao: d.modelo === 55 ? "NF_E_VENDA" : "NFC_E_VENDA" });
      if (["icms", "pis", "cofins"].every(t => r.conteudo.tipo === "ITEM" && (r.conteudo.perfil[t as "icms" | "pis" | "cofins"].tratamento !== "TRIBUTADO" || bases[t as "icms" | "pis" | "cofins"] !== undefined))) regrasItens.push(materializarItemRegraBrasilNfe(r.conteudo.perfil, { itemId, produtoId, versaoCadastro: fiscal.versaoCadastro as number, referenciaFundamentacao: r.versao.id }, bases));
      vinculos.push({ papel: `ITEM:${itemId}`, versaoId: r.versao.id });
    }
    if (pendenciasBases.length) return { planoId: null, montagemConcluida: false as const, transmissaoPermitida: false as const, pendencias: pendenciasBases };
    const destinatario = op.conteudo.destinatario.identificar ? { ...op.conteudo.destinatario, endereco: d.complementos.destinatario! } : op.conteudo.destinatario;
    if (op.conteudo.destinatario.identificar !== !!d.complementos.destinatario) falhar("destinatario", "Confira o endereço fiscal exigido pela operação; não inferir o endereço de entrega.");
    for (const c of d.complementos.cartoes) if (!op.conteudo.pagamentos.mapeamentos.some(m => m.formaId === c.formaId && ["03", "04"].includes(m.FormaPagamento))) falhar("cartoes", "Autorização de cartão não corresponde à forma configurada.");
    const parametros: ParametrosPayloadLocalBrasilNfe = { vinculo: { documentoId: doc.id, hashPayload: doc.hashPayload, revisaoPedido: doc.versaoPedido }, referenciaFundamentacao: op.versao.id, emitente: emp.conteudo.emitente, operacao: op.conteudo.operacao, destinatario, pagamentos: { ...op.conteudo.pagamentos, mapeamentos: op.conteudo.pagamentos.mapeamentos.map(m => ({ ...m, ...(d.complementos.cartoes.find(c => c.formaId === m.formaId) ? { cartao: d.complementos.cartoes.find(c => c.formaId === m.formaId)!.cartao } : {}) })) }, itens: regrasItens };
    const resultado = prepararPayloadLocalBrasilNfe(doc, d.modelo, e.loja, parametros, ambiente);
    if (!resultado.montagemConcluida) return { planoId: null, montagemConcluida: false as const, transmissaoPermitida: false as const, pendencias: resultado.pendencias };
    const parametrosHash = hashRegraFiscalBrasilNfe(parametros);
    if (existentes) {
      if (existentes.ambiente !== ambiente || existentes.modelo !== d.modelo || existentes.hashPayload !== doc.hashPayload || existentes.revisaoPedido !== doc.versaoPedido || existentes.emitenteHash !== e.hash || existentes.parametrosHash !== parametrosHash || hashRegraFiscalBrasilNfe(existentes.versoes.map(v => ({ papel: v.papel, versaoId: v.versaoId })).sort((a, b) => a.papel.localeCompare(b.papel))) !== hashRegraFiscalBrasilNfe([...vinculos].sort((a, b) => a.papel.localeCompare(b.papel)))) return falhar("planoId", "O complemento fiscal desta fotografia é imutável; seleções diferentes exigem conferência.");
      return { planoId: existentes.id, montagemConcluida: true as const, transmissaoPermitida: false as const, pendencias: [] };
    }
    const plano = await tx.planoFiscalBrasilNfe.create({ data: { documentoId: doc.id, modelo: d.modelo, ambiente, hashPayload: doc.hashPayload, revisaoPedido: doc.versaoPedido, emitenteHash: e.hash, parametros: json(parametros), parametrosHash, verificadoEm: hoje, responsavelId: pessoa.id, versoes: { create: vinculos } } });
    if (doc.modeloDocumento === null) await tx.documentoFiscalSaida.update({ where: { id: doc.id }, data: { modeloDocumento: d.modelo } });
    return { planoId: plano.id, montagemConcluida: true as const, transmissaoPermitida: false as const, pendencias: [] };
  }, { timeout: 30000 });
}
/** Retorno somente para consumidor servidor autorizado; não enviar parâmetros pessoais para auditoria/HTML. */
export async function obterComplementosAprovadosDocumentoBrasilNfe(documentoId: string, sessao: SessaoAtual) {
  identidadeRegraBrasilNfe(documentoId);
  return prisma.$transaction(async tx => {
    await autor(tx, sessao, "visualizar", true);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    const plano = await tx.planoFiscalBrasilNfe.findUnique({ where: { documentoId }, include: { documento: { select: { id: true, hashPayload: true, versaoPedido: true, modeloDocumento: true, payload: true, status: true, ambiente: true, acao: true, proximaTentativa: true, tentativas: true, referenciaProvedor: true, chaveFiscal: true, numero: true, serie: true, protocolo: true, protocoloCancelamento: true, cancelamentoPendente: true, ultimaSequencia: true, ultimaSequenciaObservada: true, leaseToken: true, leaseAte: true, pedido: { select: { versao: true, status: true } }, _count: { select: { eventos: { where: { tipo: { not: "PREPARADO" } } } } } } }, versoes: { include: { versao: { include: { regra: true } } } } } });
    if (!plano) return null;
    const e = await emitente(tx), hoje = diaOperacaoDocumentoBrasilNfe(plano.documento.payload);
    if (!["HOMOLOGACAO", "PRODUCAO"].includes(plano.ambiente) || plano.modelo !== plano.documento.modeloDocumento || plano.emitenteHash !== e.hash || plano.hashPayload !== plano.documento.hashPayload || plano.revisaoPedido !== plano.documento.versaoPedido || plano.parametrosHash !== hashRegraFiscalBrasilNfe(plano.parametros)) return falhar("planoId", "O complemento não corresponde ao emitente ou à fotografia atual.");
    for (const item of plano.versoes) await versaoAprovada(tx, item.versaoId, plano.modelo as 55 | 65, [item.versao.regra.alvo], e.hash, hoje);
    const itens = registro(plano.documento.payload).itens;
    if (!Array.isArray(itens) || !itens.length || itens.length > 990) return falhar("itens", "Fotografia de produtos inválida.");
    await conferirProdutosFotografados(tx, itens);
    const resultado = prepararPayloadLocalBrasilNfe(plano.documento, plano.modelo as 55 | 65, e.loja, plano.parametros, plano.ambiente as "HOMOLOGACAO" | "PRODUCAO");
    const d = plano.documento;
    return {
      planoId: plano.id, modelo: plano.modelo as 55 | 65, ambiente: plano.ambiente as "HOMOLOGACAO" | "PRODUCAO",
      parametros: plano.parametros as unknown as ParametrosPayloadLocalBrasilNfe, resultado, transmissaoPermitida: false as const,
      // Metadados obtidos na mesma transação das conferências; nunca expor parâmetros ou a fotografia.
      evidencia: {
        revisaoPedido: plano.revisaoPedido, emitenteHash: plano.emitenteHash, parametrosHash: plano.parametrosHash,
        vinculadoEm: plano.createdAt.toISOString(), conferidoEm: new Date().toISOString(),
        // O contador é reiniciável: histórico e estado são obrigatórios para esta prova local.
        primeiraEmissaoPendente: ["SEM_EMISSOR", "PREPARADO"].includes(d.status) && ["NAO_CONFIGURADO", plano.ambiente].includes(d.ambiente)
          && d.acao === null && d.proximaTentativa === null && d.tentativas === 0 && d._count.eventos === 0
          && d.referenciaProvedor === null && d.chaveFiscal === null && d.numero === null && d.serie === null
          && d.protocolo === null && d.protocoloCancelamento === null && !d.cancelamentoPendente
          && d.ultimaSequencia === -1 && d.ultimaSequenciaObservada === 0 && d.leaseToken === null && d.leaseAte === null
          && d.pedido.status === "CONFIRMADO" && d.pedido.versao === plano.revisaoPedido,
        versoes: plano.versoes.map(({ papel, versao }) => ({
          papel, alvo: versao.regra.alvo, regraId: versao.regraId, versaoId: versao.id, revisao: versao.revisao,
          conteudoHash: versao.conteudoHash, fundamentacaoHash: versao.fundamentacaoHash, aprovacaoHash: versao.aprovacaoHash,
          vigenteDesde: versao.vigenteDesde, vigenteAte: versao.vigenteAte,
        })).sort((a, b) => a.papel.localeCompare(b.papel)),
      },
    };
  });
}
