"use server";

import { after } from "next/server";
import { cookies } from "next/headers";
import { sessionCookieOptions } from "@/lib/session-token";
import { emailConfigurado, enviarEmailRecuperacao } from "@/lib/recuperacao-senha/email";
import { concluirRecuperacao, linkRecuperacaoValido, prepararRecuperacao, reservarSolicitacao } from "@/lib/recuperacao-senha/servico";
import { MENSAGEM_SOLICITACAO } from "@/lib/recuperacao-senha/validacao";

export type EstadoRecuperacao = { erro: string } | { ok: true; mensagem?: string } | null;

// Ações públicas intencionais: solicitação não concede acesso; redefinição exige segredo válido.
export async function solicitarRecuperacaoAction(_anterior: EstadoRecuperacao, dados: FormData): Promise<EstadoRecuperacao> {
  const email = String(dados.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { erro: "Informe um e-mail válido." };
  if (!await emailConfigurado()) return { erro: "A recuperação por e-mail ainda não está disponível. Entre em contato com o administrador para redefinir sua senha." };
  try {
    const permitido = await reservarSolicitacao(email);
    // Consulta da conta e envio fora da resposta: não revelam cadastro pelo tempo de envio.
    if (permitido) after(async () => {
      try { await prepararRecuperacao(email); }
      catch { console.error("[recuperacao-senha] Não foi possível entregar as instruções. Verifique o serviço de e-mail."); }
    });
    return { ok: true, mensagem: MENSAGEM_SOLICITACAO };
  } catch { return { erro: "Não foi possível processar a solicitação. Tente novamente em instantes." }; }
}

export async function verificarLinkRecuperacaoAction(token: string): Promise<{ valido: boolean } | { erro: string }> {
  try { return { valido: typeof token === "string" && await linkRecuperacaoValido(token) }; }
  catch { return { erro: "Não foi possível verificar o link. Atualize a página para tentar novamente." }; }
}

export async function redefinirSenhaAction(_anterior: EstadoRecuperacao, dados: FormData): Promise<EstadoRecuperacao> {
  try {
    const resultado = await concluirRecuperacao(String(dados.get("token") ?? ""), String(dados.get("senha") ?? ""), String(dados.get("confirmacao") ?? ""));
    if ("erro" in resultado) return resultado;
    (await cookies()).delete(sessionCookieOptions.name);
    after(async () => {
      try { await enviarEmailRecuperacao(resultado.email); }
      catch { console.error("[recuperacao-senha] Senha alterada; falha no envio do aviso de segurança."); }
    });
    return { ok: true };
  } catch { return { erro: "Não foi possível redefinir a senha. Tente novamente em instantes." }; }
}
