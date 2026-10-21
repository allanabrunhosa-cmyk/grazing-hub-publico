import "server-only";
import { registrarAutenticacao } from "@/lib/atividades/autenticacao";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { permissaoEfetiva, type Acao } from "./catalogo";
import { contextoExecucao } from "@/lib/contexto-execucao";
export class ErroPermissao extends Error {}
export async function exigirSessao() {
  const sessao = await getSession();
  if (!sessao) redirect("/login");
  return sessao;
}
export async function podeAcessar(recurso: string, acao: Acao = "visualizar") {
  const sessao = await getSession();
  return !!sessao && (sessao.admin || permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, acao));
}
export async function exigirPermissao(recurso: string, acao: Acao = "visualizar") {
  const sessao = await getSession();
  const negado = sessao && !sessao.admin && !permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, acao);
  if (negado && acao !== "visualizar") await registrarAutenticacao(sessao, "AUTORIZACAO_NEGADA", recurso);
  if (contextoExecucao() && (!sessao || negado)) throw new ErroPermissao("Ação não permitida pelas permissões atuais do HUB.");
  if (!sessao) redirect("/login");
  if (!sessao.admin && !permissaoEfetiva(sessao.permissoes, sessao.excecoes, recurso, acao)) redirect("/sem-acesso");
  return sessao;
}
