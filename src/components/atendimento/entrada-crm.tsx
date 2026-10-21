import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { buttonVariants } from "@/components/ui/button";
import { HOST_ATENDIMENTO } from "@/lib/hosts";

export function EntradaCrm({ disponivel }: { disponivel: boolean }) {
  return <BarraAcoes titulo="Atendimento" descricao={disponivel ? "O atendimento abre em uma nova aba. Vendas & CRM permanece aberto nesta aba." : "Atendimento em preparação. O acesso será disponibilizado após a homologação."}>
    {disponivel && <Link href={`https://${HOST_ATENDIMENTO}`} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
      Atendimento<ArrowUpRight aria-hidden="true" className="size-4" /><span className="sr-only"> (abre em nova aba)</span>
    </Link>}
  </BarraAcoes>;
}
