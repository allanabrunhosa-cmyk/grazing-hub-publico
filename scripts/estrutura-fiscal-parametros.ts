/** Administração cadastral por serviços. Não importa clientes de emissão. */
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { argumentosClassificacao, conferirAplicacaoClassificacao } from "./estrutura-fiscal-classificacao-catalogo";
import type { SessaoAtual } from "../src/lib/session";
const dentro = (base: string, p: string) => { const r = path.relative(base, p); return !r.startsWith("..") && !path.isAbsolute(r); };
async function lerPrivado(p: string) {
  const base = await realpath(".tmp/fiscal"), destino = await realpath(p);
  if (!dentro(base, destino) || (await stat(destino)).size > 40_000_000) throw new Error("Arquivo fora do diretório fiscal privado.");
  return JSON.parse((await readFile(destino, "utf8")).replace(/^\uFEFF/, ""));
}
export async function executarParametrosFiscais(args = process.argv.slice(2)) {
  const o = argumentosClassificacao(args);
  await conferirAplicacaoClassificacao(o);
  const entrada = await lerPrivado(o.entrada), ncm = await lerPrivado(o.tabelaNcm);
  const destino = path.resolve(o.saida);
  if (!dentro(path.resolve(".tmp/fiscal"), destino)) throw new Error("Saída fora do diretório fiscal privado.");
  let ancestral = destino;
  while (true) { try { await stat(ancestral); break; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; ancestral = path.dirname(ancestral); } }
  if (!dentro(await realpath(".tmp/fiscal"), await realpath(ancestral))) throw new Error("Saída resolve fora do diretório fiscal privado.");
  await mkdir(destino, { recursive: true, mode: 0o700 });
  if (!dentro(await realpath(".tmp/fiscal"), await realpath(destino))) throw new Error("Saída privada inválida.");
  if (!process.env.DATABASE_URL) throw new Error("Alvo explícito obrigatório.");
  const { bancoPrincipal } = await import("../src/lib/prisma");
  const { converterTabelaNcmOficial } = await import("../src/lib/tributacao/servico");
  const { simularParametrosFiscais, aplicarParametrosFiscais, validarLoteParametrosFiscais } = await import("../src/lib/tributacao/lote-parametros");
  try {
    const reorganizar = (entrada as { politicaGrupos?: string }).politicaGrupos === "QUATRO_GRUPOS";
    const grupos = reorganizar ? await import("../src/lib/tributacao/lote-grupos-operacionais") : null;
    const lote = grupos ? grupos.validarLoteGruposOperacionais(entrada) : validarLoteParametrosFiscais(entrada);
    const tabela = converterTabelaNcmOficial(ncm, lote.vigenciaInicio), codigos = new Set(tabela.linhas.map(l => l.codigo));
    for (const v of ("versoes" in lote ? lote.versoes : [])) if (v.tipo === "CLASSIFICACAO") {
      const c = v.dados as { ncm?: string; configuracaoNcm?: { cenarios: { ncm?: string }[] } };
      if ([c.ncm, ...(c.configuracaoNcm?.cenarios.map(s => s.ncm) ?? [])].some(n => n && !codigos.has(n))) throw new Error("NCM fora da tabela oficial vigente.");
    }
    const u = await bancoPrincipal.usuario.findUnique({ where: { id: o.usuarioId }, include: { perfilAcesso: true } });
    if (!u?.ativo || u.excluidoEm || u.perfilAcesso?.sistema !== "ADMINISTRADOR") throw new Error("Administrador real ativo obrigatório.");
    const sessao: SessaoAtual = { userId: u.id, nome: u.nome, email: u.email, versao: u.sessaoVersao, admin: true, permissoes: {}, excecoes: {}, perfilNome: u.perfilAcesso.nome };
    const resultado = grupos
      ? o.aplicar ? await grupos.aplicarGruposOperacionais(lote, o.hashPlano!, sessao, bancoPrincipal) : await grupos.simularGruposOperacionais(lote, sessao, bancoPrincipal)
      : o.aplicar ? await aplicarParametrosFiscais(lote, o.hashPlano!, sessao, bancoPrincipal) : await simularParametrosFiscais(lote, sessao, bancoPrincipal);
    const modo = o.aplicar ? "aplicacao" : "simulacao";
    await writeFile(path.join(destino, `${modo}-${resultado.hashPlano}.json`), JSON.stringify(resultado, null, 2), { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ modo, ...resultado, ...("versoes" in resultado ? { versoes: resultado.versoes.length } : {}), documentosTransmitidos: 0 }));
  } finally { await bancoPrincipal.$disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) void executarParametrosFiscais().catch(() => { console.error("Operação não confirmada. Confira o plano e a auditoria privados. Credenciais protegidas."); process.exitCode = 1; });
