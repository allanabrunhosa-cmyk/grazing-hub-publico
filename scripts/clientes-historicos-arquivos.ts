import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath, readFile, mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import { hashCanonico } from "../src/lib/vendas/historico-dominio";
import type { GuardasImportacaoHistorica } from "../src/lib/vendas/historico-importacao";
import type { ManifestoEmpresasHistoricas } from "../src/lib/vendas/clientes-correcao-dominio";

type Objeto = Record<string, unknown>;
export const objetoCorrecao = (v: unknown): Objeto => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw Error("CORRECAO_ARQUIVO_OBJETO_INVALIDO");
  return v as Objeto;
};
const hex = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
function erro(codigo: string): never { throw Error(`CORRECAO_ARQUIVO_${codigo}`); }
async function conferirCaminho(p: string, diretorio = false, privado = true) {
  if (!path.isAbsolute(p) || path.resolve(p) !== p || await realpath(p) !== p) erro("CAMINHO_RECUSADO");
  const s = await lstat(p);
  if (s.isSymbolicLink() || (diretorio ? !s.isDirectory() : !s.isFile()) || privado && process.platform !== "win32" && (s.mode & 0o077) !== 0) erro("PERMISSAO_RECUSADA");
  return s;
}
export async function shaArquivoCorrecao(p: string, privado = true) {
  const antes = await conferirCaminho(p, false, privado), h = createHash("sha256"); let bytes = 0;
  for await (const parte of createReadStream(p)) { bytes += parte.length; if (bytes > antes.size) erro("MUDOU_DURANTE_LEITURA"); h.update(parte); }
  const depois = await lstat(p);
  if (bytes !== antes.size || antes.size !== depois.size || antes.mtimeMs !== depois.mtimeMs || antes.ino !== depois.ino) erro("MUDOU_DURANTE_LEITURA");
  return { sha256: h.digest("hex"), bytes };
}
export async function lerJsonCorrecao(p: string, maximo = 30_000_000) {
  const s = await conferirCaminho(p); if (s.size > maximo) erro("TAMANHO_RECUSADO");
  return objetoCorrecao(JSON.parse(await readFile(p, "utf8")));
}
async function sincronizar(p: string) { if (process.platform === "win32") return; const f = await open(p, "r"); try { await f.sync(); } finally { await f.close(); } }
export async function prepararSaidaCorrecao(p: string) {
  if (!path.isAbsolute(p) || path.resolve(p) !== p || !p.split(path.sep).some(v => v === "backups" || v === ".tmp")) erro("SAIDA_RECUSADA");
  let ancestral = p;
  while (true) {
    try { await lstat(ancestral); break; }
    catch (e) { if (!(e && typeof e === "object" && "code" in e && e.code === "ENOENT")) throw e; const pai = path.dirname(ancestral); if (pai === ancestral) erro("SAIDA_RECUSADA"); ancestral = pai; }
  }
  await conferirCaminho(ancestral, true, false);
  await mkdir(p, { recursive: true, mode: 0o700 }); await conferirCaminho(p, true);
  const travaPath = path.join(p, "processo.lock"), trava = await open(travaPath, "wx", 0o600); await trava.sync(); await sincronizar(p);
  return async () => { await trava.close(); await unlink(travaPath); await sincronizar(p); };
}
export async function salvarJsonCorrecao(p: string, valor: unknown) {
  await conferirCaminho(path.dirname(p), true);
  const f = await open(p, "wx", 0o600);
  try { await f.writeFile(JSON.stringify(valor, null, 2) + "\n"); await f.sync(); } finally { await f.close(); }
  await sincronizar(path.dirname(p));
}
function fresco(v: unknown, agora: number) {
  const em = typeof v === "string" ? Date.parse(v) : NaN;
  if (!Number.isFinite(em) || em > agora + 300_000 || agora - em > 7_200_000) erro("GUARDA_EXPIRADA");
}
function resumo(v: unknown) {
  const r = objetoCorrecao(v);
  if (Object.keys(r).some(k => !["schemaSha256", "rowsSha256", "sequencesSha256", "tabelas"].includes(k)) || !hex(r.schemaSha256) || !hex(r.rowsSha256) || !hex(r.sequencesSha256) || !Number.isSafeInteger(r.tabelas) || Number(r.tabelas) < 1) erro("RESTAURACAO_RESUMO_INVALIDO");
  return r;
}
export function conferirBaselineCorrecao(v: unknown, agora = Date.now()) {
  const b = objetoCorrecao(v), c = objetoCorrecao(b.checkpoint), tabelas = objetoCorrecao(b.tabelas), saldos = objetoCorrecao(b.balances);
  if (b.versao !== 1 || c.db !== "grazing_hub" || ![true, "on"].includes(c.readonly as boolean | string) || typeof c.snapshot !== "string" || !c.snapshot || String(c.isolamento).replaceAll("_", " ").toLowerCase() !== "repeatable read" || !Array.isArray(b.sequencias) || !b.sequencias.length) erro("BASELINE_INVALIDA");
  fresco(c.instante, agora);
  const protegidas = ["ContaBancaria", "LancamentoFinanceiro", "MovimentacaoBancaria", "SaldoEstoque", "MovimentacaoEstoque", "ReservaPedido", "CreditoClienteMovimento", "PagamentoExternoPedido", "RepassePagamentoPedido", "LiquidacaoCartao", "FaturaCartao", "TratamentoFinanceiroPedido"];
  for (const nome of protegidas) {
    const f = objetoCorrecao(objetoCorrecao(tabelas[nome]).fingerprint);
    if (!/^\d+$/.test(String(f.quantidade)) || !/^[a-f0-9]{32}$/.test(String(f.digest))) erro("BASELINE_COBERTURA_INVALIDA");
  }
  for (const nome of ["aberturasDeclaradasSha256", "saldoAtualOficialSha256", "saldoMarcoCalculadoSha256", "estoqueMarcoSha256", "estoqueAtualQuantidadeECustoSha256", "baselineOriginalSha256", "saldosOriginaisProtegidosSha256"]) if (!hex(saldos[nome])) erro("BASELINE_SALDOS_INVALIDOS");
  if (typeof saldos.marcoOperacionalUTC !== "string" || !Number.isFinite(Date.parse(saldos.marcoOperacionalUTC))) erro("BASELINE_MARCO_INVALIDO");
  for (const s of b.sequencias) {
    const seq = objetoCorrecao(s);
    if (typeof seq.schemaname !== "string" || typeof seq.sequencename !== "string" || !/^-?\d+$/.test(String(seq.valor)) || typeof seq.chamado !== "boolean") erro("BASELINE_SEQUENCIA_INVALIDA");
  }
}
export async function conferirGuardasCorrecao(p: string, esperado: string, conferenciaSha256: string, agora = Date.now()): Promise<GuardasImportacaoHistorica> {
  if (!hex(esperado) || !hex(conferenciaSha256) || (await shaArquivoCorrecao(p)).sha256 !== esperado) erro("GUARDA_HASH_DIVERGENTE");
  const g = await lerJsonCorrecao(p), base = path.dirname(p); await conferirCaminho(base, true);
  if (g.versao !== 1 || g.finalidade !== "CORRECAO_CLIENTES_HISTORICOS") erro("GUARDA_FINALIDADE_INVALIDA"); fresco(g.geradoEm, agora);
  async function referencia(v: unknown) {
    const r = objetoCorrecao(v);
    if (typeof r.arquivo !== "string" || !r.arquivo.startsWith(base + path.sep) || !hex(r.sha256) || (await shaArquivoCorrecao(r.arquivo)).sha256 !== r.sha256) erro("REFERENCIA_DIVERGENTE");
    return { conteudo: await lerJsonCorrecao(r.arquivo, 50_000_000), sha256: r.sha256 as string };
  }
  const m = await referencia(g.backupManifesto), r = await referencia(g.restauracao), b = await referencia(g.baseline);
  fresco(m.conteudo.geradoEm, agora); fresco(r.conteudo.geradoEm, agora);
  if (m.conteudo.versao !== 1 || r.conteudo.versao !== 1 || !Array.isArray(m.conteudo.bancos) || m.conteudo.bancos.length !== 3 || !Array.isArray(r.conteudo.bancos) || r.conteudo.bancos.length !== 3 || r.conteudo.network !== "none" || r.conteudo.portsPublished !== 0 || r.conteudo.jobsActivated !== false || r.conteudo.restoreVerified !== true) erro("RESTAURACAO_INVALIDA");
  const bancos = { hub: "grazing_hub", "atendimento-operacao": "donatella_operacao", entrada: "donatella_entrada" }, hashes = new Set<string>(); let hubSha = "";
  for (const [papel, database] of Object.entries(bancos)) {
    const ms = m.conteudo.bancos.map(objetoCorrecao).filter(v => v.papel === papel), rs = r.conteudo.bancos.map(objetoCorrecao).filter(v => v.papel === papel);
    if (ms.length !== 1 || rs.length !== 1) erro("BANCO_REPETIDO"); const item = ms[0], prova = rs[0];
    if (item.database !== database || prova.database !== database || typeof item.arquivo !== "string" || !item.arquivo.startsWith(base + path.sep) || !hex(item.sha256) || hashes.has(item.sha256) || !Number.isSafeInteger(item.bytes) || Number(item.bytes) < 1 || typeof item.snapshotId !== "string" || !item.snapshotId || !hex(item.expectedSha256) || prova.dumpSha256 !== item.sha256 || prova.restoreVerified !== true) erro("BANCO_DIVERGENTE");
    hashes.add(item.sha256);
    const esperadoResumo = resumo(prova.expected), restaurado = resumo(prova.restored);
    if (hashCanonico(esperadoResumo) !== hashCanonico(restaurado) || hashCanonico(esperadoResumo) !== item.expectedSha256) erro("RESTAURACAO_DIVERGENTE");
    const dump = await shaArquivoCorrecao(item.arquivo);
    if (dump.sha256 !== item.sha256 || dump.bytes !== item.bytes) erro("DUMP_DIVERGENTE");
    if (papel === "hub") hubSha = item.sha256;
  }
  conferirBaselineCorrecao(b.conteudo, agora);
  return { backupHubSha256: hubSha, restauracaoHubSha256: r.sha256, backupAtendimentoSha256: m.sha256, restauracaoAtendimentoSha256: r.sha256, baselineSha256: b.sha256, conferenciaSha256 };
}
export async function conferirProvasEmpresas(manifesto: ManifestoEmpresasHistoricas, pasta: string) {
  await conferirCaminho(pasta, true);
  for (const empresa of manifesto.empresas) for (const prova of empresa.provas) {
    const arquivo = await shaArquivoCorrecao(path.join(pasta, prova.arquivo));
    if (arquivo.bytes < 1 || arquivo.sha256 !== prova.arquivoSha256) erro("PROVA_EMPRESA_DIVERGENTE");
  }
}
export const CODIGO_CORRECAO_CLIENTES = ["Dockerfile", "scripts/clientes-historicos-corrigir.ts", "scripts/clientes-historicos-arquivos.ts", "src/lib/vendas/clientes-correcao.ts", "src/lib/vendas/clientes-correcao-dominio.ts", "src/lib/vendas/clientes-identidade.ts", "src/lib/vendas/historico-importacao.ts", "src/lib/vendas/historico-dominio.ts", "src/lib/vendas/historico-complemento.ts", "src/lib/vendas/persistencia.ts", "src/lib/vendas/dominio.ts", "prisma/schema.prisma", "prisma/migrations/20261015143000_clientes_contatos_empresa/migration.sql"] as const;
export async function conferirCodigoCorrecao(verificacoes: string, publicacao: string, revisao: string, entradaSha256: string) {
  const v = await lerJsonCorrecao(verificacoes), p = await lerJsonCorrecao(publicacao), codigo = objetoCorrecao(v.codigo);
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["postgresql:", "postgres:"].includes(url.protocol) || url.pathname !== "/grazing_hub" || !url.username || !url.password || url.hash || [...url.searchParams].some(([chave, valor]) => chave !== "schema" || valor !== "public")) erro("BANCO_RECUSADO");
  const destinoBancoSha256 = hashCanonico({ host: url.hostname, porta: url.port || "5432", banco: "grazing_hub", schema: "public" });
  if (v.destinoBancoSha256 !== destinoBancoSha256 || p.destinoBancoSha256 !== destinoBancoSha256) erro("BANCO_DIVERGENTE");
  if (!/^[a-f0-9]{40}$/.test(revisao) || v.revisao !== revisao || p.revisao !== revisao || v.entradaSha256 !== entradaSha256 || hashCanonico(Object.keys(codigo).sort()) !== hashCanonico([...CODIGO_CORRECAO_CLIENTES].sort()) || hashCanonico(codigo) !== hashCanonico(p.codigo) || !Array.isArray(v.verificacoes)) erro("CODIGO_NAO_COMPROVADO");
  for (const arquivo of CODIGO_CORRECAO_CLIENTES) if ((await shaArquivoCorrecao(path.resolve(arquivo), false)).sha256 !== codigo[arquivo]) erro("CODIGO_DIVERGENTE");
  for (const nome of ["lint", "tipos", "build", "integracao", "reconciliacao", "simulacao"]) {
    const itens = v.verificacoes.map(objetoCorrecao).filter(r => r.nome === nome), item = itens[0];
    if (itens.length !== 1 || item.resultado !== "APROVADO" || typeof item.log !== "string" || !hex(item.sha256)) erro("VERIFICACAO_NAO_COMPROVADA");
    const log = await shaArquivoCorrecao(item.log as string);
    if (log.bytes < 1 || log.sha256 !== item.sha256) erro("VERIFICACAO_NAO_COMPROVADA");
  }
}
