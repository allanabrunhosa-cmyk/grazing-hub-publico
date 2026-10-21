import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client as PgClient } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const s = vi.hoisted(() => ({ prisma: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ get prisma() { return s.prisma; } }));
import { consentirOAuth, trocarCodigoOAuth, validarPedidoOAuth } from "@/lib/mcp/oauth";
import { autenticarMcp, limitarMcp, limparRegistrosMcp, revisaoConsentimento, INCLUIR_AUTORIZACAO } from "@/lib/mcp/servidor";
import { alterarAdministracaoMcp, diagnosticarMcp } from "@/lib/mcp/administracao";
import { atenderMcp } from "@/lib/mcp/http";
import { consultarFinanceiroMcp, monetario } from "@/lib/mcp/financeiro";
import { ESCOPOS_GERENCIAIS, ESCOPOS_FINANCEIROS_V1 as ESCOPOS_MCP, FUNCOES_FINANCEIRAS_MCP as FUNCOES_MCP } from "@/lib/mcp/catalogo";
import { calcularDre } from "@/lib/financeiro/calcularDre";
import { carregarFonteDre, carregarFonteFluxo } from "@/lib/financeiro/fontes-relatorios";
import * as fontesRelatorios from "@/lib/financeiro/fontes-relatorios";
import { projetarRelatorioFaturas } from "@/lib/financeiro/faturas/relatorios";
import { calcularPlanilhaFluxoCaixa } from "@/lib/financeiro/fluxoCaixa";
import { POST as tokenPost } from "@/app/oauth/token/route";

const schema = `teste_mcp_${randomUUID().replaceAll("-", "")}`;
const origem = "http://127.0.0.1:45447";
const recurso = `${origem}/api/mcp`;
const callback = "https://cliente.example.invalid/oauth/callback";
const periodo = { de: "2026-09-01", ate: "2026-09-30" };
let pg: PgClient; let clienteId: string; let autorizacaoId: string; let criado = false;
const nomes = FUNCOES_MCP.map(f => f.nome);
async function preparar(escopos: string[] = ESCOPOS_MCP, restricoes = { contas: null as string[] | null, lancamentos: null as string[] | null }, usuarioId = "financeiro") {
  const a = await s.prisma.mcpAutorizacao.create({ data: { nome: "Autorização fictícia", usuarioId, clienteId, perfilId: "financeiro-detalhado", escopos, restricoes } }); return a.id;
}
async function codigo(id = autorizacaoId, escopos: string[] = ESCOPOS_MCP, idioma?: string) {
  const verifier = randomBytes(48).toString("base64url");
  const parametros = { response_type: "code" as const, client_id: clienteId, redirect_uri: callback, resource: recurso, scope: escopos.join(" "), state: randomUUID(), code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" as const, ...(idioma ? { ui_locales: idioma } : {}) };
  const solicitacao = await s.prisma.mcpSolicitacaoOAuth.create({ data: { parametros, expiraEm: new Date(Date.now() + 600_000) } });
  const destino = new URL(await consentirOAuth(solicitacao.id, id, "financeiro", revisaoConsentimento(await s.prisma.mcpAutorizacao.findUniqueOrThrow({ where: { id }, include: INCLUIR_AUTORIZACAO }))));
  expect(destino.origin + destino.pathname).toBe(callback); expect(destino.searchParams.get("state")).toBe(parametros.state);
  return { code: destino.searchParams.get("code")!, code_verifier: verifier, grant_type: "authorization_code", client_id: clienteId, redirect_uri: callback, resource: recurso };
}
async function token(id = autorizacaoId, escopos: string[] = ESCOPOS_MCP) {
  const response = await trocarCodigoOAuth(await codigo(id, escopos));
  expect(response.body.refresh_token).toBeUndefined(); return response.body.access_token as string;
}
function request(body: unknown, accessToken?: string, headers: Record<string, string> = {}) {
  return new Request(recurso, { method: "POST", headers: { host: new URL(origem).host, "content-type": "application/json", accept: "application/json, text/event-stream", ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}), ...headers }, body: JSON.stringify(body) });
}
const rpc = (nome: string, args: unknown = {}) => ({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: nome, arguments: args } });

describe.skipIf(process.env.MCP_BANCO_TESTE !== "1")("MCP/OAuth: PostgreSQL local isolado", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || !url.pathname.endsWith("_teste")) throw new Error("Somente banco local com nome terminado em _teste.");
    process.env.MCP_ORIGEM = origem;
    pg = new PgClient({ connectionString: url.toString() }); await pg.connect();
    await pg.query(`CREATE SCHEMA "${schema}"`); criado = true; await pg.query(`SET search_path TO "${schema}"`);
    for (const p of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) await pg.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
    s.prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    expect(await s.prisma.$queryRaw`SELECT current_schema() AS schema`).toEqual([{ schema }]);
  }, 60000);
  afterAll(async () => {
    await s.prisma?.$disconnect();
    if (pg) { if (criado && /^teste_mcp_[a-f0-9]{32}$/.test(schema)) await pg.query(`DROP SCHEMA "${schema}" CASCADE`); await pg.end(); }
    delete process.env.MCP_ORIGEM;
  });
  beforeEach(async () => {
    await pg.query('TRUNCATE "McpEvento", "McpLimite", "McpSolicitacaoOAuth", "McpCliente", "Usuario", "ContaBancaria", "CategoriaFinanceira" CASCADE');
    await s.prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: {}, update: {} });
    await s.prisma.mcpConfiguracao.update({ where: { id: "singleton" }, data: { ativo: true } });
    await s.prisma.mcpPerfil.update({ where: { id: "financeiro-detalhado" }, data: { ativo: true, escopos: ESCOPOS_MCP } });
    const permissoes = Object.fromEntries(FUNCOES_MCP.map(f => [f.recurso, ["visualizar"]]));
    await s.prisma.perfilAcesso.upsert({ where: { id: "perfil-teste-mcp" }, create: { id: "perfil-teste-mcp", nome: "Financeiro fictício MCP", permissoes }, update: { permissoes } });
    await s.prisma.perfilAcesso.upsert({ where: { id: "perfil-admin-mcp" }, create: { id: "perfil-admin-mcp", nome: "Administrador MCP sem financeiro", permissoes: { "configuracoes.mcp": ["visualizar", "editar"] } }, update: {} });
    await s.prisma.usuario.createMany({ data: [{ id: "financeiro", nome: "Pessoa fictícia", email: "financeiro@example.invalid", senhaHash: "sem-login", perfilAcessoId: "perfil-teste-mcp" }, { id: "admin-mcp", nome: "Administrador fictício", email: "admin-mcp@example.invalid", senhaHash: "sem-login", perfilAcessoId: "perfil-admin-mcp" }] });
    const c = await s.prisma.mcpCliente.create({ data: { nome: "Cliente fictício", redirectUris: [callback] } }); clienteId = c.id;
    autorizacaoId = await preparar();
    await s.prisma.contaBancaria.createMany({ data: [{ id: "banco-a", nome: "Banco permitido fictício", saldoInicial: "100.01" }, { id: "banco-b", nome: "Banco restrito fictício", saldoInicial: "500.00" }] });
    await s.prisma.categoriaFinanceira.createMany({ data: [{ id: "receita", nome: "Receita fictícia", grupo: "RECEITA_BRUTA" }, { id: "despesa", nome: "Despesa fictícia", grupo: "DESPESAS_OPERACIONAIS" }] });
    await s.prisma.lancamentoFinanceiro.createMany({ data: [
      { id: "receita-a", tipo: "RECEITA", descricao: "SEGREDO-DESCRICAO", valor: "200.01", categoriaId: "receita", contaBancariaId: "banco-a", dataCompetencia: new Date("2026-09-10T12:00:00Z"), dataVencimento: new Date("2026-09-10"), dataPagamento: new Date("2026-09-10T12:00:00Z"), status: "BAIXADO", contraparteNome: "DADO-PESSOAL-FICTICIO", observacoes: "DADO-BANCARIO-FICTICIO" },
      { id: "despesa-a", tipo: "DESPESA", descricao: "Pagamento fictício", valor: "50.02", categoriaId: "despesa", contaBancariaId: "banco-a", dataCompetencia: new Date("2026-09-11T12:00:00Z"), dataVencimento: new Date("2026-09-11"), status: "PENDENTE" },
      { id: "receita-b", tipo: "RECEITA", descricao: "Restrito", valor: "900.00", categoriaId: "receita", contaBancariaId: "banco-b", dataCompetencia: new Date("2026-09-10T12:00:00Z"), dataVencimento: new Date("2026-09-10"), status: "PENDENTE" },
    ] });
    await s.prisma.movimentacaoBancaria.create({ data: { contaBancariaId: "banco-a", tipo: "ENTRADA", valor: "200.01", data: new Date("2026-09-10"), descricao: "Movimento fictício" } });
  });

  it("OAuth completo com PKCE S256, código único, token opaco hash e sem refresh", async () => {
    const entrada = await codigo(); const response = await trocarCodigoOAuth(entrada); const access = response.body.access_token;
    expect(await autenticarMcp(access)).toMatchObject({ usuarioId: "financeiro", escopos: ESCOPOS_MCP });
    const armazenado = JSON.stringify(await s.prisma.mcpToken.findMany()); expect(armazenado).not.toContain(access);
    expect(JSON.stringify(await s.prisma.mcpCodigoOAuth.findMany())).not.toContain(entrada.code);
    expect(response.body.refresh_token).toBeUndefined(); expect(response.body.expires_in).toBeGreaterThan(3500);
    await expect(trocarCodigoOAuth(entrada)).rejects.toThrow();
  });
  it("duas trocas simultâneas emitem somente um token; revogação bloqueia código já emitido", async () => {
    const entrada = await codigo();
    const resultados = await Promise.allSettled([trocarCodigoOAuth(entrada), trocarCodigoOAuth(entrada)]);
    expect(resultados.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const outra = await codigo();
    const a = await s.prisma.mcpAutorizacao.findUniqueOrThrow({ where: { id: autorizacaoId } });
    await alterarAdministracaoMcp({ tipo: "situacao", id: a.id, versao: a.versao, situacao: "REVOGADA" }, "admin-mcp");
    await expect(trocarCodigoOAuth(outra)).rejects.toThrow();
  });
  it("cliente pode solicitar catálogo completo e receber somente os escopos do perfil gerencial", async () => {
    await s.prisma.mcpAutorizacao.update({ where: { id: autorizacaoId }, data: { perfilId: "financeiro-gerencial", escopos: ESCOPOS_GERENCIAIS } });
    expect((await autenticarMcp(await token(autorizacaoId, ESCOPOS_GERENCIAIS))).escopos).toEqual(ESCOPOS_GERENCIAIS);
  });
  it("perfil legado fica histórico e não amplia o consentimento migrado", async () => {
    const access = await token(autorizacaoId, ESCOPOS_GERENCIAIS);
    await expect(alterarAdministracaoMcp({ tipo: "perfil", nome: "Indevido", escopos: ESCOPOS_MCP, ativo: true }, "admin-mcp")).rejects.toThrow();
    await s.prisma.mcpPerfil.update({ where: { id: "financeiro-detalhado" }, data: { ativo: false, escopos: ESCOPOS_MCP } });
    expect((await autenticarMcp(access)).escopos).toEqual(ESCOPOS_GERENCIAIS);
  });
  it("recusa PKCE incorreto e consome o código, sem permitir tentativa posterior", async () => {
    const entrada = await codigo(); await expect(trocarCodigoOAuth({ ...entrada, code_verifier: "a".repeat(64) })).rejects.toThrow();
    await expect(trocarCodigoOAuth(entrada)).rejects.toThrow(); expect(await s.prisma.mcpToken.count()).toBe(0);
  });
  it("exige S256, resource e redirecionamento exato, sem cadastro remoto/SSRF", async () => {
    const base = { response_type: "code", client_id: clienteId, redirect_uri: callback, resource: recurso, scope: ESCOPOS_MCP.join(" "), state: randomUUID(), code_challenge: "a".repeat(43), code_challenge_method: "S256" };
    await expect(validarPedidoOAuth(base)).resolves.toHaveProperty("cliente.id", clienteId);
    for (const entrada of [{ ...base, code_challenge_method: "plain" }, { ...base, code_challenge: undefined }, { ...base, resource: `${origem}/outro` }, { ...base, redirect_uri: `${callback}/` }, { ...base, client_id: "http://127.0.0.1/metadados" }]) await expect(validarPedidoOAuth(entrada)).rejects.toThrow();
  });
  it("preferência de idioma do ChatGPT atravessa consentimento e PKCE sem ampliar escopos", async () => {
    const response = await trocarCodigoOAuth(await codigo(autorizacaoId, ESCOPOS_GERENCIAIS, "pt-BR"));
    expect(response.body.refresh_token).toBeUndefined();
    const contexto = await autenticarMcp(response.body.access_token);
    expect(contexto.usuarioId).toBe("financeiro");
    expect(contexto.escopos).toEqual(ESCOPOS_GERENCIAIS);
    await expect(consultarFinanceiroMcp("financeiro_lancamentos", periodo, contexto)).rejects.toThrow();
  });
  it.each(["expirado", "emissor", "destinatario", "suspenso", "revogado", "usuario-inativo", "sessao", "cliente-inativo", "global"])("nega token ainda armazenado quando %s", async caso => {
    const access = await token();
    if (caso === "expirado") await s.prisma.mcpToken.updateMany({ data: { expiraEm: new Date(0) } });
    if (caso === "emissor") await s.prisma.mcpToken.updateMany({ data: { emissor: "https://outro.example.invalid" } });
    if (caso === "destinatario") await s.prisma.mcpToken.updateMany({ data: { destinatario: `${origem}/outro` } });
    if (caso === "suspenso" || caso === "revogado") await alterarAdministracaoMcp({ tipo: "situacao", id: autorizacaoId, versao: 1, situacao: caso === "suspenso" ? "SUSPENSA" : "REVOGADA" }, "admin-mcp");
    if (caso === "usuario-inativo") await s.prisma.usuario.update({ where: { id: "financeiro" }, data: { ativo: false } });
    if (caso === "sessao") await s.prisma.usuario.update({ where: { id: "financeiro" }, data: { sessaoVersao: 1 } });
    if (caso === "cliente-inativo") await s.prisma.mcpCliente.update({ where: { id: clienteId }, data: { ativo: false } });
    if (caso === "global") await s.prisma.mcpConfiguracao.update({ where: { id: "singleton" }, data: { ativo: false } });
    await expect(autenticarMcp(access)).rejects.toThrow();
  });
  it("redução de permissão vale com token existente; ampliação não acrescenta consentimento", async () => {
    const access = await token(autorizacaoId, ESCOPOS_GERENCIAIS);
    await s.prisma.usuario.update({ where: { id: "financeiro" }, data: { permissoesPersonalizadas: { "financeiro.dre": { visualizar: false } } } });
    expect((await autenticarMcp(access)).escopos).not.toContain("financeiro:dre:ler");
    await s.prisma.usuario.update({ where: { id: "financeiro" }, data: { permissoesPersonalizadas: {} } });
    expect((await autenticarMcp(access)).escopos).toEqual(ESCOPOS_GERENCIAIS);
    const renovado = await token(autorizacaoId, ESCOPOS_GERENCIAIS);
    expect((await autenticarMcp(renovado)).escopos).not.toContain("financeiro:lancamentos:ler");
    await s.prisma.mcpPerfil.update({ where: { id: "financeiro-detalhado" }, data: { escopos: ["financeiro:fluxo:ler"] } });
    expect((await autenticarMcp(renovado)).escopos).toEqual(ESCOPOS_GERENCIAIS);
  });
  it("administrador MCP sem financeiro não se autoeleva nem consente por outra pessoa", async () => {
    const id = await preparar(ESCOPOS_MCP, { contas: null, lancamentos: null }, "admin-mcp");
    const parametros = { response_type: "code", client_id: clienteId, redirect_uri: callback, resource: recurso, scope: "financeiro:dre:ler", state: randomUUID(), code_challenge: "a".repeat(43), code_challenge_method: "S256" };
    const pendente = await s.prisma.mcpSolicitacaoOAuth.create({ data: { parametros, expiraEm: new Date(Date.now() + 10000) } });
    await expect(consentirOAuth(pendente.id, id, "admin-mcp", "revisao-invalida")).rejects.toThrow();
    await expect(consentirOAuth(pendente.id, autorizacaoId, "admin-mcp", "revisao-invalida")).rejects.toThrow();
  });
  it("chamadas sem credencial/cookie, inválidas e de outra origem não passam pelo MCP", async () => {
    const access = await token();
    for (const req of [request({}), request({}, "a".repeat(40)), request({}, undefined, { cookie: "hub_session=ficticia" })]) { const r = await atenderMcp(req); expect(r.status).toBe(401); expect(r.headers.get("www-authenticate")).toContain("resource_metadata"); }
    expect((await atenderMcp(request({}, access, { origin: "https://externo.example.invalid" }))).status).toBe(403);
    expect((await atenderMcp(request({}, access, { host: "outro.example.invalid" }))).status).toBe(421);
  });
  it("SDK oficial descobre somente funções gerenciais e recusa chamada direta detalhada", async () => {
    const access = await token(autorizacaoId, ESCOPOS_GERENCIAIS);
    const fetchLocal: typeof fetch = async (input, init) => { const req = new Request(input, init); req.headers.set("host", new URL(origem).host); return atenderMcp(req); };
    const cliente = new McpClient({ name: "teste-grazing", version: "1.0.0" });
    await cliente.connect(new StreamableHTTPClientTransport(new URL(recurso), { fetch: fetchLocal, requestInit: { headers: { authorization: `Bearer ${access}` } } }));
    const lista = await cliente.listTools(); expect(lista.tools.map(t => t.name)).toEqual(nomes.slice(0, 3));
    const resultado = await cliente.callTool({ name: "financeiro_dre", arguments: { ...periodo, regime: "COMPETENCIA" } }); expect(resultado.isError).not.toBe(true); expect(resultado.structuredContent).toHaveProperty("estado", "OK");
    const negado = await atenderMcp(request(rpc("financeiro_lancamentos", periodo), access)); const body = await negado.json(); expect(body.error ?? body.result?.isError).toBeTruthy();
    await cliente.close();
  });
  it("filtra registros, detalhes, contagens, DRE e saldo sem cache compartilhado", async () => {
    const id = await preparar(ESCOPOS_MCP, { contas: ["banco-a"], lancamentos: null });
    const a = await autenticarMcp(await token(id)); const b = await autenticarMcp(await token());
    const lista = await consultarFinanceiroMcp("financeiro_lancamentos", periodo, a); expect(lista.dados).toMatchObject({ total: 2 });
    expect((await consultarFinanceiroMcp("financeiro_lancamentos", { ...periodo, id: "receita-b" }, a)).estado).toBe("VAZIO");
    expect((await consultarFinanceiroMcp("financeiro_lancamentos", periodo, b)).dados).toMatchObject({ total: 3 });
    expect((await consultarFinanceiroMcp("financeiro_dre", { ...periodo, regime: "COMPETENCIA" }, a)).dados).toMatchObject({ totais: { resultadoLiquido: "149.99" } });
    expect((await consultarFinanceiroMcp("financeiro_saldos", { data: periodo.ate }, a)).dados).toEqual({ saldo: "300.02" });
    const porRegistro = { ...a, restricoes: { contas: ["banco-a"], lancamentos: ["receita-a"] } };
    expect((await consultarFinanceiroMcp("financeiro_saldos", { data: periodo.ate }, porRegistro)).estado).toBe("INDISPONIVEL");
    await expect(consultarFinanceiroMcp("financeiro_dre", { ...periodo, regime: "COMPETENCIA", empresaId: "outra" }, a)).rejects.toThrow();
    await expect(consultarFinanceiroMcp("financeiro_dre", { ...periodo, regime: "COMPETENCIA" }, { ...a, lojaId: "outra" })).rejects.toThrow();
  });
  it("paridade DRE/fluxo com fontes da tela, precisão e distinção realizado/previsto", async () => {
    const a = await autenticarMcp(await token());
    const fonte = await carregarFonteDre();
    for (const regime of ["COMPETENCIA", "CAIXA"] as const) {
      const esperado = calcularDre(fonte.linhas, { de: new Date("2026-09-01T03:00:00Z"), ate: new Date("2026-10-01T02:59:59.999Z") }, regime);
      expect((await consultarFinanceiroMcp("financeiro_dre", { ...periodo, regime }, a)).dados).toMatchObject({ totais: { resultadoLiquido: monetario(esperado.resultadoLiquido) } });
    }
    const linhas = (await projetarRelatorioFaturas(await carregarFonteFluxo())).linhas;
    const esperado = calcularPlanilhaFluxoCaixa(600.01, linhas, periodo, [{ id: "banco-a", saldoInicial: 100.01, dataSaldoInicial: null }, { id: "banco-b", saldoInicial: 500, dataSaldoInicial: null }]);
    expect((await consultarFinanceiroMcp("financeiro_fluxo_caixa", periodo, a)).dados).toMatchObject({ totalReceitas: monetario(esperado.totalReceitasGeral), totalDespesas: monetario(esperado.totalDespesasGeral), saldoFinalProjetado: monetario(esperado.saldoFinal) });
  });
  it("fatura parcialmente paga separa realizado e pendente como a tela, preservando a referência original", async () => {
    await s.prisma.cartaoCredito.create({ data: { id: "cartao", nome: "Cartão fictício", contaBancariaId: "banco-a", diaFechamento: 10, diaVencimento: 20 } });
    const fatura = await s.prisma.faturaCartao.create({ data: { cartaoId: "cartao", competencia: "2026-09", inicio: new Date("2026-09-01"), fim: new Date("2026-09-10"), fechamento: new Date("2026-09-10"), vencimento: new Date("2026-09-20"), totalInformado: "100.03", autorId: "financeiro", autorNome: "Pessoa fictícia" } });
    const arquivo = await s.prisma.arquivoFaturaCartao.create({ data: { faturaId: fatura.id, nome: "ficticio.csv", hash: randomUUID(), formato: "CSV", dados: Buffer.from("ficticio"), autorId: "financeiro" } });
    const item = await s.prisma.itemFaturaCartao.create({ data: { faturaId: fatura.id, arquivoId: arquivo.id, linha: 1, identidade: "ficticia", textoOriginal: "Fictício", descricaoOriginal: "Fictício", descricaoNormalizada: "FICTICIO", estabelecimentoOriginal: "Fictício", estabelecimentoNormalizado: "FICTICIO", valorOriginal: "100.03", valor: "100.03", dataCompra: new Date("2026-09-05"), dataCompetencia: new Date("2026-09-05") } });
    await s.prisma.lancamentoFinanceiro.create({ data: { id: "fatura-item", itemFaturaId: item.id, tipo: "DESPESA", descricao: "Despesa fictícia", valor: "100.03", categoriaId: "despesa", contaBancariaId: "banco-a", dataCompetencia: new Date("2026-09-05"), dataVencimento: new Date("2026-09-20"), status: "PENDENTE" } });
    const importacao = await s.prisma.importacaoExtrato.create({ data: { contaBancariaId: "banco-a", nomeArquivo: "ficticio.csv", hashArquivo: randomUUID(), formato: "CSV", autorId: "financeiro", autorNome: "Pessoa fictícia" } });
    const transacao = await s.prisma.transacaoExtrato.create({ data: { contaBancariaId: "banco-a", importacaoId: importacao.id, chave: "ficticia", impressao: "ficticia", data: new Date("2026-09-15"), descricao: "Fictício", valor: "-40.01" } });
    const movimento = await s.prisma.movimentacaoBancaria.create({ data: { contaBancariaId: "banco-a", tipo: "SAIDA", valor: "40.01", data: new Date("2026-09-15"), descricao: "Fictício" } });
    const pagamento = await s.prisma.pagamentoFaturaCartao.create({ data: { faturaId: fatura.id, transacaoId: transacao.id, movimentoId: movimento.id, valor: "40.01", data: new Date("2026-09-15"), contaIdOriginal: "banco-a", transacaoIdOriginal: transacao.id, autorId: "financeiro", autorNome: "Pessoa fictícia" } });
    await s.prisma.liquidacaoCartao.create({ data: { pagamentoId: pagamento.id, lancamentoId: "fatura-item", valor: "40.01" } });
    const a = await autenticarMcp(await token());
    expect((await consultarFinanceiroMcp("financeiro_contas", { de: "2026-09-20", ate: "2026-09-20", situacao: "PENDENTE" }, a)).dados).toMatchObject({ total: 1, registros: [{ valor: "60.02", status: "PENDENTE", lancamentoId: "fatura-item" }] });
    expect((await consultarFinanceiroMcp("financeiro_lancamentos", { ...periodo, id: "fatura-item", situacao: "BAIXADO" }, a)).dados).toMatchObject({ total: 1, registros: [{ valor: "40.01", status: "BAIXADO", lancamentoId: "fatura-item" }] });
    expect((await consultarFinanceiroMcp("financeiro_dre", { ...periodo, regime: "CAIXA" }, a)).dados).toMatchObject({ totais: { resultadoLiquido: "160.00" } });
    const restrita = { ...a, restricoes: { contas: ["banco-b"], lancamentos: null } };
    expect((await consultarFinanceiroMcp("financeiro_lancamentos", { ...periodo, id: "fatura-item" }, restrita)).estado).toBe("VAZIO");
  });
  it("consentimento não usa uma política ampliada depois que o usuário abriu a tela", async () => {
    const a = await s.prisma.mcpAutorizacao.findUniqueOrThrow({ where: { id: autorizacaoId }, include: INCLUIR_AUTORIZACAO });
    const revisao = revisaoConsentimento(a);
    const parametros = { response_type: "code", client_id: clienteId, redirect_uri: callback, resource: recurso, scope: ESCOPOS_MCP.join(" "), state: randomUUID(), code_challenge: "a".repeat(43), code_challenge_method: "S256" };
    const pendente = await s.prisma.mcpSolicitacaoOAuth.create({ data: { parametros, expiraEm: new Date(Date.now() + 10000) } });
    await s.prisma.mcpAutorizacao.update({ where: { id: a.id }, data: { versao: { increment: 1 } } });
    await expect(consentirOAuth(pendente.id, a.id, "financeiro", revisao)).rejects.toThrow(/mudaram/);
    expect(await s.prisma.mcpCodigoOAuth.count()).toBe(0);
  });
  it("não altera tabelas financeiras e não expõe descrições, pessoas ou banco nos resultados/logs", async () => {
    const access = await token(); const antes = JSON.stringify(await s.prisma.lancamentoFinanceiro.findMany()); const movAntes = await s.prisma.movimentacaoBancaria.count();
    for (const nome of nomes) {
      const args = nome === "financeiro_dre" ? { ...periodo, regime: "COMPETENCIA" } : nome === "financeiro_saldos" ? { data: periodo.ate } : nome === "financeiro_plano_contas" ? {} : periodo;
      const response = await atenderMcp(request(rpc(nome, args), access)); const texto = await response.text(); expect(texto).not.toContain('"isError":true');
      for (const segredo of ["SEGREDO-DESCRICAO", "DADO-PESSOAL-FICTICIO", "DADO-BANCARIO-FICTICIO"]) expect(texto).not.toContain(segredo);
    }
    expect(JSON.stringify(await s.prisma.lancamentoFinanceiro.findMany())).toBe(antes); expect(await s.prisma.movimentacaoBancaria.count()).toBe(movAntes);
    const logs = JSON.stringify(await s.prisma.mcpEvento.findMany()); for (const segredo of [access, "SEGREDO-DESCRICAO", "DADO-PESSOAL-FICTICIO", "200.01"]) expect(logs).not.toContain(segredo);
  });
  it("PostgreSQL impede uma escrita mesmo se um serviço chamado pela ferramenta tentar gravar", async () => {
    const a = await autenticarMcp(await token());
    const tentativa = vi.spyOn(fontesRelatorios, "carregarFonteDre").mockImplementationOnce(async db => {
      await db!.lancamentoFinanceiro.update({ where: { id: "receita-a" }, data: { valor: 0 } });
      return { excedido: false as const, linhas: [] };
    });
    try { await expect(consultarFinanceiroMcp("financeiro_dre", { ...periodo, regime: "COMPETENCIA" }, a)).rejects.toThrow(); }
    finally { tentativa.mockRestore(); }
    expect((await s.prisma.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: "receita-a" } })).valor.toFixed(2)).toBe("200.01");
  });
  it("volume excessivo é indisponível, nunca total truncado", async () => {
    const a = await autenticarMcp(await token());
    await pg.query(`INSERT INTO "LancamentoFinanceiro" ("id","tipo","descricao","valor","categoriaId","dataCompetencia","dataVencimento","updatedAt") SELECT 'volume-' || n, 'RECEITA', 'Fictício', 0.01, 'receita', '2026-09-10', '2026-09-10', NOW() FROM generate_series(1,5000) n`);
    await expect(consultarFinanceiroMcp("financeiro_dre", { ...periodo, regime: "COMPETENCIA" }, a)).rejects.toMatchObject({ codigo: "volume_excedido" });
  });
  it("recusa período inválido, escrita oculta, paginação excessiva e limita chamadas", async () => {
    const a = await autenticarMcp(await token());
    for (const filtros of [{ de: "2026-09-31", ate: "2026-10-01" }, { de: "2026-10-01", ate: "2026-09-01" }, { de: "2020-01-01", ate: "2026-10-01" }, { ...periodo, tamanho: 101 }, { ...periodo, baixar: true }]) await expect(consultarFinanceiroMcp("financeiro_lancamentos", filtros, a)).rejects.toThrow();
    const p1 = await consultarFinanceiroMcp("financeiro_lancamentos", { ...periodo, tamanho: 1, pagina: 1 }, a); const p2 = await consultarFinanceiroMcp("financeiro_lancamentos", { ...periodo, tamanho: 1, pagina: 2 }, a); expect(p1.dados).not.toEqual(p2.dados); expect(p1.dados).toMatchObject({ total: 3 });
    await limitarMcp("teste-limite", 1); await expect(limitarMcp("teste-limite", 1)).rejects.toThrow();
  });
  it("endpoint token exige resource e não aceita refresh/password/credencial na URL", async () => {
    const body = await codigo();
    const response = await tokenPost(new Request(`${origem}/oauth/token`, { method: "POST", headers: { host: new URL(origem).host, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) })); expect(response.status).toBe(200);
    await expect(trocarCodigoOAuth({ ...body, grant_type: "refresh_token" })).rejects.toThrow();
    await expect(trocarCodigoOAuth({ ...body, resource: `${origem}/financeiro` })).rejects.toThrow();
    expect((await atenderMcp(new Request(`${recurso}?access_token=invalido`, { headers: { host: new URL(origem).host } }))).status).toBe(400);
  });
  it("diagnóstico é real e limitado, limpeza conserva histórico recente", async () => {
    const diagnostico = await diagnosticarMcp("admin-mcp"); expect(diagnostico).toMatchObject({ banco: "OK", consultaFinanceira: "NAO_EXECUTADA", clienteExterno: "NAO_TESTADO" });
    await s.prisma.mcpEvento.create({ data: { id: "evento-antigo", correlacao: "teste", acao: "TESTE", resultado: "OK", duracaoMs: 0, createdAt: new Date(0) } });
    await s.prisma.mcpLimite.deleteMany({ where: { chave: { startsWith: "limpeza:" } } }); await limparRegistrosMcp();
    expect(await s.prisma.mcpEvento.findUnique({ where: { id: "evento-antigo" } })).toBeNull(); expect(await s.prisma.mcpEvento.count()).toBeGreaterThan(0);
  });
});
