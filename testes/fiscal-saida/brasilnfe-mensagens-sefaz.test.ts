import { describe, expect, it } from "vitest";
import { mensagemCodigoSefaz } from "@/lib/fiscal-saida/brasilnfe/mensagens-sefaz";

describe("Motivos locais da SEFAZ", () => {
  it.each([[600, "CSOSN"], [204, "Duplicidade"], [205, "denegada"], [539, "diferença na chave"], [462, "CSC"], [463, "revogado"], [464, "Hash"], [787, "identificação"], [788, "endereço"], [789, "contribuinte"], [796, "chave de segurança"]] as const)("explica código %s sem texto livre externo", (codigo, motivo) => {
    expect(mensagemCodigoSefaz(codigo, "EMISSAO")).toContain(motivo);
  });
  it("preserva código desconhecido sem inventar seu motivo", () => {
    expect(mensagemCodigoSefaz(999, "EMISSAO")).toContain("código 999. O motivo ainda não possui tradução no HUB");
    expect(mensagemCodigoSefaz(null, "EMISSAO")).toBeNull();
  });
});
