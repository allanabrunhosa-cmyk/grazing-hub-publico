import { REGISTRO_TOKENS, VALORES_FABRICA, type ChaveTokenDesign, type ValoresTemaParciais } from "./registro";

export class ErroValidacaoTema extends Error {}

export function ehChaveTokenDesign(valor: string): valor is ChaveTokenDesign {
  return Object.hasOwn(REGISTRO_TOKENS, valor);
}

export function contrasteHex(a: string, b: string) {
  const luminancia = (hex: string) => {
    const canais = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return canais[0] * 0.2126 + canais[1] * 0.7152 + canais[2] * 0.0722;
  };
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Regras de publicação combinadas; prévia pode explorar uma opção rejeitada sem gravá-la. */
export function validarPublicacaoTema(entrada: unknown) {
  const valores = { ...VALORES_FABRICA, ...validarValoresTema(entrada) };
  const pares = [["cor.hub.primariaClara", "#ffffff"], ["cor.hub.primariaEscura", "#0b1d37"], ["cor.etiquetas.primariaClara", "#ffffff"], ["cor.etiquetas.primariaEscura", "#32190c"]] as const;
  for (const [chave, texto] of pares) if (contrasteHex(valores[chave], texto) < 4.5) throw new ErroValidacaoTema(`Contraste insuficiente em ${REGISTRO_TOKENS[chave].rotulo}. Escolha outra cor.`);
  if (parseFloat(valores["controle.alturaCompacta"]) > parseFloat(valores["controle.altura"])) throw new ErroValidacaoTema("A altura compacta não pode exceder a altura padrão.");
  if (valores["vidro.desfoque"] === "0px" && Number(valores["vidro.opacidade"]) < 0.86) throw new ErroValidacaoTema("Vidro sem desfoque exige opacidade de pelo menos 0.86 para preservar a leitura.");
  return valores;
}

/** Rejeita chaves e valores fora do registro, inclusive qualquer fragmento de CSS livre. */
export function validarValoresTema(entrada: unknown): ValoresTemaParciais {
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) throw new ErroValidacaoTema("Valores visuais inválidos.");
  const resultado: ValoresTemaParciais = {};
  for (const [chave, valor] of Object.entries(entrada)) {
    if (!ehChaveTokenDesign(chave) || typeof valor !== "string" || !(REGISTRO_TOKENS[chave].opcoes as readonly string[]).includes(valor)) {
      throw new ErroValidacaoTema("Propriedade visual desconhecida ou fora dos limites.");
    }
    resultado[chave] = valor;
  }
  return resultado;
}
