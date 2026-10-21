import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { conferirBaselineEntregas, conferirGuardasEntregas, destinoBancoEntregas, lerJsonEntregas, TABELAS_BASELINE_ENTREGAS } from "../../scripts/entregas-historicas-arquivos";

const raiz = path.resolve(".tmp"), pastas: string[] = [], sha = (texto: string) => createHash("sha256").update(texto).digest("hex");
beforeEach(() => vi.stubEnv("DATABASE_URL", "postgresql://sintetico:senha-sintetica@127.0.0.1:55461/grazing_hub?schema=public"));
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const pasta of pastas.splice(0)) {
    if (!path.resolve(pasta).startsWith(raiz + path.sep + "entregas-cli-test-")) throw Error("Caminho de teste inválido");
    await rm(pasta, { recursive: true, force: true });
  }
});
async function pasta() { const p = path.join(raiz, "entregas-cli-test-" + randomUUID()); await mkdir(p, { recursive: true, mode: 0o700 }); pastas.push(p); return p; }
async function json(arquivo: string, valor: unknown) { const texto = JSON.stringify(valor); await writeFile(arquivo, texto, { mode: 0o600 }); return { arquivo, sha256: sha(texto) }; }
const baseline = () => ({ versao: 1, finalidade: "ENTREGAS_HISTORICAS", destinoBancoSha256: destinoBancoEntregas(), checkpoint: { db: "grazing_hub", instante: new Date().toISOString(), snapshot: "snapshot-sintetico", readonly: true, isolamento: "repeatable read" }, tabelas: Object.fromEntries(TABELAS_BASELINE_ENTREGAS.map(nome => [nome, { fingerprint: { quantidade: "0", digest: "a".repeat(32) } }])) });
async function guardas(alteracoesValidacao = {}) {
  const p = await pasta(), texto = "PGDMP" + "dump-sintetico".repeat(100), arquivo = path.join(p, "hub.dump"), hash = sha(texto), bytes = Buffer.byteLength(texto), destinoBancoSha256 = destinoBancoEntregas(), geradoEm = new Date().toISOString();
  await writeFile(arquivo, texto, { mode: 0o600 });
  const m = await json(path.join(p, "backup.json"), { versao: 1, finalidade: "ENTREGAS_HISTORICAS", database: "grazing_hub", destinoBancoSha256, geradoEm, arquivo, sha256: hash, bytes, formato: "custom", completo: true });
  const v = await json(path.join(p, "validacao.json"), { versao: 1, finalidade: "ENTREGAS_HISTORICAS", database: "grazing_hub", destinoBancoSha256, geradoEm, dumpSha256: hash, bytes, ferramenta: "pg_restore", codigoSaidaListagem: 0, codigoSaidaLeituraIntegral: 0, destinoSql: "/dev/null", bancoRestaurado: false, sqlExposto: false, ...alteracoesValidacao });
  const b = await json(path.join(p, "baseline.json"), baseline());
  const g = await json(path.join(p, "guardas.json"), { versao: 1, finalidade: "ENTREGAS_HISTORICAS", destinoBancoSha256, geradoEm, entradaSha256: "d".repeat(64), backupManifesto: m, validacaoDump: v, baseline: b });
  return { g, arquivo, hash, p };
}
it("limita a baseline a contagens e hashes das quinze tabelas preservadas", () => {
  expect(() => conferirBaselineEntregas(baseline(), destinoBancoEntregas())).not.toThrow();
  const b = baseline(); delete b.tabelas.PedidoVenda;
  expect(() => conferirBaselineEntregas(b, destinoBancoEntregas())).toThrow(/COBERTURA/u);
  expect(() => conferirBaselineEntregas({ ...baseline(), dadosPessoais: "recusado" }, destinoBancoEntregas())).toThrow(/BASELINE/u);
  expect(() => conferirBaselineEntregas(baseline(), destinoBancoEntregas(), Date.now() + 7_200_001)).toThrow(/EXPIRADA/u);
});
it("exige destino explícito sem carregar arquivos de ambiente", () => {
  vi.stubEnv("DATABASE_URL", ""); expect(() => destinoBancoEntregas()).toThrow(/BANCO_RECUSADO/u);
  vi.stubEnv("DATABASE_URL", "postgresql://sintetico:senha@127.0.0.1/outro"); expect(() => destinoBancoEntregas()).toThrow(/BANCO_RECUSADO/u);
});
it("vincula um backup HUB completo à leitura integral e à entrada exata", async () => {
  const { g, hash } = await guardas();
  expect(await conferirGuardasEntregas(g.arquivo, g.sha256, "d".repeat(64))).toMatchObject({ backupHubSha256: hash, conferenciaSha256: "d".repeat(64) });
  await expect(conferirGuardasEntregas(g.arquivo, g.sha256, "0".repeat(64))).rejects.toThrow(/GUARDA_DIVERGENTE/u);
});
it("recusa dump alterado e uma comprovação que só verificou a listagem", async () => {
  const alterado = await guardas(); await writeFile(alterado.arquivo, "dump-alterado", { mode: 0o600 });
  await expect(conferirGuardasEntregas(alterado.g.arquivo, alterado.g.sha256, "d".repeat(64))).rejects.toThrow(/DUMP_DIVERGENTE/u);
  const parcial = await guardas({ codigoSaidaLeituraIntegral: 1 });
  await expect(conferirGuardasEntregas(parcial.g.arquivo, parcial.g.sha256, "d".repeat(64))).rejects.toThrow(/VALIDACAO_DUMP/u);
});
it("não aceita evidência de restauração nem exposição de SQL como verificação do dump", async () => {
  for (const mudanca of [{ bancoRestaurado: true }, { sqlExposto: true }, { destinoSql: "/tmp/dados.sql" }]) {
    const { g } = await guardas(mudanca);
    await expect(conferirGuardasEntregas(g.arquivo, g.sha256, "d".repeat(64))).rejects.toThrow(/VALIDACAO_DUMP/u);
  }
});
it("retorna o hash físico do JSON privado e limita o tamanho da leitura", async () => {
  const p = await pasta(), ref = await json(path.join(p, "fonte.json"), { sintese: "sintética" });
  const lido = await lerJsonEntregas(ref.arquivo); expect(lido.sha256).toBe(ref.sha256); expect(lido.conteudo).toEqual(JSON.parse(await readFile(ref.arquivo, "utf8")));
  await expect(lerJsonEntregas(ref.arquivo, 1)).rejects.toThrow(/TAMANHO/u);
});
