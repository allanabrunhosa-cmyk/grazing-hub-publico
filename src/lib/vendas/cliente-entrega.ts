import type { EntregaCliente, EntregaPadraoCliente } from "./dominio";
import { indiceEnderecoPostalDuplicado, pendenciaEnderecoPostal } from "./cliente-enderecos";

export const LIMITE_ENTREGAS_CLIENTE = 250;

/** Lê o livro novo e o endereço único legado, sem alterar o cadastro. */
export function entregasDoCliente(padrao: EntregaPadraoCliente | null | undefined): EntregaCliente[] {
  if (!padrao) return [];
  if (padrao.enderecos?.length) return padrao.enderecos;
  return [{ destinatario: padrao.destinatario, endereco: padrao.endereco, ...(padrao.textoOriginal ? { textoOriginal: padrao.textoOriginal } : {}) }];
}

export function indiceEntregaCliente(padrao: EntregaPadraoCliente | null | undefined): number {
  const lista = entregasDoCliente(padrao), indice = padrao?.selecionado ?? 0;
  return Number.isInteger(indice) && indice >= 0 && indice < lista.length ? indice : 0;
}

/** Um pedido antigo só seleciona uma opção quando destinatário e endereço coincidem. */
export function indiceEntregaCorrespondente(padrao: EntregaPadraoCliente | null | undefined, entrega: EntregaCliente): number | null {
  const chave = (valor: EntregaCliente) => JSON.stringify([
    ...["nome", "primeiroNome", "sobrenome", "contato"].map(campo => valor.destinatario[campo as keyof EntregaCliente["destinatario"]] ?? ""),
    ...["pais", "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "codigoMunicipio"].map(campo => valor.endereco[campo as keyof EntregaCliente["endereco"]] ?? ""),
  ]);
  const correspondentes = entregasDoCliente(padrao).flatMap((opcao, indice) => chave(opcao) === chave(entrega) ? [indice] : []);
  return correspondentes.length === 1 ? correspondentes[0] : null;
}

export function selecionarEntregaCliente(padrao: EntregaPadraoCliente | null | undefined, indice: number): EntregaPadraoCliente | null {
  const enderecos = entregasDoCliente(padrao);
  if (!Number.isInteger(indice) || !enderecos[indice]) return padrao ?? null;
  return { ...enderecos[indice], enderecos, selecionado: indice };
}

/** Atualiza somente a opção escolhida e conserva as outras opções do cadastro. */
export function atualizarEntregaCliente(padrao: EntregaPadraoCliente | null | undefined, entrega: EntregaCliente, indice = indiceEntregaCliente(padrao)): EntregaPadraoCliente {
  const enderecos = [...entregasDoCliente(padrao)];
  if (!Number.isInteger(indice) || indice < 0 || indice >= Math.max(1, enderecos.length)) throw new Error("Selecione um endereço de entrega cadastrado.");
  const atualizado = { ...enderecos[indice], ...entrega };
  enderecos[indice] = atualizado;
  return { ...atualizado, enderecos, selecionado: indice };
}

export function adicionarEntregaCliente(padrao: EntregaPadraoCliente | null | undefined, entrega: EntregaCliente): EntregaPadraoCliente {
  const anteriores = entregasDoCliente(padrao);
  if (anteriores.length >= LIMITE_ENTREGAS_CLIENTE) throw new Error(`Cadastre no máximo ${LIMITE_ENTREGAS_CLIENTE} endereços de entrega.`);
  conferirEntregaNova(anteriores, entrega);
  const enderecos = [...anteriores, entrega];
  return { ...entrega, enderecos, selecionado: enderecos.length - 1 };
}

function conferirEntregaNova(anteriores: EntregaCliente[], entrega: EntregaCliente, ignorarIndice?: number) {
  if (!entrega.destinatario.nome.trim()) throw new Error("Informe o nome do destinatário da entrega.");
  const pendencia = pendenciaEnderecoPostal(entrega.endereco);
  if (pendencia) throw new Error(pendencia);
  if (indiceEnderecoPostalDuplicado(anteriores.map(e => e.endereco), entrega.endereco, ignorarIndice) !== null) throw new Error("Este endereço postal de entrega já existe no cadastro.");
}

export function removerEntregaCliente(padrao: EntregaPadraoCliente | null | undefined, indice: number): EntregaPadraoCliente | null {
  const anteriores = entregasDoCliente(padrao);
  if (!Number.isInteger(indice) || !anteriores[indice]) return padrao ?? null;
  const enderecos = anteriores.filter((_, n) => n !== indice);
  if (!enderecos.length) return null;
  const atual = indiceEntregaCliente(padrao);
  const selecionado = Math.min(atual > indice ? atual - 1 : atual, enderecos.length - 1);
  return { ...enderecos[selecionado], enderecos, selecionado };
}

/** O rótulo usa somente o destinatário e os dados postais já presentes. */
export function rotuloEntregaCliente(entrega: EntregaCliente, indice: number): string {
  const e = entrega.endereco;
  const postal = [e.logradouro, e.numero, e.bairro, e.cidade, e.uf, e.cep].filter(Boolean).join(", ");
  return [`Entrega ${indice + 1}`, entrega.destinatario.nome, postal].filter(Boolean).join(" · ");
}
