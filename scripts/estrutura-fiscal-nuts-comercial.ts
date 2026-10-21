/** Correção única da referência comercial Nuts. Não altera receita, preço ou emissor. */
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { validarComponentes } from "../src/lib/vendas/dominio";
import { conferirComprovanteClassificacao } from "./estrutura-fiscal-classificacao-catalogo";

export class ErroCorrecaoNuts extends Error {}
export const IDENTIDADES_NUTS = { grupoId: "3822ab18-d733-4d7e-b632-a2ba461f27af", opcaoId: "4db0615c-b2db-4923-9273-e7694206baf8", aliasId: "fca4b508-ce71-47a0-bc98-1ced244b8976", principalId: "af01aedf-8831-4485-8046-52d7385b5c5e", insumoId: "cmtswk7z800d58gn0cqhy016w" };
type IdsNuts = typeof IDENTIDADES_NUTS;
type OpcaoNuts = { id: string; grupoId: string; nome: string; preco: string; produtoId: string | null; quantidade: string; composicao: unknown; usarPrecoPadrao: boolean; ordem: number; ativo: boolean };
type ProdutoNuts = { id: string; preco: string; unidade: string; ativo: boolean; versao: number; classificacoes: string[] };
type GrupoNuts = { id: string; nome: string; tipo: string; categoriaId: string | null; ativo: boolean; minimo: number; maximo: number | null; repetir: boolean; versao: number };
export type SnapshotNuts = { grupo: GrupoNuts; opcoes: OpcaoNuts[]; produtos: ProdutoNuts[]; insumoNuts: { id: string; unidade: string; ativo: boolean; excluidoEm: unknown } };
export type PlanoCorrecaoNuts = { hashPlano: string; hashAntes: string; hashDepois: string; antes: SnapshotNuts; depois: SnapshotNuts; entradaGrupo: unknown; evidencias: { precoEfetivoAntes: string; precoEfetivoDepois: string; quantidadeEstoqueKg: string; mudancas: string[] } };
function erro(s: string): never { throw new ErroCorrecaoNuts(s); }
const dinheiro = (s: unknown) => { const d = new Prisma.Decimal(String(s)); if (!d.isFinite() || d.lte(0) || d.decimalPlaces() > 2) erro("Preço efetivo não comprovado ou inválido."); return d.toFixed(2); };
const ordem = (x: unknown): unknown => Array.isArray(x) ? x.map(ordem) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordem(v)])) : x;
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(ordem(x))).digest("hex");
const copiar = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
function componentesCanonicos(v: unknown) {
  if (v == null) return null;
  if (!Array.isArray(v) || v.some(c => !c || typeof c !== "object" || Object.keys(c).some(k => !["insumoId", "quantidade", "unidade", "porcao", "observacaoPorcao", "exibirFicha"].includes(k)))) erro("Composição possui metadados desconhecidos; não normalizar silenciosamente.");
  // null/ausência de porção são equivalentes no serviço oficial. Preservar
  // composição física e os metadados suportados em sua forma canônica.
  return validarComponentes(v);
}
function grupoComOpcoes(grupo: GrupoNuts, opcoes: OpcaoNuts[]) { return { ...grupo, opcoes: opcoes.map(o => ({ ...o, preco: dinheiro(o.preco), quantidade: new Prisma.Decimal(o.quantidade).toString(), composicao: componentesCanonicos(o.composicao) })).sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id)) }; }
export function normalizarSnapshotNuts(e: SnapshotNuts): SnapshotNuts {
  if (!e?.grupo || !Array.isArray(e.opcoes) || !Array.isArray(e.produtos) || !e.insumoNuts) erro("Fotografia comercial incompleta.");
  const { grupo: g } = e;
  return { grupo: { id: g.id, nome: g.nome, tipo: g.tipo, categoriaId: g.categoriaId, ativo: g.ativo, minimo: g.minimo, maximo: g.maximo, repetir: g.repetir, versao: g.versao }, opcoes: grupoComOpcoes(g, e.opcoes).opcoes, produtos: e.produtos.map(p => ({ id: p.id, preco: new Prisma.Decimal(p.preco).toFixed(2), unidade: p.unidade, ativo: p.ativo, versao: p.versao, classificacoes: [...p.classificacoes] })).sort((a, b) => a.id.localeCompare(b.id)), insumoNuts: { id: e.insumoNuts.id, unidade: e.insumoNuts.unidade, ativo: e.insumoNuts.ativo, excluidoEm: e.insumoNuts.excluidoEm } };
}
export function criarPlanoCorrecaoNuts(entrada: SnapshotNuts, ids: IdsNuts = IDENTIDADES_NUTS): PlanoCorrecaoNuts {
  const antes = normalizarSnapshotNuts(entrada), g = antes.grupo;
  if (g.id !== ids.grupoId || !g.ativo || g.tipo !== "COMPLEMENTAR" || !Number.isSafeInteger(g.versao) || g.versao < 1) erro("Grupo comercial esperado indisponível.");
  if (antes.opcoes.some((o, i) => o.grupoId !== g.id || o.ordem !== i) || new Set(antes.opcoes.map(o => o.id)).size !== antes.opcoes.length) erro("Ordem ou identidade de opções diverge; não reordenar automaticamente.");
  const o = antes.opcoes.find(o => o.id === ids.opcaoId), alias = antes.produtos.find(p => p.id === ids.aliasId), principal = antes.produtos.find(p => p.id === ids.principalId);
  if (!o?.ativo || o.produtoId !== ids.aliasId || !alias || alias.ativo || !principal?.ativo || principal.unidade !== "UN") erro("A referência inativa ou o alvo fiscal ativo diverge da auditoria.");
  if (!antes.insumoNuts.ativo || antes.insumoNuts.excluidoEm || antes.insumoNuts.id !== ids.insumoId || antes.insumoNuts.unidade !== "KG") erro("Insumo Nuts indisponível ou unidade alterada.");
  const c = o.composicao as { insumoId: string; unidade: string; quantidade: string }[];
  if (!Array.isArray(c) || c.length !== 1 || c[0].insumoId !== ids.insumoId || c[0].unidade !== "KG" || !new Prisma.Decimal(c[0].quantidade).equals("0.12") || !new Prisma.Decimal(o.quantidade).equals(1)) erro("A porção física não corresponde aos120g documentados.");
  const preco = dinheiro(o.usarPrecoPadrao ? alias.preco : o.preco), depois = copiar(antes), nova = depois.opcoes.find(x => x.id === o.id)!;
  nova.produtoId = null; nova.usarPrecoPadrao = false; nova.preco = preco; depois.grupo.versao++;
  const dto = { ...depois.grupo, versao: antes.grupo.versao, opcoes: depois.opcoes.map(p => ({ id: p.id, nome: p.nome, preco: p.preco, produtoId: p.produtoId, quantidade: p.quantidade, composicao: p.composicao, usarPrecoPadrao: p.usarPrecoPadrao, ativo: p.ativo })) };
  const hashAntes = hash(antes), hashDepois = hash(depois);
  return { hashPlano: hash({ ids, hashAntes, hashDepois, entradaGrupo: dto }), hashAntes, hashDepois, antes, depois, entradaGrupo: dto, evidencias: { precoEfetivoAntes: preco, precoEfetivoDepois: preco, quantidadeEstoqueKg: "0.12", mudancas: ["produtoId da opção: alias inativo → null", "usarPrecoPadrao=false; preço efetivo congelado", "grupo.versao incrementada pelo serviço e histórico antes/depois"] } };
}
export type ResultadoCorrecaoNuts = { plano: PlanoCorrecaoNuts; aplicado: boolean; aplicadoAnteriormente: boolean };
export type DependenciasCorrecaoNuts = { fotografar(tx: Prisma.TransactionClient): Promise<SnapshotNuts>; salvarGrupo(tx: Prisma.TransactionClient, entrada: unknown, autor: { userId: string; nome: string; versao: number }): Promise<unknown> };
export async function corrigirNutsNaTransacao(tx: Prisma.TransactionClient, plano: PlanoCorrecaoNuts, autor: { userId: string; versao: number }, aplicar: boolean, hashEsperado: string | undefined, deps: DependenciasCorrecaoNuts): Promise<ResultadoCorrecaoNuts> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))::text`;
  const u = await tx.usuario.findUnique({ where: { id: autor.userId }, select: { id: true, nome: true, ativo: true, excluidoEm: true, sessaoVersao: true, perfilAcesso: { select: { sistema: true } } } });
  if (!u?.ativo || u.excluidoEm || u.sessaoVersao !== autor.versao || u.perfilAcesso?.sistema !== "ADMINISTRADOR") erro("Administrador real ativo e sessão vigente são obrigatórios.");
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('vendas-cadastros'))::text`;
  const atual = normalizarSnapshotNuts(await deps.fotografar(tx));
  if (hash(atual) === plano.hashDepois) {
    const eventos = await tx.historicoCadastroVenda.findMany({ where: { entidade: "GRUPO", registroId: plano.antes.grupo.id, usuarioId: u.id } });
    const prova = eventos.some(e => { try { const a = e.antes as unknown as GrupoNuts & { opcoes: OpcaoNuts[] }; const d = e.depois as unknown as GrupoNuts & { opcoes: OpcaoNuts[] }; return hash(grupoComOpcoes(a, a.opcoes)) === hash(grupoComOpcoes(plano.antes.grupo, plano.antes.opcoes)) && hash(grupoComOpcoes(d, d.opcoes)) === hash(grupoComOpcoes(plano.depois.grupo, plano.depois.opcoes)); } catch { return false; } });
    if (!prova || aplicar && hashEsperado !== plano.hashPlano) erro("Estado posterior sem recibo comercial do mesmo autor/hash; conferir auditoria.");
    return { plano, aplicado: false, aplicadoAnteriormente: true };
  }
  if (hash(atual) !== plano.hashAntes || aplicar && hashEsperado !== plano.hashPlano) erro("Grupo, opções, preços ou versões mudaram; refazer auditoria e prévia.");
  await deps.salvarGrupo(tx, plano.entradaGrupo, { userId: u.id, nome: u.nome, versao: u.sessaoVersao });
  if (hash(normalizarSnapshotNuts(await deps.fotografar(tx))) !== plano.hashDepois) erro("Serviço alterou campos além da referência/preço congelado; transação revertida.");
  return { plano, aplicado: aplicar, aplicadoAnteriormente: false };
}
class PreviaNutsRevertida extends Error { constructor(readonly resultado: ResultadoCorrecaoNuts) { super("Prévia revertida integralmente."); } }
export async function executarTransacaoNuts(cliente: Pick<PrismaClient, "$transaction">, plano: PlanoCorrecaoNuts, autor: { userId: string; versao: number }, aplicar: boolean, hashEsperado: string | undefined, deps: DependenciasCorrecaoNuts) {
  try { return await cliente.$transaction(async tx => { const r = await corrigirNutsNaTransacao(tx, plano, autor, aplicar, hashEsperado, deps); if (!aplicar) throw new PreviaNutsRevertida(r); return r; }, { timeout: 30000 }); }
  catch (e) { if (e instanceof PreviaNutsRevertida) return e.resultado; throw e; }
}
type ArgsNuts = { aplicar: boolean; entrada: string; usuarioId: string; saida: string; hashPlano?: string; backup?: string };
export function argumentosNuts(args: string[]): ArgsNuts {
  const m = new Map<string, string>(), f = new Set<string>();
  for (const a of args) { if (["--apply", "--dry-run"].includes(a)) { if (f.has(a)) erro("Flag repetida."); f.add(a); continue; } const p = /^--(entrada|usuario-id|saida|hash-plano|backup-comprovante)=(.+)$/.exec(a); if (!p || m.has(p[1])) erro("Argumento desconhecido/repetido."); m.set(p[1], p[2]); }
  if (f.has("--apply") && f.has("--dry-run") || !m.get("entrada") || !/^[A-Za-z0-9_-]{1,100}$/.test(m.get("usuario-id") ?? "")) erro("Entrada privada e administrador real são obrigatórios.");
  return { aplicar: f.has("--apply"), entrada: m.get("entrada")!, usuarioId: m.get("usuario-id")!, saida: m.get("saida") ?? ".tmp/fiscal/nuts-comercial", hashPlano: m.get("hash-plano"), backup: m.get("backup-comprovante") };
}
const dentro = (base: string, p: string) => { const r = path.relative(base, p); return !r.startsWith("..") && !path.isAbsolute(r); };
async function lerPrivado(p: string) { const raiz = path.resolve(".tmp/fiscal"), destino = path.resolve(p); if (!dentro(raiz, destino) || !dentro(await realpath(raiz), await realpath(destino)) || (await stat(destino)).size > 2_000_000) erro("Arquivo deve ficar na área fiscal privada."); return JSON.parse((await readFile(destino, "utf8")).replace(/^\uFEFF/, "")); }
async function saidaPrivada(s: string) { const raiz = path.resolve(".tmp/fiscal"), destino = path.resolve(s); if (!dentro(raiz, destino)) erro("Destino deve ficar na área fiscal privada."); await mkdir(raiz, { recursive: true, mode: 0o700 }); let a = destino; while (true) { try { await stat(a); break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; a = path.dirname(a); } } if (!dentro(await realpath(raiz), await realpath(a))) erro("Destino resolve fora da área privada."); await mkdir(destino, { recursive: true, mode: 0o700 }); return destino; }
async function gravar(destino: string, nome: string, dados: unknown) { const p = path.join(destino, nome), t = JSON.stringify(dados, null, 2); try { await writeFile(p, t, { mode: 0o600, flag: "wx" }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(p, "utf8") !== t) erro("Artefato de auditoria existente diverge."); } }
export async function executarCliNuts(args = process.argv.slice(2)) {
  const o = argumentosNuts(args);
  if (!process.env.DATABASE_URL) erro("Conexão explícita do alvo é obrigatória.");
  if (o.aplicar) { if (process.env.CORRECAO_NUTS_COMERCIAL_APLICACAO_AUTORIZADA !== "SIM" || !/^[a-f0-9]{64}$/.test(o.hashPlano ?? "") || !o.backup) erro("Aplicação exige autorização explícita, hash da prévia e backup privado."); conferirComprovanteClassificacao(await lerPrivado(o.backup)); }
  const plano = criarPlanoCorrecaoNuts(await lerPrivado(o.entrada)), destino = await saidaPrivada(o.saida);
  const { bancoPrincipal } = await import("../src/lib/prisma");
  const { salvarGrupoNaTransacao } = await import("../src/lib/vendas/persistencia");
  const deps: DependenciasCorrecaoNuts = { salvarGrupo: salvarGrupoNaTransacao, async fotografar(tx) {
    const grupo = await tx.grupoComplementoVenda.findUniqueOrThrow({ where: { id: IDENTIDADES_NUTS.grupoId }, include: { opcoes: { orderBy: [{ ordem: "asc" }, { id: "asc" }] } } });
    const ids = plano.antes.produtos.map(p => p.id);
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "ProdutoVenda" WHERE id IN (${Prisma.join(ids)}) FOR SHARE`);
    const produtos = await tx.produtoVenda.findMany({ where: { id: { in: ids } }, select: { id: true, preco: true, unidade: true, ativo: true, versao: true, classificacoes: true } });
    const insumo = await tx.insumo.findUniqueOrThrow({ where: { id: IDENTIDADES_NUTS.insumoId }, select: { id: true, unidade: true, ativo: true, excluidoEm: true } });
    return { grupo, opcoes: grupo.opcoes.map(p => ({ ...p, preco: p.preco.toString(), quantidade: p.quantidade.toString() })), produtos: produtos.map(p => ({ ...p, preco: p.preco.toString() })), insumoNuts: insumo };
  } };
  try {
    const u = await bancoPrincipal.usuario.findUniqueOrThrow({ where: { id: o.usuarioId }, select: { id: true, sessaoVersao: true } });
    const autor = { userId: u.id, versao: u.sessaoVersao };
    const previa = await executarTransacaoNuts(bancoPrincipal, plano, autor, false, undefined, deps);
    await gravar(destino, `plano-${plano.hashPlano}.json`, previa.plano);
    const r = o.aplicar ? await executarTransacaoNuts(bancoPrincipal, plano, autor, true, o.hashPlano, deps) : previa;
    let reciboGravado = false;
    if (r.aplicado || r.aplicadoAnteriormente) try { await gravar(destino, `recibo-${plano.hashPlano}.json`, { hashPlano: plano.hashPlano, hashDepois: plano.hashDepois }); reciboGravado = true; }
    catch { console.error("Correção confirmada no histórico comercial; recibo privado indisponível. Conferir auditoria antes de repetir."); process.exitCode = 1; }
    console.log(JSON.stringify({ modo: o.aplicar ? "APLICAR" : "DRY_RUN", hashPlano: plano.hashPlano, aplicado: r.aplicado, aplicadoAnteriormente: r.aplicadoAnteriormente, reciboGravado, ...plano.evidencias, documentosTransmitidos: 0 }));
  } finally { await bancoPrincipal.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void executarCliNuts().catch(e => { console.error(e instanceof ErroCorrecaoNuts ? e.message : "Correção comercial não confirmada; conferir plano e auditoria privados."); process.exitCode = 1; });
