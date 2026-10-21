import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { ARQUIVOS_CODIGO_HISTORICO, conferirBackups, conferirVerificacoes } from "../../scripts/historico-importar";

const raiz = path.resolve(".tmp/historico-cli-testes"), revisao = "a".repeat(40), fonte = "b".repeat(64), pacote = "c".repeat(64);
let pasta: string;
const hash = (valor: string | Buffer) => createHash("sha256").update(valor).digest("hex");
const arquivo = (nome: string) => path.join(pasta, nome);
async function gravar(nome: string, valor: unknown) { const destino = arquivo(nome); await writeFile(destino, JSON.stringify(valor, null, 2)); return destino; }
async function ler(nome: string) { return JSON.parse(await readFile(arquivo(nome), "utf8")) as Record<string, unknown>; }
async function sha(nome: string) { return hash(await readFile(arquivo(nome))); }
function prova(dumpSha256: string, database: string) { return { database, snapshot: { db: database }, dumpSha256, expected: { Sintetica: { count: 1, md5: "a".repeat(32) } }, restored: { Sintetica: { count: 1, md5: "a".repeat(32) } }, equal: true, containerNetwork: "none", portsPublished: [], jobsActivated: false }; }
async function guardas() {
  const hub = await ler("hub-restauracao-prova.json");
  return { backupHubSha256: hub.dumpSha256, restauracaoHubSha256: await sha("hub-restauracao-prova.json"), backupAtendimentoSha256: await sha("atendimento-backups-manifesto.json"), restauracaoAtendimentoSha256: await sha("atendimento-restauracao-prova.json"), baselineSha256: await sha("baseline-protecao.json") };
}
async function prepararBackups() {
  const dumps = await Promise.all(["grazing_hub", "donatella_operacao", "donatella_entrada"].map(async nome => {
    const dump = `${nome}.dump`; await writeFile(arquivo(dump), `Backup sintético distinto: ${nome}`);
    return { database: nome, container: `container-sintetico-${nome}`, dump, sha256: await sha(dump), restoreVerified: true };
  }));
  await gravar("report.json", { databases: dumps });
  await gravar("hub-restauracao-prova.json", prova(dumps[0].sha256, dumps[0].database));
  await gravar("atendimento-restauracao-prova.json", { databases: dumps.slice(1).map(d => ({ ...prova(d.sha256, d.database), container: d.container })) });
  await gravar("atendimento-backups-manifesto.json", { version: 1, databases: dumps.slice(1) });
  await gravar("baseline-protecao.json", { hubBaseline: { checkpoint: { db: "grazing_hub" }, tables: { Sintetica: { count: 1, md5: "a".repeat(32) } }, sequences: [], balances: { sintetico: "1234.56" } }, protectedBalances: { abertura: "2026-09-01", referencia: "SINTETICA" } });
  await gravar("guardas-disponiveis.json", await guardas());
  return dumps;
}
async function prepararVerificacoes() {
  const codigo = Object.fromEntries(await Promise.all(ARQUIVOS_CODIGO_HISTORICO.map(async nome => [nome, hash(await readFile(path.resolve(nome)))])));
  const verificacoes = await Promise.all(["lint", "tipos", "build", "integracao", "reconciliacao", "simulacao"].map(async nome => {
    const log = arquivo(`${nome}.log`); await writeFile(log, `Prova sintética aprovada: ${nome}`);
    return { nome, resultado: "APROVADO", log, sha256: hash(await readFile(log)) };
  }));
  await gravar("verificacoes.json", { revisao, fonteSha256: fonte, pacoteSha256: pacote, codigo, verificacoes });
  await gravar("publicacao.json", { revisao, codigo });
  return { codigo, verificacoes };
}
const conferir = () => conferirVerificacoes(arquivo("verificacoes.json"), fonte, pacote, revisao, arquivo("publicacao.json"));
beforeEach(async () => { await mkdir(raiz, { recursive: true }); pasta = await mkdtemp(path.join(raiz, "caso-")); });
afterEach(async () => {
  const relativa = path.relative(raiz, path.resolve(pasta));
  if (!relativa || relativa.startsWith("..") || path.isAbsolute(relativa) || !path.basename(pasta).startsWith("caso-")) throw Error("Limpeza fora da pasta sintética recusada.");
  await rm(pasta, { recursive: true });
});

describe("provas completas da execução histórica", () => {
  it("confere três dumps restaurados e preserva os hashes da conferência", async () => {
    const dumps = await prepararBackups(), resultado = await conferirBackups(pasta, pacote);
    expect(resultado).toEqual({ ...await guardas(), conferenciaSha256: pacote }); expect(resultado.backupHubSha256).toBe(dumps[0].sha256);
  });
  it("recusa dump alterado, ausente ou não restaurado", async () => {
    const dumps = await prepararBackups(); await writeFile(arquivo("donatella_entrada.dump"), "CORRUPCAO SINTETICA");
    await expect(conferirBackups(pasta, pacote)).rejects.toThrow("Dump e prova");
    await rm(arquivo("donatella_entrada.dump")); await expect(conferirBackups(pasta, pacote)).rejects.toThrow();
    await prepararBackups(); dumps[1].restoreVerified = false; await gravar("report.json", { databases: dumps });
    await expect(conferirBackups(pasta, pacote)).rejects.toThrow("Dump e prova");
  });
  it("não aceita três referências ao mesmo dump como backup das três bases", async () => {
    const dumps = await prepararBackups(); await gravar("report.json", { databases: [dumps[0], dumps[0], dumps[0]] });
    await expect(conferirBackups(pasta, pacote)).rejects.toThrow();
  });
  it("flag textual de restauração não substitui true", async () => {
    const dumps = await prepararBackups(); await gravar("report.json", { databases: dumps.map(d => ({ ...d, restoreVerified: "false" })) });
    await expect(conferirBackups(pasta, pacote)).rejects.toThrow();
  });
  it("manifesta exatamente os dois dumps de Atendimento restaurados", async () => {
    await prepararBackups(); await gravar("atendimento-backups-manifesto.json", { databases: [] }); await gravar("guardas-disponiveis.json", await guardas());
    await expect(conferirBackups(pasta, pacote)).rejects.toThrow();
  });
  it("não aceita estrutura de baseline substituída por texto", async () => {
    await prepararBackups(); await gravar("baseline-protecao.json", { hubBaseline: "nao-e-fingerprint", protectedBalances: "nao-e-saldo" }); await gravar("guardas-disponiveis.json", await guardas());
    await expect(conferirBackups(pasta, pacote)).rejects.toThrow();
  });
  it("recusa hash de prova alterado e restauração de dump diferente", async () => {
    await prepararBackups(); const provaHub = await ler("hub-restauracao-prova.json"); provaHub.dumpSha256 = "9".repeat(64); await gravar("hub-restauracao-prova.json", provaHub);
    await expect(conferirBackups(pasta, pacote)).rejects.toThrow();
    await prepararBackups(); await gravar("guardas-disponiveis.json", { ...await guardas(), baselineSha256: "8".repeat(64) });
    await expect(conferirBackups(pasta, pacote)).rejects.toThrow("provas de segurança mudaram");
  });
  it("liga revisão, código real, fonte, pacote e seis logs aprovados", async () => {
    await prepararVerificacoes(); expect(await conferir()).toMatchObject({ revisao, fonteSha256: fonte, pacoteSha256: pacote });
  });
  it("recusa revisão de publicação divergente e SHA de fonte ou pacote incorreto", async () => {
    const { codigo } = await prepararVerificacoes(); await gravar("publicacao.json", { revisao: "d".repeat(40), codigo }); await expect(conferir()).rejects.toThrow("revisão publicada");
    await prepararVerificacoes(); await expect(conferirVerificacoes(arquivo("verificacoes.json"), "0".repeat(64), pacote, revisao, arquivo("publicacao.json"))).rejects.toThrow("revisão publicada");
    await expect(conferirVerificacoes(arquivo("verificacoes.json"), fonte, "0".repeat(64), revisao, arquivo("publicacao.json"))).rejects.toThrow("revisão publicada");
  });
  it("vincula a prova complementar exata às verificações quando presente", async () => {
    await prepararVerificacoes(); const complemento = "e".repeat(64);
    await gravar("verificacoes.json", { ...await ler("verificacoes.json"), complementoSha256: complemento });
    await expect(conferir()).rejects.toThrow("revisão publicada");
    await expect(conferirVerificacoes(arquivo("verificacoes.json"), fonte, pacote, revisao, arquivo("publicacao.json"), complemento)).resolves.toMatchObject({ complementoSha256: complemento });
    await expect(conferirVerificacoes(arquivo("verificacoes.json"), fonte, pacote, revisao, arquivo("publicacao.json"), "f".repeat(64))).rejects.toThrow("revisão publicada");
  });
  it("exige conjunto exato de arquivos de execução, sem caminhos livres", async () => {
    const { codigo } = await prepararVerificacoes(), v = await ler("verificacoes.json"); delete codigo[ARQUIVOS_CODIGO_HISTORICO[0]];
    await gravar("verificacoes.json", { ...v, codigo }); await gravar("publicacao.json", { revisao, codigo }); await expect(conferir()).rejects.toThrow("todos os arquivos");
    const novo = await prepararVerificacoes(), extra = { ...novo.codigo, "../../arquivo-indevido": "0".repeat(64) };
    await gravar("verificacoes.json", { ...await ler("verificacoes.json"), codigo: extra }); await gravar("publicacao.json", { revisao, codigo: extra }); await expect(conferir()).rejects.toThrow("todos os arquivos");
  });
  it("código fake não passa apenas por coincidir entre os dois manifestos", async () => {
    const { codigo } = await prepararVerificacoes(); codigo[ARQUIVOS_CODIGO_HISTORICO[0]] = "0".repeat(64);
    await gravar("verificacoes.json", { ...await ler("verificacoes.json"), codigo }); await gravar("publicacao.json", { revisao, codigo });
    await expect(conferir()).rejects.toThrow("código em execução difere");
  });
  it("recusa log corrompido, teste não aprovado ou gate ausente", async () => {
    await prepararVerificacoes(); await writeFile(arquivo("integracao.log"), "Log alterado"); await expect(conferir()).rejects.toThrow("integracao");
    const { verificacoes } = await prepararVerificacoes(); verificacoes[2].resultado = "PENDENTE"; await gravar("verificacoes.json", { ...await ler("verificacoes.json"), verificacoes }); await expect(conferir()).rejects.toThrow("build");
    const atualizado = await prepararVerificacoes(); await gravar("verificacoes.json", { ...await ler("verificacoes.json"), verificacoes: atualizado.verificacoes.filter(v => v.nome !== "simulacao") }); await expect(conferir()).rejects.toThrow("simulacao");
  });
  it("erro de argumento imprime só código e texto fixo, sem ecoar entrada sensível", () => {
    const marcador = "SEGREDO_APENAS_SINTETICO_NAO_ECOAR";
    const resultado = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/historico-importar.ts", `--senha=${marcador}`], { cwd: process.cwd(), encoding: "utf8", timeout: 15000, env: { ...process.env, DATABASE_URL: "postgresql://historico_teste@localhost:5432/teste_historico" } });
    expect(resultado.status).toBe(1); expect(resultado.stdout + resultado.stderr).not.toContain(marcador);
    expect(JSON.parse(resultado.stderr.trim())).toMatchObject({ codigo: "HISTORICO_EXECUCAO_INTERROMPIDA" });
  });
});
