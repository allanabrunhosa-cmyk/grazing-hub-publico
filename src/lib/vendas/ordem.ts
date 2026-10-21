import { ErroCadastroVenda, inteiro, texto } from "./dominio";

export type ReferenciaOrdem = { id: string; versao: number };
export function validarOrdem(entrada: unknown): ReferenciaOrdem[] {
  if (!Array.isArray(entrada) || entrada.length > 1000) throw new ErroCadastroVenda("Lista de ordenação inválida.");
  const itens = entrada.map(item => {
    if (!item || typeof item !== "object") throw new ErroCadastroVenda("Lista de ordenação inválida.");
    return { id: texto(item.id, "Identificador", 100, true), versao: inteiro(item.versao, "Versão") };
  });
  if (new Set(itens.map(i => i.id)).size !== itens.length) throw new ErroCadastroVenda("A lista contém itens repetidos.");
  return itens;
}
export function conferirOrdem(itens: ReferenciaOrdem[], atuais: ReferenciaOrdem[]) {
  if (itens.length !== atuais.length || atuais.some(a => !itens.some(i => i.id === a.id && i.versao === a.versao))) {
    throw new ErroCadastroVenda("A lista foi alterada em outra tela. Atualize antes de reordenar.");
  }
}
