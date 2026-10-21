import { describe, expect, it } from "vitest";
import { fimDoDiaLocal, formatarDataEtiqueta, somarDiasDeCalendario } from "@/lib/etiquetas/datas";
import { normalizarQuantidade } from "@/lib/etiquetas/validacao";
import { gerarZplEtiqueta, sanitizarTextoZpl } from "@/lib/etiquetas/zpl";
import type { DadosEtiqueta } from "@/lib/etiquetas/tipos";
import { comporLinhasEtiqueta } from "@/lib/etiquetas/layout";

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
