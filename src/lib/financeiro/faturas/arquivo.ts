import Papa from "papaparse";
import { identificarCabecalho, type CabecalhoFatura } from "./cabecalho";
import { lerPdfBanco } from "./pdf-bancos";
import { lerColunasItau } from "./pdf-colunas";
import { dataIso, dinheiro, ErroFatura, LIMITE_ARQUIVO, LIMITE_ITENS, normalizarTexto, tipoDaLinha, type LinhaFatura } from "./dominio";

export type MapaFatura = { data: string; descricao: string; valor: string; parcela?: string; portador?: string; documento?: string; moeda?: string; formatoValor: "BR" | "DECIMAL" };
export type ExtracaoFatura = { linhas: LinhaFatura[]; avisos: string[]; naoReconhecidas: { linha: number; texto: string }[]; formato: string; cabecalho?: CabecalhoFatura };
const cabecalho = (texto: string) => normalizarTexto(texto).replace(/[^A-Z0-9]/g, "");
export function recusarDadosSensiveis(texto: string) {
  const numeros = texto.match(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g) ?? [];
  const pan = numeros.some(n => {
    const digitos = n.replace(/\D/g, "");
    if (/^(\d)\1+$/.test(digitos)) return false;
    let soma = 0;
    for (let i = digitos.length-1, dobra = false; i >= 0; i--, dobra = !dobra) {
      let valor = Number(digitos[i]); if (dobra) { valor *= 2; if (valor > 9) valor -= 9; } soma += valor;
    }
    return soma % 10 === 0;
  });
  if (pan || /\b(?:CVV|CVC|SENHA)\s*[:=]\s*\d{3,}/i.test(texto)) throw new ErroFatura("O arquivo contém possível número completo de cartão ou credencial. Exporte um documento mascarado, somente com os quatro últimos dígitos.");
}
export function valorImportado(texto: string, formato: MapaFatura["formatoValor"]) {
  let limpo = texto.trim().replace(/^R\$\s*/, "");
  if (/^\(.*\)$/.test(limpo)) limpo = "-" + limpo.slice(1,-1);
  if (formato === "BR") {
    if (!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(limpo)) throw new ErroFatura("Valor brasileiro inválido.");
    limpo = limpo.replaceAll(".", "").replace(",", ".");
  }
  return dinheiro(limpo);
}
function lerData(texto: string) {
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return dataIso(br ? `${br[3]}-${br[2]}-${br[1]}` : texto.trim());
}
function parcelas(texto: string) {
  const p = texto.trim() ? /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(texto.trim()) : null;
  if (texto.trim() && !p) throw new ErroFatura("Parcela inválida. Use atual/total, por exemplo 1/3.");
  const parcela = Number(p?.[1] ?? 1), totalParcelas = Number(p?.[2] ?? 1);
  if (parcela < 1 || parcela > totalParcelas || totalParcelas > 120) throw new ErroFatura("Parcelamento fora do intervalo de 1 a 120.");
  return { parcela, totalParcelas };
}
export function lerTabelaFatura(tabela: string[][], mapa?: MapaFatura): ExtracaoFatura {
  recusarDadosSensiveis(tabela.map(l => l.join(" | ")).join("\n"));
  if (tabela.length < 2 || tabela.length > LIMITE_ITENS + 1) throw new ErroFatura(`O arquivo deve ter cabeçalho e até ${LIMITE_ITENS} itens.`);
  const titulos = tabela[0].map(t => t.trim());
  if (new Set(titulos.map(cabecalho)).size !== titulos.length) throw new ErroFatura("Há títulos de colunas repetidos.");
  const procurar = (nomes: string[]) => titulos.find(t => nomes.includes(cabecalho(t))) ?? "";
  const m = mapa ?? { data: procurar(["DATA","DATACOMPRA","DATE"]), descricao: procurar(["DESCRICAO","ESTABELECIMENTO","DESCRIPTION"]), valor: procurar(["VALOR","AMOUNT"]), parcela: procurar(["PARCELA"]), portador: procurar(["PORTADOR"]), moeda: procurar(["MOEDA"]), documento: procurar(["DOCUMENTO"]), formatoValor: "BR" };
  if (!["BR","DECIMAL"].includes(m.formatoValor) || [m.data,m.descricao,m.valor].some(c => !c || !titulos.includes(c))) throw new ErroFatura("Colunas não reconhecidas. Informe o mapeamento de Data, Descrição e Valor.");
  const obter = (linha: string[], nome?: string) => nome ? linha[titulos.indexOf(nome)] ?? "" : "";
  const linhas: LinhaFatura[] = [], naoReconhecidas: ExtracaoFatura["naoReconhecidas"] = [];
  for (const [indice, linha] of tabela.slice(1).entries()) {
    if (!linha.some(v => v.trim())) continue;
    try {
      if (linha.length !== titulos.length) throw new ErroFatura("Quantidade de colunas divergente.");
      const descricao = obter(linha,m.descricao).trim();
      if (!descricao || descricao.length > 500) throw new ErroFatura("Descrição ausente ou extensa.");
      const moeda = obter(linha,m.moeda).trim().toUpperCase();
      if (moeda && moeda !== "BRL" && moeda !== "R$") throw new ErroFatura("Converta explicitamente o valor para BRL antes da importação.");
      const valor = valorImportado(obter(linha,m.valor),m.formatoValor);
      if (valor === 0) throw new ErroFatura("Valor zero exige revisão.");
      const parcelaTexto = obter(linha,m.parcela) || /\b(\d{1,3}\s*\/\s*\d{1,3})\b/.exec(descricao)?.[1] || "";
      linhas.push({ linha: indice+2, textoOriginal: JSON.stringify(linha), descricao, estabelecimento: descricao,
        data: lerData(obter(linha,m.data)), valor, ...parcelas(parcelaTexto), moeda: "BRL", tipo: tipoDaLinha(descricao,valor), revisar: false,
        portador: obter(linha,m.portador) || undefined, documento: obter(linha,m.documento) || undefined });
    } catch (erro) { naoReconhecidas.push({ linha: indice+2, texto: `${linha.join(" | ").slice(0,700)} — ${erro instanceof Error ? erro.message : "Linha inválida"}` }); }
  }
  return { linhas, naoReconhecidas, avisos: [], formato: "TABELA" };
}
export function lerTextoPdf(texto: string): ExtracaoFatura {
  recusarDadosSensiveis(texto);
  const linhas: LinhaFatura[] = [], naoReconhecidas: ExtracaoFatura["naoReconhecidas"] = [];
  const textos = texto.split(/\r?\n/);
  for (const [indice, original] of textos.entries()) {
    const l = original.trim();
    if (!l) continue;
    const candidato = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2})\s*$/.exec(l);
    if (!candidato) {
      // Conserva linhas potencialmente financeiras: nunca some com compras não reconhecidas.
      if (/\d{2}\/\d{2}|\d[,\.]\d{2}\b/.test(l)) naoReconhecidas.push({ linha: indice+1, texto: l.slice(0,1000) });
      continue;
    }
    try {
      const descricao = candidato[2], valor = valorImportado(candidato[3], "BR");
      if (!valor) throw new ErroFatura("Valor zero");
      linhas.push({ linha: indice+1, textoOriginal: original, descricao, estabelecimento: descricao,
        data: lerData(candidato[1]), valor, ...parcelas(/\b(\d{1,3}\/\d{1,3})\b/.exec(descricao)?.[1] ?? ""), moeda: "BRL", tipo: tipoDaLinha(descricao,valor), revisar: true });
    } catch { naoReconhecidas.push({ linha: indice+1, texto: l.slice(0,1000) }); }
  }
  if (linhas.length > LIMITE_ITENS) throw new ErroFatura("PDF excede o limite de itens.");
  return { linhas, naoReconhecidas, formato: "PDF", cabecalho: identificarCabecalho(texto), avisos: ["Extração por texto nativo. Confira as linhas e o total. Datas sem ano não são presumidas."] };
}
export class SenhaPdfNecessaria extends ErroFatura {}
export async function extrairArquivo(bytes: Buffer, nome: string, mapa?: MapaFatura, senha?: string): Promise<ExtracaoFatura> {
  if (!bytes.length || bytes.length > LIMITE_ARQUIVO || nome.length > 255) throw new ErroFatura("Escolha um arquivo de até 2 MB.");
  const extensao = nome.split(".").at(-1)?.toLowerCase();
  if (extensao === "csv") {
    let texto: string;
    try { texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { texto = new TextDecoder("windows-1252").decode(bytes); }
    const resultado = Papa.parse<string[]>(texto, { skipEmptyLines: "greedy" });
    if (resultado.errors.length) throw new ErroFatura("CSV malformado. Confira aspas, delimitador e linhas.");
    return { ...lerTabelaFatura(resultado.data, mapa), formato: "CSV" };
  }
  if (extensao === "xlsx" || extensao === "xls") {
    if (extensao === "xlsx") {
      if (bytes.length < 22 || bytes.readUInt16LE(0) !== 0x4b50) throw new ErroFatura("XLSX inválido.");
      // Limita o conteúdo descompactado antes de entregar a planilha ao parser.
      let expandido = 0;
      for (let i=0; i<bytes.length-46; i++) if (bytes.readUInt32LE(i) === 0x02014b50) {
        expandido += bytes.readUInt32LE(i+24);
        if (expandido > 25*1024*1024) throw new ErroFatura("Planilha muito grande após descompactação.");
      }
    } else if (bytes.subarray(0,8).toString("hex") !== "d0cf11e0a1b11ae1") throw new ErroFatura("XLS inválido. Exporte uma planilha Excel ou CSV.");
    try {
      const XLSX = await import("xlsx");
      const livro = XLSX.read(bytes, { type: "buffer", cellDates: false, sheetRows: LIMITE_ITENS+2 });
      if (livro.SheetNames.length !== 1) throw new ErroFatura("Exporte somente a aba de transações da fatura.");
      const folha = livro.Sheets[livro.SheetNames[0]];
      const tabela = XLSX.utils.sheet_to_json<string[]>(folha, { header: 1, raw: false, defval: "", blankrows: false });
      return { ...lerTabelaFatura(tabela, mapa), formato: extensao.toUpperCase() };
    } catch (erro) { if (erro instanceof ErroFatura) throw erro; throw new ErroFatura("Planilha inválida ou protegida. Exporte novamente em XLSX ou CSV."); }
  }
  if (extensao === "pdf") {
    if (bytes.subarray(0,5).toString() !== "%PDF-") throw new ErroFatura("PDF inválido.");
    const { PDFParse } = await import("pdf-parse");
    if (senha && senha.length > 128) throw new ErroFatura("Senha do PDF inválida.");
    const parser = new PDFParse({ data: new Uint8Array(bytes), password: senha, isEvalSupported: false, stopAtErrors: true });
    try {
      const info = await parser.getInfo();
      if (info.total > 80) throw new ErroFatura("PDF excede 80 páginas. Divida o arquivo por fatura.");
      const resultado = await parser.getText();
      if (!resultado.text.trim()) throw new ErroFatura("PDF sem texto nativo. OCR não configurado: exporte CSV/XLSX ou um PDF pesquisável.");
      recusarDadosSensiveis(resultado.text);
      const colunas = /Cartão Itaú Empresas/.test(resultado.text) ? await lerColunasItau(bytes, senha) : new Map<number, string[]>();
      const paginas = resultado.pages.map(p => ({ numero: p.num, texto: p.text, colunas: colunas.get(p.num) ?? [p.text] }));
      return lerPdfBanco(paginas) ?? lerTextoPdf(resultado.text);
    } catch (erro) {
      if (erro instanceof ErroFatura) throw erro;
      if (erro instanceof Error && erro.name === "PasswordException") throw new SenhaPdfNecessaria(senha ? "A senha não abriu este PDF. Confira e tente novamente." : "Este PDF está protegido. Informe a senha do arquivo para continuar.");
      throw new ErroFatura("Não foi possível ler o PDF. Verifique se está íntegro.");
    }
    finally { await parser.destroy(); }
  }
  throw new ErroFatura("Formato não suportado. Use PDF, CSV, XLS ou XLSX.");
}
