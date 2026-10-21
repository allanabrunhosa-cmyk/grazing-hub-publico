import { prepararSqlMigrationFiscal } from "../../scripts/lib/reconciliacao-migrations-fiscais.mjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Client as Pg } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { SessaoAtual } from "@/lib/session";
const s = vi.hoisted(() => ({ banco: null as unknown as PrismaClient, navegador: null as SessaoAtual | null }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", async original => {
  const real = await original<typeof import("@/lib/prisma")>();
  return { ...real, get bancoPrincipal() { return s.banco; }, get prisma() { return real.clienteComContexto(s.banco); } };
});
vi.mock("@/lib/session", async original => {
  const real = await original<typeof import("@/lib/session")>();
  const { contextoExecucao } = await import("@/lib/contexto-execucao");
  return { ...real, getSession: () => contextoExecucao() ? real.getSession() : Promise.resolve(s.navegador) };
});
import { executarNegocioMcp, aprovarRevisaoMcp, carregarRevisaoMcp } from "@/lib/mcp/operacoes";
import { autenticarMcp, revisaoConsentimento, INCLUIR_AUTORIZACAO } from "@/lib/mcp/servidor";
import { consentirOAuth, trocarCodigoOAuth } from "@/lib/mcp/oauth";
import { FUNCOES_NEGOCIO_MCP } from "@/lib/mcp/registro-negocio";
import { ESCOPOS_FINANCEIROS_V1 } from "@/lib/mcp/catalogo";
import { alterarAdministracaoMcp } from "@/lib/mcp/administracao";
import { atenderMcp } from "@/lib/mcp/http";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { reservarProximoEnvio } from "@/lib/etiquetas/pontos";
import { cifrarIfood } from "@/lib/ifood/tokens";
import { enviarAcao } from "@/lib/ifood/acoes";
import { merchant, pedidoRemoto } from "../ifood/fixtures";
import { permitirEfeitoPendenteMcp } from "@/lib/mcp/efeito-pendente";
import { GET as iniciarOAuthHttp } from "@/app/oauth/iniciar/route";
import { POST as tokenOAuthHttp } from "@/app/oauth/token/route";

const schema = `teste_mcp_multi_${randomUUID().replaceAll("-", "")}`;
const origem = "http://127.0.0.1:45447", recurso = `${origem}/api/mcp`, callback = "https://cliente.example.invalid/callback";
let pg: Pg; let criado = false; let clienteId: string; let autorizacaoId: string;
let servidorHttp: Server;
const sucessos = new Set<string>();
const chave = () => `${new Date().toISOString().slice(0, 10)}_${randomUUID()}`;
const cliente = { nome: "Cliente fictício", tipo: "PF", documento: null, email: null, telefone: null, contato: null, observacoes: null, enderecos: [], ativo: true };
async function token(escopos: string[], usuario = "administrador", id = autorizacaoId) {
  const verifier = randomBytes(48).toString("base64url");
  const parametros = { response_type: "code", client_id: clienteId, redirect_uri: callback, resource: recurso, scope: escopos.join(" "), state: randomUUID(), code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" };
  const pedido = await s.banco.mcpSolicitacaoOAuth.create({ data: { parametros, expiraEm: new Date(Date.now() + 600000) } });
  const a = await s.banco.mcpAutorizacao.findUniqueOrThrow({ where: { id }, include: INCLUIR_AUTORIZACAO });
  const destino = new URL(await consentirOAuth(pedido.id, a.id, usuario, revisaoConsentimento(a)));
  const resultado = await trocarCodigoOAuth({ grant_type: "authorization_code", client_id: clienteId, redirect_uri: callback, resource: recurso, code: destino.searchParams.get("code")!, code_verifier: verifier });
  return resultado.body.access_token as string;
}
const escopo = (nome: string) => FUNCOES_NEGOCIO_MCP.find(f => f.nome === nome)!.escopo;
async function sessao(usuarioId = "administrador") {
  const u = await s.banco.usuario.findUniqueOrThrow({ where: { id: usuarioId }, include: { perfilAcesso: true } });
  s.navegador = { userId: u.id, nome: u.nome, email: u.email, admin: u.perfilAcesso?.sistema === "ADMINISTRADOR", versao: u.sessaoVersao, perfilNome: u.perfilAcesso?.nome ?? "Sem perfil", permissoes: u.perfilAcesso?.permissoes as SessaoAtual["permissoes"], excecoes: {} };
}
async function chamada(nome: Parameters<typeof executarNegocioMcp>[0], dados: unknown, access: string) { return executarNegocioMcp(nome, dados, access); }
async function comClienteTeste(trabalho: (executar: (nome: Parameters<typeof executarNegocioMcp>[0], dados: Record<string, unknown>)=>Promise<Record<string, unknown>>) => Promise<void>) {
  const access = await token(FUNCOES_NEGOCIO_MCP.map(f=>f.escopo));
  const client = new McpClient({ name: "fluxos-negocio-ficticios", version: "2.0.0" });
  const transporte = new StreamableHTTPClientTransport(new URL(recurso), { requestInit: { headers: { Authorization: `Bearer ${access}` } } });
  let chamadas = 0;
  try {
    await client.connect(transporte);
    const chamar = async (nome: Parameters<typeof executarNegocioMcp>[0], argumentos: Record<string,unknown>) => {
      if (++chamadas % 30 === 0) await s.banco.mcpLimite.deleteMany();
      const r = await client.callTool({name:nome,arguments:argumentos});
      if (r.isError) await executarNegocioMcp(nome, argumentos, access);
      expect(r.isError, `${nome}: ${JSON.stringify(r)}`).not.toBe(true);
      const estrutura = r.structuredContent as {estado:string;dados:Record<string,unknown>};
      expect(estrutura).toHaveProperty("estado");
      if (estrutura.estado !== "AGUARDANDO_APROVACAO") sucessos.add(nome);
      return estrutura;
    };
    await trabalho(async (nome,dados)=> {
      const f = FUNCOES_NEGOCIO_MCP.find(f=>f.nome===nome)!;
      if (!f.escrita) return (await chamar(nome,dados)).dados;
      const key=chave();
      if (!f.confirmacao) return (await chamar(nome,{chave:key,dados})).dados;
      const p=await chamar(nome,{etapa:"PREPARAR",chave:key,dados});
      expect(p.estado).toBe("AGUARDANDO_APROVACAO");
      const id=p.dados.propostaId as string;
      await sessao(); const revisao=await carregarRevisaoMcp(id);
      expect(revisao).not.toBeNull(); await aprovarRevisaoMcp(id,revisao!.conteudoHash);
      const r=await chamar(nome,{etapa:"EXECUTAR",chave:key,propostaId:id});
      expect(r.estado).toBe("OK");
      return r.dados;
    });
  } finally { await client.close(); }
}

describe.skipIf(process.env.MCP_BANCO_TESTE !== "1")("MCP multimódulo — OAuth, autorização central e transações reais", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (!["127.0.0.1", "localhost"].includes(url.hostname) || !url.pathname.endsWith("_teste")) throw Error("Banco fictício local obrigatório.");
    process.env.MCP_ORIGEM = origem;
    process.env.AUTH_SECRET = "segredo-ficticio-isolado-para-assinatura-de-entregas";
    pg = new Pg({ connectionString: url.toString() }); await pg.connect();
    await pg.query(`CREATE SCHEMA "${schema}"`); criado = true; await pg.query(`SET search_path TO "${schema}"`);
    for (const p of (await readdir("prisma/migrations", { withFileTypes: true })).filter(p => p.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
      if (p.name === "20261008010000_mcp_permissoes_centrais") {
        await pg.query(`INSERT INTO "ConfiguracaoLoja" ("id","updatedAt") VALUES ('singleton',now()) ON CONFLICT DO NOTHING;
          INSERT INTO "Usuario" ("id","nome","email","senhaHash","perfilAcessoId","updatedAt") VALUES ('legado-ficticio','Migração fictícia','migracao@example.invalid','sem-login','perfil-administrador',now());
          INSERT INTO "McpCliente" ("id","nome","redirectUris") VALUES ('cliente-legado','Cliente fictício',ARRAY['https://cliente.example.invalid/callback']);
          INSERT INTO "McpPerfil" ("id","nome","descricao","escopos","ativo") VALUES ('inativo-legado','Inativo fictício','Legado',ARRAY['financeiro:dre:ler'],false);`);
        for (const [id, perfil] of [["gerencial-legado","financeiro-gerencial"],["detalhado-legado","financeiro-detalhado"],["suspenso-legado","inativo-legado"]]) {
          await pg.query(`INSERT INTO "McpAutorizacao" ("id","nome","usuarioId","clienteId","perfilId","escopos","restricoes","situacao","versao","consentidaEm") VALUES ($1,'Conexão fictícia','legado-ficticio','cliente-legado',$2,$3,'{"contas":["banco-restrito"],"lancamentos":["titulo-restrito"]}','ATIVA',7,'2026-10-07')`,[id,perfil,ESCOPOS_FINANCEIROS_V1]);
          await pg.query(`INSERT INTO "McpToken" ("hash","autorizacaoId","versao","sessaoVersao","escopos","restricoes","emissor","destinatario","expiraEm","permissoesHash") VALUES ($1,$2,7,0,$3,'{"contas":["banco-restrito"],"lancamentos":["titulo-restrito"]}',$4,$5,now()+interval '1 hour','historico-ficticio')`,[id,id,ESCOPOS_FINANCEIROS_V1,origem,recurso]);
        }
      }
      await pg.query(prepararSqlMigrationFiscal(p.name, await readFile(`prisma/migrations/${p.name}/migration.sql`, "utf8")));
      if (p.name === "20261008010000_mcp_permissoes_centrais") {
        const a = (await pg.query('SELECT * FROM "McpAutorizacao" ORDER BY "id"')).rows;
        expect(a.find(x=>x.id==="gerencial-legado")).toMatchObject({ modeloAcesso: 2, versao: 7, situacao: "ATIVA", perfilId: "financeiro-gerencial", escopos: ESCOPOS_FINANCEIROS_V1.slice(0,3), restricoes: { contas: ["banco-restrito"], lancamentos: ["titulo-restrito"] } });
        expect(a.find(x=>x.id==="detalhado-legado")).toMatchObject({ modeloAcesso: 2, versao: 7, situacao: "ATIVA", escopos: ESCOPOS_FINANCEIROS_V1 });
        expect(a.find(x=>x.id==="suspenso-legado")?.situacao).toBe("SUSPENSA");
        expect((await pg.query('SELECT "redirectUris" FROM "McpCliente" WHERE "id"=\'cliente-legado\'')).rows[0].redirectUris).toEqual([callback]);
        expect((await pg.query('SELECT "versao","escopos" FROM "McpToken"')).rows).toEqual(Array.from({length:3},()=>({versao:7,escopos:ESCOPOS_FINANCEIROS_V1})));
      }
    }
    s.banco = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), options: `-c search_path=${schema}` }, { schema }) });
    expect(await s.banco.$queryRaw`SELECT current_schema() AS schema`).toEqual([{ schema }]);
    servidorHttp = createServer(async (entrada, saida) => {
      try {
        const partes: Buffer[] = [];
        for await (const parte of entrada) partes.push(Buffer.from(parte));
        const metodo = entrada.method ?? "GET";
        const headers = new Headers();
        for (const [nome, valor] of Object.entries(entrada.headers)) if (valor) headers.set(nome, Array.isArray(valor) ? valor.join(", ") : valor);
        const request = new Request(`${origem}${entrada.url}`, { method: metodo, headers, ...(["GET", "HEAD"].includes(metodo) ? {} : { body: Buffer.concat(partes) }) });
        const caminho = new URL(request.url).pathname;
        const response = caminho === "/api/mcp" ? await atenderMcp(request) : caminho === "/oauth/iniciar" ? await iniciarOAuthHttp(request) : caminho === "/oauth/token" ? await tokenOAuthHttp(request) : new Response(null, { status: 404 });
        saida.writeHead(response.status, Object.fromEntries(response.headers));
        saida.end(Buffer.from(await response.arrayBuffer()));
      } catch { saida.writeHead(500); saida.end(); }
    });
    await new Promise<void>((resolve, reject) => { servidorHttp.once("error", reject); servidorHttp.listen(45447, "127.0.0.1", resolve); });
  }, 60000);
  afterAll(async () => { if (servidorHttp) { servidorHttp.closeAllConnections(); await new Promise<void>(resolve => servidorHttp.close(() => resolve())); } await writeFile(".tmp-mcp/cobertura-sucessos.json", JSON.stringify({ aprovadas: [...sucessos].sort(), pendentes: FUNCOES_NEGOCIO_MCP.map(f=>f.nome).filter(n=>!sucessos.has(n)).sort() },null,2)); await s.banco?.$disconnect(); if (pg) { if (criado && /^teste_mcp_multi_[a-f0-9]{32}$/.test(schema)) await pg.query(`DROP SCHEMA "${schema}" CASCADE`); await pg.end(); } delete process.env.MCP_ORIGEM; });
  beforeEach(async () => {
    await pg.query('TRUNCATE "McpEvento", "McpLimite", "McpSolicitacaoOAuth", "McpCliente", "Usuario", "ClienteVenda", "ContaBancaria", "CategoriaFinanceira" CASCADE');
    s.navegador = null;
    await s.banco.configuracaoLoja.upsert({ where: { id: "singleton" }, create: {}, update: { pedidosLiberacao: { locais: [], movimentarEstoque: false } } });
    await s.banco.mcpConfiguracao.update({ where: { id: "singleton" }, data: { ativo: true } });
    await s.banco.perfilAcesso.upsert({ where: { id: "consulta-central" }, create: { id: "consulta-central", nome: "Consulta isolada", permissoes: { "vendas.clientes": ["visualizar"], "financeiro.dre": ["visualizar"] } }, update: { permissoes: { "vendas.clientes": ["visualizar"], "financeiro.dre": ["visualizar"] } } });
    await s.banco.perfilAcesso.upsert({ where: { id: "atendimento-central" }, create: { id: "atendimento-central", nome: "Atendimento isolado", permissoes: { "vendas.clientes": ["visualizar", "adicionar"], "vendas.pedidos": ["visualizar", "adicionar"] } }, update: {} });
    await s.banco.perfilAcesso.upsert({ where: { id: "administrador-integracoes" }, create: { id: "administrador-integracoes", nome: "Gestão técnica isolada", permissoes: { "configuracoes.mcp": ["visualizar", "editar"] } }, update: {} });
    await s.banco.usuario.createMany({ data: [
      { id: "administrador", nome: "Administrador fictício", email: "administrador@example.invalid", senhaHash: "sem-login", perfilAcessoId: "perfil-administrador" },
      { id: "consulta", nome: "Consulta fictícia", email: "consulta@example.invalid", senhaHash: "sem-login", perfilAcessoId: "consulta-central" },
      { id: "atendimento", nome: "Atendimento fictício", email: "atendimento@example.invalid", senhaHash: "sem-login", perfilAcessoId: "atendimento-central" },
      { id: "integracoes", nome: "Gestão fictícia", email: "integracoes@example.invalid", senhaHash: "sem-login", perfilAcessoId: "administrador-integracoes" },
    ] });
    clienteId = (await s.banco.mcpCliente.create({ data: { nome: "Cliente OAuth compartilhado fictício", redirectUris: [callback] } })).id;
    autorizacaoId = (await s.banco.mcpAutorizacao.create({ data: { nome: "Conexão fictícia", usuarioId: "administrador", clienteId, escopos: [], restricoes: { contas: null, lancamentos: null } } })).id;
    await s.banco.contaBancaria.create({ data: { id: "conta-ficticia", nome: "Conta fictícia" } });
    await s.banco.categoriaFinanceira.create({ data: { id: "categoria-ficticia", nome: "Despesa fictícia", grupo: "DESPESAS_OPERACIONAIS" } });
    await s.banco.lancamentoFinanceiro.create({ data: { id: "titulo-ficticio", tipo: "DESPESA", descricao: "Dado fictício não deve ser logado", valor: "12.34", categoriaId: "categoria-ficticia", dataCompetencia: new Date("2026-10-01T12:00:00Z"), dataVencimento: new Date("2026-10-15T12:00:00Z") } });
  });
  it("OAuth PKCE e consulta autenticada atravessam HTTP real sem autenticação fabricada", async () => {
    const verifier = randomBytes(48).toString("base64url");
    const parametros = { response_type: "code", client_id: clienteId, redirect_uri: callback, resource: recurso, scope: escopo("conexao_contexto"), state: randomUUID(), code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" };
    const rejeitada = await fetch(`${origem}/oauth/iniciar?${new URLSearchParams({ ...parametros, redirect_uri: `${callback}/` })}`, { redirect: "manual" });
    expect(rejeitada.status).toBe(400);
    const inicio = await fetch(`${origem}/oauth/iniciar?${new URLSearchParams(parametros)}`, { redirect: "manual" });
    expect(inicio.status).toBe(302);
    const solicitacao = new URL(inicio.headers.get("location")!).searchParams.get("solicitacao")!;
    // Consentimento de usuário fictício pelo serviço real, sem alterar a conexão pessoal.
    const a = await s.banco.mcpAutorizacao.findUniqueOrThrow({ where: { id: autorizacaoId }, include: INCLUIR_AUTORIZACAO });
    const callbackAutorizado = new URL(await consentirOAuth(solicitacao, a.id, "administrador", revisaoConsentimento(a)));
    const campos = { grant_type: "authorization_code", client_id: clienteId, redirect_uri: callback, resource: recurso, code: callbackAutorizado.searchParams.get("code")!, code_verifier: verifier };
    const enviar = (valores: typeof campos) => fetch(`${origem}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(valores) });
    expect((await enviar({ ...campos, code_verifier: randomBytes(48).toString("base64url") })).status).toBe(400);
    // A biblioteca consome o código na tentativa recusada. Um novo fluxo é
    // necessário; reutilizá-lo não deve virar um bypass da verificação PKCE.
    const novoInicio = await fetch(`${origem}/oauth/iniciar?${new URLSearchParams(parametros)}`, { redirect: "manual" });
    expect(novoInicio.status).toBe(302);
    const novaSolicitacao = new URL(novoInicio.headers.get("location")!).searchParams.get("solicitacao")!;
    const atual = await s.banco.mcpAutorizacao.findUniqueOrThrow({ where: { id: autorizacaoId }, include: INCLUIR_AUTORIZACAO });
    campos.code = new URL(await consentirOAuth(novaSolicitacao, atual.id, "administrador", revisaoConsentimento(atual))).searchParams.get("code")!;
    const resposta = await enviar(campos);
    expect(resposta.status).toBe(200);
    const access = (await resposta.json()).access_token as string;
    const client = new McpClient({ name: "http-oauth-ficticio", version: "2.0.0" });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(recurso), { requestInit: { headers: { Authorization: `Bearer ${access}` } } }));
      expect((await client.listTools()).tools.map(t=>t.name)).toEqual(["conexao_contexto"]);
      const r = await client.callTool({ name: "conexao_contexto", arguments: {} });
      expect(r.isError).not.toBe(true);
      expect(r.structuredContent).toMatchObject({ dados: { usuario: { id: "administrador" }, conexaoId: autorizacaoId } });
      sucessos.add("conexao_contexto");
    } finally { await client.close(); }
  });
  it("mesmo cliente OAuth atende identidades distintas sem fallback para seu cadastrador", async () => {
    const outro = await s.banco.mcpAutorizacao.create({ data: { nome: "Outra conexão", usuarioId: "consulta", clienteId, escopos: [], restricoes: { contas: null, lancamentos: null } } });
    const a = await token([escopo("conexao_contexto")]); const b = await token([escopo("conexao_contexto")], "consulta", outro.id);
    expect((await chamada("conexao_contexto", {}, a)).dados).toMatchObject({ usuario: { id: "administrador" } });
    expect((await chamada("conexao_contexto", {}, b)).dados).toMatchObject({ usuario: { id: "consulta", perfil: "Consulta isolada" } });
  });
  it("cadastro real é idempotente e vinculado a identidade, operação e conteúdo", async () => {
    const access = await token([escopo("clientes_criar")]); const pedido = { chave: chave(), dados: cliente };
    const a = await chamada("clientes_criar", pedido, access); const b = await chamada("clientes_criar", pedido, access);
    expect(b).toEqual(a); expect(await s.banco.clienteVenda.count()).toBe(1);
    await expect(chamada("clientes_criar", { ...pedido, dados: { ...cliente, nome: "Outro nome" } }, access)).rejects.toThrow("outro conteúdo");
    const eventos = await s.banco.mcpEvento.findMany({ where: { acao: "NEGOCIO_EXECUTADO" } });
    expect(eventos).toHaveLength(1); expect(eventos[0].usuarioId).toBe("administrador"); expect(eventos[0].registros).toHaveLength(1);
    expect(JSON.stringify(eventos)).not.toContain("Cliente fictício");
  });
  it("concorrência e repetição não duplicam cadastros", async () => {
    const access = await token([escopo("clientes_criar")]); const pedido = { chave: chave(), dados: cliente };
    const r = await Promise.allSettled([chamada("clientes_criar", pedido, access), chamada("clientes_criar", pedido, access)]);
    expect(r.some(x => x.status === "fulfilled")).toBe(true); expect(await s.banco.clienteVenda.count()).toBe(1);
    expect((await chamada("clientes_criar", pedido, access)).estado).toBe("OK");
  });
  it("preview usa a validação real e reverte toda alteração financeira", async () => {
    const access = await token([escopo("financeiro_baixar_lancamento")]);
    const proposta = await chamada("financeiro_baixar_lancamento", { etapa: "PREPARAR", chave: chave(), dados: { id: "titulo-ficticio", contaId: "conta-ficticia", data: "2026-10-07" } }, access);
    expect(proposta.estado).toBe("AGUARDANDO_APROVACAO");
    expect((await s.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: "titulo-ficticio" } })).status).toBe("PENDENTE");
    expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
    expect(proposta.dados).toMatchObject({ impactos: { "Variação de registros bancários internos": 1 } });
  });
  it("aprovação humana autenticada habilita uma execução; IA não fornece confirmação", async () => {
    const access = await token([escopo("financeiro_baixar_lancamento")]); const key = chave();
    const p = await chamada("financeiro_baixar_lancamento", { etapa: "PREPARAR", chave: key, dados: { id: "titulo-ficticio", contaId: "conta-ficticia", data: "2026-10-07" } }, access);
    const id = (p.dados as { propostaId: string }).propostaId;
    await expect(chamada("financeiro_baixar_lancamento", { etapa: "EXECUTAR", chave: key, propostaId: id, confirmado: true }, access)).rejects.toThrow();
    await expect(chamada("financeiro_baixar_lancamento", { etapa: "EXECUTAR", chave: key, propostaId: id }, access)).rejects.toThrow("Revisão humana");
    await expect(aprovarRevisaoMcp(id, "f".repeat(64))).rejects.toThrow();
    await sessao("consulta"); await expect(carregarRevisaoMcp(id)).resolves.toBeNull();
    await sessao(); const revisao = await carregarRevisaoMcp(id); await aprovarRevisaoMcp(id, revisao!.conteudoHash);
    const resultado = await chamada("financeiro_baixar_lancamento", { etapa: "EXECUTAR", chave: key, propostaId: id }, access);
    expect(resultado.estado).toBe("OK");
    expect(await s.banco.movimentacaoBancaria.count()).toBe(1);
    expect(await chamada("financeiro_baixar_lancamento", { etapa: "EXECUTAR", chave: key, propostaId: id }, access)).toEqual(resultado);
    expect(await s.banco.movimentacaoBancaria.count()).toBe(1);
  });
  it.each(["expirada", "alterada", "revogada", "permissao-removida"])("aprovação %s não efetiva baixa", async caso => {
    const access = await token([escopo("financeiro_baixar_lancamento")]); const key = chave();
    const p = await chamada("financeiro_baixar_lancamento", { etapa: "PREPARAR", chave: key, dados: { id: "titulo-ficticio", contaId: "conta-ficticia", data: "2026-10-07" } }, access);
    const id = (p.dados as { propostaId: string }).propostaId; await sessao();
    const revisao = await carregarRevisaoMcp(id); await aprovarRevisaoMcp(id, revisao!.conteudoHash);
    if (caso === "expirada") await s.banco.mcpOperacao.update({ where: { id }, data: { expiraEm: new Date(0) } });
    if (caso === "alterada") await s.banco.lancamentoFinanceiro.update({ where: { id: "titulo-ficticio" }, data: { valor: "23.45" } });
    if (caso === "revogada") await s.banco.mcpAutorizacao.update({ where: { id: autorizacaoId }, data: { situacao: "REVOGADA" } });
    if (caso === "permissao-removida") await s.banco.usuario.update({ where: { id: "administrador" }, data: { perfilAcessoId: "consulta-central" } });
    await expect(chamada("financeiro_baixar_lancamento", { etapa: "EXECUTAR", chave: key, propostaId: id }, access)).rejects.toThrow();
    expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
  });
  it("permissões atuais reduzem token aberto sem acrescentar novos escopos", async () => {
    const access = await token([escopo("clientes_criar"), escopo("clientes_consultar")]);
    await s.banco.usuario.update({ where: { id: "administrador" }, data: { perfilAcessoId: "consulta-central" } });
    expect((await autenticarMcp(access)).escopos).toEqual([escopo("clientes_consultar")]);
    await expect(chamada("clientes_criar", { chave: chave(), dados: cliente }, access)).rejects.toThrow();
    const consulta = await chamada("clientes_consultar", {}, access);
    expect(consulta.estado).toBe("VAZIO"); expect(consulta.dados).toMatchObject({ registros: [], total: 0 });
    await s.banco.usuario.update({ where: { id: "administrador" }, data: { perfilAcessoId: "perfil-administrador" } });
    expect((await autenticarMcp(access)).escopos).not.toContain(escopo("financeiro_baixar_lancamento"));
  });
  it("consentimento financeiro v1 não descobre nem executa ferramentas v2", async () => {
    const access = await token(ESCOPOS_FINANCEIROS_V1);
    const client = new McpClient({ name: "cliente-ficticio", version: "1.0.0" });
    const transporte = new StreamableHTTPClientTransport(new URL(recurso), { fetch: async (url, opcoes) => { const h = new Headers(opcoes?.headers); h.set("host", new URL(origem).host); h.set("authorization", `Bearer ${access}`); return atenderMcp(new Request(url, { ...opcoes, headers: h })); } });
    try { await client.connect(transporte); const ferramentas = await client.listTools(); expect(ferramentas.tools.map(f => f.name)).toHaveLength(6); expect(ferramentas.tools.every(f => f.annotations?.readOnlyHint)).toBe(true); const r = await client.callTool({ name: "clientes_criar", arguments: { chave: chave(), dados: cliente } }); expect(r.isError).toBe(true); }
    finally { await client.close(); }
    expect(await s.banco.clienteVenda.count()).toBe(0);
  });
  it("administração técnica não administra perfis MCP e não concede negócio", async () => {
    await expect(alterarAdministracaoMcp({ tipo: "perfil", nome: "Administrador MCP", descricao: "Indevido", escopos: [], ativo: true }, "integracoes")).rejects.toThrow();
    const outra = await s.banco.mcpAutorizacao.create({ data: { nome: "Técnica", usuarioId: "integracoes", clienteId, escopos: [], restricoes: { contas: null, lancamentos: null } } });
    await expect(token([escopo("financeiro_baixar_lancamento")], "integracoes", outra.id)).rejects.toThrow();
    await expect(alterarAdministracaoMcp({ tipo: "global", ativo: true }, "atendimento")).rejects.toThrow("Administração não permitida");
  });
  it("transporte real nega todas as ferramentas não consentidas mesmo em chamada direta", async () => {
    const access = await token([escopo("conexao_contexto")]);
    const client = new McpClient({ name: "cliente-ficticio", version: "2.0.0" });
    const transporte = new StreamableHTTPClientTransport(new URL(recurso), { fetch: async (url, opcoes) => { const h = new Headers(opcoes?.headers); h.set("host", new URL(origem).host); h.set("authorization", `Bearer ${access}`); return atenderMcp(new Request(url, { ...opcoes, headers: h })); } });
    try {
      await client.connect(transporte); expect((await client.listTools()).tools.map(f => f.name)).toEqual(["conexao_contexto"]);
      let i = 0;
      for (const f of FUNCOES_NEGOCIO_MCP.filter(f => f.nome !== "conexao_contexto")) {
        if (++i % 40 === 0) await s.banco.mcpLimite.deleteMany();
        const r = await client.callTool({ name: f.nome, arguments: {} });
        expect(r.isError, f.nome).toBe(true);
        expect(JSON.stringify(r)).not.toContain("rate_limit");
      }
    } finally { await client.close(); }
    expect(await s.banco.mcpOperacao.count()).toBe(0);
    expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
  }, 120000);
  it("redução central bloqueia cada função de negócio em token já aberto pelo HTTP", async () => {
    const access = await token(FUNCOES_NEGOCIO_MCP.map(f => f.escopo));
    const client = new McpClient({ name: "reducao-central-ficticia", version: "2.0.0" });
    const transporte = new StreamableHTTPClientTransport(new URL(recurso), { requestInit: { headers: { Authorization: `Bearer ${access}` } } });
    try {
      await client.connect(transporte);
      await s.banco.perfilAcesso.update({ where: { id: "consulta-central" }, data: { permissoes: {} } });
      await s.banco.usuario.update({ where: { id: "administrador" }, data: { perfilAcessoId: "consulta-central" } });
      expect((await client.listTools()).tools.map(f => f.name)).toEqual(["conexao_contexto"]);
      let i=0;
      for (const f of FUNCOES_NEGOCIO_MCP.filter(f=>f.nome!=="conexao_contexto")) {
        if (++i%30===0) await s.banco.mcpLimite.deleteMany();
        const r=await client.callTool({name:f.nome,arguments:{}});
        expect(r.isError,f.nome).toBe(true);
        expect(JSON.stringify(r)).not.toContain("rate_limit");
      }
      expect(await s.banco.mcpOperacao.count()).toBe(0);
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
      expect(await s.banco.movimentacaoEstoque.count()).toBe(0);
    } finally { await client.close(); }
  }, 120000);
  it("edição financeira parcial preserva valores, datas e classificação omitidos", async () => {
    await comClienteTeste(async executar => {
      const criado=await executar("financeiro_criar_lancamento",{descricao:"Despesa parcial fictícia",tipo:"DESPESA",valor:"12.34",categoriaId:"categoria-ficticia",competencia:"2026-10-01",vencimento:"2026-10-15"});
      const antes=await s.banco.lancamentoFinanceiro.findUniqueOrThrow({where:{id:(criado.ids as string[])[0]}});
      await executar("financeiro_atualizar_lancamento",{id:antes.id,revisao:antes.updatedAt.toISOString(),descricao:"Descrição fictícia atualizada"});
      const depois=await s.banco.lancamentoFinanceiro.findUniqueOrThrow({where:{id:antes.id}});
      expect(depois).toMatchObject({tipo:antes.tipo,categoriaId:antes.categoriaId,dataCompetencia:antes.dataCompetencia,dataVencimento:antes.dataVencimento,descricao:"DESCRIÇÃO FICTÍCIA ATUALIZADA"});
      expect(depois.valor.toString()).toBe(antes.valor.toString());
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
    });
  });
  it("catálogo completo e consultas reais funcionam pelo SDK com o consentimento correspondente", async () => {
    const access = await token(FUNCOES_NEGOCIO_MCP.map(f => f.escopo));
    const client = new McpClient({ name: "cliente-cobertura-ficticio", version: "2.0.0" });
    const transporte = new StreamableHTTPClientTransport(new URL(recurso), { fetch: async (url, opcoes) => { const h = new Headers(opcoes?.headers); h.set("host", new URL(origem).host); h.set("authorization", `Bearer ${access}`); return atenderMcp(new Request(url, { ...opcoes, headers: h })); } });
    try {
      await client.connect(transporte);
      let cursor: string | undefined;
      const ferramentas = [] as Awaited<ReturnType<typeof client.listTools>>["tools"];
      do { const pagina = await client.listTools(cursor ? { cursor } : undefined); ferramentas.push(...pagina.tools); cursor = pagina.nextCursor; } while(cursor);
      expect(ferramentas.map(f=>f.name).sort()).toEqual(FUNCOES_NEGOCIO_MCP.map(f=>f.nome).sort());
      const baixa = ferramentas.find(f=>f.name==="financeiro_baixar_lancamento")!.inputSchema.oneOf as { required: string[] }[];
      expect(baixa).toHaveLength(2);
      expect(baixa[0].required).toEqual(["etapa", "chave", "dados"]);
      expect(baixa[1].required).toEqual(["etapa", "chave", "propostaId"]);
      await expect(client.listTools({ cursor: "invalido" })).rejects.toThrow("Cursor inválido");
      const semParametros = FUNCOES_NEGOCIO_MCP.filter(f => !f.escrita && f.entrada.safeParse({}).success);
      let i = 0;
      for (const f of semParametros) {
        if (++i % 35 === 0) await s.banco.mcpLimite.deleteMany();
        const r = await client.callTool({ name: f.nome, arguments: {} });
        expect(r.isError, `${f.nome}: ${JSON.stringify(r)}`).not.toBe(true);
        expect(r.structuredContent, f.nome).toHaveProperty("geradoEm");
        sucessos.add(f.nome);
      }
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
      expect(await s.banco.movimentacaoEstoque.count()).toBe(0);
      expect(await s.banco.mcpOperacao.count()).toBe(0);
    } finally { await client.close(); }
  }, 120000);
  it("cadastros comerciais reais completam seus ciclos pelo MCP, com versões e revisão de exclusões", async () => {
    await comClienteTeste(async executar=> {
      const c=await executar("clientes_criar",{...cliente,email:"contato@example.invalid",telefone:"11999990000"}), clienteId=c.id as string;
      await executar("clientes_atualizar",{id:clienteId,versao:1,nome:"Cliente fictício atualizado"});
      expect(await s.banco.clienteVenda.findUniqueOrThrow({where:{id:clienteId}})).toMatchObject({email:"contato@example.invalid",telefone:"11999990000"});
      await executar("clientes_inativar",{id:clienteId,versao:2});
      await executar("clientes_disponibilidade",{id:clienteId,versao:3,ativo:true});
      const cat=await executar("catalogo_categoria_criar",{nome:"Categoria fictícia",ativo:true}), categoriaId=cat.id as string;
      await executar("catalogo_categoria_atualizar",{id:categoriaId,versao:1,nome:"Categoria revisada",ativo:true});
      await executar("catalogo_categoria_disponibilidade",{id:categoriaId,versao:2,ativo:false});
      await executar("catalogo_ordenar_categorias",{itens:[{id:categoriaId,versao:3}]});
      const categoriaOrdenada=await s.banco.categoriaVenda.findUniqueOrThrow({where:{id:categoriaId}});
      await executar("catalogo_categoria_disponibilidade",{id:categoriaId,versao:categoriaOrdenada.versao,ativo:true});
      const e=await executar("embalagens_criar",{nome:"Embalagem fictícia",ativo:true}), embalagemId=e.id as string;
      await executar("embalagens_atualizar",{id:embalagemId,versao:1,nome:"Embalagem revisada",ativo:false});
      const produto={nome:"Produto fictício",tipo:"PADRAO",unidade:"UN",preco:"12.34",componentes:[],categorias:[categoriaId],grupos:[],ativo:true};
      const p=await executar("produtos_criar",produto), produtoId=p.id as string;
      await executar("produtos_composicao",{id:produtoId});
      await executar("produtos_custos",{id:produtoId});
      await executar("produtos_atualizar",{id:produtoId,versao:1,nome:"Produto revisado"});
      expect(await s.banco.produtoCategoriaVenda.count({where:{produtoId}})).toBe(1);
      expect((await s.banco.produtoVenda.findUniqueOrThrow({where:{id:produtoId}})).preco.toString()).toBe("12.34");
      await executar("produtos_preco",{id:produtoId,versao:2,preco:"15.00"});
      await executar("produtos_disponibilidade",{id:produtoId,versao:3,ativo:false});
      await executar("catalogo_ordenar_produtos",{categoriaId,itens:[{id:produtoId,versao:4}]});
      const atual=await s.banco.produtoVenda.findUniqueOrThrow({where:{id:produtoId}});
      await executar("fiscal_produto_consultar",{id:produtoId});
      await executar("fiscal_produto_atualizar",{id:produtoId,versao:atual.versao,fiscal:{},revisado:false,grupoFiscalId:null});
      const gcat=await executar("complementos_categoria_criar",{nome:"Grupo fictício",ativo:true}), grupoCatId=gcat.id as string;
      await executar("complementos_categoria_atualizar",{id:grupoCatId,versao:1,nome:"Grupo revisado",ativo:true});
      await executar("complementos_categoria_disponibilidade",{id:grupoCatId,versao:2,ativo:false});
      await executar("complementos_categoria_disponibilidade",{id:grupoCatId,versao:3,ativo:true});
      const grupo={nome:"Opções fictícias",ativo:true,tipo:"COMPLEMENTAR",categoriaId:grupoCatId,minimo:0,maximo:1,repetir:false,opcoes:[]};
      const g=await executar("complementos_criar",grupo), grupoId=g.id as string;
      await executar("complementos_atualizar",{...grupo,id:grupoId,versao:1,nome:"Opções revisadas"});
      await executar("complementos_disponibilidade",{id:grupoId,versao:2,ativo:false});
      await executar("complementos_excluir",{id:grupoId,versao:3});
      await executar("complementos_categoria_excluir",{id:grupoCatId,versao:4});
      const fg=await executar("fiscal_grupo_criar",{nome:"Fiscal fictício",ativo:true,fiscal:{}}), fiscalId=fg.id as string;
      await executar("fiscal_grupo_atualizar",{id:fiscalId,versao:1,nome:"Fiscal revisado",ativo:true,fiscal:{},atualizarVinculados:false});
      await executar("fiscal_grupo_disponibilidade",{id:fiscalId,versao:2,ativo:false});
      await executar("fiscal_grupo_excluir",{id:fiscalId,versao:3});
      const final=await s.banco.produtoVenda.findUniqueOrThrow({where:{id:produtoId}});
      await executar("produtos_excluir",{id:produtoId,versao:final.versao});
      const categoria=await s.banco.categoriaVenda.findUniqueOrThrow({where:{id:categoriaId}});
      await executar("catalogo_categoria_excluir",{id:categoriaId,versao:categoria.versao});
      expect(await s.banco.produtoVenda.count()).toBe(0);
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
    });
  },120000);
  it("cadastros auxiliares, horários, slots e etiquetas operam pelo transporte sem impressão real", async () => {
    await comClienteTeste(async executar => {
      const receita = await s.banco.categoriaFinanceira.create({ data:{nome:"Receita auxiliar fictícia",grupo:"RECEITA_BRUTA"} });
      const canal = await executar("canais_criar",{nome:"Canal fictício",categoriaReceitaId:receita.id});
      await executar("canais_atualizar",{id:canal.id,versao:1,nome:"Canal revisado",categoriaReceitaId:receita.id});
      const forma={nome:"Dinheiro auxiliar fictício",ativo:true,tipo:"DINHEIRO",taxaPercentual:"0",taxaFixa:"0",prazoDias:0,inicioPrazo:"VENDA",contagemPrazo:"CORRIDOS",vencimentoFlexivel:false,permiteParcelamento:false,maximoParcelas:1,faixasTaxa:[],observacoes:""};
      const f=await executar("pagamento_forma_criar",forma);
      await executar("pagamento_forma_atualizar",{...forma,id:f.id,versao:1,nome:"Forma revisada fictícia"});
      await executar("pagamento_forma_disponibilidade",{id:f.id,versao:2,ativo:false});
      await executar("pagamento_forma_atualizar",{id:f.id,versao:3,nome:"Forma inativa renomeada"});
      expect(await s.banco.formaPagamentoVenda.findUniqueOrThrow({where:{id:f.id as string}})).toMatchObject({ativo:false,tipo:"DINHEIRO",prazoDias:0,maximoParcelas:1});
      const cat=await executar("insumos_categoria_criar",{nome:"Categoria sem uso fictícia"});
      const catId=(cat.categoria as {id:string} | undefined)?.id ?? cat.id;
      const participante=await executar("insumos_categoria_criar",{nome:"Categoria com porções fictícias"});
      const medida=await executar("insumos_criar",{nome:"Insumo para ordenar porções",tipo:"INSUMO",unidade:"KG",categoriaId:participante.id});
      await executar("porcoes_criar",{insumoId:medida.id,nome:"Porção de teste",quantidade:"0.25",unidade:"KG"});
      const categorias=await s.banco.categoria.findMany({where:{insumos:{some:{porcoes:{some:{excluidoEm:null}}}}}});
      await executar("porcoes_ordenar_categorias",{itens:categorias.map(c=>({id:c.id,versao:c.versaoOrdemPorcoes}))});
      const atualCat=await s.banco.categoria.findUniqueOrThrow({where:{id:catId as string}});
      await executar("insumos_categoria_excluir",{id:atualCat.id,versao:atualCat.versaoOrdemPorcoes});
      const perda=await executar("perdas_categoria_criar",{nome:"Categoria perda sem uso"});
      const perdaId=(perda.categoria as {id:string}|undefined)?.id ?? perda.id;
      await executar("perdas_categoria_disponibilidade",{id:perdaId,ativo:false});
      await executar("perdas_categoria_excluir",{id:perdaId});
      const loja=await s.banco.configuracaoLoja.findUniqueOrThrow({where:{id:"singleton"}});
      await executar("horarios_atualizar",{versao:loja.versaoHorariosPedidos,horarios:{grade:60,dias:Array.from({length:7},()=>({intervalos:[{inicio:"08:00",fim:"18:00"}]}))}});
      const endereco={pais:"Brasil",cep:"01001000",logradouro:"Rua fictícia",numero:"10",complemento:"",bairro:"Centro",cidade:"São Paulo",uf:"SP"};
      const config={origemTipo:"PERSONALIZADA",origemNome:"Origem fictícia",origem:endereco,veiculos:[{id:"moto-ficticia",nome:"Moto fictícia",perfil:"MOTO",ativo:true,slotsMinimos:0,slotsMaximos:10}],faixas:[{id:"faixa-ficticia",limiteMetros:5000,precos:{"moto-ficticia":"5.00"}}]};
      // Somente fixture isolada: não ativa mapas/canais nem muda flags reais.
      await s.banco.configuracaoLoja.update({where:{id:"singleton"},data:{entregas:{...config,modelo:"SLOTS",ativo:false,veiculo:null}}});
      const atualLoja=await s.banco.configuracaoLoja.findUniqueOrThrow({where:{id:"singleton"}});
      await executar("entregas_atualizar_slots",{versao:atualLoja.versaoEntregas,config});
      await executar("entregas_simular",{atendimento:"RETIRADA",endereco:null,subtotalProdutos:"10.00",clienteId:null});
      await executar("catalogo_importar",{conteudo:JSON.stringify({formato:1,origem:"OUTRO",loja:"ficticia",referencia:"fixture",categorias:[{chave:"categoria-importada",nome:"Categoria importada fictícia"}],grupos:[],produtos:[]})});
      const insumo=await s.banco.insumo.create({data:{nome:"Preparação de etiqueta fictícia",tipo:"PRODUTO_INTERMEDIARIO",unidade:"KG"}});
      await executar("etiquetas_configuracao_produto",{insumoId:insumo.id});
      await executar("etiquetas_configurar_produto",{insumoId:insumo.id,versao:1,etiquetaHabilitada:true,validadeSecoDias:"",validadeRefrigeradoDias:"2",validadeCongeladoDias:"30"});
      const etiqueta=await executar("etiquetas_preparar",{insumoId:insumo.id,conservacao:"REFRIGERADO",quantidade:"1",lote:"FICTICIO",tamanho:"MM_60X60",copias:1,mostrarHora:true});
      const ponto=await s.banco.pontoImpressao.create({data:{nome:"Ponto sem impressora real",lojaId:"singleton",impressoraSelecionadaId:"usb-ficticia"}});
      await s.banco.dispositivoImpressao.create({data:{pontoId:ponto.id,tokenHash:"f".repeat(64),impressoraDetectada:true,vistoEm:new Date()}});
      const enviada=await executar("etiquetas_imprimir",{trabalhoId:etiqueta.trabalhoId,pontoId:ponto.id});
      expect(enviada).toMatchObject({estado:"PENDENTE",impressaoFisicaComprovada:false});
      expect(await s.banco.envioPontoImpressao.count()).toBe(1);
      // Resultado físico simulado exclusivamente na fixture; não há conector ativo.
      await s.banco.trabalhoEtiqueta.update({where:{id:etiqueta.trabalhoId as string},data:{status:"EXPORTADO"}});
      await executar("etiquetas_conferir_impressao",{trabalhoId:etiqueta.trabalhoId});
      await executar("etiquetas_reimprimir",{trabalhoId:etiqueta.trabalhoId,pontoId:ponto.id});
      expect(await s.banco.envioPontoImpressao.count()).toBe(2);
      await s.banco.mcpConfiguracao.update({where:{id:"singleton"},data:{ativo:false}});
      expect(await reservarProximoEnvio(ponto.id,"singleton")).toBeNull();
      expect(await reservarProximoEnvio(ponto.id,"singleton")).toBeNull();
      expect(await s.banco.envioPontoImpressao.count({where:{estado:"FALHA"}})).toBe(2);
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
    });
  },120000);
  it.each(["suspensao", "revogacao", "perfil", "sessao", "consentimento"])("efeito pendente não conserva acesso após %s", async caso => {
    await token([escopo("etiquetas_imprimir")]);
    const op = await s.banco.mcpOperacao.create({ data: { autorizacaoId, usuarioId: "administrador", ferramenta: "etiquetas_imprimir", chaveHash: "f".repeat(64), conteudoHash: "a".repeat(64), entrada: {}, proposta: {}, referencias: { versaoOAuth: 2, sessaoVersao: 0, registros: [] }, estado: "EXECUTADA", expiraEm: new Date(Date.now()+86400000), resultado: { estado: "PENDENTE" } } });
    const a = await s.banco.mcpAutorizacao.findUniqueOrThrow({ where: { id: autorizacaoId } });
    await s.banco.mcpOperacao.update({ where: { id: op.id }, data: { referencias: { versaoOAuth: a.versao, sessaoVersao: 0, registros: [] } } });
    const permitido = () => s.banco.$transaction(tx=>permitirEfeitoPendenteMcp(tx, op.id, "administrador"));
    expect(await permitido()).toBe(true);
    if (caso === "suspensao") await s.banco.mcpConfiguracao.update({ where: { id: "singleton" }, data: { ativo: false } });
    if (caso === "revogacao") await s.banco.mcpAutorizacao.update({ where: { id: autorizacaoId }, data: { situacao: "REVOGADA" } });
    if (caso === "perfil") await s.banco.usuario.update({ where: { id: "administrador" }, data: { perfilAcessoId: "consulta-central" } });
    if (caso === "sessao") await s.banco.usuario.update({ where: { id: "administrador" }, data: { sessaoVersao: { increment: 1 } } });
    if (caso === "consentimento") await s.banco.mcpAutorizacao.update({ where: { id: autorizacaoId }, data: { versao: { increment: 1 } } });
    expect(await permitido()).toBe(false);
    expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
  });
  it("suprimentos e estoque manual mantêm efeitos reais e reversões pelo transporte MCP", async () => {
    await comClienteTeste(async executar => {
      const canal = await executar("fornecedores_canal_criar", { nome: "Canal fictício" });
      const forma = await executar("fornecedores_forma_pagamento_criar", { nome: "Prazo fictício" });
      const fornecedor = { nome: "Fornecedor fictício MCP", razaoSocial: "Fornecedor fictício", cnpj: "11111111000191", canaisPedido: [canal.id], formasPagamento: [forma.id], ativo: true };
      await executar("fornecedores_criar", fornecedor);
      const f = await s.banco.fornecedor.findUniqueOrThrow({ where: { cnpj: fornecedor.cnpj } });
      await executar("fornecedores_atualizar", { ...fornecedor, id: f.id, revisao: f.updatedAt.toISOString(), nome: "Fornecedor revisado" });
      const fRevisado = await s.banco.fornecedor.findUniqueOrThrow({ where: { id: f.id } });
      await executar("fornecedores_atualizar", { id: f.id, revisao: fRevisado.updatedAt.toISOString(), nome: "Fornecedor parcial fictício" });
      const atualizado = await s.banco.fornecedor.findUniqueOrThrow({ where: { id: f.id }, include: { canaisPedido: true, formasPagamento: true } });
      expect(atualizado).toMatchObject({ cnpj: fornecedor.cnpj, canaisPedido: [{ id: canal.id }], formasPagamento: [{ id: forma.id }] });
      await executar("fornecedores_disponibilidade", { id: f.id, revisao: atualizado.updatedAt.toISOString(), ativo: false });
      await executar("fornecedores_importar", { linhas: [{ nome: "Fornecedor importado fictício", razaoSocial: "Fornecedor importado", cnpj: "22222222000191" }] });
      const importado = await s.banco.fornecedor.findUniqueOrThrow({ where: { cnpj: "22222222000191" } });
      await executar("fornecedores_excluir", { id: importado.id, revisao: importado.updatedAt.toISOString() });
      await executar("beneficiarios_criar", { nome: "Beneficiário fictício", documento: "11111111111", ativo: true });
      const ben = await s.banco.fornecedor.findFirstOrThrow({ where: { tipoCadastro: "BENEFICIARIO" } });
      await executar("beneficiarios_atualizar", { nome: "Beneficiário revisado", id: ben.id, revisao: ben.updatedAt.toISOString() });
      const benAtual = await s.banco.fornecedor.findUniqueOrThrow({ where: { id: ben.id } });
      expect(benAtual.cpf).toBe("11111111111");
      await executar("beneficiarios_excluir", { id: ben.id, revisao: benAtual.updatedAt.toISOString() });
      const categoria = await executar("insumos_categoria_criar", { nome: "Categoria fictícia MCP" });
      const cat = await s.banco.categoria.findUniqueOrThrow({ where: { id: categoria.id as string } });
      await executar("insumos_categoria_renomear", { id: cat.id, nome: "Categoria revisada MCP", nomeAnterior: cat.nome, versao: cat.versaoOrdemPorcoes });
      const centro = await executar("centros_custo_criar", { nome: "Centro fictício MCP" });
      const base = { nome: "Insumo fictício MCP", tipo: "INSUMO", unidade: "KG", categoriaId: cat.id, centroCustoId: centro.id, estoqueMinimo: "3", custoMedio: "2.5000", ativo: true };
      const insumo = await executar("insumos_criar", base), insumoId = insumo.id as string;
      await executar("insumos_custos", { id: insumoId });
      const i = await s.banco.insumo.findUniqueOrThrow({ where: { id: insumoId } });
      await executar("insumos_atualizar", { id: insumoId, revisao: i.updatedAt.toISOString(), especificacao: "Fixture isolada" });
      const parcial = await s.banco.insumo.findUniqueOrThrow({ where: { id: insumoId } });
      expect(parcial.custoMedio.toString()).toBe("2.5"); expect(parcial.estoqueMinimo.toString()).toBe("3"); expect(parcial.categoriaId).toBe(cat.id);
      const porcao = await executar("porcoes_criar", { insumoId, nome: "Porção fictícia", quantidade: "0.25", unidade: "KG" });
      const p = porcao.porcao as { id: string; versao: number };
      await executar("porcoes_consultar", { insumoId });
      await executar("porcoes_atualizar", { id: p.id, versao: p.versao, insumoId, nome: "Porção revisada", quantidade: "0.5", unidade: "KG" });
      await executar("porcoes_remover", { id: p.id, versao: p.versao + 1 });
      const locais = await executar("estoque_local_criar", { nome: "Local fictício MCP" }), localId = locais.id as string;
      const local = await s.banco.localEstoque.findUniqueOrThrow({ where: { id: localId } });
      await executar("estoque_local_renomear", { id: localId, revisao: local.updatedAt.toISOString(), nome: "Local revisado MCP" });
      await executar("estoque_entrada", { tipo: "OUTRO_MOTIVO", itens: [{ insumoId, localId, quantidade: "10", valorProdutos: "25.00" }], fornecedorId: null, data: "2026-10-08", dataVencimento: null, dataPagamento: null, contaBancariaId: null, observacao: "Fixture isolada" });
      const perda = await executar("perdas_registrar", { insumoId, localId, motivo: "VALIDADE_VENCIDA", quantidade: "1", data: "2026-10-08", observacao: "Fixture isolada" });
      const perdaId = (perda.perdaId ?? perda.id) as string;
      await executar("perdas_reverter", { id: perdaId, motivo: "Correção fictícia confirmada" });
      expect((await s.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId, localId } } })).quantidadeAtual.toString()).toBe("10");
      const contagem = await executar("contagens_iniciar", { localId, escopo: { tipo: "ITENS", insumoIds: [insumoId] } });
      const item = await s.banco.inventarioItem.findFirstOrThrow({ where: { contagemId: contagem.contagemId as string } });
      await executar("contagens_anotar", { itemId: item.id, revisao: item.updatedAt.toISOString(), quantidade: "9" });
      await executar("contagens_finalizar", { id: contagem.contagemId });
      expect((await s.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId, localId } } })).quantidadeAtual.toString()).toBe("9");
      await executar("contagens_cancelar", { id: contagem.contagemId, motivo: "Contagem fictícia revertida" });
      expect((await s.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId, localId } } })).quantidadeAtual.toString()).toBe("10");
      await executar("estoque_posicao_historica", { data: "2026-10-08", localId });
      const atualizadoInsumo = await s.banco.insumo.findUniqueOrThrow({ where: { id: insumoId } });
      await executar("insumos_disponibilidade", { id: insumoId, revisao: atualizadoInsumo.updatedAt.toISOString(), ativo: false });
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
    });
  }, 120000);
  it("pedidos reais preservam preparação, financeiro e cancelamento pelo MCP", async () => {
    await comClienteTeste(async executar => {
      const c = await executar("clientes_criar", { ...cliente, nome: "Comprador de pedidos fictício" });
      const categoria = await s.banco.categoriaFinanceira.create({ data: { nome: "Receita fictícia de pedido", grupo: "RECEITA_BRUTA" } });
      const deducao = await s.banco.categoriaFinanceira.create({ data: { nome: "Devolução fictícia", grupo: "DEDUCOES_RECEITA" } });
      const canal = await s.banco.canalVenda.create({ data: { nome: "Canal fictício de pedido", categoriaReceitaId: categoria.id, categoriaDevolucaoId: deducao.id } });
      const forma = await s.banco.formaPagamentoVenda.create({ data: { nome: "Pix fictício de pedido", tipo: "PIX" } });
      const produto = await executar("produtos_criar", { nome: "Produto de pedido fictício", tipo: "PADRAO", unidade: "UN", preco: "25.00" });
      const dados = { clienteId: c.id, canalId: canal.id, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatario: null, endereco: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }], pagamentoInformado: { formaId: forma.id, parcelas: 1, vencimentos: [] } };
      const rascunho = await executar("pedidos_criar_rascunho", dados), id = rascunho.id as string;
      const ref = async () => ({ id, versao: (await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id } })).versao });
      await executar("pedidos_salvar_rascunho", { ...await ref(), pedido: { ...dados, observacoes: "Observação fictícia, sem instruções de autorização" } });
      await executar("pedidos_confirmar", { ...await ref(), condicaoFinanceira: { categoriaId: categoria.id, dataCompetencia: "2026-10-08", parcelas: [{ valor: "50.00", vencimento: "2026-10-10", formaPagamentoVendaId: forma.id }] } });
      await executar("pedidos_consultar", { id });
      await executar("pedidos_agenda", { data: "2026-10-08", visao: "dia" });
      await executar("pedidos_programacao", { de: "2026-10-08", ate: "2026-10-10" });
      await executar("pedidos_revisar", { ...await ref(), pedido: { ...dados, observacoes: "Revisão fictícia" } });
      const titulo = await s.banco.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: id, status: "PENDENTE" } });
      await executar("pedidos_ajustar_vencimento", { pedidoId: id, tituloId: titulo.id, vencimento: "2026-10-11" });
      await executar("pedidos_registrar_recebimento", { pedidoId: id, tituloId: titulo.id, valor: "50.00", contaId: "conta-ficticia", data: "2026-10-08" });
      const pago = await s.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: titulo.id } });
      await executar("pedidos_corrigir_recebimento", { pedidoId: id, tituloId: titulo.id, revisao: pago.updatedAt.toISOString(), motivo: "Correção fictícia" });
      await executar("pedidos_registrar_recebimento", { pedidoId: id, tituloId: titulo.id, valor: "50.00", contaId: "conta-ficticia", data: "2026-10-08" });
      const item = await s.banco.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: id, vigente: true } });
      await executar("pedidos_iniciar_preparo", await ref());
      await executar("pedidos_preparar_item", { ...await ref(), itemId: item.id, quantidade: "2" });
      await executar("pedidos_marcar_pronto", await ref());
      await executar("pedidos_expedir_item", { ...await ref(), itemId: item.id, quantidade: "2" });
      await executar("pedidos_registrar_entrega", await ref());
      expect((await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id } })).entregueEm).not.toBeNull();
      await executar("pedidos_solicitar_devolucao", { pedidoId: id, devolver: "10.00", reter: "0.00", motivo: "Pós-venda fictício", politica: "", comunicacao: "Comunicação fictícia" });
      const tratamento = await s.banco.tratamentoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: id, tipo: "DEVOLUCAO" } });
      await executar("pedidos_devolucao_processando", { pedidoId: id, tratamentoId: tratamento.id, motivo: "Processamento fictício" });
      await executar("pedidos_devolucao_falhou", { pedidoId: id, tratamentoId: tratamento.id, motivo: "Falha fictícia" });
      await executar("pedidos_retomar_devolucao", { pedidoId: id, tratamentoId: tratamento.id });
      await executar("pedidos_devolucao_processando", { pedidoId: id, tratamentoId: tratamento.id, motivo: "Novo processamento fictício" });
      await executar("pedidos_concluir_devolucao_contextual", { pedidoId: id, tratamentoId: tratamento.id, contaId: "conta-ficticia", data: "2026-10-08", evidencia: "Devolução fictícia registrada localmente" });
      const cancelavel = await executar("pedidos_criar_rascunho", dados), idCancelavel = cancelavel.id as string;
      await executar("pedidos_confirmar", { id: idCancelavel, versao: 1, condicaoFinanceira: { categoriaId: categoria.id, dataCompetencia: "2026-10-08", parcelas: [{ valor: "50.00", vencimento: "2026-10-10", formaPagamentoVendaId: forma.id }] } });
      const antes = await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id: idCancelavel } });
      await executar("pedidos_cancelar", { id: idCancelavel, versao: antes.versao, motivo: "Cancelamento fictício sem pagamento" });
      expect((await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id: idCancelavel } })).status).toBe("CANCELADO");
      expect(await s.banco.movimentacaoEstoque.count()).toBe(0);
    });
  }, 120000);
  it("pedidos registram fatos financeiros externos, devoluções e crédito sem tráfego bancário", async () => {
    await comClienteTeste(async executar => {
      const c = await executar("clientes_criar", { ...cliente, nome: "Comprador financeiro fictício" });
      const receita = await s.banco.categoriaFinanceira.create({ data: { nome: "Receita financeira fictícia", grupo: "RECEITA_BRUTA" } });
      const deducao = await s.banco.categoriaFinanceira.create({ data: { nome: "Devolução financeira fictícia", grupo: "DEDUCOES_RECEITA" } });
      const canal = await s.banco.canalVenda.create({ data: { nome: "Canal financeiro fictício", categoriaReceitaId: receita.id, categoriaDevolucaoId: deducao.id } });
      const pix = await s.banco.formaPagamentoVenda.create({ data: { nome: "Pix financeiro fictício", tipo: "PIX" } });
      const boleto = await s.banco.formaPagamentoVenda.create({ data: { nome: "Boleto financeiro fictício", tipo: "BOLETO" } });
      const cartao = await s.banco.formaPagamentoVenda.create({ data: { nome: "Cartão financeiro fictício", tipo: "CARTAO_CREDITO" } });
      const produto = await executar("produtos_criar", { nome: "Produto financeiro fictício", tipo: "PADRAO", unidade: "UN", preco: "50.00" });
      const dados = (formaId: string) => ({ clienteId: c.id, canalId: canal.id, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatario: null, endereco: null, itens: [{ produtoId: produto.id, quantidade: "1", escolhas: {}, precoManual: null }], pagamentoInformado: { formaId, parcelas: 1, vencimentos: formaId === boleto.id ? ["2026-10-10"] : [] } });
      const ref = async (id: string) => ({ id, versao: (await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id } })).versao });
      const novo = async (formaId: string, creditoUtilizado = "0.00") => {
        const p = await executar("pedidos_criar_rascunho", dados(formaId)); const id = p.id as string;
        await executar("pedidos_confirmar", { ...await ref(id), condicaoFinanceira: { categoriaId: receita.id, dataCompetencia: "2026-10-08", creditoUtilizado, parcelas: [] } });
        return id;
      };
      const titulo = (id: string) => s.banco.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: id, tipo: "RECEITA" } });
      const emitir = async (id: string) => {
        const t = await titulo(id);
        await executar("pedidos_registrar_boleto_emitido", { pedidoId: id, tituloId: t.id, referencia: `boleto-ficticio-${id}`, documento: null, vencimento: "2026-10-10", evidencia: "Emissão externa fictícia documentada" });
        return (await s.banco.pagamentoExternoPedido.findFirstOrThrow({ where: { pedidoId: id } })).id;
      };
      const pago = await novo(boleto.id), cobranca = await emitir(pago);
      await executar("pedidos_registrar_boleto_pago", { pedidoId: pago, cobrancaId: cobranca, contaId: "conta-ficticia", data: "2026-10-08", evidencia: "Pagamento externo fictício documentado" });
      expect((await titulo(pago)).status).toBe("BAIXADO");
      const tardio = await novo(boleto.id), cancelada = await emitir(tardio);
      await executar("pedidos_registrar_boleto_cancelado", { pedidoId: tardio, cobrancaId: cancelada, evidencia: "Cancelamento externo fictício documentado" });
      await executar("pedidos_cancelar", { ...await ref(tardio), motivo: "Pedido fictício cancelado" });
      await executar("pedidos_registrar_entrada_tardia_boleto", { pedidoId: tardio, cobrancaId: cancelada, contaId: "conta-ficticia", data: "2026-10-08", evidencia: "Entrada tardia externa fictícia documentada" });
      expect((await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id: tardio } })).status).toBe("CANCELADO");
      const emCartao = await novo(cartao.id), tCartao = await titulo(emCartao);
      await executar("pedidos_registrar_captura_cartao", { pedidoId: emCartao, tituloId: tCartao.id, referencia: "captura-ficticia", evidencia: "Captura externa fictícia documentada", data: "2026-10-08", taxa: null, previsao: "2026-10-10" });
      expect(await s.banco.movimentacaoBancaria.count({ where: { lancamento: { pedidoVendaId: emCartao } } })).toBe(0);
      const externo = await s.banco.pagamentoExternoPedido.findFirstOrThrow({ where: { pedidoId: emCartao } });
      await executar("pedidos_registrar_repasse_cartao", { pedidoId: emCartao, pagamentoId: externo.id, bruto: "50.00", taxa: "0.00", contaId: "conta-ficticia", data: "2026-10-08", categoriaTaxaId: null, competenciaTaxa: null, evidencia: "Repasse externo fictício documentado" });
      const credito = await novo(pix.id), tCredito = await titulo(credito);
      await executar("pedidos_registrar_recebimento", { pedidoId: credito, tituloId: tCredito.id, valor: "50.00", contaId: "conta-ficticia", data: "2026-10-08" });
      for (let etapa = 0; etapa < 3; etapa++) await executar("pedidos_avancar_etapa", await ref(credito));
      await executar("pedidos_solicitar_devolucao", { pedidoId: credito, devolver: "5.00", reter: "0.00", motivo: "Devolução fictícia cancelável", politica: "", comunicacao: "Comunicação fictícia" });
      let tratamento = await s.banco.tratamentoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: credito, tipo: "DEVOLUCAO", status: "SOLICITADA" } });
      await executar("pedidos_devolucao_cancelar", { pedidoId: credito, tratamentoId: tratamento.id, motivo: "Solicitação fictícia substituída" });
      await executar("pedidos_solicitar_devolucao", { pedidoId: credito, devolver: "5.00", reter: "0.00", motivo: "Devolução fictícia confirmada", politica: "", comunicacao: "Comunicação fictícia" });
      tratamento = await s.banco.tratamentoFinanceiroPedido.findFirstOrThrow({ where: { pedidoId: credito, tipo: "DEVOLUCAO", status: "SOLICITADA" } });
      await executar("pedidos_devolucao_processando", { pedidoId: credito, tratamentoId: tratamento.id, motivo: "Processamento fictício" });
      await executar("pedidos_concluir_devolucao", { pedidoId: credito, tratamentoId: tratamento.id, contaId: "conta-ficticia", data: "2026-10-08", categoriaId: deducao.id, competencia: "2026-10-08", evidencia: "Devolução externa fictícia documentada" });
      await executar("pedidos_conceder_credito", { pedidoId: credito, valor: "40.00", escolhaData: "2026-10-08", comunicacao: "Escolha fictícia documentada" });
      const origem = await s.banco.creditoClienteMovimento.findFirstOrThrow({ where: { clienteId: c.id as string, tipo: "CONCESSAO" } });
      await executar("clientes_ajustar_credito", { clienteId: c.id, origemId: origem.id, tipo: "AJUSTE_DEBITO", valor: "5.00", motivo: "Ajuste de débito fictício" });
      const debito = await s.banco.creditoClienteMovimento.findFirstOrThrow({ where: { clienteId: c.id as string, tipo: "AJUSTE_DEBITO" } });
      await executar("clientes_ajustar_credito", { clienteId: c.id, origemId: debito.id, tipo: "AJUSTE_CREDITO", valor: "5.00", motivo: "Correção do débito fictício" });
      const aplicado = await novo(pix.id, "40.00");
      for (let etapa = 0; etapa < 3; etapa++) await executar("pedidos_avancar_etapa", await ref(aplicado));
      await executar("pedidos_liberar_credito", { pedidoId: aplicado, valor: "40.00", motivo: "Crédito fictício restaurado", comunicacao: "Decisão fictícia documentada" });
      const manual = await s.banco.pedidoVenda.create({ data: { chaveCriacao: chave(), hashCriacao: "fixture", criadoPorId: "administrador", modoFinanceiro: "EXTERNO", status: "RASCUNHO" } });
      await executar("pedidos_encerrar_manual", { id: manual.id, versao: manual.versao, estado: "DECLINADO", motivo: "Pedido externo fictício não aprovado", referencia: "referencia-ficticia" });
      const entrega = await s.banco.pedidoVenda.create({ data: { chaveCriacao: chave(), hashCriacao: "fixture", criadoPorId: "administrador", modoFinanceiro: "HUB", versaoFinanceiro: 1, status: "CONFIRMADO", atendimento: "ENTREGA" } });
      await executar("pedidos_custo_entrega", { ...await ref(entrega.id), estimado: "10.00", efetivo: "12.00", prestadorId: null, motivo: "Custo de entrega fictício" });
      const despesa = await s.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id: "titulo-ficticio" } });
      const bancos = await s.banco.movimentacaoBancaria.count();
      await executar("pedidos_vincular_despesa_entrega", { pedidoId: entrega.id, versao: (await ref(entrega.id)).versao, lancamentoId: despesa.id, revisao: despesa.updatedAt.toISOString(), valor: "12.00", motivo: "Rateio de despesa fictícia" });
      const vinculo = await s.banco.vinculoCustoEntrega.findFirstOrThrow({ where: { pedidoId: entrega.id, desvinculadoEm: null } });
      await executar("pedidos_desvincular_despesa_entrega", { id: vinculo.id, motivo: "Rateio fictício revertido" });
      expect(await s.banco.movimentacaoBancaria.count()).toBe(bancos);
    });
  }, 120000);

  it("etapas e falhas de entrega preservam janela, identidade e independência financeira", async () => {
    await comClienteTeste(async executar => {
      const c = await executar("clientes_criar", { ...cliente, nome: "Comprador operacional fictício" });
      const receita = await s.banco.categoriaFinanceira.create({ data: { nome: "Receita operacional fictícia", grupo: "RECEITA_BRUTA" } });
      const canal = await s.banco.canalVenda.create({ data: { nome: "Canal operacional fictício", categoriaReceitaId: receita.id } });
      const forma = await s.banco.formaPagamentoVenda.create({ data: { nome: "Pix operacional fictício", tipo: "PIX" } });
      const produto = await executar("produtos_criar", { nome: "Produto operacional fictício", tipo: "PADRAO", unidade: "UN", preco: "25.00" });
      const dados = { clienteId: c.id, canalId: canal.id, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatario: null, endereco: null, itens: [{ produtoId: produto.id, quantidade: "2", escolhas: {}, precoManual: null }], pagamentoInformado: { formaId: forma.id, parcelas: 1, vencimentos: [] } };
      const r = await executar("pedidos_criar_rascunho", dados), id = r.id as string;
      const ref = async () => ({ id, versao: (await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id } })).versao });
      await executar("pedidos_confirmar", { ...await ref(), condicaoFinanceira: { categoriaId: receita.id, dataCompetencia: "2026-10-08", parcelas: [] } });
      await executar("pedidos_avancar_etapa", await ref());
      await executar("pedidos_avancar_etapa", await ref());
      await executar("pedidos_voltar_etapa", await ref());
      await executar("pedidos_reagendar", { ...await ref(), data: "2026-10-12", janela: "14:00–16:00", motivo: "Reagendamento fictício solicitado" });
      expect((await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id } })).previsaoJanela).toBe("14:00–16:00");
      await executar("pedidos_avancar_etapa", await ref());
      // Fixture de entrega já aceita pelo serviço de negócio; evita chamadas de mapas.
      await s.banco.pedidoVenda.update({ where: { id }, data: { atendimento: "ENTREGA" } });
      const item = await s.banco.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: id, vigente: true } });
      await executar("pedidos_expedir_item", { ...await ref(), itemId: item.id, quantidade: "2" });
      await executar("pedidos_sair_entrega", await ref());
      const bancos = await s.banco.movimentacaoBancaria.count();
      await executar("pedidos_ocorrencia", { ...await ref(), motivo: "Destinatário fictício ausente; material íntegro", natureza: "FALHA_ENTREGA" });
      const falha = await s.banco.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: id, tipo: "OPERACAO_OCORRENCIA" } });
      await executar("pedidos_nova_tentativa", { ...await ref(), ocorrenciaId: falha.id, motivo: "Material íntegro conferido para nova tentativa fictícia" });
      expect((await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id } })).statusOperacional).toBe("EM_ENTREGA");
      await executar("pedidos_registrar_entrega", await ref());
      await executar("pedidos_ocorrencia", { ...await ref(), motivo: "Devolução parcial fictícia após entrega", natureza: "DEVOLUCAO", itemId: item.id, quantidade: "1" });
      const destino = await s.banco.historicoPedidoVenda.findFirstOrThrow({ where: { pedidoId: id, tipo: "OPERACAO_OCORRENCIA", depois: { path: ["comando", "natureza"], equals: "DEVOLUCAO" } } });
      await executar("pedidos_resolver_ocorrencia", { ...await ref(), ocorrenciaId: destino.id, recuperavel: "0", perda: "1", motivo: "Produto preparado fictício descartado" });
      expect(await s.banco.movimentacaoBancaria.count()).toBe(bancos);
      expect((await s.banco.lancamentoFinanceiro.findFirstOrThrow({ where: { pedidoVendaId: id } })).status).toBe("PENDENTE");
    });
  }, 90000);

  it("material de pedidos mantém reservas, consumo, retorno, perdas e revenda sem ativar estoque automático", async () => {
    await comClienteTeste(async executar => {
      const local = await s.banco.localEstoque.create({ data: { nome: "Local de pedidos fictício" } });
      await s.banco.configuracaoLoja.update({ where: { id: "singleton" }, data: { pedidosLiberacao: { locais: [local.id], movimentarEstoque: false } } });
      const insumo = await s.banco.insumo.create({ data: { nome: "Material de pedido fictício", unidade: "UN", custoMedio: "10.00" } });
      await executar("estoque_entrada", { tipo: "OUTRO_MOTIVO", itens: [{ insumoId: insumo.id, localId: local.id, quantidade: "20", valorProdutos: "200.00" }], fornecedorId: null, data: "2026-10-08", dataVencimento: null, dataPagamento: null, contaBancariaId: null, observacao: "Estoque fictício inicial" });
      const c = await executar("clientes_criar", { ...cliente, nome: "Comprador físico fictício" });
      const receita = await s.banco.categoriaFinanceira.create({ data: { nome: "Receita física fictícia", grupo: "RECEITA_BRUTA" } });
      const canal = await s.banco.canalVenda.create({ data: { nome: "Canal físico fictício", categoriaReceitaId: receita.id } });
      const forma = await s.banco.formaPagamentoVenda.create({ data: { nome: "Pix físico fictício", tipo: "PIX" } });
      const novo = async (tipo: "PADRAO" | "REVENDA", quantidade: string) => {
        const produto = await executar("produtos_criar", { nome: `Produto físico fictício ${tipo}`, tipo, unidade: "UN", preco: "25.00", componentes: [{ insumoId: insumo.id, quantidade: "1", unidade: "UN" }] });
        const p = await executar("pedidos_criar_rascunho", { clienteId: c.id, canalId: canal.id, atendimento: "RETIRADA", prazo: "IMEDIATO", previsaoData: null, previsaoJanela: null, destinatario: null, endereco: null, itens: [{ produtoId: produto.id, quantidade, escolhas: {}, precoManual: null }], pagamentoInformado: { formaId: forma.id, parcelas: 1, vencimentos: [] } });
        const id = p.id as string;
        const ref = async () => ({ id, versao: (await s.banco.pedidoVenda.findUniqueOrThrow({ where: { id } })).versao });
        await executar("pedidos_confirmar", { ...await ref(), condicaoFinanceira: { categoriaId: receita.id, dataCompetencia: "2026-10-08", parcelas: [] } });
        const item = await s.banco.itemPedidoVenda.findFirstOrThrow({ where: { pedidoId: id, vigente: true } });
        await executar("pedidos_reservar_material", { ...await ref(), itemId: item.id, localId: local.id, quantidade });
        const reserva = await s.banco.reservaPedido.findFirstOrThrow({ where: { itemId: item.id } });
        return { id, ref, item, reserva };
      };
      const a = await novo("PADRAO", "4");
      await executar("pedidos_iniciar_preparo", await a.ref());
      await executar("pedidos_consumir_material", { ...await a.ref(), reservaId: a.reserva.id, quantidade: "3", motivo: "Material fictício retirado para preparo" });
      await executar("pedidos_retornar_material", { ...await a.ref(), reservaId: a.reserva.id, quantidade: "1", motivo: "Material fictício intacto antes do preparo" });
      const movimentos = await s.banco.movimentacaoEstoque.count();
      await executar("pedidos_perder_material", { ...await a.ref(), reservaId: a.reserva.id, quantidade: "1", motivo: "Material fictício danificado após retirada" });
      expect(await s.banco.movimentacaoEstoque.count()).toBe(movimentos);
      await executar("pedidos_liberar_material", { ...await a.ref(), reservaId: a.reserva.id, quantidade: "1", motivo: "Reserva fictícia restante liberada" });
      const b = await novo("REVENDA", "2");
      await executar("pedidos_avancar_etapa", await b.ref());
      await executar("pedidos_avancar_etapa", await b.ref());
      await executar("pedidos_expedir_revenda", { ...await b.ref(), reservaId: b.reserva.id, quantidade: "2", motivo: "Revenda fictícia expedida" });
      expect((await s.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: insumo.id, localId: local.id } } })).quantidadeAtual.toString()).toBe("16");
      expect((await s.banco.configuracaoLoja.findUniqueOrThrow({ where: { id: "singleton" } })).pedidosLiberacao).toMatchObject({ movimentarEstoque: false });
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
    });
  }, 90000);

  it("financeiro, extrato e faturas mantêm valores e reversões pelo SDK", async () => {
    await comClienteTeste(async executar => {
      const conta = await executar("financeiro_conta_criar", { nome: "Conta interna fictícia MCP" });
      const contaId = conta.id as string;
      await executar("financeiro_conta_disponibilidade", { id: contaId, ativo: false });
      await executar("financeiro_conta_disponibilidade", { id: contaId, ativo: true });
      await executar("financeiro_saldo_inicial", { id: contaId, saldoInicial: "10.00", dataSaldoInicial: "2026-10-01" });
      const categoria = await executar("financeiro_categoria_criar", { nome: "Plano fictício MCP", grupo: "DESPESAS_OPERACIONAIS", centroCustoId: null, paiId: null });
      const categoriaId = categoria.id as string;
      await executar("financeiro_categoria_atualizar", { id: categoriaId, nome: "Plano atualizado MCP", grupo: "DESPESAS_OPERACIONAIS", centroCustoId: null, paiId: null });
      await executar("financeiro_categoria_disponibilidade", { id: categoriaId, ativo: false });
      await executar("financeiro_categoria_disponibilidade", { id: categoriaId, ativo: true });
      const dados = { descricao: "Despesa fictícia MCP", tipo: "DESPESA", valor: "12.34", categoriaId, competencia: "2026-10-01", vencimento: "2026-10-15" };
      const criado = await executar("financeiro_criar_lancamento", dados);
      const id = (criado.ids as string[])[0];
      let titulo = await s.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id } });
      await executar("financeiro_atualizar_lancamento", { ...dados, id, revisao: titulo.updatedAt.toISOString(), descricao: "Despesa atualizada fictícia" });
      await executar("financeiro_baixar_lancamento", { id, contaId, data: "2026-10-08" });
      expect(await s.banco.movimentacaoBancaria.findMany({ where: { lancamentoId: id }, select: { tipo: true, valor: true } })).toEqual([{ tipo: "SAIDA", valor: expect.objectContaining({}) }]);
      expect((await s.banco.movimentacaoBancaria.findFirstOrThrow({ where: { lancamentoId: id } })).valor.toString()).toBe("12.34");
      await executar("financeiro_estornar_baixa", { id, motivo: "Reversão fictícia da baixa" });
      expect(await s.banco.movimentacaoBancaria.count({ where: { lancamentoId: id } })).toBe(0);
      expect((await s.banco.contaBancaria.findUniqueOrThrow({ where: { id: contaId } })).saldoInicial.toString()).toBe("10");
      const lote = await s.banco.importacaoExtrato.create({ data: { contaBancariaId: contaId, nomeArquivo: "ficticio.csv", hashArquivo: randomUUID(), formato: "CSV", autorId: "administrador", autorNome: "Fixture" } });
      const transacao = await s.banco.transacaoExtrato.create({ data: { contaBancariaId: contaId, importacaoId: lote.id, chave: randomUUID(), impressao: randomUUID(), data: new Date("2026-10-08T12:00:00Z"), descricao: "Transação fictícia", valor: "-12.34" } });
      titulo = await s.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id } });
      await executar("extrato_conciliar", { transacaoId: transacao.id, lancamentos: [{ id, versao: titulo.updatedAt.toISOString() }] });
      await executar("extrato_desconciliar", { transacaoId: transacao.id, motivo: "Desconciliação fictícia" });
      expect((await s.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id } })).status).toBe("BAIXADO");
      await executar("financeiro_estornar_baixa", { id, motivo: "Reversão depois da desconciliação" });
      titulo = await s.banco.lancamentoFinanceiro.findUniqueOrThrow({ where: { id } });
      await executar("financeiro_excluir_lancamento", { id, revisao: titulo.updatedAt.toISOString(), escopo: "APENAS_ESTA", motivo: "Cancelamento fictício" });
      const cartao = await executar("cartoes_criar", { nome: "Cartão fictício MCP", contaBancariaId: contaId, diaFechamento: 10, diaVencimento: 20, final:"1234", emissor:"Emissor sintético", bandeira:"Bandeira sintética", limite:"100.00", toleranciaDias:7, observacoes:"Observação sintética" });
      const cartaoId = cartao.id as string;
      const versaoCartao = async () => (await s.banco.cartaoCredito.findUniqueOrThrow({ where: { id: cartaoId } })).updatedAt.toISOString();
      await executar("cartoes_atualizar", { id: cartaoId, revisao: await versaoCartao(), nome: "Cartão atualizado fictício", contaBancariaId: contaId, diaFechamento: 11, diaVencimento: 21, final:"5678" });
      expect(await s.banco.cartaoCredito.findUniqueOrThrow({where:{id:cartaoId}})).toMatchObject({final:"5678",emissor:"Emissor sintético",bandeira:"Bandeira sintética",toleranciaDias:7,observacoes:"Observação sintética"});
      await executar("cartoes_disponibilidade", { id: cartaoId, revisao: await versaoCartao(), ativo: false });
      await executar("cartoes_disponibilidade", { id: cartaoId, revisao: await versaoCartao(), ativo: true });
      const regra = { nome: "Regra fictícia", texto: "COMPRA FICTÍCIA", modo: "CONTEM", prioridade: 1, cartaoId, categoriaId, fornecedorId: null, centroCustoId: null, tipo: "COMPRA", minimo: "", maximo: "", ativa: true };
      const criada = await executar("faturas_regra_criar", regra);
      await executar("faturas_regra_atualizar", { ...regra, id: criada.id, versao: criada.versao, nome: "Regra revisada fictícia" });
      const fatura = await executar("faturas_importar_csv", { cartaoId, competencia: "2026-10", inicio: "2026-10-01", fim: "2026-10-10", fechamento: "2026-10-10", vencimento: "2026-10-20", total: "100.00", nomeArquivo: "ficticia.csv", conteudo: "Data;Descrição;Valor\n01/10/2026;ANUIDADE FICTÍCIA;18,75\n01/10/2026;CRÉDITO FICTÍCIO;-18,75\n02/10/2026;COMPRA FICTÍCIA;100,00" });
      const faturaId = fatura.id as string;
      const atual = async () => s.banco.faturaCartao.findUniqueOrThrow({ where: { id: faturaId }, include: { itens: { orderBy: { linha: "asc" } } } });
      const inicial = await atual();
      const positivo = inicial.itens.find(i => i.valor.toString() === "18.75")!, negativo = inicial.itens.find(i => i.valor.toString() === "-18.75")!, compra = inicial.itens.find(i => i.valor.toString() === "100")!;
      const ref = async () => ({ id: faturaId, versao: (await atual()).versao });
      const motivo = "Revisão fictícia pelo MCP";
      await executar("faturas_compensar", { ...await ref(), itemId: positivo.id, outroId: negativo.id, motivo });
      await executar("faturas_descompensar", { ...await ref(), itemId: negativo.id, motivo });
      await executar("faturas_estornar_item", { ...await ref(), itemId: negativo.id, compraOriginalId: positivo.id, motivo });
      await executar("faturas_ignorar_item", { ...await ref(), itemId: compra.id, motivo });
      await executar("faturas_restaurar_item", { ...await ref(), itemId: compra.id, motivo });
      await executar("faturas_ajustar_valor", { ...await ref(), itemId: compra.id, valor: "100.00", motivo });
      await executar("faturas_correspondencias", { id: faturaId, itemId: compra.id, outrosCartoes: false });
      await executar("faturas_classificar", { ...await ref(), classificacao: { ids: [compra.id], categoriaId, fornecedorId: null, centroCustoId: null } });
      await executar("faturas_criar_despesa", { ...await ref(), itemId: compra.id, motivoDuplicidade: "Despesa fictícia distinta", novo: { descricao: "Compra fictícia", categoriaId, fornecedorId: null, centroCustoId: null, dataCompetencia: "2026-10-02", dataVencimento: "2026-10-20" } });
      await executar("faturas_desvincular_item", { ...await ref(), itemId: compra.id, motivo });
      await executar("faturas_cancelar", { ...await ref(), motivo, restaurar: false });
      await executar("faturas_cancelar", { ...await ref(), motivo, restaurar: true });
      const removivel = await executar("financeiro_categoria_criar", { nome: "Categoria financeira removível", grupo: "DESPESAS_OPERACIONAIS", centroCustoId: null, paiId: null });
      await executar("financeiro_categoria_excluir", { id: removivel.id, categoriaDestinoId: null });
    });
  }, 120000);
  it("pagamento interno de fatura, vínculo, correção de cartão e importação de extrato completam o fluxo MCP", async () => {
    await comClienteTeste(async executar => {
      const conta=await executar("financeiro_conta_criar",{nome:"Conta de fatura fictícia"}), contaId=conta.id as string;
      const categoria=await executar("financeiro_categoria_criar",{nome:"Despesas de fatura fictícias",grupo:"DESPESAS_OPERACIONAIS"}), categoriaId=categoria.id as string;
      const cartao=await executar("cartoes_criar",{nome:"Cartão de pagamento fictício",contaBancariaId:contaId,diaFechamento:10,diaVencimento:20}), cartaoId=cartao.id as string;
      const outro=await executar("cartoes_criar",{nome:"Cartão informado errado fictício",contaBancariaId:contaId,diaFechamento:10,diaVencimento:20});
      const fatura=await executar("faturas_importar_csv",{cartaoId,competencia:"2026-10",inicio:"2026-10-01",fim:"2026-10-10",fechamento:"2026-10-10",vencimento:"2026-10-20",total:"50.00",nomeArquivo:"teste.csv",conteudo:"Data;Descrição;Valor\n02/10/2026;DESPESA FICTICIA;50,00"});
      const faturaId=fatura.id as string;
      const atual=async()=>s.banco.faturaCartao.findUniqueOrThrow({where:{id:faturaId},include:{itens:true,pagamentos:{where:{revertidoEm:null}}}});
      const ref=async()=>({id:faturaId,versao:(await atual()).versao});
      const item=(await atual()).itens[0];
      const criada=await executar("financeiro_criar_lancamento",{descricao:"Despesa de fatura existente fictícia",tipo:"DESPESA",valor:"50.00",categoriaId,competencia:"2026-10-02",vencimento:"2026-10-20"});
      const despesa=await s.banco.lancamentoFinanceiro.findUniqueOrThrow({where:{id:(criada.ids as string[])[0]}});
      // Fixture do cenário nativo de cartão incorreto: não altera dado real.
      const errado=await s.banco.lancamentoFinanceiro.update({where:{id:despesa.id},data:{cartaoCreditoId:outro.id as string}});
      await executar("faturas_corrigir_cartao",{...await ref(),lancamentoId:errado.id,revisaoLancamento:errado.updatedAt.toISOString(),motivo:"Correção fictícia do cartão"});
      const corrigido=await s.banco.lancamentoFinanceiro.findUniqueOrThrow({where:{id:despesa.id}});
      await executar("faturas_vincular",{...await ref(),itemId:item.id,lancamentos:[{id:despesa.id,versao:corrigido.updatedAt.toISOString()}],substituir:false,motivo:"Vínculo fictício"});
      await executar("extrato_importar",{contaId,nomeArquivo:"pagamento.csv",conteudo:"Data;Descrição;Valor\n20/10/2026;PAGAMENTO FATURA FICTICIA;-50,00\n20/10/2026;OUTRA DESPESA FICTICIA;-5,00",indices:[0,1],mapa:{cabecalho:0,data:0,descricao:1,valor:2,formatoData:"BR",formatoValor:"BR",modo:"SINAL"}});
      const transacao=await s.banco.transacaoExtrato.findFirstOrThrow({where:{valor:"-50"}});
      await executar("faturas_selecionar_pagamento",{...await ref(),transacaoId:transacao.id});
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
      await executar("faturas_pagar",{...await ref(),transacaoId:transacao.id,tipo:"INTEGRAL"});
      expect((await s.banco.lancamentoFinanceiro.findUniqueOrThrow({where:{id:despesa.id}})).status).toBe("BAIXADO");
      await executar("faturas_concluir_despesas",await ref());
      await executar("faturas_reverter_pagamento",{...await ref(),pagamentoId:(await atual()).pagamentos[0].id,motivo:"Reversão fictícia do pagamento"});
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
      const outra=await s.banco.transacaoExtrato.findFirstOrThrow({where:{valor:"-5"}});
      await executar("extrato_criar_e_conciliar",{transacaoId:outra.id,descricao:"Despesa fictícia do extrato",categoriaId,competencia:"2026-10-20",vencimento:"2026-10-20"});
      expect(await s.banco.movimentacaoBancaria.count()).toBe(1);
    });
  },120000);
  it("iFood enfileira ações e negociação reais no banco fictício sem alcançar o provedor", async () => {
    const originalFetch=globalThis.fetch;
    let enviosExternos=0;
    const anterior=process.env.IFOOD_ATIVO;
    process.env.IFOOD_ATIVO="1";
    const stub=vi.spyOn(globalThis,"fetch").mockImplementation(async(input,init)=>{
      const url=new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (url.origin === origem) return originalFetch(input,init);
      if (!url.hostname.endsWith("ifood.com.br")) throw Error("Saída externa proibida na fixture.");
      if (init?.method === "POST") enviosExternos++;
      if (url.pathname.endsWith("cancellationReasons")) return new Response(JSON.stringify([{cancelCodeId:"501",description:"Motivo fictício"}]),{status:200,headers:{"Content-Type":"application/json"}});
      throw Error("Chamada externa inesperada na fixture.");
    });
    try { await comClienteTeste(async executar=>{
      const integracao=await s.banco.integracaoIfood.create({data:{ambiente:"TESTE",modalidade:"CENTRALIZADO",clientId:"cliente-ficticio",ativo:true,criadoPorId:"administrador",tokenCifrado:cifrarIfood("credencial-ficticia"),tokenExpiraEm:new Date(Date.now()+3600000)}});
      const canal=await s.banco.canalVenda.create({data:{nome:"iFood fictício MCP"}});
      const loja=await s.banco.lojaIfood.create({data:{integracaoId:integracao.id,ambiente:"TESTE",merchantId:merchant,nome:"Loja fictícia MCP",canalId:canal.id,ativa:true,autorizada:true}});
      const pedido=await s.banco.pedidoVenda.create({data:{origem:"IFOOD",status:"CONFIRMADO",canalId:canal.id,observacoes:"Fixture isolada",chaveCriacao:randomUUID(),hashCriacao:"a".repeat(64),criadoPorId:"administrador",compradorSnapshot:{nome:"Cliente fictício"},pagamentoInformadoSnapshot:{metodos:[]}}});
      const snapshot={...pedidoRemoto(),createdAt:new Date().toISOString(),delivery:{deliveredBy:"MERCHANT",deliveryDateTime:new Date(Date.now()+3600000).toISOString()}};
      const remoto=await s.banco.pedidoIfood.create({data:{lojaId:loja.id,externoId:snapshot.id,pedidoId:pedido.id,estadoRemoto:"PLACED",modalidade:"DELIVERY",entregaPor:"MERCHANT",snapshotCifrado:cifrarIfood(snapshot)}});
      await executar("ifood_pedido_consultar",{id:pedido.id});
      await executar("ifood_motivos_cancelamento",{id:pedido.id});
      const casos=[ ["ifood_confirmar","PLACED",{}], ["ifood_iniciar_preparo","CONFIRMED",{}], ["ifood_marcar_pronto","PREPARATION_STARTED",{}], ["ifood_despachar","READY_TO_PICKUP",{}], ["ifood_conferir_entrega","DISPATCHED",{codigo:"1234"}], ["ifood_cancelar","CONFIRMED",{codigo:"501",motivo:"Cancelamento fictício"}] ] as const;
      for(const [nome,estado,dados] of casos){
        await s.banco.pedidoIfood.update({where:{id:remoto.id},data:{estadoRemoto:estado}});
        const atual=await s.banco.pedidoVenda.update({where:{id:pedido.id},data:{versao:{increment:1}}});
        const r=await executar(nome,{id:pedido.id,versao:atual.versao,...dados});
        expect(r.estado).toBe("PENDENTE");
        expect((await s.banco.acaoIfood.findUniqueOrThrow({where:{id:r.id as string}})).origemMcpOperacaoId).not.toBeNull();
        // Evidência externa fictícia; nenhum envio é efetuado.
        await s.banco.acaoIfood.update({where:{id:r.id as string},data:{estado:"INCERTA"}});
        if(nome === "ifood_confirmar") await executar("ifood_registrar_conferencia",{id:pedido.id,acaoId:r.id,situacao:"SEM_EVIDENCIA",referencia:"FIXTURE-1"});
        await s.banco.acaoIfood.update({where:{id:r.id as string},data:{estado:"CONFIRMADA"}});
      }
      const alternativaId=randomUUID();
      for(const nome of ["ifood_aceitar_negociacao","ifood_rejeitar_negociacao","ifood_alternativa_negociacao"] as const){
        const negociacao={id:randomUUID(),action:"CANCELLATION",handshakeType:"AFTER_DELIVERY",expiresAt:new Date(Date.now()+60000).toISOString(),alternatives:[{id:alternativaId,type:"REFUND",metadata:{maxAmount:{value:"500",currency:"BRL"}}}]};
        await s.banco.pedidoIfood.update({where:{id:remoto.id},data:{disputaId:negociacao.id,disputaAte:new Date(Date.now()+60000),disputaCifrada:cifrarIfood(negociacao)}});
        const atual=await s.banco.pedidoVenda.update({where:{id:pedido.id},data:{versao:{increment:1}}});
        const r=await executar(nome,{id:pedido.id,versao:atual.versao,motivo:"Negociação fictícia",...(nome === "ifood_alternativa_negociacao" ? {alternativaId,valor:"2.00"}: {})});
        expect(r.estado).toBe("PENDENTE");
        await s.banco.acaoIfood.update({where:{id:r.id as string},data:{estado:"CONFIRMADA"}});
      }
      const prazoId=randomUUID(), disputaPrazo={id:randomUUID(),action:"CANCELLATION",handshakeType:"DELAY",expiresAt:new Date(Date.now()+60000).toISOString(),alternatives:[{id:prazoId,type:"ADDITIONAL_TIME",metadata:{allowedsAdditionalTimeInMinutes:[15,30],allowedsAdditionalTimeReasons:["HIGH_DEMAND"]}}]};
      await s.banco.pedidoIfood.update({where:{id:remoto.id},data:{disputaId:disputaPrazo.id,disputaAte:new Date(Date.now()+60000),disputaCifrada:cifrarIfood(disputaPrazo)}});
      const versaoPrazo=(await s.banco.pedidoVenda.update({where:{id:pedido.id},data:{versao:{increment:1}}})).versao;
      await executar("ifood_alternativa_negociacao",{id:pedido.id,versao:versaoPrazo,alternativaId:prazoId,minutos:"15",codigo:"HIGH_DEMAND",motivo:"Prazo fictício oferecido pelo provedor"});
      const ultima=await s.banco.acaoIfood.findFirstOrThrow({orderBy:{createdAt:"desc"}});
      await s.banco.acaoIfood.update({where:{id:ultima.id},data:{estado:"PENDENTE"}});
      await s.banco.mcpConfiguracao.update({where:{id:"singleton"},data:{ativo:false}});
      await enviarAcao();
      expect(enviosExternos).toBe(0);
      expect((await s.banco.acaoIfood.findUniqueOrThrow({where:{id:ultima.id}})).estado).not.toBe("ENVIANDO");
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
    }); } finally {stub.mockRestore();if(anterior === undefined) delete process.env.IFOOD_ATIVO; else process.env.IFOOD_ATIVO=anterior;}
  },120000);
  it("compras e produção física usam recebimento, ficha técnica e correção existentes", async () => {
    await comClienteTeste(async executar => {
      const materia = await executar("insumos_criar", { nome: "Matéria-prima fictícia", tipo: "INSUMO", unidade: "KG", custoMedio: "3.00" }), insumoId = materia.id as string;
      const local = await executar("estoque_local_criar", { nome: "Cozinha fictícia MCP" }), localId = local.id as string;
      await executar("estoque_entrada", { tipo: "OUTRO_MOTIVO", itens: [{ insumoId, localId, quantidade: "20", valorProdutos: "60" }], fornecedorId: null, observacao: "Entrada fictícia para produção", data: "2026-10-08", dataVencimento: null, dataPagamento: null, contaBancariaId: null });
      const preparo = await executar("insumos_criar", { nome: "Preparação fictícia MCP", tipo: "PRODUTO_INTERMEDIARIO", unidade: "UN", rendimentoQuantidade: "2", rendimentoUnidade: "UN", componentes: [{ componenteId: insumoId, quantidade: "1" }] }), preparacaoId = preparo.id as string;
      const ficha = await s.banco.insumo.findUniqueOrThrow({ where: { id: preparacaoId } });
      const apontamento = await executar("producao_registrar", { preparacaoId, revisao: ficha.updatedAt.toISOString(), localId, quantidade: "2", data: "2026-10-08", motivo: "Produção fictícia", ingredientes: [{ insumoId, quantidade: "1" }] });
      expect((await s.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: preparacaoId, localId } } })).quantidadeAtual.toString()).toBe("2");
      await executar("producao_corrigir", { id: apontamento.id, motivo: "Correção fictícia de apontamento" });
      expect((await s.banco.saldoEstoque.findUniqueOrThrow({ where: { insumoId_localId: { insumoId: preparacaoId, localId } } })).quantidadeAtual.toString()).toBe("0");
      const compra = { fornecedorId: null, fornecedorAvulso: "Loja fictícia", usoConsumo: true, previsaoEntrega: "2026-10-10", observacoes: null, itens: [{ insumoId, descricao: "Matéria-prima fictícia", quantidade: "2", unidadeCompra: "KG", precoUnitario: "3.00" }] };
      const nova = await executar("compras_criar", compra), compraId = nova.pedidoId as string;
      let atual = await s.banco.pedidoCompra.findUniqueOrThrow({ where: { id: compraId }, include: { itens: { where: { ativo: true } } } });
      await executar("compras_atualizar", { ...compra, id: compraId, revisao: atual.updatedAt.toISOString(), itens: [{ ...compra.itens[0], pedidoItemOriginalId: atual.itens[0].id }] });
      atual = await s.banco.pedidoCompra.findUniqueOrThrow({ where: { id: compraId }, include: { itens: { where: { ativo: true } } } });
      await executar("compras_reagendar", { id: compraId, revisao: atual.updatedAt.toISOString(), previsaoAnterior: "2026-10-10", previsaoEntrega: "2026-10-11" });
      atual = await s.banco.pedidoCompra.findUniqueOrThrow({ where: { id: compraId }, include: { itens: { where: { ativo: true } } } });
      const movimentosAntes = await s.banco.movimentacaoEstoque.count();
      await executar("compras_receber", { id: compraId, revisao: atual.updatedAt.toISOString(), dataRecebimento: "2026-10-11", itens: [{ pedidoItemId: atual.itens[0].id, insumoId, quantidadeRecebida: "2", lote: null, validade: null, qualidadeOk: true }] });
      expect(await s.banco.movimentacaoEstoque.count()).toBe(movimentosAntes);
      atual = await s.banco.pedidoCompra.findUniqueOrThrow({ where: { id: compraId }, include: { itens: { where: { ativo: true } } } });
      await executar("compras_reabrir", { id: compraId, revisao: atual.updatedAt.toISOString(), motivo: "Conferência fictícia" });
      atual = await s.banco.pedidoCompra.findUniqueOrThrow({ where: { id: compraId }, include: { itens: { where: { ativo: true } } } });
      await executar("compras_cancelar", { id: compraId, revisao: atual.updatedAt.toISOString(), motivo: "Cancelamento de fixture" });
      atual = await s.banco.pedidoCompra.findUniqueOrThrow({ where: { id: compraId }, include: { itens: { where: { ativo: true } } } });
      await executar("compras_excluir", { id: compraId, revisao: atual.updatedAt.toISOString() });
      await executar("insumos_importar", { linhas: [{ nome: "Importado fictício MCP", unidade: "UN", custoMedio: "1.00" }] });
      const importado = await s.banco.insumo.findFirstOrThrow({ where: { nome: "Importado fictício MCP" } });
      await executar("insumos_excluir", { id: importado.id, revisao: importado.updatedAt.toISOString() });
      const removivel = await executar("estoque_local_criar", { nome: "Local removível fictício" });
      const l = await s.banco.localEstoque.findUniqueOrThrow({ where: { id: removivel.id as string } });
      await executar("estoque_local_excluir", { id: l.id, revisao: l.updatedAt.toISOString() });
      expect(await s.banco.movimentacaoBancaria.count()).toBe(0);
    });
  }, 120000);
});

describe("Schemas fechados das operações MCP", () => {
  it.each(FUNCOES_NEGOCIO_MCP.map(f => [f.nome, f] as const))("%s recusa identidade fornecida pela IA e aprovação booleana", (_, f) => {
    expect(f.entrada.safeParse({ user_id: "administrador", confirmado: true }).success).toBe(false);
  });
});
