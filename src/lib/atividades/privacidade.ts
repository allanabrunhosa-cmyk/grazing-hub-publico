// Lista fechada: nunca percorrer objetos de auditoria nem serializar payloads completos.
export const CAMPOS_PERMITIDOS = [
  "ativo", "status", "tipo", "perfilAcessoId", "versao", "versaoAnterior", "versaoNova",
  "unidadeUso", "quantidade", "quantidadeAtual", "saldoAnterior", "saldoNovo",
  "valor", "valorTotal", "custoUnitario", "custoMedio", "preco", "precoBase",
  "dataCompetencia", "dataVencimento", "dataPagamento", "dataEntrega", "horarioEntrega", "vigenciaInicio",
  "statusOperacional", "categoriaId", "localId", "contaBancariaId", "camposAlterados", "itens", "ajustes", "contado",
  "total", "credito", "recebido", "saldo", "valorOriginal", "valorAnterior", "valorBruto", "valorLiquidoConciliado",
  "taxa", "pagamentosPreservados", "parcelasCliente", "previsaoRepasse", "baixasPreservadas",
] as const;
const FINANCEIROS = new Set(["valor", "valorTotal", "custoUnitario", "custoMedio", "preco", "precoBase", "contaBancariaId",
  "total", "credito", "recebido", "saldo", "valorOriginal", "valorAnterior", "valorBruto", "valorLiquidoConciliado", "taxa", "pagamentosPreservados", "parcelasCliente", "previsaoRepasse"]);
export function diferencasPermitidas(valor: unknown, incluirFinanceiros = false): Record<string, string | number | boolean | null> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const saida: Record<string, string | number | boolean | null> = {};
  for (const campo of CAMPOS_PERMITIDOS) {
    if (!incluirFinanceiros && FINANCEIROS.has(campo)) continue;
    const v = (valor as Record<string, unknown>)[campo];
    if (v === null || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v))) saida[campo] = v;
    else if (v instanceof Date) saida[campo] = v.toISOString();
    else if (typeof v === "string" && v.length <= 160 && !/[\u0000-\u001f]/.test(v)) saida[campo] = v;
  }
  return saida;
}
export function alteracoesPermitidas(antes: unknown, depois: unknown, incluirFinanceiros = false) {
  const a = diferencasPermitidas(antes, incluirFinanceiros), d = diferencasPermitidas(depois, incluirFinanceiros);
  return [...new Set([...Object.keys(a), ...Object.keys(d)])].filter(c => a[c] !== d[c]).map(campo => ({
    campo, antes: a[campo] == null ? "—" : String(a[campo]), depois: d[campo] == null ? "—" : String(d[campo]),
  }));
}
