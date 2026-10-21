import type { PedidoRow } from "@/app/(protegido)/compras/types";
import { formatarNumeroPedido } from "@/app/(protegido)/compras/types";
import { unidadeMedidaAbreviada } from "@/lib/labels";
import { descreverConversao, descreverEquivalencia } from "@/lib/insumos/conversoes";

function escapar(texto: string) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const data = (valor: string) => {
  const dia = valor.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia.split("-").reverse().join("/") : "Não informada";
};
const quantidade = (valor: number) => valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const moeda = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// A largura útil de 72 mm cabe nas térmicas de bobina de 80 mm. O tamanho da
// página vem do driver da impressora: não impor altura A4 nem cortar pedidos longos.
export function gerarDocumentoPedidoTermico(pedido: PedidoRow): string {
  const itens = pedido.itens.filter(i => i.quantidade > 0).map(i => {
    const conversao = i.fatorConversao != null && i.unidadePrincipal && i.unidadeCompra !== i.unidadePrincipal;
    return `<li class="item">
      <h2>${escapar(i.insumoNome)}</h2>
      ${i.insumoEspecificacao ? `<p class="conversao">${escapar(i.insumoEspecificacao)}</p>` : ""}
      <div class="valores"><strong>${quantidade(i.quantidade)} ${escapar(unidadeMedidaAbreviada[i.unidadeCompra])}</strong><span>${i.precoUnitario != null ? `${moeda(i.precoUnitario)} / ${escapar(unidadeMedidaAbreviada[i.unidadeCompra])}` : "Valor não informado"}</span></div>
      ${conversao ? `<p class="conversao">${escapar(descreverConversao({ unidade: i.unidadeCompra, fator: i.fatorConversao! }, i.unidadePrincipal!))}<br>Total: ${escapar(descreverEquivalencia(i.quantidade, i.fatorConversao!, i.unidadePrincipal!))}</p>` : ""}
    </li>`;
  }).join("");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pedido ${escapar(formatarNumeroPedido(pedido.numero))}</title>
<style>
  @page { size: auto; margin: 4mm; }
  * { box-sizing: border-box; }
  html { color-scheme: light; }
  body { margin: 0; color: #000; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.3; }
  .comprovante { width: 72mm; max-width: 100%; margin: 0; }
  p, h1, h2 { margin: 0; }
  .marca { text-align: center; font-size: 8pt; letter-spacing: .4pt; margin-bottom: 2mm; }
  .fornecedor { background: #000 !important; color: #fff !important; padding: 3mm 2mm; text-align: center; font-size: 18pt; font-weight: 800; line-height: 1.15; overflow-wrap: anywhere; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .identificacao { margin: 2mm 0 3mm; text-align: center; font-size: 8pt; }
  .entrega { padding: 2mm 0; border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 11pt; font-weight: 700; }
  .rotulos { display: flex; justify-content: space-between; gap: 2mm; margin-top: 3mm; font-size: 7pt; }
  ol { list-style: none; padding: 0; margin: 0; }
  .item { padding: 3mm 0; border-bottom: 1px dashed #000; break-inside: avoid; page-break-inside: avoid; }
  .item h2 { font-size: 11pt; font-weight: 700; overflow-wrap: anywhere; }
  .valores { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 1mm 3mm; margin-top: 1.5mm; font-variant-numeric: tabular-nums; }
  .valores strong { font-size: 12pt; }
  .valores span { font-size: 9pt; }
  .conversao { margin-top: 1.5mm; font-size: 8pt; overflow-wrap: anywhere; }
  .observacoes { margin-top: 3mm; font-size: 10pt; overflow-wrap: anywhere; white-space: pre-wrap; }
  footer { border-top: 1px solid #000; margin-top: 4mm; padding-top: 2mm; text-align: center; font-size: 8pt; }
  header { break-inside: avoid; page-break-inside: avoid; }
  @media screen { body { padding: 4mm; } }
  @media print { body { padding: 0; } .nao-imprimir { display: none !important; } }
</style></head><body><article class="comprovante">
  <header><p class="marca">GRAZING HUB · PEDIDO DE COMPRA</p>
    <h1 class="fornecedor">${escapar(pedido.fornecedorNome)}</h1>
    <p class="identificacao">${escapar(formatarNumeroPedido(pedido.numero))} · Pedido em ${data(pedido.dataPedido)}</p>
    <p class="entrega">Entrega: ${pedido.previsaoEntrega ? data(pedido.previsaoEntrega) : "A combinar"}</p>
  </header>
  <div class="rotulos"><span>ITEM / QUANTIDADE</span><span>VALOR UNITÁRIO</span></div>
  <ol>${itens}</ol>
  ${pedido.observacoes ? `<p class="observacoes"><strong>OBSERVAÇÕES</strong><br>${escapar(pedido.observacoes)}</p>` : ""}
  <footer>Conferir os itens no recebimento.</footer>
</article></body></html>`;
}
