import { describe, expect, it } from "vitest";
import { traduzirImpostosBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-impostos";
const semDestaque = { cst: "49", base: "0.00", aliquota: null, valor: "0.00" };
const linha = { csosn: null, impostos: { icms: { cst: "20", base: "60.00", aliquota: "18", valor: "10.80", reducaoBase: "40" }, pis: semDestaque, cofins: semDestaque, ipi: null }, reforma: null };
describe("tradução de impostos explícitos Brasil NFe", () => {
  it("CST 20 preserva base calculada e informa RedICMS original", () => { expect(traduzirImpostosBrasilNfe(linha).ICMS).toMatchObject({ CodSituacaoTributaria: "20", BaseCalculo: "60.00", AliquotaICMS: "18", ValorIcms: "10.80", RedICMS: "40" }); });
  it("não inventa percentual de redução perdido nem altera CSOSN do Simples", () => {
    expect(() => traduzirImpostosBrasilNfe({ ...linha, impostos: { ...linha.impostos, icms: { cst: "20", base: "60.00", aliquota: "18", valor: "10.80" } } })).toThrow("percentual original");
    expect(traduzirImpostosBrasilNfe({ ...linha, csosn: "102" }).ICMS).not.toHaveProperty("RedICMS");
  });
  it("IBS/CBS envia nominal e redução, evitando redução dupla da alíquota efetiva", () => {
    const r = traduzirImpostosBrasilNfe({ ...linha, reforma: { cst: "200", cClassTrib: "200048", base: "10.00", cbs: "5.2800", ibsUf: "0.0600", ibsMunicipio: "0.0000", valorCbs: "0.53", valorIbsUf: "0.01", valorIbsMunicipio: "0.00", aliquotaNominalCBS: "8.8", aliquotaNominalIbsUf: "0.1", aliquotaNominalIbsMunicipio: "0", reducao: "40" } });
    expect(r.IBSCBS).toMatchObject({ AliquotaCBS: "8.8", AliquotaIBSUF: "0.1", AliquotaIBSMun: "0", PercentualReducaoIBS: "40", PercentualReducaoCBS: "40" });
  });
  it("metadados nominais ausentes bloqueiam CST200 sem reconstruir alíquota arredondada", () => {
    expect(() => traduzirImpostosBrasilNfe({ ...linha, reforma: { cst: "200", cClassTrib: "200048", base: "10.00", cbs: "5.2800", ibsUf: "0.0600", ibsMunicipio: "0.0000", valorCbs: "0.53", valorIbsUf: "0.01", valorIbsMunicipio: "0.00" } })).toThrow("nominais");
  });
});
