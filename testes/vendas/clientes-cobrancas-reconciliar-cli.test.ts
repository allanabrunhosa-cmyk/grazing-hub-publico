import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { argumentosReconciliacao, conferirAprovacaoReconciliacao, conferirArtefatoReconciliacao } from "../../scripts/clientes-cobrancas-reconciliar";

const sha = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
let base: string;
async function salvar(relativo: string, valor: unknown) { const arquivo = path.join(base, relativo); await mkdir(path.dirname(arquivo), { recursive: true }); await writeFile(arquivo, typeof valor === "string" ? valor : JSON.stringify(valor), { mode: 0o600 }); return arquivo; }
async function artefato() {
  const arquivos = [];
  for (const caminho of ["src/lib/sintetico.ts", "scripts/sintetico.ts", "prisma/schema.prisma", "package.json", "package-lock.json", "tsconfig.json"]) {
    const arquivo = await salvar(caminho, `conteúdo sintético ${caminho}`);
    arquivos.push({ caminho, sha256: sha(await readFile(arquivo)) });
  }
  const manifesto = await salvar("manifesto.json", { versao: 1, revisaoCodigo: "a".repeat(40), arquivos });
  return { manifesto, sha256: sha(await readFile(manifesto)), arquivos };
}
beforeEach(async () => { base = await mkdtemp(path.join(tmpdir(), "reconciliacao-cli-sintetica-")); });
afterEach(async () => { if (base.startsWith(path.join(tmpdir(), "reconciliacao-cli-sintetica-"))) await rm(base, { recursive: true, force: true }); });
describe("CLI privado da reconciliação", () => {
  it("usa prévia como padrão e não aceita credenciais de um usuário para simular identidade", () => {
    expect(argumentosReconciliacao(["--configuracao=privado.json", "--saida=.tmp/privado"]).modo).toBe("previa");
    expect(() => argumentosReconciliacao(["--usuario-id=admin"])).toThrow("RECONCILIACAO_CLI_ARGUMENTOS_INVALIDOS");
  });
  it.each([["--modo=aplicar", "--modo=aplicar"], ["--modo=desconhecido"], ["--saida"], ["--chave=valor"]])("recusa argumentos inválidos %s", (...args) => {
    expect(() => argumentosReconciliacao(args)).toThrow(/RECONCILIACAO_CLI_/);
  });
  it("verifica artefato sem Git, com todos os hashes do inventário fechado", async () => {
    const a = await artefato(); await expect(conferirArtefatoReconciliacao(a.manifesto, a.sha256, "a".repeat(40), base)).resolves.toBe(a.sha256);
  });
  it.each(["arquivo-novo", "arquivo-alterado", "hash-manifesto", "revisao"])("recusa %s no artefato", async caso => {
    const a = await artefato();
    if (caso === "arquivo-novo") await salvar("src/lib/novo.ts", "novo");
    if (caso === "arquivo-alterado") await salvar("src/lib/sintetico.ts", "alterado");
    await expect(conferirArtefatoReconciliacao(a.manifesto, caso === "hash-manifesto" ? "f".repeat(64) : a.sha256, caso === "revisao" ? "b".repeat(40) : "a".repeat(40), base)).rejects.toThrow(/RECONCILIACAO_CLI_ARTEFATO_/);
  });
  it("aprovação vincula modo, configuração, prévia, revisão, artefato e backup privado", async () => {
    const contexto = { modo: "aplicar", configuracaoSha256: "b".repeat(64), token: "c".repeat(64), revisaoCodigo: "a".repeat(40), artefatoSha256: "d".repeat(64) };
    const backup = await salvar("backup-sintetico.sql", "backup inteiramente sintético"), backupSha256 = sha(await readFile(backup));
    const aprovacao = await salvar("aprovacao.json", { versao: 1, finalidade: "RECONCILIACAO_CADASTRAL", ...contexto, geradoEm: "2026-10-19T12:00:00Z", backupArquivo: backup, backupSha256 });
    const hash = sha(await readFile(aprovacao));
    await expect(conferirAprovacaoReconciliacao(aprovacao, hash, contexto, Date.parse("2026-10-19T12:05:00Z"))).resolves.toEqual({ aprovacaoSha256: hash, backupSha256, artefatoSha256: contexto.artefatoSha256 });
    await expect(conferirAprovacaoReconciliacao(aprovacao, hash, { ...contexto, token: "e".repeat(64) }, Date.parse("2026-10-19T12:05:00Z"))).rejects.toThrow("RECONCILIACAO_CLI_APROVACAO_INVALIDA");
    await expect(conferirAprovacaoReconciliacao(aprovacao, hash, contexto, Date.parse("2026-10-20T12:00:00Z"))).rejects.toThrow("RECONCILIACAO_CLI_APROVACAO_INVALIDA");
    await salvar("backup-sintetico.sql", "arquivo alterado");
    await expect(conferirAprovacaoReconciliacao(aprovacao, hash, contexto, Date.parse("2026-10-19T12:05:00Z"))).rejects.toThrow("RECONCILIACAO_CLI_BACKUP_DIVERGENTE");
  });
});
