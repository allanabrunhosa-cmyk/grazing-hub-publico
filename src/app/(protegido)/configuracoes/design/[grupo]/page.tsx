import { notFound, redirect } from "next/navigation";
import { CentralDesign } from "@/components/design-system/central-design";
import { grupoDesignValido } from "@/lib/design-system/grupos";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { obterDadosCentralDesign } from "@/lib/design-system/servico";

export default async function GrupoCentralDesignPage({ params }: { params: Promise<{ grupo: string }> }) {
  const sessao = await exigirPermissao("configuracoes.design");
  if (!sessao.admin) redirect("/sem-acesso");
  const { grupo } = await params;
  if (!grupoDesignValido(grupo)) notFound();
  return <CentralDesign grupo={grupo} dados={await obterDadosCentralDesign()} />;
}
