import { describe, expect, it } from "vitest";
import { codigoCopiaEtiqueta, codigoInicialEtiqueta, correspondeCodigoEtiqueta, faixaCodigosEtiqueta } from "@/lib/etiquetas/rastreio";

describe("identidade individual das etiquetas", () => {
  it("consulta os códigos aleatórios de cada cópia sem inferir uma sequência", () => {
    const codigos = ["A1B2C3", "Z9X8W7", "K4L5M6"];
    expect(codigoCopiaEtiqueta(codigos[0], 2, codigos)).toBe("Z9X8W7");
    expect(faixaCodigosEtiqueta(codigos[0], 3, codigos)).toBe("A1B2C3 · 3 códigos");
    expect(correspondeCodigoEtiqueta(codigos[0], 3, "#z9x8w7", codigos)).toBe(true);
    expect(correspondeCodigoEtiqueta(codigos[0], 3, "A1B2C4", codigos)).toBe(false);
    expect(() => codigoCopiaEtiqueta(codigos[0], 4, codigos)).toThrow();
  });
  it("distingue todas as cópias de emissões diferentes", () => {
    const codigos = Array.from({ length: 100 }, (_, emissao) => Array.from({ length: 50 }, (_, copia) => codigoCopiaEtiqueta(codigoInicialEtiqueta(String(emissao + 1)), copia + 1))).flat();
    expect(new Set(codigos).size).toBe(5000);
    expect(codigos[0]).toBe("ET000001-001");
    expect(codigos[49]).toBe("ET000001-050");
    expect(codigoInicialEtiqueta("36")).toBe("ET000010-001");
  });
  it("não reinicia a sequência nem aceita índices fora do domínio", () => {
    expect(() => codigoInicialEtiqueta("0")).toThrow();
    expect(() => codigoInicialEtiqueta("2176782336")).toThrow();
    for (const copia of [0, -1, 1.5, 1000]) expect(() => codigoCopiaEtiqueta("ET000001-001", copia)).toThrow();
  });
  it("localiza qualquer código do lote e recusa cópias que não pertencem a ele", () => {
    expect(faixaCodigosEtiqueta("ET000001-001", 30)).toBe("ET000001-001 a ET000001-030");
    expect(correspondeCodigoEtiqueta("ET000001-001", 30, "#et000001-023")).toBe(true);
    expect(correspondeCodigoEtiqueta("ET000001-001", 30, "ET000001-031")).toBe(false);
    expect(correspondeCodigoEtiqueta("ET000001-001", 30, "ET000002-023")).toBe(false);
    expect(correspondeCodigoEtiqueta("ET000001-001", 30, "ET000001-000")).toBe(false);
  });
  it("preserva códigos históricos sem afirmar que eram individuais", () => {
    expect(codigoCopiaEtiqueta("A1B2C3", 2)).toBe("A1B2C3");
    expect(faixaCodigosEtiqueta("A1B2C3", 30)).toBe("A1B2C3");
  });
});
