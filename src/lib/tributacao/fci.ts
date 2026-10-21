import { Prisma } from "@/generated/prisma/client";
import type { DecisaoFciFiscal, NaturezaFiscal } from "./tipos";
import { dataRepasseFciValida, validarRepasseFciFornecedor } from "./fci-fornecedor-contrato";
import { declaracaoResponsavelFciAbrange, validarDeclaracaoResponsavelFci, type ContextoDeclaracaoFci } from "./declaracao-fci";

export const NUMERO_FCI_FISCAL = /^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/;
const origensCI = new Set(["3", "5", "8"]);
const ufs = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
export class ErroFciFiscal extends Error {}
const falha = (campo: string): never => { throw new ErroFciFiscal(`FCI: ${campo} inválido ou ausente.`); };
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : falha("estrutura");
function texto(v: unknown, campo: string, max = 2000) { return typeof v === "string" && v.trim() && v.length <= max && !/[\p{C}<>]/u.test(v) ? v.trim() : falha(campo); }
function textos(v: unknown, campo: string) { return Array.isArray(v) && v.length <= 50 ? v.map(s => texto(s, campo)) : falha(campo); }
function decimal(v: unknown, campo: string, casas: number, positivo = false): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !new RegExp(`^(?:0|[1-9]\\d{0,11})(?:\\.\\d{1,${casas}})?$`).test(v) || positivo && !new Prisma.Decimal(v).gt(0)) return falha(campo);
  return v;
}
/** Não calcula CI de custos comerciais nem gera/transmite uma FCI. */
export function validarDecisaoFciFiscal(entrada: unknown): DecisaoFciFiscal {
  const d = objeto(entrada), permitidos = ["situacao", "numero", "periodoApuracao", "conteudoImportacao", "valorParcelaImportada", "valorSaidaReferencia", "apuracaoCompleta", "justificativa", "fontes", "evidencias", "dispensa", "declaracaoResponsavel", "repasseFornecedor"];
  if (Object.keys(d).some(k => !permitidos.includes(k)) || !["EXIGIDA", "DISPENSADA_COM_FUNDAMENTO", "DISPENSADA_POR_DECLARACAO_RESPONSAVEL", "PENDENTE"].includes(d.situacao as string) || typeof d.apuracaoCompleta !== "boolean") return falha("decisão");
  const administrativa = d.situacao === "DISPENSADA_POR_DECLARACAO_RESPONSAVEL";
  const numero = d.numero == null || d.numero === "" ? null : texto(d.numero, "número", 36);
  if (numero !== null && (!NUMERO_FCI_FISCAL.test(numero) || numero === "00000000-0000-0000-0000-000000000000")) return falha("número de controle");
  const periodo = d.periodoApuracao == null || d.periodoApuracao === "" ? null : texto(d.periodoApuracao, "período de apuração", 7);
  if (periodo !== null && !/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(periodo)) return falha("período de apuração");
  const ci = decimal(d.conteudoImportacao, "conteúdo de importação", 4);
  if (ci !== null && new Prisma.Decimal(ci).gt(100)) return falha("conteúdo de importação");
  const r: DecisaoFciFiscal = { situacao: d.situacao as DecisaoFciFiscal["situacao"], numero, periodoApuracao: periodo, conteudoImportacao: ci, valorParcelaImportada: decimal(d.valorParcelaImportada, "valor da parcela importada", 8), valorSaidaReferencia: decimal(d.valorSaidaReferencia, "valor de saída normativo", 8, true), apuracaoCompleta: d.apuracaoCompleta, justificativa: texto(d.justificativa, "fundamentação"), fontes: textos(d.fontes, "fontes"), evidencias: textos(d.evidencias, "evidências") };
  if (r.situacao !== "PENDENTE" && !administrativa && !r.fontes.length) return falha("fontes da decisão");
  if ((!administrativa && r.situacao !== "PENDENTE" || r.apuracaoCompleta) && !r.fontes.some(f => {
    try { const u = new URL(f); return u.protocol === "https:" && !u.username && !u.password && (u.hostname === "gov.br" || u.hostname.endsWith(".gov.br")); } catch { return false; }
  })) return falha("fonte oficial verificável da decisão ou apuração");
  if (numero !== null && (r.situacao !== "EXIGIDA" || !r.evidencias.length)) return falha("prova do número de controle");
  if (r.apuracaoCompleta && (!periodo || ci === null || r.valorParcelaImportada === null || r.valorSaidaReferencia === null || !r.evidencias.length || !r.fontes.length)) return falha("apuração completa documentada");
  if (r.apuracaoCompleta) {
    const D = Prisma.Decimal.clone({ precision: 80 }), calculado = new D(r.valorParcelaImportada!).div(r.valorSaidaReferencia!).mul(100).toDecimalPlaces(4, D.ROUND_HALF_UP);
    if (!calculado.equals(ci!)) return falha("coerência do CI com os valores normativos comprovados");
  }
  if (d.dispensa !== undefined) {
    const a = objeto(d.dispensa);
    if (Object.keys(a).some(k => !["ufEmitente", "ufDestino", "modelos"].includes(k)) || ![a.ufEmitente, a.ufDestino].every(v => typeof v === "string" && ufs.has(v)) || !Array.isArray(a.modelos) || !a.modelos.length || a.modelos.length > 2 || a.modelos.some(m => m !== "55" && m !== "65") || new Set(a.modelos).size !== a.modelos.length) return falha("alcance da dispensa");
    r.dispensa = { ufEmitente: a.ufEmitente as string, ufDestino: a.ufDestino as string, modelos: a.modelos as ("55" | "65")[] };
  }
  if (r.situacao === "DISPENSADA_COM_FUNDAMENTO" && (!r.dispensa || !r.evidencias.length)) return falha("dispensa delimitada e comprovada");
  if (r.situacao !== "DISPENSADA_COM_FUNDAMENTO" && r.dispensa) return falha("alcance exclusivo de dispensa");
  if (administrativa) {
    if (numero !== null || r.apuracaoCompleta || d.dispensa !== undefined) return falha("declaração administrativa sem número nem apuração comprovada");
    try { r.declaracaoResponsavel = validarDeclaracaoResponsavelFci(d.declaracaoResponsavel); } catch { return falha("declaração expressa do responsável"); }
  } else if (d.declaracaoResponsavel !== undefined) return falha("declaração exclusiva da decisão administrativa");
  if (d.repasseFornecedor !== undefined) {
    if (r.situacao !== "EXIGIDA" || !numero || r.apuracaoCompleta || periodo || ci !== null || r.valorParcelaImportada !== null || r.valorSaidaReferencia !== null || d.dispensa !== undefined || d.declaracaoResponsavel !== undefined) return falha("repasse do fornecedor separado de apuração própria e dispensa");
    try { r.repasseFornecedor = validarRepasseFciFornecedor(d.repasseFornecedor); } catch { return falha("prova de entrada do fornecedor"); }
  }
  return r;
}
/** Origem é decisão material aprovada; não é deduzida de um único insumo ou custo. */
export function conferirFciFiscal(origem: string, decisao: unknown, contexto: ContextoDeclaracaoFci & { data: string; ufEmitente: string; ufDestino: string; modelo: "55" | "65"; natureza?: NaturezaFiscal; ncm?: string }): { numero: string | null; pendencias: string[] } {
  const pendencias: string[] = [], add = (s: string) => pendencias.push(s);
  if (decisao === undefined) return { numero: null, pendencias: origensCI.has(origem) ? ["Conteúdo de importação e FCI: registrar a apuração normativa e a decisão versionada para origem 3, 5 ou 8."] : [] };
  let d: DecisaoFciFiscal;
  try { d = validarDecisaoFciFiscal(decisao); } catch { return { numero: null, pendencias: ["Conteúdo de importação e FCI: corrigir formato, evidências e valores da decisão fiscal."] }; }
  if (d.repasseFornecedor) {
    const p = d.repasseFornecedor.registro;
    const apto = p && p.natureza === contexto.natureza && p.ncm === contexto.ncm && p.origem === origem && p.materiaisHash === contexto.materiaisHash && dataRepasseFciValida(contexto.data) && p.documentos.every(n => n.dataEmissao <= contexto.data) && typeof contexto.classificacaoVersaoId === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(contexto.classificacaoVersaoId) && Number.isInteger(contexto.classificacaoVersaoNumero) && Number(contexto.classificacaoVersaoNumero) > 0;
    return { numero: apto ? d.numero : null, pendencias: apto ? [] : ["FCI do fornecedor: conferir a prova de entrada, a natureza sem industrialização, o NCM, a origem, os materiais e a versão ativa."] };
  }
  if (d.situacao === "DISPENSADA_POR_DECLARACAO_RESPONSAVEL") return { numero: null, pendencias: origem === "5" && d.declaracaoResponsavel && declaracaoResponsavelFciAbrange(d.declaracaoResponsavel, contexto) ? [] : ["FCI por declaração do responsável: conferir o registro administrativo e o alcance exato do produto, versão, materiais, emitente, UF e modelo. Não há apuração de CI confirmada."] };
  if (d.situacao === "PENDENTE") add("FCI: concluir a decisão de exigência ou dispensa fundamentada, com aprovação interna.");
  if (origensCI.has(origem) || d.conteudoImportacao !== null || d.situacao === "EXIGIDA") {
    if (!d.apuracaoCompleta) add("Conteúdo de importação: conferir período, valor completo da parcela importada e valor de saída normativo. Custo parcial ou preço do pedido não substituem a apuração.");
    else {
      const D = Prisma.Decimal.clone({ precision: 80 }), ci = new D(d.conteudoImportacao!), exato = new D(d.valorParcelaImportada!).div(d.valorSaidaReferencia!).mul(100);
      const faixa = (p: Prisma.Decimal) => p.isZero() ? "0" : p.lte(40) ? "5" : p.lte(70) ? "3" : "8";
      if (faixa(ci) !== faixa(exato)) add("Conteúdo de importação: a precisão declarada altera a faixa de origem em 40% ou 70%. Conferir a apuração normativa; não arredondar a classificação.");
      const coerente = origem === "3" ? exato.gt(40) && exato.lte(70) : origem === "5" ? exato.gt(0) && exato.lte(40) : origem === "8" ? exato.gt(70) : origem === "0" ? exato.isZero() : true;
      if (!coerente) add("Origem da mercadoria e faixa de conteúdo de importação são incompatíveis. Revisar a origem aprovada; não corrigir automaticamente.");
      if (d.periodoApuracao! > contexto.data.slice(0, 7)) add("FCI: período de apuração posterior à operação; conferir a vigência aplicável.");
    }
  }
  if (d.situacao === "EXIGIDA" && !d.numero) add("FCI: informar o número de controle recebido no canal oficial e a evidência correspondente. Não gerar um UUID no HUB.");
  if (d.situacao === "DISPENSADA_COM_FUNDAMENTO" && (!d.dispensa || d.dispensa.ufEmitente !== contexto.ufEmitente || d.dispensa.ufDestino !== contexto.ufDestino || !d.dispensa.modelos.includes(contexto.modelo))) add("FCI: a dispensa aprovada não abrange a UF ou o modelo desta operação.");
  return { numero: pendencias.length || d.situacao !== "EXIGIDA" ? null : d.numero, pendencias };
}
