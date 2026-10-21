import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { correspondeFiltroNfse, situacaoNfse } from "@/lib/nfse/filtros";
import { compactarXmlsNfse, periodoExportacaoNfse } from "@/lib/nfse/exportacao";

const nota = { status: "PENDENTE", lancada: false, prestadorNome: "Serviços São Paulo", prestadorCnpj: "12345678000195", chaveAcesso: "chave-123", numero: "42", dataEmissao: "2026-09-15T12:00:00.000Z" };
const filtro = { situacao: "PENDENTE", busca: "", de: "", ate: "" };

describe("filtros do manifesto de NFS", () => {
  it("separa pendentes, lançadas e ignoradas e inclui canceladas em Todas", () => {
    for (const status of ["PENDENTE", "ACEITA", "LANCADA", "RECUSADA", "IGNORADA", "CANCELADA"]) {
      expect(correspondeFiltroNfse({ ...nota, status }, filtro)).toBe(status === "PENDENTE");
      expect(correspondeFiltroNfse({ ...nota, status }, { ...filtro, situacao: "TODAS" })).toBe(true);
    }
    expect(correspondeFiltroNfse({ ...nota, status: "ACEITA" }, { ...filtro, situacao: "ACEITA" })).toBe(true);
    expect(correspondeFiltroNfse({ ...nota, status: "LANCADA", lancada: true }, { ...filtro, situacao: "ACEITA" })).toBe(true);
    expect(correspondeFiltroNfse({ ...nota, status: "RECUSADA" }, { ...filtro, situacao: "RECUSADA" })).toBe(true);
    expect(situacaoNfse({ status: "PENDENTE", lancada: true })).toBe("ACEITA");
  });
  it("combina busca sem acentos, documento formatado e datas inclusivas", () => {
    for (const busca of ["servicos sao", "12.345.678/0001-95", "chave-123", "42"]) {
      expect(correspondeFiltroNfse(nota, { ...filtro, busca, de: "2026-09-15", ate: "2026-09-15" })).toBe(true);
    }
    expect(correspondeFiltroNfse(nota, { ...filtro, de: "2026-09-16" })).toBe(false);
    expect(correspondeFiltroNfse(nota, { ...filtro, ate: "2026-09-14" })).toBe(false);
    expect(correspondeFiltroNfse(nota, { ...filtro, busca: "outro prestador" })).toBe(false);
    expect(correspondeFiltroNfse({ ...nota, dataEmissao: null }, { ...filtro, de: "2026-09-10" })).toBe(false);
  });
});

describe("exportação dos XMLs originais", () => {
  it("permite exportar importações antigas, valida datas e inclui todo o último dia", () => {
    expect(periodoExportacaoNfse("", "")).toEqual({});
    expect(periodoExportacaoNfse("2025-01-01", "2026-09-15")).toEqual({ gte: new Date("2025-01-01"), lt: new Date("2026-09-16") });
    expect(periodoExportacaoNfse("", "2026-09-04")).toEqual({ lt: new Date("2026-09-05") });
    expect(() => periodoExportacaoNfse("2026-02-30", "")).toThrow();
    expect(() => periodoExportacaoNfse("2026-09-16", "2026-09-15")).toThrow();
  });
  it("não altera o conteúdo nem sobrescreve notas com o mesmo número", async () => {
    const notas = [
      { id: "primeira", numero: "42", xml: '<?xml version="1.0" encoding="UTF-8"?>\r\n<NFSe><Nome>Serviços &amp; Cia</Nome></NFSe>' },
      { id: "segunda", numero: "42", xml: "<NFSe>outra nota</NFSe>" },
    ];
    const zip = await JSZip.loadAsync(await compactarXmlsNfse(notas));
    expect(Object.keys(zip.files)).toHaveLength(2);
    for (const n of notas) expect(await zip.file(`nfse-42-${n.id}.xml`)!.async("string")).toBe(n.xml);
  });
});
