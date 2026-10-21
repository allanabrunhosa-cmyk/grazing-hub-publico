import { redirect } from "next/navigation";
import { LaboratorioDesign } from "@/components/design-system/laboratorio-design";
import { exigirPermissao } from "@/lib/permissoes/servidor";

export default async function LaboratorioDesignPage() {
  // Grupo separado dispensa a moldura operacional, nunca a autorização servidora.
  const sessao = await exigirPermissao("configuracoes.design");
  if (!sessao.admin) redirect("/sem-acesso");
  return <LaboratorioDesign />;
}
