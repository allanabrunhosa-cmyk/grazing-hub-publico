import type { InsumoRow } from "@/app/(protegido)/insumos/types";
import { unidadeMedidaAbreviada, unidadeMedidaLabels } from "@/lib/labels";
import { MAXIMO_INGREDIENTES_PREPARACAO, MAXIMO_PASSOS_PREPARO } from "@/lib/insumos/limites-preparacao";

function escaparHtml(valor: string) {
  return valor.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
}

function numero(valor: number) {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/**
 * Documento de produção para impressão A4 em paisagem. A foto é resolvida no navegador para
 * preservar a autenticação da rota privada de imagens e não levar bytes da foto à tabela.
 */
export function gerarHtmlFichaTecnica(preparacao: InsumoRow, fotoUrl?: string | null) {
  const ingredientes = preparacao.componentes.slice(0, MAXIMO_INGREDIENTES_PREPARACAO).map((item) => `
    <tr>
      <td class="ingrediente"><strong>${escaparHtml(item.nome)}</strong>${item.especificacao ? `<small>${escaparHtml(item.especificacao)}</small>` : ""}<small>${escaparHtml(item.categoriaNome ?? "Sem categoria")}</small></td>
      <td class="porcao">${item.observacaoPorcao ? escaparHtml(item.observacaoPorcao) : "—"}</td>
      <td class="quantidade">${numero(item.quantidade)} ${escaparHtml(unidadeMedidaAbreviada[item.unidade])}</td>
    </tr>`).join("");
  const passos = (preparacao.modoPreparo ?? []).slice(0, MAXIMO_PASSOS_PREPARO).map((passo, indice) => `
    <li><span class="numero-passo">${indice + 1}</span><p>${escaparHtml(passo)}</p></li>`).join("");
  const prazos = [
    ["Ambiente", preparacao.validadeSecoDias],
    ["Refrigerado", preparacao.validadeRefrigeradoDias],
    ["Congelado", preparacao.validadeCongeladoDias],
  ].filter((item) => item[1] != null).map(([rotulo, dias]) => `<span><strong>${escaparHtml(String(rotulo))}</strong><small>${dias} dia${dias === 1 ? "" : "s"} após aberto</small></span>`).join("");
  const rendimento = preparacao.rendimentoQuantidade && preparacao.rendimentoUnidade
    ? `${numero(preparacao.rendimentoQuantidade)} ${escaparHtml(unidadeMedidaLabels[preparacao.rendimentoUnidade])}`
    : "Não informado";
  const foto = fotoUrl
    ? `<img src="${escaparHtml(fotoUrl)}" alt="Foto de referência de ${escaparHtml(preparacao.nome)}">`
    : `<div class="sem-foto"><strong>Foto de referência</strong><span>Cadastre uma imagem vertical para orientar a montagem.</span></div>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Ficha técnica — ${escaparHtml(preparacao.nome)}</title>
    <style>
      @page { size: 297mm 210mm; margin: 8mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #25201d; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.26; }
      .pagina { --escala: 1; width: 281mm; height: 194mm; overflow: hidden; }
      .ficha { width: 281mm; transform: scale(var(--escala)); transform-origin: top left; }
      .cabecalho { display: grid; grid-template-columns: 1fr auto; gap: 6mm; align-items: end; border-bottom: 2px solid #332924; padding: 0 0 4mm; }
      .marca { margin: 0 0 1mm; color: #9a4b25; font-size: 7.2pt; font-weight: 700; letter-spacing: 1.25pt; }
      h1 { margin: 0; color: #2d211c; font-size: 23pt; line-height: 1.03; letter-spacing: -.45pt; overflow-wrap: anywhere; }
      .especificacao { margin: 1mm 0 0; color: #685e58; font-size: 9.2pt; }
      .atualizacao { margin: 0; color: #685e58; font-size: 7.8pt; text-align: right; white-space: nowrap; }
      .atualizacao strong { display: block; color: #332924; font-size: 8.4pt; }
      .conteudo { display: grid; grid-template-columns: 94mm minmax(0, 1fr); gap: 6mm; margin-top: 4mm; align-items: start; }
      .referencia { min-width: 0; }
      .foto { aspect-ratio: 4 / 5; overflow: hidden; border-radius: 3.5mm; background: #eee8e2; box-shadow: inset 0 0 0 1px #d9cec4; }
      .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .sem-foto { height: 100%; display: flex; flex-direction: column; justify-content: end; gap: 1mm; padding: 4mm; color: #685e58; background: #f3eeea; }
      .sem-foto strong { color: #332924; font-size: 11pt; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; margin-top: 2.5mm; }
      .meta div { min-height: 16mm; padding: 2.5mm; border-radius: 2.5mm; background: #f5f1ed; }
      .meta small, .rotulo-secao { display: block; color: #7a6f68; font-size: 7.1pt; font-weight: 700; letter-spacing: .7pt; text-transform: uppercase; }
      .meta strong { display: block; margin-top: .7mm; color: #332924; font-size: 10pt; line-height: 1.15; }
      .validade-lateral { margin-top: 2.5mm; }
      .rotulo-validade { margin: 0 0 1.2mm; color: #7a6f68; font-size: 7.1pt; font-weight: 700; letter-spacing: .7pt; text-transform: uppercase; }
      .receita { min-width: 0; }
      h2 { display: flex; align-items: center; gap: 1.5mm; margin: 0 0 1.8mm; color: #332924; font-size: 11pt; }
      h2::before { width: 4mm; height: 1.2mm; border-radius: 1mm; background: #9a4b25; content: ""; }
      .bloco + .bloco { margin-top: 3.5mm; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      th, td { border-bottom: 1px solid #e5ddd7; padding: 1.4mm 1.3mm; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { color: #7a6f68; background: #f5f1ed; font-size: 7.1pt; font-weight: 700; letter-spacing: .55pt; text-transform: uppercase; }
      th:nth-child(1) { width: 46%; } th:nth-child(2) { width: 36%; } th:nth-child(3) { width: 18%; }
      td.ingrediente strong, td.ingrediente small { display: block; }
      td.ingrediente small, td.quantidade { color: #685e58; font-size: 8pt; }
      td.porcao { color: #332924; background: #faf5ed; font-size: 10pt; font-weight: 700; }
      ol { list-style: none; margin: 0; padding: 0; }
      li { display: grid; grid-template-columns: 6mm 1fr; gap: 2mm; align-items: start; padding: 1.3mm 0; border-bottom: 1px solid #e5ddd7; break-inside: avoid; }
      .numero-passo { display: grid; width: 6mm; height: 6mm; place-items: center; border-radius: 50%; background: #332924; color: #fff; font-size: 7.4pt; font-weight: 700; }
      li p { margin: .2mm 0 0; white-space: pre-wrap; }
      .prazos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2mm; }
      .prazos span { padding: 2mm; border: 1px solid #e5ddd7; border-radius: 2.5mm; background: #fff; }
      .prazos strong, .prazos small { display: block; }
      .prazos strong { color: #332924; font-size: 8.6pt; }
      .prazos small { margin-top: .4mm; color: #685e58; font-size: 7.3pt; }
      .observacoes { margin: 0; padding: 2mm; border-left: 1.2mm solid #c4774d; background: #fbf7f3; color: #514842; white-space: pre-wrap; }
      .rodape { margin-top: 4mm; padding-top: 2mm; border-top: 1px solid #d9cec4; color: #7a6f68; font-size: 6.8pt; }
      tr, .meta div, .prazos, .bloco { break-inside: avoid; }
      @media screen { body { width: 297mm; min-height: 210mm; margin: 8mm auto; padding: 8mm; box-shadow: 0 8px 32px #0002; } }
      @media print { body { padding: 0; } }
    </style></head><body>
      <div class="pagina"><main class="ficha">
        <header class="cabecalho"><div><p class="marca">GRAZING TABLE &amp; CO · FICHA TÉCNICA</p><h1>${escaparHtml(preparacao.nome)}</h1>${preparacao.especificacao ? `<p class="especificacao">${escaparHtml(preparacao.especificacao)}</p>` : ""}</div><p class="atualizacao"><strong>${escaparHtml(preparacao.categoria?.nome ?? "Pré-preparações")}</strong>Atualizada em ${new Date(preparacao.updatedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></header>
        <div class="conteudo"><aside class="referencia"><div class="foto">${foto}</div><div class="meta"><div><small>Rendimento</small><strong>${rendimento}</strong></div><div><small>Unidade de controle</small><strong>${escaparHtml(unidadeMedidaLabels[preparacao.unidade])}</strong></div><div><small>Tempo de preparo</small><strong>${preparacao.tempoPreparoMinutos == null ? "Não informado" : `${preparacao.tempoPreparoMinutos} min`}</strong></div></div>${prazos ? `<section class="validade-lateral"><p class="rotulo-validade">Validade</p><div class="prazos">${prazos}</div></section>` : ""}</aside>
          <div class="receita"><section class="bloco"><h2>Ingredientes</h2><table><thead><tr><th>Ingrediente / categoria</th><th>Porção de montagem</th><th>Qtd. estoque</th></tr></thead><tbody>${ingredientes || '<tr><td colspan="3">Nenhum ingrediente cadastrado.</td></tr>'}</tbody></table></section>
          <section class="bloco"><h2>Modo de preparo</h2>${passos ? `<ol>${passos}</ol>` : '<p>Nenhum passo cadastrado.</p>'}</section>
          ${preparacao.observacoes ? `<section class="bloco"><h2>Observações da preparação</h2><p class="observacoes">${escaparHtml(preparacao.observacoes)}</p></section>` : ""}
          </div></div>
        <footer class="rodape">Documento de produção gerado pelo Grazing HUB. Confira a ficha atual antes de iniciar o preparo.</footer>
      </main></div>
      <script>
        (function () {
          function ajustarFichaTecnica() {
            var pagina = document.querySelector(".pagina");
            var ficha = document.querySelector(".ficha");
            if (!pagina || !ficha) return;
            pagina.style.setProperty("--escala", "1");
            var escala = Math.min(1, (pagina.clientWidth - 1) / ficha.scrollWidth, (pagina.clientHeight - 1) / ficha.scrollHeight);
            pagina.style.setProperty("--escala", String(Math.max(0.01, escala)));
          }
          window.ajustarFichaTecnica = ajustarFichaTecnica;
          window.addEventListener("load", ajustarFichaTecnica);
          window.addEventListener("beforeprint", ajustarFichaTecnica);
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarFichaTecnica);
        }());
      </script>
    </body></html>`;
}

export function imprimirFichaTecnica(preparacao: InsumoRow) {
  const janela = window.open("", "_blank", "width=900,height=900");
  if (!janela) return false;
  const fotoUrl = preparacao.temFoto
    ? new URL(`/api/insumos/${preparacao.id}/foto?v=${new Date(preparacao.updatedAt).getTime()}`, window.location.origin).toString()
    : null;
  janela.document.write(gerarHtmlFichaTecnica(preparacao, fotoUrl));
  janela.document.close();
  let impressa = false;
  const imprimir = () => {
    if (impressa) return;
    impressa = true;
    (janela as Window & { ajustarFichaTecnica?: () => void }).ajustarFichaTecnica?.();
    janela.focus();
    janela.print();
  };
  const foto = janela.document.querySelector(".foto img");
  if (foto instanceof HTMLImageElement) {
    foto.addEventListener("load", imprimir, { once: true });
    foto.addEventListener("error", imprimir, { once: true });
    window.setTimeout(imprimir, 3000);
  } else {
    imprimir();
  }
  return true;
}
