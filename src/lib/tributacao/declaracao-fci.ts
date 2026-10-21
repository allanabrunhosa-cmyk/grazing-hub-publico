import { createHash } from "node:crypto";
import type { DeclaracaoResponsavelFci } from "./tipos";

import { PRODUTO_DECLARACAO_FCI_GRAZING1 } from "./declaracao-fci-contrato";
export { PRODUTO_DECLARACAO_FCI_GRAZING1, AVISO_DECLARACAO_FCI } from "./declaracao-fci-contrato";
export class ErroDeclaracaoFci extends Error {}
const falha = (): never => { throw new ErroDeclaracaoFci("Declaração administrativa de origem/FCI: identidade, alcance ou registro incompatível."); };
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : falha();
const texto = (v: unknown, max: number) => typeof v === "string" && v.trim() && v.length <= max && !/[\p{C}<>]/u.test(v) ? v.trim() : falha();
const id = (v: unknown) => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v) ? v : falha();
const hash = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v) ? v : falha();
const numero = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : falha();
function chaves(o: Record<string, unknown>, permitidas: string[]) { if (Object.keys(o).some(k => !permitidas.includes(k))) falha(); }
export function hashDeclaracaoFci(v: unknown): string {
  const ordenar = (x: unknown): unknown => Array.isArray(x) ? x.map(ordenar) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordenar(v)])) : x;
  return createHash("sha256").update(JSON.stringify(ordenar(v))).digest("hex");
}
function hashRegistro(d: DeclaracaoResponsavelFci) { return hashDeclaracaoFci({ ...d, registro: d.registro && { ...d.registro, hashConteudo: undefined } }); }
export function validarDeclaracaoResponsavelFci(entrada: unknown): DeclaracaoResponsavelFci {
  const d = obj(entrada); chaves(d, ["tipo", "produtoId", "estabelecimento", "emitenteCnpj", "materiaisHash", "classificacaoBase", "vigenciaInicio", "ufEmitente", "ufDestino", "modelos", "ambientes", "origem", "gtin", "reaproveitamento65", "referenciaInstrucao", "executorModo", "registro"]);
  if (d.tipo !== "ORIGEM_FCI_GTIN" || d.produtoId !== PRODUTO_DECLARACAO_FCI_GRAZING1 || d.estabelecimento !== "singleton" || d.ufEmitente !== "SP" || d.ufDestino !== "SP" || d.origem !== "5" || d.gtin !== "SEM GTIN" || d.reaproveitamento65 !== "EXIGE_HOMOLOGACAO_PROPRIA"
    || JSON.stringify(d.modelos) !== '["55"]' || JSON.stringify(d.ambientes) !== '["HOMOLOGACAO","PRODUCAO"]' || !["SESSAO_NORMAL", "AUTOMACAO_ASSISTIDA"].includes(d.executorModo as string)
    || typeof d.emitenteCnpj !== "string" || !/^\d{14}$/.test(d.emitenteCnpj) || typeof d.vigenciaInicio !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(d.vigenciaInicio) || !Number.isFinite(Date.parse(`${d.vigenciaInicio}T00:00:00Z`)) || new Date(`${d.vigenciaInicio}T00:00:00Z`).toISOString().slice(0, 10) !== d.vigenciaInicio) return falha();
  const b = obj(d.classificacaoBase); chaves(b, ["id", "hash", "versao"]);
  const r: DeclaracaoResponsavelFci = { tipo: "ORIGEM_FCI_GTIN", produtoId: d.produtoId, estabelecimento: "singleton", emitenteCnpj: d.emitenteCnpj, materiaisHash: hash(d.materiaisHash), classificacaoBase: { id: id(b.id), hash: hash(b.hash), versao: numero(b.versao) }, vigenciaInicio: d.vigenciaInicio,
    ufEmitente: "SP", ufDestino: "SP", modelos: ["55"], ambientes: ["HOMOLOGACAO", "PRODUCAO"], origem: "5", gtin: "SEM GTIN", reaproveitamento65: "EXIGE_HOMOLOGACAO_PROPRIA", referenciaInstrucao: texto(d.referenciaInstrucao, 2000), executorModo: d.executorModo as DeclaracaoResponsavelFci["executorModo"] };
  if (d.registro !== undefined) {
    const a = obj(d.registro), p = obj(a.responsavel), e = obj(a.executor);
    chaves(a, ["versaoId", "versao", "registradoEm", "responsavel", "executor", "hashConteudo"]); chaves(p, ["usuarioId", "nome"]); chaves(e, ["usuarioId", "nome", "modo", "identificacao"]);
    if (typeof a.registradoEm !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(a.registradoEm) || !Number.isFinite(Date.parse(a.registradoEm)) || e.modo !== r.executorModo || e.identificacao !== (e.modo === "AUTOMACAO_ASSISTIDA" ? "Codex" : "Sessão normal")) return falha();
    r.registro = { versaoId: id(a.versaoId), versao: numero(a.versao), registradoEm: a.registradoEm, responsavel: { usuarioId: id(p.usuarioId), nome: texto(p.nome, 200) }, executor: { usuarioId: id(e.usuarioId), nome: texto(e.nome, 200), modo: r.executorModo, identificacao: r.executorModo === "AUTOMACAO_ASSISTIDA" ? "Codex" : "Sessão normal" }, hashConteudo: hash(a.hashConteudo) };
    if (r.registro.hashConteudo !== hashRegistro(r)) return falha();
  }
  return r;
}
export function selarDeclaracaoResponsavelFci(entrada: DeclaracaoResponsavelFci, versao: { id: string; numero: number }, autor: { userId: string; nome: string }, registradoEm: string): DeclaracaoResponsavelFci {
  const d = validarDeclaracaoResponsavelFci(entrada), dados = { ...d }; delete dados.registro;
  const selada: DeclaracaoResponsavelFci = { ...dados, registro: { versaoId: versao.id, versao: versao.numero, registradoEm, responsavel: d.registro?.responsavel ?? { usuarioId: autor.userId, nome: autor.nome }, executor: { usuarioId: autor.userId, nome: autor.nome, modo: d.executorModo, identificacao: d.executorModo === "AUTOMACAO_ASSISTIDA" ? "Codex" : "Sessão normal" }, hashConteudo: "" } };
  selada.registro!.hashConteudo = hashRegistro(selada); return validarDeclaracaoResponsavelFci(selada);
}
export type ContextoDeclaracaoFci = { produtoId?: string; estabelecimento?: string; emitenteCnpj?: string; materiaisHash?: string; classificacaoVersaoId?: string; classificacaoVersaoNumero?: number; gtin?: string | null; ambiente?: "HOMOLOGACAO" | "PRODUCAO" };
export function declaracaoResponsavelFciAbrange(d: DeclaracaoResponsavelFci, contexto: ContextoDeclaracaoFci & { data: string; ufEmitente: string; ufDestino: string; modelo: "55" | "65" }): boolean {
  return !!d.registro && d.gtin === contexto.gtin && d.produtoId === contexto.produtoId && d.estabelecimento === contexto.estabelecimento && d.emitenteCnpj === contexto.emitenteCnpj && d.materiaisHash === contexto.materiaisHash && d.registro.versaoId === contexto.classificacaoVersaoId && d.registro.versao === contexto.classificacaoVersaoNumero
    && contexto.data >= d.vigenciaInicio && d.ufEmitente === contexto.ufEmitente && d.ufDestino === contexto.ufDestino && contexto.modelo === "55" && !!contexto.ambiente && d.ambientes.includes(contexto.ambiente);
}
