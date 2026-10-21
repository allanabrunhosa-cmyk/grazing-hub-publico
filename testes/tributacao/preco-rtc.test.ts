import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { decomporOperacaoPrecoRtc, decomporPrecoRtc, ErroPrecoRtc, type EntradaOperacaoPrecoRtc, type EntradaPrecoRtc, type TributoContidoNoPrecoRtc } from "@/lib/tributacao/preco-rtc";

// Preços, percentuais e fundamentos abaixo são exclusivamente fictícios. Não
// documentam alíquotas legais, enquadramento real, vigência ou suporte do emissor.
// No cenário futuro, PIS/COFINS são zero explicitamente; cenários que os usam
// apenas exercitam a matemática configurável, sem prescrever regra para 2027.
const D = Prisma.Decimal;
const aliquotas = { cbs: "10", ibsUf: "5", ibsMunicipio: "5" };
function entrada(extra: Partial<EntradaPrecoRtc> = {}): EntradaPrecoRtc { return { valorComercial: "120.00", quantidade: "1", aliquotasEfetivasRtc: { ...aliquotas }, tributosContidos: [], ...extra }; }
function percentual(id = "ICMS", extra: Partial<Extract<TributoContidoNoPrecoRtc, { modo: "ALIQUOTA" }>> = {}): TributoContidoNoPrecoRtc { return { id, modo: "ALIQUOTA", aliquotaEfetiva: "10", politicaBase: "BRUTO_COMERCIAL", fundamentoBase: "Política e evidência exclusivamente sintéticas do teste", excluirDaBaseRtc: true, ...extra }; }
function fixo(extra: Partial<Extract<TributoContidoNoPrecoRtc, { modo: "VALOR_CONHECIDO" }>> = {}): TributoContidoNoPrecoRtc { return { id: "OUTRO", modo: "VALOR_CONHECIDO", valor: "10.00", fundamentoValor: "Valor contido comprovado exclusivamente por fixture fictícia", excluirDaBaseRtc: true, ...extra }; }
function operacao(extra: Partial<EntradaOperacaoPrecoRtc> = {}): EntradaOperacaoPrecoRtc { return { produtoBruto: "100.00", componentesExternos: [{ id: "FRETE", valorBruto: "10.00" }], quantidade: "2", aliquotasEfetivasRtc: { ...aliquotas }, tributosContidos: [], politicaRateio: { modo: "PROPORCIONAL_BRUTO", versaoId: "regra-ficticia-v3", justificativa: "Rateio proporcional exclusivamente matemático e fictício, não enquadramento legal" }, ...extra }; }
function erroCodigo(fn: () => unknown, codigo: ErroPrecoRtc["codigo"]) {
  try { fn(); throw new Error("O cenário deveria ter sido bloqueado"); }
  catch (e) { expect(e).toBeInstanceOf(ErroPrecoRtc); expect((e as ErroPrecoRtc).codigo).toBe(codigo); }
}

describe("decomposição isolada de preço comercial com RTC, taxas fictícias", () => {
  it("exclui próprios IBS/CBS da base, conserva bruto e não soma RTC novamente ao preço", () => {
    const r = decomporPrecoRtc(entrada());
    expect(r).toMatchObject({ valorComercial: "120.00", vProd: "120.00", vProdLiq: "100.00", vUnComLiq: "100.0000000000", baseRtc: "100.00", valorSemRtc: "100.00", totalRtc: "20.00", totalTributosContidos: "20.00", rtc: { cbs: { valor: "10.00", aliquotaEfetiva: "10.0000" }, ibsUf: { valor: "5.00" }, ibsMunicipio: { valor: "5.00" } } });
    expect(new D(r.vProdLiq).plus(r.totalTributosContidos).toFixed(2)).toBe("120.00");
  });
  it("calcula legado sobre bruto apenas sob política explícita; futuro fictício usa PIS/COFINS zero", () => {
    const r = decomporPrecoRtc(entrada({ tributosContidos: [percentual(), percentual("PIS", { aliquotaEfetiva: "0" }), percentual("COFINS", { aliquotaEfetiva: "0" })] }));
    expect(r).toMatchObject({ baseRtc: "90.00", vProd: "120.00", vProdLiq: "90.00", totalRtc: "18.00", totalTributosContidos: "30.00", tributosContidos: [{ id: "ICMS", base: "120.00", valor: "12.00", politicaBase: "BRUTO_COMERCIAL" }, { id: "PIS", valor: "0.00" }, { id: "COFINS", valor: "0.00" }] });
  });
  it("resolve sistema acoplado quando política sintética fundamentada usa líquido RTC", () => {
    const r = decomporPrecoRtc(entrada({ tributosContidos: [percentual("ICMS", { politicaBase: "LIQUIDO_RTC" })] }));
    expect(r).toMatchObject({ baseRtc: "91.52", vProdLiq: "91.52", valorSemRtc: "101.69", totalRtc: "18.31", tributosContidos: [{ base: "101.69", valor: "10.17", politicaBase: "LIQUIDO_RTC" }] });
    expect(r.rtc).toMatchObject({ cbs: { valor: "9.15" }, ibsUf: { valor: "4.58" }, ibsMunicipio: { valor: "4.58" } });
    expect(new D(r.baseRtc).plus(r.totalRtc).plus(r.tributosContidos[0].valor).toFixed(2)).toBe("120.00");
  });
  it("retira valor conhecido antes de resolver RTC, sem presumir política de ICMS", () => {
    const r = decomporPrecoRtc(entrada({ valorComercial: "130.00", tributosContidos: [fixo()] }));
    expect(r).toMatchObject({ baseRtc: "100.00", vProdLiq: "100.00", totalRtc: "20.00", tributosContidos: [{ id: "OUTRO", base: null, valor: "10.00", politicaBase: null }] });
  });
  it("líquido produto retira todos os tributos, mas base RTC só retira as exclusões configuradas", () => {
    const r = decomporPrecoRtc(entrada({ tributosContidos: [fixo({ excluirDaBaseRtc: false })] }));
    expect(r).toMatchObject({ baseRtc: "100.00", valorSemRtc: "100.00", vProdLiq: "90.00", totalRtc: "20.00", totalTributosContidos: "30.00" });
  });
  it("preserva taxas efetivas de quatro casas sem arredondá-las para taxas nominais", () => {
    const r = decomporPrecoRtc(entrada({ valorComercial: "100.00", aliquotasEfetivasRtc: { cbs: "3.3333", ibsUf: "1.6667", ibsMunicipio: "0" } }));
    expect(r).toMatchObject({ baseRtc: "95.24", vProdLiq: "95.24", totalRtc: "4.76", rtc: { cbs: { aliquotaEfetiva: "3.3333", valor: "3.17" }, ibsUf: { aliquotaEfetiva: "1.6667", valor: "1.59" }, ibsMunicipio: { valor: "0.00" } } });
  });
  it("encontra fechamento centesimal sem compensar preço, quantidade ou percentual", () => {
    const dados = entrada({ valorComercial: "100.00", quantidade: "3" }), antes = structuredClone(dados);
    const r = decomporPrecoRtc(dados);
    expect(r).toMatchObject({ vProd: "100.00", baseRtc: "83.33", vProdLiq: "83.33", totalRtc: "16.67", quantidade: "3.000000", vUnComLiq: "27.7766666667", diferencaMultiplicacaoUnitaria: "0.0000000001", arredondamento: { modo: "HALF_UP", valores: 2, unitario: 10, aliquotasEfetivas: 4, fechamento: "BASE_E_TRIBUTOS_EM_CENTAVOS" } });
    expect(dados).toEqual(antes);
  });
  it("não inventa compensação quando não existe fechamento simultâneo em centavos", () => {
    const dados = entrada({ valorComercial: "0.03", aliquotasEfetivasRtc: { cbs: "20", ibsUf: "0", ibsMunicipio: "0" } });
    erroCodigo(() => decomporPrecoRtc(dados), "ARREDONDAMENTO_SEM_FECHAMENTO");
    expect(dados.valorComercial).toBe("0.03");
  });
  it("zero no preço é representável mantendo quantidade positiva", () => {
    expect(decomporPrecoRtc(entrada({ valorComercial: "0.00", quantidade: "2.5" }))).toMatchObject({ vProd: "0.00", vProdLiq: "0.00", vUnComLiq: "0.0000000000", totalRtc: "0.00", quantidade: "2.500000" });
  });
  it("precisão Decimal isolada mantém configuração global e valores grandes exatos", () => {
    const precisao = D.precision, modo = D.rounding;
    const r = decomporPrecoRtc(entrada({ valorComercial: "9999999999999.99", quantidade: "1000", aliquotasEfetivasRtc: { cbs: "0", ibsUf: "0", ibsMunicipio: "0" } }));
    expect(r).toMatchObject({ vProd: "9999999999999.99", vProdLiq: "9999999999999.99", vUnComLiq: "9999999999.9999900000" });
    expect(D.precision).toBe(precisao); expect(D.rounding).toBe(modo);
  });
  it("bloqueia unitário acima de onze inteiros sem mudar quantidade", () => {
    erroCodigo(() => decomporPrecoRtc(entrada({ valorComercial: "9999999999999.99", quantidade: "0.000001", aliquotasEfetivasRtc: { cbs: "0", ibsUf: "0", ibsMunicipio: "0" } })), "UNITARIO_NAO_REPRESENTAVEL");
  });
  it("bloqueia perda maior que um centavo no produto da unidade com a quantidade", () => {
    erroCodigo(() => decomporPrecoRtc(entrada({ valorComercial: "0.02", quantidade: "999999999999", aliquotasEfetivasRtc: { cbs: "0", ibsUf: "0", ibsMunicipio: "0" } })), "UNITARIO_NAO_REPRESENTAVEL");
  });
  it.each([
    { quantidade: "0" }, { quantidade: "1.0000001" }, { quantidade: "1e2" },
    { valorComercial: "1.001" }, { valorComercial: "-1" }, { valorComercial: "1,00" },
    { aliquotasEfetivasRtc: { cbs: "100", ibsUf: "0", ibsMunicipio: "0" } },
    { aliquotasEfetivasRtc: { cbs: "90", ibsUf: "10", ibsMunicipio: "0" } },
    { aliquotasEfetivasRtc: { cbs: "1.00001", ibsUf: "0", ibsMunicipio: "0" } },
    { tributosContidos: [percentual("ICMS", { fundamentoBase: "" })] },
    { tributosContidos: [percentual("ICMS", { aliquotaEfetiva: "60" }), percentual("OUTRO", { aliquotaEfetiva: "40" })] },
    { tributosContidos: [percentual(), percentual()] },
    { tributosContidos: [fixo({ id: "CBS" })] },
    { tributosContidos: [fixo({ valor: "130.00" })] },
    { tributosContidos: [fixo({ valor: "130.00", excluirDaBaseRtc: false })] },
    { tributosContidos: [fixo({ fundamentoValor: " " })] },
  ] satisfies Partial<EntradaPrecoRtc>[])('bloqueia configuração inválida explicitamente: %j', extra => {
    erroCodigo(() => decomporPrecoRtc(entrada(extra)), "CONFIGURACAO_INVALIDA");
  });
});

describe("componentes explícitos da operação, política de rateio fictícia versionada", () => {
  it("produto bruto100/frete10 conserva os dois preços e não confunde BC da operação com líquido produto", () => {
    const dados = operacao(), antes = structuredClone(dados), r = decomporOperacaoPrecoRtc(dados);
    // CBS9,17×100/110=8,33636…; os maiores restos alocam8,34 ao produto.
    // Cada IBS4,58×100/110=4,16363… aloca4,16 ao produto e0,42 ao frete.
    expect(r).toMatchObject({ valorOperacao: "110.00", baseRtc: "91.67", totalRtc: "18.33", produto: { vProd: "100.00", vProdLiq: "83.34", vUnComLiq: "41.6700000000", quantidade: "2.000000" }, componentes: [{ id: "PRODUTO", valorBruto: "100.00", valorLiquido: "83.34", rtc: { cbs: "8.34", ibsUf: "4.16", ibsMunicipio: "4.16" } }, { id: "FRETE", valorBruto: "10.00", valorLiquido: "8.33", rtc: { cbs: "0.83", ibsUf: "0.42", ibsMunicipio: "0.42" } }], rateio: { modo: "PROPORCIONAL_BRUTO", versaoId: "regra-ficticia-v3", metodoCentavos: "MAIORES_RESTOS_ORDEM_DOS_COMPONENTES" } });
    expect(r.produto.vProdLiq).not.toBe(r.baseRtc);
    for (const tributo of ["cbs", "ibsUf", "ibsMunicipio"] as const) expect(r.componentes.reduce((a, c) => a.plus(c.rtc[tributo]), new D(0)).toFixed(2)).toBe(r.rtc[tributo].valor);
    for (const c of r.componentes) expect(new D(c.valorLiquido).plus(Object.values(c.rtc).reduce((a, v) => a.plus(v), new D(0))).toFixed(2)).toBe(c.valorBruto);
    expect(dados).toEqual(antes);
  });
  it("inclui legado efetivamente contido e usa BC bruta total sob fundamento explícito", () => {
    const r = decomporOperacaoPrecoRtc(operacao({ produtoBruto: "120.00", componentesExternos: [{ id: "FRETE", valorBruto: "12.00" }], tributosContidos: [percentual()] }));
    expect(r).toMatchObject({ valorOperacao: "132.00", baseRtc: "99.00", totalRtc: "19.80", totalTributosContidos: "33.00", tributosContidos: [{ base: "132.00", valor: "13.20" }], produto: { vProd: "120.00", vProdLiq: "90.00" }, componentes: [{ valorLiquido: "90.00", tributosContidos: [{ id: "ICMS", valor: "12.00" }] }, { valorLiquido: "9.00", tributosContidos: [{ id: "ICMS", valor: "1.20" }] }] });
  });
  it("SEM_ACRESCIMOS só funciona com componentes externos nulos", () => {
    erroCodigo(() => decomporOperacaoPrecoRtc(operacao({ politicaRateio: { modo: "SEM_ACRESCIMOS" } })), "CONFIGURACAO_INVALIDA");
    expect(decomporOperacaoPrecoRtc(operacao({ produtoBruto: "120.00", componentesExternos: [{ id: "FRETE", valorBruto: "0.00" }], politicaRateio: { modo: "SEM_ACRESCIMOS" } })).produto).toMatchObject({ vProd: "120.00", vProdLiq: "100.00", vUnComLiq: "50.0000000000" });
  });
  it("rateio proporcional nunca é padrão e exige referência de versão e justificativa", () => {
    erroCodigo(() => decomporOperacaoPrecoRtc(operacao({ politicaRateio: { modo: "PROPORCIONAL_BRUTO", versaoId: "", justificativa: "Evidência fictícia" } })), "CONFIGURACAO_INVALIDA");
    erroCodigo(() => decomporOperacaoPrecoRtc(operacao({ politicaRateio: { modo: "PROPORCIONAL_BRUTO", versaoId: "v1", justificativa: " " } })), "CONFIGURACAO_INVALIDA");
  });
  it("identificador PRODUTO reservado e duplicidade de componente são bloqueados", () => {
    erroCodigo(() => decomporOperacaoPrecoRtc(operacao({ componentesExternos: [{ id: "PRODUTO", valorBruto: "1.00" }] })), "CONFIGURACAO_INVALIDA");
    erroCodigo(() => decomporOperacaoPrecoRtc(operacao({ componentesExternos: [{ id: "FRETE", valorBruto: "1.00" }, { id: "FRETE", valorBruto: "1.00" }] })), "CONFIGURACAO_INVALIDA");
  });
  it("zero em todos os componentes mantém preços e impostos nulos sem dividir por zero", () => {
    expect(decomporOperacaoPrecoRtc(operacao({ produtoBruto: "0.00", componentesExternos: [{ id: "FRETE", valorBruto: "0.00" }] }))).toMatchObject({ valorOperacao: "0.00", baseRtc: "0.00", totalRtc: "0.00", produto: { vProdLiq: "0.00", vUnComLiq: "0.0000000000" } });
  });
});
