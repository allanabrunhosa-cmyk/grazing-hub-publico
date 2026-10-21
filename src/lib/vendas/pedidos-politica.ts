// Contrato preenchível, sem escolher políticas ou categorias pela empresa.
export const eventosPoliticaPedidos = ["CONFIRMACAO", "ANTECIPACAO", "ENTREGA", "RECEBIMENTO", "REPASSE", "TAXA", "REVISAO", "CANCELAMENTO", "DEVOLUCAO", "RETENCAO", "CONCESSAO_CREDITO", "USO_CREDITO", "REVERSAO_CREDITO", "CONSUMO_CMV"] as const;
export type EventoPoliticaPedidos = typeof eventosPoliticaPedidos[number];
export type LinhaPoliticaPedidos = {
  evento: EventoPoliticaPedidos;
  situacao: "PENDENTE" | "PROPOSTO" | "APROVADO";
  politica: string | null; categoriaId: string | null; competencia: string | null;
  efeitoResultado: "PENDENTE" | "SEM_EFEITO" | "APROPRIAR";
  caixa: "PENDENTE" | "SEM_EFEITO" | "ENTRADA" | "SAIDA";
  referenciaOrigem: string | null; reversao: string | null;
  responsavel: string | null; aprovadoEm: string | null; vigencia: string | null;
};
export function matrizPoliticaPendente(): LinhaPoliticaPedidos[] {
  return eventosPoliticaPedidos.map(evento => ({ evento, situacao: "PENDENTE", politica: null, categoriaId: null, competencia: null, efeitoResultado: "PENDENTE", caixa: "PENDENTE", referenciaOrigem: null, reversao: null, responsavel: null, aprovadoEm: null, vigencia: null }));
}
export function validarMatrizPolitica(linhas: LinhaPoliticaPedidos[]) {
  return eventosPoliticaPedidos.flatMap(evento => {
    const encontradas = linhas.filter(l => l.evento === evento);
    if (encontradas.length !== 1) return [`${evento}: exige exatamente uma política.`];
    const l = encontradas[0];
    return l.situacao !== "APROVADO" || !l.politica?.trim() || !l.referenciaOrigem?.trim() || !l.reversao?.trim() || !l.responsavel?.trim() || !l.aprovadoEm || !l.vigencia || l.caixa === "PENDENTE" || l.efeitoResultado === "PENDENTE" || (l.efeitoResultado === "APROPRIAR" && (!l.categoriaId || !l.competencia)) ? [`${evento}: aprovação/classificação/reversão incompleta.`] : [];
  });
}
