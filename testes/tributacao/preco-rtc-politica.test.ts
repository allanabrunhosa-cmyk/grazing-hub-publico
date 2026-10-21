import { describe, expect, it } from "vitest";
import { excecaoBaseLiquidaComprovada } from "@/lib/tributacao/preco-rtc-politica";
import { validarDadosFiscais } from "@/lib/tributacao/validacao";
import type { RegraFiscal, TributoConfigurado } from "@/lib/tributacao/tipos";

// Norma, datas, descrição e percentuais são fixtures exclusivamente sintéticas.
// O caminho fictício abaixo usa host oficial apenas para exercitar a guarda:
// não foi consultado, não é norma existente e não fundamenta regra real.
const fonte = "https://legislacao.fazenda.sp.gov.br/Paginas/ATO_FICTICIO_DE_TESTE.aspx";
type Excecao = NonNullable<NonNullable<NonNullable<RegraFiscal["reforma"]>["preco2027"]>["excecaoBaseLiquida"]>;
function tributo(): TributoConfigurado { return { cst: "40", aliquota: null, reducaoBase: "0", modalidade: "SEM_DESTAQUE", justificativa: "Tributo exclusivamente fictício e sem destaque" }; }
function excecao(extra: Partial<Excecao> = {}): Excecao { return { uf: "SP", vigenciaInicio: "2027-01-01", vigenciaFim: "2027-12-31", fonteNormativa: fonte, ato: "Ato normativo exclusivamente fictício para teste", justificativa: "Exceção exclusivamente sintética, sem efeito fiscal real", ...extra }; }
function regra(e: Excecao | undefined = excecao(), baseIcms: "BRUTA" | "LIQUIDA_RTC" = "LIQUIDA_RTC"): RegraFiscal {
  return { estabelecimento: "loja-ficticia", regime: "LUCRO_PRESUMIDO", operacao: "VENDA", ufDestino: "SP", destinatario: "CONSUMIDOR_FINAL", grupo: "GF01", produtoId: null, natureza: "PREPARADO", ncm: "19059090", cfop: "5101", csosn: null, icms: tributo(), pis: tributo(), cofins: tributo(), ipi: null, st: "NAO_APLICAVEL", cest: null, segregacaoReceita: "RECEITA_SINTETICA", seletivo: "NAO_APLICAVEL", reforma: { cst: "000", cClassTrib: "000001", cbs: "10", ibsUf: "5", ibsMunicipio: "5", reducao: "0", justificativa: "Taxas exclusivamente fictícias para o cálculo do teste", preco2027: { baseIcms, rateio: "SEM_ACRESCIMOS", justificativa: "Política de preço exclusivamente fictícia do teste", ...(e ? { excecaoBaseLiquida: e } : {}) } } };
}
function semExcecao(baseIcms: "BRUTA" | "LIQUIDA_RTC") { const r = regra(undefined, baseIcms); delete r.reforma!.preco2027!.excecaoBaseLiquida; return r; }

describe("guarda de exceção normativa da base ICMS, todos os dados fictícios", () => {
  it("base BRUTA independe de exceção e não impõe parâmetro novo ao legado sem RTC", () => {
    expect(excecaoBaseLiquidaComprovada(semExcecao("BRUTA"), "SP", "2027-07-01", [])).toBe(true);
    expect(excecaoBaseLiquidaComprovada({ ...regra(), reforma: null }, "SP", "2026-10-12", [])).toBe(true);
    expect(excecaoBaseLiquidaComprovada(semExcecao("LIQUIDA_RTC"), "SP", "2027-07-01", [fonte])).toBe(false);
  });
  it("aplica apenas à UF/período cobertos e exige a fonte exatamente nas fontes da versão", () => {
    const r = regra();
    expect(excecaoBaseLiquidaComprovada(r, "SP", "2027-01-01", [fonte])).toBe(true);
    expect(excecaoBaseLiquidaComprovada(r, "SP", "2027-12-31", [fonte])).toBe(true);
    expect(excecaoBaseLiquidaComprovada(r, "RJ", "2027-07-01", [fonte])).toBe(false);
    expect(excecaoBaseLiquidaComprovada(r, "SP", "2026-12-31", [fonte])).toBe(false);
    expect(excecaoBaseLiquidaComprovada(r, "SP", "2028-01-01", [fonte])).toBe(false);
    expect(excecaoBaseLiquidaComprovada(r, "SP", "2027-07-01", [])).toBe(false);
    expect(excecaoBaseLiquidaComprovada(r, "SP", "2027-07-01", [fonte + "?outra=versao"])).toBe(false);
  });
  it("fim null representa vigência aberta explicitamente, sem dispensar início/fonte", () => {
    expect(excecaoBaseLiquidaComprovada(regra(excecao({ vigenciaFim: null })), "SP", "2028-07-01", [fonte])).toBe(true);
    expect(excecaoBaseLiquidaComprovada(regra(excecao({ vigenciaInicio: "" })), "SP", "2028-07-01", [fonte])).toBe(false);
  });
  it.each([
    "http://legislacao.fazenda.sp.gov.br/Paginas/ATO_FICTICIO.aspx",
    "https://example.invalid/norma", "https://gov.br.example.invalid/norma", "https://examplegov.br/norma",
    "https://usuario@legislacao.fazenda.sp.gov.br/Paginas/ATO_FICTICIO.aspx",
    "https://usuario:senha-ficticia@legislacao.fazenda.sp.gov.br/Paginas/ATO_FICTICIO.aspx",
    "javascript:alert(1)", "fonte sem URL",
    "https://legislacao.fazenda.sp.gov.br/Paginas/RC32931_2025.aspx",
    "https://legislacao.fazenda.sp.gov.br/Paginas/RC33083_2026.aspx",
  ])("fonte não oficial, credencial na URL ou RC de base BRUTA não prova exceção: %s", f => {
    expect(excecaoBaseLiquidaComprovada(regra(excecao({ fonteNormativa: f })), "SP", "2027-07-01", [f])).toBe(false);
  });
  it.each([{ ato: "curto" }, { justificativa: "curta" }, { ato: "               " }, { justificativa: "               " }])("ato/fundamento curtos ou vazios bloqueiam em runtime: %j", e => {
    expect(excecaoBaseLiquidaComprovada(regra(excecao(e)), "SP", "2027-07-01", [fonte])).toBe(false);
  });
  it("datas impossíveis não viram vigência válida por comparação textual", () => {
    expect(excecaoBaseLiquidaComprovada(regra(excecao({ vigenciaInicio: "2027-02-30" })), "SP", "2027-03-01", [fonte])).toBe(false);
    expect(excecaoBaseLiquidaComprovada(regra(excecao({ vigenciaFim: null })), "SP", "2027-99-01", [fonte])).toBe(false);
  });
});

describe("validação de cadastro da exceção estruturada, sem ativação real", () => {
  it("conserva norma/UF/intervalo/fonte da fixture e não transforma texto livre em exceção", () => {
    const r = validarDadosFiscais("REGRA", regra()) as RegraFiscal;
    expect(r.reforma?.preco2027?.excecaoBaseLiquida).toEqual(excecao());
    const sem = validarDadosFiscais("REGRA", semExcecao("LIQUIDA_RTC")) as RegraFiscal;
    expect(sem.reforma?.preco2027?.excecaoBaseLiquida).toBeUndefined();
    expect(excecaoBaseLiquidaComprovada(sem, "SP", "2027-07-01", [fonte])).toBe(false);
    expect(validarDadosFiscais("REGRA", semExcecao("BRUTA"))).toMatchObject({ reforma: { preco2027: { baseIcms: "BRUTA" } } });
  });
  it.each([
    { uf: "S" }, { uf: "sp" }, { vigenciaInicio: "2027-02-30" }, { vigenciaInicio: "01/01/2027" },
    { vigenciaFim: "2026-12-31" }, { vigenciaFim: "2027-13-01" }, { ato: "curto" }, { justificativa: "curta" },
    { fonteNormativa: "http://www.gov.br/norma" }, { fonteNormativa: "https://gov.br.example.invalid/norma" },
    { fonteNormativa: "https://usuario@www.gov.br/norma" }, { fonteNormativa: "https://usuario:senha-ficticia@www.gov.br/norma" },
  ] satisfies Partial<Excecao>[])("rejeita fonte, datas, UF ou fundamentos inválidos: %j", e => {
    expect(() => validarDadosFiscais("REGRA", regra(excecao(e)))).toThrow();
  });
  it.each(["00", "0000000", "1", "ABCDEF"])('cClassTrib deve conservar seis dígitos e não aceita código: %s', cClassTrib => {
    const r = regra(); r.reforma!.cClassTrib = cClassTrib;
    expect(() => validarDadosFiscais("REGRA", r)).toThrow();
  });
  it.each(["00", "0000", "ABC"])('CST RTC deve conservar três dígitos e não aceita código: %s', cst => {
    const r = regra(); r.reforma!.cst = cst;
    expect(() => validarDadosFiscais("REGRA", r)).toThrow();
  });
});
