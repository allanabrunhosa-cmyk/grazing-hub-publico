import { createHash } from "node:crypto";
import { cnpjNumericoValido, dominioEmailPessoal } from "./clientes-identidade";
import { hashCanonico, ORIGEM_HISTORICA } from "./historico-dominio";

export type ProvaEmpresaHistorica = {
  url: string; consultadoEm: string; arquivo: string; arquivoSha256: string;
  papel: "REGISTRO_CNPJ" | "RDAP_OFICIAL" | "SITE_OFICIAL" | "VINCULO_DOMINIO";
  cnpjObservado: string | null; nomeEmpresarialObservado: string | null; dominioObservado: string | null;
};
export type EmpresaCorrecaoHistorica = {
  companyRef: string; decisao: "PJ_CNPJ_COMPROVADO" | "PJ_CNPJ_PENDENTE";
  cnpj: string | null; cnpjCandidato?: string | null; razaoSocial: string | null; nomeFantasia: string | null;
  dominiosCorporativos: string[]; provas: ProvaEmpresaHistorica[]; motivoPendente: string | null;
};
export type VinculoEmpresaHistorica = {
  chaveClienteHistorico: string; companyRef: string; numerosOriginais: string[];
  regra?: "COMPANY_EXATA" | "DOMINIO_TITULAR_UNICO";
};
export type ManifestoEmpresasHistoricas = {
  versao: 1; loteHistoricoId: string; inventarioSha256: string;
  empresas: EmpresaCorrecaoHistorica[]; vinculos: VinculoEmpresaHistorica[];
};
type Objeto = Record<string, unknown>;
const falha = (codigo: string): never => { throw Error(codigo); };
function objeto(v: unknown, chaves: string[], obrigatorias = chaves): Objeto {
  if (!v || typeof v !== "object" || Array.isArray(v)) return falha("CORRECAO_OBJETO_INVALIDO");
  const r = v as Objeto;
  if (Object.keys(r).some(k => !chaves.includes(k)) || obrigatorias.some(k => !Object.hasOwn(r, k))) return falha("CORRECAO_CAMPOS_INVALIDOS");
  return r;
}
function texto(v: unknown, maximo = 160): string {
  if (typeof v !== "string" || !v || v !== v.trim() || v.length > maximo || /[\u0000-\u001f\u007f]/.test(v)) return falha("CORRECAO_TEXTO_INVALIDO");
  return v;
}
const opcional = (v: unknown, maximo = 160) => v === null ? null : texto(v, maximo);
function lista(v: unknown, limite = 5000): unknown[] {
  if (!Array.isArray(v) || v.length > limite) return falha("CORRECAO_LISTA_INVALIDA");
  return v;
}
function sha(v: unknown): string { const s = texto(v, 64); return /^[a-f0-9]{64}$/.test(s) ? s : falha("CORRECAO_HASH_INVALIDO"); }
function dominio(v: unknown): string {
  const s = texto(v, 253);
  if (s !== s.toLowerCase() || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s)) return falha("CORRECAO_DOMINIO_INVALIDO");
  if (dominioEmailPessoal(s)) return falha("CORRECAO_DOMINIO_PESSOAL");
  return s;
}
/** NFKD, diacríticos e casefold preservam a chave da projeção privada original. */
export function normalizarEmpresaHistorica(v: string): string {
  return v.normalize("NFKD").replace(/\p{M}/gu, "").replace(/\s+/gu, " ").trim().toLowerCase().replace(/ß/g, "ss").replace(/ς/g, "σ");
}
export function referenciaEmpresaHistorica(v: string): string { return createHash("sha256").update(normalizarEmpresaHistorica(v), "utf8").digest("hex"); }
/** Só equivalência tipográfica. Não concatena palavras, remove sufixos ou troca titulares. */
export function nomesEmpresariaisEquivalentes(a: string, b: string): boolean {
  const chave = (s: string) => normalizarEmpresaHistorica(s).replace(/\bs\s*[./]\s*a\.?\b/g, "sa")
    .replace(/\./g, "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  return !!chave(a) && chave(a) === chave(b);
}
function prova(v: unknown): ProvaEmpresaHistorica {
  const r = objeto(v, ["url", "consultadoEm", "arquivo", "arquivoSha256", "papel", "cnpjObservado", "nomeEmpresarialObservado", "dominioObservado"]);
  const url = texto(r.url, 2000), u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password || u.hash) return falha("CORRECAO_URL_INVALIDA");
  const consultadoEm = texto(r.consultadoEm, 30);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(consultadoEm) || !Number.isFinite(Date.parse(consultadoEm))) return falha("CORRECAO_DATA_PROVA_INVALIDA");
  const arquivo = texto(r.arquivo, 180);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(arquivo) || arquivo.includes("..")) return falha("CORRECAO_ARQUIVO_PROVA_INVALIDO");
  if (!["REGISTRO_CNPJ", "RDAP_OFICIAL", "SITE_OFICIAL", "VINCULO_DOMINIO"].includes(String(r.papel))) return falha("CORRECAO_PAPEL_PROVA_INVALIDO");
  const cnpjObservado = opcional(r.cnpjObservado, 30);
  if (cnpjObservado && (!/^\d{14}$/.test(cnpjObservado) || !cnpjNumericoValido(cnpjObservado))) return falha("CORRECAO_CNPJ_PROVA_INVALIDO");
  return { url, consultadoEm, arquivo, arquivoSha256: sha(r.arquivoSha256), papel: r.papel as ProvaEmpresaHistorica["papel"], cnpjObservado,
    nomeEmpresarialObservado: opcional(r.nomeEmpresarialObservado), dominioObservado: r.dominioObservado === null ? null : dominio(r.dominioObservado) };
}
export function validarManifestoEmpresasHistoricas(v: unknown): ManifestoEmpresasHistoricas {
  const r = objeto(v, ["versao", "loteHistoricoId", "inventarioSha256", "empresas", "vinculos"]);
  if (r.versao !== 1) return falha("CORRECAO_VERSAO_INVALIDA");
  const loteHistoricoId = texto(r.loteHistoricoId);
  if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(loteHistoricoId)) return falha("CORRECAO_LOTE_INVALIDO");
  const empresas = lista(r.empresas).map(v => {
    const chaves = ["companyRef", "decisao", "cnpj", "cnpjCandidato", "razaoSocial", "nomeFantasia", "dominiosCorporativos", "provas", "motivoPendente"];
    const e = objeto(v, chaves, chaves.filter(k => k !== "cnpjCandidato"));
    const companyRef = sha(e.companyRef), cnpj = opcional(e.cnpj, 30), razaoSocial = opcional(e.razaoSocial), nomeFantasia = opcional(e.nomeFantasia);
    const cnpjCandidato = e.cnpjCandidato == null ? null : texto(e.cnpjCandidato, 30);
    const provas = lista(e.provas, 30).map(prova), dominiosCorporativos = lista(e.dominiosCorporativos, 100).map(dominio);
    if (new Set(dominiosCorporativos).size !== dominiosCorporativos.length) return falha("CORRECAO_DOMINIO_REPETIDO");
    const motivoPendente = opcional(e.motivoPendente, 100);
    if (motivoPendente && !/^[A-Z][A-Z0-9_]*$/.test(motivoPendente)) return falha("CORRECAO_MOTIVO_INVALIDO");
    if (e.decisao === "PJ_CNPJ_COMPROVADO") {
      if (!cnpj || !/^\d{14}$/.test(cnpj) || !cnpjNumericoValido(cnpj) || !razaoSocial || motivoPendente || cnpjCandidato
        || !provas.some(p => ["REGISTRO_CNPJ", "RDAP_OFICIAL"].includes(p.papel) && p.cnpjObservado === cnpj && p.nomeEmpresarialObservado && normalizarEmpresaHistorica(p.nomeEmpresarialObservado) === normalizarEmpresaHistorica(razaoSocial))) return falha("CORRECAO_CNPJ_SEM_PROVA");
    } else if (e.decisao === "PJ_CNPJ_PENDENTE") {
      if (cnpj || razaoSocial || nomeFantasia || !motivoPendente || cnpjCandidato && /[a-z]/i.test(cnpjCandidato) && motivoPendente !== "CNPJ_ALFANUMERICO_NAO_SUPORTADO") return falha("CORRECAO_PENDENCIA_INVALIDA");
    } else return falha("CORRECAO_DECISAO_INVALIDA");
    if (dominiosCorporativos.some(d => !provas.some(p => p.dominioObservado === d))) return falha("CORRECAO_DOMINIO_SEM_PROVA");
    return { companyRef, decisao: e.decisao, cnpj, ...(cnpjCandidato ? { cnpjCandidato } : {}), razaoSocial, nomeFantasia, dominiosCorporativos, provas, motivoPendente } as EmpresaCorrecaoHistorica;
  });
  if (new Set(empresas.map(e => e.companyRef)).size !== empresas.length) return falha("CORRECAO_EMPRESA_REPETIDA");
  for (const e of empresas.filter(e => e.cnpj)) if (empresas.some(outra => outra.cnpj === e.cnpj && normalizarEmpresaHistorica(outra.razaoSocial ?? "") !== normalizarEmpresaHistorica(e.razaoSocial!))) return falha("CORRECAO_RAZAO_DIVERGENTE_MESMO_CNPJ");
  const vinculos = lista(r.vinculos, 10000).map((v): VinculoEmpresaHistorica => {
    const e = objeto(v, ["chaveClienteHistorico", "companyRef", "numerosOriginais", "regra"], ["chaveClienteHistorico", "companyRef", "numerosOriginais"]);
    const chaveClienteHistorico = texto(e.chaveClienteHistorico), companyRef = sha(e.companyRef);
    if (!chaveClienteHistorico.startsWith(`${ORIGEM_HISTORICA}:cliente:`) || !empresas.some(p => p.companyRef === companyRef)) return falha("CORRECAO_VINCULO_INVALIDO");
    const numerosOriginais = lista(e.numerosOriginais, 10000).map(n => texto(n, 10));
    if (!numerosOriginais.length || new Set(numerosOriginais).size !== numerosOriginais.length || numerosOriginais.some(n => !/^[1-9]\d*$/.test(n) || Number(n) > 2147483647)) return falha("CORRECAO_NUMEROS_INVALIDOS");
    const regra = e.regra ?? "COMPANY_EXATA";
    if (regra !== "COMPANY_EXATA" && regra !== "DOMINIO_TITULAR_UNICO") return falha("CORRECAO_REGRA_VINCULO_INVALIDA");
    return { chaveClienteHistorico, companyRef, numerosOriginais, regra };
  });
  if (new Set(vinculos.map(v => `${v.chaveClienteHistorico}:${v.companyRef}`)).size !== vinculos.length) return falha("CORRECAO_VINCULO_REPETIDO");
  return { versao: 1, loteHistoricoId, inventarioSha256: sha(r.inventarioSha256), empresas, vinculos };
}
export function hashManifestoEmpresasHistoricas(v: ManifestoEmpresasHistoricas): string { return hashCanonico(v); }
