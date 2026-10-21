import { chaveEnderecoPostal } from "./cliente-enderecos";

export type OpcaoPostalUnica<T> = { indiceOriginal: number; indicesOriginais: number[]; endereco: T };

/** Agrupa somente a apresentação. Conserva os objetos e índices da lista fotografada. */
export function projetarOpcoesPostaisUnicas<T>(enderecos: readonly T[], selecionado: number): {
  opcoes: OpcaoPostalUnica<T>[]; indiceOpcaoPorOriginal: number[];
} {
  const opcoes: OpcaoPostalUnica<T>[] = [], indiceOpcaoPorOriginal: number[] = [];
  const porChave = new Map<string, number>();
  for (const [indiceOriginal, endereco] of enderecos.entries()) {
    const chave = chaveEnderecoPostal(endereco);
    let indiceOpcao = chave === null ? undefined : porChave.get(chave);
    if (indiceOpcao === undefined) {
      indiceOpcao = opcoes.length;
      opcoes.push({ indiceOriginal, indicesOriginais: [], endereco });
      if (chave !== null) porChave.set(chave, indiceOpcao);
    }
    const opcao = opcoes[indiceOpcao];
    opcao.indicesOriginais.push(indiceOriginal);
    if (indiceOriginal === selecionado) { opcao.indiceOriginal = indiceOriginal; opcao.endereco = endereco; }
    indiceOpcaoPorOriginal.push(indiceOpcao);
  }
  return { opcoes, indiceOpcaoPorOriginal };
}
