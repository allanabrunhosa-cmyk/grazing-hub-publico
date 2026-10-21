import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { contextoDoHost } from "@/lib/hosts";
import type { Prisma } from "@/generated/prisma/client";
import type { Permissoes, Excecoes } from "@/lib/permissoes/catalogo";
import { LIMITES_MCP } from "./catalogo";
import { ErroMcp, escoposDoUsuario, intersectarEscopos, intersectarRestricoes, RestricoesSchema } from "./politica";

export const hashCredencial = (valor: string) => createHash("sha256").update(valor).digest("hex");
export function enderecosMcp() {
  const origem = new URL(process.env.MCP_ORIGEM ?? "https://grazinghub.com.br");
  const host = contextoDoHost(new Headers({ host: origem.host }));
  if (origem.username || origem.password || origem.search || origem.hash || origem.pathname !== "/" ||
    !host || host.identidade !== "hub" || host.origem !== origem.origin ||
    (origem.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && origem.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origem.hostname)))) {
    throw new ErroMcp("temporarily_unavailable", 503, "Origem MCP não configurada corretamente.");
  }
  return { emissor: origem.origin, recurso: `${origem.origin}/api/mcp`, metadados: `${origem.origin}/.well-known/oauth-protected-resource/api/mcp` };
}

export const INCLUIR_AUTORIZACAO = {
  cliente: true, perfil: true,
  usuario: { select: { id: true, nome: true, ativo: true, excluidoEm: true, sessaoVersao: true, updatedAt: true, permissoesPersonalizadas: true, perfilAcesso: { select: { nome: true, sistema: true, permissoes: true, updatedAt: true } } } },
} satisfies Prisma.McpAutorizacaoInclude;
export type AutorizacaoMcp = Prisma.McpAutorizacaoGetPayload<{ include: typeof INCLUIR_AUTORIZACAO }>;
export function identidadeDaAutorizacao(a: AutorizacaoMcp) {
  return { ...a.usuario, admin: a.usuario.perfilAcesso?.sistema === "ADMINISTRADOR", permissoes: (a.usuario.perfilAcesso?.permissoes ?? {}) as Permissoes, excecoes: a.usuario.permissoesPersonalizadas as Excecoes };
}
export function escoposDaAutorizacao(a: AutorizacaoMcp) {
  // v1 só existe durante implantação gradual; v2 usa o teto congelado pela migration.
  return intersectarEscopos(a.escopos, ...(a.modeloAcesso === 1 ? [a.perfil?.ativo ? a.perfil.escopos : []] : []), escoposDoUsuario(identidadeDaAutorizacao(a)));
}
export function escoposParaConsentimento(a: AutorizacaoMcp) {
  return a.modeloAcesso === 2 ? escoposDoUsuario(identidadeDaAutorizacao(a)) : escoposDaAutorizacao(a);
}
export function hashPermissoesUsuario(a: AutorizacaoMcp) {
  return hashCredencial(JSON.stringify([a.usuario.updatedAt.toISOString(), a.usuario.perfilAcesso?.updatedAt.toISOString(), escoposDoUsuario(identidadeDaAutorizacao(a))]));
}
export function revisaoConsentimento(a: AutorizacaoMcp) {
  return hashCredencial(JSON.stringify([a.versao, a.updatedAt.toISOString(), a.modeloAcesso === 1 ? a.perfil?.updatedAt.toISOString() : null, hashPermissoesUsuario(a)]));
}
export async function exigirMcpAtivo() {
  const config = await prisma.mcpConfiguracao.findUnique({ where: { id: "singleton" } });
  if (!config?.ativo) throw new ErroMcp("temporarily_unavailable", 503, "Acesso MCP suspenso.");
}

export async function autenticarMcp(credencial: string) {
  await exigirMcpAtivo();
  const { emissor, recurso } = enderecosMcp();
  const token = credencial.length <= 256 && /^[A-Za-z0-9._~-]{20,256}$/.test(credencial)
    ? await prisma.mcpToken.findUnique({ where: { hash: hashCredencial(credencial) }, include: { autorizacao: { include: INCLUIR_AUTORIZACAO } } }) : null;
  if (!token || token.expiraEm <= new Date() || token.emissor !== emissor || token.destinatario !== recurso) throw new ErroMcp("invalid_token", 401, "Credencial inválida ou expirada.");
  const a = token.autorizacao;
  if (a.situacao !== "ATIVA" || a.lojaId !== "singleton" || !a.cliente.ativo || (a.modeloAcesso === 1 && !a.perfil?.ativo) || !a.usuario.ativo || a.usuario.excluidoEm || a.versao !== token.versao || a.usuario.sessaoVersao !== token.sessaoVersao) {
    throw new ErroMcp("invalid_token", 401, "Autorização indisponível. Autorize novamente no HUB.");
  }
  const escopos = intersectarEscopos(token.escopos, escoposDaAutorizacao(a));
  return { autorizacaoId: a.id, usuarioId: a.usuarioId, clienteId: a.clienteId, lojaId: a.lojaId, versao: a.versao, sessaoVersao: a.usuario.sessaoVersao, escopos,
    restricoes: intersectarRestricoes(RestricoesSchema.parse(a.restricoes), RestricoesSchema.parse(token.restricoes)) };
}
export type ContextoMcp = Awaited<ReturnType<typeof autenticarMcp>>;

// Somente metadados fixos. Nunca aceitar mensagens de exceção, argumentos ou resultados.
export async function auditarMcp(entrada: { correlacao?: string; usuarioId?: string; clienteId?: string; autorizacaoId?: string; acao: string; ferramenta?: string; resultado: string; duracaoMs?: number; registros?: string[] }, db: Pick<Prisma.TransactionClient, "mcpEvento"> = prisma) {
  await db.mcpEvento.create({ data: { usuarioId: entrada.usuarioId, clienteId: entrada.clienteId, autorizacaoId: entrada.autorizacaoId,
    acao: entrada.acao, ferramenta: entrada.ferramenta, resultado: entrada.resultado,
    correlacao: entrada.correlacao ?? randomUUID(), duracaoMs: Math.max(0, Math.round(entrada.duracaoMs ?? 0)), registros: entrada.registros ?? [] } });
}

export async function limitarMcp(chave: string, limite: number = LIMITES_MCP.chamadasMinuto) {
  const minuto = Math.floor(Date.now() / 60_000);
  const registro = await prisma.mcpLimite.upsert({ where: { chave: `${hashCredencial(chave)}:${minuto}` },
    create: { chave: `${hashCredencial(chave)}:${minuto}`, expiraEm: new Date((minuto + 2) * 60_000) }, update: { quantidade: { increment: 1 } } });
  if (registro.quantidade > limite) throw new ErroMcp("rate_limit", 429, "Limite de chamadas atingido. Tente novamente em um minuto.");
}

// Limpeza limitada a dados técnicos desta integração. Um lote por minuto, entre instâncias.
export async function limparRegistrosMcp() {
  const minuto = Math.floor(Date.now() / 60_000);
  const trava = await prisma.mcpLimite.upsert({ where: { chave: `limpeza:${minuto}` }, create: { chave: `limpeza:${minuto}`, expiraEm: new Date((minuto + 2) * 60_000) }, update: { quantidade: { increment: 1 } } });
  if (trava.quantidade !== 1) return;
  const corte = new Date(Date.now() - LIMITES_MCP.retencaoDias * 86_400_000);
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "McpEvento" WHERE "id" IN (SELECT "id" FROM "McpEvento" WHERE "createdAt" < ${corte} AND NOT EXISTS (SELECT 1 FROM "AtividadeUsuario" a WHERE a."fonteTabela" = 'McpEvento' AND a."fonteId" = "McpEvento"."id") ORDER BY "createdAt" LIMIT 1000)`,
    prisma.$executeRaw`DELETE FROM "McpOperacao" WHERE "id" IN (SELECT "id" FROM "McpOperacao" WHERE "expiraEm" < CURRENT_TIMESTAMP - INTERVAL '1 day' ORDER BY "expiraEm" LIMIT 1000)`,
    prisma.$executeRaw`DELETE FROM "McpToken" WHERE "hash" IN (SELECT "hash" FROM "McpToken" WHERE "expiraEm" < CURRENT_TIMESTAMP LIMIT 1000)`,
    prisma.$executeRaw`DELETE FROM "McpCodigoOAuth" WHERE "hash" IN (SELECT "hash" FROM "McpCodigoOAuth" WHERE "expiraEm" < CURRENT_TIMESTAMP LIMIT 1000)`,
    prisma.$executeRaw`DELETE FROM "McpSolicitacaoOAuth" WHERE "id" IN (SELECT "id" FROM "McpSolicitacaoOAuth" WHERE "expiraEm" < CURRENT_TIMESTAMP LIMIT 1000)`,
    prisma.$executeRaw`DELETE FROM "McpLimite" WHERE "chave" IN (SELECT "chave" FROM "McpLimite" WHERE "expiraEm" < CURRENT_TIMESTAMP LIMIT 1000)`,
  ]);
}

export function validarTransporteMcp(request: Request, origens: string[] = []) {
  const { emissor } = enderecosMcp();
  const host = request.headers.get("host");
  if (host !== new URL(emissor).host || (request.headers.get("x-forwarded-host") && request.headers.get("x-forwarded-host") !== host)) throw new ErroMcp("invalid_request", 421, "Host não permitido.");
  const origin = request.headers.get("origin");
  if (origin && ![emissor, ...origens].includes(origin)) throw new ErroMcp("invalid_request", 403, "Origem não permitida.");
  if (new URL(request.url).search) throw new ErroMcp("invalid_request", 400, "Parâmetros de URL não permitidos neste endpoint.");
}

export async function lerCorpoLimitado(request: Pick<Request, "body" | "headers">): Promise<string> {
  if (Number(request.headers.get("content-length")) > LIMITES_MCP.entradaBytes) throw new ErroMcp("invalid_request", 413, "Entrada muito grande.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  const partes: Uint8Array[] = []; let tamanho = 0;
  const prazo = Date.now() + 3000;
  try {
    for (;;) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const leitura = await Promise.race([reader.read(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ErroMcp("invalid_request", 408, "Tempo de leitura excedido.")), Math.max(0, prazo - Date.now())); })]).finally(() => clearTimeout(timer));
      const { done, value } = leitura;
      if (done) break;
      tamanho += value.length;
      if (tamanho > LIMITES_MCP.entradaBytes) throw new ErroMcp("invalid_request", 413, "Entrada muito grande.");
      partes.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(partes).toString("utf8");
}
