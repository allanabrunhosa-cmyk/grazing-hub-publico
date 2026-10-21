import "server-only";
import { pendenciaCsosnNaoContribuinte } from "@/lib/fiscal-saida/brasilnfe/csosn-nao-contribuinte";
import { apresentacaoCanalVenda } from "@/lib/vendas/canais-apresentacao";
import { descricaoProdutoNfe } from "@/lib/fiscal-saida/brasilnfe/texto-xml";
import { identidadeFiscalCobranca } from "@/lib/vendas/cliente-cobranca";
import { Prisma } from "@/generated/prisma/client";
import type { SessaoAtual } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import type { DocumentoBrasilNfe, SnapshotTributacaoBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-contrato";
import { resolverDestinatarioBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-destinatario";
import { traduzirImpostosBrasilNfe } from "@/lib/fiscal-saida/brasil-nfe-impostos";
import { calcularTributacao, ratearFiscal, valorFiscal, versoesVigentes } from "./motor";
import { conferirAutorFiscal, consultarVersoesFiscais } from "./servico";
import { hojeFiscal } from "./validacao";
import { aplicarLayoutRtc, layoutRtcComprovado, type SnapshotLayoutRtc } from "./layout-rtc";
import { selecionarVersoesRevisaoConsolidada, type VersaoSelecionadaRevisaoFiscal } from "./revisao-consolidada";
import { fotografarClassificacaoNormal, fotografarMercadoriaOpcao, fotografarReceitaFiscal, receitaDoSnapshot, type FotografiaReceitaFiscal } from "./fotografia-tecnica";
import type { ClassificacaoFiscal, ComportamentoFiscal, ComprovacaoFisicaFiscal, FotografiaKitFiscal, ItemComercialFiscal, MateriaisFiscaisFotografados, PerfilFiscal, PreviaTributacao, ReceitaFiscalDocumentadaSnapshot } from "./tipos";
type PedidoFiscal = Prisma.PedidoVendaGetPayload<{ include: { itens: true } }>;
type EscolhaSnapshot = { opcaoId: string; grupoId?: string; produtoId: string | null; opcaoNome: string; quantidade: number; multiplicador?: string; preco: string; unidadeProduto?: string; modoPreparoProduto?: string | null; composicaoFiscalComprovada?: boolean };
export type OpcoesOperacaoFiscal = { consumidorFinal?: boolean; indicadorIe?: 1 | 2 | 9; indicadorPresenca?: 0 | 1 | 2 | 3 | 4 | 5 | 9; ambiente?: "HOMOLOGACAO" | "PRODUCAO"; pagamentoCartaoNaoIntegrado?: true };
/** Usa o canal fotografado no fechamento, sem consultar o nome atual do cadastro.
 * NFC-e com entrega conserva o indicador específico 4. */
export function presencaAutomaticaPedido(p: Pick<PedidoFiscal, "atendimento" | "canalNomeSnapshot">, modelo: "55" | "65") {
  if (modelo === "65" && p.atendimento === "ENTREGA") return 4;
  return apresentacaoCanalVenda(p.canalNomeSnapshot).conhecido === "site" ? 2 : undefined;
}
function validarOpcoes(v: OpcoesOperacaoFiscal) {
  if (!v || typeof v !== "object" || v.consumidorFinal !== undefined && typeof v.consumidorFinal !== "boolean" || v.indicadorIe !== undefined && ![1, 2, 9].includes(v.indicadorIe) || v.indicadorPresenca !== undefined && ![0, 1, 2, 3, 4, 5, 9].includes(v.indicadorPresenca) || v.ambiente !== undefined && !["HOMOLOGACAO", "PRODUCAO"].includes(v.ambiente) || v.pagamentoCartaoNaoIntegrado !== undefined && v.pagamentoCartaoNaoIntegrado !== true) throw new ErroPedidoVenda("Contexto fiscal da operação inválido.");
}
const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
function decimalExato(d: Prisma.Decimal, campo: string) { if (d.lte(0) || d.decimalPlaces() > 6) throw new ErroPedidoVenda(`${campo}: quantidade fiscal não representável com seis casas; confirme unidade e conversão.`); return d.toFixed(6); }
function receitaMercadoriaFotografada(i: PedidoFiscal["itens"][number], produto: Record<string, unknown>, e: EscolhaSnapshot) {
  if (!e.produtoId || !e.unidadeProduto || !Array.isArray(i.composicaoSnapshot)) return undefined;
  try {
    const D = Prisma.Decimal.clone({ precision: 80 }), fator = new D(String(e.quantidade)).mul(e.multiplicador ?? "1");
    if (!fator.isFinite() || fator.lte(0)) return undefined;
    const itens = i.composicaoSnapshot.filter(c => objeto(c).origem === e.opcaoId).map(c => { const k = objeto(c); return { insumoId: k.insumoId, unidade: k.unidade, quantidade: new D(String(k.quantidade)).div(fator).toString(), origem: "PRODUTO" }; });
    return receitaDoSnapshot(e.unidadeProduto, itens, [], i.estadoComposicao === "CONHECIDA" || e.composicaoFiscalComprovada === true && !!produto.materiaisFiscais, produto.materiaisFiscais as MateriaisFiscaisFotografados | undefined, e.modoPreparoProduto ?? null);
  } catch { return undefined; }
}
/** Deriva valores dos snapshots comerciais já fechados. Não reprecifica escolhas
 * nem converte opções em linhas automaticamente. Desconto é rateado em centavos. */
export function itensParaTributacao(p: PedidoFiscal): ItemComercialFiscal[] {
  return p.itens.map(i => {
    const produto = objeto(i.produtoSnapshot); const es = Array.isArray(i.escolhasSnapshot) ? i.escolhasSnapshot as unknown as EscolhaSnapshot[] : [];
    const acrescimos = es.map(e => valorFiscal(e.preco).mul(String(e.quantidade)).mul(i.quantidade));
    const base = i.precoAplicado.mul(i.quantidade); const pesos = [base, ...acrescimos].map(d => d.toFixed(6));
    const positivos = pesos.map((p, n) => ({ p, n })).filter(x => new Prisma.Decimal(x.p).gt(0));
    const rateios = positivos.length ? ratearFiscal(i.totalLinha.toFixed(2), positivos.map(p => p.p)) : [];
    const valores = pesos.map((_, n) => rateios[positivos.findIndex(p => p.n === n)] ?? "0.00");
    // Opção avulsa histórica fotografa multiplicador/unidade do produto.
    const avulso = objeto(produto.complementoAvulso);
    const documentada = produto.receitaFiscalDocumentadaSnapshot as ReceitaFiscalDocumentadaSnapshot | undefined;
    return { id: i.id, produtoId: i.produtoId ?? "produto-ausente", nome: String(produto.nome ?? "Produto sem identificação"), quantidade: decimalExato(i.quantidade.mul(String(avulso.multiplicador ?? "1")), "Produto"), unidade: String(avulso.unidadeProduto ?? i.unidadeSnapshot), total: i.totalLinha.toFixed(2), fotografiaKitFiscal: produto.fotografiaKitFiscal as FotografiaKitFiscal | undefined, receitaFotografada: documentada?.receita ?? receitaDoSnapshot(String(avulso.unidadeProduto ?? i.unidadeSnapshot), i.composicaoSnapshot ?? [], es, i.estadoComposicao === "CONHECIDA", produto.materiaisFiscais as MateriaisFiscaisFotografados | undefined, typeof produto.modoPreparo === "string" ? produto.modoPreparo : null, produto.comprovacaoFisicaFiscal as ComprovacaoFisicaFiscal | undefined), escolhas: es.map((e, n) => ({ opcaoId: e.opcaoId, grupoId: e.grupoId ?? null, produtoId: e.produtoId, nome: e.opcaoNome, quantidade: decimalExato(new Prisma.Decimal(String(e.quantidade)).mul(e.multiplicador ?? "1"), e.opcaoNome), quantidadeEscolhida: decimalExato(new Prisma.Decimal(String(e.quantidade)), e.opcaoNome), valor: valores[n + 1], unidade: e.unidadeProduto, receitaFotografada: receitaMercadoriaFotografada(i, produto, e) })) };
  });
}
export async function calcularPreviaPedido(tx: Prisma.TransactionClient, p: PedidoFiscal, modelo: "55" | "65" = "65", opcoes: OpcoesOperacaoFiscal = {}) {
  return calcularPreviaPedidoBase(tx, p, modelo, opcoes);
}
/** Somente revisão local. O chamador mantém sessão/guardas e aprovação específica
 * antes de materializar uma fotografia de homologação. Produção não envia propostas. */
export async function calcularPreviaPedidoComRevisaoConsolidada(tx: Prisma.TransactionClient, p: PedidoFiscal, modelo: "55" | "65", opcoes: OpcoesOperacaoFiscal, versoesSelecionadas: VersaoSelecionadaRevisaoFiscal[] = []) {
  return calcularPreviaPedidoBase(tx, p, modelo, opcoes, versoesSelecionadas);
}
async function calcularPreviaPedidoBase(tx: Prisma.TransactionClient, p: PedidoFiscal, modelo: "55" | "65", opcoes: OpcoesOperacaoFiscal, selecionadas?: VersaoSelecionadaRevisaoFiscal[]) {
  validarOpcoes(opcoes);
  if (!["55", "65"].includes(modelo)) throw new ErroPedidoVenda("Modelo fiscal inválido.");
  const consultadas = await consultarVersoesFiscais(tx); const data = hojeFiscal();
  const revisao = selecionadas === undefined ? null : selecionarVersoesRevisaoConsolidada(consultadas, selecionadas, data, opcoes.ambiente ?? "HOMOLOGACAO");
  const vs = revisao?.versoes ?? consultadas;
  const catalogo = await tx.produtoVenda.findMany({ select: { id: true, nome: true, unidade: true } });
  const itens = itensParaTributacao(p), vigentes = versoesVigentes(vs, data);
  const alcance = new Set(itens.map(i => i.produtoId));
  for (const item of itens) for (const escolha of item.escolhas) {
    const b = vigentes.find(v => v.tipo === "COMPLEMENTO" && v.chave === escolha.opcaoId)?.dados as ComportamentoFiscal | undefined;
    if (b?.comportamento === "MERCADORIA" && b.produtoId) alcance.add(b.produtoId);
  }
  let expandiu = true;
  while (expandiu) { expandiu = false; for (const v of vigentes.filter(v => v.tipo === "CLASSIFICACAO" && alcance.has(v.chave))) for (const k of (v.dados as ClassificacaoFiscal).componentesKit ?? []) { const id = k.produtoId ?? `INSUMO:${k.referenciaInternaInsumoId}`; if (!alcance.has(id)) { alcance.add(id); expandiu = true; } } }
  const tecnicasAtuais: { produtoId: string; fotografia: FotografiaReceitaFiscal }[] = [];
  const opcoesAlcancadas = new Map<string, Set<string>>();
  const incluirOpcoes = (id: string, es: { opcaoId: string }[]) => { const ids = opcoesAlcancadas.get(id) ?? new Set<string>(); es.forEach(e => ids.add(e.opcaoId)); opcoesAlcancadas.set(id, ids); };
  for (const i of itens) {
    incluirOpcoes(i.produtoId, i.escolhas);
    for (const e of i.escolhas) { const b = vigentes.find(v => v.tipo === "COMPLEMENTO" && v.chave === e.opcaoId)?.dados as ComportamentoFiscal | undefined; if (b?.produtoId && b.escolhas) incluirOpcoes(b.produtoId, b.escolhas); }
    for (const k of i.fotografiaKitFiscal?.componentes ?? []) if (k.produtoId) incluirOpcoes(k.produtoId, k.escolhas ?? []);
  }
  for (const v of vigentes.filter(v => v.tipo === "CLASSIFICACAO" && alcance.has(v.chave))) {
    const c = v.dados as ClassificacaoFiscal;
    // Uma receita sem prova invalida somente seu ramo, sem interromper as demais famílias.
    if (c.produtoId && c.configuracaoNcm) try { tecnicasAtuais.push({ produtoId: c.produtoId, fotografia: await fotografarReceitaFiscal(tx, c, false, [...(opcoesAlcancadas.get(c.produtoId) ?? [])]) }); } catch { /* O motor apresenta pendência objetiva para este produto. */ }
    else if (c.fotografiaTecnica) try { const foto = await fotografarClassificacaoNormal(tx, c); tecnicasAtuais.push({ produtoId: v.chave, fotografia: { algoritmo: "grazing.receita-fiscal.v1", principalHash: foto.principalHash, opcaoHashes: [], ...(foto.documentacaoHash ? { documentacaoHash: foto.documentacaoHash } : {}), materiais: { principal: foto.materiais, opcoes: [] } } }); } catch { /* Somente a mercadoria com identidade material não comprovada fica pendente. */ }
  }
  for (const id of [...new Set(itens.flatMap(i => i.escolhas.map(e => e.opcaoId)))]) {
    const b = vigentes.find(v => v.tipo === "COMPLEMENTO" && v.chave === id)?.dados as ComportamentoFiscal | undefined;
    if (b?.escolhas) try { const foto = await fotografarMercadoriaOpcao(tx, b); tecnicasAtuais.push({ produtoId: `OPCAO:${id}`, fotografia: { algoritmo: "grazing.receita-fiscal.v1", principalHash: foto.fotografiaOpcaoOrigem, opcaoHashes: [] } }); } catch { /* Somente o complemento cuja equivalência física falhou fica pendente. */ }
  }
  const insumos = await tx.insumo.findMany({ where: { id: { in: [...new Set(vigentes.filter(v => v.tipo === "CLASSIFICACAO" && alcance.has(v.chave)).flatMap(v => (v.dados as ClassificacaoFiscal).componentesKit?.flatMap(k => k.referenciaInternaInsumoId ? [k.referenciaInternaInsumoId] : []) ?? []))] } }, select: { id: true, nome: true, ativo: true, excluidoEm: true, unidade: true, tipo: true } });
  const perfilV = versoesVigentes(vs, data).find(v => v.tipo === "PERFIL" && v.chave === "singleton"); const perfil = perfilV?.dados as PerfilFiscal | undefined;
  const cobranca = objeto(p.cobrancaSnapshot); const endereco = objeto(p.enderecoSnapshot); const comprador = identidadeFiscalCobranca(objeto(p.compradorSnapshot), p.cobrancaSnapshot);
  const uf = String(p.atendimento === "ENTREGA" ? endereco.uf ?? cobranca.uf ?? "" : perfil?.uf ?? "");
  const consumidorFinal = opcoes.consumidorFinal ?? !comprador.inscricaoEstadual;
  const indicadorIe = opcoes.indicadorIe ?? (comprador.inscricaoEstadual && comprador.inscricaoEstadual !== "ISENTO" ? 1 : 9);
  // Zero é apenas o marcador de uma fotografia ainda inapta. Retirada e canal
  // comercial não comprovam venda presencial; a pendência bloqueia seu envio.
  const presencaAutomatica = presencaAutomaticaPedido(p, modelo);
  const presenca = opcoes.indicadorPresenca ?? presencaAutomatica ?? 0;
  const temDeclaracaoAdministrativa = vigentes.some(v => v.tipo === "CLASSIFICACAO" && alcance.has(v.chave) && (v.dados as ClassificacaoFiscal).fci?.situacao === "DISPENSADA_POR_DECLARACAO_RESPONSAVEL");
  const previa = calcularTributacao({ data, estabelecimento: "singleton", ufDestino: uf, destinatario: indicadorIe === 1 ? "CONTRIBUINTE" : "CONSUMIDOR_FINAL", consumidorFinal, modelo, operacao: "VENDA", frete: p.frete.toFixed(2), outrosCustos: p.outrosCustos.toFixed(2), ...(temDeclaracaoAdministrativa ? { ambiente: opcoes.ambiente ?? "HOMOLOGACAO" } : {}) }, itens, vs, catalogo, tecnicasAtuais, insumos);
  if (revisao) previa.revisaoConsolidada = revisao.revisao;
  const pendencia = (s: string) => { if (!previa.pendencias.includes(s)) previa.pendencias.push(s); previa.apto = false; };
  if (!perfil?.crt) pendencia("Confirmar e aprovar o CRT explícito no regime central vigente. A opção pelo Simples, isoladamente, não define o CRT.");
  if (perfil?.crt === 2) pendencia("CRT2 exige tributação do ICMS fora do Simples e regras específicas aprovadas. Este alcance ainda não está homologado.");
  if ((comprador.tipo === "PJ" || comprador.inscricaoEstadual) && opcoes.consumidorFinal === undefined) pendencia("Confirmar finalidade da operação: consumo final ou revenda. Inscrição estadual não determina a finalidade.");
  if (modelo === "65" && !consumidorFinal) pendencia("NFC-e somente para consumidor final; venda para revenda exige NF-e.");
  if (modelo === "65" && indicadorIe !== 9) pendencia("NFC-e exige destinatário não contribuinte (indicador IE 9); utilize NF-e para contribuinte ou isento.");
  if (modelo === "55" && presenca === 4) pendencia("Indicador de presença 4 é específico de NFC-e com entrega; confirmar presença da NF-e.");
  if (presencaAutomatica === undefined && opcoes.indicadorPresenca === undefined) pendencia(`Confirmar presença/canal da operação ${modelo === "55" ? "NF-e" : "NFC-e"}; retirada ou atendimento comercial não comprovam presença fiscal.`);
  if (!new Prisma.Decimal(previa.totalMercadorias).equals(p.subtotal.minus(p.desconto))) pendencia("Linhas fiscais não fecham com subtotal menos desconto do pedido.");
  if (await tx.historicoPedidoVenda.count({ where: { pedidoId: p.id, tipo: "DOCUMENTO_FISCAL_EXTERNO" } })) pendencia("Pedido possui referência de emissão externa; confirme o resultado no Takeat/emissor antes de qualquer nova emissão.");
  const informado = objeto(p.pagamentoInformadoSnapshot); const formas: Record<string, string> = { DINHEIRO: "01", CARTAO_CREDITO: "03", CARTAO_DEBITO: "04", BOLETO: "15", PIX: "17" };
  const forma = formas[String(informado.tipo ?? p.formaPagamentoInformada ?? "")];
  if (!forma) pendencia("Meio de pagamento fiscal ausente ou sem correspondência confirmada; não inferir quitação pelo financeiro.");
  // NT2025.001, YA04/YA05; SP mantém YA04a-20 inativa. A declaração explícita
  // permite tpIntegra=2; não fabrica adquirente, bandeira ou autorização.
  // No contrato Brasil NFe, TipoIntegracao=false significa pagamento sem TEF.
  const cartaoNfce = modelo === "65" && ["03", "04"].includes(forma ?? "");
  // O HUB não captura transações TEF. Informar o meio comercial não comprova recebimento.
  const pagamentoCartaoNaoIntegrado = cartaoNfce && perfil?.uf === "SP";
  if (cartaoNfce && perfil?.uf !== "SP") pendencia("Pagamento com cartão não integrado: este fluxo está validado somente para emitente de São Paulo. Confira as exigências da UF do emitente antes de emitir NFC-e.");
  const doc = String(comprador.documento ?? "").replace(/\D/g, "");
  if (modelo === "55" && (!/^\d{11}$|^\d{14}$/.test(doc) || !String(comprador.nome ?? "").trim())) pendencia("NF-e exige documento e identificação fiscal do destinatário.");
  const destinatario = resolverDestinatarioBrasilNfe({ modelo: Number(modelo) as 55 | 65, indicadorPresenca: presenca, comprador: { ...comprador, indicadorIe }, cobranca: p.cobrancaSnapshot, consumidorFinal });
  destinatario.pendencias.forEach(pendencia);
  const pesos = previa.linhas.map(l => l.valor);
  const rateio = (v: Prisma.Decimal) => pesos.length && v.gt(0) ? ratearFiscal(v.toFixed(2), pesos.map(x => new Prisma.Decimal(x).gt(0) ? x : "0.000001")) : pesos.map(() => "0.00");
  const fretes = rateio(p.frete); const custos = rateio(p.outrosCustos);
  const documento: DocumentoBrasilNfe = { ModeloDocumento: Number(modelo) as 55 | 65, TipoAmbiente: opcoes.ambiente === "PRODUCAO" ? 1 : 2, NaturezaOperacao: "Venda de mercadorias", Finalidade: 1, IndicadorPresenca: presenca, ConsumidorFinal: consumidorFinal, ValorTotal: p.total.toFixed(2), Pagamentos: forma ? [{ FormaPagamento: forma, VlPago: p.total.toFixed(2), ...(pagamentoCartaoNaoIntegrado ? { TipoIntegracao: false } : {}) }] : [], Produtos: previa.linhas.map((l, n) => ({ NmProduto: descricaoProdutoNfe(l.nome), CodProdutoServico: l.produtoId, NCM: l.ncm, EAN: l.gtin ?? "", ...(l.cest ? { CEST: l.cest } : {}), OrigemProduto: Number(l.origem), CFOP: Number(l.cfop), UnidadeComercial: l.unidade, UnidadeComercialTributavel: l.unidade, Quantidade: l.quantidade, QuantidadeTributavel: l.quantidade, ValorUnitario: new Prisma.Decimal(l.valor).div(l.quantidade).toFixed(10), ValorUnitarioTributavel: new Prisma.Decimal(l.valor).div(l.quantidade).toFixed(10), ValorTotal: l.valor, ValorFrete: fretes[n], ValorOutrasDespesas: custos[n], Imposto: traduzirImpostosBrasilNfe(l) })), ...(doc ? { Cliente: { CpfCnpj: doc, NmCliente: String(comprador.nome ?? ""), IndicadorIe: consumidorFinal ? 9 as const : 1 as const } } : {}) };
  previa.linhas.forEach((linha, indice) => { if (linha.fci?.situacao === "EXIGIDA" && linha.fci.numero) documento.Produtos[indice].nFCI = linha.fci.numero; });
  const indicacoes = [...new Set(previa.linhas.flatMap(l => l.justificativas.filter(j => /Imposto Recolhido por Substitui/i.test(j))))];
  if (indicacoes.length) documento.Observacao = indicacoes.join("; ").slice(0, 5000);
  if (destinatario.cliente) documento.Cliente = destinatario.cliente;
  // MOC7, E04-20: somente o nome fiscal de homologação. A identidade e a
  // fotografia comercial do comprador permanecem preservadas.
  if (modelo === "55" && documento.TipoAmbiente === 2 && documento.Cliente) documento.Cliente = { ...documento.Cliente, NmCliente: "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL" };
  let rtc2027: SnapshotLayoutRtc | undefined;
  let documentoCalculado = documento;
  if (data >= "2027-01-01" && perfil?.reforma === "EXIGIR_REGRA" && layoutRtcComprovado(perfil.layoutRTC) && previa.linhas.length && previa.linhas.every(l => l.valoresRTC)) {
    rtc2027 = { layout: perfil.layoutRTC, produtos: previa.linhas.map(l => ({ produtoLiquido: l.valoresRTC!.produtoLiquido, unitarioLiquido: l.valoresRTC!.unitarioLiquido, totalItem: l.valoresRTC!.totalItem })), valorLiquidoProdutosTotal: previa.linhas.reduce((s, l) => s.plus(l.valoresRTC!.produtoLiquido), new Prisma.Decimal(0)).toFixed(2), valorTotalDocumento: p.total.toFixed(2) };
    try { documentoCalculado = aplicarLayoutRtc(documento, rtc2027); }
    catch (erro) { pendencia(erro instanceof Error ? erro.message : "Mapeamento RTC incompatível com o documento."); rtc2027 = undefined; }
  }
  documentoCalculado.Produtos.forEach((produto, indice) => {
    const motivo = pendenciaCsosnNaoContribuinte({ modelo: documentoCalculado.ModeloDocumento, crt: perfil?.crt, finalidade: documentoCalculado.Finalidade,
      indicadorIe: documentoCalculado.Cliente?.IndicadorIe, cfop: produto.CFOP, csosn: produto.Imposto.ICMS.CodSituacaoTributaria, indice, nome: produto.NmProduto });
    if (motivo) pendencia(motivo);
  });
  // Acrescenta a posição comercial sem alterar o nome fotografado ou a linha fiscal.
  previa.pendencias = previa.pendencias.map(mensagem => {
    const indices = itens.flatMap((item, n) => mensagem.startsWith(`${item.nome}:`) || mensagem.startsWith(`${item.nome} /`) ? [n + 1] : []);
    return indices.length ? `Item ${indices.join(", ")} — ${mensagem}` : mensagem;
  });
  const snapshot: SnapshotTributacaoBrasilNfe & { previa: PreviaTributacao; perfilEmissor: string | null; revisaoConsolidada?: PreviaTributacao["revisaoConsolidada"] } = { apto: previa.apto, pendencias: previa.pendencias, emitenteCnpj: perfil?.cnpj ?? "", emitenteIE: perfil?.inscricaoEstadual ?? "", ...(previa.linhas.some(l => l.fci) ? { emitenteUf: perfil?.uf ?? "" } : {}), crt: perfil?.crt ?? 0, documento: documentoCalculado, previa, perfilEmissor: perfil?.emissor ?? null, ...(pagamentoCartaoNaoIntegrado ? { pagamentoCartaoNaoIntegrado: true } : {}), ...(revisao ? { revisaoConsolidada: revisao.revisao } : {}), ...(rtc2027 ? { rtc2027 } : {}) };
  return snapshot;
}
export async function previaFiscalPedido(pedidoId: string, versao: number, sessao: SessaoAtual, modelo: "55" | "65" = "65", opcoes: OpcoesOperacaoFiscal = {}) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(pedidoId) || !Number.isSafeInteger(versao)) throw new ErroPedidoVenda("Pedido ou revisão inválidos.");
  return prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["consultar"]); await conferirAutorFiscal(tx, sessao); const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } }); if (p.versao !== versao || p.status !== "CONFIRMADO") throw new ErroPedidoVenda("Atualize um pedido confirmado antes de calcular sua prévia."); return (await calcularPreviaPedido(tx, p, modelo, opcoes)).previa; }, { timeout: 30000 });
}
