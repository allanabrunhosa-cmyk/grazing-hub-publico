import { prisma } from "@/lib/prisma";
import { exigirPermissao } from "@/lib/permissoes/servidor";
import { consultarPainelFiscal } from "@/lib/tributacao/servico";
import { obterRegimeFiscalEmpresaBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regime-empresa";
import { EmpresaFiscalResumo } from "./empresa-resumo";
import { EmpresaEdicaoSimples } from "./empresa-edicao-simples";
import { versoesVigentes } from "@/lib/tributacao/vigencia";
import { hojeFiscal } from "@/lib/tributacao/validacao";

export async function EmpresaFiscalCard() {
  const sessao = await exigirPermissao("vendas.fiscal");
  const [regime, painel, loja] = await Promise.all([obterRegimeFiscalEmpresaBrasilNfe(undefined, sessao), consultarPainelFiscal(sessao, { tabelas: false, evidenciasEntrada: false }), prisma.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { endereco: true, nome: true, cnpj: true } })]);
  const atual = versoesVigentes(painel.versoes, hojeFiscal()).find(v => v.tipo === "PERFIL" && v.chave === "singleton");
  const nomeRegime = regime.regime === "SIMPLES_NACIONAL" ? "Simples Nacional" : regime.regime === "LUCRO_PRESUMIDO" ? "Lucro Presumido" : regime.regime ?? "Não configurado";
  return <EmpresaFiscalResumo campos={[["Razão social", loja?.nome ?? "Não informada"], ["CNPJ", loja?.cnpj ?? "Não informado"], ["Regime", nomeRegime], ["CRT", regime.crt ? String(regime.crt) : "Não confirmado"], ["Inscrição estadual", regime.ie ?? "Não informada"], ["Vigência", regime.vigenteDesde ?? "Pendente"], ["Endereço", loja?.endereco ?? "Não informado"]].map(([nome, valor]) => ({ nome, valor }))} pendencias={regime.pendencias}>
    {painel.administrador ? atual ? <EmpresaEdicaoSimples versao={atual} /> : <p className="text-sm text-muted-foreground">Perfil fiscal não configurado.</p> : <p className="text-xs text-muted-foreground">Alterar o regime exige administrador fiscal.</p>}
    {!painel.administrador && <details className="space-y-2"><summary className="cursor-pointer text-sm">Histórico do regime</summary>{painel.versoes.filter(v => v.tipo === "PERFIL").map(v => <p key={v.id} className="text-sm">Versão {v.versao} · {v.status === "ATIVO" ? "Aplicada" : "Rascunho"} · vigência {v.vigenciaInicio} · {v.criadoPorNome}</p>)}</details>}
  </EmpresaFiscalResumo>;
}
