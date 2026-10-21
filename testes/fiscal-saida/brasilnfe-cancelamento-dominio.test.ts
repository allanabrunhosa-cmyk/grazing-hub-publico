import { describe, expect, it } from "vitest";
import { validarComandoCancelamentoPedidoBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/cancelamento-dominio";
import { mensagemCodigoSefaz } from "@/lib/fiscal-saida/brasilnfe/mensagens-sefaz";
const comando = { documentoId: "documento-sintetico", modelo: 65, ambiente: "HOMOLOGACAO", chaveFiscal: "0".repeat(44), protocolo: "123", justificativa: "Cancelamento exclusivamente sintético.", confirmarCancelamento: true };
describe("Confirmação individual de cancelamento", () => {
  it.each([55, 65])("aceita modelo%s com confirmação e justificativa explícitas", modelo => {
    expect(validarComandoCancelamentoPedidoBrasilNfe({ ...comando, modelo })).toEqual({ ...comando, modelo });
  });
  it.each([{ confirmarCancelamento: false }, { confirmarCancelamento: undefined }, { modelo: 57 }, { ambiente: "OUTRO" }, { chaveFiscal: "1" }, { protocolo: "" }, { documentoId: "../nota" }, { extra: true }])("recusa comando divergente %j", alteracao => {
    expect(() => validarComandoCancelamentoPedidoBrasilNfe({ ...comando, ...alteracao })).toThrow("Confirme");
  });
  it.each(["curto", " ".repeat(20), "a".repeat(256), "Motivo com quebra\nindevida", "Motivo com <html> inválido"])("recusa justificativa inválida %j", justificativa => {
    expect(() => validarComandoCancelamentoPedidoBrasilNfe({ ...comando, justificativa })).toThrow("15 a 255");
  });
  it("preserva número de protocolo como texto e normaliza somente espaço externo", () => {
    const r = validarComandoCancelamentoPedidoBrasilNfe({ ...comando, protocolo: "90071992547409930001", justificativa: ` ${comando.justificativa} ` });
    expect(r.protocolo).toBe("90071992547409930001"); expect(r.justificativa).toBe(comando.justificativa);
  });
});
describe("Motivo fiscal compreensível sem publicar resposta externa", () => {
  it.each([[232, "inscrição estadual"], [778, "NCM"], [591, "regime tributário"], [611, "Código de barras"]] as const)("explica código%s", (codigo, texto) => {
    expect(mensagemCodigoSefaz(codigo, "EMISSAO")).toContain(texto);
  });
  it("separa prazo de cancelamento do contexto de emissão", () => {
    expect(mensagemCodigoSefaz(501, "CANCELAMENTO")).toContain("Prazo de cancelamento");
    expect(mensagemCodigoSefaz(501, "EMISSAO")).toBe("SEFAZ retornou o código 501. O motivo ainda não possui tradução no HUB. Consulte o retorno no emissor antes de repetir a operação.");
    expect(mensagemCodigoSefaz(null, "CANCELAMENTO")).toBeNull();
  });
});
