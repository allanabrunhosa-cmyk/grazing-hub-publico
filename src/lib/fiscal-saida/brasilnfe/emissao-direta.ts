import "server-only";
import { rejeicaoFiscalCorrigivel } from "../rejeicao";
import type { SessaoAtual } from "@/lib/session";
import { consultarFiscalSaida } from "../servico";
import { consultarEmissaoPedidoBrasilNfe, emitirNotaPedidoBrasilNfe, prepararEmissaoPedidoBrasilNfe, type PendenciaEmissaoPedidoBrasilNfe } from "./operacional";
import { ErroEmissaoPedidoBrasilNfe, type ComandoEmissaoPedidoBrasilNfe } from "./operacional-dominio";

export type EntradaEmissaoDiretaPedidoBrasilNfe = {
  pedidoId: string;
  versaoPedido: number;
  modelo: 55 | 65;
  indicadorPresenca?: 1 | 2 | 3 | 4 | 5 | 9;
  pagamentoCartaoNaoIntegrado?: true;
};
type DocumentoPedido = Awaited<ReturnType<typeof consultarFiscalSaida>>[number];
export type ResultadoEmissaoDiretaPedidoBrasilNfe =
  | { ok: true; documento: DocumentoPedido; conferirAntesDeRepetir: boolean }
  | { erro: string; pendencias: PendenciaEmissaoPedidoBrasilNfe[]; documento: DocumentoPedido | null; conferirAntesDeRepetir: boolean; exigeEscolhaPresenca: boolean; exigeEscolhaCartao: boolean };

function validarPedido(pedidoId: unknown): asserts pedidoId is string {
  if (typeof pedidoId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(pedidoId)) throw new ErroEmissaoPedidoBrasilNfe("Pedido inválido. Reabra o pedido antes de emitir.");
}
function validarEntrada(entrada: unknown): EntradaEmissaoDiretaPedidoBrasilNfe {
  const e = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada as Record<string, unknown> : {};
  validarPedido(e.pedidoId);
  if (Object.keys(e).some(k => !["pedidoId", "versaoPedido", "modelo", "indicadorPresenca", "pagamentoCartaoNaoIntegrado"].includes(k))
    || !Number.isSafeInteger(e.versaoPedido) || (e.versaoPedido as number) < 1 || (e.versaoPedido as number) > 2_147_483_647
    || ![55, 65].includes(e.modelo as number)
    || e.indicadorPresenca !== undefined && ![1, 2, 3, 4, 5, 9].includes(e.indicadorPresenca as number)
    || e.pagamentoCartaoNaoIntegrado !== undefined && (e.pagamentoCartaoNaoIntegrado !== true || e.modelo !== 65)
    || e.modelo === 55 && e.indicadorPresenca === 4) throw new ErroEmissaoPedidoBrasilNfe("Confira a revisão do pedido, o modelo da nota e a presença do comprador. NFC-e com entrega usa o indicador 4; NF-e exige o canal efetivo da venda.");
  return e as EntradaEmissaoDiretaPedidoBrasilNfe;
}
function possuiResultado(documento: DocumentoPedido): boolean {
  return documento.tentativas > 0 || !!documento.referenciaProvedor || !!documento.chaveFiscal || !!documento.protocolo
    || !["SEM_EMISSOR", "PREPARADO"].includes(documento.status)
    || documento.eventos.some(e => ["EMISSAO_MANUAL_AUTORIZADA", "EMISSAO_MANUAL_CONSUMIDA"].includes(e.tipo));
}
function exigeConferencia(documento: DocumentoPedido): boolean {
  // Uma rejeição certa não autoriza reenviar a mesma identidade. Ela permite
  // preparar outra revisão, sem tratar tentativas históricas como incerteza atual.
  return possuiResultado(documento) && !(rejeicaoFiscalCorrigivel(documento));
}

/** Recupera somente o resumo protegido. Nunca prepara, aprova ou transmite. */
export async function obterResultadoLocalEmissaoPedidoBrasilNfe(pedidoId: string, sessao: SessaoAtual) {
  validarPedido(pedidoId);
  const documentos = (await consultarFiscalSaida(pedidoId, sessao)).filter(d => d.ambiente !== "HOMOLOGACAO");
  const resultados = documentos.filter(possuiResultado);
  const bloqueios = resultados.filter(exigeConferencia);
  return { documento: bloqueios[0] ?? resultados[0] ?? documentos[0] ?? null, conferirAntesDeRepetir: bloqueios.length > 0, resultadoAmbiguo: bloqueios.length > 1 };
}

/** Recuperação após perda da resposta: consulta a tentativa existente, sem ENVIAR. */
export async function consultarResultadoEmissaoPedidoBrasilNfe(pedidoId: string, sessao: SessaoAtual) {
  const local = await obterResultadoLocalEmissaoPedidoBrasilNfe(pedidoId, sessao);
  if (!local.documento || !local.conferirAntesDeRepetir) return { ok: true as const, documento: local.documento, conferirAntesDeRepetir: false };
  if (local.resultadoAmbiguo) throw new ErroEmissaoPedidoBrasilNfe("Existe mais de um resultado fiscal produtivo neste pedido. Confira os documentos vinculados antes de qualquer emissão.");
  // Documentos de outro emissor e identidades incompletas continuam somente legíveis.
  if (local.documento.provedor !== "BRASIL_NFE" || local.documento.ambiente !== "PRODUCAO") return { ok: true as const, documento: local.documento, conferirAntesDeRepetir: true };
  const documento = await consultarEmissaoPedidoBrasilNfe(local.documento.id, sessao);
  return { ok: true as const, documento, conferirAntesDeRepetir: exigeConferencia(documento) };
}

/** Um clique autenticado autoriza uma transmissão manual produtiva. Preparação,
 * hashes, revisões, configuração e duplicidade continuam nas guardas existentes.
 * Não aceita ambiente, credenciais, hashes ou autorização arbitrária do cliente. */
export async function emitirNotaPedidoDiretaBrasilNfe(entrada: unknown, sessao: SessaoAtual): Promise<ResultadoEmissaoDiretaPedidoBrasilNfe> {
  const e = validarEntrada(entrada);
  const previa = await prepararEmissaoPedidoBrasilNfe(e.pedidoId, e.versaoPedido, e.modelo, "PRODUCAO", sessao,
    { ...(e.indicadorPresenca === undefined ? {} : { indicadorPresenca: e.indicadorPresenca }), ...(e.pagamentoCartaoNaoIntegrado === true ? { pagamentoCartaoNaoIntegrado: true } : {}) }, { somenteVersoesAtivas: true });
  const pendencias = [...previa.pendencias];
  const exigeEscolhaPresenca = previa.contextoOperacao?.exigeEscolhaPresenca === true;
  const exigeEscolhaCartao = false;
  if (exigeEscolhaPresenca && !pendencias.some(p => p.campo === "indicadorPresenca")) pendencias.push({ campo: "indicadorPresenca", mensagem: "Informe como a venda foi realizada no campo Presença do comprador. Retirada não comprova atendimento presencial.", href: "" });
  const revisao = previa.revisaoConsolidada;
  if (revisao?.pendente) pendencias.push({ campo: "revisaoConsolidada", mensagem: "A configuração fiscal deste produto aguarda aprovação. Revise as classificações e regras fiscais na cobertura fiscal antes de emitir.", href: "/financeiro/fiscal/cobertura" });
  if (!pendencias.length && (!previa.podeEmitir || !previa.documento?.hashPayloadFiscal || !previa.liberacaoTransmissao.liberada || previa.controleManual?.suspensa)) pendencias.push({ campo: "emissao", mensagem: previa.liberacaoTransmissao.motivo ?? previa.controleManual?.motivo ?? "A revisão fiscal não está liberada para emissão. Confira a configuração e o resultado fiscal deste pedido.", href: "/financeiro/fiscal/configuracoes" });
  if (pendencias.length) {
    const local = await obterResultadoLocalEmissaoPedidoBrasilNfe(e.pedidoId, sessao);
    return { erro: "A nota não foi emitida. Corrija os pontos indicados.", pendencias, documento: local.documento, conferirAntesDeRepetir: local.conferirAntesDeRepetir, exigeEscolhaPresenca, exigeEscolhaCartao };
  }
  const comando: ComandoEmissaoPedidoBrasilNfe = {
    documentoId: previa.documento!.id, modelo: e.modelo, ambiente: "PRODUCAO", hashSnapshot: previa.documento!.hashSnapshot,
    hashPayloadFiscal: previa.documento!.hashPayloadFiscal!, total: previa.total, autorizarUmaTransmissao: true, conferenciaSemDocumentoExterno: true,
    ...(previa.contextoOperacao?.indicadorPresenca == null ? {} : { indicadorPresenca: previa.contextoOperacao.indicadorPresenca }),
  };
  const documento = await emitirNotaPedidoBrasilNfe(comando, sessao);
  return { ok: true, documento, conferirAntesDeRepetir: exigeConferencia(documento) };
}
