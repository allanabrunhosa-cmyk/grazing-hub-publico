import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { cifrar, decifrar } from "@/lib/crypto";
import { classificarServicosEmissaoBrasilNfe, validarSubstituicaoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/configuracao-dominio";
import { permissaoEfetiva, recursoDaRota } from "@/lib/permissoes/catalogo";
describe("Segurança das substituições Brasil NFe", () => {
  it.each([{ versao: 0, ambiente: "PRODUCAO" }, { versao: 0, ativo: true }, { versao: 0, tokenSubstituicao: "token\r\nHeader:valor" }, { versao: 0, tokenSubstituicao: "t".repeat(513) }, { versao: -1 }, { versao: 0, userTokenSubstituicao: "contém espaço" }])("recusa campos de ativação, ambiente e injeção: %j", entrada => {
    expect(() => validarSubstituicaoBrasilNfe(entrada)).toThrow();
  });
  it("criptografa com nonce distinto, contexto separado e chave externa obrigatória", () => {
    vi.stubEnv("AUTH_SECRET", "chave-ficticia-exclusiva-deste-teste-com-32-bytes");
    const a = cifrar("segredo-ficticio", "grazing-hub-brasilnfe-token-v1"), b = cifrar("segredo-ficticio", "grazing-hub-brasilnfe-token-v1");
    expect(a).not.toBe(b); expect(a).not.toContain("segredo-ficticio");
    expect(decifrar(a, "grazing-hub-brasilnfe-token-v1")).toBe("segredo-ficticio");
    expect(() => decifrar(a, "grazing-hub-brasilnfe-usertoken-v1")).toThrow();
    vi.stubEnv("AUTH_SECRET", ""); expect(() => cifrar("ficticio", "grazing-hub-brasilnfe-token-v1")).toThrow();
    vi.unstubAllEnvs();
  });
  it("recurso central fiscal é negado por padrão e não depende da administração MCP", () => {
    expect(recursoDaRota("/configuracoes/integracoes/brasilnfe")).toBe("configuracoes.brasilnfe");
    expect(permissaoEfetiva({ "configuracoes.mcp": ["visualizar", "editar"] }, {}, "configuracoes.brasilnfe", "editar")).toBe(false);
  });
});

describe("Catálogo restrito à emissão NF-e/NFC-e", () => {
  it.each([true, false])("serviço combinado ativo=%s determina os dois modelos", ativo => {
    const estado = ativo ? "ATIVO" : "INATIVO";
    expect(classificarServicosEmissaoBrasilNfe([{ nome: "NF-e/NFC-e", ativo }])).toEqual({ nfe: estado, nfce: estado });
  });
  it("serviços fora do escopo não condicionam a confirmação de emissão", () => {
    expect(classificarServicosEmissaoBrasilNfe([{ nome: "NF-e/NFC-e", ativo: true }, { nome: "Sincronizar Docs", ativo: false }, { nome: "NFS-e", ativo: false }])).toEqual({ nfe: "ATIVO", nfce: "ATIVO" });
  });
  it.each([[], [{ nome: "Sincronizar Docs", ativo: true }], [{ nome: "Histórico de NF-e/NFC-e", ativo: true }], [{ nome: "NF-e/NFC-e", ativo: true }, { nome: "NF-e/NFC-e", ativo: false }]].map(servicos => ({ servicos })))("ausência ou catálogo ambíguo não comprova serviço ativo nem inativo: $servicos", ({ servicos }) => {
    expect(classificarServicosEmissaoBrasilNfe(servicos)).toEqual({ nfe: "NAO_CONFIRMADO", nfce: "NAO_CONFIRMADO" });
  });
});
