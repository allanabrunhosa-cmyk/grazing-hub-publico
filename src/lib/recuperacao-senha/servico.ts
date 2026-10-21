import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import type { Prisma } from "@/generated/prisma/client";
import { enviarEmailRecuperacao } from "./email";
import { ERRO_LINK, MINUTOS_VALIDADE, tokenBemFormado, validarNovaSenha } from "./validacao";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type LinkRecuperacao = { email: string; token: string; tokenHash: string; convite: boolean };
// O convite e seu segredo são criados na mesma transação autorizada do cadastro.
export async function criarLinkRecuperacao(tx: Prisma.TransactionClient, usuario: { id: string; email: string; sessaoVersao: number; senhaDefinida: boolean }): Promise<LinkRecuperacao> {
  const token = randomBytes(32).toString("base64url");
  const dados = { tokenHash: hashToken(token), email: usuario.email, sessaoVersao: usuario.sessaoVersao,
    expiraEm: new Date(Date.now() + MINUTOS_VALIDADE * 60000), utilizadaEm: null, criadaEm: new Date() };
  await tx.recuperacaoSenha.upsert({ where: { usuarioId: usuario.id }, create: { usuarioId: usuario.id, ...dados }, update: dados });
  return { email: usuario.email, token, tokenHash: dados.tokenHash, convite: !usuario.senhaDefinida };
}

export async function enviarLinkRecuperacao(link: LinkRecuperacao) {
  try { await enviarEmailRecuperacao(link.email, link.token, link.convite); }
  catch {
    await prisma.recuperacaoSenha.deleteMany({ where: { tokenHash: link.tokenHash } });
    throw new Error("Falha no envio da recuperação de senha.");
  }
}

// Limites persistentes e atômicos também entre processos/containers. O e-mail é HMAC.
export async function reservarSolicitacao(email: string) {
  const segredo = process.env.AUTH_SECRET;
  if (!segredo) throw new Error("Autenticação não configurada.");
  const chave = createHmac("sha256", segredo).update(`recuperacao:${email}`).digest("hex");
  const agora = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('limite-recuperacao'))`;
    await tx.limiteAutenticacao.deleteMany({ where: { inicioEm: { lt: new Date(agora.getTime() - 3600000) } } });
    const [conta, global] = await Promise.all([
      tx.limiteAutenticacao.findUnique({ where: { chave } }),
      tx.limiteAutenticacao.findUnique({ where: { chave: "recuperacao-global" } }),
    ]);
    if ((conta && (conta.tentativas >= 5 || agora.getTime() - conta.ultimaEm.getTime() < 60000)) || (global && global.tentativas >= 60)) return false;
    for (const destino of [chave, "recuperacao-global"]) {
      await tx.limiteAutenticacao.upsert({ where: { chave: destino }, create: { chave: destino, inicioEm: agora, ultimaEm: agora },
        update: { tentativas: { increment: 1 }, ultimaEm: agora } });
    }
    return true;
  });
}

export async function prepararRecuperacao(email: string) {
  const registro = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
    const usuario = await tx.usuario.findUnique({ where: { email }, select: { id: true, ativo: true, excluidoEm: true, email: true, sessaoVersao: true, senhaDefinida: true } });
    if (!usuario?.ativo || usuario.excluidoEm) return null;
    return criarLinkRecuperacao(tx, usuario);
  });
  if (!registro) return;
  await enviarLinkRecuperacao(registro);
}

export async function linkRecuperacaoValido(token: string) {
  if (!tokenBemFormado(token)) return false;
  const registro = await prisma.recuperacaoSenha.findUnique({ where: { tokenHash: hashToken(token) },
    include: { usuario: { select: { ativo: true, excluidoEm: true, email: true, sessaoVersao: true } } } });
  return Boolean(registro && !registro.utilizadaEm && registro.expiraEm > new Date()
    && registro.usuario.ativo && !registro.usuario.excluidoEm
    && registro.usuario.email === registro.email && registro.usuario.sessaoVersao === registro.sessaoVersao);
}

export async function concluirRecuperacao(token: string, senha: string, confirmacao: string): Promise<{ erro: string } | { ok: true; email: string }> {
  if (!tokenBemFormado(token)) return { erro: ERRO_LINK };
  const erro = validarNovaSenha(senha, confirmacao);
  if (erro) return { erro };
  if (!await linkRecuperacaoValido(token)) return { erro: ERRO_LINK };
  const senhaHash = await hashPassword(senha);
  return prisma.$transaction(async (tx) => {
    // Mesma ordem da gestão de acessos: decisão e uso único dentro da transação.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('gestao-acessos'))`;
    const registro = await tx.recuperacaoSenha.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!registro || registro.utilizadaEm || registro.expiraEm <= new Date()) return { erro: ERRO_LINK };
    // O update condicional também protege contra mudanças de senha/perfil fora da trava.
    const alterados = await tx.usuario.updateMany({ where: { id: registro.usuarioId, ativo: true, excluidoEm: null,
      email: registro.email, sessaoVersao: registro.sessaoVersao }, data: { senhaHash, senhaDefinida: true, emailVerificadoEm: new Date(), sessaoVersao: { increment: 1 } } });
    if (alterados.count !== 1) return { erro: ERRO_LINK };
    await tx.recuperacaoSenha.update({ where: { usuarioId: registro.usuarioId }, data: { utilizadaEm: new Date() } });
    await tx.historicoAcesso.create({ data: { autorId: registro.usuarioId, entidade: "Usuário", entidadeId: registro.usuarioId,
      acao: "Senha redefinida por link de recuperação" } });
    return { ok: true, email: registro.email };
  });
}
