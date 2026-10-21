import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import { RestricoesSchema, ErroMcp, intersectarEscopos } from "./politica";
import { auditarMcp, enderecosMcp, escoposDaAutorizacao, INCLUIR_AUTORIZACAO, lerCorpoLimitado, limparRegistrosMcp } from "./servidor";
import { metadadosAutorizacao, metadadosRecurso } from "./metadados";

const nome = z.string().trim().min(3).max(100).regex(/^[^\u0000-\u001f\u007f]+$/);
const id = z.string().min(1).max(120);
export const OperacaoMcpSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("cliente"), nome, redirectUri: z.string().url().max(2048) }).strict(),
  z.object({ tipo: z.literal("autorizacao"), id: z.string().uuid().optional(), versao: z.number().int().optional(), nome, clienteId: z.string().uuid(), usuarioId: id, restricoes: RestricoesSchema }).strict(),
  z.object({ tipo: z.literal("situacao"), id: z.string().uuid(), versao: z.number().int(), situacao: z.enum(["SUSPENSA", "PREPARADA", "REVOGADA"]) }).strict(),
  z.object({ tipo: z.literal("global"), ativo: z.boolean() }).strict(),
]);
export type OperacaoMcp = z.infer<typeof OperacaoMcpSchema>;

export function validarRedirectCliente(valor: string) {
  const url = new URL(valor);
  if (url.username || url.password || url.hash || [...url.searchParams.keys()].some(k => /^(code|access_token|refresh_token|token|api_key|apikey|secret|password|senha|client_secret|authorization)$/i.test(k)) ||
    (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)))) throw new ErroMcp("invalid_request", 400, "Copie o redirecionamento HTTPS exato informado pelo cliente, sem credenciais.");
  return valor;
}

export async function alterarAdministracaoMcp(entrada: unknown, autorId: string) {
  const p = OperacaoMcpSchema.parse(entrada);
  await prisma.$transaction(async db => {
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('mcp-administracao'))`;
    const autor = await db.usuario.findUnique({ where: { id: autorId }, include: { perfilAcesso: true } });
    if (!autor?.ativo || autor.excluidoEm || !(autor.perfilAcesso?.sistema === "ADMINISTRADOR" || permissaoEfetiva((autor.perfilAcesso?.permissoes ?? {}) as Permissoes, autor.permissoesPersonalizadas as Excecoes, "configuracoes.mcp", "editar"))) throw new ErroMcp("insufficient_scope", 403, "Administração não permitida.");
    let autorizacaoId: string | undefined;
    let clienteId: string | undefined;
    if (p.tipo === "cliente") {
      const redirectUri = validarRedirectCliente(p.redirectUri);
      const existente = await db.mcpCliente.findFirst({ where: { nome: p.nome, redirectUris: { equals: [redirectUri] }, ativo: true } });
      if (existente) clienteId = existente.id;
      else {
        if (await db.mcpCliente.count() >= 200) throw new ErroMcp("invalid_request", 400, "Limite de aplicações atingido.");
        clienteId = (await db.mcpCliente.create({ data: { nome: p.nome, redirectUris: [redirectUri] } })).id;
      }
    } else if (p.tipo === "autorizacao") {
      clienteId = p.clienteId;
      const [cliente, usuario, loja] = await Promise.all([db.mcpCliente.findUnique({ where: { id: p.clienteId } }), db.usuario.findUnique({ where: { id: p.usuarioId }, select: { ativo: true, excluidoEm: true } }), db.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { id: true } })]);
      if (!cliente?.ativo || !usuario?.ativo || usuario.excluidoEm || !loja) throw new ErroMcp("invalid_request", 400, "Confira a empresa, o responsável, a aplicação ativos.");
      const dados = { nome: p.nome, restricoes: p.restricoes, situacao: "PREPARADA", consentidaEm: null };
      if (p.id) {
        if (p.versao === undefined) throw new ErroMcp("invalid_request", 409, "Atualize a página.");
        const atual = await db.mcpAutorizacao.findUnique({ where: { id: p.id } });
        if (!atual || atual.usuarioId !== p.usuarioId || atual.clienteId !== p.clienteId || atual.situacao === "REVOGADA") throw new ErroMcp("invalid_request", 409, "Conexão não disponível.");
        const anteriores = RestricoesSchema.parse(atual.restricoes);
        for (const campo of ["contas", "lancamentos"] as const) if (anteriores[campo] !== null && (p.restricoes[campo] === null || p.restricoes[campo]!.some(id => !anteriores[campo]!.includes(id)))) throw new ErroMcp("invalid_request", 409, "Ampliação de restrições exige novo consentimento individual.");
        const atualizada = await db.mcpAutorizacao.updateMany({ where: { id: p.id, versao: p.versao, clienteId: p.clienteId, usuarioId: p.usuarioId, situacao: { not: "REVOGADA" } }, data: { ...dados, versao: { increment: 1 } } });
        if (atualizada.count !== 1) throw new ErroMcp("invalid_request", 409, "A autorização mudou ou foi revogada. Atualize a página.");
        autorizacaoId = p.id;
      } else {
        if (await db.mcpAutorizacao.count({ where: { usuarioId: p.usuarioId, clienteId: p.clienteId, situacao: { not: "REVOGADA" } } })) throw new ErroMcp("invalid_request", 409, "Já existe uma conexão desta aplicação para o usuário. Abra a conexão existente.");
        if (await db.mcpAutorizacao.count() >= 1000) throw new ErroMcp("invalid_request", 400, "Limite de autorizações atingido.");
        const criada = await db.mcpAutorizacao.create({ data: { ...dados, clienteId: p.clienteId, usuarioId: p.usuarioId, lojaId: "singleton", modeloAcesso: 2, escopos: [] } }); autorizacaoId = criada.id;
      }
    } else if (p.tipo === "situacao") {
      const atualizada = await db.mcpAutorizacao.updateMany({ where: { id: p.id, versao: p.versao, situacao: { not: "REVOGADA" } }, data: { situacao: p.situacao, versao: { increment: 1 }, consentidaEm: null } });
      if (atualizada.count !== 1) throw new ErroMcp("invalid_request", 409, "Autorização alterada ou revogada. Atualize a página.");
      autorizacaoId = p.id;
    } else {
      enderecosMcp();
      await db.mcpConfiguracao.upsert({ where: { id: "singleton" }, create: { ativo: p.ativo }, update: { ativo: p.ativo } });
    }
    await auditarMcp({ usuarioId: autorId, clienteId, autorizacaoId, acao: `ADMIN_${p.tipo.toUpperCase()}${p.tipo === "situacao" ? `_${p.situacao}` : p.tipo === "global" ? `_${p.ativo ? "ATIVO" : "SUSPENSO"}` : ""}`, resultado: "OK" }, db);
  });
}

export const FiltroHistoricoSchema = z.object({ de: z.string().date().optional(), ate: z.string().date().optional(), resultado: z.enum(["OK", "NEGADO", "invalid_token", "insufficient_scope", "ERRO"]).optional(), ferramenta: z.string().max(100).optional(), pagina: z.coerce.number().int().min(1).max(1000).default(1) });
export async function carregarAdministracaoMcp(entrada: unknown = {}) {
  const f = FiltroHistoricoSchema.parse(entrada);
  const where = { ...(f.de || f.ate ? { createdAt: { ...(f.de ? { gte: new Date(`${f.de}T00:00:00Z`) } : {}), ...(f.ate ? { lte: new Date(`${f.ate}T23:59:59.999Z`) } : {}) } } : {}), resultado: f.resultado, ferramenta: f.ferramenta };
  const [config, clientes, autorizacoes, usuarios, eventos, totalEventos, tokens, loja] = await Promise.all([
    prisma.mcpConfiguracao.findUnique({ where: { id: "singleton" } }), prisma.mcpCliente.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.mcpAutorizacao.findMany({ include: INCLUIR_AUTORIZACAO, orderBy: { createdAt: "desc" } }),
    prisma.usuario.findMany({ where: { ativo: true, excluidoEm: null }, select: { id: true, nome: true, perfilAcesso: { select: { nome: true } } }, orderBy: { nome: "asc" } }),
    prisma.mcpEvento.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 50, skip: (f.pagina - 1) * 50 }), prisma.mcpEvento.count({ where }),
    prisma.mcpToken.findMany({ where: { expiraEm: { gt: new Date() }, emissor: enderecosMcp().emissor, destinatario: enderecosMcp().recurso }, select: { autorizacaoId: true, versao: true, sessaoVersao: true, permissoesHash: true, escopos: true } }),
    prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { nome: true } }),
  ]);
  return { endereco: enderecosMcp().recurso, ambiente: process.env.NODE_ENV === "production" ? "Produção" : "Desenvolvimento / teste",
    ativo: config?.ativo ?? false, configurado: !!config, diagnostico: config?.diagnostico ?? null, diagnosticadoEm: config?.diagnosticadoEm?.toISOString() ?? null,
    clientes: clientes.map(c => ({ id: c.id, nome: c.nome, redirectUris: c.redirectUris, ativo: c.ativo })),
    usuarios,
    autorizacoes: autorizacoes.map(a => {
      const disponiveis = escoposDaAutorizacao(a);
      const consentidos = tokens.filter(t => t.autorizacaoId === a.id && t.versao === a.versao && t.sessaoVersao === a.usuario.sessaoVersao).flatMap(t => t.escopos);
      return { id: a.id, nome: a.nome, clienteId: a.clienteId, clienteNome: a.cliente.nome, usuarioId: a.usuarioId, usuarioNome: a.usuario.nome, perfilNome: a.usuario.perfilAcesso?.nome ?? "Sem perfil", lojaId: a.lojaId, lojaNome: loja?.nome ?? "Empresa do HUB", escopos: a.escopos, disponiveis,
        efetivos: config?.ativo && a.situacao === "ATIVA" && a.cliente.ativo ? intersectarEscopos(disponiveis, consentidos) : [],
        restricoes: RestricoesSchema.parse(a.restricoes), situacao: a.situacao, versao: a.versao, createdAt: a.createdAt.toISOString(), ultimoUsoEm: a.ultimoUsoEm?.toISOString() ?? null };
    }),
    eventos: eventos.map(e => ({ ...e, createdAt: e.createdAt.toISOString() })), totalEventos, pagina: f.pagina, filtros: f };
}
export type DadosAdministracaoMcp = Awaited<ReturnType<typeof carregarAdministracaoMcp>>;

export async function diagnosticarMcp(autorId: string) {
  const inicio = Date.now();
  const recurso = metadadosRecurso(); const oauth = metadadosAutorizacao();
  const config = await prisma.mcpConfiguracao.findUnique({ where: { id: "singleton" } });
  const loja = await prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { id: true } });
  await limparRegistrosMcp();
  // URLs fixas derivadas exclusivamente do host HUB permitido, sem redirects,
  // credenciais ou URLs fornecidas por clientes. Nenhum superusuário de diagnóstico.
  const verificacaoHttp = await Promise.allSettled([
    fetch(enderecosMcp().metadados, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) }).then(async response => {
      if (!response.ok) return false;
      const json: unknown = JSON.parse(await lerCorpoLimitado(response));
      const parsed = z.object({ resource: z.literal(recurso.resource), authorization_servers: z.array(z.string()) }).safeParse(json);
      return parsed.success && parsed.data.authorization_servers.includes(oauth.issuer);
    }),
    fetch(recurso.resource, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}', cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) }).then(response => response.status === 401 && response.headers.get("www-authenticate")?.includes(enderecosMcp().metadados) === true),
  ]);
  const resultado = { banco: "OK", empresa: loja ? "OK" : "AUSENTE", permissoes: "CENTRAIS", descoberta: recurso.authorization_servers.includes(oauth.issuer) ? "OK" : "FALHA",
    metadadosHttp: verificacaoHttp[0].status === "fulfilled" && verificacaoHttp[0].value ? "OK" : "FALHA",
    bloqueioSemToken: verificacaoHttp[1].status === "fulfilled" && verificacaoHttp[1].value ? "OK" : "FALHA",
    acesso: config?.ativo ? "ATIVO" : "SUSPENSO", consultaFinanceira: "NAO_EXECUTADA", clienteExterno: "NAO_TESTADO" };
  await prisma.$transaction(async db => {
    await db.mcpConfiguracao.upsert({ where: { id: "singleton" }, create: { diagnostico: resultado, diagnosticadoEm: new Date() }, update: { diagnostico: resultado, diagnosticadoEm: new Date() } });
    await auditarMcp({ usuarioId: autorId, acao: "DIAGNOSTICO", resultado: loja && resultado.metadadosHttp === "OK" && resultado.bloqueioSemToken === "OK" ? "OK" : "INCOMPLETO", duracaoMs: Date.now() - inicio }, db);
  });
  return resultado;
}
