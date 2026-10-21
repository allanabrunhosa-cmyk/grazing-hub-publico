export type FormatoComanda = "80mm" | "A4";
export type DadosComandaPedido = {
  numero: number; versao?: number; titulo: string; situacao: string;
  inicioPreparo?: string | null;
  data: string | null; horario: string | null; atendimento?: string | null;
  comprador?: string; destinatario?: string | null; endereco?: string;
  referencia?: string | null; geradoEm?: string; observacoes?: string | null;
  itens: { nome: string; quantidade: string; unidade?: string; escolhas: string[]; observacoes?: string | null }[];
  revisoes?: { versao: number; descricao: string }[]; rodape: string;
};
const escapar = (valor: unknown) => String(valor ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const dataCivil = (valor: string | null) => valor && /^\d{4}-\d{2}-\d{2}/.test(valor) ? valor.slice(0, 10).split("-").reverse().join("/") : "Sem data";
const observacao = (texto?: string | null) => texto?.trim() ? `<p class="observacao destaque"><strong>OBS.:</strong> ${escapar(texto)}</p>` : "";

// Bobina de 80 mm, área útil de 72 mm. A altura contínua vem do driver:
// `size: 80mm auto` não é uma dimensão válida de @page no navegador.
export function htmlComandaPedido(p: DadosComandaPedido, formato: FormatoComanda = "80mm") {
  const termica = formato === "80mm";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pedido #${escapar(p.numero)}</title><style>
@page{size:${termica ? "auto" : "A4"};margin:${termica ? "4mm" : "12mm"}}
*{box-sizing:border-box}html{color-scheme:light}body{margin:0;color:#000;background:#fff;font-family:"Courier New",monospace;font-size:9pt;line-height:1.3}
.comanda{width:${termica ? "72mm" : "186mm"};max-width:100%;margin:0}p,h1,h2{margin:0;overflow-wrap:anywhere}p{white-space:pre-wrap}
header{break-inside:avoid;page-break-inside:avoid}.marca,.identificacao{text-align:center;font-size:8pt;margin-bottom:2mm}
.destaque{color:#fff!important;background:#000!important;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact;border:1px solid #000}
.numero{text-align:center;font-size:30pt;line-height:1.1;padding:2mm;margin:2mm 0;overflow-wrap:anywhere}
.situacao{text-align:center;padding:1mm;margin:2mm 0}.entrega{padding:1.5mm;margin:2mm 0;font-size:11pt}
.cliente{margin:3mm 0;padding:2mm 0;border-top:1px dashed #000;border-bottom:1px dashed #000}.cliente p+p{margin-top:1mm}
.itens-titulo{font-size:9pt;font-weight:400;margin:3mm 0 1mm;padding-top:2mm;border-top:1px dashed #000}
ol{list-style:none;margin:0;padding:0}.item{padding:2mm 0;border-bottom:1px dashed #000;break-inside:avoid;page-break-inside:avoid}
.produto{display:flex;align-items:baseline;gap:2mm}.quantidade{display:inline-block;flex:none;padding:0 1mm;font-size:10pt;max-width:40%;overflow-wrap:anywhere}.nome{min-width:0;overflow-wrap:anywhere}
.complemento{margin:1mm 0 0 2mm;font-size:8pt}.observacao{margin-top:1.5mm;padding:1mm;white-space:pre-wrap;overflow-wrap:anywhere}
.revisao{margin-top:2mm;border-top:1px dashed #000;padding-top:2mm}footer{margin-top:3mm;border-top:1px dashed #000;padding-top:2mm;font-size:7pt}
@media screen{body{padding:4mm}}@media print{body{padding:0}}
</style></head><body><article class="comanda"><header><p class="marca">GRAZING TABLE &amp; CO<br>${escapar(p.titulo)}</p><h1 class="numero destaque">#${escapar(p.numero)}</h1>${p.versao !== undefined ? `<p class="identificacao">versão ${escapar(p.versao)}</p>` : ""}<p class="situacao destaque">${escapar(p.situacao)}</p>${p.referencia ? `<p>Referência: ${escapar(p.referencia)}</p>` : ""}${p.geradoEm ? `<p>Gerada em ${escapar(p.geradoEm)}</p>` : ""}<p class="entrega destaque">${p.atendimento === "RETIRADA" ? "Retirada" : p.atendimento === "LOCAL" ? "Consumo no local" : "Entrega"}: ${escapar(dataCivil(p.data))}<br>Horário: ${escapar(p.horario ?? "Sem horário")}</p>${p.inicioPreparo ? `<p>Início de preparo iFood: ${escapar(p.inicioPreparo)}</p>` : ""}</header>${p.comprador || p.destinatario || p.endereco ? `<section class="cliente">${p.comprador ? `<p>Cliente: ${escapar(p.comprador)}</p>` : ""}${p.destinatario ? `<p>Destinatário: ${escapar(p.destinatario)}</p>` : ""}${p.endereco ? `<p>Endereço: ${escapar(p.endereco)}</p>` : ""}</section>` : ""}${observacao(p.observacoes)}<h2 class="itens-titulo">ITENS DO PEDIDO (${p.itens.length})</h2><ol>${p.itens.map(i => `<li class="item"><p class="produto"><strong class="quantidade destaque">${escapar(i.quantidade.replace(".", ","))}${i.unidade ? ` ${escapar(i.unidade)}` : " ×"}</strong><strong class="nome">${escapar(i.nome)}</strong></p>${i.escolhas.map(e => `<p class="complemento">${escapar(e)}</p>`).join("")}${observacao(i.observacoes)}</li>`).join("")}</ol>${(p.revisoes ?? []).map(r => `<p class="revisao"><strong>Revisão ${escapar(r.versao)}</strong>: ${escapar(r.descricao)}</p>`).join("")}<footer>${escapar(p.rodape)}</footer></article></body></html>`;
}
