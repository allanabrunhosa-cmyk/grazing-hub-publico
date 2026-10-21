import Papa from "papaparse";
import { dataLancamentoValida } from "../data-lancamento";

export type MapaCsv = { cabecalho: number; data: number; descricao: number; valor: number; entrada?: number; saida?: number; identificador?: number; formatoData: "BR" | "ISO"; formatoValor: "BR" | "US"; modo: "SINAL" | "COLUNAS" };
export type LinhaArquivo = { indice: number; data: string; descricao: string; centavos: number; identificador: string | null };
export type ArquivoExtrato = { formato: "OFX" | "CSV"; referenciaOfx: string | null; linhasSaldoIgnoradas: number; linhas: LinhaArquivo[] };
export class ErroExtrato extends Error {}
export const LIMITE_ARQUIVO = 2 * 1024 * 1024;

export function ehSaldoDoDia(descricao: string) {
  const normalizada = descricao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
  return /^saldo(?: total)?(?: disponivel)?(?: do)? dia(?: |$)/.test(normalizada) ||
    /^saldo anterior(?:$| \d)/.test(normalizada);
}

export function linhasCsv(texto: string): string[][] {
  const resultado = Papa.parse<string[]>(texto.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  if (resultado.errors.some(e => e.code !== "UndetectableDelimiter")) throw new ErroExtrato("O CSV contém aspas ou colunas inválidas. Exporte novamente pelo banco.");
  return resultado.data;
}
export function centavosArquivo(texto: string, formato: "BR" | "US"): number {
  let valor = texto.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (/^\(.*\)$/.test(valor)) valor = "-" + valor.slice(1, -1);
  const valido = formato === "BR" ? /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/ : /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
  if (!valido.test(valor)) throw new ErroExtrato(`Valor inválido: ${texto.slice(0, 40)}. Confira o formato decimal.`);
  valor = formato === "BR" ? valor.replaceAll(".", "").replace(",", ".") : valor.replaceAll(",", "");
  const centavos = Math.round(Number(valor) * 100);
  if (!Number.isSafeInteger(centavos) || Math.abs(centavos) > 99_999_999_999_999) throw new ErroExtrato("Valor fora do limite permitido.");
  return centavos;
}
function conferir(linha: LinhaArquivo): LinhaArquivo {
  if (!dataLancamentoValida(linha.data)) throw new ErroExtrato(`Linha ${linha.indice + 1}: data inválida.`);
  if (!linha.descricao || linha.descricao.length > 1000) throw new ErroExtrato(`Linha ${linha.indice + 1}: descrição deve ter entre 1 e 1.000 caracteres.`);
  if (linha.centavos === 0) throw new ErroExtrato(`Linha ${linha.indice + 1}: valor zero não é uma transação. Remova linhas de saldo antes de importar.`);
  if (linha.identificador && linha.identificador.length > 255) throw new ErroExtrato("Identificador bancário excede 255 caracteres.");
  return linha;
}
function campoOfx(texto: string, campo: string, obrigatorio = true) {
  const valores = [...texto.matchAll(new RegExp(`<${campo}\\s*>\\s*([^<]*)`, "gi"))];
  if (valores.length > 1 || (obrigatorio && !valores[0]?.[1].trim())) throw new ErroExtrato(`O OFX não contém um ${campo} único e válido.`);
  return (valores[0]?.[1].trim() ?? "").replace(/&#(\d+);/g, (_, n) => Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : "").replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&apos;", "'");
}
export function lerArquivoExtrato(texto: string, nome: string, mapa?: MapaCsv): ArquivoExtrato {
  if (texto.length > LIMITE_ARQUIVO || !texto.trim()) throw new ErroExtrato("Selecione um arquivo de até 2 MB com transações.");
  let arquivo: ArquivoExtrato;
  if (/\.ofx$/i.test(nome)) {
    if (/<!DOCTYPE|<!ENTITY|<CORRECTFITID|<CCSTMTRS|<INVSTMTRS/i.test(texto)) throw new ErroExtrato("Use um extrato OFX de conta bancária, sem instruções de correção, cartão ou investimentos.");
    const contas = [...texto.matchAll(/<STMTRS\s*>([\s\S]*?)<\/STMTRS\s*>/gi)];
    if (contas.length !== 1) throw new ErroExtrato("Importe um extrato OFX de uma única conta por vez.");
    const conteudo = contas[0][1];
    if (campoOfx(conteudo, "CURDEF").toUpperCase() !== "BRL") throw new ErroExtrato("A conciliação aceita somente extratos em reais (BRL).");
    const referenciaOfx = [campoOfx(conteudo, "BANKID"), campoOfx(conteudo, "BRANCHID", false), campoOfx(conteudo, "ACCTID")].join(" / ");
    const trechos = [...conteudo.matchAll(/<STMTTRN\s*>([\s\S]*?)<\/STMTTRN\s*>/gi)];
    if ((conteudo.match(/<STMTTRN\s*>/gi) ?? []).length !== trechos.length) throw new ErroExtrato("O OFX contém uma transação incompleta.");
    arquivo = { formato: "OFX", referenciaOfx, linhasSaldoIgnoradas: 0, linhas: trechos.map(([, trecho], indice) => {
      const dataBruta = campoOfx(trecho, "DTPOSTED");
      if (!/^\d{8}(?:\d{6}(?:\.\d+)?(?:\[[^\]]+\])?)?$/.test(dataBruta)) throw new ErroExtrato("Data OFX inválida.");
      return { indice, data: `${dataBruta.slice(0, 4)}-${dataBruta.slice(4, 6)}-${dataBruta.slice(6, 8)}`,
        descricao: [campoOfx(trecho, "NAME", false), campoOfx(trecho, "MEMO", false)].filter(Boolean).join(" · ").trim(),
        centavos: centavosArquivo(campoOfx(trecho, "TRNAMT"), "US"), identificador: campoOfx(trecho, "FITID") };
    }) };
  } else if (/\.csv$/i.test(nome)) {
    const dados = linhasCsv(texto);
    if (!mapa || !Number.isInteger(mapa.cabecalho) || mapa.cabecalho < 0 || mapa.cabecalho > 20 || !dados[mapa.cabecalho] || !["BR", "ISO"].includes(mapa.formatoData) || !["BR", "US"].includes(mapa.formatoValor) || !["SINAL", "COLUNAS"].includes(mapa.modo)) throw new ErroExtrato("Confira o mapeamento das colunas do CSV.");
    const colunas = [mapa.data, mapa.descricao, ...(mapa.modo === "SINAL" ? [mapa.valor] : [mapa.entrada, mapa.saida]), ...(mapa.identificador != null && mapa.identificador >= 0 ? [mapa.identificador] : [])];
    if (colunas.some(c => c == null || !Number.isInteger(c) || c < 0 || c >= dados[mapa.cabecalho].length) || new Set(colunas).size !== colunas.length) throw new ErroExtrato("Escolha uma coluna diferente e válida para cada campo.");
    arquivo = { formato: "CSV", referenciaOfx: null, linhasSaldoIgnoradas: 0, linhas: dados.slice(mapa.cabecalho + 1).map((celulas, indice) => {
      const dataBruta = (celulas[mapa.data] ?? "").trim();
      const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataBruta);
      const data = mapa.formatoData === "BR" ? (partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : "") : dataBruta;
      const valor = (coluna: number) => centavosArquivo(celulas[coluna] ?? "", mapa.formatoValor);
      let centavos: number;
      if (mapa.modo === "COLUNAS") {
        const entrada = celulas[mapa.entrada!]?.trim() ? valor(mapa.entrada!) : 0;
        const saida = celulas[mapa.saida!]?.trim() ? valor(mapa.saida!) : 0;
        if (entrada < 0 || saida < 0 || (entrada !== 0 && saida !== 0)) throw new ErroExtrato(`Linha ${indice + mapa.cabecalho + 2}: preencha somente entrada ou saída, com valor positivo.`);
        centavos = entrada - saida;
      } else centavos = valor(mapa.valor);
      return { indice, data, centavos, descricao: (celulas[mapa.descricao] ?? "").trim(), identificador: mapa.identificador != null && mapa.identificador >= 0 ? celulas[mapa.identificador]?.trim() || null : null };
    }) };
  } else throw new ErroExtrato("Selecione um arquivo .ofx ou .csv.");
  const linhasSaldoIgnoradas = arquivo.linhas.filter(l => ehSaldoDoDia(l.descricao)).length;
  arquivo = { ...arquivo, linhasSaldoIgnoradas, linhas: arquivo.linhas.filter(l => !ehSaldoDoDia(l.descricao)).map(conferir) };
  if (!arquivo.linhas.length) throw new ErroExtrato(linhasSaldoIgnoradas ? "O arquivo contém apenas linhas informativas de Saldo do dia, sem transações para importar." : "O arquivo não contém transações para importar.");
  if (arquivo.linhas.length > 2000) throw new ErroExtrato("Importe no máximo 2.000 transações por arquivo.");
  const ids = arquivo.linhas.flatMap(l => l.identificador ? [l.identificador] : []);
  if (new Set(ids).size !== ids.length) throw new ErroExtrato("O arquivo repete identificadores bancários. Revise-o antes de importar.");
  return arquivo;
}
