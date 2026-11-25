import type { CenarioNcmCalculado, ClassificacaoFiscal, ItemComercialFiscal, MateriaisFiscaisFotografados } from "./tipos";
import { hashOpcaoTecnica, type FotografiaReceitaFiscal } from "./fotografia-tecnica";
import { Prisma } from "@/generated/prisma/client";

/** Confere os materiais analisados contra o pedido ou o cadastro atual, para fins de NCM.
 * Insumo sem composição própria carrega no selo somente a identificação do cadastro
 * (marca, marcas homologadas, EAN, especificação): trocar a marca não altera a mercadoria
 * final nem seu NCM. Preparações continuam conferidas pelo selo de toda a sua receita,
 * e incluir, retirar ou trocar um material sempre diverge. */
export function materiaisCorrespondem(analisados: MateriaisFiscaisFotografados | undefined, outros: MateriaisFiscaisFotografados | undefined) {
  if (!analisados || !outros || !Array.isArray(analisados.insumos) || !Array.isArray(outros.insumos) || analisados.insumos.length !== outros.insumos.length) return false;
  return analisados.insumos.every(a => { const b = outros.insumos.find(x => x.insumoId === a.insumoId); return !!b && a.transitiva === b.transitiva && (!a.transitiva || a.hash === b.hash); });
}

/** Aviso não impeditivo: a composição mudou depois da análise. O NCM vigente é mantido e
 * só muda por nova versão da classificação, ato explícito do responsável fiscal. */
export const REVISAO_NCM_PENDENTE = "composição alterada desde a análise fiscal; NCM atual mantido até a revisão do responsável.";

/** Seleção exata por identidade comercial fotografada; não há prioridade, regex ou código padrão implícito. */
export function resolverNcmConfiguracao(c: ClassificacaoFiscal, escolhas: ItemComercialFiscal["escolhas"], versaoId: string, receitaFotografada?: ItemComercialFiscal["receitaFotografada"], tecnicaAtual?: FotografiaReceitaFiscal) {
  const cfg = c.configuracaoNcm;
  const pendencias: string[] = [], justificativas: string[] = [], revisoes: string[] = [];
  const revisar = () => { if (!revisoes.length) revisoes.push(REVISAO_NCM_PENDENTE); };
  let cenarioNcm: CenarioNcmCalculado | undefined;
  const bloquear = (motivo: string) => ({ classificacao: { ...c, ncm: null }, cenarioNcm, pendencias: [motivo], justificativas, revisoes: [] as string[] });
  if (c.receitaFiscalDocumentada && (!receitaFotografada?.documentacaoHash || !tecnicaAtual?.documentacaoHash)) return bloquear("Receita fiscal documentada exige fotografia própria no pedido e comprovação atual; não reconstruir a venda histórica pela CMV vigente.");
  if (receitaFotografada?.comprovacaoParcial && (!cfg || !c.baseSemIngredientesComprovada || !receitaFotografada.comprovacaoParcial.baseSemIngredientes || escolhas.some(e => !receitaFotografada.comprovacaoParcial!.opcaoIdsComComposicao.includes(e.opcaoId)))) return bloquear("Pedido com composição de estoque pendente exige ausência de base documentada e prova física das escolhas; nenhuma receita omitida é presumida vazia.");
  if (!cfg) {
    // Prova ausente continua impeditiva; prova presente e diferente vira revisão pendente.
    if (c.fotografiaTecnica && receitaFotografada?.materiais && tecnicaAtual?.materiais && (c.fotografiaTecnica.principalHash !== receitaFotografada.principalHash || c.fotografiaTecnica.principalHash !== tecnicaAtual.principalHash || !materiaisCorrespondem(c.fotografiaTecnica.materiais, receitaFotografada.materiais.principal) || !materiaisCorrespondem(c.fotografiaTecnica.materiais, tecnicaAtual.materiais.principal))) revisar();
    else if (c.fotografiaTecnica && (!receitaFotografada?.materiais || !tecnicaAtual?.materiais)) return bloquear("Receita material/transitiva ou identificação física não corresponde à análise e ao snapshot do pedido; revisar somente esta mercadoria, sem reescrever documentos anteriores.");
    if (c.analiseNcm && c.ncmAplicabilidade === "APLICAVEL" && escolhas.some(e => receitaFotografada?.opcaoHashes.find(h => h.opcaoId === e.opcaoId)?.hash !== hashOpcaoTecnica(e.produtoId, []))) return bloquear("Ingrediente incluído ou adicional integrado altera a composição sem cenário NCM fundamentado; analisar esta combinação antes de emitir.");
    return { classificacao: c, cenarioNcm, pendencias, justificativas, revisoes };
  }
  const tecnica = cfg.fotografiaTecnica;
  if (!tecnica || tecnica.algoritmo !== "grazing.receita-fiscal.v1") return bloquear("Classificação por configuração sem fotografia técnica registrada pelo servidor; salvar nova versão fundamentada.");
  if (!receitaFotografada || !tecnicaAtual) return bloquear("Composição técnica do pedido ou do cadastro atual não comprovada para resolver o cenário NCM.");
  if (tecnica.principalHash !== receitaFotografada.principalHash || tecnica.principalHash !== tecnicaAtual.principalHash) revisar();
  if (tecnica.materiais && receitaFotografada.materiais && tecnicaAtual.materiais) { if (!materiaisCorrespondem(tecnica.materiais.principal, receitaFotografada.materiais.principal) || !materiaisCorrespondem(tecnica.materiais.principal, tecnicaAtual.materiais.principal)) revisar(); }
  else if (tecnica.materiais) return bloquear("Receita transitiva do principal diverge da análise; snapshot histórico sem essa prova exige conferência da operação afetada.");
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
    // Todas as opções do grupo têm o mesmo NCM documentado: escolher mais ou menos sabores do
    // que a análise previu não troca o NCM. A nota segue e a revisão fica para o responsável.
    const foraDosLimites = total.lt(g.quantidadeMinima) || total.gt(g.quantidadeMaxima);
    if (foraDosLimites) revisar();
    if (new Set(es.map(e => e.opcaoId)).size !== es.length) return bloquear("Escolhas equivalentes repetidas no snapshot; conferir a configuração.");
    justificativas.push(`Equivalência NCM documentada do grupo ${g.grupoId}; quantidade ${total.toString()} ${foraDosLimites ? "fora" : "dentro"} de ${g.quantidadeMinima}–${g.quantidadeMaxima}${foraDosLimites ? ", NCM mantido com revisão pendente" : ""}.`, g.analiseNcm.justificativa, ...g.analiseNcm.fontes.map(f => `Fonte da equivalência NCM: ${f}`));
  }
  for (const id of [...ids, ...idsEquivalentes]) {
    const hash = tecnica.opcaoHashes.find(h => h.opcaoId === id)?.hash;
    const hashPedido = receitaFotografada.opcaoHashes.find(h => h.opcaoId === id)?.hash, hashAtual = tecnicaAtual.opcaoHashes.find(h => h.opcaoId === id)?.hash;
    if (!hash || !hashPedido || !hashAtual) return bloquear(`Composição da opção ${id} não comprovada na análise, no pedido ou no cadastro atual; salvar nova classificação para este ramo.`);
    if (hash !== hashPedido || hash !== hashAtual) revisar();
    if (tecnica.materiais) {
      const mat = tecnica.materiais.opcoes.find(m => m.opcaoId === id)?.materiais;
      const matPedido = receitaFotografada.materiais?.opcoes.find(m => m.opcaoId === id)?.materiais, matAtual = tecnicaAtual.materiais?.opcoes.find(m => m.opcaoId === id)?.materiais;
      if (!mat || !matPedido || !matAtual) return bloquear(`Receita transitiva da opção ${id} não comprovada na análise, no pedido ou no cadastro atual; revisar somente este ramo.`);
      if (!materiaisCorrespondem(mat, matPedido) || !materiaisCorrespondem(mat, matAtual)) revisar();
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
    return { classificacao: c, cenarioNcm, pendencias, justificativas, revisoes };
  }
  const compativeis = cfg.cenarios.filter(s => s.opcaoIds.length === ids.length && s.opcaoIds.every(id => ids.includes(id) && new Prisma.Decimal(s.quantidadesEscolhidas?.find(q => q.opcaoId === id)?.quantidade ?? "1").equals(selecionadas.find(e => e.opcaoId === id)!.quantidadeEscolhida ?? "1")));
  if (compativeis.length !== 1) return bloquear(compativeis.length ? "Mais de um cenário NCM corresponde às escolhas; corrigir a ambiguidade antes de emitir." : "Combinação de escolhas sem cenário NCM fundamentado; somente esta operação exige classificação complementar.");
  const s = compativeis[0], a = s.analiseNcm;
  cenarioNcm = { id: s.id, nome: s.nome, opcaoIds: [...ids, ...idsEquivalentes].sort(), classificacaoVersaoId: versaoId };
  if (!s.ncm || !a || a.confianca === "BAIXA" || a.pendenciasNcm.length || !a.fontes.length || !a.descricaoNcm || !a.justificativa) pendencias.push(`Cenário ${s.nome}: NCM ainda sem fundamentação conclusiva. ${a?.pendenciasNcm.join("; ") ?? "Análise ausente"}`);
  justificativas.push(`Cenário NCM ${s.nome} (${s.id}), classificação ${versaoId}, selecionado pelas identidades das opções fotografadas.`, ...(a ? [a.justificativa, `Fundamento ${a.fundamento}; confiança ${a.confianca}; análise ${a.dataAnalise}.`, ...a.fontes.map(f => `Fonte da análise NCM: ${f}`)] : []));
  return { classificacao: { ...c, ncm: s.ncm, analiseNcm: a }, cenarioNcm, pendencias, justificativas, revisoes };
}
