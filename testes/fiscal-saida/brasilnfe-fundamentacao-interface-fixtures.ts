import type { FundamentacaoFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/fundamentacao-dominio";
/** Fonte e decisão inteiramente sintéticas. Não usar para classificar produto ou aprovar regra real. */
export const fundamentoInterfaceFicticio: FundamentacaoFiscalBrasilNfe = {
  versao: 1,
  contexto: { uf: "SP", regime: "SIMPLES_NACIONAL", regimeConfirmado: true, operacao: "NF_E_VENDA", origem: "NAO_APLICAVEL", naturezaProduto: "Complementos de emitente exclusivamente fictício para teste de interface." },
  fontes: [{ id: "fonte-ficticia", tipo: "NORMA_OFICIAL", titulo: "Norma exclusivamente fictícia de teste", referencia: "Referência sintética de interface", uri: "https://www.example.org/norma-sintetica", consultadoEm: "2026-10-11", trechoAplicavel: "Trecho inteiramente fictício para testar o vínculo entre fonte e campo de emitente.", limitesAplicabilidade: "Fonte apenas da suíte sintética; não fundamenta qualquer classificação ou emissão real." }],
  justificativa: "Decisão exclusivamente sintética para verificar formulário e confirmação administrativa.",
  limitesAplicabilidade: "Somente testes de interface sem transmissão, banco administrativo ou regra fiscal real.",
  elaboradoEm: "2026-10-11",
  confianca: [{ campo: "EMITENTE", estado: "COMPROVADO", fontes: ["fonte-ficticia"], justificativa: "Justificativa fictícia do campo de emitente, vinculada à fonte sintética da suíte." }],
};
