import { sanitizarMetadadosErroBrasilNfe, type MetadadosErroBrasilNfe } from "./diagnostico-http";
export type PresencaPreRequisitoBrasilNfe = boolean | null;
export const CAMPOS_ENDERECO_EXTERNO_BRASILNFE = { cep: "CEP", logradouro: "logradouro", numero: "número", bairro: "bairro", codigoMunicipio: "código IBGE do município", municipio: "município", uf: "UF" } as const;
export type CampoEnderecoExternoBrasilNfe = keyof typeof CAMPOS_ENDERECO_EXTERNO_BRASILNFE;
export function camposEnderecoExternoAusentesBrasilNfe(endereco: Record<CampoEnderecoExternoBrasilNfe, string | null>) {
  return (Object.keys(CAMPOS_ENDERECO_EXTERNO_BRASILNFE) as CampoEnderecoExternoBrasilNfe[]).filter(k => !endereco[k]?.trim());
}
export type EvidenciaPainelBrasilNfe = {
  origem: "PAINEL_BRASIL_NFE" | "RELATO_USUARIO_PAINEL_BRASIL_NFE"; observadoEm: string; registradoEm: string;
  servicoNfeNfceAtivo: boolean; homologacaoInformadaPeloUsuario: boolean;
  certificadoValidade: string | null;
  ufEmitente?: string | null;
  csc: { homologacao: { codigo: boolean; identificador: boolean }; producao: { codigo: boolean; identificador: boolean } };
};
export type PreRequisitosBrasilNfe = {
  versaoConfiguracao: number; evidenciaPainel: EvidenciaPainelBrasilNfe | null;
  verificadoEm: string | null; empresaCorrespondente: PresencaPreRequisitoBrasilNfe;
  empresaVerificadaEm?: string | null; empresaFalha?: MetadadosErroBrasilNfe | null;
  emitenteExterno: { ie: PresencaPreRequisitoBrasilNfe; crt: PresencaPreRequisitoBrasilNfe; endereco: PresencaPreRequisitoBrasilNfe };
  camposEnderecoAusentes?: CampoEnderecoExternoBrasilNfe[];
  certificado: { situacao: "NAO_CONFERIDO" | "VALIDO" | "EXPIRADO" | "NAO_CONFIRMADO"; validade: string | null; verificadoEm: string | null; httpStatus: number | null; falha?: MetadadosErroBrasilNfe | null };
  csc: { homologacao: { codigo: PresencaPreRequisitoBrasilNfe; identificador: PresencaPreRequisitoBrasilNfe }; producao: { codigo: PresencaPreRequisitoBrasilNfe; identificador: PresencaPreRequisitoBrasilNfe } };
  pendencias: string[]; producaoBloqueada: true; transmissaoAutorizada: false;
};
export type ResultadoPreRequisitosBrasilNfe = { ok: true; dados: PreRequisitosBrasilNfe } | { ok: false; erro: string };
export function preRequisitosBrasilNfeVazios(versaoConfiguracao: number): PreRequisitosBrasilNfe {
  return { versaoConfiguracao, evidenciaPainel: null, verificadoEm: null, empresaCorrespondente: null,
    emitenteExterno: { ie: null, crt: null, endereco: null }, certificado: { situacao: "NAO_CONFERIDO", validade: null, verificadoEm: null, httpStatus: null },
    csc: { homologacao: { codigo: null, identificador: null }, producao: { codigo: null, identificador: null } }, pendencias: [], producaoBloqueada: true, transmissaoAutorizada: false };
}
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function dataCivilCertificadoBrasilNfe(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}
const instante = (v: unknown): string | null => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) ? v : null;
export function restaurarPreRequisitosBrasilNfe(v: unknown, versao: number): PreRequisitosBrasilNfe {
  const s = objeto(v), r = preRequisitosBrasilNfeVazios(versao), e = objeto(s.evidenciaPainel);
  if ((e.origem === "PAINEL_BRASIL_NFE" || e.origem === "RELATO_USUARIO_PAINEL_BRASIL_NFE") && instante(e.observadoEm) && instante(e.registradoEm) && typeof e.servicoNfeNfceAtivo === "boolean" && typeof e.homologacaoInformadaPeloUsuario === "boolean") {
    const c = objeto(e.csc), h = objeto(c.homologacao), p = objeto(c.producao);
    if ([h.codigo, h.identificador, p.codigo, p.identificador].every(x => typeof x === "boolean")) r.evidenciaPainel = { origem: e.origem as EvidenciaPainelBrasilNfe["origem"], observadoEm: instante(e.observadoEm)!, registradoEm: instante(e.registradoEm)!, servicoNfeNfceAtivo: e.servicoNfeNfceAtivo, homologacaoInformadaPeloUsuario: e.homologacaoInformadaPeloUsuario, certificadoValidade: dataCivilCertificadoBrasilNfe(e.certificadoValidade), ...(e.ufEmitente === undefined ? {} : { ufEmitente: e.origem === "PAINEL_BRASIL_NFE" && ufEmitentePainelBrasilNfe(e.ufEmitente) ? e.ufEmitente as string : null }), csc: { homologacao: { codigo: h.codigo as boolean, identificador: h.identificador as boolean }, producao: { codigo: p.codigo as boolean, identificador: p.identificador as boolean } } };
  }
  r.verificadoEm = instante(s.verificadoEm);
  r.empresaVerificadaEm = instante(s.empresaVerificadaEm) ?? (s.empresaCorrespondente === true ? r.verificadoEm : null);
  r.empresaFalha = sanitizarMetadadosErroBrasilNfe(s.empresaFalha);
  if (r.verificadoEm) {
    r.empresaCorrespondente = typeof s.empresaCorrespondente === "boolean" ? s.empresaCorrespondente : null;
    const externo = objeto(s.emitenteExterno), cert = objeto(s.certificado), csc = objeto(s.csc);
    for (const k of ["ie", "crt", "endereco"] as const) r.emitenteExterno[k] = typeof externo[k] === "boolean" ? externo[k] : null;
    if (Array.isArray(s.camposEnderecoAusentes) && s.camposEnderecoAusentes.length <= 7 && s.camposEnderecoAusentes.every(k => typeof k === "string" && Object.hasOwn(CAMPOS_ENDERECO_EXTERNO_BRASILNFE, k))) r.camposEnderecoAusentes = [...new Set(s.camposEnderecoAusentes)] as CampoEnderecoExternoBrasilNfe[];
    for (const ambiente of ["homologacao", "producao"] as const) {
      const a = objeto(csc[ambiente]); for (const k of ["codigo", "identificador"] as const) r.csc[ambiente][k] = typeof a[k] === "boolean" ? a[k] : null;
    }
    if (["VALIDO", "EXPIRADO", "NAO_CONFIRMADO"].includes(String(cert.situacao))) r.certificado.situacao = cert.situacao as PreRequisitosBrasilNfe["certificado"]["situacao"];
    r.certificado.validade = dataCivilCertificadoBrasilNfe(cert.validade); r.certificado.verificadoEm = instante(cert.verificadoEm);
    r.certificado.httpStatus = typeof cert.httpStatus === "number" && Number.isSafeInteger(cert.httpStatus) && cert.httpStatus >= 100 && cert.httpStatus <= 599 ? cert.httpStatus : null;
    r.certificado.falha = sanitizarMetadadosErroBrasilNfe(cert.falha);
    if (r.certificado.situacao === "VALIDO" && (!r.certificado.validade || !r.certificado.verificadoEm || r.certificado.httpStatus !== 200)) r.certificado.situacao = "NAO_CONFIRMADO";
    if (r.certificado.situacao === "VALIDO" && acompanhamentoCertificadoBrasilNfe(r.certificado.validade).situacao === "VENCIDO") r.certificado.situacao = "EXPIRADO";
  }
  // Pendências persistidas não são copiadas: derivadas abaixo de estados permitidos.
  if (r.empresaCorrespondente === false) r.pendencias.push("Emitente externo divergente: conferir o vínculo; não alterar o CNPJ esperado para aceitar.");
  if (r.verificadoEm && r.emitenteExterno.ie !== true) r.pendencias.push("Conferir inscrição estadual do emitente mediante revisão fiscal fundamentada.");
  if (r.verificadoEm && r.emitenteExterno.crt !== true) r.pendencias.push("Conferir CRT do emitente mediante revisão fiscal fundamentada.");
  if (r.verificadoEm && r.emitenteExterno.endereco !== true) r.pendencias.push(r.camposEnderecoAusentes?.length ? `BuscarEmpresa não informou: ${r.camposEnderecoAusentes.map(k => CAMPOS_ENDERECO_EXTERNO_BRASILNFE[k]).join(", ")}. Conferir a representação na API; o cadastro do painel é uma evidência separada.` : "Endereço externo não confirmado pela consulta; conferir os campos obrigatórios antes de transmitir.");
  if (r.certificado.situacao !== "VALIDO") r.pendencias.push("Certificado interno ainda não confirmado por consulta válida de leitura.");
  const csc = r.verificadoEm ? r.csc.homologacao : r.evidenciaPainel?.csc.homologacao;
  if (csc?.codigo !== true || csc?.identificador !== true) r.pendencias.push("NFC-e: configurar CSC e identificador de homologação no canal protegido do fornecedor.");
  r.pendencias.push("Fundamentação fiscal: decisões por produto/operação e vigência precisam de aprovação interna autorizada.", "A primeira transmissão de homologação exige autorização específica; produção permanece bloqueada.");
  return r;
}
export function ufEmitentePainelBrasilNfe(v: unknown): v is string {
  return typeof v === "string" && /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(v);
}
/** Consulta incompleta e observação direta permanecem evidências distintas.
 * Apenas a UF omitida pode ser conferida pelo painel, por até sete dias. */
export function ufAusenteConferidaNoPainelBrasilNfe(p: PreRequisitosBrasilNfe, agora = new Date()) {
  const e = p.evidenciaPainel, idade = e ? agora.getTime() - Date.parse(e.observadoEm) : NaN;
  return p.empresaCorrespondente === true && !p.empresaFalha && p.camposEnderecoAusentes?.length === 1 && p.camposEnderecoAusentes[0] === "uf" && e?.origem === "PAINEL_BRASIL_NFE" && ufEmitentePainelBrasilNfe(e.ufEmitente) && idade >= -60000 && idade <= 7 * 86400000;
}
/** Acompanhamento local em data civil de Brasília; não consulta API nem cria agendamento. */
export function acompanhamentoCertificadoBrasilNfe(validade: string | null, agora = new Date()) {
  const v = dataCivilCertificadoBrasilNfe(validade);
  if (!v || !Number.isFinite(agora.getTime())) return { dias: null, situacao: "NAO_CONFERIDO" as const };
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  const dias = Math.round((Date.parse(`${v}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000);
  return { dias, situacao: dias < 0 ? "VENCIDO" as const : dias === 0 ? "VENCE_HOJE" as const : dias <= 30 ? "RENOVAR" as const : "VIGENTE" as const };
}
