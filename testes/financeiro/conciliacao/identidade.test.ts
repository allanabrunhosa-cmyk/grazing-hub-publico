import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { compararImportacao, identificarLinhas, type TransacaoAnterior } from "@/lib/financeiro/conciliacao/identidade";
import type { ArquivoExtrato, LinhaArquivo } from "@/lib/financeiro/conciliacao/arquivo";

const linha = (identificador = "20260911001", descricao = "PIX FORNECEDOR", centavos = -10000): LinhaArquivo =>
  ({ indice: 0, data: "2026-09-11", descricao, centavos, identificador });
const arquivo = (linhas: LinhaArquivo[], banco = "341"): ArquivoExtrato =>
  ({ formato: "OFX", referenciaOfx: banco + " / 0001 / 12345", linhasSaldoIgnoradas: 0, linhas });
function anterior(item: LinhaArquivo, legado = false, banco = "341"): TransacaoAnterior {
  const identificada = identificarLinhas(arquivo([item], banco), "arquivo")[0];
  return { ...identificada, id: "anterior-" + item.identificador, formato: "OFX", conciliada: true,
    chave: legado ? createHash("sha256").update("ID:OFX:" + item.identificador).digest("hex") : identificada.chave };
}

describe("identidade dos OFXs do Itaú com numeração por dia", () => {
  it("reconhece registros legados conciliados com outro FITID e aceita o FITID reutilizado", () => {
    const antigas = [anterior(linha(), true)];
    const novas = identificarLinhas(arquivo([linha("20260911001", "BOLETO NOVO", -20000), { ...linha("20260911004"), indice: 1 }]), "novo");
    expect(compararImportacao(novas, antigas).map(l => [l.situacao, l.conciliada]))
      .toEqual([["NOVA", false], ["EXISTENTE", true]]);
    expect(antigas[0].identificador).toBe("20260911001");
  });
  it("mantém identidade ao importar novamente com uma terceira numeração", () => {
    const novas = identificarLinhas(arquivo([linha("20260911008")]), "novo");
    expect(compararImportacao(novas, [anterior(linha())])[0]).toMatchObject({ situacao: "EXISTENTE", conciliada: true });
  });
  it("não ignora descrição diferente nem interrompe as outras linhas do arquivo", () => {
    const novas = identificarLinhas(arquivo([linha("20260911001", "PIX OUTRO"), { ...linha("20260911002", "BOLETO", -20000), indice: 1 }]), "novo");
    const previa = compararImportacao(novas, [anterior(linha(), true)]);
    expect(previa[0]).toMatchObject({ situacao: "POSSIVEL_DUPLICADA", conciliada: false, observacao: expect.stringContaining("PIX FORNECEDOR") });
    expect(previa[1].situacao).toBe("NOVA");
  });
  it("preserva a quantidade de pagamentos idênticos e solicita conferência do excedente", () => {
    const antigas = [anterior(linha("20260911001"), true), anterior(linha("20260911002"), true)];
    const novas = identificarLinhas(arquivo([3, 4, 5].map((n, indice) => ({ ...linha("2026091100" + n), indice }))), "novo");
    expect(new Set(novas.map(l => l.chave)).size).toBe(3);
    expect(compararImportacao(novas, antigas).map(l => l.situacao)).toEqual(["EXISTENTE", "EXISTENTE", "POSSIVEL_DUPLICADA"]);
  });
  it("não usa uma ocorrência já reservada ao reimportar uma seleção parcial", () => {
    const novas = identificarLinhas(arquivo([1, 2].map((n, indice) => ({ ...linha("2026091100" + n), indice }))), "novo");
    const segunda = { ...anterior(linha("20260911002")), chave: novas[1].chave };
    expect(compararImportacao(novas, [segunda]).map(l => l.situacao)).toEqual(["POSSIVEL_DUPLICADA", "EXISTENTE"]);
  });
  it("normaliza apenas espaços e caixa sem eliminar números da descrição", () => {
    const existentes = [anterior(linha("20260911001", "PIX  JOAO 123"), true)];
    expect(compararImportacao(identificarLinhas(arquivo([linha("20260911002", "pix joao 123")]), "novo"), existentes)[0].situacao).toBe("EXISTENTE");
    expect(compararImportacao(identificarLinhas(arquivo([linha("20260911002", "PIX JOAO 456")]), "novo"), existentes)[0].situacao).toBe("POSSIVEL_DUPLICADA");
  });
  it("não transforma CSV ou registros informativos de saldo em correspondência do Itaú", () => {
    const novas = identificarLinhas(arquivo([linha()]), "novo");
    expect(compararImportacao(novas, [{ ...anterior(linha(), true), formato: "CSV" }])[0].situacao).toBe("NOVA");
    expect(compararImportacao(identificarLinhas(arquivo([linha("20260911002", "SALDO ANTERIOR")]), "novo"), [anterior(linha("20260911001", "SALDO ANTERIOR"), true)])[0].situacao).toBe("NOVA");
  });
  it.each(["001", "237"])("mantém proteção por FITID para outro banco (%s)", banco => {
    const novas = identificarLinhas(arquivo([linha("20260911001", "PIX", -1)], banco), "novo");
    expect(() => compararImportacao(novas, [anterior(linha(), false, banco)])).toThrow(/identificador/);
  });
  it("mantém proteção para identificadores não sequenciais do Itaú", () => {
    const novas = identificarLinhas(arquivo([linha("id-permanente", "PIX", -1)]), "novo");
    expect(() => compararImportacao(novas, [anterior(linha("id-permanente"))])).toThrow(/identificador/);
  });
});
