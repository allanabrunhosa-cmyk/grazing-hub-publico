import type { ClassificacaoFiscal, PerfilFiscal, RegraFiscal, VersaoFiscalDto, ContextoFiscal } from "./tipos";
import { regrasDaOperacao } from "./ficha";
export type ContextoEdicaoFiscal = Pick<ContextoFiscal, "modelo" | "ufDestino" | "destinatario">;
export function regraDoGrupo(versoes: VersaoFiscalDto[], grupoId: string, codigo: string | null, contexto: ContextoEdicaoFiscal, perfil: PerfilFiscal) {
  const naturezas = new Set(versoes.filter(v => v.tipo === "REGRA" && !(v.dados as RegraFiscal).produtoId && ((v.dados as RegraFiscal).grupoFiscalId === grupoId || !(v.dados as RegraFiscal).grupoFiscalId && (v.dados as RegraFiscal).grupo === codigo)).map(v => (v.dados as RegraFiscal).natureza).filter(Boolean));
  const natureza = naturezas.size === 1 ? [...naturezas][0] : null;
  return regrasDaOperacao(versoes.filter(v => v.tipo !== "REGRA" || !(v.dados as RegraFiscal).produtoId), { grupoFiscalId: grupoId, grupo: codigo as ClassificacaoFiscal["grupo"], ncm: null, natureza } as unknown as ClassificacaoFiscal, "", { ...contexto, data: "", estabelecimento: perfil.estabelecimento, operacao: "VENDA" }, perfil);
}
export function origemDaOperacao(c: ClassificacaoFiscal, r?: RegraFiscal) { return c.herdarOrigemGrupo ? r?.origem ?? null : c.origem; }
export function camposDaRegra(r?: RegraFiscal): Record<string, string> {
  if (!r) return {};
  return { origem: r.origem ?? "", cfop: r.cfop, csosn: r.csosn ?? "", cstIcms: r.icms.cst, pis: r.pis.cst, cofins: r.cofins.cst, cest: r.cest ?? "", st: r.st, evidenciaSt: r.evidenciaSt ?? "", aliquotaIcms: r.icms.aliquota ?? "", reducaoIcms: r.icms.reducaoBase, aliquotaPis: r.pis.aliquota ?? "", aliquotaCofins: r.cofins.aliquota ?? "" };
}
export function camposDoProduto(c?: ClassificacaoFiscal, r?: RegraFiscal, grupo?: RegraFiscal): Record<string, string> {
  return { ...camposDaRegra(r), ncm: c?.ncm ?? "", origem: c ? origemDaOperacao(c, grupo ?? r) ?? "" : "", cest: c?.cest ?? (r?.grupoFiscalId ? r.cest : null) ?? "", ean: c?.gtin ?? "", unidadeTributavel: c?.unidade ?? "" };
}
