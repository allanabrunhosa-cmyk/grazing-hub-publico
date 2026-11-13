import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { escolherInstantePreparacaoBrasilNfe, dataHoraEmissaoBrasilNfeValida, fotografarDatasEmissaoBrasilNfe, instanteEmissaoBrasilNfe, instanteEmissaoRecenteBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/datas-emissao";
import { prepararPayloadLocalBrasilNfe, prepararPayloadSnapshotBrasilNfeLocal, serializarPayloadLocalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/payload-local";
import type { DocumentoBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-contrato";
import { massaPayloadLocal } from "./brasilnfe-payload-local-fixtures";

const instante = "2026-11-13T10:00:00-03:00";
function massa(modelo: 55 | 65) {
  const m = massaPayloadLocal();
  const base = prepararPayloadLocalBrasilNfe(m.documento, modelo, m.cadastro, m.parametros, "PRODUCAO");
  const tributacao = { apto: true, pendencias: [], emitenteCnpj: m.cadastro.cnpj, emitenteIE: m.parametros.emitente.ie, crt: 1,
    documento: base.payload as unknown as DocumentoBrasilNfe, previa: { contexto: { data: "2026-11-13" } } };
  return { ...m, tributacao };
}
describe("Datas fiscais prospectivas, antes do hash de transmissão", () => {
  it("usa o instante fiscal de Brasília e conserva a virada civil do dia", () => {
    expect(instanteEmissaoBrasilNfe(new Date("2026-11-14T01:30:15Z"))).toBe("2026-11-13T22:30:15-03:00");
    expect(() => instanteEmissaoBrasilNfe(new Date(NaN))).toThrow("inválidas");
  });
  it.each(["2026-02-30T10:00:00-03:00", "2026-11-13T24:00:00-03:00", "2026-11-13T10:00:00", "2026-11-13T10:00:00Z", "2026-11-13T10:00:00+14:01", "texto"])("recusa data impossível, sem fuso ou fora do formato: %s", valor => {
    expect(dataHoraEmissaoBrasilNfeValida(valor)).toBe(false);
  });
  it.each([55, 65] as const)("fotografa emissão modelo%s e serializa os mesmos campos sem tocar no legado", modelo => {
    const m = massa(modelo), antes = structuredClone(m.tributacao);
    const t = fotografarDatasEmissaoBrasilNfe(m.tributacao, instante);
    const d = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: t } };
    const corpo = serializarPayloadLocalBrasilNfe(prepararPayloadSnapshotBrasilNfeLocal(d, modelo, { cnpj: m.cadastro.cnpj, ambiente: "PRODUCAO" }));
    const fiscal = JSON.parse(corpo);
    expect(fiscal.DataEmissao).toBe(instante);
    if (modelo === 55) expect(fiscal.DataEntradaSaida).toBe(fiscal.DataEmissao);
    else expect(fiscal).not.toHaveProperty("DataEntradaSaida");
    expect(m.tributacao).toEqual(antes);
    expect(fotografarDatasEmissaoBrasilNfe(m.tributacao)).toBe(m.tributacao);
    const semDatas = { ...d, payload: { ...d.payload, tributacao: m.tributacao } };
    const antigo = serializarPayloadLocalBrasilNfe(prepararPayloadSnapshotBrasilNfeLocal(semDatas, modelo, { cnpj: m.cadastro.cnpj, ambiente: "PRODUCAO" }));
    expect(JSON.parse(antigo)).not.toHaveProperty("DataEmissao");
    expect(createHash("sha256").update(corpo).digest("hex")).not.toBe(createHash("sha256").update(antigo).digest("hex"));
  });
  it.each(["SAIDA_DIVERGENTE", "SAIDA_AUSENTE", "DIA_DIVERGENTE", "DATA_INVALIDA"])("recusa datas incoerentes antes de serializar: %s", caso => {
    const m = massa(55), t = fotografarDatasEmissaoBrasilNfe(m.tributacao, instante);
    if (caso === "SAIDA_DIVERGENTE") t.documento.DataEntradaSaida = "2026-11-13T09:00:00-03:00";
    if (caso === "SAIDA_AUSENTE") delete t.documento.DataEntradaSaida;
    if (caso === "DIA_DIVERGENTE") { t.documento.DataEmissao = "2026-11-12T10:00:00-03:00"; t.documento.DataEntradaSaida = t.documento.DataEmissao; }
    if (caso === "DATA_INVALIDA") { t.documento.DataEmissao = "2026-02-30T10:00:00-03:00"; t.documento.DataEntradaSaida = t.documento.DataEmissao; }
    const d = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: t } };
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(d, 55, { cnpj: m.cadastro.cnpj, ambiente: "PRODUCAO" })).toThrow(/data/i);
  });
  it("não permite data de saída separada na NFC-e", () => {
    const m = massa(65), t = fotografarDatasEmissaoBrasilNfe(m.tributacao, instante); t.documento.DataEntradaSaida = instante;
    const d = { ...m.documento, payload: { ...m.documento.payload, versao: 2, tributacao: t } };
    expect(() => prepararPayloadSnapshotBrasilNfeLocal(d, 65, { cnpj: m.cadastro.cnpj, ambiente: "PRODUCAO" })).toThrow(/NFC-e/);
  });
  it("reabrir rascunho em60s conserva idempotência; data envelhecida no mesmo dia gera nova fotografia", () => {
    const anterior = { status: "PREPARADO", tentativas: 0, payload: { tributacao: { documento: { DataEmissao: instante } } } };
    const antes = structuredClone(anterior);
    expect(escolherInstantePreparacaoBrasilNfe(anterior, new Date("2026-11-13T13:00:30Z"))).toBe(instante);
    expect(escolherInstantePreparacaoBrasilNfe(anterior, new Date("2026-11-13T13:01:00Z"))).toBe(instante);
    expect(escolherInstantePreparacaoBrasilNfe(anterior, new Date("2026-11-13T13:01:01Z"))).toBe("2026-11-13T10:01:01-03:00");
    expect(escolherInstantePreparacaoBrasilNfe(anterior, new Date("2026-11-13T15:00:00Z"))).toBe("2026-11-13T12:00:00-03:00");
    expect(escolherInstantePreparacaoBrasilNfe(anterior, new Date("2026-11-14T15:00:00Z"))).toBe("2026-11-14T12:00:00-03:00");
    expect(anterior).toEqual(antes);
  });
  it.each([[0, true], [59_999, true], [60_000, true], [60_001, false], [-1, false]] as const)("janela conservadora respeita diferença de%s ms", (diferenca, esperado) => {
    expect(instanteEmissaoRecenteBrasilNfe(instante, new Date(Date.parse(instante) + diferenca))).toBe(esperado);
  });
  it.each(["referenciaProvedor", "chaveFiscal", "protocolo", "acao", "leaseToken"] as const)("rascunho com%s preserva o instante mesmo com contador zero", campo => {
    const anterior = { status: "PREPARADO", tentativas: 0, payload: { tributacao: { documento: { DataEmissao: instante } } }, [campo]: "referencia-sintetica" };
    expect(escolherInstantePreparacaoBrasilNfe(anterior, new Date("2026-11-14T15:00:00Z"))).toBe(instante);
  });
  it.each(["AUTORIZADO", "PENDENTE_CONFERENCIA", "INCERTO", "PROCESSANDO"])("preserva a ausência histórica e o instante de %s, sem retroagir correção", status => {
    const semData = { status, tentativas: 1, payload: { tributacao: { documento: {} } } };
    expect(escolherInstantePreparacaoBrasilNfe(semData, new Date("2026-11-14T15:00:00Z"))).toBeUndefined();
    expect(escolherInstantePreparacaoBrasilNfe({ ...semData, payload: { tributacao: { documento: { DataEmissao: instante } } } }, new Date("2026-11-14T15:00:00Z"))).toBe(instante);
  });
  it("nova tentativa de rejeição certa recebe instante novo e preserva a tentativa anterior", () => {
    const anterior = { status: "REJEITADO", tentativas: 1, payload: { tributacao: { documento: { DataEmissao: instante } } } };
    expect(escolherInstantePreparacaoBrasilNfe(anterior, new Date("2026-11-13T15:00:00Z"))).toBe(instante);
    expect(escolherInstantePreparacaoBrasilNfe(null, new Date("2026-11-13T15:00:00Z"))).toBe("2026-11-13T12:00:00-03:00");
    expect(anterior.payload.tributacao.documento.DataEmissao).toBe(instante);
  });
});
