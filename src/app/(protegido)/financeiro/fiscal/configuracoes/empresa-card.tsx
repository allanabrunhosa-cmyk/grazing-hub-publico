import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarPainelFiscal } from "@/lib/tributacao/servico";
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";
import { EmpresaFiscalResumo } from "./empresa-resumo";
import { EditarPerfilEmpresa } from "../empresa/editar-perfil";

export async function EmpresaFiscalCard() {
  const sessao = await exigirPermissao("vendas.fiscal");
  const [regime, painel, loja] = await Promise.all([obterRegimeFiscalEmpresaBrasilNfe(undefined, sessao), consultarPainelFiscal(sessao), prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { endereco: true } })]);
  const nomeRegime = regime.regime === "SIMPLES_NACIONAL" ? "Simples Nacional" : regime.regime === "LUCRO_PRESUMIDO" ? "Lucro Presumido" : regime.regime ?? "Não configurado";
  return <EmpresaFiscalResumo campos={[["Regime", nomeRegime], ["CRT", regime.crt ? String(regime.crt) : "Não confirmado"], ["Inscrição estadual", regime.ie ?? "Não informada"], ["Vigência", regime.vigenteDesde ?? "Pendente"], ["Endereço", loja?.endereco ?? "Não informado"]].map(([nome, valor]) => ({ nome, valor }))} pendencias={regime.pendencias}>
    {painel.administrador ? <EditarPerfilEmpresa versoes={painel.versoes.filter(v => v.tipo === "PERFIL" && v.chave === "singleton")} /> : <p className="text-xs text-muted-foreground">Alterar o regime exige administrador fiscal.</p>}
    {!painel.administrador && <details className="space-y-2"><summary className="cursor-pointer text-sm">Histórico do regime</summary>{painel.versoes.filter(v => v.tipo === "PERFIL").map(v => <p key={v.id} className="text-sm">Versão {v.versao} · {v.status === "ATIVO" ? "Aplicada" : "Rascunho"} · vigência {v.vigenciaInicio} · {v.criadoPorNome}</p>)}</details>}
  </EmpresaFiscalResumo>;
}
