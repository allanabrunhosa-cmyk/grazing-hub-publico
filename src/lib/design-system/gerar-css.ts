import { REGISTRO_TOKENS, type ChaveTokenDesign, type ValoresTemaResolvidos } from "./registro";
import { resolverTema } from "./resolver-tema";

export type DeclaracaoCssTema = { propriedade: `--${string}`; valor: string };

/** Serialização determinística exclusiva das propriedades registradas e validadas. */
export function declaracoesCssTema(valores: unknown = {}): DeclaracaoCssTema[] {
  const resolvidos = resolverTema(valores);
  return (Object.keys(REGISTRO_TOKENS) as ChaveTokenDesign[]).map(chave => ({
    propriedade: REGISTRO_TOKENS[chave].propriedadeCss,
    valor: resolvidos[chave],
  }));
}

export function gerarCssTema(valores: unknown = {}): string {
  const declaracoes = declaracoesCssTema(valores).map(({ propriedade, valor }) => `  ${propriedade}: ${valor};`).join("\n");
  return `:root {\n${declaracoes}\n}`;
}

export function variaveisCssTema(valores: ValoresTemaResolvidos): Record<`--${string}`, string> {
  return Object.fromEntries(declaracoesCssTema(valores).map(({ propriedade, valor }) => [propriedade, valor])) as Record<`--${string}`, string>;
}
