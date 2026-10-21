import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { buttonVariants } from "@/components/ui/button";
import { CATALOGO } from "@/lib/permissoes/catalogo";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { CAMINHO_PEDIDOS, HOST_PEDIDOS, HOST_ATENDIMENTO } from "@/lib/hosts";
export default async function VendasPage() {
  const secoes = CATALOGO.find(modulo => modulo.id === "vendas")!.secoes.filter(secao => secao.rota);
  const acessos = await Promise.all(secoes.map(secao => podeAcessar(secao.id)));
  const entrada = secoes.find((_, indice) => acessos[indice]);
  await exigirPermissao(entrada?.id ?? "vendas");
  if (secoes.some((secao, indice) => secao.id === "vendas.bi" && acessos[indice])) redirect("/vendas/bi");
  const gestor = secoes.some((secao, indice) => secao.id === "vendas.pedidos" && acessos[indice]);
  const atendimento = secoes.some((secao, indice) => secao.id === "crm" && acessos[indice]);
  return <BarraAcoes titulo="Vendas & CRM" descricao="Escolha um submódulo no menu. Gestor de pedidos e Atendimento abrem em novas abas.">
    {gestor && <Link href={`https://${HOST_PEDIDOS}${CAMINHO_PEDIDOS}`} target="_blank" rel="noreferrer" className={buttonVariants()}>Abrir gestor de pedidos<ArrowUpRight aria-hidden="true" className="size-4" /></Link>}
    {atendimento && <Link href={`https://${HOST_ATENDIMENTO}`} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>Atendimento<ArrowUpRight aria-hidden="true" className="size-4" /><span className="sr-only"> (abre em nova aba)</span></Link>}
  </BarraAcoes>;
}
