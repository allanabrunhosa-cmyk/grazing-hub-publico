import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { permissaoEfetiva } from "@/lib/permissoes/catalogo";

export async function AvisoFaturas() {
  const sessao = await getSession();
  if (!sessao || (!sessao.admin && !permissaoEfetiva(sessao.permissoes,sessao.excecoes,"financeiro.faturas","visualizar"))) return null;
  const quantidade = await prisma.faturaCartao.count({where:{canceladaEm:null,estado:{in:["REVISAO","DIVERGENTE"]}}});
  if (!quantidade) return null;
  return <div role="status" className="rounded-lg border bg-muted p-4 text-sm"><Link className="font-medium underline" href="/financeiro/cartoes">{quantidade} fatura(s) aguardando revisão.</Link> O DRE e as previsões por categoria podem estar incompletos até concluir os vínculos. Pagamentos já conciliados aparecem no caixa uma única vez, mesmo antes da classificação.</div>;
}
