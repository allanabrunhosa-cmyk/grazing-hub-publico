import "server-only";
import { createHash } from "node:crypto";
import { Decimal } from "@prisma/client/runtime/client";
import type { Prisma } from "@/generated/prisma/client";
import type { AdaptadorFiscalSaida, IdentidadeFiscalSaida, RespostaFiscalSaida } from "./contrato";
import type { ConfiguracaoBrasilNfe, DocumentoBrasilNfe, SnapshotTributacaoBrasilNfe } from "./brasil-nfe-contrato";
import { dataFiscal, hojeFiscal } from "@/lib/tributacao/validacao";
import { gtinValido } from "@/lib/tributacao/gtin";
import { conferirFciFiscal, NUMERO_FCI_FISCAL } from "@/lib/tributacao/fci";
import { validarLayoutRtc, type SnapshotLayoutRtc } from "@/lib/tributacao/layout-rtc";
import { exigirTransmissaoBrasilNfeLiberada } from "./brasilnfe/bloqueio-transmissao";
import { PADRAO_DESCRICAO_PRODUTO_NFE } from "./brasilnfe/texto-xml";

const BASE = "https://api.brasilnfe.com.br/services/";
const LIMITE_RESPOSTA = 20 * 1024 * 1024;
const CODIGOS_AUTORIZACAO = new Set([100, 150]);
const CODIGOS_CANCELAMENTO = new Set([101, 135, 155]);
const CODIGOS_PROCESSANDO = new Set([103, 105]);
const CSOSN = new Set(["101", "102", "103", "201", "202", "203", "300", "400", "500", "900"]);
const CST = new Set(["00", "10", "20", "30", "40", "41", "50", "51", "60", "70", "90"]);
const decimalCampos = new Set(["Quantidade", "QuantidadeTributavel", "ValorUnitario", "ValorUnitarioTributavel", "ValorTotal", "ValorDesconto", "ValorFrete", "ValorSeguro", "ValorOutrasDespesas", "VlPago", "VlTroco", "BaseCalculo", "BaseCalculoFCP", "BaseCalculoFCPST", "ValorIcms", "AliquotaICMS", "AliquotaICMSST", "AliquotaMVA", "AliquotaCredito", "RedICMS", "RedICMSST", "AliquotaFCP", "AliquotaFCPST", "Aliquota", "AliquotaIBSUF", "AliquotaIBSMun", "AliquotaCBS", "PercentualReducaoIBS", "PercentualReducaoCBS", "PercentualDiferimento"]);
type Registro = Record<string, unknown>;
/** Somente mensagens locais. Não recebe corpo, credencial ou erro livre do provedor. */
export class ErroValidacaoSnapshotBrasilNfe extends Error {
  constructor(mensagem: string) { super(mensagem); this.name = "ErroValidacaoSnapshotBrasilNfe"; }
}
function objeto(v: unknown, campo = "Estrutura fiscal"): Registro {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new ErroValidacaoSnapshotBrasilNfe(`${campo} ausente ou inválida.`);
  return v as Registro;
}
function texto(v: unknown, tamanho: number, regex?: RegExp, campo = "Campo fiscal"): string {
  if (v == null || v === "") throw new ErroValidacaoSnapshotBrasilNfe(`${campo} não informado. Complete o cadastro fiscal correspondente.`);
  if (typeof v !== "string" || !v.trim() || v.length > tamanho || /[\u0000-\u001f]/.test(v) || regex && !regex.test(v)) throw new ErroValidacaoSnapshotBrasilNfe(`${campo} inválido. Confira o formato e o tamanho do campo.`);
  return v;
}
function inscricaoEstadual(v: unknown): string {
  if (typeof v !== "string" || v.length > 30) throw new ErroValidacaoSnapshotBrasilNfe("Inscrição estadual do emitente inválida no snapshot fiscal.");
  const ie = v.replace(/[.\s/-]/g, "");
  if (!/^\d{2,14}$/.test(ie)) throw new ErroValidacaoSnapshotBrasilNfe("Inscrição estadual do emitente inválida no snapshot fiscal.");
  return ie;
}
function dec(v: unknown, casas = 10, campo = "Valor fiscal"): Decimal {
  if (!(typeof v === "string" || typeof v === "number") || !new RegExp(`^\\d{1,12}(\\.\\d{1,${casas}})?$`).test(String(v))) throw new ErroValidacaoSnapshotBrasilNfe(`Precisão fiscal inválida em ${campo}. Informe um valor não negativo com até ${casas} casas decimais.`);
  return new Decimal(v);
}
function lista(v: unknown, maximo: number, campo = "Lista fiscal"): unknown[] {
  if (!Array.isArray(v) || !v.length || v.length > maximo) throw new ErroValidacaoSnapshotBrasilNfe(`${campo}: informe de 1 a ${maximo} registros fiscais válidos.`);
  return v;
}
function hash(v: unknown) { return createHash("sha256").update(JSON.stringify(v)).digest("hex"); }
function ambiente(c: Pick<ConfiguracaoBrasilNfe, "ambiente">) { return c.ambiente === "PRODUCAO" ? 1 : 2; }
function identidadeValida(i: IdentidadeFiscalSaida, c: ConfiguracaoBrasilNfe) {
  texto(i.documentoId, 100, /^[a-zA-Z0-9_-]+$/);
  if (i.ambiente !== c.ambiente || i.chaveIdempotencia !== i.documentoId) throw new Error("Identidade fiscal divergente.");
}
function conferirChave(chave: unknown, c: ConfiguracaoBrasilNfe, modelo?: unknown) {
  const s = texto(chave, 44, /^\d{44}$/);
  if (s.slice(6, 20) !== c.cnpj || !["55", "65"].includes(s.slice(20, 22)) || modelo !== undefined && s.slice(20, 22) !== String(modelo)) throw new Error("Chave fiscal fora do estabelecimento ou modelo.");
  return s;
}
function normalizarDecimais(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizarDecimais);
  if (!v || typeof v !== "object") return v;
  return Object.fromEntries(Object.entries(v).map(([k, valor]) => [k, decimalCampos.has(k) ? dec(valor).toNumber() : normalizarDecimais(valor)]));
}

/** Não resolve impostos nem utiliza modelos automáticos do provedor. */
export function validarSnapshotBrasilNfe(payload: Prisma.JsonValue, c: Pick<ConfiguracaoBrasilNfe, "cnpj" | "ambiente"> & Partial<Omit<ConfiguracaoBrasilNfe, "cnpj" | "ambiente">> & { somentePrevia?: boolean }): SnapshotTributacaoBrasilNfe {
  const p = objeto(payload), t = objeto(p.tributacao), d = objeto(t.documento);
  if (c.somentePrevia !== true && c.ambiente === "PRODUCAO" && (t.revisaoConsolidada !== undefined || t.previa && typeof t.previa === "object" && !Array.isArray(t.previa) && "revisaoConsolidada" in t.previa)) throw new ErroValidacaoSnapshotBrasilNfe("Produção exige recálculo com versões ativas após aprovação interna; propostas de revisão não autorizam envio.");
  if (["Serie", "Numero", "Lote"].some(campo => Object.hasOwn(d, campo))) throw new ErroValidacaoSnapshotBrasilNfe("Numeração automática Brasil NFe exige omitir Serie, Numero e Lote. Não enviar contador ou reservar número local.");
  if (p.schema !== "grazing.fiscal-saida" || p.versao !== 2 || t.apto !== true || !Array.isArray(t.pendencias) || t.pendencias.length || t.emitenteCnpj !== c.cnpj || ![1, 2, 3, 4].includes(t.crt as number)) throw new ErroValidacaoSnapshotBrasilNfe("Solicitação exige cálculo servidor sem pendências fiscais.");
  if (t.emitenteIE !== undefined) inscricaoEstadual(t.emitenteIE);
  if (![55, 65].includes(d.ModeloDocumento as number) || d.TipoAmbiente !== ambiente(c) || d.Finalidade !== 1 || ![0, 1, 2, 3, 4, 5, 9].includes(d.IndicadorPresenca as number) || typeof d.ConsumidorFinal !== "boolean") throw new ErroValidacaoSnapshotBrasilNfe("Modelo, ambiente ou operação fiscal inválida.");
  texto(d.NaturezaOperacao, 60, undefined, "Natureza da operação");
  const valores = objeto(p.valores);
  const total = dec(d.ValorTotal, 2);
  if (!total.equals(dec(valores.total, 2))) throw new ErroValidacaoSnapshotBrasilNfe("Total fiscal diverge do pedido fotografado.");
  let calculado = new Decimal(0);
  for (const [indice, entrada] of lista(d.Produtos, 990, "Produtos da nota").entries()) {
    const nome = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? (entrada as Registro).NmProduto : null;
    const referencia = typeof nome === "string" && nome.trim() && nome.length <= 120 && !/[\p{C}<>]/u.test(nome) ? `Produto ${indice + 1} (${nome.trim()})` : `Produto ${indice + 1}`;
    try {
      const produto = objeto(entrada), imposto = objeto(produto.Imposto, "Configuração dos tributos"), icms = objeto(imposto.ICMS, "Configuração de ICMS");
      texto(produto.NmProduto, 120, PADRAO_DESCRICAO_PRODUTO_NFE, "Descrição fiscal (xProd; caracteres compatíveis com o XML)"); texto(produto.CodProdutoServico, 60, undefined, "Código do produto");
      texto(produto.NCM, 8, /^\d{8}$/, "NCM (8 dígitos)");
      if (!gtinValido(produto.EAN)) throw new ErroValidacaoSnapshotBrasilNfe("GTIN da unidade vendida ausente ou inválido. Corrija o código e o dígito verificador, ou confirme a declaração SEM GTIN na classificação fiscal.");
      if (produto.CEST !== undefined) texto(produto.CEST, 7, /^\d{7}$/, "CEST (7 dígitos)");
      texto(produto.UnidadeComercial, 6, undefined, "Unidade comercial"); texto(produto.UnidadeComercialTributavel, 6, undefined, "Unidade tributável");
      if (!Number.isInteger(produto.OrigemProduto) || Number(produto.OrigemProduto) < 0 || Number(produto.OrigemProduto) > 8) throw new ErroValidacaoSnapshotBrasilNfe("Origem da mercadoria ausente ou inválida. Confira a classificação fiscal do produto.");
      if (!Number.isInteger(produto.CFOP) || !/^[567]\d{3}$/.test(String(produto.CFOP))) throw new ErroValidacaoSnapshotBrasilNfe("CFOP de saída ausente ou inválido. Confira a regra fiscal do produto para esta operação.");
      if (produto.nFCI !== undefined && (typeof produto.nFCI !== "string" || !NUMERO_FCI_FISCAL.test(produto.nFCI))) throw new ErroValidacaoSnapshotBrasilNfe("Número de controle FCI fora do formato oficial.");
      const previaFci = t.previa === undefined ? null : objeto(t.previa), linhasFci = previaFci?.linhas;
      const linhaFci = Array.isArray(linhasFci) && linhasFci[indice] !== undefined ? objeto(linhasFci[indice]) : null;
      if ([3, 5, 8].includes(Number(produto.OrigemProduto)) || produto.nFCI !== undefined || linhaFci?.fci !== undefined) {
        const contextoFci = previaFci ? objeto(previaFci.contexto) : {};
        const versaoClassificacao = linhaFci?.classificacaoVersao === undefined ? {} : objeto(linhaFci.classificacaoVersao);
        const fci = conferirFciFiscal(String(produto.OrigemProduto), linhaFci?.fci, { data: typeof contextoFci.data === "string" ? contextoFci.data : "", ufEmitente: typeof t.emitenteUf === "string" ? t.emitenteUf : "", ufDestino: typeof contextoFci.ufDestino === "string" ? contextoFci.ufDestino : "", modelo: String(d.ModeloDocumento) as "55" | "65",
          produtoId: typeof linhaFci?.produtoId === "string" ? linhaFci.produtoId : undefined, estabelecimento: typeof contextoFci.estabelecimento === "string" ? contextoFci.estabelecimento : undefined, emitenteCnpj: c.cnpj, gtin: typeof produto.EAN === "string" ? produto.EAN : undefined, ambiente: c.ambiente,
          classificacaoVersaoId: typeof versaoClassificacao.id === "string" ? versaoClassificacao.id : undefined, classificacaoVersaoNumero: typeof versaoClassificacao.versao === "number" ? versaoClassificacao.versao : undefined, materiaisHash: typeof versaoClassificacao.materiaisHash === "string" ? versaoClassificacao.materiaisHash : undefined,
          natureza: versaoClassificacao.natureza === "REVENDA" || versaoClassificacao.natureza === "FRACIONADO" ? versaoClassificacao.natureza : undefined, ncm: String(produto.NCM) });
        if (linhaFci?.produtoId !== produto.CodProdutoServico || fci.pendencias.length || fci.numero !== (produto.nFCI ?? null)) throw new ErroValidacaoSnapshotBrasilNfe("Conteúdo de importação, decisão FCI e item calculado exigem comprovação coerente.");
      }
      const situacao = texto(icms.CodSituacaoTributaria, 3, undefined, t.crt === 1 || t.crt === 4 ? "CSOSN do ICMS" : "CST do ICMS");
      if (!(t.crt === 1 || t.crt === 4 ? CSOSN : CST).has(situacao)) throw new ErroValidacaoSnapshotBrasilNfe("ICMS incompatível com CRT do emitente. Confira o CST/CSOSN do produto e o regime tributário da empresa.");
      for (const tributo of ["PIS", "COFINS"]) texto(objeto(imposto[tributo], `Configuração de ${tributo}`).CodSituacaoTributaria, 2, /^\d{2}$/, `CST do ${tributo}`);
      if (produto.CodTributacao !== undefined) throw new ErroValidacaoSnapshotBrasilNfe("Modelos tributários automáticos do emissor não substituem o cálculo servidor.");
      if (imposto.IBSCBS) texto(objeto(imposto.IBSCBS).CodClassificacaoTributaria, 6, /^\d{6}$/);
      const quantidade = dec(produto.Quantidade, 6, "Quantidade comercial"), tributavel = dec(produto.QuantidadeTributavel, 6, "Quantidade tributável"), unitario = dec(produto.ValorUnitario, 10, "Preço unitário comercial"), unitarioTributavel = dec(produto.ValorUnitarioTributavel, 10, "Preço unitário tributável"), bruto = dec(produto.ValorTotal, 2, "Total do item");
      if ([quantidade, tributavel].some(q => q.decimalPlaces() > 4 || q.gte("100000000000"))) throw new ErroValidacaoSnapshotBrasilNfe("Quantidade fiscal exige até 11 inteiros e 4 casas decimais; não arredondar quantidade comercial.");
      if ([unitario, unitarioTributavel].some(v => v.gte("100000000000"))) throw new ErroValidacaoSnapshotBrasilNfe("Valor unitário fiscal exige até 11 inteiros e 10 casas decimais; preservar o preço comercial.");
      if ([unitario, unitarioTributavel].some(v => !new Decimal(String(v.toNumber())).equals(v))) throw new ErroValidacaoSnapshotBrasilNfe("Valor unitário fiscal não representável no contrato numérico do provedor; preservar o preço comercial.");
      if (produto.UnidadeComercial !== produto.UnidadeComercialTributavel || !quantidade.equals(tributavel)) throw new ErroValidacaoSnapshotBrasilNfe("Conversão entre unidades comercial e tributável exige contrato e GTIN específicos comprovados.");
      if (quantidade.lte(0) || !quantidade.mul(unitario).toDecimalPlaces(2).equals(bruto) || !tributavel.mul(unitarioTributavel).toDecimalPlaces(2).equals(bruto)) throw new ErroValidacaoSnapshotBrasilNfe("Quantidade, preço e total do item fiscal divergem.");
      const desconto = dec(produto.ValorDesconto ?? 0, 2);
      if (desconto.gt(bruto)) throw new ErroValidacaoSnapshotBrasilNfe("Desconto fiscal supera o item.");
      calculado = calculado.add(bruto).sub(desconto).add(dec(produto.ValorFrete ?? 0, 2)).add(dec(produto.ValorSeguro ?? 0, 2)).add(dec(produto.ValorOutrasDespesas ?? 0, 2));
    } catch (erro) {
      if (erro instanceof ErroValidacaoSnapshotBrasilNfe) throw new ErroValidacaoSnapshotBrasilNfe(`${referencia}: ${erro.message}`);
      throw erro;
    }
  }
  if (!calculado.equals(total)) throw new ErroValidacaoSnapshotBrasilNfe("Total dos itens fiscais não fecha com o pedido; tributos adicionais exigem cálculo explícito compatível.");
  const dataEmissao = t.previa === undefined ? null : dataFiscal(objeto(objeto(t.previa).contexto).data);
  if (t.rtc2027 !== undefined && (!dataEmissao || dataEmissao < "2027-01-01")) throw new ErroValidacaoSnapshotBrasilNfe("Leiaute RTC 2027 exige data canônica de 2027 ou posterior; não antecipar o regime.");
  if (dataEmissao && dataEmissao >= "2027-01-01") {
    if (!t.rtc2027) throw new ErroValidacaoSnapshotBrasilNfe("Leiaute RTC 2027 exige decomposição e homologação comprovadas no snapshot.");
    validarLayoutRtc(d, objeto(t.rtc2027) as unknown as SnapshotLayoutRtc);
  }
  const pagamentos = lista(d.Pagamentos, 100, "Pagamentos da nota");
  let pago = new Decimal(0);
  for (const entrada of pagamentos) {
    const pagamento = objeto(entrada, "Configuração de pagamento"); texto(pagamento.FormaPagamento, 2, /^\d{2}$/, "Código SEFAZ da forma de pagamento");
    if (pagamento.TipoIntegracao !== undefined && typeof pagamento.TipoIntegracao !== "boolean") throw new ErroValidacaoSnapshotBrasilNfe("Pagamento: tipo de integração do cartão inválido. Confirme se o pagamento ocorreu fora do HUB ou por integração.");
    if (["03", "04"].includes(String(pagamento.FormaPagamento)) && pagamento.TipoIntegracao === true) {
      texto(pagamento.CNPJCredenciadora, 14, /^\d{14}$/, "CNPJ da credenciadora do cartão integrado");
      texto(pagamento.NumeroAutorizacao, 128, /^[A-Za-z0-9_-]+$/, "Autorização da transação do cartão integrado");
    }
    pago = pago.add(dec(pagamento.VlPago, 2)).sub(dec(pagamento.VlTroco ?? 0, 2));
  }
  const semPagamento = pagamentos.length === 1 && objeto(pagamentos[0]).FormaPagamento === "90" && pago.isZero();
  if (!semPagamento && !pago.equals(total)) throw new ErroValidacaoSnapshotBrasilNfe("Pagamentos fiscais não fecham com o documento.");
  if (d.ModeloDocumento === 55 || d.IndicadorPresenca === 4) {
    const cliente = objeto(d.Cliente, "Identificação do destinatário"), e = objeto(cliente.Endereco, "Configuração do endereço do destinatário");
    texto(cliente.CpfCnpj, 14, /^(?:\d{11}|\d{14})$/, "CPF/CNPJ do destinatário"); texto(cliente.NmCliente, 60, undefined, "Nome/razão social do destinatário");
    if (![1, 2, 9].includes(Number(cliente.IndicadorIe))) throw new ErroValidacaoSnapshotBrasilNfe("Indicador de IE ausente.");
    texto(e.Cep, 8, /^\d{8}$/, "CEP do destinatário"); texto(e.Logradouro, 60, undefined, "Logradouro do destinatário"); texto(e.Numero, 60, undefined, "Número do endereço do destinatário"); texto(e.Bairro, 60, undefined, "Bairro do destinatário"); texto(e.Municipio, 60, undefined, "Município do destinatário"); texto(e.CodMunicipio, 7, /^\d{7}$/, "Código IBGE do município do destinatário"); texto(e.Uf, 2, /^[A-Z]{2}$/, "UF do destinatário");
  }
  return t as SnapshotTributacaoBrasilNfe;
}

/** Consulta por identificador não promete idempotência externa: a própria API admite
 * várias tentativas no histórico. Multiplicidade exige conferência, nunca reenvio. */
export function criarAdaptadorBrasilNfe(c: ConfiguracaoBrasilNfe, transporte: typeof fetch = fetch): AdaptadorFiscalSaida {
  texto(c.token, 2000, /^\S+$/); texto(c.userToken, 2000, /^\S+$/); texto(c.cnpj, 14, /^\d{14}$/);
  if (!["HOMOLOGACAO", "PRODUCAO"].includes(c.ambiente) || !c.consultaIdentificadorValidada || !c.homologacaoReferencia.trim()) throw new Error("Brasil NFe exige registro técnico de homologação e consulta por identificador validada.");
  async function requisitar(servico: "fiscal" | "empresa", metodo: string, corpo?: unknown): Promise<unknown> {
    if (["EnviarNotaFiscal", "CancelarNotaFiscal", "PreVisualizarNotaFiscal"].includes(metodo)) exigirTransmissaoBrasilNfeLiberada({ canal: "LEGADO" });
    try {
      const resposta = await transporte(`${BASE}${servico}/${metodo}`, { method: "POST", headers: { "Content-Type": "application/json", Token: c.token, ...(servico === "empresa" ? { UserToken: c.userToken } : {}) }, ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }), signal: AbortSignal.timeout(25000), redirect: "error", cache: "no-store" });
      if (!resposta.ok || !resposta.headers.get("content-type")?.toLowerCase().includes("application/json") || Number(resposta.headers.get("content-length") ?? 0) > LIMITE_RESPOSTA || !resposta.body) throw new Error();
      const partes: Uint8Array[] = []; let tamanho = 0; const leitor = resposta.body.getReader();
      while (true) { const parte = await leitor.read(); if (parte.done) break; tamanho += parte.value.byteLength; if (tamanho > LIMITE_RESPOSTA) { await leitor.cancel(); throw new Error(); } partes.push(parte.value); }
      return JSON.parse(Buffer.concat(partes).toString("utf8")) as unknown;
    } catch { throw new Error("Brasil NFe: resposta não confirmada; consultar antes de novo envio."); }
  }
  async function empresa(crt: unknown, ie?: string) {
    const e = objeto(await requisitar("empresa", "BuscarEmpresa"));
    const cnpjRetornado = typeof e.CNPJ === "string" ? e.CNPJ.replace(/[.\s/-]/g, "") : "";
    if (cnpjRetornado !== c.cnpj || e.CRT !== crt) throw new Error("Cadastro do emitente no Brasil NFe diverge do snapshot tributário.");
    if (ie !== undefined) {
      const ieRetornada = typeof e.IE === "string" && e.IE.length <= 30 ? e.IE.replace(/[.\s/-]/g, "") : "";
      if (!/^\d{2,14}$/.test(ieRetornada) || ieRetornada !== inscricaoEstadual(ie)) throw new Error("Inscrição estadual do emitente no Brasil NFe diverge do snapshot tributário; conferir o cadastro antes de emitir.");
    }
  }
  function retorno(i: IdentidadeFiscalSaida, status: RespostaFiscalSaida["status"], dados: Partial<Omit<RespostaFiscalSaida, "documentoId" | "eventoId" | "sequencia" | "ordenacao" | "status">> = {}): RespostaFiscalSaida {
    // API síncrona não fornece sequência global: ordenar as observações autenticadas
    // pelo documento local. A máquina de estados protege regressões após autorização.
    const sequencia = (i.ultimaSequencia ?? -1) + 1;
    if (!Number.isSafeInteger(sequencia) || sequencia < 0 || sequencia > 2147483647) throw new Error("Sequência fiscal local inválida.");
    return { documentoId: i.documentoId, status, sequencia, eventoId: `brasil:${hash([i.documentoId, status, sequencia, dados])}`, ...dados };
  }
  function normalizarNota(i: IdentidadeFiscalSaida, n: Registro): RespostaFiscalSaida {
    if (n.CodTipoAmbiente !== ambiente(c) || ![55, 65].includes(Number(n.ModeloDocumento)) || n.IdentificadorInterno !== i.documentoId) throw new Error("Documento retornado fora da identidade fiscal.");
    const codigo = Number(n.CodStatusResposta);
    if (n.Status === 2 || CODIGOS_CANCELAMENTO.has(codigo)) {
      // Consulta genérica pode trazer protocolo da autorização: exigir conferência do evento.
      throw new Error("Cancelamento encontrado; confirmar protocolo do evento fiscal antes de registrar.");
    }
    if (CODIGOS_AUTORIZACAO.has(codigo) && n.Status === 1 && n.Emitida === true) {
      const chave = conferirChave(n.Chave, c, n.ModeloDocumento);
      return retorno(i, "AUTORIZADO", { referencia: chave, chave, numero: texto(String(n.Numero), 20, /^\d+$/), serie: texto(String(n.Serie), 3, /^\d+$/), protocolo: texto(n.NumeroProtocolo, 30, /^\d+$/) });
    }
    if (CODIGOS_PROCESSANDO.has(codigo)) return retorno(i, "PROCESSANDO");
    // Ausência de código oficial, denegação ou duplicidade não autorizam reenvio.
    if (Number.isInteger(codigo) && codigo >= 200 && ![204, 205, 539].includes(codigo)) return retorno(i, "REJEITADO", { erro: `Brasil NFe: rejeição SEFAZ ${codigo}. Consulte o cadastro e a evidência técnica.` });
    throw new Error("Situação fiscal não conclusiva; conferência necessária.");
  }
  async function consulta(i: IdentidadeFiscalSaida, arquivos = false): Promise<{ resposta: RespostaFiscalSaida; nota?: Registro }> {
    identidadeValida(i, c);
    const r = objeto(await requisitar("fiscal", "ConsultarNotaFiscal", { IdentificadorInterno: i.documentoId, TipoAmbiente: ambiente(c), RetornarArquivos: arquivos }));
    const historicoVazio = Array.isArray(r.Historico) && !r.Historico.length;
    const errosVazios = Array.isArray(r.erros) && !r.erros.length;
    // Contrato efetivo confirmado em duas consultas de homologação: BR0008 é
    // ausência com eco exato do identificador, diferente de falha genérica HTTP.
    const erroAusencia = Array.isArray(r.erros) && r.erros.length === 1 ? objeto(r.erros[0]) : null;
    const ausenciaBr0008 = r.status === 1 && erroAusencia?.codigo === "BR0008" && erroAusencia.descricao === `Nenhum documento localizado para o IdentificadorInterno '${i.documentoId}'.` && (erroAusencia.correcao == null || erroAusencia.correcao === "");
    if (r.Encontrada === false && r.Nota === null && historicoVazio && !r.Error && (r.status === 0 && errosVazios || ausenciaBr0008)) return { resposta: retorno(i, "NAO_ENCONTRADO") };
    if (![0, 1].includes(r.status as number) || !errosVazios || !historicoVazio || r.Error) throw new Error("Consulta fiscal falhou ou encontrou múltiplas tentativas; conferir emissor.");
    if (r.Encontrada !== true) throw new Error("Ausência fiscal não comprovada.");
    const nota = objeto(r.Nota); const resposta = normalizarNota(i, nota);
    if (i.referencia && resposta.referencia && i.referencia !== resposta.referencia) throw new Error("Chave do documento retornado diverge da referência preservada.");
    return { resposta, nota };
  }
  function documentos(r: Registro) {
    const resultado: { xml?: string; pdf?: Uint8Array } = {};
    function arquivo(v: unknown, limite: number) {
      const s = texto(v, Math.ceil(limite * 4 / 3) + 8, /^[A-Za-z0-9+/]+={0,2}$/);
      const b = Buffer.from(s, "base64"); if (b.length > limite || b.toString("base64") !== s) throw new Error("Arquivo fiscal inválido."); return b;
    }
    if (r.Base64Xml) { const b = arquivo(r.Base64Xml, 2 * 1024 * 1024); const xml = b.toString("utf8"); if (!xml.trim().startsWith("<") || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML fiscal inválido."); resultado.xml = xml; }
    if (r.Base64File) { const b = arquivo(r.Base64File, 10 * 1024 * 1024); if (b.subarray(0, 5).toString() !== "%PDF-") throw new Error("Documento auxiliar retornado não é PDF; NFC-e HTML requer representação específica."); resultado.pdf = b; }
    if (!resultado.xml && !resultado.pdf) throw new Error("Emissor não devolveu arquivos fiscais.");
    return resultado;
  }
  function documento(i: IdentidadeFiscalSaida, p: Prisma.JsonValue) {
    identidadeValida(i, c); const t = validarSnapshotBrasilNfe(p, c);
    const d = { ...normalizarDecimais(t.documento) as DocumentoBrasilNfe, IdentificadorInterno: i.documentoId, EnviarEmail: false };
    return { t, d };
  }
  function transmissaoPermitida() { exigirTransmissaoBrasilNfeLiberada({ canal: "LEGADO" }); if (c.ambiente === "PRODUCAO" && !c.producaoAutorizada) throw new Error("Transmissão fiscal real não autorizada. Prévia e consulta continuam disponíveis."); }
  return {
    id: "BRASIL_NFE", ambiente: c.ambiente,
    async enviar(i, p) {
      transmissaoPermitida(); const { t, d } = documento(i, p);
      const previa = objeto(objeto(p).tributacao), contexto = objeto(objeto(previa.previa).contexto);
      if (dataFiscal(contexto.data) !== hojeFiscal()) throw new Error("Vigência da prévia fiscal mudou; preparar nova revisão fiscal antes de transmitir.");
      await empresa(t.crt, t.emitenteIE);
      const anterior = await consulta(i);
      if (anterior.resposta.status !== "NAO_ENCONTRADO") return anterior.resposta;
      const r = objeto(await requisitar("fiscal", "EnviarNotaFiscal", d)), n = objeto(r.ReturnNF);
      if (r.Error || n.CodTipoAmbiente !== ambiente(c)) throw new Error("Resultado fiscal inconclusivo; consulte o emissor.");
      const codigo = Number(n.CodStatusRespostaSefaz);
      if (CODIGOS_AUTORIZACAO.has(codigo) && n.Ok === true) {
        const chave = conferirChave(n.ChaveNF, c, d.ModeloDocumento);
        return retorno(i, "AUTORIZADO", { referencia: chave, chave, numero: texto(String(n.Numero), 20, /^\d+$/), serie: texto(String(n.Serie), 3, /^\d+$/), protocolo: texto(n.NumeroProtocolo, 30, /^\d+$/) });
      }
      if (CODIGOS_PROCESSANDO.has(codigo)) return retorno(i, "PROCESSANDO");
      if (Number.isInteger(codigo) && codigo >= 200 && ![204, 205, 539].includes(codigo)) return retorno(i, "REJEITADO", { erro: `Brasil NFe: rejeição SEFAZ ${codigo}. Consulte o cadastro e a evidência técnica.` });
      throw new Error("Resultado fiscal inconclusivo; consulte o emissor.");
    },
    async consultar(i) { return (await consulta(i)).resposta; },
    async cancelar(i, motivo) {
      transmissaoPermitida(); texto(motivo, 1000); if (motivo.trim().length < 15) throw new Error("Justificativa fiscal insuficiente.");
      const anterior = (await consulta(i)).resposta;
      if (anterior.status !== "AUTORIZADO" || !anterior.chave) throw new Error("Cancelamento exige autorização fiscal confirmada.");
      const r = objeto(await requisitar("fiscal", "CancelarNotaFiscal", { ChaveNF: anterior.chave, Justificativa: motivo.trim(), TipoAmbiente: ambiente(c), TipoDocumento: 0, NumeroProtocolo: anterior.protocolo }));
      if (r.Error || r.Status !== 1 || !CODIGOS_CANCELAMENTO.has(Number(r.CodStatusRespostaSefaz))) throw new Error("Cancelamento não confirmado; autorização original preservada.");
      const protocoloEvento = texto(r.NuProtocolo, 30, /^\d+$/);
      return retorno(i, "CANCELADO", { referencia: anterior.referencia, chave: anterior.chave, numero: anterior.numero, serie: anterior.serie, protocolo: anterior.protocolo, protocoloEvento });
    },
    async obterDocumentos(i) { const r = await consulta(i, true); if (r.resposta.status !== "AUTORIZADO" || !r.nota) throw new Error("Arquivos exigem documento autorizado e identidade confirmada."); return documentos(r.nota); },
    async preVisualizar(i, p) {
      exigirTransmissaoBrasilNfeLiberada({ canal: "LEGADO" });
      const { t, d } = documento(i, p); await empresa(t.crt, t.emitenteIE);
      const r = objeto(await requisitar("fiscal", "PreVisualizarNotaFiscal", { TipoEnvio: 1, TipoArquivo: 2, mostrarTarjaPreVisualizacao: true, notaFiscal: { TipoAmbiente: d.TipoAmbiente, ModeloDocumento: d.ModeloDocumento, nFInfos: [d] } }));
      if (r.Status !== true || r.Error) throw new Error("Pré-visualização fiscal não confirmada.");
      return documentos(r);
    },
    // EnviarNotaFiscal síncrono não dispara webhook; não aceitar callback inventado.
    async autenticarRetorno() { return null; },
  };
}
