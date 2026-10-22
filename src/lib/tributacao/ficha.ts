import type { ClassificacaoFiscal, ContextoFiscal, PerfilFiscal, RegraFiscal, VersaoFiscalDto } from "./tipos";

/** Usado tanto pela ficha visível quanto pelo motor. Não resolve empates. */
export function regrasDaOperacao(versoes: VersaoFiscalDto[], c: ClassificacaoFiscal, produtoId: string, contexto: ContextoFiscal, perfil: PerfilFiscal) {
  const peso = (v: VersaoFiscalDto) => {
    const r = v.dados as RegraFiscal;
    return (r.produtoId ? 8 : 0) + (r.ncm ? 4 : 0) + (r.grupoFiscalId ? 3.5 : r.grupo ? 2 : 0) + (r.natureza ? 1 : 0) + (r.modelo ? 0.25 : 0);
  };
  const candidatas = versoes.filter(v => {
    if (v.tipo !== "REGRA") return false;
    const r = v.dados as RegraFiscal;
    return r.habilitada !== false && r.estabelecimento === contexto.estabelecimento && r.regime === perfil.regime && r.operacao === contexto.operacao && r.ufDestino === contexto.ufDestino && r.destinatario === contexto.destinatario
      && (!r.produtoId || r.produtoId === produtoId) && (!r.ncm || r.ncm === c.ncm) && (!r.grupo || r.grupo === c.grupo) && (!r.grupoFiscalId || r.grupoFiscalId === c.grupoFiscalId) && (!r.natureza || r.natureza === c.natureza) && (!r.modelo || r.modelo === contexto.modelo);
  }).sort((a, b) => peso(b) - peso(a));
  const conflito = !!candidatas[1] && peso(candidatas[0]) === peso(candidatas[1]);
  return { candidatas, conflito, efetiva: conflito ? undefined : candidatas[0] };
}

export function valoresClassificacao(c?: ClassificacaoFiscal): Record<string, string> {
  return c ? { ncm: c.ncm ?? "", origem: c.origem ?? "", cest: c.cest ?? "", ean: c.gtin ?? "", unidadeTributavel: c.unidade } : {};
}
export function valoresRegra(r?: RegraFiscal): Record<string, string> {
  return r ? { cfop: r.cfop, csosn: r.csosn ?? "", cstIcms: r.icms.cst, pis: r.pis.cst, cofins: r.cofins.cst } : {};
}
/** A comparação informa diferenças, sem escolher qual cadastro está correto. */
export function compararCadastroFiscal(cadastro: Record<string, string>, efetivo: Record<string, string>) {
  return Object.entries(efetivo).filter(([campo, valor]) => cadastro[campo] !== undefined && cadastro[campo] !== valor)
    .map(([campo, valor]) => ({ campo, cadastrado: cadastro[campo], vigente: valor }));
}
