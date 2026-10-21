/** Manutenção autorizada. Não carrega .env, não recebe senha e não imprime dados pessoais. */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/lib/prisma";
import { validarPacoteHistorico, hashCanonico } from "../src/lib/vendas/historico-dominio";
import { aplicarComplementoPacote } from "../src/lib/vendas/historico-complemento";
import { prepararImportacaoHistorica, executarImportacaoHistorica, reverterImportacaoHistorica, type GuardasImportacaoHistorica } from "../src/lib/vendas/historico-importacao";

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("Prova ou arquivo de execução inválido.");
  return v as Objeto;
};
const ler = async (p: string) => objeto(JSON.parse(await readFile(p, "utf8")));
async function sha(p: string) { const h = createHash("sha256"); for await (const parte of createReadStream(p)) h.update(parte); return h.digest("hex"); }
async function salvar(p: string, v: unknown) { await mkdir(path.dirname(p), { recursive: true, mode: 0o700 }); await writeFile(p, JSON.stringify(v, null, 2), { mode: 0o600 }); }
export function conferirProva(v: Objeto) {
  const esperado = objeto(v.expected), restaurado = objeto(v.restored);
  const semPortas = v.portsPublished === false || v.portsPublished === 0 || Array.isArray(v.portsPublished) && v.portsPublished.length === 0;
  if (!Object.keys(esperado).length || v.equal !== true || hashCanonico(esperado) !== hashCanonico(restaurado)
      || v.containerNetwork !== "none" || v.jobsActivated !== false || !semPortas) throw Error("A restauração isolada não atende às condições de segurança.");
  for (const t of Object.values(esperado)) { const s = objeto(t); if (!Number.isSafeInteger(s.count) || !/^[a-f0-9]{32}$/.test(String(s.md5))) throw Error("Fingerprint de restauração inválido."); }
}
export async function conferirBackups(pasta: string, conferenciaSha256: string): Promise<GuardasImportacaoHistorica> {
  const report = await ler(path.join(pasta, "report.json"));
  const hub = await ler(path.join(pasta, "hub-restauracao-prova.json")); conferirProva(hub);
  const atendimento = await ler(path.join(pasta, "atendimento-restauracao-prova.json"));
  if (!Array.isArray(atendimento.databases) || atendimento.databases.length !== 2) throw Error("Provas do Atendimento incompletas.");
  atendimento.databases.forEach(v => conferirProva(objeto(v)));
  if (!Array.isArray(report.databases) || report.databases.length !== 3) throw Error("Backup das três bases obrigatório.");
  const provas = [hub, ...atendimento.databases.map(objeto)];
  const bancos = ["grazing_hub", "donatella_operacao", "donatella_entrada"].sort();
  const declarados = report.databases.map(objeto);
  if (hashCanonico(declarados.map(d => d.database).sort()) !== hashCanonico(bancos)
      || hashCanonico(provas.map(p => p.database).sort()) !== hashCanonico(bancos)
      || new Set(declarados.map(d => d.sha256)).size !== 3 || new Set(provas.map(p => p.dumpSha256)).size !== 3
      || provas.some(p => objeto(p.snapshot).db !== p.database)) throw Error("As três bases devem ter dumps e restaurações distintos e correspondentes.");
  for (const bruto of report.databases) {
    const d = objeto(bruto), dump = path.join(pasta, path.basename(String(d.dump)));
    if (d.restoreVerified !== true || typeof d.sha256 !== "string" || await sha(dump) !== d.sha256
        || provas.filter(p => p.database === d.database && p.dumpSha256 === d.sha256).length !== 1) throw Error("Dump e prova de restauração não coincidem.");
  }
  const manifestoAtendimento = await ler(path.join(pasta, "atendimento-backups-manifesto.json"));
  if (!Array.isArray(manifestoAtendimento.databases) || manifestoAtendimento.databases.length !== 2) throw Error("Manifesto dos backups do Atendimento incompleto.");
  const manifestados = manifestoAtendimento.databases.map(objeto);
  if (hashCanonico(manifestados.map(d => d.database).sort()) !== hashCanonico(["donatella_entrada", "donatella_operacao"])
      || manifestados.some(d => provas.filter(p => p.database === d.database && p.dumpSha256 === d.sha256).length !== 1)) throw Error("O manifesto do Atendimento não corresponde às restaurações.");
  const baseline = await ler(path.join(pasta, "baseline-protecao.json"));
  const baseHub = objeto(baseline.hubBaseline), protegidos = objeto(baseline.protectedBalances);
  if (!Object.keys(objeto(baseHub.tables)).length || !Array.isArray(baseHub.sequences) || !Object.keys(objeto(baseHub.balances)).length
      || !Object.keys(protegidos).length || objeto(baseHub.checkpoint).db !== "grazing_hub") throw Error("Baseline financeira, de estoque e sequências obrigatória.");
  const guardas = await ler(path.join(pasta, "guardas-disponiveis.json"));
  const calculadas = {
    backupHubSha256: String(hub.dumpSha256),
    restauracaoHubSha256: await sha(path.join(pasta, "hub-restauracao-prova.json")),
    backupAtendimentoSha256: await sha(path.join(pasta, "atendimento-backups-manifesto.json")),
    restauracaoAtendimentoSha256: await sha(path.join(pasta, "atendimento-restauracao-prova.json")),
    baselineSha256: await sha(path.join(pasta, "baseline-protecao.json")), conferenciaSha256,
  };
  for (const [k, v] of Object.entries(calculadas)) if (k !== "conferenciaSha256" && guardas[k] !== v) throw Error("As provas de segurança mudaram. Refaça a conferência.");
  return calculadas;
}
export const ARQUIVOS_CODIGO_HISTORICO = ["scripts/historico-importar.ts", "src/lib/vendas/historico-dominio.ts", "src/lib/vendas/historico-complemento.ts", "src/lib/vendas/historico-importacao.ts", "src/lib/vendas/persistencia.ts", "src/lib/vendas/dominio.ts", "prisma/schema.prisma", "prisma/migrations/20261015020000_pedidos_historicos/migration.sql"] as const;
export async function conferirVerificacoes(p: string, fonteSha256: string, pacoteSha256: string, revisao: string, manifestoPublicacao: string, complementoSha256: string | null = null) {
  const v = await ler(p);
  const publicado = await ler(manifestoPublicacao);
  if (!/^[a-f0-9]{40}$/.test(revisao) || v.revisao !== revisao || publicado.revisao !== revisao || v.fonteSha256 !== fonteSha256 || v.pacoteSha256 !== pacoteSha256 || (v.complementoSha256 ?? null) !== complementoSha256 || !Array.isArray(v.verificacoes)) throw Error("Verificações não correspondem à fonte e à revisão publicada.");
  const codigo = objeto(v.codigo), codigoPublicado = objeto(publicado.codigo), chaves = Object.keys(codigo).sort();
  if (hashCanonico(chaves) !== hashCanonico([...ARQUIVOS_CODIGO_HISTORICO].sort()) || hashCanonico(codigo) !== hashCanonico(codigoPublicado)) throw Error("O manifesto não identifica todos os arquivos de execução.");
  for (const arquivo of ARQUIVOS_CODIGO_HISTORICO) if (await sha(path.resolve(arquivo)) !== codigo[arquivo]) throw Error("O código em execução difere da revisão verificada.");
  for (const nome of ["lint", "tipos", "build", "integracao", "reconciliacao", "simulacao"]) {
    const r = v.verificacoes.map(objeto).find(x => x.nome === nome);
    if (!r || r.resultado !== "APROVADO" || typeof r.log !== "string" || await sha(r.log) !== r.sha256) throw Error(`A verificação ${nome} não foi comprovada.`);
  }
  return v;
}
async function main() {
  const args = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    const m = /^--(modo|pacote|fonte|backups|usuario-id|sessao-versao|lote|previa|verificacoes|revisao|publicacao|saida|complemento)=(.+)$/.exec(a);
    if (!m || args.has(m[1])) throw Error("Argumentos da execução histórica inválidos."); args.set(m[1], m[2]);
  }
  const obrigatorio = (k: string) => { const v = args.get(k); if (!v) throw Error(`Informe --${k}.`); return v; };
  const modo = args.get("modo") ?? "previa";
  if (!["previa", "aplicar", "reverter"].includes(modo)) throw Error("Modo histórico inválido.");
  const saida = path.resolve(obrigatorio("saida"));
  // Impede que cargas e conferências acabem no código versionado.
  if (!saida.split(path.sep).some(s => s === ".tmp" || s === "backups")) throw Error("Use uma pasta privada .tmp ou backups para os arquivos de execução.");
  const pacotePath = path.resolve(obrigatorio("pacote")), pacoteSha256 = await sha(pacotePath);
  const principal = validarPacoteHistorico(JSON.parse(await readFile(pacotePath, "utf8")));
  const complementoPath = args.get("complemento") ? path.resolve(args.get("complemento")!) : null;
  const complementoSha256 = complementoPath ? await sha(complementoPath) : null;
  const pacote = complementoPath ? aplicarComplementoPacote(principal, JSON.parse(await readFile(complementoPath, "utf8")), { fonteSha256: principal.metadados.sha256, pacoteSha256 }) : principal;
  if (await sha(path.resolve(obrigatorio("fonte"))) !== pacote.metadados.sha256) throw Error("O Excel não corresponde ao pacote normalizado.");
  const conferenciaSha256 = complementoSha256 ? hashCanonico({ pacoteSha256, complementoSha256 }) : pacoteSha256;
  const guardas = await conferirBackups(path.resolve(obrigatorio("backups")), conferenciaSha256);
  const contexto = { usuarioId: obrigatorio("usuario-id"), sessaoVersao: Number(obrigatorio("sessao-versao")), loteId: args.get("lote") ?? pacote.metadados.lote_proposto, guardas };
  if (modo !== "previa") {
    if (process.env.HISTORICO_IMPORTACAO_AUTORIZADA !== "SIM") throw Error("A escrita exige autorização operacional explícita nesta execução.");
    await conferirVerificacoes(path.resolve(obrigatorio("verificacoes")), pacote.metadados.sha256, pacoteSha256, obrigatorio("revisao"), path.resolve(obrigatorio("publicacao")), complementoSha256);
  }
  const resultado = modo === "reverter" ? await reverterImportacaoHistorica(contexto) : modo === "aplicar"
    ? await executarImportacaoHistorica({ ...contexto, pacote, tokenPrevia: String((await ler(path.resolve(obrigatorio("previa")))).token) })
    : await prepararImportacaoHistorica({ ...contexto, pacote });
  await salvar(path.join(saida, `${modo}.json`), { ...resultado, fonteSha256: pacote.metadados.sha256, pacoteSha256, complementoSha256, conferenciaSha256, loteId: contexto.loteId, geradoEm: new Date().toISOString() });
  // O resumo nunca contém nomes, telefones, notas, saldos, credenciais ou payloads.
  console.log(JSON.stringify({ modo, loteId: contexto.loteId, fonteSha256: pacote.metadados.sha256, arquivoGravado: `${modo}.json`, concluido: true }));
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(erro => {
  const codigo = erro && typeof erro === "object" && "code" in erro && /^[A-Z0-9_]{2,60}$/.test(String(erro.code)) ? String(erro.code) : erro instanceof Error && /^HISTORICO_[A-Z0-9_]+$/.test(erro.message) ? erro.message : "HISTORICO_EXECUCAO_INTERROMPIDA";
  console.error(JSON.stringify({ codigo, mensagem: "A execução foi interrompida. Confira as provas e o estado do lote antes de repetir." })); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
