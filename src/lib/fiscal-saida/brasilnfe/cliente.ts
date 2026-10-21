import "server-only";
import { createHash } from "node:crypto";
import { motivoValidacaoXmlNfe } from "./texto-xml";
import { ETAPAS_CONTRATO_BRASILNFE, sanitizarMetadadosErroBrasilNfe } from "./diagnostico-http";
import type { CategoriaDiagnosticoBrasilNfe, EtapaContratoBrasilNfe, MetadadosErroBrasilNfe } from "./diagnostico-http";
import { guardarDetalhesTemporariosErroBrasilNfe, prepararDiagnosticoServicosBrasilNfe, observarEnvelopeConsultaNotaBrasilNfe } from "./detalhes-diagnostico";
export { obterDetalhesTemporariosErroBrasilNfe } from "./detalhes-diagnostico";
export { ETAPAS_CONTRATO_BRASILNFE } from "./diagnostico-http";
export type { EtapaContratoBrasilNfe, MetadadosErroBrasilNfe } from "./diagnostico-http";
import type {
  CertificadoInternoBrasilNfe, RequisicaoArquivoEventoBrasilNfe, RequisicaoArquivoNotaBrasilNfe, RequisicaoCancelamentoBrasilNfe,
  RetornoCancelamentoBrasilNfe, RetornoEnvioBrasilNfe,
  ConsultaNotaFiscalBrasilNfe,
  EmpresaBrasilNfeSanitizada,
  NotaConsultadaBrasilNfe,
  RequisicaoConsultaBrasilNfe,
  RequisicaoConsultaBrasilNfeHttp,
  ServicosBrasilNfeSanitizados,
  NumeracoesBrasilNfeSanitizadas,
} from "./tipos-http";
import { ErroTransmissaoFiscalBloqueadaBrasilNfe, executarTransporteManualBrasilNfe, exigirTransmissaoBrasilNfeLiberada } from "./bloqueio-transmissao";
import { ErroItemNumeracaoBrasilNfe, validarItensNumeracaoBrasilNfe } from "./numeracao-validacao";
import type { RequisicaoAtualizacaoNumeracaoBrasilNfeHttp } from "./numeracao-dto";
import { serializarPayloadLocalBrasilNfe } from "./payload-local";
import type { ResultadoPayloadLocalBrasilNfe } from "./payload-local-tipos";
import { conferirEnvelopeConsultaNotaBrasilNfe, conferirNumeroSerieChaveBrasilNfe, conferirSituacaoNotaConsultaBrasilNfe, ErroConsultaBrasilNfe } from "./consulta";

export type CodigoErroHttpBrasilNfe =
  | "CONFIGURACAO_INCOMPLETA" | "CREDENCIAL_INVALIDA" | "TIMEOUT"
  | "RESPOSTA_INVALIDA" | "LIMITE_RESPOSTA" | "EXTERNO" | "PRODUCAO_BLOQUEADA";

const MENSAGENS: Record<CodigoErroHttpBrasilNfe, string> = {
  CONFIGURACAO_INCOMPLETA: "Integração Brasil NFe incompleta. Confira as credenciais e a configuração fiscal do emissor.",
  CREDENCIAL_INVALIDA: "O Brasil NFe recusou a autenticação. Confira as credenciais por meio seguro.",
  TIMEOUT: "O Brasil NFe não respondeu no prazo. Consulte o documento para confirmar o resultado antes de repetir a operação.",
  RESPOSTA_INVALIDA: "O Brasil NFe devolveu uma resposta fora do contrato. Consulte o documento para confirmar o resultado antes de repetir a operação.",
  LIMITE_RESPOSTA: "A resposta do Brasil NFe excedeu o limite permitido. O resultado permanece incerto.",
  EXTERNO: "A comunicação com o Brasil NFe não foi concluída. Consulte o documento para confirmar o resultado antes de repetir a operação.",
  PRODUCAO_BLOQUEADA: "O ambiente da operação diverge da integração Brasil NFe. Confira a configuração de produção ou homologação antes de emitir.",
};

function categoriaRespostaInvalida(etapa?: EtapaContratoBrasilNfe): CategoriaDiagnosticoBrasilNfe {
  if (etapa === "CONTENT_TYPE") return "NAO_JSON";
  if (etapa === "JSON" || etapa === "UTF8") return "JSON_INVALIDO";
  return "CONTRATO";
}

/** Não conserva causa, headers, body ou mensagens fornecidas pelo serviço externo. */
export class ErroHttpBrasilNfe extends Error {
  readonly codigo: CodigoErroHttpBrasilNfe;
  readonly etapaContrato?: EtapaContratoBrasilNfe;
  readonly diagnosticoSeguro: MetadadosErroBrasilNfe;
  constructor(codigo: CodigoErroHttpBrasilNfe, etapaContrato?: EtapaContratoBrasilNfe, metadados?: Partial<MetadadosErroBrasilNfe>) {
    const codigoConhecido = typeof codigo === "string" && Object.hasOwn(MENSAGENS, codigo) ? codigo : "EXTERNO";
    super(MENSAGENS[codigoConhecido]);
    this.codigo = codigoConhecido;
    this.name = "ErroHttpBrasilNfe";
    if (codigoConhecido === "RESPOSTA_INVALIDA" && typeof etapaContrato === "string" && Object.hasOwn(ETAPAS_CONTRATO_BRASILNFE, etapaContrato)) this.etapaContrato = etapaContrato;
    const informado = sanitizarMetadadosErroBrasilNfe(metadados);
    const categoria = codigoConhecido === "TIMEOUT" ? "TIMEOUT" : codigoConhecido === "LIMITE_RESPOSTA" ? "LIMITE"
      : codigoConhecido === "RESPOSTA_INVALIDA" ? categoriaRespostaInvalida(this.etapaContrato)
        : codigoConhecido === "EXTERNO" ? "TRANSPORTE" : "CONFIGURACAO";
    this.diagnosticoSeguro = Object.freeze({
      ...informado,
      categoria: informado?.categoria ?? categoria,
      httpStatus: informado?.httpStatus ?? null,
      etapaContrato: this.etapaContrato ?? informado?.etapaContrato ?? null,
      statusFornecedor: informado?.statusFornecedor ?? null,
      codigoFornecedor: null,
    });
    const http = this.diagnosticoSeguro.httpStatus;
    const etapa = this.diagnosticoSeguro.etapaContrato;
    if (http !== null && http !== 200) this.message += http === 403
      ? " HTTP 403: o emissor recusou o acesso. Confira as permissões da integração."
      : ` HTTP ${http}.`;
    if (etapa && Object.hasOwn(ETAPAS_CONTRATO_BRASILNFE, etapa)) this.message += ` Campo a conferir no retorno do emissor: ${ETAPAS_CONTRATO_BRASILNFE[etapa]}.`;
  }
}

const ORIGEM = "https://api.brasilnfe.com.br";
const LIMITE_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10_000;
const CAMINHOS = {
  empresa: "/services/empresa/BuscarEmpresa",
  servicos: "/services/empresa/ConsultarServicos",
  numeracao: "/services/empresa/ConsultarNumeracao",
  atualizarNumeracao: "/services/empresa/AtualizarNumeracao",
  nota: "/services/fiscal/ConsultarNotaFiscal",
  certificado: "/services/empresa/VerificarCertificado",
  envio: "/services/fiscal/EnviarNotaFiscal",
  cancelamento: "/services/fiscal/CancelarNotaFiscal",
  arquivoNota: "/services/fiscal/ObterArquivoNotaFiscal",
  arquivoEvento: "/services/fiscal/ObterArquivoEvento",
} as const;
type ConsultaPermitida = keyof typeof CAMINHOS;
type Objeto = Record<string, unknown>;

function invalida(etapa?: EtapaContratoBrasilNfe): never {
  throw new ErroHttpBrasilNfe("RESPOSTA_INVALIDA", etapa, { categoria: categoriaRespostaInvalida(etapa), httpStatus: 200 });
}
function negocio(): never { throw new ErroHttpBrasilNfe("EXTERNO", undefined, { categoria: "NEGOCIO", httpStatus: 200 }); }
function campoEmpresa<T>(etapa: EtapaContratoBrasilNfe, validar: () => T): T {
  try { return validar(); }
  catch (erro) {
    if (erro instanceof ErroHttpBrasilNfe && erro.codigo === "RESPOSTA_INVALIDA" && !erro.etapaContrato) invalida(etapa);
    throw erro;
  }
}
function objeto(valor: unknown): Objeto {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) invalida();
  return valor as Objeto;
}
function opcionalTexto(valor: unknown, maximo = 200): string | null {
  if (valor === undefined || valor === null || valor === "") return null;
  if (typeof valor !== "string" || valor.length > maximo || /[\u0000-\u001f\u007f]/.test(valor)) invalida();
  return valor;
}
function digitos(valor: unknown, maximo: number, tamanho?: number): string | null {
  if (valor === undefined || valor === null || valor === "") return null;
  const texto = typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0 ? String(valor) : valor;
  if (typeof texto !== "string" || !/^\d+$/.test(texto) || texto.length > maximo || (tamanho && texto.length !== tamanho)) invalida();
  return texto;
}
function cepEmpresa(valor: unknown): string | null {
  // O formulário oficial do emitente usa 00.000-000. Aceita apenas máscaras
  // completas do CEP, sem remover caracteres arbitrários ou preencher dígitos.
  const normalizado = typeof valor === "string" && /^(?:\d{2}\.\d{3}-\d{3}|\d{5}-\d{3})$/.test(valor) ? valor.replace(/[.-]/g, "") : valor;
  return digitos(normalizado, 8, 8);
}
function avisosPresentes(valor: unknown): boolean {
  if (valor === undefined) return false;
  if (!Array.isArray(valor) || valor.length > 1000 || valor.some((v) => typeof v !== "string" || v.length > 2000)) invalida();
  return valor.length > 0;
}
function base64Arquivo(valor: unknown, limite: number): string {
  if (typeof valor !== "string" || !valor || valor.length > Math.ceil(limite / 3) * 4 || valor.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(valor)) invalida();
  const bytes = Buffer.from(valor, "base64");
  if (!bytes.length || bytes.length > limite || bytes.toString("base64") !== valor) invalida();
  return valor;
}
function codigoSefaz(valor: unknown): number | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor < 100 || valor > 9999) invalida();
  return valor;
}
function erroPresente(valor: unknown): boolean {
  if (valor === undefined || valor === null) return false;
  if (typeof valor !== "string" || valor.length > 10000) invalida();
  return valor.trim().length > 0;
}
function conferirErro(dados: Objeto) {
  const erro = dados.Error;
  if (erro !== undefined && erro !== null && typeof erro !== "string") invalida();
  if (dados.erros !== undefined) {
    if (!Array.isArray(dados.erros) || dados.erros.length > 1000) invalida();
    for (const item of dados.erros) objeto(item);
  }
  // Mensagens livres não comprovam autenticação nem têm códigos públicos permitidos.
  if ((typeof erro === "string" && erro.trim()) || (Array.isArray(dados.erros) && dados.erros.length) || dados.status === false) negocio();
}
function conferirEnvelope(dados: Objeto) {
  conferirErro(dados);
  if (typeof dados.status !== "number" || !Number.isSafeInteger(dados.status)) invalida();
  if (!Array.isArray(dados.erros) || dados.erros.length > 1000) invalida();
  if (dados.status !== 0 || dados.erros.length) negocio();
}

/** Preserva inteiros int64 antes do JSON.parse, sem alterar números dentro de strings. */
function jsonSemPerderInteiros(texto: string): unknown {
  let normalizado = "", indice = 0;
  while (indice < texto.length) {
    const caractere = texto[indice];
    if (caractere === '"') {
      const inicio = indice++;
      while (indice < texto.length) {
        if (texto[indice] === "\\") indice += 2;
        else if (texto[indice++] === '"') break;
      }
      normalizado += texto.slice(inicio, indice);
    } else if (caractere === "-" || /\d/.test(caractere)) {
      const numero = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(texto.slice(indice));
      if (!numero) invalida("JSON");
      const literal = numero[0];
      normalizado += /^-?\d+$/.test(literal) && !Number.isSafeInteger(Number(literal)) ? JSON.stringify(literal) : literal;
      indice += literal.length;
    } else { normalizado += caractere; indice++; }
  }
  try { return JSON.parse(normalizado) as unknown; } catch { return invalida("JSON"); }
}

function validarNota(valor: unknown, requisicao: RequisicaoConsultaBrasilNfeHttp): NotaConsultadaBrasilNfe {
  const dados = objeto(valor);
  if (dados.ModeloDocumento !== requisicao.ModeloDocumento || dados.CodTipoAmbiente !== requisicao.TipoAmbiente
    || dados.IdentificadorInterno !== requisicao.IdentificadorInterno
    || typeof dados.Status !== "number" || !Number.isSafeInteger(dados.Status) || dados.Status < 0 || dados.Status > 999
    || typeof dados.Emitida !== "boolean") invalida();
  const codigo = dados.CodStatusResposta;
  if (codigo !== undefined && codigo !== null && (typeof codigo !== "number" || !Number.isSafeInteger(codigo) || codigo < 0 || codigo > 9999)) invalida();
  const data = (v: unknown) => {
    const texto = opcionalTexto(v, 40);
    if (texto && (!/^\d{4}-\d{2}-\d{2}T/.test(texto) || !Number.isFinite(Date.parse(texto)))) invalida();
    return texto;
  };
  const cnpjEmissor = dados.CnpjEmissor == null ? undefined : digitos(dados.CnpjEmissor, 14, 14);
  if (cnpjEmissor === null) invalida();
  const nota: NotaConsultadaBrasilNfe = {
    ModeloDocumento: requisicao.ModeloDocumento, IdentificadorInterno: requisicao.IdentificadorInterno,
    CodTipoAmbiente: requisicao.TipoAmbiente, Status: dados.Status, Emitida: dados.Emitida,
    Chave: digitos(dados.Chave, 44, 44), Numero: digitos(dados.Numero, 30),
    Serie: digitos(dados.Serie, 10), NumeroProtocolo: digitos(dados.NumeroProtocolo, 30),
    CodStatusResposta: codigo == null ? null : codigo as number,
    ...(motivoValidacaoXmlNfe(dados.DsStatusResposta) ? { motivoValidacaoXml: motivoValidacaoXmlNfe(dados.DsStatusResposta) } : {}),
    DtEmissao: data(dados.DtEmissao), DtRecebimento: data(dados.DtRecebimento),
    ...(cnpjEmissor === undefined ? {} : { CnpjEmissor: cnpjEmissor }),
  };
  try {
    conferirSituacaoNotaConsultaBrasilNfe(nota);
    if (nota.Chave) {
      if (nota.Chave.slice(20, 22) !== String(requisicao.ModeloDocumento)
        || (nota.CnpjEmissor !== undefined && nota.Chave.slice(6, 20) !== nota.CnpjEmissor)) invalida();
      conferirNumeroSerieChaveBrasilNfe(nota.Chave, nota.Numero, nota.Serie);
    }
  } catch { invalida(); }
  return nota;
}

export class ClienteBrasilNfe {
  #token: string;
  #userToken?: string;
  #fetch: typeof fetch;
  #timeoutMs: number;
  #ambienteNota: 1 | 2;

  /** Injeção de transporte/prazo só é permitida na suíte, nunca muda origem ou endpoints. */
  constructor(credenciais: { token: string; userToken?: string }, opcoes: { fetch?: typeof fetch; timeoutMs?: number; ambienteNota?: 1 | 2 } = {}) {
    const valida = (v: unknown) => typeof v === "string" && /^[\x21-\x7e]{1,2048}$/.test(v);
    if (!valida(credenciais.token) || (credenciais.userToken !== undefined && !valida(credenciais.userToken))) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    if (process.env.NODE_ENV !== "test" && (opcoes.fetch !== undefined || opcoes.timeoutMs !== undefined)) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    const timeout = opcoes.timeoutMs ?? TIMEOUT_MS;
    if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > TIMEOUT_MS) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    if (opcoes.ambienteNota !== undefined && ![1, 2].includes(opcoes.ambienteNota)) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    this.#ambienteNota = opcoes.ambienteNota ?? 2;
    this.#token = credenciais.token;
    this.#userToken = credenciais.userToken;
    this.#fetch = opcoes.fetch ?? fetch;
    this.#timeoutMs = timeout;
  }

  async #chamar(consulta: ConsultaPermitida, corpo?: object | string): Promise<unknown> {
    if (consulta === "envio" || consulta === "cancelamento") exigirTransmissaoBrasilNfeLiberada({ ambiente: this.#ambienteNota === 1 ? "PRODUCAO" : "HOMOLOGACAO", operacao: consulta === "cancelamento" ? "CANCELAR" : "ENVIAR" });
    const usuarioObrigatorio = consulta === "empresa" || consulta === "servicos" || consulta === "certificado" || consulta === "numeracao" || consulta === "atualizarNumeracao";
    const limite = consulta === "arquivoNota" ? 14 * 1024 * 1024 : consulta === "arquivoEvento" || consulta === "cancelamento" ? 3 * 1024 * 1024 : consulta === "envio" ? 18 * 1024 * 1024 : LIMITE_BYTES;
    const corpoSerializado = typeof corpo === "string" ? corpo : corpo === undefined ? undefined : JSON.stringify(corpo);
    if (corpoSerializado && Buffer.byteLength(corpoSerializado, "utf8") > 4 * 1024 * 1024) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    if (usuarioObrigatorio && !this.#userToken) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    const controller = new AbortController();
    let httpStatusRecebido: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiracao = new Promise<never>((_, rejeitar) => {
      timer = setTimeout(() => {
        controller.abort();
        rejeitar(new ErroHttpBrasilNfe("TIMEOUT", undefined, { categoria: "TIMEOUT", httpStatus: httpStatusRecebido }));
      }, this.#timeoutMs);
    });
    const executar = async () => {
      let resposta: Response;
      try {
        const transmitir = () => this.#fetch(ORIGEM + CAMINHOS[consulta], {
          method: "POST", redirect: "error", cache: "no-store", signal: controller.signal,
          headers: { Accept: "application/json", "Content-Type": "application/json", Token: this.#token,
            ...(usuarioObrigatorio ? { UserToken: this.#userToken! } : {}) },
          body: corpoSerializado,
        });
        resposta = consulta === "envio" || consulta === "cancelamento" ? await executarTransporteManualBrasilNfe(transmitir) : await transmitir();
      } catch (erro) {
        if (erro instanceof ErroTransmissaoFiscalBloqueadaBrasilNfe) throw erro;
        throw new ErroHttpBrasilNfe(controller.signal.aborted ? "TIMEOUT" : "EXTERNO", undefined,
          { categoria: controller.signal.aborted ? "TIMEOUT" : "TRANSPORTE", httpStatus: httpStatusRecebido });
      }
      httpStatusRecebido = resposta.status;
      if (resposta.status !== 200) {
        // 403 indica acesso recusado; não comprova Token inválido nem documento inexistente.
        throw new ErroHttpBrasilNfe(resposta.status === 401 ? "CREDENCIAL_INVALIDA" : "EXTERNO", undefined,
          { categoria: "HTTP", httpStatus: resposta.status });
      }
      if (!/^application\/json(?:\s*;|$)/i.test(resposta.headers.get("content-type") ?? "")) invalida("CONTENT_TYPE");
      const tamanho = resposta.headers.get("content-length");
      if (tamanho && /^\d+$/.test(tamanho) && Number(tamanho) > limite) {
        throw new ErroHttpBrasilNfe("LIMITE_RESPOSTA", undefined, { categoria: "LIMITE", httpStatus: 200 });
      }
      if (!resposta.body) invalida("JSON");
      const leitor = resposta.body.getReader();
      const cancelarLeitura = () => { void leitor.cancel().catch(() => {}); };
      controller.signal.addEventListener("abort", cancelarLeitura, { once: true });
      const blocos: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const bloco = await leitor.read();
          if (bloco.done) break;
          bytes += bloco.value.byteLength;
          if (bytes > limite) {
            controller.abort();
            throw new ErroHttpBrasilNfe("LIMITE_RESPOSTA", undefined, { categoria: "LIMITE", httpStatus: 200 });
          }
          blocos.push(bloco.value);
        }
      } catch (erro) {
        if (erro instanceof ErroHttpBrasilNfe) throw erro;
        throw new ErroHttpBrasilNfe(controller.signal.aborted ? "TIMEOUT" : "EXTERNO", undefined,
          { categoria: controller.signal.aborted ? "TIMEOUT" : "TRANSPORTE", httpStatus: 200 });
      } finally {
        controller.signal.removeEventListener("abort", cancelarLeitura);
        if (controller.signal.aborted) cancelarLeitura();
        leitor.releaseLock();
      }
      const completo = new Uint8Array(bytes);
      let offset = 0;
      for (const bloco of blocos) { completo.set(bloco, offset); offset += bloco.byteLength; }
      let texto: string;
      try { texto = new TextDecoder("utf-8", { fatal: true }).decode(completo); } catch { return invalida("UTF8"); }
      return jsonSemPerderInteiros(texto);
    };
    try { return await Promise.race([executar(), expiracao]); }
    catch (erro) {
      if (erro instanceof ErroHttpBrasilNfe || erro instanceof ErroTransmissaoFiscalBloqueadaBrasilNfe) throw erro;
      throw new ErroHttpBrasilNfe("EXTERNO", undefined, { categoria: "TRANSPORTE", httpStatus: httpStatusRecebido });
    }
    finally { clearTimeout(timer); controller.abort(); }
  }

  #semCredenciais<T>(dto: T): T {
    const conferir = (valor: unknown): void => {
      if (typeof valor === "string" && [this.#token, this.#userToken].some((segredo) => segredo && (valor === segredo || (segredo.length >= 8 && valor.includes(segredo))))) invalida("SEGREDO_REFLETIDO");
      if (valor && typeof valor === "object") for (const item of Object.values(valor)) conferir(item);
    };
    conferir(dto);
    return dto;
  }

  #validarResposta<T>(consulta: ConsultaPermitida, dados: Objeto, validar: () => T): T {
    try { return validar(); }
    catch (erro) {
      const seguro = erro instanceof ErroHttpBrasilNfe ? erro : new ErroHttpBrasilNfe("RESPOSTA_INVALIDA");
      const observacaoServicos = consulta === "servicos"
        ? prepararDiagnosticoServicosBrasilNfe(dados, { token: this.#token, userToken: this.#userToken }, seguro.diagnosticoSeguro.categoria === "CONTRATO") : null;
      const final = new ErroHttpBrasilNfe(seguro.codigo, seguro.etapaContrato, {
        ...seguro.diagnosticoSeguro,
        httpStatus: 200,
        etapaContrato: seguro.diagnosticoSeguro.etapaContrato
          ?? (consulta === "empresa" ? "EMPRESA_ENVELOPE" : consulta === "servicos" ? "SERVICOS_ENVELOPE" : consulta === "numeracao" || consulta === "atualizarNumeracao" ? "NUMERACAO_ENVELOPE" : consulta === "certificado" ? "CERTIFICADO_ENVELOPE" : consulta === "envio" ? "ENVIO_ENVELOPE" : consulta === "cancelamento" ? "CANCELAMENTO_ENVELOPE" : consulta === "arquivoNota" || consulta === "arquivoEvento" ? "ARQUIVO_ENVELOPE" : "NOTA_ENVELOPE"),
        // BuscarEmpresa não publica status; só os envelopes de serviços e notas entram na lista permitida.
        statusFornecedor: consulta !== "empresa" && dados.status === 0 ? 0 : null,
        ...observacaoServicos?.metadados,
        ...(consulta === "nota" ? observarEnvelopeConsultaNotaBrasilNfe(dados, { token: this.#token, userToken: this.#userToken }) : {}),
        ...((consulta === "numeracao" || consulta === "atualizarNumeracao") && typeof dados.status === "boolean" ? { statusFornecedor: dados.status, tipoStatusFornecedor: "BOOLEANO" as const, estadoStatusFornecedor: dados.status ? "TRUE" as const : "FALSE" as const } : {}),
      });
      if (observacaoServicos) guardarDetalhesTemporariosErroBrasilNfe(final, observacaoServicos.detalhes);
      throw final;
    }
  }

  async buscarEmpresa(): Promise<EmpresaBrasilNfeSanitizada> {
    const resposta = await this.#chamar("empresa");
    return this.#buscarEmpresaProjetada(campoEmpresa("OBJETO_JSON", () => objeto(resposta)));
  }

  #buscarEmpresaProjetada(dados: Objeto): EmpresaBrasilNfeSanitizada {
    return this.#validarResposta("empresa", dados, () => {
      campoEmpresa("EMPRESA_ENVELOPE", () => conferirErro(dados));
      if (dados.status !== undefined && dados.status !== true) invalida("EMPRESA_STATUS");
      if (dados.CNPJ === undefined) invalida("EMPRESA_CNPJ_AUSENTE");
      if (dados.CNPJ === null) invalida("EMPRESA_CNPJ_NULO");
      if (typeof dados.CNPJ === "number") invalida("EMPRESA_CNPJ_NUMERICO");
      if (typeof dados.CNPJ !== "string") invalida("EMPRESA_CNPJ_TIPO");
      // A consulta real do Marco1.1 confirmou a máscara brasileira, mantendo 14 dígitos.
      // Aceita somente esse formato completo ou dígitos; não limpa caracteres arbitrários.
      const cnpjEmpresa = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(dados.CNPJ) ? dados.CNPJ.replace(/[.\/-]/g, "") : dados.CNPJ;
      if (/^\d{11}$/.test(cnpjEmpresa)) invalida("EMPRESA_CNPJ_CPF");
      if (!/^\d{14}$/.test(cnpjEmpresa)) invalida("EMPRESA_CNPJ_FORMATO");
      if (dados.CRT !== undefined && dados.CRT !== null && ![1, 2, 3, 4].includes(dados.CRT as number)) invalida("EMPRESA_CRT");
      const endereco = dados.Endereco == null ? {} : campoEmpresa("EMPRESA_ENDERECO", () => objeto(dados.Endereco));
      const configuracao = dados.Configuracao == null ? {} : campoEmpresa("EMPRESA_CONFIGURACAO", () => objeto(dados.Configuracao));
      const nfce = configuracao.NFCe == null ? {} : campoEmpresa("EMPRESA_NFCE", () => objeto(configuracao.NFCe));
      const uf = campoEmpresa("EMPRESA_UF", () => opcionalTexto(endereco.Uf, 2));
      if (uf && !/^[A-Z]{2}$/.test(uf)) invalida("EMPRESA_UF");
      return this.#semCredenciais({
        cnpj: cnpjEmpresa, razaoSocial: campoEmpresa("EMPRESA_RAZAO_SOCIAL", () => opcionalTexto(dados.RzSocial)), nomeFantasia: campoEmpresa("EMPRESA_NOME_FANTASIA", () => opcionalTexto(dados.NmFantasia)),
        inscricaoEstadual: campoEmpresa("EMPRESA_IE", () => opcionalTexto(dados.IE, 20)), crt: dados.CRT == null ? null : dados.CRT as 1 | 2 | 3 | 4,
        endereco: { cep: campoEmpresa("EMPRESA_CEP", () => cepEmpresa(endereco.Cep)), logradouro: campoEmpresa("EMPRESA_LOGRADOURO", () => opcionalTexto(endereco.Logradouro)), numero: campoEmpresa("EMPRESA_NUMERO", () => opcionalTexto(endereco.Numero, 60)),
          bairro: campoEmpresa("EMPRESA_BAIRRO", () => opcionalTexto(endereco.Bairro)), codigoMunicipio: campoEmpresa("EMPRESA_COD_MUNICIPIO", () => digitos(endereco.CodMunicipio, 7, 7)), municipio: campoEmpresa("EMPRESA_MUNICIPIO", () => opcionalTexto(endereco.Municipio)), uf },
        nfceHomologacao: { idCscConfigurado: !!campoEmpresa("EMPRESA_ID_CSC", () => opcionalTexto(nfce.IdCSCHomologacao, 200)), cscConfigurado: !!campoEmpresa("EMPRESA_CSC", () => opcionalTexto(nfce.CSCHomologacao, 2048)) },
        nfceProducao: { idCscConfigurado: !!campoEmpresa("EMPRESA_ID_CSC", () => opcionalTexto(nfce.IdCSCProducao, 200)), cscConfigurado: !!campoEmpresa("EMPRESA_CSC", () => opcionalTexto(nfce.CSCProducao, 2048)) },
      });
    });
  }

  async consultarServicos(): Promise<ServicosBrasilNfeSanitizados> {
    const resposta = await this.#chamar("servicos"), dados = campoEmpresa("OBJETO_JSON", () => objeto(resposta));
    return this.#validarResposta("servicos", dados, () => {
      conferirEnvelope(dados);
      if (!Array.isArray(dados.Servicos) || dados.Servicos.length > 500) invalida("SERVICOS_LISTA");
      const servicos = dados.Servicos.map((item) => {
        const servico = campoEmpresa("SERVICOS_ITEM", () => objeto(item));
        const nome = campoEmpresa("SERVICOS_NOME", () => opcionalTexto(servico.Nome, 100));
        if (!nome) invalida("SERVICOS_NOME");
        if (typeof servico.Ativo !== "boolean") invalida("SERVICOS_ATIVO");
        return { nome, ativo: servico.Ativo };
      });
      return this.#semCredenciais({ servicos, avisosPresentes: campoEmpresa("SERVICOS_AVISOS", () => avisosPresentes(dados.avisos)) });
    });
  }

  /** Somente leitura. Não chama AtualizarNumeracao nem reserva o contador. */
  async consultarNumeracao(): Promise<NumeracoesBrasilNfeSanitizadas> {
    const resposta = await this.#chamar("numeracao"), dados = campoEmpresa("OBJETO_JSON", () => objeto(resposta));
    return this.#validarResposta("numeracao", dados, () => {
      if (typeof dados.status !== "boolean") invalida("NUMERACAO_ENVELOPE");
      campoEmpresa("NUMERACAO_ENVELOPE", () => conferirErro(dados));
      if (!dados.status) negocio();
      if (!Array.isArray(dados.Numeracoes) || dados.Numeracoes.length > 1000) invalida("NUMERACAO_LISTA");
      let resultado: ReturnType<typeof validarItensNumeracaoBrasilNfe>;
      try { resultado = validarItensNumeracaoBrasilNfe(dados.Numeracoes); }
      catch (erro) {
        if (erro instanceof ErroItemNumeracaoBrasilNfe) throw new ErroHttpBrasilNfe("RESPOSTA_INVALIDA", "NUMERACAO_ITEM", {
          categoria: "CONTRATO", httpStatus: 200, etapaContrato: "NUMERACAO_ITEM", itemNumeracao: erro.detalhe,
        });
        throw erro;
      }
      return this.#semCredenciais({ ...resultado, avisosPresentes: campoEmpresa("NUMERACAO_AVISOS", () => avisosPresentes(dados.Avisos)) });
    });
  }

  /** Administração explícita do contador; não emite, cancela ou inutiliza documentos. Sem retry. */
  async atualizarNumeracao(entrada: RequisicaoAtualizacaoNumeracaoBrasilNfeHttp): Promise<NumeracoesBrasilNfeSanitizadas["numeracoes"][number]> {
    let item: NumeracoesBrasilNfeSanitizadas["numeracoes"][number] | undefined;
    try { item = validarItensNumeracaoBrasilNfe([entrada]).numeracoes[0]; }
    catch { throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA"); }
    if (!item) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    const permitido: RequisicaoAtualizacaoNumeracaoBrasilNfeHttp = { TipoAmbiente: item.ambiente, ModeloDocumento: item.modelo, Serie: item.serie, Numero: Number(item.numero), Padrao: item.padrao };
    const resposta = await this.#chamar("atualizarNumeracao", permitido), dados = campoEmpresa("OBJETO_JSON", () => objeto(resposta));
    return this.#validarResposta("atualizarNumeracao", dados, () => {
      if (typeof dados.status !== "boolean") invalida("NUMERACAO_ENVELOPE");
      campoEmpresa("NUMERACAO_ENVELOPE", () => conferirErro(dados));
      if (!dados.status) negocio();
      let confirmado: typeof item;
      try { confirmado = validarItensNumeracaoBrasilNfe([dados.Numeracao]).numeracoes[0]; }
      catch { return invalida("NUMERACAO_ITEM"); }
      if (!confirmado || confirmado.ambiente !== item.ambiente || confirmado.modelo !== item.modelo || Number(confirmado.serie) !== Number(item.serie)
        || confirmado.numero !== item.numero || confirmado.padrao !== item.padrao) invalida("NUMERACAO_ITEM");
      campoEmpresa("NUMERACAO_AVISOS", () => avisosPresentes(dados.Avisos));
      return this.#semCredenciais(confirmado);
    });
  }

  async consultarNotaFiscal(requisicao: RequisicaoConsultaBrasilNfe | RequisicaoConsultaBrasilNfeHttp): Promise<ConsultaNotaFiscalBrasilNfe> {
    if ("documentoId" in requisicao && (requisicao.ambiente === "PRODUCAO" ? 1 : 2) !== this.#ambienteNota) throw new ErroHttpBrasilNfe("PRODUCAO_BLOQUEADA");
    const corpo: RequisicaoConsultaBrasilNfeHttp = "documentoId" in requisicao
      ? { IdentificadorInterno: requisicao.documentoId, ModeloDocumento: requisicao.modelo, TipoAmbiente: requisicao.ambiente === "PRODUCAO" ? 1 : 2, RetornarArquivos: false }
      : requisicao;
    if (corpo.TipoAmbiente !== this.#ambienteNota) throw new ErroHttpBrasilNfe("PRODUCAO_BLOQUEADA");
    if (![55, 65].includes(corpo.ModeloDocumento) || corpo.RetornarArquivos !== false
      || typeof corpo.IdentificadorInterno !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(corpo.IdentificadorInterno)) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    // Recria o body permitido: propriedades extras recebidas em runtime nunca são transmitidas.
    const permitido: RequisicaoConsultaBrasilNfeHttp = { IdentificadorInterno: corpo.IdentificadorInterno,
      ModeloDocumento: corpo.ModeloDocumento, TipoAmbiente: this.#ambienteNota, RetornarArquivos: false };
    const resposta = await this.#chamar("nota", permitido), dados = campoEmpresa("OBJETO_JSON", () => objeto(resposta));
    return this.#validarResposta("nota", dados, () => {
      let envelope: ReturnType<typeof conferirEnvelopeConsultaNotaBrasilNfe>;
      try { envelope = conferirEnvelopeConsultaNotaBrasilNfe(dados); }
      catch (erro) { if (erro instanceof ErroConsultaBrasilNfe && erro.codigo === "CONSULTA_RECUSADA") negocio(); return invalida("NOTA_ENVELOPE"); }
      if (typeof dados.Encontrada !== "boolean" || !Array.isArray(dados.Historico) || dados.Historico.length > 1000) invalida();
      const nota = dados.Nota == null ? null : campoEmpresa("NOTA_CAMPOS", () => validarNota(dados.Nota, permitido));
      const historico = dados.Historico.map((item) => campoEmpresa("NOTA_CAMPOS", () => validarNota(item, permitido)));
      if ((dados.Encontrada && !nota) || (!dados.Encontrada && (nota || historico.length))) invalida();
      return this.#semCredenciais({ Encontrada: dados.Encontrada, Nota: nota, Historico: historico,
        erros: envelope.codigoAusencia ? [{ codigo: envelope.codigoAusencia }] : [], avisos: [],
        avisosPresentes: campoEmpresa("NOTA_AVISOS", () => avisosPresentes(dados.avisos)), status: envelope.status });
    });
  }

  async verificarCertificadoInterno(): Promise<CertificadoInternoBrasilNfe> {
    const dados = objeto(await this.#chamar("certificado", { Interno: true }));
    return this.#validarResposta("certificado", dados, () => {
      if (typeof dados.status !== "boolean") invalida("CERTIFICADO_STATUS");
      if (typeof dados.Expirado !== "boolean") invalida("CERTIFICADO_EXPIRADO");
      if (typeof dados.Error !== "string") invalida("CERTIFICADO_ERROR");
      if (!dados.status || erroPresente(dados.Error)) negocio();
      if (typeof dados.DtExpiracao !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dados.DtExpiracao)) invalida("CERTIFICADO_DATA");
      const civil = Date.parse(`${dados.DtExpiracao}T00:00:00Z`);
      if (!Number.isFinite(civil) || new Date(civil).toISOString().slice(0, 10) !== dados.DtExpiracao) invalida("CERTIFICADO_DATA");
      return { valido: !dados.Expirado, expirado: dados.Expirado, dataExpiracao: dados.DtExpiracao, avisosPresentes: avisosPresentes(dados.Avisos) };
    });
  }

  async enviarNotaFiscal(resultado: ResultadoPayloadLocalBrasilNfe): Promise<RetornoEnvioBrasilNfe> {
    // Serializador aceita apenas o plano original imutável e atestado pelo construtor.
    if (resultado.payload?.TipoAmbiente !== this.#ambienteNota) throw new ErroHttpBrasilNfe("PRODUCAO_BLOQUEADA");
    const corpo = serializarPayloadLocalBrasilNfe(resultado);
    exigirTransmissaoBrasilNfeLiberada({ documentoId: resultado.documentoId, modelo: resultado.modelo, ambiente: this.#ambienteNota === 1 ? "PRODUCAO" : "HOMOLOGACAO", hashSnapshot: resultado.hashPayload, hashPayloadFiscal: createHash("sha256").update(corpo).digest("hex") });
    this.#semCredenciais(corpo);
    const dados = objeto(await this.#chamar("envio", corpo));
    return this.#validarResposta("envio", dados, () => {
      if (typeof dados.Error !== "string") invalida();
      const nf = dados.ReturnNF == null ? {} : objeto(dados.ReturnNF);
      if (dados.ReturnNF == null && !erroPresente(dados.Error)) invalida();
      if (nf.Ok != null && typeof nf.Ok !== "boolean") invalida();
      if (nf.CodTipoAmbiente != null && nf.CodTipoAmbiente !== this.#ambienteNota) throw new ErroHttpBrasilNfe("PRODUCAO_BLOQUEADA");
      avisosPresentes(dados.Avisos);
      return this.#semCredenciais({ numero: digitos(nf.Numero, 9), serie: digitos(nf.Serie, 3), chave: digitos(nf.ChaveNF, 44, 44), protocolo: digitos(nf.NumeroProtocolo, 30),
        codigoSefaz: codigoSefaz(nf.CodStatusRespostaSefaz), ok: nf.Ok == null ? null : nf.Ok as boolean, ambiente: nf.CodTipoAmbiente == null ? null : this.#ambienteNota, erroPresente: erroPresente(dados.Error),
        ...(dados.Base64Xml == null ? {} : { Base64Xml: this.#arquivoSeguro(dados.Base64Xml, 2 * 1024 * 1024) }),
        ...(dados.Base64File == null ? {} : { Base64File: this.#arquivoSeguro(dados.Base64File, 10 * 1024 * 1024) }) });
    });
  }

  async cancelarNotaFiscal(requisicao: RequisicaoCancelamentoBrasilNfe): Promise<RetornoCancelamentoBrasilNfe> {
    if (requisicao.TipoAmbiente !== this.#ambienteNota) throw new ErroHttpBrasilNfe("PRODUCAO_BLOQUEADA");
    if (typeof requisicao.ChaveNF !== "string" || !/^\d{44}$/.test(requisicao.ChaveNF) || typeof requisicao.NumeroProtocolo !== "string" || !/^\d{1,30}$/.test(requisicao.NumeroProtocolo) || requisicao.TipoDocumento !== 0
      || typeof requisicao.Justificativa !== "string" || requisicao.Justificativa.trim().length < 15 || requisicao.Justificativa.length > 1000 || /[\u0000-\u001f\u007f<>]/.test(requisicao.Justificativa)) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    const permitido: RequisicaoCancelamentoBrasilNfe = { ChaveNF: requisicao.ChaveNF, Justificativa: requisicao.Justificativa, TipoAmbiente: this.#ambienteNota, NumeroProtocolo: requisicao.NumeroProtocolo, TipoDocumento: 0 };
    this.#semCredenciais(permitido);
    const dados = objeto(await this.#chamar("cancelamento", permitido));
    return this.#validarResposta("cancelamento", dados, () => {
      if (typeof dados.Error !== "string") invalida();
      if (![1, 2, 3].includes(dados.Status as number)) invalida();
      if (dados.NumeroSequencial != null && (typeof dados.NumeroSequencial !== "number" || !Number.isSafeInteger(dados.NumeroSequencial) || dados.NumeroSequencial < 1 || dados.NumeroSequencial > 999)) invalida();
      avisosPresentes(dados.Avisos);
      return this.#semCredenciais({ statusEvento: dados.Status as 1 | 2 | 3, codigoSefaz: codigoSefaz(dados.CodStatusRespostaSefaz), protocoloCancelamento: digitos(dados.NuProtocolo, 30), numeroSequencialEvento: dados.NumeroSequencial == null ? null : dados.NumeroSequencial as number,
        erroPresente: erroPresente(dados.Error), ...(dados.Base64Xml == null ? {} : { Base64Xml: this.#arquivoSeguro(dados.Base64Xml, 2 * 1024 * 1024) }) });
    });
  }

  #arquivoSeguro(valor: unknown, limite: number): string {
    const arquivo = base64Arquivo(valor, limite);
    const texto = Buffer.from(arquivo, "base64").toString("utf8");
    this.#semCredenciais(texto);
    // HTML/XML podem codificar os caracteres da credencial. A projeção não conserva
    // texto cujo segredo ficaria visível somente depois do parser/renderizador.
    const entidades = texto.replace(/&#(?:x([0-9a-f]{1,6})|([0-9]{1,7}));/gi, (inteiro, hexa: string | undefined, decimal: string | undefined) => {
      const ponto = Number.parseInt(hexa ?? decimal!, hexa ? 16 : 10);
      return ponto <= 0x10ffff ? String.fromCodePoint(ponto) : inteiro;
    }).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    this.#semCredenciais(entidades);
    return arquivo;
  }
  async obterArquivoNotaFiscal(requisicao: RequisicaoArquivoNotaBrasilNfe): Promise<string> {
    if (typeof requisicao.ChaveNF !== "string" || !/^\d{44}$/.test(requisicao.ChaveNF) || ![1, 2].includes(requisicao.FileType) || requisicao.TipoDocumentoFiscal !== 1) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    const permitido = { ChaveNF: requisicao.ChaveNF, FileType: requisicao.FileType, TipoDocumentoFiscal: 1 };
    return this.#arquivoSeguro(await this.#chamar("arquivoNota", permitido), requisicao.FileType === 1 ? 2 * 1024 * 1024 : 10 * 1024 * 1024);
  }
  async obterArquivoEvento(requisicao: RequisicaoArquivoEventoBrasilNfe): Promise<string> {
    if (typeof requisicao.ChaveNF !== "string" || !/^\d{44}$/.test(requisicao.ChaveNF) || typeof requisicao.NuProtocolo !== "string" || !/^\d{1,30}$/.test(requisicao.NuProtocolo) || requisicao.TipoArquivo !== 1) throw new ErroHttpBrasilNfe("CONFIGURACAO_INCOMPLETA");
    return this.#arquivoSeguro(await this.#chamar("arquivoEvento", { ChaveNF: requisicao.ChaveNF, NuProtocolo: requisicao.NuProtocolo, TipoArquivo: 1 }), 2 * 1024 * 1024);
  }
}
