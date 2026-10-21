import { UnidadeMedida } from "@/generated/prisma/browser";

export const MAXIMO_NOME_PORCAO = 120;
export const MAXIMO_UNIDADE_PORCAO = 100;
export const CASAS_DECIMAIS_PORCAO = 9;
export const MAXIMO_QUANTIDADE_PORCAO = "999999999.999999999";

export type PorcaoInsumoOption = {
  id: string;
  insumoId: string;
  nome: string;
  quantidade: string;
  unidade: UnidadeMedida;
  versao: number;
  quantidadeMedida?: string;
  unidadeMedida?: string;
};

export type SalvarPorcaoInput = {
  id?: string;
  versao?: number;
  insumoId: string;
  nome: string;
  quantidade: string;
  unidade: UnidadeMedida;
  quantidadeMedida?: string;
  unidadeMedida?: string;
};

/** Referência independente do catálogo, preservada ao editar/excluir uma porção. */
export type PorcaoComposicao = {
  quantidadeMedida: string;
  unidadeMedida: string;
  quantidadeInsumo: string;
  unidadeInsumo: UnidadeMedida;
  numeroPorcoes: string;
};

export function medidaPorcao(porcao: Pick<PorcaoInsumoOption, "nome" | "quantidadeMedida" | "unidadeMedida">) {
  if (porcao.quantidadeMedida && porcao.unidadeMedida) return { quantidadeMedida: porcao.quantidadeMedida, unidadeMedida: porcao.unidadeMedida };
  const partes = /^(\d{1,9}(?:[.,]\d{1,9})?)\s+(.+)$/u.exec(porcao.nome.trim());
  return { quantidadeMedida: partes?.[1].replace(",", ".") ?? "1", unidadeMedida: partes?.[2] ?? porcao.nome };
}

export function nomeMedidaPorcao(quantidade: string, unidade: string) {
  return `${quantidade.replace(".", ",")} ${unidade}`;
}

// Multiplicação decimal exata, compartilhada pelo navegador e servidor. Não arredonda estoque.
function multiplicarQuantidades(a: string, b: string): { quantidade: string } | { erro: string } {
  const entradaA = validarQuantidadePorcao(a), entradaB = validarQuantidadePorcao(b);
  if ("erro" in entradaA) return entradaA;
  if ("erro" in entradaB) return entradaB;
  const [ia, fa = ""] = entradaA.quantidade.split("."), [ib, fb = ""] = entradaB.quantidade.split(".");
  const produto = (BigInt(ia + fa) * BigInt(ib + fb)).toString().padStart(fa.length + fb.length + 1, "0");
  const escala = fa.length + fb.length;
  const resultado = escala ? `${produto.slice(0, -escala)}.${produto.slice(-escala).replace(/0+$/, "")}`.replace(/\.$/, "") : produto;
  const validado = validarQuantidadePorcao(resultado);
  return "erro" in validado ? { erro: "Essa quantidade de porções excede os limites de quantidade ou de 9 casas decimais. Revise a medida." } : validado;
}

export function calcularPorcao(porcao: PorcaoComposicao) {
  const insumo = multiplicarQuantidades(porcao.quantidadeInsumo, porcao.numeroPorcoes);
  if ("erro" in insumo) return insumo;
  const medida = multiplicarQuantidades(porcao.quantidadeMedida, porcao.numeroPorcoes);
  if ("erro" in medida) return medida;
  return { quantidade: insumo.quantidade, observacaoPorcao: nomeMedidaPorcao(medida.quantidade, porcao.unidadeMedida) };
}

export function selecionarPorcao(porcao: PorcaoInsumoOption): PorcaoComposicao {
  return { ...medidaPorcao(porcao), quantidadeInsumo: porcao.quantidade, unidadeInsumo: porcao.unidade, numeroPorcoes: "1" };
}

export function validarPorcaoComposicao(valor: unknown, quantidade: string, unidade?: string): { porcao: PorcaoComposicao | null } | { erro: string } {
  if (valor == null) return { porcao: null };
  if (typeof valor !== "object" || Array.isArray(valor)) return { erro: "Porção da composição inválida." };
  const d = valor as Record<string, unknown>;
  const qtd = validarQuantidadePorcao(d.quantidadeMedida), base = validarQuantidadePorcao(d.quantidadeInsumo), numero = validarQuantidadePorcao(d.numeroPorcoes);
  const un = validarNomePorcao(d.unidadeMedida);
  if ("erro" in qtd || "erro" in base || "erro" in numero || "erro" in un || un.nome.length > MAXIMO_UNIDADE_PORCAO) return { erro: "Informe uma medida e uma quantidade de porções válidas." };
  if (!Object.values(UnidadeMedida).includes(d.unidadeInsumo as UnidadeMedida) || (unidade && unidade !== d.unidadeInsumo)) return { erro: "A unidade da porção difere da unidade do ingrediente." };
  const porcao: PorcaoComposicao = { quantidadeMedida: qtd.quantidade, unidadeMedida: un.nome, quantidadeInsumo: base.quantidade, unidadeInsumo: d.unidadeInsumo as UnidadeMedida, numeroPorcoes: numero.quantidade };
  const calculada = calcularPorcao(porcao);
  if ("erro" in calculada) return calculada;
  const informada = validarQuantidadePorcao(quantidade);
  if ("erro" in informada || informada.quantidade !== calculada.quantidade) return { erro: "A quantidade do ingrediente não corresponde à quantidade de porções." };
  if (calculada.observacaoPorcao.length > MAXIMO_NOME_PORCAO) return { erro: "A medida resultante da porção é muito extensa." };
  return { porcao };
}

export function lerPorcaoComposicao(valor: unknown, quantidade: string, unidade?: string): PorcaoComposicao | null {
  const validada = validarPorcaoComposicao(valor, quantidade, unidade);
  return "erro" in validada ? null : validada.porcao;
}

export function normalizarNomePorcao(nome: string): string {
  return nome.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function validarNomePorcao(valor: unknown): { nome: string; nomeNormalizado: string } | { erro: string } {
  if (typeof valor !== "string" || /[\p{Cc}\p{Cf}]/u.test(valor)) return { erro: "Informe um nome de porção sem caracteres de controle." };
  const nome = valor.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!nome || nome.length > MAXIMO_NOME_PORCAO) return { erro: `O nome da porção deve ter de 1 a ${MAXIMO_NOME_PORCAO} caracteres.` };
  return { nome, nomeNormalizado: normalizarNomePorcao(nome) };
}

export function validarQuantidadePorcao(valor: unknown): { quantidade: string } | { erro: string } {
  if (typeof valor !== "string" || valor.length > 30) return { erro: "Informe uma quantidade válida para a porção." };
  const texto = valor.trim().replace(",", ".");
  if (!/^\d{1,9}(?:\.\d{1,9})?$/.test(texto) || !/[1-9]/.test(texto)) {
    return { erro: "Informe quantidade maior que zero, menor que 1 bilhão e com até 9 casas decimais." };
  }
  const [inteiro, decimal = ""] = texto.split(".");
  const fracao = decimal.replace(/0+$/, "");
  const quantidade = `${inteiro.replace(/^0+(?=\d)/, "")}${fracao ? `.${fracao}` : ""}`;
  // As composições ainda transportam number. Recusar valores que perderiam
  // dígitos nesse caminho, antes de persistir o Decimal exato no catálogo.
  const numeroTexto = Number(quantidade).toString();
  const [mantissa, expoente] = numeroTexto.split("e-");
  const retorno = expoente ? `0.${"0".repeat(Number(expoente) - 1)}${mantissa.replace(".", "")}` : numeroTexto;
  if (retorno !== quantidade) return { erro: "Quantidade excede a precisão suportada pela composição." };
  return { quantidade };
}

export function identificadorPorcaoValido(valor: unknown): valor is string {
  return typeof valor === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(valor);
}

export function validarPorcao(valor: unknown): { porcao: SalvarPorcaoInput & { nomeNormalizado: string } } | { erro: string } {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { erro: "Dados de porção inválidos." };
  const dados = valor as Record<string, unknown>;
  if (!identificadorPorcaoValido(dados.insumoId)) return { erro: "Escolha um insumo válido." };
  if (typeof dados.unidade !== "string" || !Object.values(UnidadeMedida).includes(dados.unidade as UnidadeMedida)) return { erro: "Unidade da porção inválida." };
  if (dados.id !== undefined && (!identificadorPorcaoValido(dados.id) || !Number.isSafeInteger(dados.versao) || Number(dados.versao) < 1)) return { erro: "Versão da porção inválida. Atualize a página." };
  const medida = dados.quantidadeMedida === undefined && dados.unidadeMedida === undefined
    ? medidaPorcao({ nome: typeof dados.nome === "string" ? dados.nome : "" })
    : { quantidadeMedida: dados.quantidadeMedida, unidadeMedida: dados.unidadeMedida };
  const quantidadeMedida = validarQuantidadePorcao(medida.quantidadeMedida);
  if ("erro" in quantidadeMedida) return { erro: "Informe uma quantidade positiva para a medida da porção, com até 9 casas decimais." };
  const unidadeMedida = validarNomePorcao(medida.unidadeMedida);
  if ("erro" in unidadeMedida || unidadeMedida.nome.length > MAXIMO_UNIDADE_PORCAO) return { erro: `Informe a unidade da porção com até ${MAXIMO_UNIDADE_PORCAO} caracteres.` };
  const nome = validarNomePorcao(dados.quantidadeMedida === undefined ? dados.nome : nomeMedidaPorcao(quantidadeMedida.quantidade, unidadeMedida.nome));
  if ("erro" in nome) return nome;
  const quantidade = validarQuantidadePorcao(dados.quantidade);
  if ("erro" in quantidade) return quantidade;
  return { porcao: { ...nome, ...quantidade, quantidadeMedida: quantidadeMedida.quantidade, unidadeMedida: unidadeMedida.nome, insumoId: dados.insumoId, unidade: dados.unidade as UnidadeMedida, ...(dados.id ? { id: dados.id as string, versao: dados.versao as number } : {}) } };
}
