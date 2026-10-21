/** Configuração, prévias, aprovação e backup contêm dados privados. Nunca carregar .env. */
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { prisma } from "../src/lib/prisma";
import { aplicarReconciliacao, hashReconciliacao, inspecionarFontesReconciliacao, prepararReconciliacao, prepararReversaoReconciliacao, reverterReconciliacao, validarConfiguracaoReconciliacao, type EvidenciaReconciliacao } from "../src/lib/vendas/clientes-cobrancas-reconciliacao";
import { lerJsonCorrecao, prepararSaidaCorrecao, salvarJsonCorrecao, shaArquivoCorrecao } from "./clientes-historicos-arquivos";

export function argumentosReconciliacao(valores: string[]) {
  const args = new Map<string, string>(), permitidos = ["modo", "configuracao", "saida", "previa", "aprovacao", "aprovacao-sha256", "artefato", "artefato-sha256"];
  for (const valor of valores) {
    const m = /^--([a-z][a-z0-9-]*)=(.+)$/.exec(valor);
    if (!m || !permitidos.includes(m[1]) || args.has(m[1])) throw Error("RECONCILIACAO_CLI_ARGUMENTOS_INVALIDOS");
    args.set(m[1], m[2]);
  }
  const obrigatorio = (chave: string) => { const v = args.get(chave); if (!v) throw Error("RECONCILIACAO_CLI_ARGUMENTO_AUSENTE"); return v; };
  const modo = args.get("modo") ?? "previa";
  if (!["fontes", "previa", "aplicar", "previa-reversao", "reverter"].includes(modo)) throw Error("RECONCILIACAO_CLI_MODO_INVALIDO");
  return { modo, obrigatorio };
}
const fixosArtefato = ["prisma/schema.prisma", "tsconfig.json", "package.json", "package-lock.json"];
/** Inventário completo dos diretórios montados; não requer Git ou fontes da interface no runtime. */
export async function conferirArtefatoReconciliacao(arquivo: string, esperado: string, revisaoCodigo: string, raiz = fileURLToPath(new URL("..", import.meta.url))) {
  if (!/^[a-f0-9]{64}$/.test(esperado) || (await shaArquivoCorrecao(arquivo)).sha256 !== esperado) throw Error("RECONCILIACAO_CLI_ARTEFATO_DIVERGENTE");
  const manifesto = await lerJsonCorrecao(arquivo);
  if (manifesto.versao !== 1 || manifesto.revisaoCodigo !== revisaoCodigo || !Array.isArray(manifesto.arquivos) || !manifesto.arquivos.length || manifesto.arquivos.length > 10_000) throw Error("RECONCILIACAO_CLI_ARTEFATO_INVALIDO");
  const inventario: string[] = [...fixosArtefato];
  async function percorrer(relativo: string) {
    for (const item of await readdir(path.join(raiz, relativo), { withFileTypes: true })) {
      const r = `${relativo}/${item.name}`;
      if (item.isSymbolicLink() || !item.isDirectory() && !item.isFile()) throw Error("RECONCILIACAO_CLI_ARTEFATO_CAMINHO_INVALIDO");
      if (item.isDirectory()) await percorrer(r); else inventario.push(r);
    }
  }
  await percorrer("src/lib"); await percorrer("scripts");
  const entradas = manifesto.arquivos as { caminho: unknown; sha256: unknown }[];
  if (entradas.some(a => !a || typeof a !== "object" || typeof a.caminho !== "string" || !inventario.includes(a.caminho) || typeof a.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(a.sha256)) || new Set(entradas.map(a => a.caminho)).size !== entradas.length || entradas.length !== inventario.length) throw Error("RECONCILIACAO_CLI_ARTEFATO_INVENTARIO_DIVERGENTE");
  for (const e of entradas) if ((await shaArquivoCorrecao(path.join(raiz, String(e.caminho)), false)).sha256 !== e.sha256) throw Error("RECONCILIACAO_CLI_ARTEFATO_CONTEUDO_DIVERGENTE");
  return esperado;
}
export async function conferirAprovacaoReconciliacao(arquivo: string, esperado: string, contexto: { modo: string; configuracaoSha256: string; token: string; revisaoCodigo: string; artefatoSha256: string }, agora = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(esperado) || (await shaArquivoCorrecao(arquivo)).sha256 !== esperado) throw Error("RECONCILIACAO_CLI_APROVACAO_DIVERGENTE");
  const a = await lerJsonCorrecao(arquivo);
  const instante = typeof a.geradoEm === "string" ? Date.parse(a.geradoEm) : NaN;
  if (a.versao !== 1 || a.finalidade !== "RECONCILIACAO_CADASTRAL" || a.modo !== contexto.modo || a.configuracaoSha256 !== contexto.configuracaoSha256 || a.token !== contexto.token || a.revisaoCodigo !== contexto.revisaoCodigo || a.artefatoSha256 !== contexto.artefatoSha256 || !Number.isFinite(instante) || instante > agora + 300_000 || agora - instante > 7_200_000) throw Error("RECONCILIACAO_CLI_APROVACAO_INVALIDA");
  if (typeof a.backupArquivo !== "string" || !path.isAbsolute(a.backupArquivo) || typeof a.backupSha256 !== "string" || (await shaArquivoCorrecao(a.backupArquivo)).sha256 !== a.backupSha256) throw Error("RECONCILIACAO_CLI_BACKUP_DIVERGENTE");
  // A prova da aplicação concreta fica no arquivo de aprovação, mantido junto ao backup.
  return { aprovacaoSha256: esperado, backupSha256: a.backupSha256, artefatoSha256: contexto.artefatoSha256 };
}
async function main() {
  if (!process.env.DATABASE_URL) throw Error("RECONCILIACAO_CLI_BANCO_EXPLICITO_EXIGIDO");
  const { modo, obrigatorio } = argumentosReconciliacao(process.argv.slice(2));
  const config = validarConfiguracaoReconciliacao(await lerJsonCorrecao(path.resolve(obrigatorio("configuracao"))));
  const configuracaoSha256 = hashReconciliacao(config), saida = path.resolve(obrigatorio("saida"));
  let token: string | undefined, aprovacao: EvidenciaReconciliacao | undefined;
  if (modo === "aplicar" || modo === "reverter") {
    if (process.env.CLIENTES_RECONCILIACAO_AUTORIZADA !== "SIM") throw Error("RECONCILIACAO_NAO_AUTORIZADA");
    const artefatoSha256 = await conferirArtefatoReconciliacao(path.resolve(obrigatorio("artefato")), obrigatorio("artefato-sha256"), config.revisaoCodigo);
    const previa = await lerJsonCorrecao(path.resolve(obrigatorio("previa")));
    if (previa.modo !== (modo === "aplicar" ? "previa" : "previa-reversao") || previa.operacaoId !== config.operacaoId || previa.configuracaoSha256 !== configuracaoSha256 || typeof previa.token !== "string" || !/^[a-f0-9]{64}$/.test(previa.token)) throw Error("RECONCILIACAO_CLI_PREVIA_DIVERGENTE");
    token = previa.token;
    aprovacao = await conferirAprovacaoReconciliacao(path.resolve(obrigatorio("aprovacao")), obrigatorio("aprovacao-sha256"), { modo, configuracaoSha256, token, revisaoCodigo: config.revisaoCodigo, artefatoSha256 });
  }
  const liberar = await prepararSaidaCorrecao(saida);
  try {
    const resultado = modo === "fontes" ? await inspecionarFontesReconciliacao(config)
      : modo === "previa" ? await prepararReconciliacao(config)
      : modo === "aplicar" ? await aplicarReconciliacao(config, token!, undefined, aprovacao)
      : modo === "previa-reversao" ? await prepararReversaoReconciliacao(config)
      : await reverterReconciliacao(config, token!, undefined, aprovacao);
    const arquivo = `${modo}-${Date.now()}-${randomUUID()}.json`;
    await salvarJsonCorrecao(path.join(saida, arquivo), { ...resultado, modo, operacaoId: config.operacaoId, configuracaoSha256, ...(aprovacao ? { aprovacao } : {}), geradoEm: new Date().toISOString() });
    console.log(JSON.stringify({ modo, arquivoGravado: arquivo, concluido: true }));
  } finally { await liberar(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(e => {
  const codigo = e instanceof Error && /^RECONCILIACAO_[A-Z0-9_]{1,100}$/.test(e.message) ? e.message : "RECONCILIACAO_CLI_INTERROMPIDA";
  console.error(JSON.stringify({ codigo })); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
