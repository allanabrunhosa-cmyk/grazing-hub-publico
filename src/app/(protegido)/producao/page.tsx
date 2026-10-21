import { exigirPermissao } from "@/lib/permissoes/servidor";
import Link from "next/link";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { buttonVariants } from "@/components/ui/button";

export default async function ProducaoPage() {
  await exigirPermissao("producao");
  return <BarraAcoes titulo="Produção" descricao="Acesse o controle de validades com os mesmos cadastros e permissões do HUB.">
    <Link href="/producao/etiquetas" className={buttonVariants()}>Controle de validades</Link>
  </BarraAcoes>;
}
