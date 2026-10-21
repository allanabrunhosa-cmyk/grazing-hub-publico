import { ErroRegraFiscalBrasilNfe, dataCivilRegraBrasilNfe, hojeCivilRegraBrasilNfe } from "./regras-tributarias-dominio";
import type { AlvoRegraFiscalBrasilNfe, ConteudoRegraFiscalBrasilNfe } from "./regras-tributarias-dominio";

export const TIPOS_FONTE_FISCAL = ["NORMA_OFICIAL", "ORIENTACAO_SEFAZ", "SOLUCAO_RECEITA", "NCM_CLASSIF", "XML_HISTORICO", "PARECER_ESPECIALIZADO", "SUGESTAO_IA", "EXEMPLO_API", "COMPROVANTE_CADASTRAL", "DECLARACAO_RESPONSAVEL"] as const;
export const CAMPOS_CONFIANCA_FISCAL = ["EMITENTE", "OPERACAO", "NCM", "CFOP", "CEST", "ICMS", "PIS", "COFINS", "IPI", "FCP", "DIFAL", "IBS_CBS", "BENEFICIO", "ORIGEM", "UNIDADE", "ST"] as const;
export const ESTADOS_CONFIANCA_FISCAL = ["COMPROVADO", "PENDENTE", "REVISAO_ESPECIALIZADA", "NAO_APLICAVEL"] as const;
export const REGIMES_FUNDAMENTACAO_FISCAL = ["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "PENDENTE"] as const;
export const ORIGENS_FUNDAMENTACAO_FISCAL = ["PREPARADO", "REVENDA", "KIT", "ESPECIAL", "NAO_APLICAVEL", "PENDENTE"] as const;
export type CampoConfiancaFiscal = typeof CAMPOS_CONFIANCA_FISCAL[number];
export type FonteFiscal = {
  id: string; tipo: typeof TIPOS_FONTE_FISCAL[number]; titulo: string; referencia: string;
  uri: string | null; consultadoEm: string; trechoAplicavel: string; limitesAplicabilidade: string;
};
export type ConfiancaCampoFiscal = { campo: CampoConfiancaFiscal; estado: typeof ESTADOS_CONFIANCA_FISCAL[number]; fontes: string[]; justificativa: string };
export type FundamentacaoFiscalBrasilNfe = {
  versao: 1;
  contexto: { uf: string; regime: typeof REGIMES_FUNDAMENTACAO_FISCAL[number]; regimeConfirmado: boolean; operacao: "NF_E_VENDA" | "NFC_E_VENDA"; origem: typeof ORIGENS_FUNDAMENTACAO_FISCAL[number]; naturezaProduto: string };
  fontes: FonteFiscal[]; justificativa: string; limitesAplicabilidade: string; elaboradoEm: string; confianca: ConfiancaCampoFiscal[];
};
export type AprovacaoInternaFiscalBrasilNfe = {
  tipo: "APROVACAO_INTERNA"; regraId: string; revisaoOrigem: number; modelo: 55 | 65;
  operacao: "NF_E_VENDA" | "NFC_E_VENDA"; alvo: AlvoRegraFiscalBrasilNfe;
  conteudoHash: string; fundamentacaoHash: string; emitenteHash: string;
  fiscalCadastroHash: string | null; versaoCadastro: number | null;
  vigenteDesde: string; vigenteAte: string | null;
  aprovador: { id: string; nome: string }; aprovadoEm: string;
};
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const IDENTIFICADORES_PESSOAIS = /\b\d{11}(?:\d{3})?\b|\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
function falhar(campo: string, mensagem = "Fundamentação fiscal inválida."): never { throw new ErroRegraFiscalBrasilNfe(`fundamentacaoFiscal.${campo}`, mensagem); }
function objeto(v: unknown, campos: readonly string[], campo: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v) || ![Object.prototype, null].includes(Object.getPrototypeOf(v))) return falhar(campo);
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some(k => !campos.includes(k))) return falhar(campo);
  return o;
}
/** Textos administrativos são dados. Não aceitam HTML, instrução executável, identificadores pessoais ou segredos. */
function texto(v: unknown, max: number, campo: string): string {
  if (typeof v !== "string" || v.length > max) return falhar(campo);
  const canonico = v.replace(/\r\n/g, "\n");
  if (/[<>\u0000-\u0009\u000b-\u001f\u007f]|https?:\/\/|(?:token|usertoken|password|senha|certificado|cookie|bearer|csc)\s*[:=]|[A-Za-z0-9+/_=-]{40,}/i.test(canonico) || IDENTIFICADORES_PESSOAIS.test(canonico)) return falhar(campo);
  return canonico.trim();
}
function escolha<T extends string>(v: unknown, itens: readonly T[], campo: string): T { return itens.includes(v as T) ? v as T : falhar(campo); }
function identificador(v: unknown, campo: string) { return typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : falhar(campo); }
export function uriFonteFiscalBrasilNfe(v: unknown, campo = "fonte.uri"): string | null {
  if (v === null) return null;
  if (typeof v !== "string" || v.length > 500 || /[\u0000-\u0020\u007f<>\\]|%0[ad]|%1[0-9a-f]|%7f/i.test(v)) return falhar(campo);
  let u: URL; try { u = new URL(v); } catch { return falhar(campo); }
  let caminho: string; try { caminho = decodeURIComponent(`${u.pathname}${u.hash}`); } catch { return falhar(campo); }
  // Não há busca remota. A URI é apenas evidência textual; credenciais, parâmetros e hosts locais são proibidos.
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.port || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname) || /^(?:localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(u.hostname) || /[<>\u0000-\u001f\u007f]|%(?:0[0-9a-f]|1[0-9a-f]|3[cd]|7f)/i.test(caminho) || /(?:token|usertoken|password|senha|cookie|bearer|csc)(?:[=:/]|%3[daf])/i.test(caminho) || /[A-Za-z0-9+_=]{40,}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i.test(caminho) || IDENTIFICADORES_PESSOAIS.test(caminho)) return falhar(campo);
  return u.href;
}
export function validarFundamentacaoFiscalBrasilNfe(v: unknown): FundamentacaoFiscalBrasilNfe {
  const o = objeto(v, ["versao", "contexto", "fontes", "justificativa", "limitesAplicabilidade", "elaboradoEm", "confianca"], "estrutura");
  if (o.versao !== 1) falhar("versao");
  const c = objeto(o.contexto, ["uf", "regime", "regimeConfirmado", "operacao", "origem", "naturezaProduto"], "contexto");
  if (typeof c.uf !== "string" || (c.uf !== "" && !UFS.includes(c.uf)) || typeof c.regimeConfirmado !== "boolean") falhar("contexto");
  if (!Array.isArray(o.fontes) || o.fontes.length > 10 || !Array.isArray(o.confianca) || o.confianca.length > CAMPOS_CONFIANCA_FISCAL.length) falhar("listas");
  const fontes = (o.fontes as unknown[]).map((v, i) => {
    const p = `fontes[${i}]`, f = objeto(v, ["id", "tipo", "titulo", "referencia", "uri", "consultadoEm", "trechoAplicavel", "limitesAplicabilidade"], p);
    return { id: identificador(f.id, `${p}.id`), tipo: escolha(f.tipo, TIPOS_FONTE_FISCAL, `${p}.tipo`), titulo: texto(f.titulo, 200, `${p}.titulo`), referencia: texto(f.referencia, 300, `${p}.referencia`), uri: uriFonteFiscalBrasilNfe(f.uri, `${p}.uri`), consultadoEm: dataCivilRegraBrasilNfe(f.consultadoEm, `fundamentacaoFiscal.${p}.consultadoEm`), trechoAplicavel: texto(f.trechoAplicavel, 2000, `${p}.trechoAplicavel`), limitesAplicabilidade: texto(f.limitesAplicabilidade, 1000, `${p}.limitesAplicabilidade`) };
  });
  if (new Set(fontes.map(f => f.id)).size !== fontes.length) falhar("fontes.id");
  const confianca = (o.confianca as unknown[]).map((v, i) => {
    const p = `confianca[${i}]`, c = objeto(v, ["campo", "estado", "fontes", "justificativa"], p);
    if (!Array.isArray(c.fontes) || c.fontes.length > 10) falhar(`${p}.fontes`);
    const ids = (c.fontes as unknown[]).map(v => identificador(v, `${p}.fontes`));
    if (new Set(ids).size !== ids.length || ids.some(id => !fontes.some(f => f.id === id))) falhar(`${p}.fontes`);
    return { campo: escolha(c.campo, CAMPOS_CONFIANCA_FISCAL, `${p}.campo`), estado: escolha(c.estado, ESTADOS_CONFIANCA_FISCAL, `${p}.estado`), fontes: ids, justificativa: texto(c.justificativa, 1000, `${p}.justificativa`) };
  });
  if (new Set(confianca.map(c => c.campo)).size !== confianca.length) falhar("confianca.campo");
  return { versao: 1, contexto: { uf: c.uf, regime: escolha(c.regime, REGIMES_FUNDAMENTACAO_FISCAL, "contexto.regime"), regimeConfirmado: c.regimeConfirmado, operacao: escolha(c.operacao, ["NF_E_VENDA", "NFC_E_VENDA"] as const, "contexto.operacao"), origem: escolha(c.origem, ORIGENS_FUNDAMENTACAO_FISCAL, "contexto.origem"), naturezaProduto: texto(c.naturezaProduto, 500, "contexto.naturezaProduto") }, fontes, justificativa: texto(o.justificativa, 2000, "justificativa"), limitesAplicabilidade: texto(o.limitesAplicabilidade, 2000, "limitesAplicabilidade"), elaboradoEm: dataCivilRegraBrasilNfe(o.elaboradoEm, "fundamentacaoFiscal.elaboradoEm"), confianca };
}
export function camposExigidosFundamentacaoBrasilNfe(conteudo: ConteudoRegraFiscalBrasilNfe): CampoConfiancaFiscal[] {
  if (conteudo.tipo === "EMPRESA") return ["EMITENTE"];
  if (conteudo.tipo === "OPERACAO") return ["OPERACAO"];
  return ["NCM", "CFOP", "CEST", "ICMS", "PIS", "COFINS", "IPI", "FCP", "DIFAL", "IBS_CBS", "BENEFICIO", "ORIGEM", "UNIDADE", "ST"];
}
const fontesInsuficientes = new Set(["XML_HISTORICO", "SUGESTAO_IA", "EXEMPLO_API"]);
const concreta = (f: FonteFiscal, hoje: string) => !fontesInsuficientes.has(f.tipo) && f.titulo.length >= 5 && f.referencia.length >= 8 && f.trechoAplicavel.length >= 20 && f.limitesAplicabilidade.length >= 20 && f.consultadoEm <= hoje;
/** Verificação estrutural do fundamento e da revisão humana. Não declara que uma lei foi consultada automaticamente. */
export function conferirFundamentacaoAprovavelBrasilNfe(f: FundamentacaoFiscalBrasilNfe, conteudo: ConteudoRegraFiscalBrasilNfe, operacao: "NF_E_VENDA" | "NFC_E_VENDA", hoje = hojeCivilRegraBrasilNfe()) {
  f = validarFundamentacaoFiscalBrasilNfe(f);
  if (!f.contexto.uf || f.contexto.regime === "PENDENTE" || !f.contexto.regimeConfirmado || f.contexto.origem === "PENDENTE" || f.contexto.operacao !== operacao || f.contexto.naturezaProduto.length < 20 || f.justificativa.length < 20 || f.limitesAplicabilidade.length < 20 || f.elaboradoEm > hoje) falhar("contexto", "Complete o alcance, regime vigente confirmado, justificativa e limites da fundamentação antes de aprovar.");
  if (conteudo.tipo === "EMPRESA" && (([1, 2, 4].includes(conteudo.emitente.crt) && f.contexto.regime !== "SIMPLES_NACIONAL") || (conteudo.emitente.crt === 3 && !["LUCRO_PRESUMIDO", "LUCRO_REAL"].includes(f.contexto.regime)))) falhar("contexto.regime", "O regime documentado deve corresponder ao CRT configurado; intenção de mudança não confirma regime vigente.");
  if (conteudo.tipo === "ITEM" && f.contexto.origem === "NAO_APLICAVEL") falhar("contexto.origem", "A origem preparada, revendida ou especial precisa ser examinada para o produto; não é dispensada pelo nome comercial.");
  for (const campo of camposExigidosFundamentacaoBrasilNfe(conteudo)) {
    const c = f.confianca.find(c => c.campo === campo);
    if (!c || !["COMPROVADO", "NAO_APLICAVEL"].includes(c.estado)) falhar(`confianca.${campo}`, `O campo ${campo} precisa de fundamentação comprovada ou não aplicabilidade justificada; a pendência bloqueia somente esta decisão.`);
    const obrigatorio = ["EMITENTE", "OPERACAO", "NCM", "CFOP", "ICMS", "PIS", "COFINS", "ORIGEM", "UNIDADE"].includes(campo);
    const aplicavel = conteudo.tipo === "ITEM" && ({ CEST: conteudo.perfil.cestAplicavel, IPI: conteudo.perfil.ipiAplicavel, FCP: conteudo.perfil.fcpAplicavel, DIFAL: conteudo.perfil.difalAplicavel, IBS_CBS: conteudo.perfil.ibsCbsAplicavel, BENEFICIO: conteudo.perfil.beneficioFiscalAplicavel, ST: conteudo.perfil.stAplicavel } as Partial<Record<CampoConfiancaFiscal, boolean | null>>)[campo];
    if (campo === "IPI" && conteudo.tipo === "ITEM" && conteudo.perfil.representacaoIpi && c.estado !== "COMPROVADO") falhar("confianca.IPI", "A representação documental do IPI precisa de fundamento comprovado, mesmo quando o enquadramento federal não estiver decidido.");
    if ((obrigatorio || aplicavel) && c.estado !== "COMPROVADO") falhar(`confianca.${campo}`, `O campo aplicável ${campo} deve estar comprovado para esta decisão.`);
    if (c.justificativa.length < 20 || !c.fontes.some(id => f.fontes.find(fonte => fonte.id === id && concreta(fonte, hoje)))) falhar(`confianca.${campo}`, `Vincule fonte concreta e justificativa ao campo ${campo}; XML histórico, IA, exemplo ou endereço isolado não fundamentam aprovação.`);
    if (!["EMITENTE", "UNIDADE", "ORIGEM"].includes(campo) && !c.fontes.some(id => f.fontes.find(fonte => fonte.id === id && concreta(fonte, hoje) && !["COMPROVANTE_CADASTRAL", "DECLARACAO_RESPONSAVEL"].includes(fonte.tipo)))) falhar(`confianca.${campo}`, "Uma declaração cadastral não substitui a fundamentação tributária oficial ou especializada.");
  }
  return f;
}
