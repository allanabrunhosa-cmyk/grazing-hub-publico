import { redirect } from "next/navigation";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";

/** Entrada das Integrações: abre a primeira conexão que a pessoa pode ver. */
export default async function IntegracoesPage() {
  const [mcp, brasilnfe] = await Promise.all([podeAcessar("configuracoes.mcp"), podeAcessar("configuracoes.brasilnfe")]);
  if (!mcp && !brasilnfe) await exigirPermissao("configuracoes.mcp");
  redirect(mcp ? "/configuracoes/integracoes/mcp" : "/configuracoes/integracoes/brasilnfe");
}
