import { completarCiclo, identificarCabecalho, type CabecalhoFatura } from "./cabecalho";
import { dataIso, dinheiro, ErroFatura, normalizarTexto, tipoDaLinha, type LinhaFatura } from "./dominio";
import type { ExtracaoFatura } from "./arquivo";

export type PaginaTextoFatura = { numero: number; texto: string; colunas: string[] };
const meses = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
const valor = (s: string) => dinheiro(s.replace(/\s|R\$/g, "").replaceAll(".", "").replace(",", "."));
const iso = (s: string) => { const [d, m, a] = s.split("/"); return dataIso(`${a}-${m}-${d}`); };
const moeda = "(-?\\s*(?:\\d{1,3}(?:\\.\\d{3})+|\\d+),\\d{2})";

export function cabecalhoBanco(paginas: PaginaTextoFatura[]): CabecalhoFatura | null {
  const primeira = paginas[0]?.texto ?? "", tudo = paginas.map(p => p.texto).join("\n");
  const banco = /Cartão Itaú Empresas/.test(tudo) ? "ITAU" : /Resumo da fatura/.test(primeira) && /bancointer\.com\.br|BANCO INTER S\/A/.test(tudo) ? "INTER" : null;
  if (!banco) return null;
  const cabecalho = identificarCabecalho(primeira);
  cabecalho.banco = banco;
  const finais = [...new Set((banco === "ITAU" ? primeira : tudo).match(/\b\d{4}[.*Xx•]+\d{4}\b/g)?.map(s => s.slice(-4)) ?? [])];
  if (finais.length === 1) cabecalho.dados.final = { valor: finais[0], origem: "PDF", evidencia: "Final da conta/cartão principal no cabeçalho; cartões virtuais agrupados." };
  else if (finais.length > 1) { delete cabecalho.dados.final; cabecalho.conflitos.push("final"); }
  const emissao = banco === "ITAU" ? /^Emissão:\s*(\d{2}\/\d{2}\/\d{4})\s*$/m.exec(primeira)?.[1] : /^DATA DOCUMENTO\s*\n(\d{2}\/\d{2}\/\d{4})/m.exec(tudo)?.[1];
  if (emissao && !cabecalho.dados.fechamento && !cabecalho.conflitos.includes("fechamento")) {
    cabecalho.dados.fechamento = { valor: iso(emissao), origem: "CONVENCAO", evidencia: "Data de emissão do documento usada como fechamento administrativo; não é a previsão do próximo fechamento." };
  }
  return completarCiclo(cabecalho);
}

/** Itaú não imprime o ano da compra. A parcela ancora o ano no primeiro ciclo, não no relógio atual. */
function dataItau(diaMes: string, referencia: string, parcela: number) {
  const [ano, mes] = referencia.split("-").map(Number);
  const [d, m] = diaMes.split("/");
  for (let anoCompra = ano; anoCompra >= ano - 10; anoCompra--) {
    const candidata = `${anoCompra}-${m}-${d}`, mesesDecorridos = (ano - anoCompra) * 12 + mes - Number(m);
    // O primeiro lançamento pode cair no ciclo da compra ou no seguinte.
    if (candidata <= referencia && (parcela === 1 || mesesDecorridos >= parcela - 2)) return dataIso(candidata);
  }
  throw new ErroFatura("Ano da compra não identificado.");
}

export function lerPdfBanco(paginas: PaginaTextoFatura[]): ExtracaoFatura | null {
  const cabecalho = cabecalhoBanco(paginas);
  if (!cabecalho) return null;
  const linhas: LinhaFatura[] = [], naoReconhecidas: ExtracaoFatura["naoReconhecidas"] = [];
  const avisos: string[] = [];
  const referencia = cabecalho.dados.fechamento?.valor;
  let numero = 0, pagamentos = 0;
  function adicionar(textoOriginal: string, descricao: string, data: string, quantia: string, parcela = 1, totalParcelas = 1) {
    if (parcela < 1 || parcela > totalParcelas || totalParcelas > 120) throw new ErroFatura("Parcela inválida.");
    const v = valor(quantia); if (!v) return;
    linhas.push({ linha: numero, textoOriginal, descricao, estabelecimento: descricao, data, valor: v, parcela, totalParcelas, moeda: "BRL", tipo: tipoDaLinha(descricao, v), revisar: true });
  }
  if (cabecalho.banco === "INTER") {
    let ativa = false;
    for (const pagina of paginas) for (const original of pagina.texto.split(/\r?\n/)) {
      numero++; const l = original.trim(), normal = normalizarTexto(l);
      if (normal === "DESPESAS DA FATURA") { ativa = true; continue; }
      if (/^TOTAL CARTAO/.test(normal)) { ativa = false; continue; }
      if (!ativa) continue;
      const m = new RegExp(`^(\\d{2}) de ([a-zç]+)\\.? (\\d{4})\\s+(.+?)\\s+-\\s+([+]\\s*)?R\\$\\s*${moeda}\\s*$`, "i").exec(l);
      try {
        if (!m) { if (/^\d{2} de |R\$\s*\d/.test(l)) naoReconhecidas.push({ linha: numero, texto: l }); continue; }
        if (normalizarTexto(m[4]) === "PAGAMENTO DE FATURA") { pagamentos++; continue; }
        const mes = meses.indexOf(normalizarTexto(m[2]).slice(0, 3)) + 1;
        const p = /\(Parcela (\d+) de (\d+)\)/i.exec(m[4]);
        const quantia = m[5] ? "-" + m[6].replace(/^-/, "") : m[6];
        adicionar(original, m[4], dataIso(`${m[3]}-${String(mes).padStart(2, "0")}-${m[1]}`), quantia, Number(p?.[1] ?? 1), Number(p?.[2] ?? 1));
      } catch { naoReconhecidas.push({ linha: numero, texto: l }); }
    }
    if (pagamentos) avisos.push(`${pagamentos} pagamento(s) anterior(es) identificado(s) no PDF e excluído(s) das compras. A saída bancária será vinculada separadamente.`);
  } else {
    if (!referencia) throw new ErroFatura("Não foi possível identificar a emissão da fatura Itaú. Confira o documento antes de importar.");
    for (const pagina of paginas.slice(1)) for (const coluna of pagina.colunas) {
      let secao: "compras" | "encargos" | null = null;
      for (const original of coluna.split(/\r?\n/)) {
        numero++; const l = original.trim(), normal = normalizarTexto(l);
        if (/^LANCAMENTOS(?:: COMPRAS E SAQUES| INTERNACIONAIS|: PRODUTOS E SERVICOS)$/.test(normal)) { secao = "compras"; continue; }
        if (normal === "ENCARGOS COBRADOS NESTA FATURA") { secao = "encargos"; continue; }
        if (/^(COMPRAS PARCELADAS|LIMITES DE CREDITO|FIQUE ATENTO|NOVO TETO|SIMULACAO|DEMAIS TAXAS|TOTAL DOS LANCAMENTOS|L TOTAL DOS LANCAMENTOS)/.test(normal)) { secao = null; continue; }
        if (!secao) continue;
        try {
          const m = new RegExp(`^(\\d{2}/\\d{2})\\s+(.+?)\\s+${moeda}\\s*$`).exec(l);
          if (secao === "compras" && m) {
            const p = /(\d{2})\/(\d{2})$/.exec(m[2]);
            adicionar(original, m[2], dataItau(m[1], referencia, Number(p?.[1] ?? 1)), m[3], Number(p?.[1] ?? 1), Number(p?.[2] ?? 1));
          } else if (secao === "compras" && /^Repasse de IOF em R\$/i.test(l)) {
            const v = new RegExp(`${moeda}\\s*$`).exec(l); if (v) adicionar(original, "IOF das compras internacionais", referencia, v[1]);
          } else if (secao === "encargos" && /^(JUROS DO ROTATIVO|JUROS DE MORA|MULTA POR ATRASO|IOF DE FINANCIAMENTO)/.test(normal)) {
            const v = new RegExp(`${moeda}\\s*$`).exec(l);
            if (v) adicionar(original, l.slice(0, v.index).trim(), referencia, v[1]);
            else naoReconhecidas.push({ linha: numero, texto: l });
          } else if (/^\d{2}\/\d{2}\s/.test(l)) naoReconhecidas.push({ linha: numero, texto: l });
        } catch { naoReconhecidas.push({ linha: numero, texto: l }); }
      }
    }
    avisos.push("O Itaú não informa o ano nas compras. O ano foi reconstituído pelo ciclo e número da parcela; confira as datas antes de confirmar. Cartões virtuais permanecem agrupados na fatura principal.");
  }
  if (linhas.length > 5000) throw new ErroFatura("PDF excede o limite de itens.");
  avisos.push("Foram lidas somente as seções de compras/encargos atuais. Ofertas de parcelamento e parcelas futuras não geram despesas.");
  return { linhas, naoReconhecidas, avisos, formato: "PDF", cabecalho };
}
