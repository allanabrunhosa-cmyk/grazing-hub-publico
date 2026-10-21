import Link from "next/link";
import { exigirPermissao, podeAcessar } from "@/lib/permissoes/servidor";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export default async function IntegracoesPage() {
  const [mcp, brasilnfe] = await Promise.all([podeAcessar("configuracoes.mcp"), podeAcessar("configuracoes.brasilnfe")]);
  if (!mcp && !brasilnfe) await exigirPermissao("configuracoes.mcp");
  return <div className="space-y-6"><BarraAcoes titulo="Integrações" descricao="Gerencie o acesso de aplicações e a configuração de serviços do HUB." />
    {mcp && <Card><CardHeader><CardTitle>MCP do Grazing HUB</CardTitle><CardDescription>Consultas financeiras autenticadas, somente leitura, com autorização por responsável.</CardDescription></CardHeader><CardContent><Button render={<Link href="/configuracoes/integracoes/mcp" />}>Gerenciar MCP</Button></CardContent></Card>}
    {brasilnfe && <Card><CardHeader><CardTitle>Brasil NFe</CardTitle><CardDescription>Configuração segura e diagnóstico de NF-e e NFC-e. Homologação fiscal pendente; produção e transmissão bloqueadas.</CardDescription></CardHeader><CardContent><Button render={<Link href="/configuracoes/integracoes/brasilnfe" />}>Configurar Brasil NFe</Button></CardContent></Card>}
  </div>;
}
