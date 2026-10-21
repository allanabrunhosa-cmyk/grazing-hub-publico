import { chavesDoGrupo, VALORES_FABRICA, type ChaveTokenDesign, type GrupoTokenDesign, type ValoresTemaParciais, type ValoresTemaResolvidos } from "./registro";
import { validarValoresTema } from "./validacao";

export function resolverTema(valores: unknown = {}): ValoresTemaResolvidos {
  return { ...VALORES_FABRICA, ...validarValoresTema(valores) };
}

export function restaurarToken(valores: ValoresTemaParciais, chave: ChaveTokenDesign): ValoresTemaParciais {
  const validos = validarValoresTema(valores);
  return Object.fromEntries(Object.entries(validos).filter(([atual]) => atual !== chave)) as ValoresTemaParciais;
}

export function restaurarGrupo(valores: ValoresTemaParciais, grupo: GrupoTokenDesign): ValoresTemaParciais {
  return chavesDoGrupo(grupo).reduce((atual, chave) => restaurarToken(atual, chave), valores);
}
