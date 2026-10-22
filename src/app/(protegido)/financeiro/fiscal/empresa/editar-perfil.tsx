"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { PainelFiscal, PerfilFiscal, VersaoFiscalDto } from "@/lib/tributacao/tipos";
import { dadosFiscaisIniciais } from "@/app/(protegido)/vendas/fiscal/cobertura/versao-editor";
import { EdicaoFiscalVersionada } from "../edicao-versionada";

export function EditarPerfilEmpresa({ versoes }: { versoes: VersaoFiscalDto[] }) {
  const [selecionada, setSelecionada] = useState<VersaoFiscalDto | "NOVA" | null>(null);
  const router = useRouter();
  const painel: PainelFiscal = { produtos: [], entradas: [], grupos: [], opcoes: [], versoes, administrador: true, resumo: { ativos: 0, aptos: 0, pendentes: 0, configuracoes: 0 } };
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const atual = versoes.filter(v => v.tipo === "PERFIL" && v.chave === "singleton" && v.status === "ATIVO" && v.vigenciaInicio <= hoje)
    .sort((a, b) => b.vigenciaInicio.localeCompare(a.vigenciaInicio) || b.versao - a.versao)[0];
  const inicial = selecionada === "NOVA" ? { ...dadosFiscaisIniciais("PERFIL") as PerfilFiscal, estabelecimento: "singleton", emissor: "BRASIL_NFE" as const } : selecionada?.dados;
  return <div className="space-y-3"><Button type="button" onClick={() => setSelecionada(atual ?? "NOVA")}>{atual ? "Editar" : "Configurar"} regime e vigência</Button>
    <details className="space-y-3"><summary className="cursor-pointer text-sm">Rascunhos, versões futuras e histórico</summary>{versoes.map(v => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 text-sm"><span>Versão {v.versao} · {v.status === "RASCUNHO" ? "Rascunho" : v.vigenciaInicio > hoje ? "Aplicação futura" : "Aplicada"} · {v.vigenciaInicio} · {v.criadoPorNome}</span><Button type="button" size="sm" variant="outline" onClick={() => setSelecionada(v)}>{v.status === "RASCUNHO" ? "Retomar rascunho" : "Criar nova versão"}</Button></div>)}</details>
    {selecionada && inicial && <EdicaoFiscalVersionada key={selecionada === "NOVA" ? "novo-perfil" : selecionada.id} titulo="Regime e vigência da empresa" tipo="PERFIL" chave="singleton" inicial={inicial} versao={selecionada === "NOVA" ? undefined : selecionada} painel={painel} fechar={() => setSelecionada(null)} atualizado={() => router.refresh()} />}
  </div>;
}
