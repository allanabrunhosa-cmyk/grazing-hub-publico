"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GrupoAcoes } from "@/components/padroes-operacionais";

export function BiIndisponivel({ mensagem }: { mensagem: string }) {
  const router = useRouter();
  return <Card><CardHeader><CardTitle>Dashboard</CardTitle></CardHeader>
    <CardContent className="space-y-4"><p role="alert">{mensagem}</p>
      <GrupoAcoes nome="Recuperação da consulta do Dashboard" alinhamento="inicio"><Button variant="outline" onClick={() => router.refresh()}>Tentar novamente</Button>
        <Button variant="outline" nativeButton={false} render={<Link href="/vendas/bi?aba=geral" />}>Abrir visão geral</Button></GrupoAcoes>
    </CardContent></Card>;
}
