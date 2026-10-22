import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EmpresaFiscalResumo({ campos, pendencias, children }: { campos: { nome: string; valor: string }[]; pendencias: string[]; children?: ReactNode }) {
  return <Card className="vidro-painel"><CardHeader><CardTitle>Empresa</CardTitle><CardDescription>Identidade do cadastro da empresa e perfil fiscal vigente.</CardDescription></CardHeader><CardContent className="space-y-4">
    <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">{campos.map(({ nome, valor }) => <div key={nome}><dt className="text-xs text-muted-foreground">{nome}</dt><dd className="break-words font-medium">{valor}</dd></div>)}</dl>
    {pendencias.map(p => <p key={p} className="text-sm text-muted-foreground">{p}</p>)}
    <p className="text-xs text-muted-foreground">CNPJ e endereço pertencem ao cadastro da empresa. A alteração exige sua permissão de edição. O regime fiscal tem vigência e aplicação próprias.</p>
    <Button type="button" variant="outline" nativeButton={false} render={<Link href="/configuracoes/empresa" />}>Abrir dados da empresa</Button>
    {children}
  </CardContent></Card>;
}
