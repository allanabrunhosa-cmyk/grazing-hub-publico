import { obterDashboardFiscal } from "@/lib/fiscal-dashboard/servidor";
import { PainelFiscal } from "./painel-fiscal";
import Link from "next/link";
import { ErroPeriodoDashboard } from "@/lib/fiscal-dashboard/dominio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { after } from "next/server";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarRevisoesNcmPendentes } from "@/lib/tributacao/revisao-ncm";
import { verificarEAlertarRevisoesNcm } from "@/lib/tributacao/revisao-ncm-alerta";
import { RevisaoNcmPendentePainel } from "./revisao-ncm-pendente";
import { manterNcmRevisadoAction } from "./revisao-ncm-actions";

export default async function VisaoGeralFiscal({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const dados = await obterDashboardFiscal(await searchParams).catch(erro => {
    if (erro instanceof ErroPeriodoDashboard) return null;
    throw erro;
  });
  if (!dados) return <Card className="vidro-painel"><CardHeader><CardTitle>Confira o período</CardTitle></CardHeader><CardContent className="space-y-4"><p role="alert">Informe datas válidas. A data inicial deve ser anterior ou igual à final.</p><Button variant="outline" nativeButton={false} render={<Link href="/financeiro/fiscal" />}>Voltar à visão geral</Button></CardContent></Card>;
  // Leitura auxiliar: falha na conferência de NCM não derruba o painel.
  const sessao = await exigirPermissao("financeiro.fiscal.painel");
  const revisoes = await consultarRevisoesNcmPendentes().catch(() => []);
  if (revisoes.length) after(() => verificarEAlertarRevisoesNcm(revisoes).catch(() => undefined));
  return <PainelFiscal dados={dados} revisaoNcm={<RevisaoNcmPendentePainel revisoes={revisoes} podeDecidir={sessao.admin === true} manter={manterNcmRevisadoAction} />} />;
}
