import Link from "next/link";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";
import { consultarPainelFiscal } from "@/lib/tributacao/servico";
import { BarraAcoes } from "@/components/padroes-operacionais";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditarPerfilEmpresa } from "./editar-perfil";

export default async function ConfiguracaoFiscalEmpresa() {
  const sessao = await exigirPermissao("vendas.fiscal");
  const [regime, painel] = await Promise.all([obterRegimeFiscalEmpresaBrasilNfe(undefined, sessao), consultarPainelFiscal(sessao)]);
  const versoes = painel.versoes.filter(v => v.tipo === "PERFIL" && v.chave === "singleton");
  return <div className="space-y-5">
    <BarraAcoes titulo="Configuração fiscal da empresa" descricao="Perfil central vinculado ao cadastro da empresa. Toda alteração tem vigência e histórico.">
      <Button variant="outline" nativeButton={false} render={<Link href="/financeiro/fiscal" />}>Visão geral</Button>
      {painel.administrador && <EditarPerfilEmpresa versoes={versoes} />}
    </BarraAcoes>
    <Card><CardHeader><CardTitle>{regime.regime ?? "Regime pendente de revisão"}</CardTitle><CardDescription>A operação usa o perfil aprovado e vigente na sua data. Uma proposta não altera documentos históricos nem habilita emissão.</CardDescription></CardHeader>
      <CardContent className="space-y-4"><dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Código CRT</dt><dd>{regime.crt ? `${regime.crt} — ${regime.descricaoCrt}` : "Não confirmado"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Inscrição estadual</dt><dd>{regime.ie ?? "Não confirmada"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Vigência</dt><dd>{regime.vigenteDesde ?? "Pendente"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Data da operação</dt><dd>{regime.dia}</dd></div>
      </dl>{regime.pendencias.map(p => <p key={p} className="text-sm text-muted-foreground">{p}</p>)}
      {regime.verificacoes.slice(0, 1).map(v => <section key={v.versaoId} className="space-y-2 border-t pt-3"><Badge variant="outline">Perfil · versão {v.revisao}</Badge><p className="text-xs text-muted-foreground">Aprovação: {new Date(v.aprovadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (Brasília).</p>{v.fontes.map(f => <p key={f.referencia} className="break-words text-sm">{f.referencia}</p>)}</section>)}
      </CardContent></Card>
    <Card><CardHeader><CardTitle>Histórico e revisão interna</CardTitle><CardDescription>Reutiliza as versões PERFIL da estrutura fiscal. O cadastro da empresa continua sendo a fonte da identidade.</CardDescription></CardHeader>
      <CardContent className="space-y-3">{versoes.map(v => <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0"><span className="text-sm">Versão {v.versao} · {v.status === "ATIVO" ? "Aprovada" : "Proposta"} · vigência {v.vigenciaInicio}</span><span className="text-xs text-muted-foreground">{v.criadoPorNome}</span></div>)}
        <Button variant="outline" nativeButton={false} render={<Link href="/financeiro/fiscal/cobertura" />}>Revisar impacto e aprovação</Button>
      </CardContent></Card>
  </div>;
}
