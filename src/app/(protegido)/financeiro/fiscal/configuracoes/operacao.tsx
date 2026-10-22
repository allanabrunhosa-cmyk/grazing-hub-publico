import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function OperacaoFiscal({ administrarAcessos, administradorFiscal }: { administrarAcessos: boolean; administradorFiscal: boolean }) {
  return <Card className="vidro-painel"><CardHeader><CardTitle>Preferências e permissões</CardTitle><CardDescription>As permissões seguem o cadastro central de usuários.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm">
    <p>O pedido começa com NFC-e, modelo 65. Você pode escolher NF-e, modelo 55, antes de emitir. A seleção não muda o regime nem os tributos do produto.</p>
    <p>A habilitação por ambiente fica no bloco Emissor. A série e o próximo número ficam em Séries e numeração.</p>
    <p>{administradorFiscal ? "Seu perfil permite administrar versões fiscais. Cada aplicação exige revisão de impacto nesta tela." : "Aplicar versões fiscais exige administrador com permissão fiscal. Seu perfil permite somente as ações liberadas em cada bloco."}</p>
    {administrarAcessos ? <Button type="button" variant="outline" nativeButton={false} render={<Link href="/configuracoes/usuarios" />}>Gerenciar usuários e permissões</Button> : <p className="text-xs text-muted-foreground">Alterar acessos exige permissão em Configurações → Usuários &amp; Permissões.</p>}
  </CardContent></Card>;
}
