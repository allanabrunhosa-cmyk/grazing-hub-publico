import type { FiltrosBi } from "./bi-types";
import { ErroBi } from "./bi-filtros";

const chaves = ["de", "ate", "baseData", "canal", "categoria", "produto", "cliente", "regiao", "modalidade", "origem", "comparacao", "agrupamento", "metrica", "ranking", "aba", "pagina", "diasSemRecompra", "somenteConfirmados", "somenteSemRecompra", "tipoCliente", "ordemProdutos", "ordemClientes", "ordemEntregas", "direcaoProdutos", "direcaoClientes", "direcaoEntregas", "agrupamentoRegiao", "cepDe", "cepAte"] as const;

/** A URL é entrada não confiável. A validação de domínio continua no servidor. */
export function entradaBiDaUrl(entrada: Record<string, string | string[] | undefined>): Partial<FiltrosBi> {
  const resultado: Record<string, string | number | boolean> = {};
  for (const chave of chaves) {
    const valor = entrada[chave];
    if (typeof valor !== "string") continue;
    if ((chave === "pagina" || chave === "diasSemRecompra") && valor !== "" &&
      (!/^\d+$/u.test(valor) || valor.length > (chave === "pagina" ? 6 : 4))) {
      throw new ErroBi("Há um filtro numérico inválido.");
    }
    resultado[chave] = chave === "pagina" || chave === "diasSemRecompra" ? Number(valor)
      : chave === "somenteConfirmados" || chave === "somenteSemRecompra" ? valor === "true" || valor === "1" : valor;
  }
  return resultado as Partial<FiltrosBi>;
}
