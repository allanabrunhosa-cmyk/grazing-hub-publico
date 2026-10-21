import "server-only";
import { identidadeFiscalCobranca } from "@/lib/vendas/cliente-cobranca";
import { prisma } from "@/lib/prisma";
import type { SessaoAtual } from "@/lib/session";
import { conferirAcesso } from "@/lib/vendas/pedidos";
import { calcularPreviaPedido } from "@/lib/tributacao/pedidos";
import { hojeCivilRegraBrasilNfe } from "./regras-tributarias-dominio";
import { obterRegimeFiscalEmpresaBrasilNfe } from "./regime-empresa";
import { obterNumeracaoFiscalBrasilNfe } from "./numeracao";
import { liberacaoTransmissaoBrasilNfe } from "./bloqueio-transmissao";
import { ErroEmissaoPedidoBrasilNfe, type AmbienteEmissaoBrasilNfe } from "./operacional-dominio";
import type { PendenciaEmissaoPedidoBrasilNfe, PreviaEmissaoPedidoBrasilNfe } from "./operacional";

const objeto = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const texto = (v: unknown, max = 200): string | null => typeof v === "string" && v.length <= max && !/[\p{C}<>]/u.test(v) ? v : null;
const codigo = (v: unknown, formato: RegExp) => (typeof v === "string" || typeof v === "number") && formato.test(String(v)) ? String(v) : null;
const integracao = "/configuracoes/integracoes/brasilnfe";
type LerPendencias = (sessao: SessaoAtual, modelo: 55 | 65, ambiente: AmbienteEmissaoBrasilNfe) => Promise<PendenciaEmissaoPedidoBrasilNfe[]>;

/** Projeção efêmera do motor vigente. Não prepara documento, plano, evento ou fila.
 * A existência de um resultado anterior é informação, nunca autorização de reenvio. */
export async function previaPedidoSemTransmissaoBrasilNfe(pedidoId: string, versao: number, modelo: 55 | 65, ambiente: AmbienteEmissaoBrasilNfe, sessao: SessaoAtual, lerPendencias: LerPendencias): Promise<PreviaEmissaoPedidoBrasilNfe> {
  if (typeof pedidoId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(pedidoId) || !Number.isSafeInteger(versao) || versao < 1
    || ![55, 65].includes(modelo) || !["HOMOLOGACAO", "PRODUCAO"].includes(ambiente)) throw new ErroEmissaoPedidoBrasilNfe("Pedido, revisão, modelo ou ambiente inválidos.");
  const leitura = await prisma.$transaction(async tx => {
    await conferirAcesso(tx, sessao, ["consultar", "revisar", "fiscal"], pedidoId);
    const p = await tx.pedidoVenda.findUniqueOrThrow({ where: { id: pedidoId }, include: { itens: { where: { vigente: true }, orderBy: { ordem: "asc" } } } });
    if (p.status !== "CONFIRMADO" || p.versao !== versao) throw new ErroEmissaoPedidoBrasilNfe("Reabra a revisão vigente de um pedido confirmado.");
    const tributacao = await calcularPreviaPedido(tx, p, String(modelo) as "55" | "65", { ambiente });
    const loja = await tx.configuracaoLoja.findUnique({ where: { id: "singleton" }, select: { nome: true, cnpj: true } });
    const documentos = await tx.documentoFiscalSaida.findMany({ where: { pedidoId }, orderBy: [{ versaoPedido: "desc" }, { revisaoFiscal: "desc" }], select: {
      id: true, versaoPedido: true, provedor: true, referenciaProvedor: true, modeloDocumento: true, status: true, ambiente: true, hashPayload: true,
      numero: true, serie: true, chaveFiscal: true, protocolo: true, ultimoErro: true, tentativas: true,
      eventos: { select: { id: true, tipo: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 },
    } });
    const arquivos = await tx.$queryRaw<{ id: string; xmlDisponivel: boolean; formatoImpressao: "PDF" | "HTML" | null }[]>`SELECT id, xml IS NOT NULL AS "xmlDisponivel", CASE WHEN pdf IS NOT NULL THEN 'PDF' WHEN html IS NOT NULL THEN 'HTML' ELSE NULL END AS "formatoImpressao" FROM "DocumentoFiscalSaida" WHERE "pedidoId"=${pedidoId}`;
    const [config] = await tx.$queryRaw<{ existe: boolean; tokenConfigurado: boolean }[]>`SELECT EXISTS(SELECT 1 FROM "ConfiguracaoBrasilNfe" WHERE id='singleton') AS existe, EXISTS(SELECT 1 FROM "ConfiguracaoBrasilNfe" WHERE id='singleton' AND "tokenCifrado" IS NOT NULL) AS "tokenConfigurado"`;
    return { p, tributacao, loja, documentos, arquivos, config };
  }, { timeout: 30000 });
  const { p, tributacao, loja, documentos, arquivos, config } = leitura;
  const regime = await obterRegimeFiscalEmpresaBrasilNfe(hojeCivilRegraBrasilNfe(), sessao);
  const pendencias: PendenciaEmissaoPedidoBrasilNfe[] = tributacao.pendencias.map(mensagem => {
    if (typeof mensagem !== "string") throw new ErroEmissaoPedidoBrasilNfe("Prévia fiscal local incompatível: conferir as pendências calculadas.");
    return { campo: "tributacao", mensagem, href: "/financeiro/fiscal/cobertura?aba=regras" };
  });
  pendencias.push(...await lerPendencias(sessao, modelo, ambiente));
  if (!config?.existe) pendencias.push({ campo: "configuracao", mensagem: "Completar a configuração administrativa do Brasil NFe.", href: integracao });
  else if (!config.tokenConfigurado) pendencias.push({ campo: "token", mensagem: "Configurar o Token da empresa no campo protegido do Brasil NFe.", href: integracao });
  const d = documentos.find(d => d.versaoPedido === versao), arquivo = arquivos.find(a => a.id === d?.id);
  if (documentos.some(d => ["AUTORIZADO", "DENEGADO", "PROCESSANDO", "INCERTO", "PENDENTE_CONFERENCIA"].includes(d.status) || d.referenciaProvedor)) pendencias.push({ campo: "duplicidade", mensagem: "Existe documento ou resultado fiscal vinculado a esta venda. Consultar e reconciliar; emissão duplicada bloqueada.", href: integracao });
  if (d && (d.tentativas || !["SEM_EMISSOR", "PREPARADO"].includes(d.status))) pendencias.push({ campo: "resultado", mensagem: "Documento já processado. Consulte o próprio documento; reenvio automático permanece proibido.", href: integracao });
  if (d && (d.modeloDocumento !== null && d.modeloDocumento !== modelo || !["NAO_CONFIGURADO", ambiente].includes(d.ambiente))) pendencias.push({ campo: "modelo", mensagem: "O documento existente pertence ao modelo e ambiente originais. Preserve o histórico e consulte esse contexto.", href: integracao });
  if (p.referenciaOrigem || p.origem !== "INTERNO") pendencias.push({ campo: "documentoExterno", mensagem: "Venda originada em sistema externo: conferir e vincular o documento já emitido no sistema de origem antes de qualquer emissão pelo HUB.", href: integracao });
  const comprador = identidadeFiscalCobranca(objeto(p.compradorSnapshot), p.cobrancaSnapshot), endereco = objeto(p.cobrancaSnapshot);
  return { pedidoId, numeroPedido: p.numero, versaoPedido: versao, modelo, ambiente, ambientesDisponiveis: ["HOMOLOGACAO", "PRODUCAO"], modeloSugerido: comprador.inscricaoEstadual ? 55 : 65,
    emitente: { nome: texto(loja?.nome), cnpj: texto(loja?.cnpj), ie: regime.ie, crtDescricao: regime.crt && regime.descricaoCrt ? `${regime.crt} — ${regime.descricaoCrt}` : null },
    destinatario: { nome: texto(comprador.tipo === "PJ" ? comprador.razaoSocial : comprador.nome), documento: texto(comprador.documento), endereco: [endereco.logradouro, endereco.numero, endereco.cidade, endereco.uf].map(v => texto(v)).filter(Boolean).join(", ") || null },
    itens: p.itens.map((i, indice) => {
      const produtos = tributacao.documento.Produtos, candidatas = produtos.filter(f => f.CodProdutoServico === i.produtoId);
      const f = produtos.length === p.itens.length && produtos[indice].CodProdutoServico === i.produtoId ? produtos[indice] : candidatas.length === 1 ? candidatas[0] : null;
      const imposto = objeto(f?.Imposto);
      return { id: i.id, produtoId: i.produtoId ?? "", nome: texto(objeto(i.produtoSnapshot).nome) ?? "Produto", quantidade: i.quantidade.toString(), unidade: i.unidadeSnapshot, total: i.totalLinha.toFixed(2),
        fiscal: f ? { ncm: codigo(f.NCM, /^\d{8}$/), cfop: codigo(f.CFOP, /^\d{4}$/), origem: codigo(f.OrigemProduto, /^[0-8]$/), icms: codigo(objeto(imposto.ICMS).CodSituacaoTributaria, /^(?:\d{2}|\d{3})$/), pis: codigo(objeto(imposto.PIS).CodSituacaoTributaria, /^\d{2}$/), cofins: codigo(objeto(imposto.COFINS).CodSituacaoTributaria, /^\d{2}$/) } : null };
    }),
    total: p.total.toFixed(2), valores: { subtotal: p.subtotal.toFixed(2), desconto: p.desconto.toFixed(2), frete: p.frete.toFixed(2), outrosCustos: p.outrosCustos.toFixed(2) }, pendencias,
    liberacaoTransmissao: liberacaoTransmissaoBrasilNfe(), podeEmitir: false, numeracao: await obterNumeracaoFiscalBrasilNfe(sessao),
    documento: d ? { id: d.id, versaoPedido: d.versaoPedido, provedor: d.provedor, referenciaProvedor: d.referenciaProvedor, modeloDocumento: d.modeloDocumento, status: d.status, ambiente: d.ambiente,
      hashSnapshot: d.hashPayload, hashPayloadFiscal: null, numero: d.numero, serie: d.serie, chaveFiscal: d.chaveFiscal, protocolo: d.protocolo, ultimoErro: d.ultimoErro,
      xmlDisponivel: arquivo?.xmlDisponivel ?? false, formatoImpressao: arquivo?.formatoImpressao ?? null, tentativas: d.tentativas, eventos: d.eventos } : null };
}
