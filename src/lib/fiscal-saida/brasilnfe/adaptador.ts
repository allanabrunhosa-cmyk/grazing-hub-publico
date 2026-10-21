import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AdaptadorFiscalSaida, IdentidadeFiscalSaida, RespostaFiscalSaida } from "../contrato";
import { BLOQUEIO_OPERACIONAL_BRASILNFE_M1 } from "../provedor";
import { codigoAmbienteBrasilNfe, conferirIdentidadeBrasilNfe, ErroConsultaBrasilNfe, interpretarConsultaBrasilNfe, prepararConsultaBrasilNfe, type EvidenciaConsultaBrasilNfe, type RequisicaoConsultaBrasilNfe } from "./consulta";
import { normalizarCnpjBrasilNfe } from "./mapeamento";
import { validarArquivosBrasilNfe, validarXmlCancelamentoBrasilNfe } from "./arquivos";
import { conferirAutorizacaoBrasilNfe, interpretarEnvioFiscalBrasilNfe, interpretarRecuperacaoFiscalBrasilNfe, respostaFiscalBrasilNfe, type DadosAutorizacaoBrasilNfe } from "./resposta-fiscal";
import type { ResultadoPayloadLocalBrasilNfe } from "./payload-local-tipos";
import { ErroHttpBrasilNfe, type ClienteBrasilNfe } from "./cliente";
import { exigirTransmissaoBrasilNfeLiberada } from "./bloqueio-transmissao";
import { mensagemCodigoSefaz } from "./mensagens-sefaz";

export type ClienteConsultaAdaptadorBrasilNfe = { consultarNotaFiscal(requisicao: RequisicaoConsultaBrasilNfe): Promise<unknown> };
type ClienteOperacionalBrasilNfe = ClienteConsultaAdaptadorBrasilNfe & Partial<Pick<ClienteBrasilNfe, "enviarNotaFiscal" | "cancelarNotaFiscal" | "obterArquivoNotaFiscal" | "obterArquivoEvento">>;
export type PortaOperacaoBrasilNfe = {
  /** Porta exclusivamente servidor: confere autorização específica, sessão, identidade,
   * configuração fiscal aprovada e lease. Nunca é obtida de body, env pública ou UI. */
  autorizar(operacao: "ENVIAR" | "CONSULTAR" | "CANCELAR" | "DOCUMENTOS", identidade: IdentidadeFiscalSaida): Promise<void>;
  preparar(identidade: IdentidadeFiscalSaida, fotografia: Prisma.JsonValue): Promise<ResultadoPayloadLocalBrasilNfe>;
  obterAutorizacao(identidade: IdentidadeFiscalSaida): Promise<DadosAutorizacaoBrasilNfe | null>;
};
export class ErroAdaptadorBrasilNfe extends Error {
  constructor() { super(BLOQUEIO_OPERACIONAL_BRASILNFE_M1); this.name = "ErroAdaptadorBrasilNfe"; }
}
/** Base técnica compatível com a fila existente, deliberadamente não registrada.
 * Emissão individual futura usa retorno síncrono + consulta, sem depender de webhook.
 * Consulta administrativa não aplica autorização durável: sequência e idempotência
 * externas ainda precisam ser comprovadas com o fornecedor na homologação. */
export class AdaptadorBrasilNfeM1 implements AdaptadorFiscalSaida {
  readonly id = "BRASIL_NFE";
  readonly ambiente: "HOMOLOGACAO" | "PRODUCAO";
  readonly bloqueioOperacional = BLOQUEIO_OPERACIONAL_BRASILNFE_M1;
  private readonly emitenteCnpj: string;
  constructor(private readonly cliente: ClienteOperacionalBrasilNfe, emitenteCnpj: string, private readonly porta?: PortaOperacaoBrasilNfe, ambiente: "HOMOLOGACAO" | "PRODUCAO" = "HOMOLOGACAO") { this.emitenteCnpj = normalizarCnpjBrasilNfe(emitenteCnpj); this.ambiente = ambiente; }
  private async autorizar(operacao: Parameters<PortaOperacaoBrasilNfe["autorizar"]>[0], identidade: IdentidadeFiscalSaida) {
    if (!this.porta) throw new ErroAdaptadorBrasilNfe();
    const i = conferirIdentidadeBrasilNfe(identidade);
    if (i.emitenteCnpj !== this.emitenteCnpj || i.ambiente !== this.ambiente) throw new ErroAdaptadorBrasilNfe();
    await this.porta.autorizar(operacao, i);
    return i;
  }
  async consultarEvidencias(identidade: IdentidadeFiscalSaida): Promise<EvidenciaConsultaBrasilNfe> {
    const i = conferirIdentidadeBrasilNfe(identidade);
    if (i.emitenteCnpj !== this.emitenteCnpj || i.ambiente !== this.ambiente) throw new ErroAdaptadorBrasilNfe();
    try { return interpretarConsultaBrasilNfe(await this.cliente.consultarNotaFiscal(prepararConsultaBrasilNfe(i)), i); }
    catch (erro) { if (erro instanceof ErroConsultaBrasilNfe) throw erro; throw new ErroConsultaBrasilNfe("CONSULTA_RECUSADA", erro instanceof ErroHttpBrasilNfe ? erro.diagnosticoSeguro : undefined); }
  }
  async enviar(identidade: IdentidadeFiscalSaida, payload: Prisma.JsonValue): Promise<RespostaFiscalSaida> {
    exigirTransmissaoBrasilNfeLiberada({ documentoId: identidade.documentoId, ambiente: this.ambiente, modelo: identidade.modeloDocumento, emitenteCnpj: this.emitenteCnpj, operacao: "ENVIAR" });
    const i = await this.autorizar("ENVIAR", identidade);
    if (!this.cliente.enviarNotaFiscal) throw new ErroAdaptadorBrasilNfe();
    if (await this.porta!.obterAutorizacao(i)) return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", erro: "Documento já possui evidência fiscal; consultar antes de qualquer transmissão." });
    const preparado = await this.porta!.preparar(i, payload);
    if (preparado.documentoId !== i.documentoId || preparado.modelo !== i.modeloDocumento || !preparado.montagemConcluida || preparado.transmissaoPermitida !== false) throw new ErroAdaptadorBrasilNfe();
    const recebido = await this.cliente.enviarNotaFiscal(preparado);
    const resposta = interpretarEnvioFiscalBrasilNfe(recebido, i);
    if (resposta.status === "AUTORIZADO" && (recebido.Base64Xml || recebido.Base64File)) {
      try { await validarArquivosBrasilNfe(recebido, { identidade: i, chave: resposta.chave!, protocolo: resposta.protocolo!, aceitarHtml: true }); }
      catch {
        // Não perder a chave/protocolo validados no retorno por uma falha de
        // arquivo. Conserva a evidência e exige consulta, sem afirmar que o XML
        // foi conferido nem liberar outra transmissão.
        return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", referencia: resposta.referencia, chave: resposta.chave, numero: resposta.numero, serie: resposta.serie, protocolo: resposta.protocolo, erro: "Retorno de autorização recebido, mas arquivos inválidos ou divergentes. Conferir este documento; não reenviar." });
      }
    }
    return resposta;
  }
  async consultar(identidade: IdentidadeFiscalSaida): Promise<RespostaFiscalSaida> {
    const i = await this.autorizar("CONSULTAR", identidade), autorizacao = await this.porta!.obterAutorizacao(i);
    if (autorizacao?.cancelamentoPendente || autorizacao?.protocoloCancelamento) {
      const a = conferirAutorizacaoBrasilNfe(i, autorizacao);
      if (!a.protocoloCancelamento || !this.cliente.obterArquivoEvento) return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", erro: "Cancelamento incerto sem protocolo de evento confirmado; conferir no fornecedor, sem repetir cancelamento." });
      const xml = await this.cliente.obterArquivoEvento({ ChaveNF: a.chave, NuProtocolo: a.protocoloCancelamento, TipoArquivo: 1 });
      validarXmlCancelamentoBrasilNfe(xml, { identidade: i, chave: a.chave, protocoloCancelamento: a.protocoloCancelamento });
      return respostaFiscalBrasilNfe(i, { status: "CANCELADO", referencia: a.chave, chave: a.chave, numero: a.numero, serie: a.serie, protocolo: a.protocolo, protocoloCancelamento: a.protocoloCancelamento }, 135);
    }
    const evidencia = await this.consultarEvidencias(i);
    return interpretarRecuperacaoFiscalBrasilNfe(evidencia, i);
  }
  async cancelar(identidade: IdentidadeFiscalSaida, motivo: string): Promise<RespostaFiscalSaida> {
    exigirTransmissaoBrasilNfeLiberada({ operacao: "CANCELAR" });
    const i = await this.autorizar("CANCELAR", identidade);
    if (!this.cliente.cancelarNotaFiscal) throw new ErroAdaptadorBrasilNfe();
    const atual = await this.porta!.obterAutorizacao(i);
    if (!atual) throw new ErroAdaptadorBrasilNfe();
    const a = conferirAutorizacaoBrasilNfe(i, atual);
    if (a.cancelamentoPendente || a.protocoloCancelamento) return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", erro: "Cancelamento já solicitado ou protocolado; conferir o evento sem repetir transmissão." });
    const r = await this.cliente.cancelarNotaFiscal({ ChaveNF: a.chave, Justificativa: motivo, TipoAmbiente: codigoAmbienteBrasilNfe(i.ambiente), NumeroProtocolo: a.protocolo, TipoDocumento: 0 });
    // Status3 é erro do evento no contrato publicado;501 é rejeição de prazo.
    // Sem protocolo/XML de cancelamento, essa recusa não desfaz a autorização.
    if (r.statusEvento === 3 && r.codigoSefaz === 501 && !r.protocoloCancelamento && !r.Base64Xml)
      return respostaFiscalBrasilNfe(i, { status: "AUTORIZADO", referencia: a.chave, chave: a.chave, numero: a.numero, serie: a.serie, protocolo: a.protocolo,
        erro: `${mensagemCodigoSefaz(501, "CANCELAMENTO")} A nota permanece autorizada.` }, 501);
    if (r.statusEvento !== 1 || r.codigoSefaz !== 135 || r.erroPresente || !r.protocoloCancelamento || !r.numeroSequencialEvento) return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", erro: `${mensagemCodigoSefaz(r.codigoSefaz, "CANCELAMENTO") ?? "O fornecedor não informou um motivo fiscal válido."} Cancelamento não confirmado. Consulte o evento sem repetir a solicitação.` }, r.codigoSefaz);
    try {
      const xml = r.Base64Xml ?? (this.cliente.obterArquivoEvento ? await this.cliente.obterArquivoEvento({ ChaveNF: a.chave, NuProtocolo: r.protocoloCancelamento, TipoArquivo: 1 }) : null);
      if (!xml) throw new ErroAdaptadorBrasilNfe();
      validarXmlCancelamentoBrasilNfe(xml, { identidade: i, chave: a.chave, protocoloCancelamento: r.protocoloCancelamento, numeroSequencialEvento: r.numeroSequencialEvento });
    } catch {
      // Preserva o protocolo observado para posterior consulta apenas desse evento.
      // Erro no download/contrato não comprova cancelamento e não autoriza reenvio.
      return respostaFiscalBrasilNfe(i, { status: "PENDENTE_CONFERENCIA", erro: "Protocolo de evento retornado sem XML verificável; conferência necessária sem reenvio.", protocoloCancelamento: r.protocoloCancelamento }, r.codigoSefaz);
    }
    return respostaFiscalBrasilNfe(i, { status: "CANCELADO", referencia: a.chave, chave: a.chave, numero: a.numero, serie: a.serie, protocolo: a.protocolo, protocoloCancelamento: r.protocoloCancelamento }, 135);
  }
  async obterDocumentos(identidade: IdentidadeFiscalSaida): Promise<{ xml?: string; pdf?: Uint8Array; html?: string; xmlCancelamento?: string }> {
    const i = await this.autorizar("DOCUMENTOS", identidade);
    if (!this.cliente.obterArquivoNotaFiscal) throw new ErroAdaptadorBrasilNfe();
    const atual = await this.porta!.obterAutorizacao(i);
    if (!atual) throw new ErroAdaptadorBrasilNfe();
    const a = conferirAutorizacaoBrasilNfe(i, atual);
    const Base64Xml = await this.cliente.obterArquivoNotaFiscal({ ChaveNF: a.chave, FileType: 1, TipoDocumentoFiscal: 1 });
    // Valida a identidade do XML antes de buscar/aceitar a representação gráfica.
    const xml = await validarArquivosBrasilNfe({ Base64Xml }, { identidade: i, chave: a.chave, protocolo: a.protocolo });
    const Base64File = await this.cliente.obterArquivoNotaFiscal({ ChaveNF: a.chave, FileType: 2, TipoDocumentoFiscal: 1 });
    const impressao = await validarArquivosBrasilNfe({ Base64File }, { identidade: i, chave: a.chave, protocolo: a.protocolo, aceitarHtml: true });
    let xmlCancelamento: string | undefined;
    if (a.protocoloCancelamento) {
      if (!this.cliente.obterArquivoEvento) throw new ErroAdaptadorBrasilNfe();
      xmlCancelamento = validarXmlCancelamentoBrasilNfe(await this.cliente.obterArquivoEvento({ ChaveNF: a.chave, NuProtocolo: a.protocoloCancelamento, TipoArquivo: 1 }), { identidade: i, chave: a.chave, protocoloCancelamento: a.protocoloCancelamento });
    }
    return { ...xml, ...impressao, ...(xmlCancelamento ? { xmlCancelamento } : {}) };
  }
  async autenticarRetorno(corpo: Uint8Array, headers: Headers): Promise<RespostaFiscalSaida | null> { void corpo; void headers; return null; }
}
