import "server-only";
import OAuth2Server from "@node-oauth/oauth2-server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { EscoposSchema, ErroMcp, RestricoesSchema, intersectarEscopos } from "./politica";
import { auditarMcp, enderecosMcp, escoposDaAutorizacao, escoposParaConsentimento, hashCredencial, hashPermissoesUsuario, INCLUIR_AUTORIZACAO, revisaoConsentimento } from "./servidor";

// Preferência de idioma enviada pelo ChatGPT, sem efeito em identidade ou acesso.
// Validar tags BCP 47 pelo runtime; a interface atual continua em português.
const IdiomasOAuthSchema = z.string().min(1).max(256).refine(valor => {
  const idiomas = valor.split(" ");
  if (idiomas.length > 10 || idiomas.some(idioma => !idioma)) return false;
  try { return Intl.getCanonicalLocales(idiomas).length > 0; }
  catch { return false; }
});

export const PedidoOAuthSchema = z.object({
  response_type: z.literal("code"), client_id: z.string().uuid(), redirect_uri: z.string().url().max(2048),
  resource: z.string().url().max(2048), scope: z.string().min(1).max(32768), state: z.string().min(16).max(512),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/), code_challenge_method: z.literal("S256"),
  ui_locales: IdiomasOAuthSchema.optional(),
}).strict();
export type PedidoOAuth = z.infer<typeof PedidoOAuthSchema>;

export async function validarPedidoOAuth(entrada: unknown, db: Prisma.TransactionClient = prisma) {
  const p = PedidoOAuthSchema.parse(entrada);
  EscoposSchema.parse(p.scope.split(" "));
  if (p.resource !== enderecosMcp().recurso) throw new ErroMcp("invalid_request", 400, "Destinatário não permitido.");
  const cliente = await db.mcpCliente.findUnique({ where: { id: p.client_id } });
  if (!cliente?.ativo || !cliente.redirectUris.includes(p.redirect_uri)) throw new ErroMcp("invalid_request", 400, "Cliente ou redirecionamento não permitido.");
  return { parametros: p, cliente };
}

type Vinculo = { autorizacaoId: string; versao: number; sessaoVersao: number; permissoesHash: string; restricoes: Prisma.InputJsonValue; escopos: string[] };
function vinculo(usuario: OAuth2Server.User): Vinculo {
  const parsed = z.object({ autorizacaoId: z.string().uuid(), versao: z.number().int(), sessaoVersao: z.number().int(), permissoesHash: z.string().length(64), restricoes: RestricoesSchema, escopos: EscoposSchema }).parse(usuario);
  return parsed;
}

// A biblioteca gera códigos/tokens e verifica o PKCE. Somente hashes são persistidos.
export function criarServidorOAuth(db: Prisma.TransactionClient = prisma, recurso = enderecosMcp().recurso) {
  const { emissor } = enderecosMcp();
  const model: OAuth2Server.AuthorizationCodeModel = {
    async getClient(id, segredo) {
      if (segredo) return false; // Esta versão admite clientes públicos pré-cadastrados.
      const c = await db.mcpCliente.findUnique({ where: { id } });
      return c?.ativo ? { id: c.id, redirectUris: c.redirectUris, grants: ["authorization_code"] } : false;
    },
    async validateScope(user, client, scope) {
      const v = vinculo(user);
      const a = await db.mcpAutorizacao.findUnique({ where: { id: v.autorizacaoId }, include: INCLUIR_AUTORIZACAO });
      const config = await db.mcpConfiguracao.findUnique({ where: { id: "singleton" } });
      if (!config?.ativo || !a || a.clienteId !== client.id || !a.cliente.ativo || (a.modeloAcesso === 1 && !a.perfil?.ativo) || a.lojaId !== "singleton" || a.situacao !== "ATIVA" || a.versao !== v.versao || a.usuario.sessaoVersao !== v.sessaoVersao || hashPermissoesUsuario(a) !== v.permissoesHash) return false;
      const efetivos = intersectarEscopos(v.escopos, escoposDaAutorizacao(a));
      return scope?.length && scope.every(s => efetivos.includes(s as typeof efetivos[number])) ? scope : false;
    },
    async saveAuthorizationCode(code, client, user) {
      if (!code.codeChallenge || code.codeChallengeMethod !== "S256") throw new OAuth2Server.InvalidRequestError("PKCE S256 obrigatório.");
      const v = vinculo(user);
      await db.mcpCodigoOAuth.create({ data: { hash: hashCredencial(code.authorizationCode), autorizacaoId: v.autorizacaoId,
        versao: v.versao, sessaoVersao: v.sessaoVersao, permissoesHash: v.permissoesHash, restricoes: v.restricoes, escopos: code.scope ?? [],
        redirectUri: code.redirectUri, challenge: code.codeChallenge, emissor, destinatario: recurso, expiraEm: code.expiresAt } });
      return { ...code, client, user };
    },
    async getAuthorizationCode(valor) {
      if (valor.length > 256) return false;
      const c = await db.mcpCodigoOAuth.findUnique({ where: { hash: hashCredencial(valor) }, include: { autorizacao: { select: { clienteId: true } } } });
      if (!c || c.consumidoEm || c.emissor !== emissor || c.destinatario !== recurso || recurso !== enderecosMcp().recurso) return false;
      return { authorizationCode: valor, expiresAt: c.expiraEm, redirectUri: c.redirectUri, scope: c.escopos,
        codeChallenge: c.challenge, codeChallengeMethod: "S256", client: { id: c.autorizacao.clienteId, grants: ["authorization_code"] },
        user: { autorizacaoId: c.autorizacaoId, versao: c.versao, sessaoVersao: c.sessaoVersao, permissoesHash: c.permissoesHash, restricoes: c.restricoes, escopos: c.escopos } };
    },
    async revokeAuthorizationCode(code) {
      const result = await db.mcpCodigoOAuth.updateMany({ where: { hash: hashCredencial(code.authorizationCode), consumidoEm: null, expiraEm: { gt: new Date() } }, data: { consumidoEm: new Date() } });
      return result.count === 1;
    },
    async generateRefreshToken() { return ""; },
    async saveToken(token, client, user) {
      const v = vinculo(user);
      await db.mcpToken.create({ data: { hash: hashCredencial(token.accessToken), autorizacaoId: v.autorizacaoId, versao: v.versao,
        sessaoVersao: v.sessaoVersao, permissoesHash: v.permissoesHash, restricoes: v.restricoes, escopos: token.scope ?? [], emissor, destinatario: recurso,
        expiraEm: token.accessTokenExpiresAt! } });
      await auditarMcp({ autorizacaoId: v.autorizacaoId, clienteId: client.id, acao: "TOKEN_EMITIDO", resultado: "OK" }, db);
      return { accessToken: token.accessToken, accessTokenExpiresAt: token.accessTokenExpiresAt, scope: token.scope, client, user };
    },
    // Bearer é validado pelo serviço que relê a identidade e todos os limites atuais.
    async getAccessToken() { return false; },
  };
  return new OAuth2Server({ model, accessTokenLifetime: 3600, authorizationCodeLifetime: 120, allowEmptyState: false,
    requireClientAuthentication: { authorization_code: false }, allowBearerTokensInQueryString: false });
}

export async function consentirOAuth(solicitacaoId: string, autorizacaoId: string, usuarioId: string, revisaoApresentada: string) {
  return prisma.$transaction(async db => {
    const s = await db.mcpSolicitacaoOAuth.findUnique({ where: { id: solicitacaoId } });
    if (!s || s.consumidaEm || s.expiraEm <= new Date()) throw new ErroMcp("invalid_request", 400, "Solicitação expirada. Reinicie a conexão.");
    const { parametros: p } = await validarPedidoOAuth(s.parametros, db);
    const a = await db.mcpAutorizacao.findUnique({ where: { id: autorizacaoId }, include: INCLUIR_AUTORIZACAO });
    if (!a || a.usuarioId !== usuarioId || a.clienteId !== p.client_id || !["PREPARADA", "ATIVA"].includes(a.situacao) || (a.modeloAcesso === 1 && !a.perfil?.ativo) || a.lojaId !== "singleton") throw new ErroMcp("insufficient_scope", 403, "Conexão não disponível para este usuário.");
    if (revisaoConsentimento(a) !== revisaoApresentada) throw new ErroMcp("invalid_request", 409, "A política ou suas permissões mudaram. Atualize a página e confira novamente antes de autorizar.");
    const solicitados = EscoposSchema.parse(p.scope.split(" "));
    const efetivos = escoposParaConsentimento(a);
    const consentidos = intersectarEscopos(solicitados, efetivos);
    if (!consentidos.length) throw new ErroMcp("insufficient_scope", 403, "Nenhuma função solicitada é permitida pela política.");
    const consumed = await db.mcpSolicitacaoOAuth.updateMany({ where: { id: s.id, consumidaEm: null, expiraEm: { gt: new Date() } }, data: { consumidaEm: new Date() } });
    if (consumed.count !== 1) throw new ErroMcp("invalid_request", 400, "Solicitação já utilizada.");
    const atualizada = await db.mcpAutorizacao.updateMany({ where: { id: a.id, versao: a.versao, situacao: { in: ["PREPARADA", "ATIVA"] } }, data: { situacao: "ATIVA", consentidaEm: new Date(), escopos: consentidos, versao: { increment: 1 } } });
    if (atualizada.count !== 1) throw new ErroMcp("invalid_request", 409, "Política alterada. Reinicie o consentimento.");
    const oauth = criarServidorOAuth(db);
    const resposta = new OAuth2Server.Response();
    await oauth.authorize(new OAuth2Server.Request({ method: "GET", headers: {}, query: { ...p, scope: consentidos.join(" ") } }), resposta, {
      authenticateHandler: { handle: () => ({ autorizacaoId: a.id, versao: a.versao + 1, sessaoVersao: a.usuario.sessaoVersao, permissoesHash: hashPermissoesUsuario(a), restricoes: a.restricoes, escopos: consentidos }) },
    });
    await auditarMcp({ usuarioId, clienteId: a.clienteId, autorizacaoId: a.id, acao: "CONSENTIMENTO", resultado: "OK" }, db);
    const location = resposta.headers?.location;
    if (!location) throw new ErroMcp("invalid_request", 400, "Não foi possível concluir a autorização.");
    return location;
  });
}

export async function trocarCodigoOAuth(body: Record<string, string>) {
  const entrada = z.object({ grant_type: z.literal("authorization_code"), client_id: z.string().uuid(), code: z.string().min(20).max(256),
    redirect_uri: z.string().url().max(2048), resource: z.literal(enderecosMcp().recurso), code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) }).strict().parse(body);
  // A tentativa consome o código inclusive quando o verificador está incorreto.
  // Não envolver em rollback: o consumo atômico impede tentativas/reutilização.
  const oauth = criarServidorOAuth(prisma, entrada.resource);
  const resposta = new OAuth2Server.Response();
  await oauth.token(new OAuth2Server.Request({ method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "content-length": String(Buffer.byteLength(new URLSearchParams(entrada).toString())) }, query: {}, body: entrada }), resposta);
  return resposta;
}
