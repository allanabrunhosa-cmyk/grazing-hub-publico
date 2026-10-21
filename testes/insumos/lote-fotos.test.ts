import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  conferirReversaoFoto, hashFotoMd5, hashSha256, normalizarInstante, planejarFoto,
  resolverArquivoFoto, TAMANHO_MAXIMO_FOTO, validarArquivoFoto, validarManifestoFotos,
  type EstadoFotoInsumo, type ItemManifestoFoto, type ManifestoFotos,
} from "@/lib/insumos/lote-fotos";

const imagem = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrCsAAAAASUVORK5CYII=", "base64");
const item: ItemManifestoFoto = {
  id: "insumo-ficticio", nome: "Ingrediente fictício", especificacao: null,
  updatedAt: "2026-10-02T12:00:00.123000Z", fotoHashMd5: null,
  foto: {
    arquivo: "imagens/ingrediente.png", sha256: hashSha256(imagem), mimeType: "image/png",
    origem: { tipo: "gerada", prompt: "Foto genérica de um ingrediente fictício sem marca nem embalagem." },
  },
};
const manifesto: ManifestoFotos = {
  versao: 1, loteId: "fotos-ficticias-20261002", autorizacaoOperacional: "Pedido humano explícito para preencher as fotos dos insumos.", itens: [item],
};
const atual: EstadoFotoInsumo = {
  id: item.id, nome: item.nome, especificacao: null, tipo: "INSUMO", updatedAt: item.updatedAt,
  fotoHashMd5: null, fotoSha256: null, fotoMimeType: null,
};

describe("manifesto operacional de fotos", () => {
  it("preserva identidade, licença ou prompt e autorização sem criar uma sessão", () => {
    expect(validarManifestoFotos(manifesto, 1)).toEqual(manifesto);
    const daInternet = structuredClone(manifesto);
    daInternet.itens[0].foto.origem = {
      tipo: "internet", sourcePage: "https://example.org/licenca", imageUrl: "https://example.org/foto.png",
      autor: "Autor fictício", licenca: "CC0",
    };
    expect(validarManifestoFotos(daInternet, 1).itens[0].foto.origem).toEqual(daInternet.itens[0].foto.origem);
  });

  it("exige a quantidade conferida e IDs únicos antes de qualquer gravação", () => {
    expect(() => validarManifestoFotos(manifesto, 2)).toThrow(/quantidade/);
    expect(() => validarManifestoFotos({ ...manifesto, itens: [item, item] }, 2)).toThrow(/duplicados/);
    expect(() => validarManifestoFotos(manifesto, 0)).toThrow(/Quantidade/);
  });

  it("recusa manifesto sem autorização e origem sem registro suficiente", () => {
    expect(() => validarManifestoFotos({ ...manifesto, autorizacaoOperacional: "" }, 1)).toThrow(/autorizacao/);
    const semPrompt = structuredClone(manifesto);
    delete semPrompt.itens[0].foto.origem.prompt;
    expect(() => validarManifestoFotos(semPrompt, 1)).toThrow(/prompt/);
    semPrompt.itens[0].foto.origem = { tipo: "internet", sourcePage: "https://example.org", imageUrl: "https://example.org/foto.png" };
    expect(() => validarManifestoFotos(semPrompt, 1)).toThrow(/licença/);
    semPrompt.itens[0].foto.origem.licenca = "CC0";
    semPrompt.itens[0].foto.origem.imageUrl = "https://usuario:senha@example.org/foto.png";
    expect(() => validarManifestoFotos(semPrompt, 1)).toThrow(/credenciais/);
  });

  it("conserva microssegundos da versão e recusa data impossível", () => {
    expect(normalizarInstante("2026-10-02T12:00:00.123456Z")).toBe("2026-10-02T12:00:00.123456Z");
    expect(normalizarInstante("2026-10-02T12:00:00.123Z")).toBe(item.updatedAt);
    expect(() => normalizarInstante("2026-02-31T12:00:00Z")).toThrow(/inexistente/);
    expect(() => normalizarInstante("2026-10-02T12:00:00-03:00")).toThrow(/UTC/);
  });
});

describe("arquivos locais do lote", () => {
  it("resolve foto dentro da pasta e impede escapes de Linux e Windows", () => {
    const base = path.resolve("auditoria-ficticia");
    expect(resolverArquivoFoto(base, "imagens/foto.png")).toBe(path.join(base, "imagens", "foto.png"));
    for (const arquivo of ["../foto.png", "imagens/../../foto.png", "/foto.png", "C:\\foto.png", "imagens\\foto.png", "imagens/./foto.png"]) {
      expect(() => resolverArquivoFoto(base, arquivo)).toThrow(/caminho|Caminho/);
    }
  });

  it("valida bytes do arquivo e não confia na extensão ou no MIME declarado", () => {
    expect(() => validarArquivoFoto(imagem, item.foto)).not.toThrow();
    expect(() => validarArquivoFoto(imagem, { ...item.foto, mimeType: "image/jpeg" })).toThrow(/Assinatura/);
    expect(() => validarArquivoFoto(Buffer.from("<svg></svg>"), item.foto)).toThrow(/Assinatura/);
    expect(() => validarArquivoFoto(Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { ...item.foto, mimeType: "image/jpeg" })).toThrow(/Assinatura/);
    expect(() => validarArquivoFoto(imagem, { ...item.foto, sha256: "0".repeat(64) })).toThrow(/Hash/);
  });

  it("recusa conteúdo vazio, foto truncada e arquivo acima do limite", () => {
    expect(() => validarArquivoFoto(Buffer.alloc(0), item.foto)).toThrow(/vazia/);
    expect(() => validarArquivoFoto(imagem.subarray(0, -4), item.foto)).toThrow(/Assinatura/);
    expect(() => validarArquivoFoto(Buffer.alloc(TAMANHO_MAXIMO_FOTO + 1), item.foto)).toThrow(/5 MiB/);
  });

  it("calcula o hash do inventário sobre o texto HEX usado pelo PostgreSQL", () => {
    const bytes = Buffer.from([0, 255, 127]);
    expect(hashFotoMd5(bytes)).toBe(createHash("md5").update("00ff7f").digest("hex"));
    expect(hashFotoMd5(bytes)).not.toBe(createHash("md5").update(bytes).digest("hex"));
  });
});

describe("planejamento e repetição do lote", () => {
  it("preenche um insumo conferido e ignora a mesma foto já aplicada", () => {
    expect(planejarFoto(item, atual)).toBe("aplicar");
    expect(planejarFoto(item, { ...atual, updatedAt: "2026-10-02T14:00:00Z", fotoSha256: item.foto.sha256, fotoMimeType: item.foto.mimeType })).toBe("inalterado");
  });

  it("jamais preenche uma preparação nem troca uma foto após edição concorrente", () => {
    expect(() => planejarFoto(item, { ...atual, tipo: "PRODUTO_INTERMEDIARIO" })).toThrow(/preparação/);
    expect(() => planejarFoto(item, { ...atual, id: "outro-insumo" })).toThrow(/ausente/);
    expect(() => planejarFoto(item, { ...atual, updatedAt: "2026-10-02T12:00:00.123001Z" })).toThrow(/alterado/);
    expect(() => planejarFoto(item, { ...atual, fotoHashMd5: "0".repeat(32) })).toThrow(/alterado/);
  });

  it("bloqueia mapeamento obsoleto mesmo que a imagem tenha o mesmo hash", () => {
    const comFoto = { ...atual, fotoSha256: item.foto.sha256, fotoMimeType: item.foto.mimeType };
    expect(() => planejarFoto(item, { ...comFoto, nome: "Outro ingrediente" })).toThrow(/Identificação/);
    expect(() => planejarFoto(item, { ...comFoto, especificacao: "Alterada" })).toThrow(/Identificação/);
  });
});

describe("reversão específica de fotos", () => {
  const aplicada = { sha256: item.foto.sha256, mimeType: item.foto.mimeType, updatedAt: "2026-10-02T14:00:00.000000Z" };
  const estadoAplicado = { ...atual, fotoSha256: aplicada.sha256, fotoMimeType: aplicada.mimeType, updatedAt: aplicada.updatedAt };

  it("autoriza reversão somente da foto e versão gravadas pelo lote", () => {
    expect(() => conferirReversaoFoto(estadoAplicado, aplicada)).not.toThrow();
    expect(() => conferirReversaoFoto({ ...estadoAplicado, updatedAt: "2026-10-02T14:00:00.000001Z" }, aplicada)).toThrow(/bloqueada/);
    expect(() => conferirReversaoFoto({ ...estadoAplicado, fotoSha256: "0".repeat(64) }, aplicada)).toThrow(/bloqueada/);
    expect(() => conferirReversaoFoto({ ...estadoAplicado, fotoMimeType: "image/jpeg" }, aplicada)).toThrow(/bloqueada/);
    expect(() => conferirReversaoFoto({ ...estadoAplicado, tipo: "PRODUTO_INTERMEDIARIO" }, aplicada)).toThrow(/bloqueada/);
  });
});
