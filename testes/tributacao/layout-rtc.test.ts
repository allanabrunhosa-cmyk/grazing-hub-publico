import { describe, expect, it } from "vitest";
import { aplicarLayoutRtc, layoutRtcComprovado, validarLayoutRtc, type SnapshotLayoutRtc } from "@/lib/tributacao/layout-rtc";
import { decomporOperacaoPrecoRtc } from "@/lib/tributacao/preco-rtc";
import type { LayoutFiscalRTC } from "@/lib/tributacao/tipos";

// Nomes da API, evidência, preços e percentuais são exclusivamente fictícios.
// Nenhum caminho deste teste documenta suporte do Brasil NFe ou homologação real.
type DocumentoFicticio = Record<string, unknown> & { ValorTotal: number; Produtos: Record<string, unknown>[] };
function layout(extra: Partial<LayoutFiscalRTC> = {}): LayoutFiscalRTC {
  return { codigo: "NT2026.008", homologacaoComprovada: true, evidenciaHomologacao: "Prova exclusivamente sintética do layout para cenário de teste", campos: { valorProdutoLiquido: "FicticioRTC.ProdutoLiquido", valorUnitarioLiquido: "FicticioRTC.UnitarioLiquido", valorTotalItem: "FicticioRTC.TotalItem", valorLiquidoProdutosTotal: "FicticioRTC.TotalProdutosLiquidos", valorTotalDocumento: "FicticioRTC.TotalDocumento" }, ...extra };
}
function documento(): DocumentoFicticio { return { Modelo: "55", ValorTotal: 110, Produtos: [{ Codigo: "produto-ficticio", Quantidade: 2, ValorTotal: 100, ValorFrete: 10, ValorDesconto: 0, ValorOutrasDespesas: 0, Impostos: { Ficticio: "preservado" } }], Pagamentos: [{ Valor: 110 }] }; }
function snapshot(extra: Partial<SnapshotLayoutRtc> = {}): SnapshotLayoutRtc {
  return { layout: layout(), produtos: [{ produtoLiquido: "83.34", unitarioLiquido: "41.6700000000", totalItem: "110.00" }], valorLiquidoProdutosTotal: "83.34", valorTotalDocumento: "110.00", ...extra };
}
function trocarCampo(nome: keyof LayoutFiscalRTC["campos"], valor: string | null) { const l = layout(); l.campos[nome] = valor; return l; }

describe("mapeamento RTC versionado, nomes da API exclusivamente fictícios", () => {
  it("clona documento, conserva bruto/pagamento/tributos e não modifica snapshot nem objetos de entrada", () => {
    const d = documento(), s = snapshot(), antes = structuredClone(d), antesSnapshot = structuredClone(s);
    const r = aplicarLayoutRtc(d, s);
    expect(r).not.toBe(d); expect(r.Produtos).not.toBe(d.Produtos); expect(r.Produtos[0]).not.toBe(d.Produtos[0]);
    expect(r).toMatchObject({ ValorTotal: 110, Produtos: [{ Quantidade: 2, ValorTotal: 100, ValorFrete: 10, Impostos: { Ficticio: "preservado" }, FicticioRTC: { ProdutoLiquido: 83.34, UnitarioLiquido: 41.67, TotalItem: 110 } }], Pagamentos: [{ Valor: 110 }], FicticioRTC: { TotalProdutosLiquidos: 83.34, TotalDocumento: 110 } });
    expect(d).toEqual(antes); expect(s).toEqual(antesSnapshot); expect(() => validarLayoutRtc(r, s)).not.toThrow();
  });
  it("não soma IBS/CBS novamente ao total final ao mapear decomposição matemática fictícia", () => {
    const p = decomporOperacaoPrecoRtc({ produtoBruto: "100.00", componentesExternos: [{ id: "FRETE", valorBruto: "10.00" }], quantidade: "2", aliquotasEfetivasRtc: { cbs: "10", ibsUf: "5", ibsMunicipio: "5" }, tributosContidos: [], politicaRateio: { modo: "PROPORCIONAL_BRUTO", versaoId: "fixture-v2", justificativa: "Política de rateio sintética para teste exclusivamente matemático" } });
    const s = snapshot({ produtos: [{ produtoLiquido: p.produto.vProdLiq, unitarioLiquido: p.produto.vUnComLiq, totalItem: p.valorOperacao }], valorLiquidoProdutosTotal: p.produto.vProdLiq, valorTotalDocumento: p.valorOperacao });
    const r = aplicarLayoutRtc(documento(), s);
    expect(p.totalRtc).toBe("18.33"); expect(r.ValorTotal).toBe(110); expect(r.Pagamentos).toEqual([{ Valor: 110 }]);
    expect(r.FicticioRTC).toEqual({ TotalProdutosLiquidos: 83.34, TotalDocumento: 110 });
    expect(r.Produtos[0].ValorTotal).toBe(100); expect(() => validarLayoutRtc(r, s)).not.toThrow();
  });
  it("confere somas de dois produtos e usa total item com desconto/frete/despesas sem alterar esses componentes", () => {
    const d = documento(); d.Produtos.push({ Codigo: "outro-ficticio", Quantidade: 1, ValorTotal: 50, ValorDesconto: 5, ValorFrete: 2, ValorOutrasDespesas: 3 }); d.ValorTotal = 160; d.Pagamentos = [{ Valor: 160 }];
    const s = snapshot({ produtos: [...snapshot().produtos, { produtoLiquido: "40.00", unitarioLiquido: "40.0000000000", totalItem: "50.00" }], valorLiquidoProdutosTotal: "123.34", valorTotalDocumento: "160.00" });
    const r = aplicarLayoutRtc(d, s);
    expect(r.FicticioRTC).toEqual({ TotalProdutosLiquidos: 123.34, TotalDocumento: 160 });
    expect(r.Produtos[1]).toMatchObject({ ValorTotal: 50, ValorDesconto: 5, ValorFrete: 2, ValorOutrasDespesas: 3, FicticioRTC: { ProdutoLiquido: 40, UnitarioLiquido: 40, TotalItem: 50 } });
    expect(() => validarLayoutRtc(r, s)).not.toThrow();
  });
  it("tolera exatamente um centavo na multiplicação unitária e bloqueia diferença maior", () => {
    const d = documento(); d.Produtos[0].Quantidade = 1;
    expect(() => aplicarLayoutRtc(d, snapshot({ produtos: [{ produtoLiquido: "83.34", unitarioLiquido: "83.3300000000", totalItem: "110.00" }] }))).not.toThrow();
    expect(() => aplicarLayoutRtc(d, snapshot({ produtos: [{ produtoLiquido: "83.34", unitarioLiquido: "83.3299999999", totalItem: "110.00" }] }))).toThrow(/quantidade/);
  });
  it("não confunde mesmo caminho em containers de produto e documento independentes", () => {
    const l = layout(); l.campos.valorTotalItem = "TotalFicticio"; l.campos.valorTotalDocumento = "TotalFicticio";
    expect(layoutRtcComprovado(l)).toBe(true);
    const r = aplicarLayoutRtc(documento(), snapshot({ layout: l }));
    expect(r.TotalFicticio).toBe(110); expect(r.Produtos[0].TotalFicticio).toBe(110);
  });
  it.each([
    layout({ homologacaoComprovada: false }), layout({ evidenciaHomologacao: "" }), layout({ evidenciaHomologacao: "curta" }),
    trocarCampo("valorTotalDocumento", null), trocarCampo("valorProdutoLiquido", "__proto__.Valor"), trocarCampo("valorProdutoLiquido", "constructor.Valor"), trocarCampo("valorTotalDocumento", "Ficticio.prototype.Valor"),
    trocarCampo("valorProdutoLiquido", "FicticioRTC.UnitarioLiquido"), trocarCampo("valorProdutoLiquido", "FicticioRTC"), trocarCampo("valorLiquidoProdutosTotal", "FicticioRTC.TotalDocumento"), trocarCampo("valorTotalDocumento", "FicticioRTC.TotalProdutosLiquidos.Subcampo"),
  ])("sem prova/caminhos independentes e seguros não aplica: %j", l => {
    expect(layoutRtcComprovado(l)).toBe(false);
    expect(() => aplicarLayoutRtc(documento(), snapshot({ layout: l }))).toThrow(/homologação/);
  });
  it.each([
    { nome: "valorProdutoLiquido" as const, caminho: "ValorTotal" },
    { nome: "valorUnitarioLiquido" as const, caminho: "Quantidade" },
    { nome: "valorTotalItem" as const, caminho: "Impostos.Ficticio" },
    { nome: "valorTotalDocumento" as const, caminho: "ValorTotal" },
  ])("não sobrescreve campo comercial ou tributário existente: $caminho", c => {
    const d = documento(), antes = structuredClone(d);
    expect(() => aplicarLayoutRtc(d, snapshot({ layout: trocarCampo(c.nome, c.caminho) }))).toThrow(/colide/);
    expect(d).toEqual(antes);
  });
  it("path ancestral sobre escalar/array ou campo final existente também bloqueia sem escrita na origem", () => {
    const d = documento(); d.RtcFicticio = [{ total: 1 }]; const antes = structuredClone(d);
    expect(() => aplicarLayoutRtc(d, snapshot({ layout: trocarCampo("valorTotalDocumento", "RtcFicticio.Total") }))).toThrow(/incompatível/);
    const scalar = documento(); scalar.RtcFicticio = "valor preservado";
    expect(() => aplicarLayoutRtc(scalar, snapshot({ layout: trocarCampo("valorTotalDocumento", "RtcFicticio.Total") }))).toThrow(/incompatível/);
    const parcial = documento(); parcial.FicticioRTC = { TotalProdutosLiquidos: 83.34 };
    expect(() => aplicarLayoutRtc(parcial, snapshot())).toThrow(/colide/);
    expect(d).toEqual(antes);
  });
  it("valida valores numéricos ou strings idênticas ao snapshot sem modificá-los", () => {
    const s = snapshot(), r = aplicarLayoutRtc(documento(), s);
    r.Produtos[0].FicticioRTC = { ProdutoLiquido: "83.3400", UnitarioLiquido: "41.6700000000", TotalItem: "110.00" };
    const antes = structuredClone(r);
    expect(() => validarLayoutRtc(r, s)).not.toThrow(); expect(r).toEqual(antes);
  });
  it.each(["produto", "unitario", "item", "totalLiquido", "totalDocumento", "ausente"])('alteração em campo calculado exige rejeição do snapshot: %s', campo => {
    const s = snapshot(), r = aplicarLayoutRtc(documento(), s);
    const p = r.Produtos[0].FicticioRTC as Record<string, unknown>, t = r.FicticioRTC as Record<string, unknown>;
    if (campo === "produto") p.ProdutoLiquido = 83.35;
    if (campo === "unitario") p.UnitarioLiquido = 41.68;
    if (campo === "item") p.TotalItem = 110.01;
    if (campo === "totalLiquido") t.TotalProdutosLiquidos = 83.35;
    if (campo === "totalDocumento") t.TotalDocumento = 128.33;
    if (campo === "ausente") delete p.TotalItem;
    expect(() => validarLayoutRtc(r, s)).toThrow(/snapshot/);
  });
  it.each([
    snapshot({ valorLiquidoProdutosTotal: "83.35" }), snapshot({ valorTotalDocumento: "128.33" }), snapshot({ produtos: [] }),
    snapshot({ produtos: [{ produtoLiquido: "83.34", unitarioLiquido: "41.6700000000", totalItem: "100.00" }], valorTotalDocumento: "100.00" }),
    snapshot({ produtos: [{ produtoLiquido: "120.00", unitarioLiquido: "60.0000000000", totalItem: "110.00" }], valorLiquidoProdutosTotal: "120.00" }),
  ])("totais e identidade dos produtos inconsistentes bloqueiam aplicação: %j", s => {
    expect(() => aplicarLayoutRtc(documento(), s)).toThrow();
  });
  it.each(["1.001", "1e2", "-1", "1,00", "10000000000000.00"])('valor monetário fora de duas casas/treze inteiros bloqueia: %s', liquido => {
    const s = snapshot({ produtos: [{ produtoLiquido: liquido, unitarioLiquido: "0", totalItem: "110.00" }], valorLiquidoProdutosTotal: liquido });
    expect(() => aplicarLayoutRtc(documento(), s)).toThrow();
  });
  it("unitário com mais de dez decimais não passa por conversão numérica implícita", () => {
    const s = snapshot({ produtos: [{ produtoLiquido: "83.34", unitarioLiquido: "41.67000000001", totalItem: "110.00" }] });
    expect(() => aplicarLayoutRtc(documento(), s)).toThrow(/precisão/);
  });
  it("precisão monetária é rejeitada mesmo com quantidade e somas coerentes", () => {
    const s = snapshot({ produtos: [{ produtoLiquido: "83.341", unitarioLiquido: "41.6705", totalItem: "110.00" }], valorLiquidoProdutosTotal: "83.341" });
    expect(() => aplicarLayoutRtc(documento(), s)).toThrow(/precisão/);
    const d = documento(); d.ValorTotal = 10000000000000; d.Produtos = [{ Quantidade: 1000, ValorTotal: 10000000000000 }];
    const grande = snapshot({ produtos: [{ produtoLiquido: "10000000000000.00", unitarioLiquido: "10000000000.00", totalItem: "10000000000000.00" }], valorLiquidoProdutosTotal: "10000000000000.00", valorTotalDocumento: "10000000000000.00" });
    expect(() => aplicarLayoutRtc(d, grande)).toThrow(/precisão/);
  });
  it("unitário com doze inteiros é bloqueado mesmo que quantidade/fracionamento fechem", () => {
    const d = documento(); d.ValorTotal = 100000; d.Produtos = [{ Quantidade: "0.000001", ValorTotal: 100000 }]; d.Pagamentos = [{ Valor: 100000 }];
    const s = snapshot({ produtos: [{ produtoLiquido: "100000.00", unitarioLiquido: "100000000000.0000000000", totalItem: "100000.00" }], valorLiquidoProdutosTotal: "100000.00", valorTotalDocumento: "100000.00" });
    expect(() => aplicarLayoutRtc(d, s)).toThrow(/precisão/);
  });
  it("valor que Number não conserva exatamente não é enviado por aproximação", () => {
    const d = documento(); d.ValorTotal = 100001; d.Produtos = [{ Quantidade: "0.000001", ValorTotal: 100001 }];
    const s = snapshot({ produtos: [{ produtoLiquido: "100000.00", unitarioLiquido: "99999999999.9999999999", totalItem: "100001.00" }], valorLiquidoProdutosTotal: "100000.00", valorTotalDocumento: "100001.00" });
    expect(() => aplicarLayoutRtc(d, s)).toThrow(/contrato numérico/);
  });
});
