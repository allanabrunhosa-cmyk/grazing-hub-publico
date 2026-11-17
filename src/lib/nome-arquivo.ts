// Padrão único de nomes dos arquivos baixados do HUB: "Grazing - <tema> <detalhe>.<extensão>".
// Todo download novo deve usar estas funções em vez de montar o nome à mão.

const PREFIXO = "Grazing - ";
// Caracteres recusados por Windows/macOS em nomes de arquivo e caracteres de controle.
const PROIBIDOS = /[\\/:*?"<>|\u0000-\u001f\u007f]/g;
const LIMITE_CORPO = 150;

function limpar(texto: string) {
  return texto.normalize("NFC").replace(PROIBIDOS, " ").replace(/\s+/g, " ").trim();
}

/** Ex.: nomeArquivoGrazing("NF saída", "pdf", "#1234") → "Grazing - NF saída #1234.pdf". */
export function nomeArquivoGrazing(tema: string, extensao: string, detalhe?: string | null) {
  const corpo = [limpar(tema), detalhe ? limpar(detalhe) : ""].filter(Boolean).join(" ").slice(0, LIMITE_CORPO).trim();
  const sufixo = extensao.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return `${PREFIXO}${corpo || "Arquivo"}${sufixo ? `.${sufixo}` : ""}`;
}

/** Aplica o padrão a um arquivo enviado pelo usuário, preservando o nome e a extensão originais. */
export function nomeArquivoGrazingDeOriginal(tema: string, nomeOriginal: string) {
  const original = limpar(nomeOriginal).replace(/^Grazing\s*-\s*/i, "");
  const ponto = original.lastIndexOf(".");
  const temExtensao = ponto > 0 && /^[a-zA-Z0-9]{1,8}$/.test(original.slice(ponto + 1));
  const base = (temExtensao ? original.slice(0, ponto) : original).replace(new RegExp(`^${limpar(tema)}\\s*-?\\s*`, "i"), "");
  return nomeArquivoGrazing(`${tema}${base ? " -" : ""}`, temExtensao ? original.slice(ponto + 1) : "", base);
}

/** Número de documento para o nome: "#1234", ou vazio quando não há número. */
export function numeroNoNome(numero: string | number | null | undefined) {
  const valor = String(numero ?? "").replace(/[^a-zA-Z0-9.-]/g, "").replace(/^0+(?=\d)/, "");
  return valor ? `#${valor}` : "";
}

/** Cabeçalho Content-Disposition com alternativa ASCII e nome acentuado (RFC 6266/5987). */
export function disposicaoArquivo(nome: string, disposicao: "attachment" | "inline" = "attachment") {
  const ascii = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const utf8 = encodeURIComponent(nome).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${disposicao}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/** Lê o nome enviado em Content-Disposition, preferindo a forma acentuada. */
export function nomeDaDisposicao(cabecalho: string | null | undefined) {
  if (!cabecalho) return null;
  const utf8 = cabecalho.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) { try { return decodeURIComponent(utf8); } catch { /* usa a alternativa ASCII */ } }
  return cabecalho.match(/filename="([^"]+)"/i)?.[1] ?? null;
}
