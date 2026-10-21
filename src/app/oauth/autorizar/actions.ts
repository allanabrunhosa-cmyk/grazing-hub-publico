"use server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { consentirOAuth } from "@/lib/mcp/oauth";
import { ErroMcp } from "@/lib/mcp/politica";
import { retornoOAuthLogin } from "@/lib/mcp/retorno-login";
import { limitarMcp } from "@/lib/mcp/servidor";

export async function consentirMcpAction(_estado: { erro: string | null }, form: FormData): Promise<{ erro: string | null }> {
  const sessao = await getSession();
  if (!sessao) return { erro: "Sessão encerrada. Entre novamente no HUB." };
  const solicitacao = retornoOAuthLogin(form.get("solicitacao"));
  const autorizacao = retornoOAuthLogin(form.get("autorizacao"));
  const revisao = String(form.get("revisao") ?? "");
  if (!solicitacao || !autorizacao || form.get("consentimento") !== "on") return { erro: "Selecione a política e confirme o consentimento." };
  let destino: string;
  try {
    await limitarMcp(`consentimento:${sessao.userId}`, 10);
    destino = await consentirOAuth(solicitacao, autorizacao, sessao.userId, revisao);
  } catch (e) { return { erro: e instanceof ErroMcp ? e.message : "Não foi possível autorizar. Reinicie a conexão." }; }
  redirect(destino);
}
