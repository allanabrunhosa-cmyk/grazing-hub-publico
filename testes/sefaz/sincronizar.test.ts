import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readFile, readdir } from "node:fs/promises";

const simulacao = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, distribuicao: vi.fn(), pontual: vi.fn(), ciencias: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return simulacao.prisma; } }));
vi.mock("@/lib/sefaz/certificado", () => ({ obterCnpjConsulta: async () => "12345678000199" }));
vi.mock("@/lib/sefaz/distribuicao", async importar => ({ ...await importar<object>(), consultarDistribuicao: simulacao.distribuicao, consultarDocumentoPontual: simulacao.pontual }));
vi.mock("@/lib/sefaz/ciencia-automatica", () => ({ registrarCienciasPendentes: simulacao.ciencias }));
import { sincronizarDistribuicaoNFe } from "@/lib/sefaz/sincronizar";
import { aplicarLote, guardarLote } from "@/lib/sefaz/lotes";
import { agendarBusca } from "@/lib/sefaz/busca-agendada";
import { formatarNsu } from "@/lib/sefaz/recuperacao-regras";
const nsu = (n: number) => formatarNsu(BigInt(n));
const cnpj = "12345678000199";
const chave = "3".repeat(44);
const resposta = (cStat = "138", ultimo = 4, documentos: {nsu:string; schema:string; xml:string}[] = []) => ({
  cStat, xMotivo: "Teste isolado", ultNSU: nsu(ultimo), ultNSUPresente: true, maxNSU: nsu(ultimo), documentos, envelopeXmlBruto: "simulado",
});
const evento = (n: number) => ({ nsu: nsu(n), schema: "resEvento_v1.01.xsd", xml: "<resEvento/>" });
const nota = (n: number) => ({ nsu: nsu(n), schema: "procNFe_v4.00.xsd", xml: `<nfeProc><NFe><infNFe Id="NFe${chave}"><emit><xNome>Teste</xNome></emit></infNFe></NFe></nfeProc>` });
const executar = process.env.SEFAZ_BANCO_TESTE === "1";

describe.skipIf(!executar)("recuperação SEFAZ com PostgreSQL isolado e rede fiscal simulada", () => {
  let admin: Client;
  const schema = `teste_sefaz_${Date.now()}`;
  beforeAll(async () => {
    config({ quiet: true });
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Teste permitido somente em PostgreSQL local.");
    admin = new Client({ connectionString: url.toString() }); await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(d => d.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
      await admin.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    simulacao.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }, { schema }) });
  }, 60_000);
  afterAll(async () => {
    await simulacao.prisma?.$disconnect();
    if (admin) { if (!/^teste_sefaz_\d+$/.test(schema)) throw new Error("Schema inválido."); await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); }
  });
  beforeEach(async () => {
    vi.resetAllMocks();
    await admin.query('TRUNCATE "SefazLoteRecebido", "SefazDocumentoRecebido", "SefazLacuna", "SefazConsultaPontual", "SefazDistribuicaoEstado", "NotaFiscalRecebida" CASCADE');
    await simulacao.prisma.sefazDistribuicaoEstado.create({ data: { cnpj, ultNSU: nsu(1), nsuConsulta: nsu(1) } });
    simulacao.ciencias.mockResolvedValue({ tentativas: 0, registradas: 0, falhas: [] });
    simulacao.distribuicao.mockResolvedValue(resposta("137", 1));
    simulacao.pontual.mockResolvedValue(resposta("137", 0));
  });
  const estado = () => simulacao.prisma.sefazDistribuicaoEstado.findUniqueOrThrow({ where: { cnpj } });
  it("retoma 656 sem declarar os documentos faltantes como recebidos", async () => {
    simulacao.distribuicao.mockResolvedValue(resposta("656"));
    await sincronizarDistribuicaoNFe();
    expect(await estado()).toMatchObject({ ultNSU: nsu(1), nsuConsulta: nsu(4), emConsulta: false });
    expect(await simulacao.prisma.sefazLacuna.findFirst()).toMatchObject({ inicio: nsu(2), fim: nsu(4), proximo: nsu(2) });
    await sincronizarDistribuicaoNFe();
    expect(simulacao.distribuicao).toHaveBeenCalledTimes(1);
    expect((await estado()).proximaBuscaEm!.getTime()).toBeGreaterThan(Date.now());
  });
  it("recupera cada NSU e só avança a cobertura sobre documentos existentes", async () => {
    await aplicarLote(await guardarLote(cnpj, "DISTRIBUICAO", nsu(1), resposta("656")));
    await aplicarLote(await guardarLote(cnpj, "NSU", nsu(3), resposta("138", 0, [evento(3)])));
    expect((await estado()).ultNSU).toBe(nsu(1));
    await aplicarLote(await guardarLote(cnpj, "NSU", nsu(2), resposta("138", 0, [evento(2)])));
    expect((await estado()).ultNSU).toBe(nsu(3));
    await aplicarLote(await guardarLote(cnpj, "NSU", nsu(4), resposta("138", 0, [evento(4)])));
    expect((await estado()).ultNSU).toBe(nsu(4));
    expect(await simulacao.prisma.sefazLacuna.count({ where: { concluidaEm: null } })).toBe(0);
  });
  it("preserva lote após erro de gravação e reaplica sem consultar a SEFAZ", async () => {
    const id = await guardarLote(cnpj, "DISTRIBUICAO", nsu(1), resposta("138", 2, [nota(2)]));
    await admin.query(`ALTER TABLE "NotaFiscalRecebida" ADD CONSTRAINT falha_simulada CHECK (false)`);
    await expect(aplicarLote(id)).rejects.toThrow();
    expect((await estado()).ultNSU).toBe(nsu(1));
    expect(await simulacao.prisma.sefazDocumentoRecebido.count()).toBe(0);
    await admin.query(`ALTER TABLE "NotaFiscalRecebida" DROP CONSTRAINT falha_simulada`);
    await sincronizarDistribuicaoNFe();
    expect((await estado()).ultNSU).toBe(nsu(2));
    expect(await simulacao.prisma.notaFiscalRecebida.count()).toBe(1);
    expect(simulacao.distribuicao).not.toHaveBeenCalled();
    expect(await aplicarLote(id)).toMatchObject({ novos: 0 });
  });
  it("troca resumo pelo XML da mesma chave sem duplicar a nota", async () => {
    await simulacao.prisma.notaFiscalRecebida.create({ data: { chaveAcesso: chave, nsu: nsu(1), tipo: "RES_NFE" } });
    simulacao.pontual.mockResolvedValue(resposta("138", 0, [nota(2)]));
    expect((await sincronizarDistribuicaoNFe()).xmlRecuperados).toBe(1);
    expect(await simulacao.prisma.notaFiscalRecebida.count()).toBe(1);
    expect(await simulacao.prisma.notaFiscalRecebida.findFirst()).toMatchObject({ tipo: "PROC_NFE", xml: nota(2).xml });
  });
  it("aceita XML por chave sem NSU sem inventar cobertura", async () => {
    await simulacao.prisma.notaFiscalRecebida.create({ data: { chaveAcesso: chave, nsu: nsu(1), tipo: "RES_NFE" } });
    const id = await guardarLote(cnpj, "CHAVE", chave, resposta("138", 0, [{ ...nota(2), nsu: "" }]));
    expect(await aplicarLote(id)).toMatchObject({ xmlRecuperados: 1 });
    expect((await estado()).ultNSU).toBe(nsu(1));
    expect(await simulacao.prisma.sefazDocumentoRecebido.count()).toBe(0);
    expect(await simulacao.prisma.notaFiscalRecebida.findFirst()).toMatchObject({ nsu: nsu(1), xml: nota(2).xml });
  });
  it("rejeita chave inesperada sem alterar nota, documento ou cursor", async () => {
    const id = await guardarLote(cnpj, "CHAVE", "4".repeat(44), resposta("138", 0, [nota(2)]));
    await expect(aplicarLote(id)).rejects.toThrow("chave solicitada");
    expect(await simulacao.prisma.sefazDocumentoRecebido.count()).toBe(0);
    expect((await estado()).ultNSU).toBe(nsu(1));
  });
  it("mantém lacuna não localizada e espaça nova tentativa", async () => {
    await simulacao.prisma.sefazLacuna.create({ data: { cnpj, inicio: nsu(2), fim: nsu(4), proximo: nsu(2) } });
    await sincronizarDistribuicaoNFe();
    expect(await simulacao.prisma.sefazLacuna.findFirst()).toMatchObject({ proximo: nsu(2), concluidaEm: null, tentativas: 1 });
    expect(simulacao.distribuicao).toHaveBeenCalledOnce();
  });
  it("limita consultas pontuais na janela de uma hora, sem impedir descoberta", async () => {
    await simulacao.prisma.notaFiscalRecebida.create({ data: { chaveAcesso: chave, nsu: nsu(1), tipo: "RES_NFE" } });
    await simulacao.prisma.sefazConsultaPontual.createMany({ data: Array.from({ length: 10 }, () => ({ cnpj })) });
    await sincronizarDistribuicaoNFe();
    expect(simulacao.pontual).not.toHaveBeenCalled();
    expect(simulacao.distribuicao).toHaveBeenCalledOnce();
  });
  it("trava concorrência e ignora emConsulta abandonado por processo morto", async () => {
    await simulacao.prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: { emConsulta: true } });
    let liberar!: () => void;
    let entrou!: () => void;
    const inicio = new Promise<void>(r => { entrou = r; });
    simulacao.distribuicao.mockImplementation(async () => { entrou(); await new Promise<void>(r => { liberar = r; }); return resposta("137", 1); });
    const primeira = sincronizarDistribuicaoNFe(); await inicio;
    expect((await sincronizarDistribuicaoNFe()).motivoParada).toBe("BLOQUEIO");
    liberar(); await primeira;
    expect(simulacao.distribuicao).toHaveBeenCalledOnce();
    expect((await estado()).emConsulta).toBe(false);
  });
  it("agenda sem rede e sem encurtar bloqueio", async () => {
    const ate = new Date(Date.now() + 3_600_000);
    await simulacao.prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: { bloqueadoAte: ate } });
    await agendarBusca(); await agendarBusca();
    expect((await estado()).proximaBuscaEm).toEqual(ate);
    expect(simulacao.distribuicao).not.toHaveBeenCalled();
  });
  it("retoma descoberta bloqueada mesmo quando não há XML pendente", async () => {
    await simulacao.prisma.sefazDistribuicaoEstado.update({ where: { cnpj }, data: { ultimoCStat: "137", bloqueadoAte: new Date(Date.now() + 3_600_000) } });
    await sincronizarDistribuicaoNFe();
    expect(simulacao.distribuicao).not.toHaveBeenCalled();
    expect((await estado()).proximaBuscaEm!.getTime()).toBeGreaterThan(Date.now());
  });
  it("timeout não avança cursor e impõe espera antes da retomada", async () => {
    simulacao.distribuicao.mockRejectedValue(new Error("Timeout simulado"));
    expect((await sincronizarDistribuicaoNFe()).motivoParada).toBe("ERRO");
    expect(await estado()).toMatchObject({ ultNSU: nsu(1), nsuConsulta: nsu(1), emConsulta: false });
    expect((await estado()).bloqueadoAte!.getTime()).toBeGreaterThan(Date.now());
  });
});
