"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { validarNovaSenha } from "@/lib/recuperacao-senha/validacao";
import { hashPassword, verifyPassword, createSessionToken, sessionCookieOptions } from "@/lib/auth";

export type ResultadoPerfil = { erro: string } | { ok: true };

export async function atualizarPerfilAction(_prevState: unknown, formData: FormData): Promise<ResultadoPerfil> {
  const session = await getSession();
  if (!session) return { erro: "Sessão expirada. Faça login novamente." };

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!nome) return { erro: "Preencha o nome completo." };
  if (!email) return { erro: "Preencha o e-mail." };

  const removerFoto = formData.get("removerFoto") === "on";
  const foto = formData.get("foto");
  let dadosFoto: { fotoData: Uint8Array<ArrayBuffer> | null; fotoMimeType: string | null } | null = null;
  if (removerFoto) {
    dadosFoto = { fotoData: null, fotoMimeType: null };
  } else if (foto instanceof File && foto.size > 0) {
    const buffer = await foto.arrayBuffer();
    dadosFoto = { fotoData: new Uint8Array(buffer), fotoMimeType: foto.type || "application/octet-stream" };
  }

  try {
    await prisma.usuario.update({
      where: { id: session.userId },
      data: { nome, email, ...(dadosFoto ?? {}) },
    });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { erro: "Já existe um usuário com esse e-mail." };
    }
    return { erro: "Não foi possível salvar as alterações. Tente novamente." };
  }

  // Reemite o cookie de sessão com o nome/e-mail atualizados — sem isso o header
  // ficaria mostrando os dados antigos até a sessão expirar (até 7 dias).
  const token = await createSessionToken({ userId: session.userId, admin: session.admin, versao: session.versao, nome, email });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions.name, token, sessionCookieOptions);

  revalidatePath("/perfil");
  return { ok: true };
}

export async function alterarSenhaAction(_prevState: unknown, formData: FormData): Promise<ResultadoPerfil> {
  const session = await getSession();
  if (!session) return { erro: "Sessão expirada. Faça login novamente." };

  const senhaAtual = String(formData.get("senhaAtual") ?? "");
  const novaSenha = String(formData.get("novaSenha") ?? "");
  const confirmarNovaSenha = String(formData.get("confirmarNovaSenha") ?? "");

  if (!senhaAtual || !novaSenha || !confirmarNovaSenha) {
    return { erro: "Preencha todos os campos de senha." };
  }
  const erroSenha = validarNovaSenha(novaSenha, confirmarNovaSenha);
  if (erroSenha) return { erro: erroSenha };

  const usuario = await prisma.usuario.findUnique({ where: { id: session.userId } });
  if (!usuario) return { erro: "Usuário não encontrado." };

  const senhaOk = await verifyPassword(senhaAtual, usuario.senhaHash);
  if (!senhaOk) return { erro: "Senha atual incorreta." };

  const senhaHash = await hashPassword(novaSenha);
  const alterados = await prisma.usuario.updateMany({ where: { id: session.userId, ativo: true, excluidoEm: null,
    sessaoVersao: session.versao ?? 0, senhaHash: usuario.senhaHash }, data: { senhaHash, sessaoVersao: { increment: 1 } } });
  if (alterados.count !== 1) return { erro: "Sua conta foi alterada em outra sessão. Entre novamente antes de mudar a senha." };
  const tokenNovo = await createSessionToken({ userId: session.userId, nome: session.nome, email: session.email, admin: session.admin, versao: (session.versao ?? 0) + 1 });
  (await cookies()).set(sessionCookieOptions.name, tokenNovo, sessionCookieOptions);

  return { ok: true };
}
