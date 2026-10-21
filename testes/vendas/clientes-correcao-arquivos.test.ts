import { afterEach, expect, it, vi } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile, rm, symlink, access } from "node:fs/promises";
import path from "node:path";
vi.mock("server-only", () => ({}));
import { hashCanonico } from "@/lib/vendas/historico-dominio";
import { conferirBaselineCorrecao, conferirGuardasCorrecao, conferirProvasEmpresas, prepararSaidaCorrecao, salvarJsonCorrecao } from "../../scripts/clientes-historicos-arquivos";
import type { ManifestoEmpresasHistoricas } from "@/lib/vendas/clientes-correcao-dominio";

const raiz = path.resolve(".tmp"), pastas: string[] = [], sha = (v: string) => createHash("sha256").update(v).digest("hex");
const nomes = ["ContaBancaria", "LancamentoFinanceiro", "MovimentacaoBancaria", "SaldoEstoque", "MovimentacaoEstoque", "ReservaPedido", "CreditoClienteMovimento", "PagamentoExternoPedido", "RepassePagamentoPedido", "LiquidacaoCartao", "FaturaCartao", "TratamentoFinanceiroPedido"];
const baseline = () => ({ versao: 1, checkpoint: { db: "grazing_hub", instante: new Date().toISOString(), snapshot: "snapshot-sintetico", readonly: true, isolamento: "repeatable read" },
  balances: Object.fromEntries([...["aberturasDeclaradasSha256", "saldoAtualOficialSha256", "saldoMarcoCalculadoSha256", "estoqueMarcoSha256", "estoqueAtualQuantidadeECustoSha256", "baselineOriginalSha256", "saldosOriginaisProtegidosSha256"].map(n => [n, "a".repeat(64)]), ["marcoOperacionalUTC", "2026-09-01T03:00:00Z"]]),
  tabelas: Object.fromEntries(nomes.map(n => [n, { fingerprint: { quantidade: "0", digest: "a".repeat(32) } }])), sequencias: [{ schemaname: "public", sequencename: "sintetica", valor: "1", chamado: false }] });
async function pasta() { const p = path.join(raiz, "clientes-cli-test-" + randomUUID()); await mkdir(p, { recursive: true, mode: 0o700 }); pastas.push(p); return p; }
async function json(p: string, v: unknown) { const texto = JSON.stringify(v); await writeFile(p, texto, { mode: 0o600 }); return { arquivo: p, sha256: sha(texto) }; }
afterEach(async () => { for (const p of pastas.splice(0)) { if (!path.resolve(p).startsWith(raiz + path.sep + "clientes-cli-test-")) throw Error("Caminho de teste inválido"); await rm(p, { recursive: true, force: true }); } });

it("exige baseline identificada, em leitura repetível, com os 12 conjuntos e hashes de saldos", () => {
  expect(() => conferirBaselineCorrecao(baseline())).not.toThrow();
  expect(() => conferirBaselineCorrecao({ lixo: true })).toThrow();
  const b = baseline(); delete b.tabelas.SaldoEstoque;
  expect(() => conferirBaselineCorrecao(b)).toThrow(/COBERTURA|OBJETO/);
  expect(() => conferirBaselineCorrecao({ ...baseline(), checkpoint: { ...baseline().checkpoint, readonly: false } })).toThrow(/BASELINE/);
  expect(() => conferirBaselineCorrecao(baseline(), Date.now() + 7_200_001)).toThrow(/EXPIRADA/);
});
it("valida bytes de três dumps distintos e recusa alteração mesmo com provas de restauração iguais", async () => {
  const p = await pasta(), bancos = [], provas = [], agora = new Date().toISOString();
  for (const [papel, database] of [["hub", "grazing_hub"], ["atendimento-operacao", "donatella_operacao"], ["entrada", "donatella_entrada"]]) {
    const texto = "dump-sintetico-" + papel, arquivo = path.join(p, papel + ".dump"); await writeFile(arquivo, texto, { mode: 0o600 });
    const resumo = { schemaSha256: "a".repeat(64), rowsSha256: "b".repeat(64), sequencesSha256: "c".repeat(64), tabelas: 1 };
    bancos.push({ papel, database, arquivo, sha256: sha(texto), bytes: Buffer.byteLength(texto), snapshotId: "snapshot-sintetico", expectedSha256: hashCanonico(resumo) });
    provas.push({ papel, database, dumpSha256: sha(texto), restoreVerified: true, expected: resumo, restored: resumo });
  }
  const m = await json(path.join(p, "manifesto.json"), { versao: 1, geradoEm: agora, bancos });
  const r = await json(path.join(p, "restauracao.json"), { versao: 1, geradoEm: agora, bancos: provas, network: "none", portsPublished: 0, jobsActivated: false, restoreVerified: true });
  const b = await json(path.join(p, "baseline.json"), baseline());
  const g = await json(path.join(p, "guardas.json"), { versao: 1, finalidade: "CORRECAO_CLIENTES_HISTORICOS", geradoEm: agora, backupManifesto: m, restauracao: r, baseline: b });
  expect(await conferirGuardasCorrecao(g.arquivo, g.sha256, "d".repeat(64))).toMatchObject({ backupHubSha256: bancos[0].sha256, conferenciaSha256: "d".repeat(64) });
  await writeFile(bancos[0].arquivo, "dump-alterado", { mode: 0o600 });
  await expect(conferirGuardasCorrecao(g.arquivo, g.sha256, "d".repeat(64))).rejects.toThrow(/DUMP_DIVERGENTE/);
});
it("recusa prova empresarial vazia mesmo quando seu hash foi declarado", async () => {
  const p = await pasta(); await writeFile(path.join(p, "vazia.html"), "", { mode: 0o600 });
  const manifesto = { empresas: [{ provas: [{ arquivo: "vazia.html", arquivoSha256: sha("") }] }] } as unknown as ManifestoEmpresasHistoricas;
  await expect(conferirProvasEmpresas(manifesto, p)).rejects.toThrow(/PROVA_EMPRESA/);
});
it("não substitui relatórios e usa trava exclusiva por diretório", async () => {
  const p = await pasta(), liberar = await prepararSaidaCorrecao(p);
  try {
    await expect(prepararSaidaCorrecao(p)).rejects.toThrow();
    const arquivo = path.join(p, "previa.json"); await salvarJsonCorrecao(arquivo, { teste: 1 });
    await expect(salvarJsonCorrecao(arquivo, { teste: 2 })).rejects.toThrow();
    expect(JSON.parse(await readFile(arquivo, "utf8"))).toEqual({ teste: 1 });
  } finally { await liberar(); }
});
it("não cria pasta externa ao encontrar um ancestral simbólico", async () => {
  const p = await pasta(), externo = await pasta(), link = path.join(p, "atalho"); await symlink(externo, link, process.platform === "win32" ? "junction" : "dir");
  await expect(prepararSaidaCorrecao(path.join(link, "nao-criar"))).rejects.toThrow(/CAMINHO_RECUSADO/);
  await expect(access(path.join(externo, "nao-criar"))).rejects.toThrow();
});
