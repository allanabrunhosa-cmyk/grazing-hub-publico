import type { CenarioNcmCalculado, ClassificacaoFiscal, ItemComercialFiscal } from "./tipos";
import { hashOpcaoTecnica, hashTecnico, type FotografiaReceitaFiscal } from "./fotografia-tecnica";
import { Prisma } from "@/generated/prisma/client";

/** Seleção exata por identidade comercial fotografada; não há prioridade, regex ou código padrão implícito. */
export function resolverNcmConfiguracao(c: ClassificacaoFiscal, escolhas: ItemComercialFiscal["escolhas"], versaoId: string, receitaFotografada?: ItemComercialFiscal["receitaFotografada"], tecnicaAtual?: FotografiaReceitaFiscal) {
  const cfg = c.configuracaoNcm;
  const pendencias: string[] = [], justificativas: string[] = [];
  let cenarioNcm: CenarioNcmCalculado | undefined;
  const bloquear = (motivo: string) => ({ classificacao: { ...c, ncm: null }, cenarioNcm, pendencias: [motivo], justificativas });
  if (c.receitaFiscalDocumentada && (!receitaFotografada?.documentacaoHash || !tecnicaAtual?.documentacaoHash)) return bloquear("Receita fiscal documentada exige fotografia própria no pedido e comprovação atual; não reconstruir a venda histórica pela CMV vigente.");
  if (receitaFotografada?.comprovacaoParcial && (!cfg || !c.baseSemIngredientesComprovada || !receitaFotografada.comprovacaoParcial.baseSemIngredientes || escolhas.some(e => !receitaFotografada.comprovacaoParcial!.opcaoIdsComComposicao.includes(e.opcaoId)))) return bloquear("Pedido com composição de estoque pendente exige ausência de base documentada e prova física das escolhas; nenhuma receita omitida é presumida vazia.");
  if (!cfg) {
    if (c.fotografiaTecnica && (!receitaFotografada || !tecnicaAtual || c.fotografiaTecnica.principalHash !== receitaFotografada.principalHash || c.fotografiaTecnica.principalHash !== tecnicaAtual.principalHash || !receitaFotografada.materiais || !tecnicaAtual.materiais || hashTecnico(c.fotografiaTecnica.materiais) !== hashTecnico(receitaFotografada.materiais.principal) || hashTecnico(c.fotografiaTecnica.materiais) !== hashTecnico(tecnicaAtual.materiais.principal))) return bloquear("Receita material/transitiva ou identificação física não corresponde à análise e ao snapshot do pedido; revisar somente esta mercadoria, sem reescrever documentos anteriores.");
    if (c.analiseNcm && c.ncmAplicabilidade === "APLICAVEL" && escolhas.some(e => receitaFotografada?.opcaoHashes.find(h => h.opcaoId === e.opcaoId)?.hash !== hashOpcaoTecnica(e.produtoId, []))) return bloquear("Ingrediente incluído ou adicional integrado altera a composição sem cenário NCM fundamentado; analisar esta combinação antes de emitir.");
    return { classificacao: c, cenarioNcm, pendencias, justificativas };
  }
  const tecnica = cfg.fotografiaTecnica;
  if (!tecnica || tecnica.algoritmo !== "grazing.receita-fiscal.v1") return bloquear("Classificação por configuração sem fotografia técnica registrada pelo servidor; salvar nova versão fundamentada.");
  if (!receitaFotografada || !tecnicaAtual) return bloquear("Composição técnica do pedido ou do cadastro atual não comprovada para resolver o cenário NCM.");
  if (tecnica.principalHash !== receitaFotografada.principalHash || tecnica.principalHash !== tecnicaAtual.principalHash) return bloquear("Composição ou unidade do principal diverge da receita analisada; revisar a classificação deste produto.");
  if (tecnica.materiais && (!receitaFotografada.materiais || !tecnicaAtual.materiais || hashTecnico(tecnica.materiais.principal) !== hashTecnico(receitaFotografada.materiais.principal) || hashTecnico(tecnica.materiais.principal) !== hashTecnico(tecnicaAtual.materiais.principal))) return bloquear("Receita transitiva do principal ou marca/GTIN material diverge da análise; snapshot histórico sem essa prova exige conferência da operação afetada.");
  if (escolhas.some(e => !e.grupoId)) return bloquear("Identidade do grupo de escolha ausente no snapshot; reprepare a operação para resolver o NCM por configuração.");
  const selecionadas = escolhas.filter(e => cfg.grupoIds.includes(e.grupoId!));
  const ids = selecionadas.map(e => e.opcaoId).sort();
  if (new Set(ids).size !== ids.length) return bloquear("Escolhas discriminantes repetidas; configuração fiscal ambígua.");
  const equivalentes = cfg.gruposEquivalentes ?? [];
  const idsEquivalentes: string[] = [];
  for (const g of equivalentes) {
    const es = escolhas.filter(e => e.grupoId === g.grupoId);
    if (es.some(e => !g.opcaoIds.includes(e.opcaoId)) || g.analiseNcm.confianca === "BAIXA" || g.analiseNcm.pendenciasNcm.length || !g.analiseNcm.fontes.length || !g.analiseNcm.descricaoNcm) return bloquear("Escolha sem equivalência NCM comprovada para este grupo.");
    let total = new Prisma.Decimal(0);
    for (const e of es) {
      if (!e.quantidadeEscolhida || !/^\d{1,12}(\.\d{1,6})?$/.test(e.quantidadeEscolhida) || new Prisma.Decimal(e.quantidadeEscolhida).lte(0)) return bloquear("Quantidade escolhida ausente ou inválida para conferir limites da equivalência NCM.");
      total = total.plus(e.quantidadeEscolhida); idsEquivalentes.push(e.opcaoId);
    }
    if (total.lt(g.quantidadeMinima) || total.gt(g.quantidadeMaxima)) return bloquear("Quantidade escolhida fora dos limites documentados da equivalência NCM.");
    if (new Set(es.map(e => e.opcaoId)).size !== es.length) return bloquear("Escolhas equivalentes repetidas no snapshot; conferir a configuração.");
    justificativas.push(`Equivalência NCM documentada do grupo ${g.grupoId}; quantidade ${total.toString()} dentro de ${g.quantidadeMinima}–${g.quantidadeMaxima}.`, g.analiseNcm.justificativa, ...g.analiseNcm.fontes.map(f => `Fonte da equivalência NCM: ${f}`));
  }
  for (const id of [...ids, ...idsEquivalentes]) {
    const hash = tecnica.opcaoHashes.find(h => h.opcaoId === id)?.hash;
    if (!hash || hash !== receitaFotografada.opcaoHashes.find(h => h.opcaoId === id)?.hash || hash !== tecnicaAtual.opcaoHashes.find(h => h.opcaoId === id)?.hash) return bloquear(`Composição ou quantidade da opção ${id} diverge da receita analisada; salvar nova classificação para este ramo.`);
    if (tecnica.materiais) {
      const mat = tecnica.materiais.opcoes.find(m => m.opcaoId === id)?.materiais;
      if (!mat || hashTecnico(mat) !== hashTecnico(receitaFotografada.materiais?.opcoes.find(m => m.opcaoId === id)?.materiais) || hashTecnico(mat) !== hashTecnico(tecnicaAtual.materiais?.opcoes.find(m => m.opcaoId === id)?.materiais)) return bloquear(`Receita transitiva da opção ${id} diverge da fórmula/identidade material analisada; revisar somente este ramo.`);
    }
  }
  for (const e of escolhas.filter(e => !cfg.grupoIds.includes(e.grupoId!) && !equivalentes.some(g => g.grupoId === e.grupoId))) {
    const foto = receitaFotografada.opcaoHashes.find(h => h.opcaoId === e.opcaoId);
    if (!foto || foto.hash !== hashOpcaoTecnica(e.produtoId, [])) return bloquear("Ingrediente adicional fora dos cenários de composição analisados; classificar esta combinação antes de emitir.");
  }
  if (!ids.length) {
    if (!cfg.padraoSemEscolhasAutorizado || !c.ncm || !c.analiseNcm || c.analiseNcm.confianca === "BAIXA" || c.analiseNcm.pendenciasNcm.length) return bloquear("Ausência de escolha discriminante sem NCM padrão expressamente autorizado e fundamentado.");
    cenarioNcm = { id: "PADRAO_SEM_ESCOLHAS", nome: idsEquivalentes.length ? "Padrão com equivalência comprovada" : "Padrão sem escolhas", opcaoIds: [...idsEquivalentes].sort(), classificacaoVersaoId: versaoId };
    justificativas.push(`NCM padrão sem escolhas expressamente autorizado na classificação ${versaoId}.`, c.analiseNcm.justificativa);
    return { classificacao: c, cenarioNcm, pendencias, justificativas };
  }
  const compativeis = cfg.cenarios.filter(s => s.opcaoIds.length === ids.length && s.opcaoIds.every(id => ids.includes(id) && new Prisma.Decimal(s.quantidadesEscolhidas?.find(q => q.opcaoId === id)?.quantidade ?? "1").equals(selecionadas.find(e => e.opcaoId === id)!.quantidadeEscolhida ?? "1")));
  if (compativeis.length !== 1) return bloquear(compativeis.length ? "Mais de um cenário NCM corresponde às escolhas; corrigir a ambiguidade antes de emitir." : "Combinação de escolhas sem cenário NCM fundamentado; somente esta operação exige classificação complementar.");
  const s = compativeis[0], a = s.analiseNcm;
  cenarioNcm = { id: s.id, nome: s.nome, opcaoIds: [...ids, ...idsEquivalentes].sort(), classificacaoVersaoId: versaoId };
  if (!s.ncm || !a || a.confianca === "BAIXA" || a.pendenciasNcm.length || !a.fontes.length || !a.descricaoNcm || !a.justificativa) pendencias.push(`Cenário ${s.nome}: NCM ainda sem fundamentação conclusiva. ${a?.pendenciasNcm.join("; ") ?? "Análise ausente"}`);
  justificativas.push(`Cenário NCM ${s.nome} (${s.id}), classificação ${versaoId}, selecionado pelas identidades das opções fotografadas.`, ...(a ? [a.justificativa, `Fundamento ${a.fundamento}; confiança ${a.confianca}; análise ${a.dataAnalise}.`, ...a.fontes.map(f => `Fonte da análise NCM: ${f}`)] : []));
  return { classificacao: { ...c, ncm: s.ncm, analiseNcm: a }, cenarioNcm, pendencias, justificativas };
}
