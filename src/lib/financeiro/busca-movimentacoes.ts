import type { MovimentoAgrupado } from "./agrupar-movimentacoes";

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

function valorDaBusca(termo: string) {
  let numero = termo.trim().replace(/^([+-]?)\s*R\$\s*/i, "$1").replace(/\s/g, "");
  const sinal = numero.startsWith("-") ? -1 : numero.startsWith("+") ? 1 : null;
  numero = numero.replace(/^[+-]/, "");
  // Vírgula é decimal; ponto pode ser decimal ou separador de milhares completo.
  if (/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(numero)) numero = numero.replaceAll(".", "").replace(",", ".");
  else if (/^\d{1,3}(?:\.\d{3})+$/.test(numero)) numero = numero.replaceAll(".", "");
  else if (!/^\d+(?:\.\d{1,2})?$/.test(numero)) return null;
  const centavos = Math.round(Number(numero) * 100);
  return Number.isSafeInteger(centavos) ? { centavos, sinal } : null;
}

/** Filtra grupos prontos; nunca recalcula parcela, composição ou saldo. */
export function correspondeBuscaMovimentacao(grupo: MovimentoAgrupado, busca: string): boolean {
  const termo = busca.trim();
  if (!termo) return true;
  const texto = [grupo.titulo, grupo.subtitulo, grupo.categoria, grupo.conta, ...grupo.linhas.flatMap(linha => [
    linha.descricao, linha.categoria, linha.conta, linha.contraparte,
    linha.lancamento?.notaFiscalItemDescricao, linha.lancamento?.fornecedorNome,
    linha.lancamento?.contraparteNome,
  ])].filter(Boolean).join(" ");
  if (normalizar(texto).includes(normalizar(termo))) return true;
  const valor = valorDaBusca(termo);
  return !!valor && [grupo.valor, ...grupo.linhas.map(linha => linha.valor)].some(numero =>
    Number.isFinite(numero) && Math.abs(Math.round(numero * 100)) === valor.centavos
      && (valor.sinal === null || Math.sign(numero) === valor.sinal));
}
