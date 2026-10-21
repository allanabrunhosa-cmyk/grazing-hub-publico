/** TString do leiaute NF-e: texto Latin-1, sem espaços nas extremidades. */
export const PADRAO_DESCRICAO_PRODUTO_NFE = /^[\u0021-\u00ff](?:[\u0020-\u00ff]*[\u0021-\u00ff])?$/;

/** Normaliza somente a representação fiscal. Não modifica o nome do cadastro. */
export function descricaoProdutoNfe(valor: string): string {
  return valor.normalize("NFC")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/[\u200b\u2060\ufeff]/g, "")
    .replace(/\s+/gu, " ").trim().slice(0, 120).trim();
}

export type MotivoValidacaoXmlNfe = "DESCRICAO_PRODUTO";
/** Somente uma categoria local atravessa a fronteira. Texto/XML externo é descartado. */
export function motivoValidacaoXmlNfe(valor: unknown): MotivoValidacaoXmlNfe | undefined {
  return typeof valor === "string" && valor.length <= 10000 && /\bxProd\b/.test(valor)
    && /(?:valida[çc][aã]o\s+XML|schema|pattern\s+constraint)/i.test(valor) ? "DESCRICAO_PRODUTO" : undefined;
}

export function mensagemRejeicaoXmlNfe(motivo?: MotivoValidacaoXmlNfe): string {
  return motivo === "DESCRICAO_PRODUTO"
    ? "O emissor rejeitou a descrição de um produto (xProd): há caracteres incompatíveis com o XML fiscal. Atualize a preparação fiscal para normalizar a descrição e tente novamente. A nota não foi autorizada."
    : "O emissor rejeitou a validação do XML antes da autorização. Revise os dados fiscais e prepare uma nova tentativa. A nota não foi autorizada.";
}
