import { acompanhamentoDoPedido, exigirEfeitoOperacional } from "@/lib/ifood/acompanhamento";
import { BLOQUEIO_ACOMPANHAMENTO_IFOOD } from "@/lib/ifood/acompanhamento-dominio";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type DocumentoFiscalSaida } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { ErroPedidoVenda } from "@/lib/vendas/pedidos-dominio";
import { permissaoEfetiva, type Permissoes, type Excecoes } from "@/lib/permissoes/catalogo";
import type { AdaptadorFiscalSaida, RespostaFiscalSaida } from "./contrato";
import { BLOQUEIO_PRODUCAO_FISCAL_SAIDA, obterAdaptadorFiscalSaida } from "./provedor";
import { sanitizarHtmlNfceBrasilNfe, validarXmlCancelamentoBrasilNfe } from "./brasilnfe/arquivos";
import { conferirIdentidadeBrasilNfe, ErroConsultaBrasilNfe } from "./brasilnfe/consulta";
import { ErroHttpBrasilNfe } from "./brasilnfe/cliente";
import { ErroValidacaoSnapshotBrasilNfe } from "./brasil-nfe";
import { exigirBaseHomologacaoControlada, conferirCapacidadeHomologacao } from "./brasilnfe/capacidade-homologacao";
import { conferirCapacidadeEmissaoManualBrasilNfe, possuiCapacidadeEmissaoManualBrasilNfe } from "./brasilnfe/capacidade-operacional";
import { calcularPreviaPedido, calcularPreviaPedidoComRevisaoConsolidada, type OpcoesOperacaoFiscal } from "@/lib/tributacao/pedidos";
import { conferirVigenciaSnapshotFiscal, hashFiscal } from "@/lib/tributacao/servico";
import { exigirTransmissaoBrasilNfeLiberada, MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE, transmissaoBrasilNfeLiberada } from "./brasilnfe/bloqueio-transmissao";
export async function conferirCalculoAtualFiscalSaida(tx: Prisma.TransactionClient, d: DocumentoFiscalSaida, opcoes?: { enviar: true }) {
  if ((d.payload as { versao?: unknown })?.versao === 1) return; // Legado imutável; sua porta exige plano aprovado específico.
  const t = (d.payload as { tributacao: { previa: { contexto: { modelo: "55" | "65" } }; documento: { TipoAmbiente: 1 | 2; ConsumidorFinal: boolean; IndicadorPresenca: OpcoesOperacaoFiscal["indicadorPresenca"]; Cliente?: { IndicadorIe: OpcoesOperacaoFiscal["indicadorIe"] } }; pagamentoCartaoNaoIntegrado?: true; revisaoConsolidada?: { tipo: string; versao: number; ambiente: string; aprovacaoInterna: boolean; versoes: { id: string; hash: string }[] } } }).tributacao;
  const revisao = t.revisaoConsolidada;
  if (revisao) {
    // Propostas fotografadas servem exclusivamente ao teste55 autorizado. Isso
    // não ativa versões nem constitui aprovação tributária para produção.
    if (d.ambiente !== "HOMOLOGACAO" || d.modeloDocumento !== 55 || t.previa.contexto.modelo !== "55" || t.documento.TipoAmbiente !== 2
      || revisao.tipo !== "PROPOSTAS_PARA_REVISAO" || revisao.versao !== 1 || revisao.ambiente !== "HOMOLOGACAO" || revisao.aprovacaoInterna !== false
      || !Array.isArray(revisao.versoes) || !revisao.versoes.length || revisao.versoes.length > 5000
      || revisao.versoes.some(v => !idValido(v.id) || !/^[a-f0-9]{64}$/.test(v.hash))) throw new ErroPedidoVenda("Revisão de propostas não autoriza emissão produtiva ou outro contexto fiscal.");
    if (opcoes?.enviar || d.acao === "ENVIAR" || d.status === "PROCESSANDO") {
      const evento = await tx.eventoFiscalSaida.findFirst({ where: { documentoId: d.id, tipo: "EMISSAO_MANUAL_REVISAO_HOMOLOGACAO" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { dados: true } });
      const e = evento?.dados as Record<string, unknown> | undefined;
      if (!e || e.hashSnapshot !== d.hashPayload || e.hashVersoes !== hashFiscal(revisao.versoes) || !idValido(e.usuarioId)
        || e.aprovacaoInterna !== false || e.finalidade !== "TESTE_HOMOLOGACAO") throw new ErroPedidoVenda("Teste de homologação sem registro específico da revisão fotografada. Nenhuma transmissão foi autorizada por esta prévia.");
    }
  } else await conferirVigenciaSnapshotFiscal(tx, d.payload);
  const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } });
  const contexto: OpcoesOperacaoFiscal = { consumidorFinal: t.documento.ConsumidorFinal, indicadorPresenca: t.documento.IndicadorPresenca, indicadorIe: t.documento.Cliente?.IndicadorIe, ambiente: t.documento.TipoAmbiente === 1 ? "PRODUCAO" : "HOMOLOGACAO", ...(t.previa.contexto.modelo === "65" && t.pagamentoCartaoNaoIntegrado === true ? { pagamentoCartaoNaoIntegrado: true } : {}) };
  const novo = revisao ? await calcularPreviaPedidoComRevisaoConsolidada(tx, p, t.previa.contexto.modelo, contexto, revisao.versoes.map(v => ({ id: v.id, hash: v.hash }))) : await calcularPreviaPedido(tx, p, t.previa.contexto.modelo, contexto);
  if (hashFiscal(novo) !== hashFiscal((d.payload as { tributacao: unknown }).tributacao)) throw new ErroPedidoVenda("O cálculo fiscal vigente mudou. Reprepare uma nova fotografia antes de enviar.");
}
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const idValido = (v: unknown): v is string => typeof v === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(v);
/** Produção representa a venda uma única vez, inclusive entre55/65. Homologação
 * tem contexto próprio por modelo. Identidade incompleta nunca comprova separação. */
export function whereAmbienteConflitanteFiscalSaida(ambiente: string, modelo: number | null): Prisma.DocumentoFiscalSaidaWhereInput {
  const desconhecido = { ambiente: { notIn: ["HOMOLOGACAO", "PRODUCAO"] } };
  if (ambiente === "PRODUCAO") return { OR: [{ ambiente: "PRODUCAO" }, desconhecido] };
  if (ambiente === "HOMOLOGACAO" && (modelo === 55 || modelo === 65)) return { OR: [desconhecido, { ambiente: "HOMOLOGACAO", OR: [{ modeloDocumento: modelo }, { modeloDocumento: null }, { modeloDocumento: { notIn: [55, 65] } }] }] };
  if (ambiente === "HOMOLOGACAO") return { OR: [{ ambiente: "HOMOLOGACAO" }, desconhecido] };
  return {};
}
function conferirAdaptadorOperacional(a: AdaptadorFiscalSaida) {
  if (a.ambiente === "PRODUCAO" && !possuiCapacidadeEmissaoManualBrasilNfe(a)) throw new ErroPedidoVenda(BLOQUEIO_PRODUCAO_FISCAL_SAIDA);
  if (a.bloqueioOperacional) throw new ErroPedidoVenda(a.bloqueioOperacional);
}
const selectResumo = { id: true, pedidoId: true, versaoPedido: true, status: true, ambiente: true, provedor: true, tentativas: true, ultimoErro: true, referenciaProvedor: true, chaveFiscal: true, numero: true, serie: true, protocolo: true, protocoloCancelamento: true, cancelamentoPendente: true, modeloDocumento: true, createdAt: true, eventos: { select: { id: true, tipo: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 } } as const;
async function acessoConsulta(tx: Prisma.TransactionClient, sessao: SessaoAtual) {
  await conferirAcesso(tx, sessao, ["consultar"]);
  const u = await tx.usuario.findUniqueOrThrow({ where: { id: sessao.userId }, include: { perfilAcesso: true } });
  if (u.perfilAcesso?.sistema !== "ADMINISTRADOR" && !permissaoEfetiva((u.perfilAcesso?.permissoes ?? {}) as Permissoes, u.permissoesPersonalizadas as Excecoes, "vendas.fiscal", "visualizar")) throw new ErroPedidoVenda("Seu acesso não permite consultar documentos fiscais de saída.");
}
export async function consultarFiscalSaida(pedidoId: string, sessao: SessaoAtual) {
  return prisma.$transaction(async tx => {
    await acessoConsulta(tx, sessao);
    const documentos = await tx.documentoFiscalSaida.findMany({ where: { pedidoId }, select: selectResumo, orderBy: { createdAt: "desc" } });
    // Apenas presença/formato no DTO: o conteúdo permanece na rota protegida de download.
    const arquivos = await tx.$queryRaw<{ id: string; formatoImpressao: "PDF" | "HTML" | null; xmlCancelamentoDisponivel: boolean; cancelamentoSolicitado: boolean }[]>`SELECT d.id, CASE WHEN d.pdf IS NOT NULL THEN 'PDF' WHEN d.html IS NOT NULL THEN 'HTML' ELSE NULL END AS "formatoImpressao", d."xmlCancelamento" IS NOT NULL AS "xmlCancelamentoDisponivel", EXISTS(SELECT 1 FROM "EventoFiscalSaida" e WHERE e."documentoId"=d.id AND e.tipo='CANCELAMENTO_MANUAL_AUTORIZADO') AS "cancelamentoSolicitado" FROM "DocumentoFiscalSaida" d WHERE d."pedidoId"=${pedidoId}`;
    return documentos.map(d => ({ ...d, formatoImpressao: arquivos.find(a => a.id === d.id)?.formatoImpressao ?? null, xmlCancelamentoDisponivel: arquivos.find(a => a.id === d.id)?.xmlCancelamentoDisponivel ?? false, cancelamentoSolicitado: arquivos.find(a => a.id === d.id)?.cancelamentoSolicitado ?? false }));
  });
}
type OpcoesPreparacaoFiscalSaida = OpcoesOperacaoFiscal & { revisaoConsolidada?: true; versoesRevisao?: { id: string; hash: string }[] };
export async function prepararFiscalSaida(pedidoId: string, versao: number, sessao: SessaoAtual, modelo: "55" | "65" = "65", opcoes: OpcoesPreparacaoFiscalSaida = {}) {
  if (!idValido(pedidoId) || !Number.isSafeInteger(versao) || versao < 1) throw new ErroPedidoVenda("Pedido ou revisão inválida.");
  if (!["55", "65"].includes(modelo) || !opcoes || opcoes.ambiente !== undefined && !["HOMOLOGACAO", "PRODUCAO"].includes(opcoes.ambiente)
    || opcoes.revisaoConsolidada !== undefined && opcoes.revisaoConsolidada !== true || opcoes.versoesRevisao !== undefined && opcoes.revisaoConsolidada !== true) throw new ErroPedidoVenda("Modelo, ambiente ou revisão fiscal inválidos.");
  const ambiente = opcoes.ambiente ?? "HOMOLOGACAO";
  const { revisaoConsolidada, versoesRevisao, ...operacao } = opcoes;
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["revisar", "fiscal"], pedidoId);
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${pedidoId} FOR UPDATE`;
    const ultimaRevisao = await tx.documentoFiscalSaida.findFirst({ where: { pedidoId, versaoPedido: versao }, orderBy: { revisaoFiscal: "desc" }, select: { revisaoFiscal: true } });
    const anterior = await tx.documentoFiscalSaida.findFirst({ where: { pedidoId, versaoPedido: versao, ambiente, modeloDocumento: Number(modelo) }, orderBy: { revisaoFiscal: "desc" } });
    const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" }, include: { produto: { include: { grupoFiscal: true } } } }, lancamentosFinanceiros: { where: { tipo: "RECEITA", status: { not: "CANCELADO" } }, select: { id: true, valor: true, dataVencimento: true, formaPagamentoId: true } } } });
    if (p.versao !== versao || p.status !== "CONFIRMADO") throw new ErroPedidoVenda("Reabra um pedido confirmado para preparar sua revisão atual.");
    const emitente = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { nome: true, cnpj: true, endereco: true } });
    const tributacao = revisaoConsolidada ? await calcularPreviaPedidoComRevisaoConsolidada(tx, p, modelo, { ...operacao, ambiente }, versoesRevisao) : await calcularPreviaPedido(tx, p, modelo, { ...operacao, ambiente });
    const payload = json({ schema: "grazing.fiscal-saida", versao: 2, tributacao, pedido: { id: p.id, numero: p.numero, revisao: p.versao, confirmadoEm: p.confirmadoEm, fuso: p.fusoHorario, canal: p.canalNomeSnapshot }, emitente, comprador: p.compradorSnapshot, cobranca: p.cobrancaSnapshot, destinatario: p.destinatarioSnapshot, endereco: p.enderecoSnapshot, entrega: p.entregaSnapshot, pagamento: p.pagamentoInformadoSnapshot, parcelas: p.lancamentosFinanceiros, valores: { subtotal: p.subtotal, desconto: p.desconto, frete: p.frete, outrosCustos: p.outrosCustos, total: p.total }, itens: p.itens.map(i => ({ id: i.id, produtoId: i.produtoId, revisaoComercial: i.versaoPedido, produto: i.produtoSnapshot, complementos: i.escolhasSnapshot, quantidade: i.quantidade, unidade: i.unidadeSnapshot, preco: i.precoAplicado, acrescimos: i.acrescimos, desconto: i.desconto, total: i.totalLinha, fiscal: { produto: i.produto?.fiscal ?? null, grupo: i.produto?.grupoFiscal?.fiscal ?? null, grupoId: i.produto?.grupoFiscalId ?? null, versaoCadastro: i.produto?.versao ?? null, versaoGrupo: i.produto?.grupoFiscal?.versao ?? null } })), observacoes: p.observacoes });
    if (anterior?.hashPayload === hash(payload) && !["REJEITADO", "CANCELADO"].includes(anterior.status)) return anterior;
    const d = await tx.documentoFiscalSaida.create({ data: { pedidoId, versaoPedido: versao, revisaoFiscal: (ultimaRevisao?.revisaoFiscal ?? 0) + 1, versaoPayload: 2, modeloDocumento: Number(modelo), ambiente, payload, hashPayload: hash(payload), criadoPorId: autor.userId, criadoPorNome: autor.nome, status: obterAdaptadorFiscalSaida() ? "PREPARADO" : "SEM_EMISSOR" } });
    await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `preparado:${d.id}`, tipo: "PREPARADO", dados: json({ usuarioId: autor.userId, hashPayload: d.hashPayload, versao }) } });
    return d;
  }, { timeout: 30000 });
}
export async function prepararFiscalSaidaLegadoHomologacao(pedidoId: string, versao: number, sessao: SessaoAtual) {
  exigirBaseHomologacaoControlada();
  if (!idValido(pedidoId) || !Number.isSafeInteger(versao) || versao < 1) throw new ErroPedidoVenda("Pedido ou revisão inválida.");
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["revisar", "fiscal"], pedidoId);
    await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${pedidoId} FOR UPDATE`;
    const anterior = await tx.documentoFiscalSaida.findFirst({ where: { pedidoId, versaoPedido: versao }, orderBy: { revisaoFiscal: "desc" } });
    if (anterior) return anterior;
    const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" }, include: { produto: { include: { grupoFiscal: true } } } }, lancamentosFinanceiros: { where: { tipo: "RECEITA", status: { not: "CANCELADO" } }, select: { id: true, valor: true, dataVencimento: true, formaPagamentoId: true } } } });
    if (!["brasilnfe-piloto-55-2026-v1", "brasilnfe-piloto-65-2026-v1"].includes(p.chaveCriacao)) throw new ErroPedidoVenda("Preparação legada limitada aos pilotos sintéticos preservados.");
    if (p.versao !== versao || p.status !== "CONFIRMADO") throw new ErroPedidoVenda("Reabra um pedido confirmado para preparar sua revisão atual.");
    const emitente = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { nome: true, cnpj: true, endereco: true } });
    const payload = json({ schema: "grazing.fiscal-saida", versao: 1, pedido: { id: p.id, numero: p.numero, revisao: p.versao, confirmadoEm: p.confirmadoEm, fuso: p.fusoHorario, canal: p.canalNomeSnapshot }, emitente, comprador: p.compradorSnapshot, cobranca: p.cobrancaSnapshot, destinatario: p.destinatarioSnapshot, endereco: p.enderecoSnapshot, entrega: p.entregaSnapshot, pagamento: p.pagamentoInformadoSnapshot, parcelas: p.lancamentosFinanceiros, valores: { subtotal: p.subtotal, desconto: p.desconto, frete: p.frete, outrosCustos: p.outrosCustos, total: p.total }, itens: p.itens.map(i => ({ id: i.id, produtoId: i.produtoId, revisaoComercial: i.versaoPedido, produto: i.produtoSnapshot, complementos: i.escolhasSnapshot, quantidade: i.quantidade, unidade: i.unidadeSnapshot, preco: i.precoAplicado, acrescimos: i.acrescimos, desconto: i.desconto, total: i.totalLinha, fiscal: { produto: i.produto?.fiscal ?? null, grupo: i.produto?.grupoFiscal?.fiscal ?? null, grupoId: i.produto?.grupoFiscalId ?? null, versaoCadastro: i.produto?.versao ?? null, versaoGrupo: i.produto?.grupoFiscal?.versao ?? null } })), observacoes: p.observacoes });
    const d = await tx.documentoFiscalSaida.create({ data: { pedidoId, versaoPedido: versao, payload, hashPayload: hash(payload), criadoPorId: autor.userId, criadoPorNome: autor.nome, status: obterAdaptadorFiscalSaida() ? "PREPARADO" : "SEM_EMISSOR" } });
    await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `preparado:${d.id}`, tipo: "PREPARADO", dados: json({ usuarioId: autor.userId, hashPayload: d.hashPayload, versao }) } });
    return d;
  }, { timeout: 30000 });
}
export async function solicitarAcaoFiscalSaida(id: string, acao: "ENVIAR" | "CONSULTAR" | "CANCELAR", motivo: string, sessao: SessaoAtual) {
  return solicitarAcaoComAdaptador(id, acao, motivo, sessao, obterAdaptadorFiscalSaida());
}
async function solicitarAcaoComAdaptador(id: string, acao: "ENVIAR" | "CONSULTAR" | "CANCELAR", motivo: string, sessao: SessaoAtual, adapter: AdaptadorFiscalSaida | null) {
  if (!idValido(id) || !["ENVIAR", "CONSULTAR", "CANCELAR"].includes(acao) || typeof motivo !== "string" || motivo.length > 1000 || (acao === "CANCELAR" && motivo.trim().length < 15)) throw new ErroPedidoVenda("Informe a ação e a justificativa fiscal (ao menos 15 caracteres no cancelamento).");
  if (!adapter) throw new ErroPedidoVenda("Emissor não configurado. A gestão interna continua disponível.");
  if (adapter.id === "BRASIL_NFE" && acao !== "CONSULTAR") exigirTransmissaoBrasilNfeLiberada({ documentoId: id, ambiente: adapter.ambiente, operacao: acao });
  conferirAdaptadorOperacional(adapter);
  return prisma.$transaction(async tx => {
    const autor = await conferirAcesso(tx, sessao, ["revisar", "fiscal"]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id }, include: { pedido: true } });
    await exigirEfeitoOperacional(tx, d.pedidoId);
    if (d.provedor && (d.provedor !== adapter.id || d.ambiente !== adapter.ambiente) || ["HOMOLOGACAO", "PRODUCAO"].includes(d.ambiente) && d.ambiente !== adapter.ambiente) throw new ErroPedidoVenda("O documento pertence a outro emissor/ambiente; reconcilie a configuração original.");
    if ((d.acao && acao !== "CONSULTAR") || (d.leaseAte && d.leaseAte > new Date())) throw new ErroPedidoVenda("Solicitação já em processamento. Aguarde ou consulte o histórico.");
    if (acao === "ENVIAR") {
      if (adapter.id === "BRASIL_NFE") exigirTransmissaoBrasilNfeLiberada({ documentoId: d.id, ambiente: adapter.ambiente, modelo: d.modeloDocumento ?? undefined, operacao: "ENVIAR" });
      const payload = d.payload as { versao?: number; tributacao?: { apto?: boolean; pendencias?: string[]; perfilEmissor?: string } };
      if (payload.versao !== 1 && (payload.versao !== 2 || payload.tributacao?.apto !== true)) throw new ErroPedidoVenda(`Prévia fiscal pendente: ${payload.tributacao?.pendencias?.join("; ") ?? "recalcular a revisão com o motor tributário"}.`);
      if (adapter.ambiente === "PRODUCAO" && !possuiCapacidadeEmissaoManualBrasilNfe(adapter, id)) throw new ErroPedidoVenda("Emissão real ou troca do Takeat não autorizada na configuração operacional.");
      if (await tx.historicoPedidoVenda.count({ where: { pedidoId: d.pedidoId, tipo: "DOCUMENTO_FISCAL_EXTERNO" } })) throw new ErroPedidoVenda("Pedido já possui documento fiscal externo. Confira o Takeat antes de emitir novamente.");
      if (!["SEM_EMISSOR", "PREPARADO"].includes(d.status) || d.pedido.status !== "CONFIRMADO" || d.pedido.versao !== d.versaoPedido) throw new ErroPedidoVenda("Esta solicitação não pode ser enviada. Confira sua revisão e o resultado anterior.");
      if (await tx.documentoFiscalSaida.count({ where: { pedidoId: d.pedidoId, id: { not: d.id }, AND: [whereAmbienteConflitanteFiscalSaida(adapter.ambiente, d.modeloDocumento), { OR: [{ status: { in: ["AUTORIZADO", "DENEGADO", "PROCESSANDO", "INCERTO", "PENDENTE_CONFERENCIA"] } }, { referenciaProvedor: { not: null }, status: { notIn: ["REJEITADO", "CANCELADO"] } }, { acao: { not: null } }] }] } })) throw new ErroPedidoVenda("Há outro documento autorizado, denegado ou pendente neste pedido e contexto fiscal. Trate-o antes de enviar uma nova revisão.");
      try { await conferirCalculoAtualFiscalSaida(tx, d, { enviar: true }); } catch (e) { throw new ErroPedidoVenda(e instanceof Error ? e.message : "Reprepare a prévia fiscal vigente."); }
    }
    if (acao === "CANCELAR" && (d.status !== "AUTORIZADO" || d.cancelamentoPendente)) throw new ErroPedidoVenda("Somente documento autorizado e sem cancelamento incerto pode solicitar cancelamento fiscal.");
    await tx.eventoFiscalSaida.create({ data: { documentoId: id, chave: `solicitacao:${randomUUID()}`, tipo: acao, dados: json({ usuarioId: autor.userId, motivo: motivo.trim() }) } });
    return tx.documentoFiscalSaida.update({ where: { id }, data: { provedor: adapter.id, ambiente: adapter.ambiente, acao, tentativas: 0, proximaTentativa: new Date(), ...(acao === "CANCELAR" ? { motivoCancelamento: motivo.trim() } : {}) } });
  });
}
function identidade(d: DocumentoFiscalSaida, a: AdaptadorFiscalSaida) {
  const payload = d.payload as { emitente?: { cnpj?: unknown } } | null;
  const cnpj = payload?.emitente?.cnpj;
  return { documentoId: d.id, ambiente: a.ambiente, referencia: d.referenciaProvedor, chaveIdempotencia: d.id, ultimaSequencia: d.ultimaSequencia,
    ...(typeof cnpj === "string" ? { emitenteCnpj: cnpj } : {}),
    ...(d.modeloDocumento === 55 || d.modeloDocumento === 65 ? { modeloDocumento: d.modeloDocumento as 55 | 65 } : {}) };
}
function validarResposta(r: RespostaFiscalSaida) {
  if (!r || !idValido(r.documentoId) || typeof r.eventoId !== "string" || !r.eventoId.length || r.eventoId.length > 200 || !["NAO_ENCONTRADO", "PROCESSANDO", "AUTORIZADO", "REJEITADO", "CANCELADO", "DENEGADO", "PENDENTE_CONFERENCIA"].includes(r.status)) throw new Error("Resposta fiscal inválida");
  if (r.ordenacao === "LOCAL_OBSERVACAO" ? r.sequencia !== undefined : r.ordenacao !== undefined || !Number.isSafeInteger(r.sequencia) || r.sequencia < 0) throw new Error("Ordenação fiscal inválida");
  for (const v of [r.referencia, r.chave, r.numero, r.serie, r.protocolo, r.protocoloCancelamento, r.protocoloEvento, r.erro]) if (v !== undefined && (typeof v !== "string" || v.length > 500)) throw new Error("Resposta fiscal inválida");
  if (r.protocoloCancelamento !== undefined && (!["CANCELADO", "PENDENTE_CONFERENCIA"].includes(r.status) || !/^\d{1,30}$/.test(r.protocoloCancelamento))) throw new Error("Protocolo do cancelamento inválido");
  if (["AUTORIZADO", "CANCELADO"].includes(r.status) && (!r.referencia || !r.numero || !r.protocolo)) throw new Error("Resposta sem comprovação fiscal");
  if (r.status === "CANCELADO" && !(r.protocoloEvento || r.protocoloCancelamento) || r.protocoloEvento && r.protocoloCancelamento && r.protocoloEvento !== r.protocoloCancelamento) throw new Error("Cancelamento sem protocolo de evento coerente");
}
export async function aplicarRetornoFiscalSaida(a: AdaptadorFiscalSaida, r: RespostaFiscalSaida, leaseToken?: string) {
  conferirAdaptadorOperacional(a);
  if (possuiCapacidadeEmissaoManualBrasilNfe(a)) conferirCapacidadeEmissaoManualBrasilNfe(a, r.documentoId);
  validarResposta(r);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: r.documentoId } });
    if (d.provedor !== a.id || d.ambiente !== a.ambiente) throw new Error("Emissor/ambiente divergente");
    if (leaseToken && d.leaseToken !== leaseToken) return d;
    const chave = hash([a.id, a.ambiente, r.eventoId]); const resumo = hash(r);
    const anterior = await tx.eventoFiscalSaida.findUnique({ where: { chave } });
    if (anterior && (anterior.documentoId !== d.id || (anterior.dados as { hash: string }).hash !== resumo)) throw new Error("Retorno divergente");
    const identidadeDivergente = ["AUTORIZADO", "CANCELADO"].includes(r.status) && !!d.protocolo && [
      [d.referenciaProvedor, r.referencia], [d.chaveFiscal, r.chave], [d.numero, r.numero], [d.serie, r.serie], [d.protocolo, r.protocolo], [d.protocoloCancelamento, r.protocoloCancelamento ?? r.protocoloEvento],
    ].some(([confirmado, recebido]) => !!confirmado && recebido !== undefined && confirmado !== recebido);
    const sequenciaOriginal = anterior ? (anterior.dados as { sequenciaLocal?: number }).sequenciaLocal : undefined;
    const reobservacaoAtual = r.ordenacao === "LOCAL_OBSERVACAO" && !!anterior && !!leaseToken && sequenciaOriginal !== undefined && sequenciaOriginal < d.ultimaSequencia;
    const sequencia = r.ordenacao === "LOCAL_OBSERVACAO" ? anterior && !reobservacaoAtual ? sequenciaOriginal : Math.max(d.ultimaSequencia, d.ultimaSequenciaObservada) + 1 : r.sequencia;
    if (!Number.isSafeInteger(sequencia) || sequencia! < 0 || sequencia! > 2147483647) throw new Error("Ordenação fiscal inválida");
    const pendenciaCancelamento = r.status === "PENDENTE_CONFERENCIA" && (d.acao === "CANCELAR" || d.cancelamentoPendente);
    const pendenciaConsultaAtual = r.status === "PENDENTE_CONFERENCIA" && r.ordenacao === "LOCAL_OBSERVACAO" && !!leaseToken && d.acao === "CONSULTAR";
    const ignorado = identidadeDivergente || r.status === "NAO_ENCONTRADO" && !!d.protocolo || sequencia! < d.ultimaSequencia || (!anterior && sequencia === d.ultimaSequencia) || (["CANCELADO", "DENEGADO"].includes(d.status) && r.status !== d.status) || (d.status === "AUTORIZADO" && !["AUTORIZADO", "CANCELADO"].includes(r.status) && !pendenciaCancelamento && !pendenciaConsultaAtual);
    if (!anterior) {
      await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave, tipo: ignorado ? "RETORNO_IGNORADO" : "RETORNO", dados: json({ ...r, ...(r.ordenacao === "LOCAL_OBSERVACAO" ? { sequenciaLocal: sequencia } : {}), hash: resumo }) } });
      if (r.ordenacao === "LOCAL_OBSERVACAO") await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { ultimaSequenciaObservada: sequencia } });
    }
    if (reobservacaoAtual) {
      // Resultado externo estável; uma nova leitura sob lease é outra observação local.
      await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: hash([chave, leaseToken]), tipo: ignorado ? "RETORNO_IGNORADO" : "RETORNO_REOBSERVADO", dados: json({ eventoId: r.eventoId, resultadoOriginalChave: chave, sequenciaLocal: sequencia, hash: resumo }) } });
      await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { ultimaSequenciaObservada: sequencia } });
    }
    if (ignorado && leaseToken) return tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { acao: null, proximaTentativa: null, leaseToken: null, leaseAte: null } });
    if (ignorado || (anterior && !leaseToken)) return d;
    const pendente = r.status === "PROCESSANDO";
    const esgotado = d.tentativas >= 3;
    const ausenciaIncertaBrasil = r.status === "NAO_ENCONTRADO" && a.id === "BRASIL_NFE";
    return tx.documentoFiscalSaida.update({ where: { id: d.id }, data: {
      // A solicitação de cancelamento não anula a autorização já comprovada.
      // Faturamento/arquivos permanecem válidos até receber o evento confirmado.
      status: pendenciaCancelamento && d.protocolo ? "AUTORIZADO" : ausenciaIncertaBrasil ? "PENDENTE_CONFERENCIA" : r.status === "NAO_ENCONTRADO" ? "PREPARADO" : pendente && esgotado ? "PENDENTE_CONFERENCIA" : r.status,
      ultimaSequencia: sequencia, referenciaProvedor: r.referencia ?? d.referenciaProvedor,
      chaveFiscal: r.status === "PENDENTE_CONFERENCIA" ? d.chaveFiscal ?? r.chave : r.chave ?? d.chaveFiscal,
      numero: r.status === "PENDENTE_CONFERENCIA" ? d.numero ?? r.numero : r.numero ?? d.numero,
      serie: r.status === "PENDENTE_CONFERENCIA" ? d.serie ?? r.serie : r.serie ?? d.serie,
      protocolo: r.status === "PENDENTE_CONFERENCIA" ? d.protocolo ?? r.protocolo : r.protocolo ?? d.protocolo,
      protocoloCancelamento: r.protocoloCancelamento ?? r.protocoloEvento ?? d.protocoloCancelamento,
      ...(r.status === "CANCELADO" ? { cancelamentoPendente: false } : pendenciaCancelamento ? { cancelamentoPendente: true } : {}),
      ultimoErro: r.erro ?? (ausenciaIncertaBrasil ? "Brasil NFe não comprova ausência atômica após tentativa. Reenvio bloqueado; conferência externa necessária." : r.status === "NAO_ENCONTRADO" ? "Emissor confirmou ausência. Novo envio exige confirmação explícita." : null),
      acao: pendente && !esgotado ? "CONSULTAR" : null, proximaTentativa: pendente && !esgotado ? new Date(Date.now() + 60000) : null, leaseToken: null, leaseAte: null,
    } });
  });
}
/** Uma unidade durável por chamada; reinício/lease vencido sempre consulta antes
 * de repetir envio ou cancelamento. Nenhuma tarefa roda sem adaptador configurado. */
export async function processarFiscalSaida() { return processarComAdaptador(obterAdaptadorFiscalSaida()); }
/** Uma unidade selecionada pelo administrador. A porta vinculada exige prova
 * de aprovação, consome o envio uma vez e nunca integra o registro automático. */
export async function executarFiscalSaidaControlado(a: AdaptadorFiscalSaida, id: string, acao: "ENVIAR" | "CONSULTAR" | "CANCELAR", motivo: string, sessao: SessaoAtual) {
  conferirCapacidadeHomologacao(a, id);
  await solicitarAcaoComAdaptador(id, acao, motivo, sessao, a);
  return processarComAdaptador(a, id);
}
export async function obterArquivosFiscalSaidaControlado(a: AdaptadorFiscalSaida, id: string, sessao: SessaoAtual) {
  conferirCapacidadeHomologacao(a, id);
  return obterArquivosComAdaptador(id, sessao, a);
}
/** Mesmo executor e mesmas travas. Registro durável/manual não concede acesso
 * ao processador automático, a outro documento ou ao callback. */
export async function executarFiscalSaidaManual(a: AdaptadorFiscalSaida, id: string, acao: "ENVIAR" | "CONSULTAR" | "CANCELAR", motivo: string, sessao: SessaoAtual) {
  conferirCapacidadeEmissaoManualBrasilNfe(a, id);
  await solicitarAcaoComAdaptador(id, acao, motivo, sessao, a);
  return processarComAdaptador(a, id);
}
export async function obterArquivosFiscalSaidaManual(a: AdaptadorFiscalSaida, id: string, sessao: SessaoAtual) {
  conferirCapacidadeEmissaoManualBrasilNfe(a, id);
  return obterArquivosComAdaptador(id, sessao, a);
}
async function processarComAdaptador(a: AdaptadorFiscalSaida | null, documentoId?: string) {
  if (!a) return { processado: false, mensagem: "Emissor não configurado" };
  if (a.id === "BRASIL_NFE" && !documentoId && !transmissaoBrasilNfeLiberada()) return { processado: false, mensagem: MENSAGEM_BLOQUEIO_TRANSMISSAO_BRASILNFE };
  if (a.ambiente === "PRODUCAO" && !possuiCapacidadeEmissaoManualBrasilNfe(a, documentoId) || a.bloqueioOperacional) return { processado: false, mensagem: a.ambiente === "PRODUCAO" ? BLOQUEIO_PRODUCAO_FISCAL_SAIDA : a.bloqueioOperacional! };
  if (possuiCapacidadeEmissaoManualBrasilNfe(a) && !documentoId) return { processado: false, mensagem: "O emissor manual exige selecionar um documento. Emissão automática permanece bloqueada." };
  const d = await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    const agora = new Date();
    const acoes = a.id === "BRASIL_NFE" ? ["CONSULTAR", ...(["ENVIAR", "CANCELAR"] as const).filter(operacao => transmissaoBrasilNfeLiberada({ documentoId, ambiente: a.ambiente, operacao }))] : null;
    const d = await tx.documentoFiscalSaida.findFirst({ where: { ...(documentoId ? { id: documentoId } : {}), provedor: a.id, ambiente: a.ambiente, acao: acoes ? { in: acoes } : { not: null }, proximaTentativa: { lte: agora }, OR: [{ leaseAte: null }, { leaseAte: { lte: agora } }] }, orderBy: { proximaTentativa: "asc" } });
    if (!d) return null;
    if (await acompanhamentoDoPedido(tx, d.pedidoId)) {
      await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { acao: null, proximaTentativa: null, ultimoErro: BLOQUEIO_ACOMPANHAMENTO_IFOOD } });
      await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `acompanhamento:${randomUUID()}`, tipo: "ENVIO_INTERROMPIDO", dados: { motivo: "ACOMPANHAMENTO_TAKEAT" } } });
      return null;
    }
    if (d.acao === "ENVIAR" && !d.leaseToken) {
      await tx.$queryRaw`SELECT id FROM "PedidoVenda" WHERE id=${d.pedidoId} FOR UPDATE`;
      const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: d.pedidoId } });
      if (p.versao !== d.versaoPedido || p.status !== "CONFIRMADO") {
        await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { acao: null, proximaTentativa: null, status: "PREPARADO", ultimoErro: "Pedido alterado após a solicitação. Confira a revisão atual antes de emitir." } });
        await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `revisao-alterada:${randomUUID()}`, tipo: "ENVIO_INTERROMPIDO", dados: { revisaoAtual: p.versao, statusPedido: p.status } } });
        return null;
      }
      if (await tx.historicoPedidoVenda.count({ where: { pedidoId: d.pedidoId, tipo: "DOCUMENTO_FISCAL_EXTERNO" } })) {
        await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { acao: null, proximaTentativa: null, status: "PREPARADO", ultimoErro: "Documento fiscal externo registrado após a solicitação. Confira o Takeat antes de emitir." } });
        await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `documento-externo:${randomUUID()}`, tipo: "ENVIO_INTERROMPIDO", dados: { motivo: "DOCUMENTO_FISCAL_EXTERNO" } } });
        return null;
      }
      try { await conferirCalculoAtualFiscalSaida(tx, d, { enviar: true }); } catch {
        await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { acao: null, proximaTentativa: null, status: "PREPARADO", ultimoErro: "Configuração ou data fiscal mudou. Reprepare antes de emitir; histórico preservado." } });
        await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `vigencia-alterada:${randomUUID()}`, tipo: "ENVIO_INTERROMPIDO", dados: { motivo: "VIGENCIA_FISCAL_ALTERADA" } } });
        return null;
      }
    }
    return tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { acao: d.leaseToken ? "CONSULTAR" : d.acao, ...(d.leaseToken && d.acao === "CANCELAR" ? { cancelamentoPendente: true } : {}), status: d.acao === "CONSULTAR" || ["AUTORIZADO", "CANCELADO", "DENEGADO"].includes(d.status) ? d.status : "PROCESSANDO", leaseToken: randomUUID(), leaseAte: new Date(Date.now() + 120000), tentativas: { increment: 1 } } });
  });
  if (!d) return { processado: false, mensagem: "Sem solicitações pendentes" };
  try {
    const i = identidade(d, a);
    if (a.id === "BRASIL_NFE" && d.acao !== "CONSULTAR") exigirTransmissaoBrasilNfeLiberada({ documentoId: d.id, ambiente: d.ambiente, modelo: d.modeloDocumento ?? undefined, operacao: d.acao === "CANCELAR" ? "CANCELAR" : "ENVIAR" });
    const r = d.acao === "ENVIAR" ? await a.enviar(i, d.payload) : d.acao === "CANCELAR" ? await a.cancelar(i, d.motivoCancelamento!) : await a.consultar(i);
    if (r.documentoId !== d.id) throw new Error("Documento divergente");
    await aplicarRetornoFiscalSaida(a, r, d.leaseToken!);
    if (documentoId) await prisma.documentoFiscalSaida.updateMany({ where: { id: d.id, leaseToken: null }, data: { acao: null, proximaTentativa: null } });
  } catch (erro) {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
      const atual = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id: d.id } }); if (atual.leaseToken !== d.leaseToken) return;
      const confirmadoAntesConsulta = d.acao === "CONSULTAR" && ["AUTORIZADO", "CANCELADO", "DENEGADO"].includes(d.status);
      const cancelamentoIncerto = d.acao === "CANCELAR" || atual.cancelamentoPendente, manual = !!documentoId || d.tentativas >= 3 || cancelamentoIncerto || confirmadoAntesConsulta;
      const orientacao = confirmadoAntesConsulta ? "Consulta não confirmada. Resultado fiscal comprovado permanece preservado; conferir o histórico antes de outra ação." : cancelamentoIncerto ? "Cancelamento não confirmado. A nota permanece autorizada até a confirmação do evento. Consulte o resultado; não repita o cancelamento." : "Resultado não confirmado. Consulte o emissor antes de qualquer novo envio.";
      // Somente classes locais com mensagens saneadas. Nunca persistir Error livre,
      // causa, corpo HTTP, credencial ou detalhe fornecido pelo serviço externo.
      const motivoSeguro = erro instanceof ErroHttpBrasilNfe || erro instanceof ErroConsultaBrasilNfe || erro instanceof ErroValidacaoSnapshotBrasilNfe ? erro.message : null;
      const ultimoErro = motivoSeguro ? `${motivoSeguro.slice(0, Math.max(0, 498 - orientacao.length))} ${orientacao}` : orientacao;
      await tx.documentoFiscalSaida.update({ where: { id: d.id }, data: { status: cancelamentoIncerto && d.protocolo ? "AUTORIZADO" : confirmadoAntesConsulta ? d.status : manual ? "PENDENTE_CONFERENCIA" : "INCERTO", cancelamentoPendente: cancelamentoIncerto, acao: manual ? null : "CONSULTAR", proximaTentativa: manual ? null : new Date(Date.now() + 60000), leaseToken: null, leaseAte: null, ultimoErro } });
      await tx.eventoFiscalSaida.create({ data: { documentoId: d.id, chave: `incerto:${d.leaseToken}`, tipo: "RESULTADO_INCERTO", dados: { acao: d.acao, tentativa: d.tentativas } } });
    });
  }
  return { processado: true, mensagem: "Tentativa registrada" };
}
export async function obterArquivosFiscalSaida(id: string, sessao: SessaoAtual) { return obterArquivosComAdaptador(id, sessao, obterAdaptadorFiscalSaida()); }
async function obterArquivosComAdaptador(id: string, sessao: SessaoAtual, a: AdaptadorFiscalSaida | null) {
  if (!a) throw new ErroPedidoVenda("Emissor não configurado.");
  conferirAdaptadorOperacional(a);
  const d = await prisma.$transaction(async tx => { await conferirAcesso(tx, sessao, ["fiscal"]); return tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id } }); });
  if (!["AUTORIZADO", "CANCELADO"].includes(d.status) || d.provedor !== a.id || d.ambiente !== a.ambiente) throw new ErroPedidoVenda("Documento sem autorização confirmada neste emissor.");
  const f = await a.obterDocumentos(identidade(d, a));
  if (f.xml && (Buffer.byteLength(f.xml) > 2 * 1024 * 1024 || !f.xml.trim().startsWith("<"))) throw new ErroPedidoVenda("XML inválido retornado pelo emissor.");
  if (f.pdf && (f.pdf.length > 10 * 1024 * 1024 || Buffer.from(f.pdf.subarray(0, 5)).toString() !== "%PDF-")) throw new ErroPedidoVenda("PDF inválido retornado pelo emissor.");
  if (f.html && (d.modeloDocumento !== 65 || Buffer.byteLength(f.html) > 1024 * 1024 || !/^\s*(?:<!doctype html>|<html)/i.test(f.html))) throw new ErroPedidoVenda("Documento HTML inválido retornado pelo emissor.");
  if (f.xmlCancelamento && (Buffer.byteLength(f.xmlCancelamento) > 2 * 1024 * 1024 || !f.xmlCancelamento.trim().startsWith("<"))) throw new ErroPedidoVenda("XML do evento inválido retornado pelo emissor.");
  if (f.html) {
    if (!d.chaveFiscal) throw new ErroPedidoVenda("Documento HTML sem identidade fiscal confirmada.");
    f.html = sanitizarHtmlNfceBrasilNfe(Buffer.from(f.html, "utf8"), d.chaveFiscal);
  }
  if (f.xmlCancelamento) {
    if (!d.chaveFiscal || !d.protocoloCancelamento || d.status !== "CANCELADO") throw new ErroPedidoVenda("Evento de cancelamento não confirmado.");
    f.xmlCancelamento = validarXmlCancelamentoBrasilNfe(Buffer.from(f.xmlCancelamento).toString("base64"), { identidade: conferirIdentidadeBrasilNfe(identidade(d, a)), chave: d.chaveFiscal, protocoloCancelamento: d.protocoloCancelamento });
  }
  await prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["fiscal"]);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('fiscal-saida'))`;
    const atual = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id } });
    if (!["AUTORIZADO", "CANCELADO"].includes(atual.status) || atual.provedor !== a.id || atual.ambiente !== a.ambiente || atual.chaveFiscal !== d.chaveFiscal || atual.protocolo !== d.protocolo) throw new ErroPedidoVenda("Documento alterado durante a obtenção de arquivos.");
    await tx.documentoFiscalSaida.update({ where: { id }, data: { ...(f.xml ? { xml: f.xml } : {}), ...(f.pdf ? { pdf: Buffer.from(f.pdf) } : {}), ...(f.html ? { html: f.html } : {}), ...(f.xmlCancelamento ? { xmlCancelamento: f.xmlCancelamento } : {}) } });
    await tx.eventoFiscalSaida.create({ data: { documentoId: id, chave: `arquivos:${randomUUID()}`, tipo: "ARQUIVOS_PROVEDOR", dados: json({ usuarioId: sessao.userId, provedor: a.id, ambiente: a.ambiente, xmlHash: f.xml ? hash(f.xml) : null, pdfHash: f.pdf ? createHash("sha256").update(f.pdf).digest("hex") : null, htmlHash: f.html ? hash(f.html) : null, xmlCancelamentoHash: f.xmlCancelamento ? hash(f.xmlCancelamento) : null }) } });
  });
}
export async function baixarArquivoFiscalSaida(id: string, tipo: string, sessao: SessaoAtual) {
  if (!idValido(id) || !["xml", "pdf", "html", "cancelamento"].includes(tipo)) throw new ErroPedidoVenda("Arquivo inválido.");
  return prisma.$transaction(async tx => { await acessoConsulta(tx, sessao); const d = await tx.documentoFiscalSaida.findUniqueOrThrow({ where: { id }, select: { xml: true, pdf: true, html: true, xmlCancelamento: true } }); return tipo === "xml" ? d.xml : tipo === "pdf" ? d.pdf : tipo === "html" ? d.html : d.xmlCancelamento; });
}
