"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { registrarAutenticacao } from "@/lib/atividades/autenticacao";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionToken, sessionCookieOptions } from "@/lib/auth";
import { retornoOAuthLogin } from "@/lib/mcp/retorno-login";

export type LoginState = { erro: string | null };

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha || email.length > 254 || Buffer.byteLength(senha, "utf8") > 72) {
    return { erro: "Preencha e-mail e senha." };
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (!usuario || !usuario.ativo || usuario.excluidoEm || !usuario.senhaDefinida) {
    await registrarAutenticacao(null, "LOGIN_RECUSADO");
    return { erro: "E-mail ou senha inválidos." };
  }

  const senhaOk = await verifyPassword(senha, usuario.senhaHash);
  if (!senhaOk) {
    await registrarAutenticacao(null, "LOGIN_RECUSADO");
    return { erro: "E-mail ou senha inválidos." };
  }

  const token = await createSessionToken({
    userId: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    admin: usuario.admin,
    versao: usuario.sessaoVersao,
  });

  try { await registrarAutenticacao({ userId: usuario.id, nome: usuario.nome }, "LOGIN", "configuracoes.usuarios", true); }
  catch { return { erro: "Não foi possível iniciar a sessão. Tente novamente." }; }
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieOptions.name, token, sessionCookieOptions);

  const retornoOAuth = retornoOAuthLogin(formData.get("retornoOAuth"));
  redirect(retornoOAuth ? `/oauth/autorizar?solicitacao=${retornoOAuth}` : "/");
}

export async function logoutAction() {
  let sessao = null;
  try { sessao = await getSession(); }
  catch { console.error("atividade_logout_identidade_indisponivel"); }
  if (sessao) await registrarAutenticacao(sessao, "LOGOUT_EXPLICITO");
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieOptions.name);
  redirect("/login");
}
