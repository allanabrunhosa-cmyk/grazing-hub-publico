import { tipoEstoqueLabels, unidadeMedidaLabels } from "@/lib/labels";
import type { ContagemDetalhe, ContagemItemRow } from "@/app/(protegido)/inventario/types";
import { descreverConversao } from "@/lib/insumos/conversoes";
import { formatarQuantidadeEstoque } from "@/lib/estoque/quantidade";

function escaparHtml(valor: string) {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Recebe exatamente os itens visíveis. A ordem é exclusiva da impressão; a folha nunca inclui saldos.
export function gerarHtmlContagem(contagem: ContagemDetalhe, itens: ContagemItemRow[], busca: string) {
  const comparar = (primeiro: string | null, segundo: string | null) => {
    if (primeiro == null) return segundo == null ? 0 : 1;
    if (segundo == null) return -1;
    return primeiro.localeCompare(segundo, "pt-BR", { sensitivity: "base" });
  };
  const itensImpressao = [...itens].sort((a, b) => {
    return comparar(a.tipoEstoque ? tipoEstoqueLabels[a.tipoEstoque] : null, b.tipoEstoque ? tipoEstoqueLabels[b.tipoEstoque] : null)
      || comparar(a.fornecedores.join(", ") || null, b.fornecedores.join(", ") || null)
      || comparar(a.nome, b.nome)
      || a.id.localeCompare(b.id);
  });
  const linhas = itensImpressao.map((item) => `<tr>
    <td>${escaparHtml(item.nome)}${item.especificacao?.trim() ? `<br><span class="especificacao">${escaparHtml(item.especificacao.trim())}</span>` : ""}</td>
    <td>${escaparHtml(item.fornecedores.join(", ") || "Não informado")}</td>
    <td>${item.tipoEstoque ? tipoEstoqueLabels[item.tipoEstoque] : "Não informado"}</td>
    <td>${unidadeMedidaLabels[item.unidade]}</td>
    <td>${formatarQuantidadeEstoque(item.estoqueMinimo)}</td>
    <td>${item.estoqueMaximo == null ? "—" : formatarQuantidadeEstoque(item.estoqueMaximo)}</td>
    <td class="contagem"></td><td class="observacoes">${(item.conversoes ?? []).map((conversao) => escaparHtml(descreverConversao(conversao, item.unidade))).join("<br>")}</td>
  </tr>`).join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>Contagem de estoque — ${escaparHtml(contagem.localNome)}</title>
    <style>
      @page { size: A4 portrait; margin: 10mm; }
      body { font-family: Arial, sans-serif; color: #111; font-size: 9px; }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { margin: 5px 0; overflow-wrap: anywhere; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; table-layout: fixed; }
      th, td { border: 1px solid #999; padding: 4px; text-align: left; overflow-wrap: anywhere; }
      th { background: #eee; } td { height: 28px; }
      .especificacao { color: #444; font-size: 8px; }
      thead { display: table-header-group; } tr { break-inside: avoid; }
      .rodape { margin-top: 14px; }
    </style></head><body>
    <h1>Contagem manual de estoque</h1>
    <p><strong>Local:</strong> ${escaparHtml(contagem.localNome)} · <strong>Data da contagem:</strong> ${new Date(contagem.dataContagem).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
    <p><strong>Referência:</strong> ${escaparHtml(contagem.id)} · <strong>Itens:</strong> ${itens.length} de ${contagem.itens.length}</p>
    <p><strong>Ordenação:</strong> Tipo de estoque, fornecedor e insumo (A–Z)${busca.trim() ? ` · <strong>Busca:</strong> ${escaparHtml(busca.trim())}` : ""}</p>
    <p><strong>Responsável:</strong> ____________________________________ <strong>Realizada em:</strong> ____/____/________</p>
    <table><colgroup><col style="width:20%"><col style="width:18%"><col style="width:11%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:11%"><col style="width:16%"></colgroup>
    <thead><tr><th>Insumo</th><th>Fornecedores</th><th>Tipo</th><th>Unid.</th><th>Est. mín.</th><th>Est. máx.</th><th>Qtd. contada</th><th>Observações</th></tr></thead>
    <tbody>${linhas}</tbody></table>
    <p class="rodape">Preencha as quantidades à mão e depois registre os valores no sistema. A impressão não salva nem finaliza a contagem.</p>
    </body></html>`;
}

export function imprimirContagem(contagem: ContagemDetalhe, itens: ContagemItemRow[], busca: string) {
  const janela = window.open("", "_blank", "width=1100,height=800");
  if (!janela) return false;
  janela.document.write(gerarHtmlContagem(contagem, itens, busca));
  janela.document.close();
  janela.focus();
  janela.print();
  return true;
}
