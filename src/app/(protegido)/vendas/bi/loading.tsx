import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CarregandoBi() {
  return <Card aria-busy="true"><CardHeader><CardTitle>Dashboard</CardTitle></CardHeader>
    <CardContent><p role="status">Consultando os indicadores de vendas…</p></CardContent>
  </Card>;
}
