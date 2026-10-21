import { obterDashboardFiscal } from "@/lib/fiscal-dashboard/servidor";
import { PainelFiscal } from "./painel-fiscal";
import Link from "next/link";
import { ErroPeriodoDashboard } from "@/lib/fiscal-dashboard/dominio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function VisaoGeralFiscal({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const dados = await obterDashboardFiscal(await searchParams).catch(erro => {
    if (erro instanceof ErroPeriodoDashboard) return null;
    throw erro;
  });
  if (!dados) return <Card className="vidro-painel"><CardHeader><CardTitle>Confira o período</CardTitle></CardHeader><CardContent className="space-y-4"><p role="alert">Informe datas válidas. A data inicial deve ser anterior ou igual à final.</p><Button variant="outline" nativeButton={false} render={<Link href="/financeiro/fiscal" />}>Voltar à visão geral</Button></CardContent></Card>;
  return <PainelFiscal dados={dados} />;
}
