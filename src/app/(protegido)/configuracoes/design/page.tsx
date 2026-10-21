import { redirect } from "next/navigation";
import { CentralDesign } from "@/components/design-system/central-design";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { obterDadosCentralDesign } from "@/lib/design-system/servico";

export default async function CentralDesignPage() {
  const sessao = await exigirPermissao("configuracoes.design");
  if (!sessao.admin) redirect("/sem-acesso");
  return <CentralDesign dados={await obterDadosCentralDesign()} />;
}
