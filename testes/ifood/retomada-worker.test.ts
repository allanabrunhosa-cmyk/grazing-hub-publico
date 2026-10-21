import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SessaoAtual } from "@/lib/session";
import { merchant, pedidoRemoto } from "./fixtures";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("server-only", () => ({}));
import { cifrarIfood } from "@/lib/ifood/tokens";
import { solicitarAcao } from "@/lib/ifood/acoes";

type Evento = { id: string; orderId: string; merchantId: string; code: "PLC" | "CFM"; fullCode: string; createdAt: string; metadata: object };
type Chamada = { caminho?: string; metodo: string; eventos?: number; persistidos?: number; bloqueada?: boolean };
type InicioFilho = { id: string; pid: number; instante: string };
let pg: Client | undefined, criado = false, schema: string, temporario: string, conexao: string, lojaId: string, sessao: SessaoAtual;
let remoto: ReturnType<typeof pedidoRemoto>, execucoes: (InicioFilho & { chamadas: Chamada[] })[];
const segredo = "chave-sintetica-exclusiva-do-worker-isolado";
const evento = (code: Evento["code"], ocorridoEm = new Date()): Evento => ({ id: randomUUID(), orderId: remoto.id, merchantId: merchant, code, fullCode: code === "PLC" ? "PLACED" : "CONFIRMED", createdAt: ocorridoEm.toISOString(), metadata: {} });

async function worker(papel: "coletor" | "processador", eventos: Evento[] = [], op: { detalhesFalham?: boolean; interromperConfirmacao?: boolean } = {}) {
  const numero = execucoes.length, cenario = join(temporario, `${numero}.json`), log = join(temporario, `${numero}.jsonl`);
  await writeFile(cenario, JSON.stringify({ merchant, pedido: remoto, eventos, ...op }));
  await writeFile(log, "");
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production" };
  for (const nome of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP"]) if (process.env[nome]) env[nome] = process.env[nome];
  Object.assign(env, { NODE_ENV: "production", DATABASE_URL: conexao, AUTH_SECRET: segredo, IFOOD_ATIVO: "1", IFOOD_PRODUCAO_AUTORIZADA: "0", IFOOD_BANCO_TESTE: "1", IFOOD_TESTE_CLIENT_ID: "cliente-worker-sintetico", IFOOD_TESTE_CLIENT_SECRET: "segredo-worker-sintetico", IFOOD_WORKER_TESTE_SCHEMA: schema, IFOOD_WORKER_TESTE_CENARIO: cenario, IFOOD_WORKER_TESTE_LOG: log, DOTENV_CONFIG_PATH: join(temporario, "sem-env-operacional"), DOTENV_CONFIG_QUIET: "true" });
  const filho = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", "--import", pathToFileURL(resolve("testes/ifood/worker-http.fixture.mts")).href, "scripts/processar-ifood.ts", "--uma-vez", ...(papel === "coletor" ? ["--coletor"] : [])], { cwd: resolve("."), env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let saida = "";
  filho.stdout.on("data", trecho => { saida += String(trecho); });
  filho.stderr.on("data", trecho => { saida += String(trecho); });
  const codigo = await new Promise<number | null>((concluir, rejeitar) => {
    const limite = setTimeout(() => { filho.kill(); rejeitar(Error("Worker de teste não encerrou em 45 segundos.")); }, 45000);
    filho.once("error", erro => { clearTimeout(limite); rejeitar(erro); });
    filho.once("close", valor => { clearTimeout(limite); concluir(valor); });
  });
  expect(codigo, saida).toBe(op.interromperConfirmacao ? 73 : 0);
  expect(saida).not.toContain("ifood.worker: falha local");
  const registros = (await readFile(log, "utf8")).trim().split("\n").filter(Boolean).map(linha => JSON.parse(linha) as Chamada | { inicio: InicioFilho });
  const inicios = registros.filter((r): r is { inicio: InicioFilho } => "inicio" in r);
  expect(inicios).toHaveLength(1);
  const inicio = inicios[0].inicio;
  expect(inicio.pid).toBe(filho.pid);
  expect(inicio.id).toMatch(/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  expect(Number.isFinite(Date.parse(inicio.instante))).toBe(true);
  const chamadas = registros.filter((r): r is Chamada => !("inicio" in r));
  expect(chamadas.filter(c => c.bloqueada)).toEqual([]);
  // O sistema pode reutilizar PID após a saída; o nonce nasce no preload de cada filho.
  const execucao = { ...inicio, chamadas }; execucoes.push(execucao); return execucao;
}
async function coletar(eventos: Evento[]) {
  await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { proximoPolling: new Date(0) } });
  return worker("coletor", eventos);
}
const pedido = () => sim.prisma.pedidoIfood.findUniqueOrThrow({ where: { lojaId_externoId: { lojaId, externoId: remoto.id } }, include: { pedido: true } });
const enviosConfirmacao = () => execucoes.flatMap(e => e.chamadas).filter(c => c.metodo === "POST" && c.caminho?.endsWith("/confirm")).length;
async function semEfeitosOperacionais() {
  expect(await sim.prisma.lancamentoFinanceiro.count()).toBe(0);
  expect(await sim.prisma.movimentacaoBancaria.count()).toBe(0);
  expect(await sim.prisma.movimentacaoEstoque.count()).toBe(0);
  expect(await sim.prisma.reservaPedido.count()).toBe(0);
}

describe.skipIf(process.env.IFOOD_BANCO_TESTE !== "1")("Entrypoint iFood em processos separados, PostgreSQL isolado e HTTP simulado", () => {
  beforeEach(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_teste")) throw Error("Exige banco local terminado em _teste.");
    conexao = url.toString(); schema = "teste_ifood_worker_" + randomUUID().replaceAll("-", ""); criado = false;
    temporario = await mkdtemp(resolve(".tmp-ifood-retomada-")); execucoes = [];
    pg = new Client({ connectionString: conexao }); await pg.connect();
    await pg.query(`CREATE SCHEMA "${schema}"`); criado = true; await pg.query(`SET search_path TO "${schema}"`);
    for (const p of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) await pg.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao, options: "-c search_path=" + schema }, { schema }) });
    vi.stubEnv("AUTH_SECRET", segredo); vi.stubEnv("IFOOD_ATIVO", "1"); vi.stubEnv("IFOOD_PRODUCAO_AUTORIZADA", "0");
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const u = await sim.prisma.usuario.create({ data: { nome: "Operador worker sintético", email: "worker@example.invalid", senhaHash: "sem-login", perfilAcessoId: perfil.id } });
    sessao = { userId: u.id, nome: u.nome, versao: 0 } as SessaoAtual;
    const categoria = await sim.prisma.categoriaFinanceira.findFirstOrThrow({ where: { grupo: "RECEITA_BRUTA", ativo: true } });
    const canal = await sim.prisma.canalVenda.create({ data: { nome: "iFood worker sintético", categoriaReceitaId: categoria.id } });
    const integracao = await sim.prisma.integracaoIfood.create({ data: { ambiente: "TESTE", modalidade: "CENTRALIZADO", ativo: true, clientId: "cliente-worker-sintetico", criadoPorId: u.id, tokenCifrado: cifrarIfood("token-worker-sintetico"), tokenExpiraEm: new Date(Date.now() + 3600000) } });
    lojaId = (await sim.prisma.lojaIfood.create({ data: { integracaoId: integracao.id, ambiente: "TESTE", merchantId: merchant, nome: "Loja worker sintética", canalId: canal.id, autorizada: true, ativa: true, ultimaAutorizacao: new Date() } })).id;
    remoto = { ...pedidoRemoto(), id: randomUUID(), createdAt: new Date(Date.now() - 10000).toISOString(), delivery: { deliveredBy: "MERCHANT", deliveryDateTime: new Date(Date.now() + 3600000).toISOString() } };
  }, 90000);
  afterEach(async () => {
    await sim.prisma?.$disconnect();
    if (pg) { if (criado && /^teste_ifood_worker_[a-f0-9]{32}$/.test(schema)) await pg.query(`DROP SCHEMA "${schema}" CASCADE`); await pg.end(); pg = undefined; }
    if (temporario && dirname(temporario) === resolve(".") && basename(temporario).startsWith(".tmp-ifood-retomada-")) await rm(temporario, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("ACK durável sobrevive à saída do coletor, falha do processador e reentrega sem duplicar pedido ou efeitos", async () => {
    const plc = evento("PLC");
    const coleta = await coletar([plc]);
    expect(coleta.chamadas.find(c => c.caminho?.endsWith("acknowledgment"))).toMatchObject({ eventos: 1, persistidos: 1 });
    expect(await sim.prisma.eventoIfood.findFirstOrThrow()).toMatchObject({ estado: "PENDENTE", ackEm: expect.any(Date) });
    expect(await sim.prisma.pedidoVenda.count()).toBe(0);
    await worker("processador", [], { detalhesFalham: true });
    expect(await sim.prisma.eventoIfood.findFirstOrThrow()).toMatchObject({ estado: "PENDENTE", tentativas: 1, ackEm: expect.any(Date) });
    expect(await sim.prisma.pedidoVenda.count()).toBe(0);
    // Apenas o relógio da retentativa sintética é antecipado; datas do pedido ficam intactas.
    await sim.prisma.eventoIfood.updateMany({ data: { proximaTentativa: new Date(0) } });
    await worker("processador");
    const original = await pedido();
    const cfm = evento("CFM"); await coletar([plc, cfm, cfm]); await worker("processador"); await worker("processador");
    expect((await pedido()).pedidoId).toBe(original.pedidoId);
    expect((await pedido()).estadoRemoto).toBe("CONFIRMED");
    expect(await sim.prisma.pedidoVenda.count()).toBe(1);
    expect(await sim.prisma.itemPedidoVenda.count()).toBe(1);
    expect(await sim.prisma.eventoIfood.count()).toBe(2);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { tipo: "IFOOD_EVENTO" } })).toBe(2);
    expect(new Set(execucoes.map(e => e.id)).size).toBe(execucoes.length);
    await semEfeitosOperacionais();
  }, 120000);

  it("confirmar com 202 aguarda CFM posterior e correlacionado, sem repetir a ação nos novos processos", async () => {
    await coletar([evento("PLC")]); await worker("processador");
    const p = await pedido(), chave = randomUUID();
    const acao = await solicitarAcao(p.pedidoId, p.pedido.versao, "confirm", {}, chave, sessao);
    expect(await solicitarAcao(p.pedidoId, p.pedido.versao, "confirm", {}, chave, sessao)).toEqual(acao);
    await worker("processador");
    const enviada = await sim.prisma.acaoIfood.findUniqueOrThrow({ where: { id: acao.id } });
    expect(enviada.estado).toBe("AGUARDANDO_EVENTO"); expect((await pedido()).estadoRemoto).toBe("PLACED");
    const antigo = evento("CFM", new Date(enviada.enviadaEm!.getTime() - 1));
    await coletar([antigo]); await worker("processador");
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({ where: { id: acao.id } })).estado).toBe("AGUARDANDO_EVENTO");
    const posterior = evento("CFM"); await coletar([posterior]); await worker("processador"); await worker("processador");
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({ where: { id: acao.id } })).estado).toBe("CONFIRMADA");
    expect(await sim.prisma.acaoIfood.count()).toBe(1); expect(enviosConfirmacao()).toBe(1);
    expect((await pedido()).pedido.status).toBe("CONFIRMADO"); await semEfeitosOperacionais();
  }, 120000);

  it("interromper o filho durante o POST deixa ENVIANDO durável; reinício converte em INCERTA sem replay", async () => {
    await coletar([evento("PLC")]); await worker("processador");
    const p = await pedido();
    const acao = await solicitarAcao(p.pedidoId, p.pedido.versao, "confirm", {}, randomUUID(), sessao);
    await worker("processador", [], { interromperConfirmacao: true });
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({ where: { id: acao.id } })).estado).toBe("ENVIANDO");
    // Envelhece só o marcador local da ação sintética para não esperar dois minutos.
    await sim.prisma.acaoIfood.update({ where: { id: acao.id }, data: { enviadaEm: new Date(Date.now() - 180000) } });
    await worker("processador"); await worker("processador");
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({ where: { id: acao.id } })).estado).toBe("INCERTA");
    expect(enviosConfirmacao()).toBe(1); expect((await pedido()).estadoRemoto).toBe("PLACED");
    await coletar([evento("CFM")]); await worker("processador");
    expect((await sim.prisma.acaoIfood.findUniqueOrThrow({ where: { id: acao.id } })).estado).toBe("CONFIRMADA");
    expect(enviosConfirmacao()).toBe(1); expect(await sim.prisma.pedidoVenda.count()).toBe(1);
    await semEfeitosOperacionais();
  }, 120000);
  it("acompanhamento recebe confirmação externa após reinício sem navegador, comando ou efeito operacional", async () => {
    await sim.prisma.lojaIfood.update({ where: { id: lojaId }, data: { modoOperacao: "ACOMPANHAMENTO", pilotoAte: new Date(Date.now() + 600000), principalClientId: randomUUID(), pilotoEnquadramentoReferencia: "SUPORTE-SINTETICO", pilotoPresencaReferencia: "PRESENCA-SINTETICA" } });
    const plc = evento("PLC"), cfm = evento("CFM");
    const primeira = await coletar([plc]);
    expect(primeira.chamadas.find(c => c.caminho?.endsWith("acknowledgment"))?.persistidos).toBe(1);
    await worker("processador");
    expect((await pedido()).acompanhamento).toBe(true);
    await coletar([cfm]); await worker("processador");
    expect((await pedido()).estadoRemoto).toBe("CONFIRMED");
    await coletar([plc, cfm]); await worker("processador");
    expect(new Set(execucoes.map(e => e.id)).size).toBe(execucoes.length);
    expect(await sim.prisma.pedidoVenda.count()).toBe(1);
    expect(await sim.prisma.acaoIfood.count()).toBe(0); expect(enviosConfirmacao()).toBe(0);
    expect(await sim.prisma.historicoPedidoVenda.count({ where: { tipo: "IFOOD_EVENTO" } })).toBe(2);
    await semEfeitosOperacionais();
  }, 120000);
});
