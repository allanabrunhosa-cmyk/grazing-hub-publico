import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const sim = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient, usuarioId: "" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return sim.prisma; } }));
vi.mock("@/lib/permissoes/servidor", () => ({ exigirPermissao: async () => ({ userId: sim.usuarioId, versao: 0 }), podeAcessar: async () => true }));
import { obterDashboardFiscal } from "@/lib/fiscal-dashboard/servidor";
import { chaveDashboard, cnpjEmitenteDashboard, cnpjFornecedorDashboard, protocoloDashboard, resumoCancelamentoDashboard, resumoDashboard, xmlDashboard } from "./fixtures";

const esquema = `teste_fiscal_dashboard_${randomUUID().replaceAll("-", "")}`;
let banco: Client | undefined;
let criado = false;
let usuarioId: string;
let pedidoId: string;

describe.skipIf(process.env.FISCAL_DASHBOARD_BANCO_TESTE !== "1")("Dashboard em PostgreSQL local isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !/^\/teste_/.test(url.pathname)) throw new Error("Somente banco local fictício");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query(`CREATE SCHEMA "${esquema}"`); criado = true;
    await banco.query(`SET search_path TO "${esquema}"`);
    for (const pasta of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
      await banco.query(prepararSqlMigrationFiscal(pasta.name, await readFile(`prisma/migrations/${pasta.name}/migration.sql`, "utf8")));
    }
    sim.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${esquema}` }, { schema: esquema }) });
    const perfil = await sim.prisma.perfilAcesso.findUniqueOrThrow({ where: { sistema: "ADMINISTRADOR" } });
    const usuario = await sim.prisma.usuario.create({ data: { nome: "Autor sintético dashboard", email: "fiscal-dashboard@example.invalid", senhaHash: "inutil", perfilAcessoId: perfil.id } });
    usuarioId = usuario.id; sim.usuarioId = usuario.id;
    const pedido = await sim.prisma.pedidoVenda.create({ data: { chaveCriacao: randomUUID(), hashCriacao: "sintetico", criadoPorId: usuarioId,
      status: "CONFIRMADO", modoFinanceiro: "HUB", versaoFinanceiro: 1, confirmadoEm: new Date("2026-09-30T23:59:59-03:00"), total: "999.99", subtotal: "999.99",
      compradorSnapshot: { nome: "Comprador fictício" }, cobrancaSnapshot: { nome: "Cobrança fictícia" } } });
    pedidoId = pedido.id;
    await sim.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, update: { nome: "Emitente sintético", cnpj: cnpjEmitenteDashboard }, create: { id: "singleton", nome: "Emitente sintético", cnpj: cnpjEmitenteDashboard } });
  }, 90000);
  beforeEach(async () => {
    await sim.prisma.eventoFiscalSaida.deleteMany();
    await sim.prisma.documentoFiscalSaida.deleteMany();
    await sim.prisma.notaFiscalRecebida.deleteMany();
    await sim.prisma.sefazDocumentoRecebido.deleteMany();
    await sim.prisma.notaFiscalServico.deleteMany();
  });
  // O schema inclui todas as migrations do HUB. Sob a bateria concorrente, seu
  // descarte pode exceder o prazo padrão de 10s; o limite é específico do teardown.
  afterAll(async () => {
    await sim.prisma?.$disconnect();
    if (!banco) return;
    if (criado && /^teste_fiscal_dashboard_[a-f0-9]{32}$/.test(esquema)) await banco.query(`DROP SCHEMA "${esquema}" CASCADE`);
    await banco.end();
  }, 30000);
  async function documento(versaoPedido: number, opcoes: { ambiente?: string; status?: string; xml?: string; numero?: number; mesChave?: string } = {}) {
    const numero = opcoes.numero ?? versaoPedido;
    return sim.prisma.documentoFiscalSaida.create({ data: { pedidoId, versaoPedido, payload: {}, hashPayload: "sintetico", criadoPorId: usuarioId, criadoPorNome: "Autor sintético",
      ambiente: opcoes.ambiente ?? "PRODUCAO", status: opcoes.status ?? "AUTORIZADO", chaveFiscal: chaveDashboard(55, cnpjEmitenteDashboard, opcoes.mesChave ?? "2610", numero),
      protocolo: protocoloDashboard, numero: String(numero), xml: opcoes.xml ?? xmlDashboard({ numero }) } });
  }
  it("intervalo entre meses e limites vazios usam datas oficiais nas consultas SQL", async () => {
    await documento(1, { mesChave: "2609", xml: xmlDashboard({ numero: 1, mesChave: "2609", data: "2026-09-30T23:59:59-03:00" }) });
    await documento(2, { xml: xmlDashboard({ numero: 2, data: "2026-10-01T00:00:00-03:00" }) });
    await documento(3, { xml: xmlDashboard({ numero: 3, data: "2026-10-02T00:00:00-03:00" }) });
    let dados = await obterDashboardFiscal({ de: "2026-09-30", ate: "2026-10-01" });
    expect(dados.metricas.faturamento).toMatchObject({ valor: "250.74", quantidade: 2 });
    expect(dados.movimentoDiario.map(d => d.dia)).toEqual(["2026-09-30", "2026-10-01"]);
    dados = await obterDashboardFiscal({ de: "", ate: "" });
    expect(dados.metricas.faturamento).toMatchObject({ valor: "376.11", quantidade: 3 });
    expect(dados.metricas.entradas).toMatchObject({ valor: "0.00", quantidade: 0 });
  });
  it("NFS-e permanece somente leitura, no tomador/ambiente corretos e fora das despesas quando cancelada", async () => {
    const xml = `<NFSe><dhEmi>2026-10-03T12:00:00-03:00</dhEmi><tpAmb>1</tpAmb><tomador><CNPJ>${cnpjEmitenteDashboard}</CNPJ></tomador></NFSe>`;
    for (const [identificador, tomador, ambiente, status] of [["valida", cnpjEmitenteDashboard, "1", "ACEITA"], ["cancelada", cnpjEmitenteDashboard, "1", "CANCELADA"], ["homologacao", cnpjEmitenteDashboard, "2", "ACEITA"], ["outro-tomador", cnpjFornecedorDashboard, "1", "ACEITA"]] as const) {
      await sim.prisma.notaFiscalServico.create({ data: { identificador, origem: "NACIONAL", status, tomadorCnpj: tomador, dataEmissao: new Date("2026-10-03T15:00:00Z"), valorServico: "100.01", xml: xml.replace("<tpAmb>1", `<tpAmb>${ambiente}`).replace(cnpjEmitenteDashboard, tomador) } });
    }
    const dados = await obterDashboardFiscal({ de: "2026-10-01", ate: "2026-10-31" });
    expect(dados.metricas.entradas).toMatchObject({ valor: "100.01", quantidade: 1 });
    expect(dados.documentosPorTipo?.NFS_ENTRADA).toBe(2);
    expect(await sim.prisma.notaFiscalServico.count()).toBe(4);
    expect(await sim.prisma.eventoNfse.count()).toBe(0);
    expect(await sim.prisma.notaFiscalServicoLancamento.count()).toBe(0);
  });
  it("agrega 101 documentos em páginas, usa vNF divergente do pedido e não escreve durante a leitura", async () => {
    for (let i = 1; i <= 101; i++) await documento(i);
    await documento(102, { ambiente: "HOMOLOGACAO", xml: xmlDashboard({ ambiente: "2", numero: 102, valor: "9999.99" }) });
    await documento(103, { mesChave: "2609", xml: xmlDashboard({ mesChave: "2609", numero: 103, data: "2026-09-30T23:59:59-03:00", valor: "8888.88" }) });
    const antes = await sim.prisma.documentoFiscalSaida.count();
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.faturamento).toMatchObject({ valor: "12662.37", quantidade: 101 });
    expect(dados.metricas.ticketMedio.valor).toBe("125.37");
    expect(dados.ultimosDocumentos).toHaveLength(8);
    expect(await sim.prisma.documentoFiscalSaida.count()).toBe(antes);
    expect((await sim.prisma.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId } })).total.toFixed(2)).toBe("999.99");
    expect(await sim.prisma.eventoFiscalSaida.count()).toBe(0);
  });
  it("lê resumo/PROC da chave uma vez e exclui cancelamento recebido depois da emissão", async () => {
    const chave = chaveDashboard(55, cnpjFornecedorDashboard);
    await sim.prisma.notaFiscalRecebida.create({ data: { chaveAcesso: chave, nsu: "000000000000001", tipo: "PROC_NFE", dataEmissao: new Date("2026-10-03T15:00:00Z"),
      valorTotal: "999.99", xml: xmlDashboard({ cnpj: cnpjFornecedorDashboard, destinatario: cnpjEmitenteDashboard, valor: "77.13" }) } });
    await sim.prisma.sefazDocumentoRecebido.create({ data: { cnpj: cnpjEmitenteDashboard, nsu: "000000000000001", schema: "resNFe_v1.01.xsd", xml: resumoDashboard() } });
    let dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.entradas).toMatchObject({ valor: "77.13", quantidade: 1 });
    await sim.prisma.sefazDocumentoRecebido.create({ data: { cnpj: cnpjEmitenteDashboard, nsu: "000000000000002", schema: "resNFe_v1.01.xsd", xml: resumoDashboard("3") } });
    dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.entradas).toMatchObject({ valor: "0.00", quantidade: 0 });
    expect(dados.ultimosDocumentos).toContainEqual(expect.objectContaining({ origem: "ENTRADA", status: "CANCELADO" }));
    expect(await sim.prisma.notaFiscalRecebida.count()).toBe(1); expect(await sim.prisma.sefazDocumentoRecebido.count()).toBe(2);
    expect(await sim.prisma.manifestacaoNFe.count()).toBe(0);
  });
  it("cancelamento sem data e autorizada sem total permanecem indisponíveis, com período filtrado", async () => {
    await documento(1, { status: "CANCELADO" });
    await documento(2, { xml: xmlDashboard({ numero: 2, valor: null }) });
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.faturamento).toMatchObject({ valor: null, quantidade: 1 });
    expect(dados.metricas.canceladas).toMatchObject({ valor: null, quantidade: null });
    expect(dados.pendencias.map(p => p.codigo)).toEqual(expect.arrayContaining(["CANCELADAS_SEM_DATA", "SAIDAS_SEM_VALOR"]));
  });
  it("um resumo de evento de cancelamento recebido impede entrada autorizada presumida", async () => {
    const chave = chaveDashboard(55, cnpjFornecedorDashboard);
    await sim.prisma.notaFiscalRecebida.create({ data: { chaveAcesso: chave, nsu: "000000000000001", tipo: "RES_NFE", dataEmissao: new Date("2026-10-03T15:00:00Z"), valorTotal: "50.01" } });
    await sim.prisma.sefazDocumentoRecebido.createMany({ data: [
      { cnpj: cnpjEmitenteDashboard, nsu: "000000000000001", schema: "resNFe_v1.01.xsd", xml: resumoDashboard() },
      { cnpj: cnpjEmitenteDashboard, nsu: "000000000000002", schema: "resEvento_v1.01.xsd", xml: resumoCancelamentoDashboard() },
    ] });
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.entradas).toMatchObject({ valor: null, quantidade: null });
    expect(dados.pendencias).toContainEqual(expect.objectContaining({ codigo: "ENTRADAS_CANCELAMENTO_PENDENTE", quantidade: 1 }));
    expect(await sim.prisma.manifestacaoNFe.count()).toBe(0);
  });
  it("não mascara data XML inválida como zero ao filtrar candidatos pela competência da chave", async () => {
    await documento(1, { xml: xmlDashboard({ numero: 1, data: "2026-13-01T00:30:00-03:00" }) });
    const dados = await obterDashboardFiscal({ mes: "2026-10", ambiente: "PRODUCAO" });
    expect(dados.metricas.faturamento).toMatchObject({ valor: null, quantidade: null });
    expect(dados.pendencias).toContainEqual(expect.objectContaining({ codigo: "SAIDAS_SEM_DATA", quantidade: 1 }));
  });
});
