import { createHash } from "node:crypto";
import { gtinFiscalBrasilNfeValido } from "./gtin";
import type { ParametrosPayloadLocalBrasilNfe, RegraItemFiscalLocal } from "./payload-local-tipos";
import { validarFundamentacaoFiscalBrasilNfe, type FundamentacaoFiscalBrasilNfe } from "./fundamentacao-dominio";

export type AlvoRegraFiscalBrasilNfe = "EMPRESA" | "OPERACAO" | "PRODUTO" | "GRUPO";
export type EstadoRegraFiscalBrasilNfe = "RASCUNHO" | "PROPOSTA" | "EM_REVISAO" | "APROVADA" | "BLOQUEADA" | "INATIVA";
export type ClassificacoesRegraFiscalBrasilNfe = Record<"ncm" | "cest" | "origem" | "cfop" | "csosn" | "cstIcms" | "pis" | "cofins" | "ipi" | "fcp" | "ean" | "unidadeTributavel", string> & Partial<Record<"cEnq" | "cBenef" | "cstIbsCbs" | "cClassTrib", string>>;
type PerfilTributo = { tratamento: "SEM_DESTAQUE" | "RECOLHIDO_DAS" } | { tratamento: "TRIBUTADO"; Aliquota: string };
export type PerfilItemRegraFiscalBrasilNfe = {
  classificacoes: ClassificacoesRegraFiscalBrasilNfe;
  cestAplicavel: boolean; fatorTributavel: string;
  icms: { tratamento: "SEM_DESTAQUE" } | { tratamento: "TRIBUTADO"; AliquotaICMS: string; modalidadeBcIcms: 0 | 1 | 2 | 3 };
  pis: PerfilTributo; cofins: PerfilTributo;
  ipiAplicavel: boolean | null; stAplicavel: boolean; fcpAplicavel: boolean;
  representacaoIpi?: "OMITIR_SIMPLES";
  difalAplicavel: boolean; ibsCbsAplicavel: boolean; beneficioFiscalAplicavel: boolean;
};
export type ConteudoRegraFiscalBrasilNfe =
  | { tipo: "EMPRESA"; emitente: ParametrosPayloadLocalBrasilNfe["emitente"] }
  | { tipo: "OPERACAO"; operacao: ParametrosPayloadLocalBrasilNfe["operacao"]; pagamentos: { fonte: "TOTAL" | "PARCELAS"; incluirCobranca: boolean; troco: "0"; mapeamentos: { formaId: string; FormaPagamento: string; IndicadorPagamento: 0 | 1; Descricao?: string }[] }; destinatario: { identificar: false } | { identificar: true; origem: "comprador" | "cobranca" | "destinatario"; IndicadorIe: 1 | 2 | 9 } }
  | { tipo: "ITEM"; perfil: PerfilItemRegraFiscalBrasilNfe };
export type RascunhoRegraFiscalBrasilNfe = {
  regraId?: string; revisao: number; modelo: 55 | 65; operacao: "NF_E_VENDA" | "NFC_E_VENDA";
  alvo: AlvoRegraFiscalBrasilNfe; produtoId?: string; grupoId?: string;
  fundamentacaoFiscal: FundamentacaoFiscalBrasilNfe; vigenteDesde: string; vigenteAte: string | null; conteudo: ConteudoRegraFiscalBrasilNfe;
};
export type BaseItemDocumentoBrasilNfe = { itemId: string; icms?: string; pis?: string; cofins?: string };
export type ComplementosDocumentoBrasilNfe = {
  destinatario?: Extract<ParametrosPayloadLocalBrasilNfe["destinatario"], { identificar: true }>["endereco"];
  bases: BaseItemDocumentoBrasilNfe[];
  cartoes: { formaId: string; cartao: NonNullable<ParametrosPayloadLocalBrasilNfe["pagamentos"]["mapeamentos"][number]["cartao"]> }[];
};
export type SelecaoRegrasDocumentoBrasilNfe = {
  documentoId: string; modelo: 55 | 65; ambiente?: "HOMOLOGACAO" | "PRODUCAO"; empresaVersaoId: string; operacaoVersaoId: string;
  itens: { itemId: string; versaoId: string }[]; complementos: ComplementosDocumentoBrasilNfe;
};
export class ErroRegraFiscalBrasilNfe extends Error {
  constructor(public readonly campo = "regra", mensagem = "Configuração tributária inválida.") { super(mensagem); this.name = "ErroRegraFiscalBrasilNfe"; }
}
function erro(campo: string): never { throw new ErroRegraFiscalBrasilNfe(campo); }
export const identidadeRegraBrasilNfe = (v: unknown, campo = "id") => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : erro(campo);
function objeto(v: unknown, permitidos: readonly string[], campo: string) {
  if (!v || typeof v !== "object" || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) return erro(campo);
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some(k => !permitidos.includes(k))) return erro(campo);
  return o;
}
function texto(v: unknown, maximo: number, campo: string, vazio = false) {
  if (typeof v !== "string" || v.length > maximo || (!vazio && !v.trim()) || /[<>\u0000-\u001f\u007f]|https?:|[A-Za-z0-9+/_=-]{40,}|(?:token|usertoken|password|senha|certificado|cookie|bearer|csc)\s*[:=]/i.test(v)) return erro(campo);
  return v.trim();
}
function booleano(v: unknown, campo: string) { return typeof v === "boolean" ? v : erro(campo); }
function escolha<T extends string | number>(v: unknown, permitidos: readonly T[], campo: string): T { return permitidos.includes(v as T) ? v as T : erro(campo); }
function percentual(v: unknown, campo: string) { return typeof v === "string" && /^(?:\d{1,2}(?:\.\d{1,4})?|100(?:\.0{1,4})?)$/.test(v) ? v : erro(campo); }
function base(v: unknown, campo: string) { return typeof v === "string" && /^\d{1,12}(?:\.\d{1,2})?$/.test(v) ? v : erro(campo); }
export function dataCivilRegraBrasilNfe(v: unknown, campo = "vigencia") {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || v < "2000-01-01" || v > "2199-12-31") return erro(campo);
  const instante = new Date(`${v}T00:00:00.000Z`);
  return Number.isFinite(instante.valueOf()) && instante.toISOString().slice(0, 10) === v ? v : erro(campo);
}
export function hojeCivilRegraBrasilNfe() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function referenciaConfirpRegraBrasilNfe(v: unknown) {
  const t = texto(v, 100, "referenciaConfirp");
  return /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ._:/()-]*$/.test(t) ? t : erro("referenciaConfirp");
}
const camposClassificacao = ["ncm", "cest", "origem", "cfop", "csosn", "cstIcms", "pis", "cofins", "ipi", "fcp", "ean", "unidadeTributavel"] as const;
const camposClassificacaoAdicionais = ["cEnq", "cBenef", "cstIbsCbs", "cClassTrib"] as const;
export function classificacoesRegraBrasilNfe(v: unknown): ClassificacoesRegraFiscalBrasilNfe {
  // Cadastro existente pode ter observações. Somente os campos fiscais estruturados são fotografados neste complemento.
  const o = v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const r = {} as ClassificacoesRegraFiscalBrasilNfe;
  for (const campo of camposClassificacao) r[campo] = o[campo] === undefined ? "" : texto(o[campo], 30, `classificacoes.${campo}`, true);
  const adicionais = { cEnq: /^\d{3}$/, cBenef: /^[A-Z]{2}\d{6}$/, cstIbsCbs: /^\d{3}$/, cClassTrib: /^\d{6}$/ };
  // Ausência continua ausente. Não inserir defaults nem alterar o hash das versões anteriores.
  for (const campo of camposClassificacaoAdicionais) if (o[campo] !== undefined && o[campo] !== "") {
    const valor = texto(o[campo], 8, `classificacoes.${campo}`);
    if (!adicionais[campo].test(valor)) erro(`classificacoes.${campo}`);
    r[campo] = valor;
  }
  const formatos: Partial<Record<typeof camposClassificacao[number], RegExp>> = { ncm: /^\d{8}$/, cest: /^\d{7}$/, origem: /^[0-8]$/, cfop: /^\d{4}$/, csosn: /^\d{3}$/, cstIcms: /^\d{2}$/, pis: /^\d{2}$/, cofins: /^\d{2}$/, ipi: /^\d{2}$/, ean: /^(\d{8}|\d{12,14}|SEM GTIN)$/, unidadeTributavel: /^[A-Z0-9]{1,10}$/ };
  for (const [campo, formato] of Object.entries(formatos)) { const valor = r[campo as keyof typeof r]; if (valor && !formato.test(valor)) erro(`classificacoes.${campo}`); }
  if (r.fcp) percentual(r.fcp, "classificacoes.fcp");
  return r;
}
/** Completa para nova aprovação. A leitura de versões históricas conserva o contrato anterior. */
export function classificacoesCompletasRegraBrasilNfe(c: ClassificacoesRegraFiscalBrasilNfe) { return !!(c.ncm && c.origem && c.cfop && (c.csosn || c.cstIcms) && !(c.csosn && c.cstIcms) && c.pis && c.cofins && c.unidadeTributavel && gtinFiscalBrasilNfeValido(c.ean)); }
function tributo(v: unknown, campo: string): PerfilTributo {
  const o = objeto(v, ["tratamento", "Aliquota"], campo);
  const tratamento = escolha(o.tratamento, ["SEM_DESTAQUE", "RECOLHIDO_DAS", "TRIBUTADO"] as const, campo);
  if (tratamento === "RECOLHIDO_DAS") { if (Object.keys(o).some(k => k !== "tratamento")) erro(campo); return { tratamento }; }
  if (tratamento === "SEM_DESTAQUE") { if (o.Aliquota !== undefined) erro(campo); return { tratamento }; }
  return { tratamento, Aliquota: percentual(o.Aliquota, `${campo}.Aliquota`) };
}
export function validarConteudoRegraFiscalBrasilNfe(v: unknown, alvo: AlvoRegraFiscalBrasilNfe): ConteudoRegraFiscalBrasilNfe {
  if (alvo === "EMPRESA") {
    const o = objeto(v, ["tipo", "emitente"], "conteudo"), e = objeto(o.emitente, ["crt", "ie", "codMunicipio", "codPais", "pais"], "emitente");
    if (o.tipo !== "EMPRESA") erro("conteudo.tipo");
    if (typeof e.ie !== "string" || !/^\d{2,14}$/.test(e.ie)) erro("emitente.ie");
    if (typeof e.codMunicipio !== "string" || !/^\d{7}$/.test(e.codMunicipio)) erro("emitente.codMunicipio");
    return { tipo: "EMPRESA", emitente: { crt: escolha(e.crt, [1, 2, 3, 4] as const, "emitente.crt"), ie: e.ie, codMunicipio: e.codMunicipio, codPais: escolha(e.codPais, [1058], "emitente.codPais"), pais: texto(e.pais, 60, "emitente.pais") } };
  }
  if (alvo === "OPERACAO") {
    const o = objeto(v, ["tipo", "operacao", "pagamentos", "destinatario"], "conteudo");
    if (o.tipo !== "OPERACAO") erro("conteudo.tipo");
    const op = objeto(o.operacao, ["NaturezaOperacao", "Finalidade", "IndicadorPresenca", "ConsumidorFinal", "CalcularIBPT", "ModalidadeFrete", "intermediadorAplicavel"], "operacao");
    const p = objeto(o.pagamentos, ["fonte", "incluirCobranca", "troco", "mapeamentos"], "pagamentos");
    if (!Array.isArray(p.mapeamentos) || !p.mapeamentos.length || p.mapeamentos.length > 100) erro("pagamentos.mapeamentos");
    const mapeamentos = (p.mapeamentos as unknown[]).map((m, i) => {
      const campo = `pagamentos.mapeamentos[${i}]`, r = objeto(m, ["formaId", "FormaPagamento", "IndicadorPagamento", "Descricao"], campo);
      if (typeof r.FormaPagamento !== "string" || !/^\d{2}$/.test(r.FormaPagamento)) erro(`${campo}.FormaPagamento`);
      const resultado = { formaId: identidadeRegraBrasilNfe(r.formaId, `${campo}.formaId`), FormaPagamento: r.FormaPagamento, IndicadorPagamento: escolha(r.IndicadorPagamento, [0, 1] as const, `${campo}.IndicadorPagamento`), ...(r.Descricao === undefined ? {} : { Descricao: texto(r.Descricao, 60, `${campo}.Descricao`) }) };
      if (resultado.FormaPagamento === "99" && !resultado.Descricao) erro(`${campo}.Descricao`);
      return resultado;
    });
    if (new Set(mapeamentos.map(m => m.formaId)).size !== mapeamentos.length) erro("pagamentos.mapeamentos");
    const d = objeto(o.destinatario, ["identificar", "origem", "IndicadorIe"], "destinatario"), identificar = booleano(d.identificar, "destinatario.identificar");
    const destinatario = identificar ? { identificar: true as const, origem: escolha(d.origem, ["comprador", "cobranca", "destinatario"] as const, "destinatario.origem"), IndicadorIe: escolha(d.IndicadorIe, [1, 2, 9] as const, "destinatario.IndicadorIe") } : { identificar: false as const };
    if (!identificar && (d.origem !== undefined || d.IndicadorIe !== undefined)) erro("destinatario");
    return { tipo: "OPERACAO", operacao: { NaturezaOperacao: texto(op.NaturezaOperacao, 60, "operacao.NaturezaOperacao"), Finalidade: escolha(op.Finalidade, [1], "operacao.Finalidade"), IndicadorPresenca: escolha(op.IndicadorPresenca, [0, 1, 2, 3, 4, 5, 9] as const, "operacao.IndicadorPresenca"), ConsumidorFinal: booleano(op.ConsumidorFinal, "operacao.ConsumidorFinal"), CalcularIBPT: booleano(op.CalcularIBPT, "operacao.CalcularIBPT"), ModalidadeFrete: escolha(op.ModalidadeFrete, [0, 1, 2, 3, 4, 9] as const, "operacao.ModalidadeFrete"), intermediadorAplicavel: booleano(op.intermediadorAplicavel, "operacao.intermediadorAplicavel") }, pagamentos: { fonte: escolha(p.fonte, ["TOTAL", "PARCELAS"] as const, "pagamentos.fonte"), incluirCobranca: booleano(p.incluirCobranca, "pagamentos.incluirCobranca"), troco: escolha(p.troco, ["0"] as const, "pagamentos.troco"), mapeamentos }, destinatario };
  }
  const o = objeto(v, ["tipo", "perfil"], "conteudo");
  if (o.tipo !== "ITEM") erro("conteudo.tipo");
  const p = objeto(o.perfil, ["classificacoes", "cestAplicavel", "fatorTributavel", "icms", "pis", "cofins", "ipiAplicavel", "representacaoIpi", "stAplicavel", "fcpAplicavel", "difalAplicavel", "ibsCbsAplicavel", "beneficioFiscalAplicavel"], "perfil");
  const representacaoIpi = p.representacaoIpi === undefined ? {} : { representacaoIpi: escolha(p.representacaoIpi, ["OMITIR_SIMPLES"] as const, "perfil.representacaoIpi") };
  objeto(p.classificacoes, [...camposClassificacao, ...camposClassificacaoAdicionais], "classificacoes");
  const classificacoes = classificacoesRegraBrasilNfe(p.classificacoes);
  if (classificacoes.cEnq && p.ipiAplicavel !== true) erro("classificacoes.cEnq");
  if (classificacoes.cBenef && p.beneficioFiscalAplicavel !== true) erro("classificacoes.cBenef");
  if ((classificacoes.cstIbsCbs || classificacoes.cClassTrib) && p.ibsCbsAplicavel !== true) erro("classificacoes.cClassTrib");
  if (classificacoes.cClassTrib && (!classificacoes.cstIbsCbs || !classificacoes.cClassTrib.startsWith(classificacoes.cstIbsCbs))) erro("classificacoes.cClassTrib");
  const i = objeto(p.icms, ["tratamento", "AliquotaICMS", "modalidadeBcIcms"], "perfil.icms");
  const tratamento = escolha(i.tratamento, ["SEM_DESTAQUE", "TRIBUTADO"] as const, "perfil.icms.tratamento");
  if (tratamento === "SEM_DESTAQUE" && (i.AliquotaICMS !== undefined || i.modalidadeBcIcms !== undefined)) erro("perfil.icms");
  const icms = tratamento === "SEM_DESTAQUE" ? { tratamento } : { tratamento, AliquotaICMS: percentual(i.AliquotaICMS, "perfil.icms.AliquotaICMS"), modalidadeBcIcms: escolha(i.modalidadeBcIcms, [0, 1, 2, 3] as const, "perfil.icms.modalidadeBcIcms") };
  if (typeof p.fatorTributavel !== "string" || !/^\d{1,10}(?:\.\d{1,6})?$/.test(p.fatorTributavel) || /^0+(?:\.0+)?$/.test(p.fatorTributavel)) erro("perfil.fatorTributavel");
  return { tipo: "ITEM", perfil: { ...representacaoIpi, classificacoes: classificacoesRegraBrasilNfe(p.classificacoes), cestAplicavel: booleano(p.cestAplicavel, "perfil.cestAplicavel"), fatorTributavel: p.fatorTributavel, icms, pis: tributo(p.pis, "perfil.pis"), cofins: tributo(p.cofins, "perfil.cofins"), ipiAplicavel: p.ipiAplicavel === null && p.representacaoIpi === "OMITIR_SIMPLES" ? null : booleano(p.ipiAplicavel, "perfil.ipiAplicavel"), stAplicavel: booleano(p.stAplicavel, "perfil.stAplicavel"), fcpAplicavel: booleano(p.fcpAplicavel, "perfil.fcpAplicavel"), difalAplicavel: booleano(p.difalAplicavel, "perfil.difalAplicavel"), ibsCbsAplicavel: booleano(p.ibsCbsAplicavel, "perfil.ibsCbsAplicavel"), beneficioFiscalAplicavel: booleano(p.beneficioFiscalAplicavel, "perfil.beneficioFiscalAplicavel") } };
}
export function validarRascunhoRegraFiscalBrasilNfe(v: unknown): RascunhoRegraFiscalBrasilNfe {
  const o = objeto(v, ["regraId", "revisao", "modelo", "operacao", "alvo", "produtoId", "grupoId", "fundamentacaoFiscal", "vigenteDesde", "vigenteAte", "conteudo"], "regra");
  if (!Number.isSafeInteger(o.revisao) || (o.revisao as number) < 0 || (o.revisao as number) > 1000000) erro("revisao");
  const modelo = escolha(o.modelo, [55, 65] as const, "modelo"), operacao = modelo === 55 ? "NF_E_VENDA" : "NFC_E_VENDA";
  if (o.operacao !== operacao) erro("operacao");
  const alvo = escolha(o.alvo, ["EMPRESA", "OPERACAO", "PRODUTO", "GRUPO"] as const, "alvo");
  if ((alvo === "PRODUTO") !== (o.produtoId !== undefined) || (alvo === "GRUPO") !== (o.grupoId !== undefined)) erro("alvo");
  const vigenteDesde = dataCivilRegraBrasilNfe(o.vigenteDesde, "vigenteDesde"), vigenteAte = o.vigenteAte === null || o.vigenteAte === undefined ? null : dataCivilRegraBrasilNfe(o.vigenteAte, "vigenteAte");
  if (vigenteAte && vigenteAte < vigenteDesde) erro("vigenteAte");
  const fundamentacaoFiscal = validarFundamentacaoFiscalBrasilNfe(o.fundamentacaoFiscal);
  if (fundamentacaoFiscal.contexto.operacao !== operacao) erro("fundamentacaoFiscal.contexto.operacao");
  return { ...(o.regraId === undefined ? {} : { regraId: identidadeRegraBrasilNfe(o.regraId, "regraId") }), revisao: o.revisao as number, modelo, operacao, alvo, ...(alvo === "PRODUTO" ? { produtoId: identidadeRegraBrasilNfe(o.produtoId, "produtoId") } : {}), ...(alvo === "GRUPO" ? { grupoId: identidadeRegraBrasilNfe(o.grupoId, "grupoId") } : {}), fundamentacaoFiscal, vigenteDesde, vigenteAte, conteudo: validarConteudoRegraFiscalBrasilNfe(o.conteudo, alvo) };
}
export function hashRegraFiscalBrasilNfe(v: unknown): string {
  const ordenar = (x: unknown): unknown => Array.isArray(x) ? x.map(ordenar) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, valor]) => [k, ordenar(valor)])) : x;
  return createHash("sha256").update(JSON.stringify(ordenar(v))).digest("hex");
}
export function vigenteRegraFiscalBrasilNfe(v: { estado: string; vigenteDesde: string; vigenteAte: string | null }, data: string) {
  dataCivilRegraBrasilNfe(data);
  return v.estado === "APROVADA" && v.vigenteDesde <= data && (!v.vigenteAte || v.vigenteAte >= data);
}
/** Bases explícitas da decisão aplicada a este documento, sem inferência do valor comercial. */
export function materializarItemRegraBrasilNfe(perfil: PerfilItemRegraFiscalBrasilNfe, vinculo: Pick<RegraItemFiscalLocal, "itemId" | "produtoId" | "versaoCadastro" | "referenciaConfirp" | "referenciaFundamentacao">, valores: BaseItemDocumentoBrasilNfe): RegraItemFiscalLocal {
  const p = validarConteudoRegraFiscalBrasilNfe({ tipo: "ITEM", perfil }, "PRODUTO");
  if (p.tipo !== "ITEM") return erro("perfil");
  const o = objeto(valores, ["itemId", "icms", "pis", "cofins"], "bases");
  if (o.itemId !== vinculo.itemId) erro("bases.itemId");
  const icms = p.perfil.icms.tratamento === "TRIBUTADO" ? { ...p.perfil.icms, BaseCalculo: base(o.icms, "bases.icms") } : p.perfil.icms;
  const pis = p.perfil.pis.tratamento === "TRIBUTADO" ? { ...p.perfil.pis, BaseCalculo: base(o.pis, "bases.pis") } : p.perfil.pis;
  const cofins = p.perfil.cofins.tratamento === "TRIBUTADO" ? { ...p.perfil.cofins, BaseCalculo: base(o.cofins, "bases.cofins") } : p.perfil.cofins;
  for (const [nome, tributo] of [["icms", p.perfil.icms], ["pis", p.perfil.pis], ["cofins", p.perfil.cofins]] as const) {
    if ((tributo.tratamento === "RECOLHIDO_DAS" && Object.prototype.hasOwnProperty.call(o, nome)) || (tributo.tratamento === "SEM_DESTAQUE" && o[nome] !== undefined)) erro(`bases.${nome}`);
  }
  const resto = { ...p.perfil }; delete (resto as Partial<PerfilItemRegraFiscalBrasilNfe>).classificacoes;
  return { ...resto, ...vinculo, icms, pis, cofins };
}
export function validarSelecaoRegrasDocumentoBrasilNfe(v: unknown): SelecaoRegrasDocumentoBrasilNfe {
  const o = objeto(v, ["documentoId", "modelo", "ambiente", "empresaVersaoId", "operacaoVersaoId", "itens", "complementos"], "selecao");
  if (!Array.isArray(o.itens) || !o.itens.length || o.itens.length > 990) erro("itens");
  const itens = (o.itens as unknown[]).map((v, i) => { const p = objeto(v, ["itemId", "versaoId"], `itens[${i}]`); return { itemId: identidadeRegraBrasilNfe(p.itemId), versaoId: identidadeRegraBrasilNfe(p.versaoId) }; });
  if (new Set(itens.map(i => i.itemId)).size !== itens.length) erro("itens");
  const c = objeto(o.complementos, ["destinatario", "bases", "cartoes"], "complementos");
  if (!Array.isArray(c.bases) || c.bases.length !== itens.length || !Array.isArray(c.cartoes) || c.cartoes.length > 100) erro("complementos");
  const bases = (c.bases as unknown[]).map((v, i) => { const b = objeto(v, ["itemId", "icms", "pis", "cofins"], `bases[${i}]`); return { itemId: identidadeRegraBrasilNfe(b.itemId), ...(b.icms === undefined ? {} : { icms: base(b.icms, `bases[${i}].icms`) }), ...(b.pis === undefined ? {} : { pis: base(b.pis, `bases[${i}].pis`) }), ...(b.cofins === undefined ? {} : { cofins: base(b.cofins, `bases[${i}].cofins`) }) }; });
  if (new Set(bases.map(b => b.itemId)).size !== bases.length || bases.some(b => !itens.some(i => i.itemId === b.itemId))) erro("bases");
  // Dados de autorização de cartão são estritamente do documento, nunca perfil reutilizável.
  const cartoes = (c.cartoes as unknown[]).map((v, i) => {
    const r = objeto(v, ["formaId", "cartao"], `cartoes[${i}]`), a = objeto(r.cartao, ["TipoIntegracao", "CNPJCredenciadora", "BandeiraOperadora", "NumeroAutorizacao"], `cartoes[${i}].cartao`);
    if (typeof a.CNPJCredenciadora !== "string" || !/^\d{14}$/.test(a.CNPJCredenciadora) || typeof a.BandeiraOperadora !== "string" || !/^\d{2}$/.test(a.BandeiraOperadora) || typeof a.NumeroAutorizacao !== "string" || !/^[A-Za-z0-9_-]{1,20}$/.test(a.NumeroAutorizacao)) erro(`cartoes[${i}].cartao`);
    return { formaId: identidadeRegraBrasilNfe(r.formaId), cartao: { TipoIntegracao: booleano(a.TipoIntegracao, "cartao.TipoIntegracao"), CNPJCredenciadora: a.CNPJCredenciadora, BandeiraOperadora: a.BandeiraOperadora, NumeroAutorizacao: a.NumeroAutorizacao } };
  });
  if (new Set(cartoes.map(c => c.formaId)).size !== cartoes.length) erro("cartoes");
  let destinatario: ComplementosDocumentoBrasilNfe["destinatario"];
  if (c.destinatario !== undefined) {
    const e = objeto(c.destinatario, ["cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf", "codMunicipio", "codPais", "pais"], "destinatario");
    if (typeof e.cep !== "string" || !/^\d{8}$/.test(e.cep) || typeof e.uf !== "string" || !/^[A-Z]{2}$/.test(e.uf) || typeof e.codMunicipio !== "string" || !/^\d{7}$/.test(e.codMunicipio)) erro("destinatario");
    destinatario = { cep: e.cep, logradouro: texto(e.logradouro, 60, "destinatario.logradouro"), numero: texto(e.numero, 60, "destinatario.numero"), ...(e.complemento === undefined ? {} : { complemento: texto(e.complemento, 60, "destinatario.complemento", true) }), bairro: texto(e.bairro, 60, "destinatario.bairro"), cidade: texto(e.cidade, 60, "destinatario.cidade"), uf: e.uf, codMunicipio: e.codMunicipio, codPais: escolha(e.codPais, [1058], "destinatario.codPais"), pais: texto(e.pais, 60, "destinatario.pais") };
  }
  return { documentoId: identidadeRegraBrasilNfe(o.documentoId), modelo: escolha(o.modelo, [55, 65] as const, "modelo"), ...(o.ambiente === undefined ? {} : { ambiente: escolha(o.ambiente, ["HOMOLOGACAO", "PRODUCAO"] as const, "ambiente") }), empresaVersaoId: identidadeRegraBrasilNfe(o.empresaVersaoId), operacaoVersaoId: identidadeRegraBrasilNfe(o.operacaoVersaoId), itens, complementos: { ...(destinatario ? { destinatario } : {}), bases, cartoes } };
}
