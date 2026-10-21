import { createHash } from "node:crypto";

export type AmbienteEmissaoBrasilNfe = "HOMOLOGACAO" | "PRODUCAO";
export class ErroEmissaoPedidoBrasilNfe extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = "ErroEmissaoPedidoBrasilNfe"; }
}
export type ComandoEmissaoPedidoBrasilNfe = {
  documentoId: string; modelo: 55 | 65; ambiente: AmbienteEmissaoBrasilNfe;
  hashSnapshot: string; hashPayloadFiscal: string; total: string; autorizarUmaTransmissao: true; conferenciaSemDocumentoExterno: true;
  indicadorPresenca?: 1 | 2 | 3 | 4 | 5 | 9;
  revisaoConsolidada?: { hash: string; versoes: { id: string; hash: string }[]; confirmarAprovacao: true };
};
export function validarComandoEmissaoPedidoBrasilNfe(v: unknown): ComandoEmissaoPedidoBrasilNfe {
  const o = v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const campos = ["documentoId", "modelo", "ambiente", "hashSnapshot", "hashPayloadFiscal", "total", "autorizarUmaTransmissao", "conferenciaSemDocumentoExterno"];
  const opcionais = ["indicadorPresenca", "revisaoConsolidada"];
  if (campos.some(k => !Object.hasOwn(o, k)) || Object.keys(o).some(k => ![...campos, ...opcionais].includes(k))
    || typeof o.documentoId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(o.documentoId)
    || ![55, 65].includes(o.modelo as number) || !["HOMOLOGACAO", "PRODUCAO"].includes(o.ambiente as string)
    || o.autorizarUmaTransmissao !== true || o.conferenciaSemDocumentoExterno !== true || ![o.hashSnapshot, o.hashPayloadFiscal].every(h => typeof h === "string" && /^[a-f0-9]{64}$/.test(h))
    || typeof o.total !== "string" || !/^(?:0|[1-9]\d{0,11})\.\d{2}$/.test(o.total) || !/[1-9]/.test(o.total)
    || o.indicadorPresenca !== undefined && ![1, 2, 3, 4, 5, 9].includes(o.indicadorPresenca as number)) throw new ErroEmissaoPedidoBrasilNfe("Confirme somente o documento, modelo, ambiente, hashes e total apresentados nesta revisão.");
  if (o.revisaoConsolidada !== undefined) {
    const r = o.revisaoConsolidada as ComandoEmissaoPedidoBrasilNfe["revisaoConsolidada"];
    if (!r || Object.keys(r).length !== 3 || Object.keys(r).some(k => !["hash", "versoes", "confirmarAprovacao"].includes(k)) || r.confirmarAprovacao !== true || typeof r.hash !== "string" || !/^[a-f0-9]{64}$/.test(r.hash)
      || !Array.isArray(r.versoes) || !r.versoes.length || r.versoes.length > 2 || new Set(r.versoes.map(v => v?.id)).size !== r.versoes.length
      || r.versoes.some(v => !v || Object.keys(v).length !== 2 || Object.keys(v).some(k => !["id", "hash"].includes(k)) || typeof v.id !== "string" || typeof v.hash !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(v.id) || !/^[a-f0-9]{64}$/.test(v.hash))) throw new ErroEmissaoPedidoBrasilNfe("Aprovar somente as versões e o hash apresentados no resumo fiscal.");
  }
  return o as ComandoEmissaoPedidoBrasilNfe;
}
export type EntradaDecisaoProducao65BrasilNfe = {
  versao: 1; tipo: "DECISAO_ADMINISTRATIVA_SEM_HOMOLOGACAO_LOCAL";
  motivo: "CSC_HOMOLOGACAO_INDISPONIVEL_RESPONSAVEL"; confirmarResponsabilidade: true;
  modoRegistro: "SESSAO_NORMAL" | "AUTOMACAO_ASSISTIDA";
};
export type ContextoDecisaoProducao65BrasilNfe = {
  ambiente: AmbienteEmissaoBrasilNfe; versaoConfiguracao: number; emitenteHash: string;
};
export type DecisaoProducao65BrasilNfe = EntradaDecisaoProducao65BrasilNfe & {
  modelo: 65; ambiente: "PRODUCAO"; versaoConfiguracao: number; emitenteHash: string;
  origem: "SESSAO_ADMINISTRATIVA" | "INSTRUCAO_RESPONSAVEL"; registradaEm: string; cscProducaoVerificadoEm: string;
  responsavel: { usuarioId: string; nome: string };
  executor: { usuarioId: string; nome: string; modo: EntradaDecisaoProducao65BrasilNfe["modoRegistro"]; identificacao: "Sessão normal" | "Codex" };
  hashConteudo: string;
};
const camposEntradaDecisao65 = ["versao", "tipo", "motivo", "confirmarResponsabilidade", "modoRegistro"] as const;
const camposRegistroDecisao65 = [...camposEntradaDecisao65, "modelo", "ambiente", "versaoConfiguracao", "emitenteHash", "origem", "registradaEm", "cscProducaoVerificadoEm", "responsavel", "executor", "hashConteudo"] as const;
function objetoDecisao65(valor: unknown, campos: readonly string[]): Record<string, unknown> | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor) || ![Object.prototype, null].includes(Object.getPrototypeOf(valor))) return null;
  const chaves = Reflect.ownKeys(valor);
  return chaves.length === campos.length && chaves.every(k => typeof k === "string" && campos.includes(k)) ? valor as Record<string, unknown> : null;
}
const idDecisao65 = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const hashValidoDecisao65 = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const nomeDecisao65 = (v: unknown): v is string => typeof v === "string" && v === v.trim() && v.length > 0 && v.length <= 200 && !/[\p{C}<>]/u.test(v);
function instanteDecisao65(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
}
function hashDecisao65(v: Omit<DecisaoProducao65BrasilNfe, "hashConteudo">): string {
  const ordenar = (x: unknown): unknown => x && typeof x === "object" && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, valor]) => [k, ordenar(valor)])) : x;
  return createHash("sha256").update(JSON.stringify(ordenar(v))).digest("hex");
}
export function validarDecisaoProducao65BrasilNfe(entrada: unknown): EntradaDecisaoProducao65BrasilNfe {
  const d = objetoDecisao65(entrada, camposEntradaDecisao65);
  if (!d || d.versao !== 1 || d.tipo !== "DECISAO_ADMINISTRATIVA_SEM_HOMOLOGACAO_LOCAL"
    || d.motivo !== "CSC_HOMOLOGACAO_INDISPONIVEL_RESPONSAVEL" || d.confirmarResponsabilidade !== true
    || !["SESSAO_NORMAL", "AUTOMACAO_ASSISTIDA"].includes(d.modoRegistro as string)) throw new ErroEmissaoPedidoBrasilNfe("Confirme a decisão administrativa específica para NFC-e 65 em produção, sem comprovação de homologação local.");
  return { versao: 1, tipo: "DECISAO_ADMINISTRATIVA_SEM_HOMOLOGACAO_LOCAL", motivo: "CSC_HOMOLOGACAO_INDISPONIVEL_RESPONSAVEL", confirmarResponsabilidade: true, modoRegistro: d.modoRegistro as EntradaDecisaoProducao65BrasilNfe["modoRegistro"] };
}
/** O serviço fornece a sessão autenticada e a evidência de CSC. Esta decisão não comprova homologação nem autoriza uma nota. */
export function selarDecisaoProducao65BrasilNfe(entrada: unknown, contexto: Omit<ContextoDecisaoProducao65BrasilNfe, "ambiente"> & {
  autor: { userId: string; nome: string }; registradaEm: string; cscProducaoVerificadoEm: string;
}): DecisaoProducao65BrasilNfe {
  const d = validarDecisaoProducao65BrasilNfe(entrada), autor = objetoDecisao65(contexto.autor, ["userId", "nome"]);
  if (!Number.isSafeInteger(contexto.versaoConfiguracao) || contexto.versaoConfiguracao < 1 || !hashValidoDecisao65(contexto.emitenteHash)
    || !autor || !idDecisao65(autor.userId) || !nomeDecisao65(autor.nome) || !instanteDecisao65(contexto.registradaEm)
    || !instanteDecisao65(contexto.cscProducaoVerificadoEm) || contexto.cscProducaoVerificadoEm > contexto.registradaEm) throw new ErroEmissaoPedidoBrasilNfe("A decisão exige autoria autenticada, configuração vigente e conferência anterior do CSC de produção.");
  const assistida = d.modoRegistro === "AUTOMACAO_ASSISTIDA";
  const registro: Omit<DecisaoProducao65BrasilNfe, "hashConteudo"> = { ...d, modelo: 65, ambiente: "PRODUCAO", versaoConfiguracao: contexto.versaoConfiguracao,
    emitenteHash: contexto.emitenteHash, origem: assistida ? "INSTRUCAO_RESPONSAVEL" : "SESSAO_ADMINISTRATIVA", registradaEm: contexto.registradaEm,
    cscProducaoVerificadoEm: contexto.cscProducaoVerificadoEm, responsavel: { usuarioId: autor.userId, nome: autor.nome },
    executor: { usuarioId: autor.userId, nome: autor.nome, modo: d.modoRegistro, identificacao: assistida ? "Codex" : "Sessão normal" } };
  return { ...registro, hashConteudo: hashDecisao65(registro) };
}
export function restaurarDecisaoProducao65BrasilNfe(valor: unknown, contexto: ContextoDecisaoProducao65BrasilNfe): DecisaoProducao65BrasilNfe | null {
  const d = objetoDecisao65(valor, camposRegistroDecisao65);
  if (!d || contexto.ambiente !== "PRODUCAO" || d.modelo !== 65 || d.ambiente !== "PRODUCAO" || d.versaoConfiguracao !== contexto.versaoConfiguracao || d.emitenteHash !== contexto.emitenteHash) return null;
  const responsavel = objetoDecisao65(d.responsavel, ["usuarioId", "nome"]), executor = objetoDecisao65(d.executor, ["usuarioId", "nome", "modo", "identificacao"]);
  if (!responsavel || !executor || !idDecisao65(responsavel.usuarioId) || !nomeDecisao65(responsavel.nome) || executor.usuarioId !== responsavel.usuarioId
    || executor.nome !== responsavel.nome || executor.modo !== d.modoRegistro || !hashValidoDecisao65(d.hashConteudo)) return null;
  try {
    const entrada = Object.fromEntries(camposEntradaDecisao65.map(k => [k, d[k]]));
    const selada = selarDecisaoProducao65BrasilNfe(entrada, { versaoConfiguracao: contexto.versaoConfiguracao, emitenteHash: contexto.emitenteHash,
      autor: { userId: responsavel.usuarioId, nome: responsavel.nome }, registradaEm: d.registradaEm as string, cscProducaoVerificadoEm: d.cscProducaoVerificadoEm as string });
    return d.origem === selada.origem && executor.identificacao === selada.executor.identificacao && d.hashConteudo === selada.hashConteudo ? selada : null;
  } catch { return null; }
}
export type HabilitacaoEmissaoBrasilNfe = {
  id: string; revisao: number; ambiente: AmbienteEmissaoBrasilNfe; habilitada: boolean;
  versaoConfiguracao: number; emitenteHash: string; modelos: (55 | 65)[]; criadaEm: string;
  decisaoProducao65?: DecisaoProducao65BrasilNfe;
};
export function restaurarHabilitacaoEmissaoBrasilNfe(id: string, dados: unknown, criadaEm: Date): HabilitacaoEmissaoBrasilNfe | null {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return null;
  const d = dados as Record<string, unknown>;
  if (!Number.isSafeInteger(d.revisao) || (d.revisao as number) < 1 || !Number.isSafeInteger(d.versaoConfiguracao) || (d.versaoConfiguracao as number) < 1
    || !["HOMOLOGACAO", "PRODUCAO"].includes(d.ambiente as string) || typeof d.habilitada !== "boolean"
    || typeof d.emitenteHash !== "string" || !/^[a-f0-9]{64}$/.test(d.emitenteHash) || !Array.isArray(d.modelos) || !d.modelos.length || d.modelos.length > 2
    || d.modelos.some(m => m !== 55 && m !== 65) || new Set(d.modelos).size !== d.modelos.length) return null;
  const contexto = { ambiente: d.ambiente as AmbienteEmissaoBrasilNfe, versaoConfiguracao: d.versaoConfiguracao as number, emitenteHash: d.emitenteHash };
  const decisao = Object.hasOwn(d, "decisaoProducao65") ? restaurarDecisaoProducao65BrasilNfe(d.decisaoProducao65, contexto) : undefined;
  if (decisao === null || decisao && !(d.modelos as number[]).includes(65)) return null;
  return { id, revisao: d.revisao as number, ambiente: contexto.ambiente, habilitada: d.habilitada,
    versaoConfiguracao: contexto.versaoConfiguracao, emitenteHash: contexto.emitenteHash, modelos: d.modelos as (55 | 65)[], criadaEm: criadaEm.toISOString(), ...(decisao ? { decisaoProducao65: decisao } : {}) };
}
export function habilitacaoCorrespondeBrasilNfe(h: HabilitacaoEmissaoBrasilNfe | null, c: { versao: number; emitenteHash: string }, ambiente: AmbienteEmissaoBrasilNfe, modelo: 55 | 65) {
  return !!h?.habilitada && h.ambiente === ambiente && h.versaoConfiguracao === c.versao && h.emitenteHash === c.emitenteHash && h.modelos.includes(modelo);
}
