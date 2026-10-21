import { createHash } from "node:crypto";
import path from "node:path";

export const TAMANHO_MAXIMO_FOTO = 5 * 1024 * 1024;
export type MimeFoto = "image/jpeg" | "image/png" | "image/webp";
export type OrigemFoto = {
  tipo: "internet" | "gerada";
  descricao?: string;
  sourcePage?: string;
  imageUrl?: string;
  autor?: string;
  licenca?: string;
  prompt?: string;
};
export type ItemManifestoFoto = {
  id: string;
  nome: string;
  especificacao: string | null;
  updatedAt: string;
  fotoHashMd5: string | null;
  foto: { arquivo: string; sha256: string; mimeType: MimeFoto; origem: OrigemFoto };
};
export type ManifestoFotos = {
  versao: 1;
  loteId: string;
  autorizacaoOperacional: string;
  itens: ItemManifestoFoto[];
};
export type EstadoFotoInsumo = {
  id: string;
  nome: string;
  especificacao: string | null;
  tipo: string;
  updatedAt: string;
  fotoHashMd5: string | null;
  fotoSha256: string | null;
  fotoMimeType: string | null;
};

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("Manifesto de fotos inválido.");
  return valor as Record<string, unknown>;
}

function texto(valor: unknown, campo: string, maximo = 2000): string {
  if (typeof valor !== "string" || !valor.trim() || valor.length > maximo) throw new Error(`Campo ${campo} inválido no manifesto.`);
  return valor;
}

function urlHttps(valor: unknown, campo: string) {
  const url = new URL(texto(valor, campo));
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`Origem ${campo} deve usar HTTPS sem credenciais.`);
  return url.toString();
}

// A precisão de seis casas conserva também datas anteriores gravadas por SQL.
export function normalizarInstante(valor: string): string {
  const partes = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/.exec(valor);
  if (!partes || !Number.isFinite(Date.parse(valor))) throw new Error("Versão de foto deve ser uma data UTC válida.");
  const normalizado = `${partes[1]}.${(partes[2] ?? "").padEnd(6, "0")}Z`;
  if (new Date(valor).toISOString().slice(0, 19) !== partes[1]) throw new Error("Versão de foto contém uma data inexistente.");
  return normalizado;
}

export function validarManifestoFotos(valor: unknown, quantidadeEsperada: number): ManifestoFotos {
  const raiz = objeto(valor);
  if (!Number.isInteger(quantidadeEsperada) || quantidadeEsperada < 1 || quantidadeEsperada > 2000) throw new Error("Quantidade esperada inválida.");
  if (raiz.versao !== 1 || !Array.isArray(raiz.itens) || raiz.itens.length !== quantidadeEsperada) throw new Error("Versão ou quantidade do manifesto diverge da conferência.");
  const loteId = texto(raiz.loteId, "loteId", 80);
  if (!/^[a-z0-9][a-z0-9-]{7,79}$/.test(loteId)) throw new Error("Identificador do lote inválido.");
  const autorizacaoOperacional = texto(raiz.autorizacaoOperacional, "autorizacaoOperacional");
  if (autorizacaoOperacional.trim().length < 20) throw new Error("Registre a autorização humana da operação no manifesto.");
  const itens = raiz.itens.map((valor): ItemManifestoFoto => {
    const item = objeto(valor);
    const id = texto(item.id, "id", 100);
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("ID inválido no manifesto.");
    const foto = objeto(item.foto);
    const sha256 = texto(foto.sha256, "sha256", 64).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("SHA-256 inválido no manifesto.");
    if (item.fotoHashMd5 !== null && (typeof item.fotoHashMd5 !== "string" || !/^[a-f0-9]{32}$/.test(item.fotoHashMd5))) throw new Error("Hash da foto anterior inválido.");
    if (item.especificacao !== null && typeof item.especificacao !== "string") throw new Error("Especificação inválida no manifesto.");
    const mimeType = foto.mimeType as MimeFoto;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) throw new Error("Formato de foto não permitido.");
    const origemBruta = objeto(foto.origem);
    if (origemBruta.tipo !== "internet" && origemBruta.tipo !== "gerada") throw new Error("Origem da foto inválida.");
    const origem: OrigemFoto = { tipo: origemBruta.tipo };
    for (const campo of ["descricao", "autor", "licenca", "prompt"] as const) {
      if (origemBruta[campo] !== undefined) origem[campo] = texto(origemBruta[campo], campo, campo === "prompt" ? 10000 : 2000);
    }
    if (origem.tipo === "internet") {
      origem.sourcePage = urlHttps(origemBruta.sourcePage, "sourcePage");
      origem.imageUrl = urlHttps(origemBruta.imageUrl, "imageUrl");
      if (!origem.licenca) throw new Error("Registre a licença da imagem obtida na internet.");
    } else if (!origem.prompt) throw new Error("Registre o prompt da foto gerada.");
    return {
      id, nome: texto(item.nome, "nome", 1000), especificacao: item.especificacao as string | null,
      updatedAt: normalizarInstante(texto(item.updatedAt, "updatedAt", 30)), fotoHashMd5: item.fotoHashMd5 as string | null,
      foto: { arquivo: texto(foto.arquivo, "arquivo", 500), sha256, mimeType, origem },
    };
  });
  if (new Set(itens.map(item => item.id)).size !== itens.length) throw new Error("O manifesto contém IDs duplicados.");
  return { versao: 1, loteId, autorizacaoOperacional, itens };
}

export function resolverArquivoFoto(diretorio: string, arquivo: string): string {
  // Recusa também separadores Windows quando a execução ocorre no Linux.
  if (path.isAbsolute(arquivo) || path.win32.isAbsolute(arquivo) || arquivo.includes("\\") || arquivo.split("/").some(parte => !parte || parte === "." || parte === "..")) throw new Error("A foto deve usar caminho relativo dentro da pasta do manifesto.");
  const base = path.resolve(diretorio);
  const destino = path.resolve(base, arquivo);
  if (!destino.startsWith(`${base}${path.sep}`)) throw new Error("Caminho da foto fora da pasta do manifesto.");
  return destino;
}

export function hashSha256(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
// Compatível com SELECT md5(encode("fotoData", 'hex')) do inventário PostgreSQL.
export function hashFotoMd5(bytes: Uint8Array): string { return createHash("md5").update(Buffer.from(bytes).toString("hex")).digest("hex"); }

function jpegValido(buffer: Buffer) {
  if (buffer.length < 20 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || !buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) return false;
  let posicao = 2;
  let dimensoes = false;
  while (posicao + 4 <= buffer.length) {
    if (buffer[posicao++] !== 0xff) return false;
    while (buffer[posicao] === 0xff) posicao++;
    const marcador = buffer[posicao++];
    if (posicao + 2 > buffer.length) return false;
    const tamanho = buffer.readUInt16BE(posicao);
    if (tamanho < 2 || posicao + tamanho > buffer.length) return false;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marcador)) {
      dimensoes = tamanho >= 8 && buffer.readUInt16BE(posicao + 3) > 0 && buffer.readUInt16BE(posicao + 5) > 0;
    }
    if (marcador === 0xda) return dimensoes && posicao + tamanho < buffer.length - 2;
    posicao += tamanho;
  }
  return false;
}

function pngValido(buffer: Buffer) {
  if (buffer.length < 57 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || buffer.readUInt32BE(8) !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR" || buffer.readUInt32BE(16) === 0 || buffer.readUInt32BE(20) === 0) return false;
  let dados = false;
  for (let posicao = 8; posicao + 12 <= buffer.length;) {
    const tamanho = buffer.readUInt32BE(posicao);
    const tipo = buffer.toString("ascii", posicao + 4, posicao + 8);
    const fim = posicao + tamanho + 12;
    if (fim > buffer.length) return false;
    if (tipo === "IDAT" && tamanho > 0) dados = true;
    if (tipo === "IEND") return dados && tamanho === 0 && fim === buffer.length;
    posicao = fim;
  }
  return false;
}

function webpValido(buffer: Buffer) {
  if (buffer.length < 25 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP" || buffer.readUInt32LE(4) + 8 !== buffer.length) return false;
  for (let posicao = 12; posicao + 8 <= buffer.length;) {
    const tipo = buffer.toString("ascii", posicao, posicao + 4);
    const tamanho = buffer.readUInt32LE(posicao + 4);
    const inicio = posicao + 8;
    if (inicio + tamanho > buffer.length) return false;
    if (tipo === "VP8L" && tamanho >= 5 && buffer[inicio] === 0x2f) return true;
    if (tipo === "VP8 " && tamanho >= 10 && buffer.subarray(inicio + 3, inicio + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) return true;
    posicao = inicio + tamanho + (tamanho % 2);
  }
  return false;
}

export function validarArquivoFoto(bytes: Uint8Array, foto: Pick<ItemManifestoFoto["foto"], "sha256" | "mimeType">): void {
  if (bytes.length === 0 || bytes.length > TAMANHO_MAXIMO_FOTO) throw new Error("Foto vazia ou acima de 5 MiB.");
  const buffer = Buffer.from(bytes);
  let mime: MimeFoto | null = null;
  if (jpegValido(buffer)) mime = "image/jpeg";
  if (pngValido(buffer)) mime = "image/png";
  if (webpValido(buffer)) mime = "image/webp";
  if (mime !== foto.mimeType) throw new Error("Assinatura da foto diverge do formato informado.");
  if (hashSha256(bytes) !== foto.sha256) throw new Error("Hash da foto diverge do manifesto.");
}

export function planejarFoto(item: ItemManifestoFoto, atual: EstadoFotoInsumo): "aplicar" | "inalterado" {
  if (atual.id !== item.id || atual.tipo !== "INSUMO") throw new Error("O lote contém item ausente ou uma preparação.");
  if (atual.nome !== item.nome || atual.especificacao !== item.especificacao) throw new Error("Identificação do insumo mudou; refaça o manifesto.");
  if (atual.fotoSha256 === item.foto.sha256 && atual.fotoMimeType === item.foto.mimeType) return "inalterado";
  if (normalizarInstante(atual.updatedAt) !== item.updatedAt || atual.fotoHashMd5 !== item.fotoHashMd5) throw new Error("Insumo alterado após o inventário; nenhuma foto pode ser sobrescrita.");
  return "aplicar";
}

export function conferirReversaoFoto(atual: EstadoFotoInsumo, aplicada: { sha256: string; mimeType: string; updatedAt: string }): void {
  if (atual.tipo !== "INSUMO" || atual.fotoSha256 !== aplicada.sha256 || atual.fotoMimeType !== aplicada.mimeType || normalizarInstante(atual.updatedAt) !== normalizarInstante(aplicada.updatedAt)) throw new Error("Foto ou insumo alterado após o lote; reversão bloqueada.");
}
