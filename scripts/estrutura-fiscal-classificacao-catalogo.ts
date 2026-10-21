/** Carga pela mesma camada de serviços do HUB. Não transmite documentos ou habilita emissor. */
import { readFile, mkdir, realpath, stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { SessaoAtual } from "../src/lib/session";
export class ErroCargaClassificacao extends Error {}
export type ArgumentosClassificacao = { aplicar: boolean; entrada: string; tabelaNcm: string; usuarioId: string; saida: string; hashPlano?: string; backupComprovante?: string };
function erro(texto: string): never { throw new ErroCargaClassificacao(texto); }
export function argumentosClassificacao(args: string[]): ArgumentosClassificacao {
  const v = new Map<string, string>(), f = new Set<string>();
  for (const a of args) {
    if (["--apply", "--dry-run"].includes(a)) { if (f.has(a)) erro("Flag repetida."); f.add(a); continue; }
    const m = /^--(entrada|tabela-ncm|usuario-id|hash-plano|backup-comprovante|saida)=(.+)$/.exec(a);
    if (!m || v.has(m[1])) erro("Argumento desconhecido ou repetido."); v.set(m[1], m[2]);
  }
  if (f.has("--apply") && f.has("--dry-run")) erro("Prévia e aplicação são operações distintas.");
  if (!v.get("entrada") || !v.get("tabela-ncm") || !/^[A-Za-z0-9_-]{1,100}$/.test(v.get("usuario-id") ?? "")) erro("Informar entrada privada, tabela NCM oficial e administrador real, inclusive na prévia.");
  return { aplicar: f.has("--apply"), entrada: v.get("entrada")!, tabelaNcm: v.get("tabela-ncm")!, usuarioId: v.get("usuario-id")!, saida: v.get("saida") ?? ".tmp/fiscal/classificacao-catalogo", hashPlano: v.get("hash-plano"), backupComprovante: v.get("backup-comprovante") };
}
export function conferirComprovanteClassificacao(b: unknown, agora = Date.now()) {
  const r = b as { verificado?: boolean; autorizacaoImplantacao?: boolean; hashDump?: string; criadoEm?: string };
  const idade = agora - Date.parse(r?.criadoEm ?? "");
  if (!r || r.verificado !== true || r.autorizacaoImplantacao !== true || !/^[a-f0-9]{64}$/.test(r.hashDump ?? "") || !Number.isFinite(idade) || idade < 0 || idade > 86400000) erro("Comprovante de backup verificado/autorização inválido ou vencido.");
}
export async function conferirAplicacaoClassificacao(o: ArgumentosClassificacao, ambiente: NodeJS.ProcessEnv = process.env) {
  if (!o.aplicar) return;
  if (ambiente.CLASSIFICACAO_FISCAL_APLICACAO_AUTORIZADA !== "SIM" || !/^[a-f0-9]{64}$/.test(o.hashPlano ?? "") || !o.backupComprovante) erro("Aplicação exige autorização explícita, hash da prévia e comprovante privado de backup.");
  conferirComprovanteClassificacao(await lerPrivado(o.backupComprovante));
}
const dentro = (base: string, p: string) => { const r = path.relative(base, p); return !r.startsWith("..") && !path.isAbsolute(r); };
async function lerPrivado(arquivo: string): Promise<unknown> {
  const raiz = path.resolve(".tmp/fiscal"), p = path.resolve(arquivo);
  if (!dentro(raiz, p) || !dentro(await realpath(raiz), await realpath(p)) || (await stat(p)).size > 40_000_000) erro("Arquivo deve permanecer no diretório fiscal privado e dentro do limite de tamanho.");
  return JSON.parse((await readFile(p, "utf8")).replace(/^\uFEFF/, ""));
}
async function prepararSaida(saida: string) {
  const raiz = path.resolve(".tmp/fiscal"), destino = path.resolve(saida);
  if (!dentro(raiz, destino)) erro("Planos e recibos devem permanecer em .tmp/fiscal.");
  await mkdir(raiz, { recursive: true, mode: 0o700 });
  let existente = destino;
  while (true) { try { await stat(existente); break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; existente = path.dirname(existente); } }
  if (!dentro(await realpath(raiz), await realpath(existente))) erro("Destino privado resolve fora da área fiscal.");
  await mkdir(destino, { recursive: true, mode: 0o700 }); return destino;
}
export function serializarArtefatoClassificacao(dados: unknown): string {
  const ordenar = (v: unknown): unknown => Array.isArray(v) ? v.map(ordenar) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,ordenar(v)])) : v;
  return JSON.stringify(ordenar(dados), null, 2);
}
async function guardar(destino: string, nome: string, dados: unknown) {
  const p = path.join(destino, nome), texto = serializarArtefatoClassificacao(dados);
  try { await writeFile(p, texto, { mode: 0o600, flag: "wx" }); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") erro("Artefato privado indisponível; conferir auditoria sem reaplicar cegamente.");
    let anterior: string; try { anterior = serializarArtefatoClassificacao(JSON.parse(await readFile(p, "utf8"))); } catch { erro("Artefato privado existente inválido; conferir auditoria sem reaplicar cegamente."); }
    if (anterior !== texto) erro("Artefato privado existente diverge; conferir auditoria sem reaplicar cegamente.");
  }
}
export async function executarCliClassificacao(args: string[] = process.argv.slice(2)) {
  const o = argumentosClassificacao(args); await conferirAplicacaoClassificacao(o);
  if (!process.env.DATABASE_URL) erro("Conexão explícita do alvo é obrigatória; não imprimir credenciais.");
  const entrada = await lerPrivado(o.entrada), oficial = await lerPrivado(o.tabelaNcm), destino = await prepararSaida(o.saida);
  const { converterTabelaNcmOficial } = await import("../src/lib/tributacao/servico");
  const { hojeFiscal } = await import("../src/lib/tributacao/validacao");
  const { preverLoteClassificacaoFiscal, aplicarLoteClassificacaoFiscal } = await import("../src/lib/tributacao/lote-classificacao");
  const { bancoPrincipal } = await import("../src/lib/prisma");
  try {
    const u = await bancoPrincipal.usuario.findUnique({ where: { id: o.usuarioId }, select: { id: true, nome: true, email: true, ativo: true, excluidoEm: true, sessaoVersao: true, perfilAcesso: { select: { nome: true, sistema: true } } } });
    if (!u?.ativo || u.excluidoEm || u.perfilAcesso?.sistema !== "ADMINISTRADOR") erro("Administrador real ativo é obrigatório; a flag de implantação não concede permissão.");
    const sessao: SessaoAtual = { userId: u.id, nome: u.nome, email: u.email, versao: u.sessaoVersao, admin: true, permissoes: {}, excecoes: {}, perfilNome: u.perfilAcesso.nome };
    const tabela = converterTabelaNcmOficial(oficial, (entrada as { vigenciaInicio?: string }).vigenciaInicio ?? hojeFiscal());
    const previa = await preverLoteClassificacaoFiscal(entrada, tabela, sessao, bancoPrincipal);
    await guardar(destino, `plano-${previa.plano.hashPlano}.json`, previa.plano);
    const r = o.aplicar ? await aplicarLoteClassificacaoFiscal(entrada, tabela, sessao, o.hashPlano!, bancoPrincipal) : previa;
    let reciboGravado = false;
    if (r.aplicado || r.aplicadoAnteriormente) try { await guardar(destino, `recibo-${r.plano.hashPlano}.json`, { hashPlano: r.plano.hashPlano, versoes: r.versoes }); reciboGravado = true; } catch { console.error("Lote confirmado na auditoria fiscal; recibo privado indisponível. Conferir auditoria antes de repetir."); process.exitCode = 1; }
    console.log(JSON.stringify({ modo: o.aplicar ? "APLICAR" : "DRY_RUN", hashPlano: r.plano.hashPlano, ...r.plano.resumo, aplicado: r.aplicado, aplicadoAnteriormente: r.aplicadoAnteriormente, reciboGravado, documentosTransmitidos: 0 }));
  } finally { await bancoPrincipal.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void executarCliClassificacao().catch(e => { console.error(e instanceof ErroCargaClassificacao ? e.message : "Carga fiscal não confirmada; conferir plano, alvo e auditoria privados sem expor credenciais."); process.exitCode = 1; });
