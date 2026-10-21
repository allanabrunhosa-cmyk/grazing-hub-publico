"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PainelFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { EditorVersaoFiscal } from "@/app/(protegido)/vendas/fiscal/cobertura/versao-editor";

export function EditarPerfilEmpresa({ versoes }: { versoes: VersaoFiscalDto[] }) {
  const [aberto, setAberto] = useState(false);
  const router = useRouter();
  const painel: PainelFiscal = { produtos: [], entradas: [], grupos: [], opcoes: [], versoes, administrador: true, resumo: { ativos: 0, aptos: 0, pendentes: 0, configuracoes: 0 } };
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const atual = versoes.filter(v => v.tipo === "PERFIL" && v.chave === "singleton" && v.status === "ATIVO" && v.vigenciaInicio <= hoje)
    .sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio) || b.versao - a.versao)[0];
  return <><Button onClick={() => setAberto(true)}>Revisar perfil</Button>{aberto && <EditorVersaoFiscal tipo="PERFIL" versao={atual} painel={painel} fechar={() => { setAberto(false); router.refresh(); }} />}</>;
}
