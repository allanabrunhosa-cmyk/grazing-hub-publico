import type { LinhaFiscalCalculada } from "@/lib/tributacao/tipos";
import type { ProdutoBrasilNfe } from "./brasil-nfe-contrato";
type LinhaParaProvedor = Pick<LinhaFiscalCalculada, "csosn"> & {
  impostos: Omit<LinhaFiscalCalculada["impostos"], "icms"> & { icms: Omit<LinhaFiscalCalculada["impostos"]["icms"], "reducaoBase"> & { reducaoBase?: string } };
  reforma: null | (Omit<NonNullable<LinhaFiscalCalculada["reforma"]>, "aliquotaNominalCBS" | "aliquotaNominalIbsUf" | "aliquotaNominalIbsMunicipio" | "reducao"> & { aliquotaNominalCBS?: string; aliquotaNominalIbsUf?: string; aliquotaNominalIbsMunicipio?: string; reducao?: string });
};
/** O provedor calcula pAliqEfet a partir de nominal e redução. Jamais inverter
 * uma alíquota efetiva já arredondada para reconstruir o parâmetro original. */
export function traduzirImpostosBrasilNfe(linha: LinhaParaProvedor): ProdutoBrasilNfe["Imposto"] {
  const { icms, pis, cofins } = linha.impostos;
  if (!linha.csosn && icms.cst === "20" && !icms.reducaoBase) throw new Error("CST 20 exige percentual original da redução de base no snapshot.");
  const resultado: ProdutoBrasilNfe["Imposto"] = {
    ICMS: { CodSituacaoTributaria: linha.csosn ?? icms.cst, BaseCalculo: icms.base, AliquotaICMS: icms.aliquota ?? "0", ValorIcms: icms.valor, ...(!linha.csosn && icms.cst === "20" ? { RedICMS: icms.reducaoBase } : {}) },
    PIS: { CodSituacaoTributaria: pis.cst, BaseCalculo: pis.base, Aliquota: pis.aliquota ?? "0" },
    COFINS: { CodSituacaoTributaria: cofins.cst, BaseCalculo: cofins.base, Aliquota: cofins.aliquota ?? "0" },
  };
  const b = linha.reforma;
  if (b) {
    if (b.cst === "200" && (b.aliquotaNominalCBS === undefined || b.aliquotaNominalIbsUf === undefined || b.aliquotaNominalIbsMunicipio === undefined || b.reducao === undefined)) throw new Error("IBS/CBS reduzidos exigem alíquotas nominais e redução originais no snapshot.");
    resultado.IBSCBS = { CodSituacaoTributaria: b.cst, CodClassificacaoTributaria: b.cClassTrib, BaseCalculo: b.base, AliquotaCBS: b.aliquotaNominalCBS ?? b.cbs, AliquotaIBSUF: b.aliquotaNominalIbsUf ?? b.ibsUf, AliquotaIBSMun: b.aliquotaNominalIbsMunicipio ?? b.ibsMunicipio, ...(b.cst === "200" ? { PercentualReducaoIBS: b.reducao, PercentualReducaoCBS: b.reducao } : {}) };
  }
  return resultado;
}
