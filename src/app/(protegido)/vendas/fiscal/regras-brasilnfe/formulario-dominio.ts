import type { ConteudoRegraFiscalBrasilNfe } from "@/lib/fiscal-saida/brasilnfe/regras-tributarias-dominio";
import type { HistoricoRegraBrasilNfe } from "./tipos";
import { fundamentacaoVaziaFormularioFiscal, type FundamentacaoFormularioFiscal } from "./fundamentacao-formulario";

export const CAMPOS_CLASSIFICACAO = ["ncm", "cest", "origem", "cfop", "csosn", "cstIcms", "pis", "cofins", "ipi", "fcp", "ean", "unidadeTributavel"] as const;
export const CAMPOS_CLASSIFICACAO_ADICIONAIS = ["cEnq", "cBenef", "cstIbsCbs", "cClassTrib"] as const;
export const ROTULOS_CLASSIFICACAO: Record<typeof CAMPOS_CLASSIFICACAO[number] | typeof CAMPOS_CLASSIFICACAO_ADICIONAIS[number], string> = { ncm: "NCM", cest: "CEST", origem: "Origem", cfop: "CFOP", csosn: "CSOSN", cstIcms: "CST ICMS", pis: "CST PIS", cofins: "CST COFINS", ipi: "CST IPI", fcp: "FCP (%)", ean: "EAN / GTIN", unidadeTributavel: "Unidade tributável", cEnq: "Enquadramento IPI", cBenef: "Benefício fiscal", cstIbsCbs: "CST IBS/CBS", cClassTrib: "Classificação IBS/CBS" };
export type CamposRegraBrasilNfe = Record<string, string>;
export type CorrespondenciaPagamentoRegra = { formaId: string; codigo: string; indicador: string; descricao: string };
const escolhaBooleano = (v: boolean) => v ? "SIM" : "NAO";
export function camposIniciaisRegraBrasilNfe(historico?: HistoricoRegraBrasilNfe): { campos: CamposRegraBrasilNfe; pagamentos: CorrespondenciaPagamentoRegra[]; fundamentacao: FundamentacaoFormularioFiscal } {
  const v = historico?.versoes[0], c = v?.conteudo;
  const campos: CamposRegraBrasilNfe = { modelo: historico ? String(historico.modelo) : "", alvo: historico?.alvo ?? "", produtoId: historico?.produtoId ?? "", grupoId: historico?.grupoId ?? "", vigenteDesde: v?.vigenteDesde ?? "", vigenteAte: v?.vigenteAte ?? "" };
  let pagamentos: CorrespondenciaPagamentoRegra[] = [];
  if (c?.tipo === "EMPRESA") for (const [k, valor] of Object.entries(c.emitente)) campos[k] = String(valor);
  if (c?.tipo === "OPERACAO") {
    for (const [k, valor] of Object.entries(c.operacao)) campos[k] = typeof valor === "boolean" ? escolhaBooleano(valor) : String(valor);
    campos.fonte = c.pagamentos.fonte; campos.incluirCobranca = escolhaBooleano(c.pagamentos.incluirCobranca); campos.troco = c.pagamentos.troco;
    campos.identificar = escolhaBooleano(c.destinatario.identificar);
    if (c.destinatario.identificar) { campos.origemDestinatario = c.destinatario.origem; campos.indicadorIe = String(c.destinatario.IndicadorIe); }
    pagamentos = c.pagamentos.mapeamentos.map(m => ({ formaId: m.formaId, codigo: m.FormaPagamento, indicador: String(m.IndicadorPagamento), descricao: m.Descricao ?? "" }));
  }
  if (c?.tipo === "ITEM") {
    Object.assign(campos, c.perfil.classificacoes);
    for (const [k, valor] of Object.entries(c.perfil)) if (typeof valor === "boolean") campos[k] = escolhaBooleano(valor);
    campos.fatorTributavel = c.perfil.fatorTributavel;
    campos.representacaoIpi = c.perfil.representacaoIpi ?? "";
    if (c.perfil.ipiAplicavel === null) campos.ipiAplicavel = "NAO_DEFINIDO";
    for (const t of ["icms", "pis", "cofins"] as const) {
      const tributo = c.perfil[t]; campos[`${t}Tratamento`] = tributo.tratamento;
      if (tributo.tratamento === "TRIBUTADO") campos[`${t}Aliquota`] = t === "icms" && "AliquotaICMS" in tributo ? tributo.AliquotaICMS : "Aliquota" in tributo ? tributo.Aliquota : "";
    }
    if (c.perfil.icms.tratamento === "TRIBUTADO") campos.modalidadeBcIcms = String(c.perfil.icms.modalidadeBcIcms);
  }
  // Uma referência legada nunca é convertida automaticamente em fundamento ou aprovação interna.
  const fundamentacao = v?.fundamentacaoFiscal ? structuredClone(v.fundamentacaoFiscal) : fundamentacaoVaziaFormularioFiscal();
  return { campos, pagamentos, fundamentacao };
}
function requerido(v: string | undefined, nome: string) { if (!v) throw new Error(`Preencha ${nome}.`); return v; }
function booleano(v: string | undefined, nome: string) { if (v !== "SIM" && v !== "NAO") throw new Error(`Escolha Sim ou Não em ${nome}.`); return v === "SIM"; }
function inteiro(v: string | undefined, nome: string) { const texto = requerido(v, nome); if (!/^\d{1,7}$/.test(texto)) throw new Error(`Confira ${nome}.`); return Number(texto); }
function decimal(v: string | undefined, nome: string) { const texto = requerido(v, nome); if (!/^\d+(?:[.,]\d+)?$/.test(texto)) throw new Error(`Confira ${nome}.`); return texto.replace(",", "."); }
export function mensagemCampoRegraBrasilNfe(mensagem: string, campo?: string) {
  if (!campo) return mensagem;
  const nomes: Record<string, string> = { modelo: "Modelo", alvo: "Aplicar a", produtoId: "Produto", grupoId: "Grupo fiscal", revisao: "Revisão", fundamentacaoFiscal: "Fundamentação fiscal", vigenteDesde: "Início da vigência", vigenteAte: "Fim da vigência", "emitente.crt": "CRT", "emitente.ie": "Inscrição estadual", "emitente.codMunicipio": "Município IBGE", "emitente.codPais": "Código do país", "emitente.pais": "País", "perfil.fatorTributavel": "Fator tributável" };
  const rotulo = nomes[campo] ?? (campo.startsWith("classificacoes.") ? ROTULOS_CLASSIFICACAO[campo.slice(15) as keyof typeof ROTULOS_CLASSIFICACAO] : undefined) ?? (campo.startsWith("fundamentacao") ? "Fundamentação fiscal" : campo.startsWith("pagamentos") ? "Pagamentos" : campo.startsWith("operacao") ? "Operação de venda" : campo.startsWith("destinatario") ? "Destinatário" : campo.startsWith("perfil.icms") ? "ICMS" : campo.startsWith("perfil.pis") ? "PIS" : campo.startsWith("perfil.cofins") ? "COFINS" : undefined);
  return rotulo ? `${mensagem} Confira o campo ${rotulo}.` : mensagem;
}
/** Converte somente escolhas explícitas do formulário; a validação fiscal e de autorização continua no serviço. */
export function montarRascunhoFormularioBrasilNfe(campos: CamposRegraBrasilNfe, pagamentos: CorrespondenciaPagamentoRegra[], historico?: HistoricoRegraBrasilNfe, fundamento = camposIniciaisRegraBrasilNfe(historico).fundamentacao): unknown {
  const modelo = inteiro(campos.modelo, "Modelo"), alvo = requerido(campos.alvo, "Aplicar a");
  let conteudo: unknown;
  if (alvo === "EMPRESA") conteudo = { tipo: "EMPRESA", emitente: { crt: inteiro(campos.crt, "CRT"), ie: requerido(campos.ie, "Inscrição estadual"), codMunicipio: requerido(campos.codMunicipio, "Município IBGE"), codPais: inteiro(campos.codPais, "Código do país"), pais: requerido(campos.pais, "País") } };
  else if (alvo === "OPERACAO") {
    const identificar = booleano(campos.identificar, "Identificar destinatário");
    if (!pagamentos.length) throw new Error("Adicione a correspondência fiscal de uma forma de pagamento existente.");
    conteudo = { tipo: "OPERACAO", operacao: { NaturezaOperacao: requerido(campos.NaturezaOperacao, "Natureza da operação"), Finalidade: inteiro(campos.Finalidade, "Finalidade"), IndicadorPresenca: inteiro(campos.IndicadorPresenca, "Presença do comprador"), ConsumidorFinal: booleano(campos.ConsumidorFinal, "Consumidor final"), CalcularIBPT: booleano(campos.CalcularIBPT, "Calcular IBPT"), ModalidadeFrete: inteiro(campos.ModalidadeFrete, "Modalidade do frete"), intermediadorAplicavel: booleano(campos.intermediadorAplicavel, "Intermediador") }, pagamentos: { fonte: requerido(campos.fonte, "Valores dos pagamentos"), incluirCobranca: booleano(campos.incluirCobranca, "Incluir cobrança"), troco: requerido(campos.troco, "Troco"), mapeamentos: pagamentos.map(m => ({ formaId: requerido(m.formaId, "Forma de pagamento"), FormaPagamento: requerido(m.codigo, "Código fiscal do pagamento"), IndicadorPagamento: inteiro(m.indicador, "Indicador do pagamento"), ...(m.descricao ? { Descricao: m.descricao } : {}) })) }, destinatario: identificar ? { identificar: true, origem: requerido(campos.origemDestinatario, "Dados do destinatário"), IndicadorIe: inteiro(campos.indicadorIe, "Indicador de IE") } : { identificar: false } };
  } else {
    const tributo = (t: "icms" | "pis" | "cofins") => {
      const tratamento = requerido(campos[`${t}Tratamento`], `Tratamento de ${t.toUpperCase()}`);
      if (tratamento === "SEM_DESTAQUE") return { tratamento };
      if (t !== "icms" && tratamento === "RECOLHIDO_DAS") return { tratamento };
      if (tratamento !== "TRIBUTADO") throw new Error(`Confira o tratamento de ${t.toUpperCase()}.`);
      return { tratamento, [t === "icms" ? "AliquotaICMS" : "Aliquota"]: decimal(campos[`${t}Aliquota`], `Alíquota de ${t.toUpperCase()}`), ...(t === "icms" ? { modalidadeBcIcms: inteiro(campos.modalidadeBcIcms, "Modalidade da base ICMS") } : {}) };
    };
    conteudo = { tipo: "ITEM", perfil: { classificacoes: Object.fromEntries([...CAMPOS_CLASSIFICACAO.map(k => [k, k === "fcp" && campos[k] ? decimal(campos[k], "FCP") : campos[k] ?? ""]), ...CAMPOS_CLASSIFICACAO_ADICIONAIS.filter(k => campos[k]).map(k => [k, campos[k]])]), ...(campos.representacaoIpi ? { representacaoIpi: campos.representacaoIpi } : {}), fatorTributavel: decimal(campos.fatorTributavel, "Fator tributável"), icms: tributo("icms"), pis: tributo("pis"), cofins: tributo("cofins"), ...Object.fromEntries(["cestAplicavel", "ipiAplicavel", "stAplicavel", "fcpAplicavel", "difalAplicavel", "ibsCbsAplicavel", "beneficioFiscalAplicavel"].map(k => [k, k === "ipiAplicavel" && campos[k] === "NAO_DEFINIDO" ? null : booleano(campos[k], k === "cestAplicavel" ? "CEST aplicável" : k.replace("Aplicavel", " aplicável"))])) } };
  }
  const operacao = modelo === 55 ? "NF_E_VENDA" : "NFC_E_VENDA";
  return { ...(historico ? { regraId: historico.id } : {}), revisao: historico?.revisao ?? 0, modelo, operacao, alvo, ...(alvo === "PRODUTO" ? { produtoId: requerido(campos.produtoId, "Produto") } : {}), ...(alvo === "GRUPO" ? { grupoId: requerido(campos.grupoId, "Grupo fiscal") } : {}), fundamentacaoFiscal: { ...fundamento, contexto: { ...fundamento.contexto, operacao } }, vigenteDesde: requerido(campos.vigenteDesde, "Início da vigência"), vigenteAte: campos.vigenteAte || null, conteudo };
}
export function resumoConteudoRegraBrasilNfe(c: ConteudoRegraFiscalBrasilNfe): [string, string][] {
  if (c.tipo === "EMPRESA") return [["CRT", String(c.emitente.crt)], ["Inscrição estadual", c.emitente.ie], ["Município IBGE", c.emitente.codMunicipio], ["País", `${c.emitente.codPais} · ${c.emitente.pais}`]];
  if (c.tipo === "OPERACAO") return [["Natureza", c.operacao.NaturezaOperacao], ["Finalidade", String(c.operacao.Finalidade)], ["Presença", String(c.operacao.IndicadorPresenca)], ["Consumidor final", escolhaBooleano(c.operacao.ConsumidorFinal)], ["Calcular IBPT", escolhaBooleano(c.operacao.CalcularIBPT)], ["Frete", String(c.operacao.ModalidadeFrete)], ["Intermediador", escolhaBooleano(c.operacao.intermediadorAplicavel)], ["Destinatário identificado", escolhaBooleano(c.destinatario.identificar)], ["Fonte dos pagamentos", c.pagamentos.fonte === "TOTAL" ? "Total do pedido" : "Parcelas fotografadas"], ["Cobrança", escolhaBooleano(c.pagamentos.incluirCobranca)], ["Troco", c.pagamentos.troco], ...c.pagamentos.mapeamentos.map(m => ["Pagamento", `Código ${m.FormaPagamento} · indicador ${m.IndicadorPagamento}${m.Descricao ? ` · ${m.Descricao}` : ""}`] as [string, string])];
  return [...[...CAMPOS_CLASSIFICACAO, ...CAMPOS_CLASSIFICACAO_ADICIONAIS.filter(k => c.perfil.classificacoes[k])].map(k => [ROTULOS_CLASSIFICACAO[k], c.perfil.classificacoes[k] || "Não informado"] as [string, string]), ["Fator tributável", c.perfil.fatorTributavel], ["Representação IPI", c.perfil.representacaoIpi === "OMITIR_SIMPLES" ? "Omitir grupo na saída do Simples, mediante fundamento e aprovação" : "Contrato anterior, sem decisão de omissão"], ...(["icms", "pis", "cofins"] as const).map(t => [t.toUpperCase(), c.perfil[t].tratamento === "SEM_DESTAQUE" ? "Sem destaque" : c.perfil[t].tratamento === "RECOLHIDO_DAS" ? "Recolhido no DAS · CST 49/99 · sem destaque de base ou alíquota" : `Tributado · ${"AliquotaICMS" in c.perfil[t] ? c.perfil[t].AliquotaICMS : "Aliquota" in c.perfil[t] ? c.perfil[t].Aliquota : ""}%`] as [string, string]), ...["cestAplicavel", "ipiAplicavel", "stAplicavel", "fcpAplicavel", "difalAplicavel", "ibsCbsAplicavel", "beneficioFiscalAplicavel"].map(k => [k.replace("Aplicavel", " aplicável").toUpperCase(), k === "ipiAplicavel" && c.perfil.ipiAplicavel === null ? "Enquadramento federal não decidido; representação documental independente" : escolhaBooleano(c.perfil[k as "cestAplicavel"])] as [string, string])];
}
