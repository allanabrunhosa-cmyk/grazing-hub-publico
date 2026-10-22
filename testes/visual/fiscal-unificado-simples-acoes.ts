import type { EdicaoFiscalSimples, EdicaoGrupoFiscalSimples } from "@/lib/tributacao/edicao-simples";
import { salvarManutencaoFiscalAction, aplicarManutencaoFiscalAction, consultarFichaFiscalAction } from "./fiscal-unificado-acoes";
import type { ClassificacaoFiscal } from "@/lib/tributacao/tipos";
export async function salvarFiscalSimplesAction(e: EdicaoFiscalSimples) {
  const ficha = await consultarFichaFiscalAction(e.produtoId);
  const v = ficha.dados.painel.versoes.find(v => v.id === e.classificacaoId)!;
  const dados: ClassificacaoFiscal = { ...v.dados as ClassificacaoFiscal, ncm: e.fiscal.ncm, origem: e.fiscal.origem, gtin: e.fiscal.ean };
  if (e.representacao === "KIT") { dados.tratamento = "KIT_COMPOSTO"; dados.ncm = null; dados.origem = null; dados.componentesKit = e.componentesKit; }
  else if (e.representacao) { dados.tratamento = "NORMAL"; dados.natureza = e.representacao === "PRODUTO_PREPARADO" ? "PREPARADO" : "REVENDA"; delete dados.componentesKit; }
  const salvo = await salvarManutencaoFiscalAction([{ tipo: "CLASSIFICACAO", chave: e.produtoId, versaoBase: v.versao, dados, vigenciaInicio: ficha.dados.dia, justificativa: "Salvamento exclusivamente sintético.", fontes: ["Fixture"], chaveOperacao: e.chaveOperacao }]);
  await aplicarManutencaoFiscalAction(salvo.ids); return { ok: true as const, erro: undefined };
}
export async function salvarGrupoFiscalSimplesAction(e: EdicaoGrupoFiscalSimples) { return { ok: true as const, id: e.id || "grupo-exclusivamente-ficticio", erro: undefined }; }
export async function salvarEmpresaFiscalSimplesAction() { return { ok: true as const, erro: undefined }; }
