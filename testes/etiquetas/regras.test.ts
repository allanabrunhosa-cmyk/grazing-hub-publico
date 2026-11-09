import { describe, expect, it } from "vitest";
import { fimDoDiaLocal, formatarDataEtiqueta, somarDiasDeCalendario } from "@/lib/etiquetas/datas";
import { normalizarQuantidade } from "@/lib/etiquetas/validacao";
import { gerarZplEtiqueta, sanitizarTextoZpl } from "@/lib/etiquetas/zpl";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";
import { comporLinhasEtiqueta } from "@/lib/etiquetas/layout";
import { dimensionarFonte0 } from "@/lib/etiquetas/fonte-zpl";

function dados(parcial: Partial<DadosEtiqueta> = {}): DadosEtiqueta {
  return {
    produtoNome: "Creme de queijo com maçã",
    lojaNome: "Grazing Table & Co",
    lojaCnpj: "34.599.471/0001-80",
    lojaEndereco: "Rua das Flores, 973, São Paulo, SP",
    conservacao: "REFRIGERADO",
    quantidade: "1.250",
    unidade: "KG",
    lote: "ABC-123",
    marcaFornecedor: "Aurora",
    sif: "953",
    validadeOriginal: "2027-01-10",
    codigoRastreio: "A1B2C3",
    responsavelManipulacao: "Ana",
    manipuladoEm: "2026-12-31T22:30:00.000Z",
    validoAte: "2027-01-02T22:30:00.000Z",
    fusoHorario: "America/Sao_Paulo",
    resolucaoDpi: 203,
    tamanho: "MM_60X40",
    mostrarHora: true,
    copias: 2,
    ...parcial,
  };
}

describe("regras de validade", () => {
  it("soma dias de calendário no fuso da loja e atravessa o ano", () => {
    const manipulacao = new Date("2026-12-31T22:30:00.000Z"); // 19:30 em São Paulo
    const validade = somarDiasDeCalendario(manipulacao, 2, "America/Sao_Paulo");
    expect(validade.toISOString()).toBe("2027-01-02T22:30:00.000Z");
    expect(formatarDataEtiqueta(validade.toISOString(), "America/Sao_Paulo", true)).toContain("02/01/2027");
  });

  it("não transforma ausência ou zero em um dia", () => {
    expect(() => somarDiasDeCalendario(new Date(), 0, "America/Sao_Paulo")).toThrow(/positivos/);
  });

  it("interpreta a validade original no fim do dia da loja", () => {
    expect(fimDoDiaLocal("2027-01-01", "America/Sao_Paulo").toISOString()).toBe("2027-01-02T02:59:00.000Z");
  });
});

describe("validação decimal estrita", () => {
  it.each([["1,250", "1.250"], ["0,001", "0.001"], ["12", "12"]])("aceita %s", (entrada, esperado) => {
    expect(normalizarQuantidade(entrada)).toBe(esperado);
  });

  it.each(["0", "-1", "1kg", "1.2.3", "1e3", "NaN", "1,2345"])("rejeita %s", (entrada) => {
    expect(() => normalizarQuantidade(entrada)).toThrow();
  });
});

describe("ZPL seguro e consistente", () => {
  it("atribui códigos aleatórios a cada cópia sem repetir o logo e limpa somente seu formato RAM", () => {
    const codigosRastreio = ["A1B2C3", "Z9Y8X7", "D4E5F6"];
    const zpl = gerarZplEtiqueta(dados({ codigoRastreio: codigosRastreio[0], codigosRastreio, copias: 3 }));
    const formatos = zpl.match(/\^XA[\s\S]*?\^XZ/g)!;
    expect(formatos).toHaveLength(5);
    expect(formatos[0]).toMatch(/^\^XA\n\^DFR:GVA1B2C3\.ZPL\^FS/);
    expect(formatos[0]).not.toContain("^PQ");
    expect(formatos[0]).not.toContain("^FD#A1B2C3");
    expect(zpl).not.toContain("^FN");
    expect(zpl.match(/\^GFA/g)).toHaveLength(1);
    expect(zpl).not.toContain("^SN");
    for (const [indice, codigo] of codigosRastreio.entries()) {
      const copia = formatos[indice + 1];
      expect(copia).toMatch(/^\^XA\n\^XFR:GVA1B2C3\.ZPL\^FS\n\^FO/);
      expect(copia.match(new RegExp(`\\^FD#${codigo}\\^FS`, "g"))).toHaveLength(2);
      expect(copia).toMatch(/\^PQ1,0,1,N\n\^XZ$/);
      expect(copia).not.toContain("^GFA");
    }
    expect(formatos.at(-1)).toBe("^XA\n^IDR:GVA1B2C3.ZPL^FS\n^XZ");
    expect(zpl).not.toMatch(/\^ID[^\n]*\*|\^(?:DF|XF|ID)[EBA]:/);
    expect(zpl.startsWith("^XA")).toBe(true);
    expect(zpl.endsWith("^XZ")).toBe(true);
  });

  it.each([203, 300, 600])("transporta 50 códigos a %i dpi dentro do limite do conector", (resolucaoDpi) => {
    const codigosRastreio = Array.from({ length: 50 }, (_, indice) => indice.toString(36).toUpperCase().padStart(6, "0"));
    const zpl = gerarZplEtiqueta(dados({ tamanho: "MM_60X60", resolucaoDpi, codigoRastreio: codigosRastreio[0], codigosRastreio, copias: 50 }));
    expect(zpl.match(/\^PQ1,0,1,N/g)).toHaveLength(50);
    expect(zpl.match(/\^XF/g)).toHaveLength(50);
    expect(zpl.match(/\^GFA/g)).toHaveLength(1);
    expect(zpl.length).toBeLessThanOrEqual(200_000);
    expect(zpl).toMatch(/^[\x00-\x7F]+$/);
  });

  it.each([
    { copias: 2, codigosRastreio: ["A1B2C3"] },
    { copias: 1, codigosRastreio: ["A1B2C3", "D4E5F6"] },
    { copias: 2, codigosRastreio: ["A1B2C3", "A1B2C3"] },
    { copias: 2, codigosRastreio: ["A1B2C3", "abc123"] },
    { copias: 2, codigosRastreio: ["A1B2C3", "ABCDE"] },
    { copias: 2, codigosRastreio: ["A1B2C3", "AB^XZ1"] },
    { copias: 2, codigosRastreio: ["D4E5F6", "A1B2C3"] },
    { copias: 0, codigosRastreio: [] },
  ])("recusa lista de códigos incompatível antes de gerar ZPL: %j", (parcial) => {
    expect(() => gerarZplEtiqueta(dados({ codigoRastreio: "A1B2C3", ...parcial }))).toThrow(/códigos das etiquetas/);
  });

  it("recusa lista esparsa ou valores que não sejam strings", () => {
    const listaEsparsa = new Array<string>(2);
    listaEsparsa[0] = "A1B2C3";
    for (const codigosRastreio of [listaEsparsa, ["A1B2C3", 123456] as unknown as string[], null as unknown as string[]]) {
      expect(() => gerarZplEtiqueta(dados({ codigoRastreio: "A1B2C3", codigosRastreio, copias: 2 }))).toThrow(/códigos das etiquetas/);
    }
  });

  it.each(["MM_60X40", "MM_60X60"] as const)("usa as métricas da prévia para códigos largos e estreitos no formato %s", (tamanho) => {
    const codigosRastreio = ["IIIIII", "WWWWWW", "M0A9Z7"];
    const entrada = dados({ tamanho, codigoRastreio: codigosRastreio[0], codigosRastreio, copias: 3 });
    const zpl = gerarZplEtiqueta(entrada);
    const formatos = zpl.match(/\^XA[\s\S]*?\^XZ/g)!;
    for (const [indice, codigo] of codigosRastreio.entries()) {
      const linha = comporLinhasEtiqueta({ ...entrada, codigoRastreio: codigo }).find((item) => item.chave === "codigo")!;
      const { larguraFonte } = dimensionarFonte0(linha.texto, linha.larguraLetra);
      const fontes = [...formatos[indice + 1].matchAll(/\^A0N,(\d+),(\d+)\n\^FD#/g)];
      expect(fontes).toHaveLength(2);
      for (const fonte of fontes) {
        expect(Number(fonte[1])).toBe(tamanho === "MM_60X40" ? 18 : 22);
        expect(Number(fonte[2])).toBe(larguraFonte);
      }
      expect(formatos[indice + 1]).toContain(`^FO${linha.x},${linha.y}`);
      expect(formatos[indice + 1]).toContain(`^FO${linha.x + 1},${linha.y}`);
    }
  });

  it("serializa cada cópia na Zebra sem repetir o logo ou aumentar o pacote por cópia", () => {
    const lote = gerarZplEtiqueta(dados({ codigoRastreio: "ET000001-001", copias: 50 }));
    expect(lote.match(/\^SN#ET000001-001,1,Y\^FS/g)).toHaveLength(2);
    expect(lote).toContain("^PQ50,0,1,N");
    expect(lote.match(/\^GFA/g)).toHaveLength(1);
    expect(lote.length).toBeLessThan(200_000);
    expect(gerarZplEtiqueta(dados())).not.toContain("^SN");
  });
  it.each([
    ["SECO", "AMBIENTE"],
    ["APOS_ABERTO", "APOS ABERTO"],
  ] as const)("identifica a conservação %s na etiqueta", (conservacao, texto) => {
    expect(comporLinhasEtiqueta(dados({ conservacao })).some((linha) => linha.texto === texto)).toBe(true);
  });
  it.each([203, 300, 600])("mantém todos os campos dentro da mídia a %i dpi", (dpi) => {
    const linhas = comporLinhasEtiqueta(dados({ resolucaoDpi: dpi }));
    for (const linha of linhas) {
      expect(linha.x + linha.texto.length * linha.larguraLetra).toBeLessThanOrEqual(Math.ceil(58 * dpi / 25.4));
      expect(linha.y + linha.fonte).toBeLessThanOrEqual(Math.ceil(39 * dpi / 25.4));
    }
    expect(linhas.find(l => l.chave === "validade-valor")?.texto).toContain("02/01/2027");
  });
  it("bloqueia um lote longo sem cortar silenciosamente", () => {
    expect(() => gerarZplEtiqueta(dados({ lote: "X".repeat(80) }))).toThrow(/não cabe/);
  });
  it("neutraliza comandos do lote e gera uma única terminação", () => {
    const zpl = gerarZplEtiqueta(dados({ lote: "LOTE ^XZ ~HS\n<script>" }));
    expect(zpl.match(/\^XZ/g)).toHaveLength(1);
    expect(zpl).not.toContain("~HS");
    expect(zpl).toContain("LOTE XZ HS <script>");
    expect(zpl).toContain("^PW480");
    expect(zpl).toContain("^LL320");
    expect(zpl).toContain("^PQ2,0,1,N");
    expect(zpl).toContain("^GFA,");
    expect(zpl).toContain("MARCA/FORN.:");
    expect(zpl).toContain("AURORA");
  });

  it("usa 480 pontos de altura na mídia 60×60", () => {
    expect(gerarZplEtiqueta(dados({ tamanho: "MM_60X60" }))).toContain("^LL480");
  });

  it("converte milímetros usando a resolução homologada do perfil", () => {
    const zpl = gerarZplEtiqueta(dados({ tamanho: "MM_60X60", resolucaoDpi: 300 }));
    expect(zpl).toContain("^PW709");
    expect(zpl).toContain("^LL709");
  });

  it("documenta a normalização de acentos para a fonte ZPL básica", () => {
    expect(sanitizarTextoZpl("maçã e pão")).toBe("maca e pao");
  });
});
