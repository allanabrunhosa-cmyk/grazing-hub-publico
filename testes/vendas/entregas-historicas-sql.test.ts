import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type ClienteSqlEntregas = ReturnType<typeof criarClienteSql>;
const estado = vi.hoisted((): { prisma: ClienteSqlEntregas | null } => ({ prisma: null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return estado.prisma; } }));
import { aplicarEnriquecimentoEntregasHistoricas, prepararEnriquecimentoEntregasHistoricas, prepararReversaoEntregasHistoricas, reverterEnriquecimentoEntregasHistoricas } from "@/lib/vendas/entregas-historicas";
import { hashEntradaFonteEntregasHistoricas } from "@/lib/vendas/entregas-historicas-dominio";
import { hashCanonico } from "@/lib/vendas/historico-dominio";
import { fonteEntregasSintetica } from "./entregas-historicas.fixture";

const schema = `teste_entregas_sql_${randomUUID().replaceAll("-", "")}`;
const protegidas = ["ContaBancaria", "LancamentoFinanceiro", "MovimentacaoBancaria", "SaldoEstoque", "MovimentacaoEstoque", "ReservaPedido", "CreditoClienteMovimento", "PagamentoExternoPedido", "RepassePagamentoPedido", "LiquidacaoCartao", "FaturaCartao", "TratamentoFinanceiroPedido", "PedidoVenda", "ItemPedidoVenda", "ClienteVenda"];
const fonte = { ...fonteEntregasSintetica(), linhas: [...fonteEntregasSintetica().linhas, { linha: 3, numero: "56", endereco: null }] };
const fonteSha256 = "a".repeat(64), entradaSha256 = hashEntradaFonteEntregasHistoricas(fonte, fonteSha256);
const entrada = { usuarioId: "admin-sintetico", sessaoVersao: 3, loteId: "entregas-sql-sinteticas", fonte, fonteSha256,
  guardas: { backupHubSha256: "b".repeat(64), validacaoDumpSha256: "c".repeat(64), baselineSha256: "d".repeat(64), conferenciaSha256: entradaSha256 } };
const consultas: string[] = [];
let banco: Client | null = null, escrita: ClienteSqlEntregas | null = null, leitura: ClienteSqlEntregas | null = null, criado = false;
function criarClienteSql(url: string, somenteLeitura: boolean) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: `-c search_path=${schema}${somenteLeitura ? " -c default_transaction_read_only=on" : ""}` }, { schema }), log: [{ emit: "event", level: "query" }] });
}

describe.skipIf(process.env.ENTREGAS_HISTORICAS_BANCO_TESTE !== "1")("Entregas históricas: PostgreSQL sintético real", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "http://invalido");
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !/^\/teste_[a-z0-9_]+$/u.test(url.pathname) || process.env.PEDIDOS_AMBIENTE_ISOLADO !== "1") throw Error("Exige banco sintético local explícito.");
    banco = new Client({ connectionString: url.toString() }); await banco.connect();
    await banco.query(`CREATE SCHEMA "${schema}"`); criado = true;
    await banco.query(`SET search_path TO "${schema}"`);
    for (const nome of protegidas.filter(n => !["PedidoVenda", "ItemPedidoVenda", "ClienteVenda"].includes(n))) await banco.query(`CREATE TABLE "${nome}" (id text PRIMARY KEY, valor numeric NOT NULL DEFAULT 100)`);
    await banco.query(`
      CREATE TABLE "PedidoVenda" (id text PRIMARY KEY, status text, origem text, "referenciaOrigem" text, "referenciaEstabelecimento" text, "referenciaPedido" text, frete numeric NOT NULL DEFAULT 15);
      CREATE TABLE "ItemPedidoVenda" (id text PRIMARY KEY);
      CREATE TABLE "ClienteVenda" (id text PRIMARY KEY);
      CREATE TABLE "PerfilAcesso" (id text PRIMARY KEY, sistema text);
      CREATE TABLE "Usuario" (id text PRIMARY KEY, nome text, ativo boolean, "excluidoEm" timestamp, "senhaDefinida" boolean, "sessaoVersao" integer, "perfilAcessoId" text);
      CREATE TABLE "IdentidadeExternaVenda" (id text PRIMARY KEY, "destinoId" text, chave text, origem text, loja text, entidade text, "dadosOrigem" jsonb, "updatedAt" timestamp NOT NULL DEFAULT now());
      CREATE TABLE "HistoricoCadastroVenda" (id text PRIMARY KEY, entidade text, "registroId" text, "usuarioId" text, "usuarioNome" text, antes jsonb, depois jsonb, "createdAt" timestamp NOT NULL DEFAULT now());
      CREATE FUNCTION alteracao_proibida() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE "PedidoVenda" SET frete=frete+1 WHERE id='p55'; RETURN NEW; END $$;
    `);
    escrita = criarClienteSql(url.toString(), false); leitura = criarClienteSql(url.toString(), true);
    escrita.$on("query", evento => consultas.push(evento.query)); leitura.$on("query", evento => consultas.push(evento.query));
    estado.prisma = escrita;
  }, 30_000);
  beforeEach(async () => {
    vi.stubEnv("ENTREGAS_HISTORICAS_AUTORIZADAS", "SIM"); estado.prisma = escrita;
    await banco!.query('DROP TRIGGER IF EXISTS proibida ON "IdentidadeExternaVenda"');
    for (const tabela of [...protegidas, "Usuario", "PerfilAcesso", "IdentidadeExternaVenda", "HistoricoCadastroVenda"]) await banco!.query(`TRUNCATE TABLE "${tabela}"`);
    for (const tabela of protegidas.filter(n => !["PedidoVenda", "ItemPedidoVenda", "ClienteVenda"].includes(n))) await banco!.query(`INSERT INTO "${tabela}" (id) VALUES ('preservado')`);
    await banco!.query(`INSERT INTO "PerfilAcesso" VALUES ('admin','ADMINISTRADOR'),('comum',NULL);
      INSERT INTO "Usuario" VALUES ('admin-sintetico','Administrador sintético',true,NULL,true,3,'admin'),('sem-admin','Usuário sintético',true,NULL,true,3,'comum'),('inativo','Inativo sintético',false,NULL,true,3,'admin');
      INSERT INTO "PedidoVenda" (id,status,origem,"referenciaOrigem","referenciaEstabelecimento","referenciaPedido") VALUES ('p55','HISTORICO','HISTORICO_LEGADO','grazing-legado-orders','grazing-hub','55'),('p56','HISTORICO','HISTORICO_LEGADO','grazing-legado-orders','grazing-hub','56');
      INSERT INTO "ItemPedidoVenda" VALUES ('item-sintetico'); INSERT INTO "ClienteVenda" VALUES ('cliente-sintetico');
      INSERT INTO "IdentidadeExternaVenda" (id,"destinoId",chave,origem,loja,entidade,"dadosOrigem") VALUES ('f55','p55','55','grazing-legado-orders','grazing-hub','PEDIDO_HISTORICO','{"hub":{"loteOriginal":"preservar"},"registro":{"totais":{"frete":"15"}}}'),('f56','p56','56','grazing-legado-orders','grazing-hub','PEDIDO_HISTORICO','{"hub":{"loteOriginal":"preservar"},"registro":{"totais":{"frete":"15"}}}');`);
    consultas.length = 0;
  });
  afterEach(() => vi.unstubAllEnvs());
  afterAll(async () => {
    await escrita?.$disconnect(); await leitura?.$disconnect(); estado.prisma = null;
    if (!banco) return;
    if (criado && /^teste_entregas_sql_[a-f0-9]{32}$/u.test(schema)) await banco.query(`DROP SCHEMA "${schema}" CASCADE`);
    await banco.end();
  });
  async function fingerprints() {
    const fotos: unknown[] = [];
    for (const tabela of protegidas) fotos.push({ tabela, ...(await banco!.query(`SELECT count(*)::text quantidade,md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) digest FROM "${tabela}" t`)).rows[0] });
    return fotos;
  }
  async function dados() { return (await banco!.query('SELECT id,"dadosOrigem" FROM "IdentidadeExternaVenda" ORDER BY id')).rows as { id: string; dadosOrigem: { hub: Record<string, unknown>; registro: unknown } }[]; }
  async function aplicar() { const p = await prepararEnriquecimentoEntregasHistoricas(entrada); await aplicarEnriquecimentoEntregasHistoricas({ ...entrada, tokenPrevia: p.token, backupMetadadosSha256: hashCanonico(p.backupMetadados) }); return p; }

  it("executa prévia READ ONLY real, sem alterar identidades, auditoria ou quinze tabelas", async () => {
    const antes = await dados(), fotos = await fingerprints(); estado.prisma = leitura;
    const p = await prepararEnriquecimentoEntregasHistoricas(entrada);
    expect(p.contagens).toMatchObject({ aplicar: 2, retiradas: 1, entregasInformadas: 1 });
    expect(consultas.some(q => q === "SET TRANSACTION READ ONLY")).toBe(true);
    expect(consultas.some(q => /^(?:INSERT|UPDATE|DELETE)\b/iu.test(q))).toBe(false);
    await expect(leitura!.$executeRawUnsafe('UPDATE "PedidoVenda" SET frete=0')).rejects.toThrow();
    expect(await dados()).toEqual(antes); expect(await fingerprints()).toEqual(fotos);
    expect((await banco!.query('SELECT count(*) FROM "HistoricoCadastroVenda"')).rows[0].count).toBe("0");
  });
  it("aplica somente o metadado, mantém as quinze fingerprints e repete sem nova escrita", async () => {
    const fotos = await fingerprints(), antes = await dados(), p = await aplicar(), depois = await dados();
    expect(depois.map(l => (l.dadosOrigem.hub.entregaHistorica as { modalidade: string }).modalidade)).toEqual(["ENTREGA_INFORMADA", "RETIRADA"]);
    for (let i = 0; i < depois.length; i++) { const copia = structuredClone(depois[i].dadosOrigem); delete copia.hub.entregaHistorica; expect(copia).toEqual(antes[i].dadosOrigem); }
    expect(await fingerprints()).toEqual(fotos);
    const r = await aplicarEnriquecimentoEntregasHistoricas({ ...entrada, tokenPrevia: p.token, backupMetadadosSha256: hashCanonico(p.backupMetadados) });
    expect(r.aplicados).toBe(0); expect(await dados()).toEqual(depois);
    const audit = (await banco!.query('SELECT "usuarioId",depois FROM "HistoricoCadastroVenda"')).rows;
    expect(audit).toHaveLength(1); expect(audit[0].usuarioId).toBe("admin-sintetico"); expect(audit[0].depois.tipo).toBe("ENRIQUECIMENTO_ENTREGAS_HISTORICAS_V1");
  });
  it("recusa prévia obsoleta após alteração do JSON integral e preserva os dados", async () => {
    const p = await prepararEnriquecimentoEntregasHistoricas(entrada);
    await banco!.query(`UPDATE "IdentidadeExternaVenda" SET "dadosOrigem"=jsonb_set("dadosOrigem",'{hub,alteracaoExterna}','true') WHERE id='f55'`);
    const antes = await dados();
    await expect(aplicarEnriquecimentoEntregasHistoricas({ ...entrada, tokenPrevia: p.token, backupMetadadosSha256: hashCanonico(p.backupMetadados) })).rejects.toThrow(/PREVIA_OU_BACKUP_DIVERGENTE/u);
    expect(await dados()).toEqual(antes);
  });
  it("reverte só a chave própria, recusa token obsoleto e preserva campos externos", async () => {
    const fotos = await fingerprints(); await aplicar();
    const p = await prepararReversaoEntregasHistoricas(entrada);
    await banco!.query(`UPDATE "IdentidadeExternaVenda" SET "dadosOrigem"=jsonb_set("dadosOrigem",'{hub,posterior}','"preservado"') WHERE id='f55'`);
    await expect(reverterEnriquecimentoEntregasHistoricas({ ...entrada, tokenPrevia: p.token })).rejects.toThrow(/PREVIA_REVERSAO_DIVERGENTE/u);
    const atual = await prepararReversaoEntregasHistoricas(entrada);
    expect((await reverterEnriquecimentoEntregasHistoricas({ ...entrada, tokenPrevia: atual.token })).revertidos).toBe(2);
    const depois = await dados(); expect(depois.every(l => !Object.hasOwn(l.dadosOrigem.hub, "entregaHistorica"))).toBe(true); expect(depois[0].dadosOrigem.hub.posterior).toBe("preservado");
    expect(await fingerprints()).toEqual(fotos);
    expect((await reverterEnriquecimentoEntregasHistoricas({ ...entrada, tokenPrevia: atual.token })).revertidos).toBe(0);
  });
  it("não reverte um metadado consultivo editado após a aplicação", async () => {
    await aplicar();
    await banco!.query(`UPDATE "IdentidadeExternaVenda" SET "dadosOrigem"=jsonb_set("dadosOrigem",'{hub,entregaHistorica,criterioModalidade}','"alterado"') WHERE id='f55'`);
    const antes = await dados(); await expect(prepararReversaoEntregasHistoricas(entrada)).rejects.toThrow(/REVERSAO_METADADOS_ALTERADOS/u); expect(await dados()).toEqual(antes);
  });
  it("nega usuário sem perfil administrador, inativo, sessão antiga e guarda de outra fonte", async () => {
    for (const contexto of [{ ...entrada, usuarioId: "sem-admin" }, { ...entrada, usuarioId: "inativo" }, { ...entrada, sessaoVersao: 2 }]) await expect(prepararEnriquecimentoEntregasHistoricas(contexto)).rejects.toThrow(/ADMINISTRADOR_VIGENTE_EXIGIDO/u);
    await expect(prepararEnriquecimentoEntregasHistoricas({ ...entrada, guardas: { ...entrada.guardas, conferenciaSha256: "0".repeat(64) } })).rejects.toThrow(/GUARDAS_FONTE_DIVERGENTES/u);
    expect((await banco!.query('SELECT count(*) FROM "HistoricoCadastroVenda"')).rows[0].count).toBe("0");
  });
  it("reverte toda a transação se um trigger sintético alterar uma tabela protegida", async () => {
    const p = await prepararEnriquecimentoEntregasHistoricas(entrada), antes = await dados(), fotos = await fingerprints();
    await banco!.query('CREATE TRIGGER proibida AFTER UPDATE ON "IdentidadeExternaVenda" FOR EACH ROW EXECUTE FUNCTION alteracao_proibida()');
    await expect(aplicarEnriquecimentoEntregasHistoricas({ ...entrada, tokenPrevia: p.token, backupMetadadosSha256: hashCanonico(p.backupMetadados) })).rejects.toThrow(/DADOS_OPERACIONAIS_ALTERADOS/u);
    expect(await dados()).toEqual(antes); expect(await fingerprints()).toEqual(fotos);
    expect((await banco!.query('SELECT count(*) FROM "HistoricoCadastroVenda"')).rows[0].count).toBe("0");
  });
});
