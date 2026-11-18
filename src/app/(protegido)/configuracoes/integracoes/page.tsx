import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CabecalhoIntegracoes } from "./seletor";
import { IconeTom } from "./tons";

export default async function IntegracoesPage() {
  const [mcp, brasilnfe] = await Promise.all([podeAcessar("configuracoes.mcp"), podeAcessar("configuracoes.brasilnfe")]);
  if (!mcp && !brasilnfe) await exigirPermissao("configuracoes.mcp");
  // Com acesso ao MCP, a primeira integração abre selecionada, como no seletor.
  if (mcp) redirect("/configuracoes/integracoes/mcp");
  return <div className="space-y-6">
    <CabecalhoIntegracoes disponiveis={brasilnfe ? ["brasilnfe"] : []} />
    {brasilnfe && <Card><CardContent className="flex flex-wrap items-center gap-4">
      <IconeTom tom="verde" tamanho="grande"><FileText /></IconeTom>
      <div className="min-w-0 flex-1 basis-64"><h2 className="font-heading text-title">Brasil NFe</h2><p className="text-sm text-muted-foreground">Configuração segura e diagnóstico de NF-e e NFC-e. Homologação fiscal pendente; produção e transmissão bloqueadas.</p></div>
      <Button render={<Link href="/configuracoes/integracoes/brasilnfe" />}>Configurar Brasil NFe</Button>
    </CardContent></Card>}
  </div>;
}
