import { extrairCustosNFe } from "@/lib/sefaz/custosNFe";
import { calcularCustosNota, centavos, lerComposicaoCusto, type ComposicaoCusto, type DistribuicaoDesconto } from "./custos";

type RegistroItem = { id: string; numeroItem: number; status: string; composicaoCusto?: unknown };
type EntradaItem = { notaFiscalItemId: string; acao: string; valorTotal?: number };

// Validação compartilhada pelo pré-aceite fiscal e pela gravação sob trava da nota.
export function validarCustosConciliacao(xml: string | null, registros: RegistroItem[], entradas: EntradaItem[], distribuicao?: DistribuicaoDesconto): { erro: string } | { composicoes: Map<string, ComposicaoCusto> } {
  const composicoes = new Map<string, ComposicaoCusto>();
  if (!xml && !distribuicao) return { composicoes };
  let custos;
  try { custos = extrairCustosNFe(xml ?? ""); }
  catch { return { erro: "Não foi possível conferir os custos no XML. Reabra a nota." }; }
  if (!distribuicao) {
    const temCustos = custos.itens.some(item => item.frete || item.ipi || item.seguro || item.outrasDespesas || item.outrosTributos || item.abatimentos || item.desconto) || custos.desconto || custos.frete || custos.ipi;
    return temCustos ? { erro: "Reabra a nota para conferir frete, impostos e descontos antes de aceitar." } : { composicoes };
  }
  const calculado = calcularCustosNota(custos, distribuicao);
  if ("erro" in calculado) return calculado;
  if (centavos(calculado.total) !== centavos(custos.totalNota)) return { erro: "A composição dos produtos difere do total do XML. Confira os custos da nota antes do aceite." };
  if (registros.length !== custos.itens.length) return { erro: "Os itens da nota mudaram. Reabra o painel." };
  for (const registro of registros) {
    const composicao = calculado.itens.find(item => item.numeroItem === registro.numeroItem);
    if (!composicao) return { erro: "Não foi possível conferir um produto no XML." };
    if (registro.status !== "PENDENTE") {
      const anterior = lerComposicaoCusto(registro.composicaoCusto);
      const descontoAnterior = anterior?.desconto ?? custos.itens.find(item => item.numeroItem === registro.numeroItem)!.desconto;
      if (centavos(composicao.desconto) !== centavos(descontoAnterior)) return { erro: "O desconto de um item já conciliado não pode ser redistribuído." };
      continue;
    }
    const entrada = entradas.find(item => item.notaFiscalItemId === registro.id);
    if (!entrada || entrada.acao !== "CONCILIAR" || entrada.valorTotal == null || centavos(entrada.valorTotal) !== centavos(composicao.total)) return { erro: "O custo dos produtos foi alterado. Confira a distribuição do desconto e reabra a nota." };
    composicoes.set(registro.id, composicao);
  }
  return { composicoes };
}
