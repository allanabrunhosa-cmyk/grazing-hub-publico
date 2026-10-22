import type { EdicaoFiscalSimples, EdicaoGrupoFiscalSimples } from "@/lib/tributacao/edicao-simples";
import { salvarManutencaoFiscalAction, aplicarManutencaoFiscalAction, consultarFichaFiscalAction } from "./fiscal-unificado-acoes";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";
export async function salvarFiscalSimplesAction(e: EdicaoFiscalSimples) {
  const ficha = await consultarFichaFiscalAction(e.produtoId);
  const v = ficha.dados.painel.versoes.find(v => v.id === e.classificacaoId)!;
  const salvo = await salvarManutencaoFiscalAction([{ tipo: "CLASSIFICACAO", chave: e.produtoId, versaoBase: v.versao, dados: { ...v.dados as ClassificacaoFiscal, ncm: e.fiscal.ncm, origem: e.fiscal.origem, gtin: e.fiscal.ean }, vigenciaInicio: ficha.dados.dia, justificativa: "Salvamento exclusivamente sintético.", fontes: ["Fixture"], chaveOperacao: e.chaveOperacao }]);
  await aplicarManutencaoFiscalAction(salvo.ids); return { ok: true as const, erro: undefined };
}
export async function salvarGrupoFiscalSimplesAction(e: EdicaoGrupoFiscalSimples) { return { ok: true as const, id: e.id || "grupo-exclusivamente-ficticio", erro: undefined }; }
export async function salvarEmpresaFiscalSimplesAction() { return { ok: true as const, erro: undefined }; }
