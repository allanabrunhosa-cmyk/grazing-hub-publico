
import { podeAcessar } from "@/lib/permissoes/servidor";
import { redirect } from "next/navigation";
export default async function ConfiguracoesPage() {
  if (await podeAcessar("configuracoes.usuarios")) redirect("/configuracoes/usuarios");
  if (await podeAcessar("configuracoes.loja")) redirect("/configuracoes/empresa");
  if (await podeAcessar("configuracoes.mcp")) redirect("/configuracoes/integracoes");
  if (await podeAcessar("configuracoes.brasilnfe")) redirect("/configuracoes/integracoes/brasilnfe");
  redirect("/sem-acesso");
}
