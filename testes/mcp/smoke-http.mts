// Smoke do build Next real, exclusivamente contra banco e endereço de teste locais.
// Executar com node --conditions=react-server --import tsx; nunca em produção.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { request as requestHttp } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { prisma } from "../../src/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME } from "../../src/lib/session-token";
import { consentirOAuth } from "../../src/lib/mcp/oauth";
import { INCLUIR_AUTORIZACAO, revisaoConsentimento } from "../../src/lib/mcp/servidor";
import { ESCOPOS_FINANCEIROS_V1, FUNCOES_MCP, exigenciasDaFuncaoMcp } from "../../src/lib/mcp/catalogo";

const banco = new URL(process.env.DATABASE_URL ?? "");
const local = new URL(process.env.MCP_SMOKE_URL ?? "http://127.0.0.1:45448");
assert(["localhost", "127.0.0.1"].includes(banco.hostname) && banco.pathname.endsWith("_teste"), "Somente banco local fictício _teste");
assert(["localhost", "127.0.0.1"].includes(local.hostname) && local.protocol === "http:", "Somente HTTP loopback");
assert(process.env.AUTH_SECRET, "AUTH_SECRET local do processo Next é obrigatório");
const origem = "https://grazinghub.com.br";
process.env.MCP_ORIGEM = origem;
const recurso = `${origem}/api/mcp`;
const hostHeaders = { host: "grazinghub.com.br", "x-forwarded-host": "grazinghub.com.br" };
const uid = `smoke-mcp-${randomUUID()}`;
const escopos = [...ESCOPOS_FINANCEIROS_V1, "hub:v2:conexao_contexto", "hub:v2:clientes_consultar"];
const callback = "https://cliente.example.invalid/oauth/callback";
// node:http permite preservar Host como o proxy; fetch/Undici pode substituí-lo.
const http = (path: string, init: RequestInit = {}) => new Promise<Response>((resolve, reject) => {
  assert(!init.body || typeof init.body === "string" || init.body instanceof URLSearchParams);
  const req = requestHttp(new URL(path, local), { method: init.method ?? "GET", headers: { ...hostHeaders, ...Object.fromEntries(new Headers(init.headers)) } }, res => {
    const partes: Buffer[] = []; let tamanho = 0;
    res.on("data", parte => { tamanho += parte.length; if (tamanho > 5_000_000) req.destroy(new Error("Resposta local excessiva")); else partes.push(parte); });
    res.on("error", reject);
    res.on("end", () => {
      const headers = new Headers(); for (const [nome, valor] of Object.entries(res.headers)) if (valor) headers.set(nome, Array.isArray(valor) ? valor.join(", ") : valor);
      resolve(new Response([204, 205, 304].includes(res.statusCode!) ? null : Buffer.concat(partes), { status: res.statusCode, headers }));
    });
  });
  req.setTimeout(15000, () => req.destroy(new Error("Timeout do smoke local"))); req.on("error", reject);
  req.end(init.body?.toString());
});
let cliente: Client | undefined;
let verificacoes = 0;
function passou() { verificacoes++; }
try {
  await prisma.configuracaoLoja.upsert({ where: { id: "singleton" }, create: {}, update: {} });
  await prisma.mcpConfiguracao.update({ where: { id: "singleton" }, data: { ativo: true } });
  const permissoes = Object.fromEntries([...FUNCOES_MCP.filter(f=>escopos.includes(f.escopo)).flatMap(f=>exigenciasDaFuncaoMcp(f).map(r=>r.recurso)).filter(Boolean), "configuracoes.mcp"].map(r => [r, ["visualizar"]]));
  const perfil = await prisma.perfilAcesso.create({ data: { id: uid, nome: `Fictício ${uid}`, permissoes } });
  await prisma.usuario.create({ data: { id: uid, nome: "Pessoa fictícia smoke", email: `${uid}@example.invalid`, senhaHash: "senha-inutilizavel-de-teste", perfilAcessoId: perfil.id } });
  const app = await prisma.mcpCliente.create({ data: { nome: "Cliente smoke fictício", redirectUris: [callback] } });
  const politica = await prisma.mcpAutorizacao.create({ data: { nome: "Smoke fictício", usuarioId: uid, clienteId: app.id, modeloAcesso: 2, escopos: [], restricoes: { contas: null, lancamentos: null } }, include: INCLUIR_AUTORIZACAO });
  const cookie = `${SESSION_COOKIE_NAME}=${await createSessionToken({ userId: uid, nome: "Pessoa fictícia smoke", email: `${uid}@example.invalid`, admin: false, versao: 0 })}`;
  let response = await http("/.well-known/oauth-protected-resource/api/mcp");
  assert.equal(response.status, 200); assert.equal((await response.json()).resource, recurso); passou();
  response = await http("/.well-known/oauth-authorization-server");
  assert.equal(response.status, 200); assert.equal((await response.json()).authorization_endpoint, `${origem}/oauth/iniciar`); passou();
  response = await http("/api/mcp", { method: "POST", headers: { cookie, "Content-Type": "application/json", accept: "application/json, text/event-stream" }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' });
  assert.equal(response.status, 401); assert(response.headers.get("www-authenticate")?.includes("resource_metadata")); passou();
  response = await http("/configuracoes/integracoes/mcp"); assert.equal(response.status, 307); assert(response.headers.get("location")?.includes("/login")); passou();
  response = await http("/configuracoes/integracoes/mcp", { headers: { cookie } }); assert.equal(response.status, 200); assert((await response.text()).includes("MCP do Grazing HUB")); passou();
  response = await http("/.well-known/oauth-authorization-server", { headers: { host: "pedidos.grazinghub.com.br", "x-forwarded-host": "pedidos.grazinghub.com.br" } }); assert.equal(response.status, 404); passou();
  const verifier = randomBytes(48).toString("base64url");
  const pedido = new URLSearchParams({ response_type: "code", client_id: app.id, redirect_uri: callback, resource: recurso, scope: escopos.join(" "), state: randomUUID(), code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", ui_locales: "pt-BR" });
  response = await http(`/oauth/iniciar?${pedido}`); assert.equal(response.status, 302);
  const consentimento = new URL(response.headers.get("location")!); passou();
  response = await http(consentimento.pathname + consentimento.search, { headers: { cookie } }); assert.equal(response.status, 200); assert((await response.text()).includes("Autorizar acesso ao Grazing HUB")); passou();
  // Aceite sintético pelo serviço real, sem simular aprovação humana/ChatGPT.
  const retorno = new URL(await consentirOAuth(consentimento.searchParams.get("solicitacao")!, politica.id, uid, revisaoConsentimento(politica)));
  response = await http("/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: app.id, redirect_uri: callback, resource: recurso, code: retorno.searchParams.get("code")!, code_verifier: verifier }) });
  assert.equal(response.status, 200); const token = (await response.json()).access_token; assert.equal(typeof token, "string"); passou();
  const transporte = new StreamableHTTPClientTransport(new URL(recurso), { requestInit: { headers: { Authorization: `Bearer ${token}` } }, fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, origem); assert.equal(url.pathname, "/api/mcp");
    const headers = new Headers(init?.headers); headers.set("Authorization", `Bearer ${token}`);
    return http(url.pathname, { ...init, headers });
  } });
  cliente = new Client({ name: "smoke-local-ficticio", version: "1.0.0" }); await cliente.connect(transporte);
  assert.equal((await cliente.listTools()).tools.length, 8); passou();
  const contexto = await cliente.callTool({name:"conexao_contexto",arguments:{}}); assert.notEqual(contexto.isError,true); assert(contexto.structuredContent); passou();
  const proibida = await cliente.callTool({name:"clientes_criar",arguments:{}}); assert.equal(proibida.isError,true); passou();
  const antes = await prisma.lancamentoFinanceiro.count();
  const resultado = await cliente.callTool({ name: "financeiro_dre", arguments: { de: "2026-09-01", ate: "2026-09-30", regime: "COMPETENCIA" } });
  assert.notEqual(resultado.isError, true); assert(resultado.structuredContent); assert.equal(await prisma.lancamentoFinanceiro.count(), antes); passou();
  await prisma.mcpAutorizacao.update({ where: { id: politica.id }, data: { situacao: "REVOGADA", versao: { increment: 1 } } });
  response = await http("/api/mcp", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' }); assert.equal(response.status, 401); passou();
  console.log(`SMOKE HTTP LOCAL: ${verificacoes} verificações aprovadas; SDK real, aceite sintético; nenhum acesso à produção/ChatGPT.`);
} finally {
  await cliente?.close();
  await prisma.$disconnect();
}
