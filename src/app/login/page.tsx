import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "@/app/login/login-form";
import { PainelAcesso } from "./painel-acesso";
import { identidadeDaInterface } from "@/lib/contexto-interface";
import { retornoOAuthLogin } from "@/lib/mcp/retorno-login";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ retornoOAuth?: string }> }) {
  const retornoOAuth = retornoOAuthLogin((await searchParams).retornoOAuth);
  const session = await getSession();
  if (session) {
    redirect(retornoOAuth ? `/oauth/autorizar?solicitacao=${retornoOAuth}` : "/");
  }

  const identidade = await identidadeDaInterface();
  const dedicado = identidade !== "hub";
  return (
    <PainelAcesso titulo={identidade === "pedidos" ? "Gestor de pedidos" : dedicado ? "Controle de validades" : "Bem-vindo de volta"} descricao={dedicado ? "Entre com a mesma conta do Grazing HUB. Seus cadastros e permissões são os mesmos." : "Entre com sua conta para acessar sua operação."}><LoginForm retornoOAuth={retornoOAuth} /></PainelAcesso>
  );
}
