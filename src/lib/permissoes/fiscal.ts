/** A central agrega blocos; cada bloco e cada escrita conservam sua própria guarda. */
export const RECURSOS_CONFIGURACAO_FISCAL = ["financeiro.fiscal.painel", "vendas.fiscal", "configuracoes.brasilnfe", "configuracoes.loja", "financeiro.fiscal.numeracao"] as const;
/** Operações das notas de venda. Cadastros fiscais (`vendas.fiscal`) e integração (`configuracoes.brasilnfe`) não as concedem. */
export const RECURSO_EMISSAO_FISCAL = "financeiro.fiscal.emissao";
export const RECURSO_CANCELAMENTO_FISCAL = "financeiro.fiscal.cancelamento";
export const RECURSO_NUMERACAO_FISCAL = "financeiro.fiscal.numeracao";
