import { correspondeBuscaValor } from "@/lib/busca-valor";
import type { MovimentoAgrupado } from "./agrupar-movimentacoes";

const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

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
  return correspondeBuscaValor(termo, grupo.valor, ...grupo.linhas.map(linha => linha.valor));
}
